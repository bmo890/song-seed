import CryptoKit
import ExpoModulesCore
import Foundation

/**
 * Backups and archives in one native pass (2026-10-20), the iOS twin of the Android
 * module: each file is read once, written straight into a STORED zip, and its CRC-32 (the
 * zip needs it) and SHA-256 of its base64 form (the v1 backup manifest digest) come from
 * the same bytes. The archive layout matches src/services/zipArchive.ts byte for byte:
 * version 20, UTF-8 flag, no timestamps. (The Android-only content-URI copy stays there;
 * iOS saves through the share sheet.)
 */
private let zip32Max: UInt64 = 0xFFFF_FFFF
private let ioChunk = 1024 * 1024
private let progressEvery: UInt64 = 4 * 1024 * 1024

private struct IOError: LocalizedError {
  let message: String
  var errorDescription: String? { message }
}

/** CRC-32 (IEEE, as zip uses), slice-by-8 over a precomputed table. */
private final class Crc32 {
  private static let tables: [[UInt32]] = {
    var tables = Array(repeating: Array(repeating: UInt32(0), count: 256), count: 8)
    for i in 0..<256 {
      var c = UInt32(i)
      for _ in 0..<8 { c = (c & 1) != 0 ? 0xEDB8_8320 ^ (c >> 1) : c >> 1 }
      tables[0][i] = c
    }
    for i in 0..<256 {
      for t in 1..<8 {
        let prev = tables[t - 1][i]
        tables[t][i] = tables[0][Int(prev & 0xFF)] ^ (prev >> 8)
      }
    }
    return tables
  }()
  private var crc: UInt32 = 0xFFFF_FFFF

  func update(_ data: Data) {
    let t = Crc32.tables
    var c = crc
    data.withUnsafeBytes { (raw: UnsafeRawBufferPointer) in
      guard let base = raw.bindMemory(to: UInt8.self).baseAddress else { return }
      var i = 0
      let n = raw.count
      while i + 8 <= n {
        let one = c ^ (UInt32(base[i]) | UInt32(base[i + 1]) << 8 | UInt32(base[i + 2]) << 16 | UInt32(base[i + 3]) << 24)
        c = t[7][Int(one & 0xFF)] ^ t[6][Int((one >> 8) & 0xFF)] ^ t[5][Int((one >> 16) & 0xFF)] ^ t[4][Int(one >> 24)]
          ^ t[3][Int(base[i + 4])] ^ t[2][Int(base[i + 5])] ^ t[1][Int(base[i + 6])] ^ t[0][Int(base[i + 7])]
        i += 8
      }
      while i < n {
        c = t[0][Int((c ^ UInt32(base[i])) & 0xFF)] ^ (c >> 8)
        i += 1
      }
    }
    crc = c
  }

  var value: UInt32 { crc ^ 0xFFFF_FFFF }
}

/** Streaming SHA-256 over the base64 text of a byte stream (padding only at the end). */
private final class Base64Sha256 {
  private var hasher = SHA256()
  private var carry = Data()

  func update(_ data: Data) {
    var buffer = data
    if !carry.isEmpty {
      buffer = carry + data
      carry = Data()
    }
    let whole = buffer.count - buffer.count % 3
    if whole > 0 {
      hasher.update(data: buffer.prefix(whole).base64EncodedData())
    }
    if whole < buffer.count {
      carry = Data(buffer.suffix(from: buffer.startIndex + whole))
    }
  }

  func hex() -> String {
    if !carry.isEmpty { hasher.update(data: carry.base64EncodedData()) }
    return hasher.finalize().map { String(format: "%02x", $0) }.joined()
  }
}

private func le16(_ value: Int) -> Data {
  Data([UInt8(value & 0xFF), UInt8((value >> 8) & 0xFF)])
}

private func le32(_ value: UInt64) -> Data {
  Data([UInt8(value & 0xFF), UInt8((value >> 8) & 0xFF), UInt8((value >> 16) & 0xFF), UInt8((value >> 24) & 0xFF)])
}

private func localHeader(_ name: Data, _ size: UInt64, _ crc: UInt32) -> Data {
  var d = Data()
  d += le32(0x0403_4B50); d += le16(20); d += le16(0x0800); d += le16(0); d += le16(0); d += le16(0)
  d += le32(UInt64(crc)); d += le32(size); d += le32(size); d += le16(name.count); d += le16(0); d += name
  return d
}

private func centralHeader(_ name: Data, _ size: UInt64, _ crc: UInt32, _ offset: UInt64) -> Data {
  var d = Data()
  d += le32(0x0201_4B50); d += le16(20); d += le16(20); d += le16(0x0800); d += le16(0); d += le16(0); d += le16(0)
  d += le32(UInt64(crc)); d += le32(size); d += le32(size); d += le16(name.count); d += le16(0); d += le16(0)
  d += le16(0); d += le16(0); d += le32(0); d += le32(offset); d += name
  return d
}

private func localURL(_ uri: String) throws -> URL {
  if let url = URL(string: uri), url.scheme != nil {
    guard url.isFileURL else { throw IOError(message: "Expected a local file: \(uri)") }
    return url
  }
  return URL(fileURLWithPath: uri)
}

private final class ZipWriter {
  let url: URL
  let handle: FileHandle
  var central: [Data] = []
  var entryCount = 0

  init(url: URL) throws {
    self.url = url
    try? FileManager.default.removeItem(at: url)
    try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    guard FileManager.default.createFile(atPath: url.path, contents: nil) else {
      throw IOError(message: "Could not create the archive.")
    }
    handle = try FileHandle(forUpdating: url)
  }
}

public class SongNookFileIOModule: Module {
  private let lock = NSLock()
  private var cancellations: [String: Bool] = [:]
  private var writers: [String: ZipWriter] = [:]

  private func startOperation(_ id: String) {
    lock.lock(); cancellations[id] = false; lock.unlock()
  }

  private func isCancelled(_ id: String) -> Bool {
    lock.lock(); defer { lock.unlock() }
    return cancellations[id] ?? false
  }

  private func endOperation(_ id: String) {
    lock.lock(); cancellations.removeValue(forKey: id); lock.unlock()
  }

  private func writer(_ id: String) throws -> ZipWriter {
    lock.lock(); defer { lock.unlock() }
    guard let writer = writers[id] else { throw IOError(message: "Zip writer is not open.") }
    return writer
  }

  private func takeWriter(_ id: String) -> ZipWriter? {
    lock.lock(); defer { lock.unlock() }
    return writers.removeValue(forKey: id)
  }

  private func progress(_ operationId: String, _ done: UInt64, _ total: UInt64) {
    sendEvent("onCopyProgress", [
      "operationId": operationId,
      "completedBytes": Double(done),
      "totalBytes": Double(total),
    ])
  }

  private func addData(_ writerId: String, _ archiveName: String, _ data: Data) throws -> [String: Any] {
    let writer = try writer(writerId)
    let name = Data(archiveName.utf8)
    let crc = Crc32()
    crc.update(data)
    let entryStart = try writer.handle.offset()
    try writer.handle.write(contentsOf: localHeader(name, UInt64(data.count), crc.value))
    try writer.handle.write(contentsOf: data)
    writer.central.append(centralHeader(name, UInt64(data.count), crc.value, entryStart))
    writer.entryCount += 1
    return ["crc32": Double(crc.value), "sizeBytes": Double(data.count)]
  }

  public func definition() -> ModuleDefinition {
    Name("SongNookFileIO")

    Events("onCopyProgress")

    AsyncFunction("zipCreateAsync") { (writerId: String, destinationUri: String) in
      let created = try ZipWriter(url: try localURL(destinationUri))
      self.lock.lock()
      defer { self.lock.unlock() }
      if self.writers[writerId] != nil {
        try? created.handle.close()
        throw IOError(message: "A zip writer with this ID is already open.")
      }
      self.writers[writerId] = created
    }

    AsyncFunction("zipAddFileAsync") {
      (writerId: String, archiveName: String, sourceUri: String, expectedSize: Double, computeSha256: Bool, operationId: String) -> [String: Any] in
      let writer = try self.writer(writerId)
      let sourceURL = try localURL(sourceUri)
      guard let attributes = try? FileManager.default.attributesOfItem(atPath: sourceURL.path),
        let size = attributes[.size] as? NSNumber
      else { throw IOError(message: "Missing file: \(archiveName)") }
      let totalBytes = size.uint64Value
      self.startOperation(operationId)
      defer { self.endOperation(operationId) }
      let entryStart = try writer.handle.offset()
      do {
        if expectedSize >= 0 && UInt64(expectedSize) != totalBytes {
          throw IOError(message: "File changed while it was being backed up.")
        }
        if totalBytes > zip32Max { throw IOError(message: "File too large for the archive: \(archiveName)") }
        let name = Data(archiveName.utf8)
        try writer.handle.write(contentsOf: localHeader(name, totalBytes, 0))
        let crc = Crc32()
        let sha = computeSha256 ? Base64Sha256() : nil
        let input = try FileHandle(forReadingFrom: sourceURL)
        defer { try? input.close() }
        var written: UInt64 = 0
        var sinceProgress: UInt64 = 0
        while true {
          if self.isCancelled(operationId) { throw IOError(message: "SONGNOOK_IO_CANCELLED") }
          let chunk = try autoreleasepool { try input.read(upToCount: ioChunk) } ?? Data()
          if chunk.isEmpty { break }
          try writer.handle.write(contentsOf: chunk)
          crc.update(chunk)
          sha?.update(chunk)
          written += UInt64(chunk.count)
          sinceProgress += UInt64(chunk.count)
          if sinceProgress >= progressEvery {
            self.progress(operationId, written, totalBytes)
            sinceProgress = 0
          }
        }
        if written != totalBytes { throw IOError(message: "File changed while it was being backed up.") }
        let end = try writer.handle.offset()
        try writer.handle.seek(toOffset: entryStart + 14)
        try writer.handle.write(contentsOf: le32(UInt64(crc.value)))
        try writer.handle.seek(toOffset: end)
        writer.central.append(centralHeader(name, written, crc.value, entryStart))
        writer.entryCount += 1
        var result: [String: Any] = ["crc32": Double(crc.value), "sizeBytes": Double(written)]
        if let sha = sha { result["sha256"] = sha.hex() }
        return result
      } catch {
        // Leave the archive exactly as it was before this entry: a missing or changed
        // file is recorded by the caller and the backup goes on without it.
        try? writer.handle.truncate(atOffset: entryStart)
        try? writer.handle.seek(toOffset: entryStart)
        throw error
      }
    }

    AsyncFunction("zipAddDataAsync") { (writerId: String, archiveName: String, base64Data: String) -> [String: Any] in
      guard let data = Data(base64Encoded: base64Data) else { throw IOError(message: "Invalid archive data.") }
      return try self.addData(writerId, archiveName, data)
    }

    // Text entries (the library snapshot, the manifest) go in as UTF-8 without a base64 trip.
    AsyncFunction("zipAddTextAsync") { (writerId: String, archiveName: String, text: String) -> [String: Any] in
      try self.addData(writerId, archiveName, Data(text.utf8))
    }

    AsyncFunction("zipFinishAsync") { (writerId: String) -> [String: Any] in
      guard let writer = self.takeWriter(writerId) else { throw IOError(message: "Zip writer is not open.") }
      do {
        let centralOffset = try writer.handle.offset()
        var centralSize: UInt64 = 0
        for header in writer.central {
          try writer.handle.write(contentsOf: header)
          centralSize += UInt64(header.count)
        }
        if writer.entryCount >= 0xFFFF || centralOffset + centralSize + 22 > zip32Max {
          throw IOError(message: "Archive exceeds the 4 GB limit of the supported ZIP format.")
        }
        var end = Data()
        end += le32(0x0605_4B50); end += le16(0); end += le16(0)
        end += le16(writer.entryCount); end += le16(writer.entryCount)
        end += le32(centralSize); end += le32(centralOffset); end += le16(0)
        try writer.handle.write(contentsOf: end)
        try writer.handle.synchronize()
        let size = try writer.handle.offset()
        try writer.handle.close()
        return ["sizeBytes": Double(size)]
      } catch {
        try? writer.handle.close()
        try? FileManager.default.removeItem(at: writer.url)
        throw error
      }
    }

    AsyncFunction("zipAbortAsync") { (writerId: String) in
      guard let writer = self.takeWriter(writerId) else { return }
      try? writer.handle.close()
      try? FileManager.default.removeItem(at: writer.url)
    }

    AsyncFunction("extractRangeAsync") {
      (sourceUri: String, offset: Double, length: Double, destinationUri: String, computeSha256: Bool, operationId: String) -> [String: Any] in
      self.startOperation(operationId)
      defer { self.endOperation(operationId) }
      let destination = try localURL(destinationUri)
      let total = UInt64(length)
      do {
        try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
        if !FileManager.default.fileExists(atPath: destination.path) {
          guard FileManager.default.createFile(atPath: destination.path, contents: nil) else {
            throw IOError(message: "Could not create the restored file.")
          }
        }
        let input = try FileHandle(forReadingFrom: try localURL(sourceUri))
        defer { try? input.close() }
        let output = try FileHandle(forWritingTo: destination)
        defer { try? output.close() }
        try output.truncate(atOffset: 0)
        try input.seek(toOffset: UInt64(offset))
        let crc = Crc32()
        let sha = computeSha256 ? Base64Sha256() : nil
        var remaining = total
        var written: UInt64 = 0
        var sinceProgress: UInt64 = 0
        while remaining > 0 {
          if self.isCancelled(operationId) { throw IOError(message: "SONGNOOK_IO_CANCELLED") }
          let want = Int(min(UInt64(ioChunk), remaining))
          let chunk = try autoreleasepool { try input.read(upToCount: want) } ?? Data()
          if chunk.isEmpty { throw IOError(message: "The archive ended early.") }
          try output.write(contentsOf: chunk)
          crc.update(chunk)
          sha?.update(chunk)
          remaining -= UInt64(chunk.count)
          written += UInt64(chunk.count)
          sinceProgress += UInt64(chunk.count)
          if sinceProgress >= progressEvery {
            self.progress(operationId, written, total)
            sinceProgress = 0
          }
        }
        try output.synchronize()
        var result: [String: Any] = ["crc32": Double(crc.value), "sizeBytes": Double(written)]
        if let sha = sha { result["sha256"] = sha.hex() }
        return result
      } catch {
        try? FileManager.default.removeItem(at: destination)
        throw error
      }
    }

    Function("cancelCopy") { (operationId: String) in
      self.lock.lock()
      if self.cancellations[operationId] != nil { self.cancellations[operationId] = true }
      self.lock.unlock()
    }
  }
}
