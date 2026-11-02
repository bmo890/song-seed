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

/**
 * Streaming SHA-256 over the base64 text of a byte stream (padding only at the end).
 * Base64 of a byte run that is a multiple of three is a prefix of the whole text, so
 * each chunk is hashed in place: the 0-2 bytes carried from the last chunk are topped
 * up to three and hashed on their own. The chunk itself is never copied (it used to be,
 * on two calls in three, since 1 MiB is not a multiple of three; audit 05-E11).
 */
private final class Base64Sha256 {
  private var hasher = SHA256()
  private var carry = Data()

  func update(_ data: Data) {
    autoreleasepool {
      var start = data.startIndex
      if !carry.isEmpty {
        let topUp = min(3 - carry.count, data.count)
        carry.append(data[start..<(start + topUp)])
        start += topUp
        if carry.count < 3 { return }
        hasher.update(data: carry.base64EncodedData())
        carry = Data()
      }
      let rest = data.endIndex - start
      let whole = rest - rest % 3
      if whole > 0 {
        hasher.update(data: data[start..<(start + whole)].base64EncodedData())
      }
      if whole < rest {
        carry = Data(data[(start + whole)...])
      }
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

private func le64(_ value: UInt64) -> Data {
  var d = Data()
  for shift in stride(from: 0, to: 64, by: 8) { d.append(UInt8((value >> UInt64(shift)) & 0xFF)) }
  return d
}

/*
 * Zip64 (2026-11-02, audit G1): an entry of 4 GB or more, an entry starting past 4 GB, or
 * a directory past either ZIP32 ceiling carries the standard Zip64 records, exactly as
 * src/services/zipArchive.ts writes them. Under 4 GB the bytes are unchanged.
 */
private func localHeader(_ name: Data, _ size: UInt64, _ crc: UInt32) -> Data {
  let zip64 = size >= zip32Max
  var d = Data()
  d += le32(0x0403_4B50); d += le16(zip64 ? 45 : 20); d += le16(0x0800); d += le16(0); d += le16(0); d += le16(0)
  d += le32(UInt64(crc)); d += le32(zip64 ? zip32Max : size); d += le32(zip64 ? zip32Max : size)
  d += le16(name.count); d += le16(zip64 ? 20 : 0); d += name
  if zip64 { d += le16(0x0001); d += le16(16); d += le64(size); d += le64(size) }
  return d
}

private func centralHeader(_ name: Data, _ size: UInt64, _ crc: UInt32, _ offset: UInt64) -> Data {
  let zip64 = size >= zip32Max || offset >= zip32Max
  var d = Data()
  d += le32(0x0201_4B50); d += le16(zip64 ? 45 : 20); d += le16(zip64 ? 45 : 20); d += le16(0x0800)
  d += le16(0); d += le16(0); d += le16(0)
  d += le32(UInt64(crc)); d += le32(zip64 ? zip32Max : size); d += le32(zip64 ? zip32Max : size)
  d += le16(name.count); d += le16(zip64 ? 28 : 0); d += le16(0)
  d += le16(0); d += le16(0); d += le32(0); d += le32(zip64 ? zip32Max : offset); d += name
  if zip64 { d += le16(0x0001); d += le16(24); d += le64(size); d += le64(size); d += le64(offset) }
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

// MARK: Backup folder (2026-11-02, automatic backup)
//
// One folder the person picks once (iCloud Drive recommended). Access survives launches
// through a bookmark; every read and write is coordinated, so iCloud downloads a file
// before it is read and never sees a half-written one. Copies into the folder use
// FileManager.copyItem, which clones on APFS where the system allows it.

private let folderGone = "SONGNOOK_FOLDER_GONE"
private let folderNoAccess = "SONGNOOK_FOLDER_NO_ACCESS"

private func folderURL(_ uri: String) throws -> URL {
  guard let url = URL(string: uri), url.isFileURL else { throw IOError(message: "Expected a folder URL: \(uri)") }
  return url
}

private func coordinated<T>(
  reading url: URL? = nil,
  writing writeURL: URL? = nil,
  writeOptions: NSFileCoordinator.WritingOptions = [],
  _ body: (URL) throws -> T
) throws -> T {
  var coordinationError: NSError?
  var outcome: Result<T, Error>?
  let coordinator = NSFileCoordinator(filePresenter: nil)
  if let url = url {
    coordinator.coordinate(readingItemAt: url, options: [], error: &coordinationError) { actual in
      outcome = Result { try body(actual) }
    }
  } else if let writeURL = writeURL {
    coordinator.coordinate(writingItemAt: writeURL, options: writeOptions, error: &coordinationError) { actual in
      outcome = Result { try body(actual) }
    }
  }
  if let error = coordinationError { throw error }
  guard let result = outcome else { throw IOError(message: "The backup folder did not answer.") }
  return try result.get()
}

private func fileSize(_ url: URL) -> UInt64? {
  guard let attributes = try? FileManager.default.attributesOfItem(atPath: url.path),
    let size = attributes[.size] as? NSNumber
  else { return nil }
  return size.uint64Value
}

/** A not-yet-downloaded iCloud file can show as ".<name>.icloud" (before FPFS). */
private func placeholderURL(_ dir: URL, _ name: String) -> URL {
  dir.appendingPathComponent(".\(name).icloud")
}

public class SongNookFileIOModule: Module {
  private let lock = NSLock()
  private var cancellations: [String: Bool] = [:]
  private var writers: [String: ZipWriter] = [:]
  /** Folders whose security scope this process holds open (one start per folder). */
  private var accessedFolders: [String: URL] = [:]

  /** Stream `length` bytes at `offset` of `source` into a new file, CRC-32 and (optionally)
   *  SHA-256 of the base64 form computed from the same bytes. */
  private func streamCopy(
    from source: URL, offset: UInt64, length: UInt64, to destination: URL, computeSha256: Bool, operationId: String
  ) throws -> [String: Any] {
    do {
      try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
      if !FileManager.default.fileExists(atPath: destination.path) {
        guard FileManager.default.createFile(atPath: destination.path, contents: nil) else {
          throw IOError(message: "Could not create the restored file.")
        }
      }
      let input = try FileHandle(forReadingFrom: source)
      defer { try? input.close() }
      let output = try FileHandle(forWritingTo: destination)
      defer { try? output.close() }
      try output.truncate(atOffset: 0)
      try input.seek(toOffset: offset)
      let crc = Crc32()
      let sha = computeSha256 ? Base64Sha256() : nil
      var remaining = length
      var written: UInt64 = 0
      var sinceProgress: UInt64 = 0
      while remaining > 0 {
        if isCancelled(operationId) { throw IOError(message: "SONGNOOK_IO_CANCELLED") }
        let want = Int(min(UInt64(ioChunk), remaining))
        // The whole step in one pool (05-E11): the write and the hash allocate too.
        try autoreleasepool {
          let chunk = try input.read(upToCount: want) ?? Data()
          if chunk.isEmpty { throw IOError(message: "The file ended early.") }
          try output.write(contentsOf: chunk)
          crc.update(chunk)
          sha?.update(chunk)
          remaining -= UInt64(chunk.count)
          written += UInt64(chunk.count)
          sinceProgress += UInt64(chunk.count)
        }
        if sinceProgress >= progressEvery {
          progress(operationId, written, length)
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

  /** Copy into the folder under a temporary name, then swap it in: a reader never sees
   *  a half-written file under the real name. */
  private func folderPlace(_ dir: URL, _ name: String, write: (URL) throws -> Void) throws -> [String: Any] {
    let target = dir.appendingPathComponent(name)
    let temp = dir.appendingPathComponent(".partial-\(name)")
    let size: UInt64 = try coordinated(writing: target, writeOptions: .forReplacing) { actual in
      try? FileManager.default.removeItem(at: temp)
      try write(temp)
      guard let size = fileSize(temp) else { throw IOError(message: "The backup folder lost a file.") }
      if FileManager.default.fileExists(atPath: actual.path) {
        _ = try FileManager.default.replaceItemAt(actual, withItemAt: temp)
      } else {
        try FileManager.default.moveItem(at: temp, to: actual)
      }
      return size
    }
    return ["uri": target.absoluteString, "sizeBytes": Double(size)]
  }

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

    // SongNook Send, sealed end to end (SongNookSeal.swift). Files a record at a
    // time; the envelope (title, sender, note, file names) as base64.
    AsyncFunction("sealFileAsync") { (sourceUri: String, destinationUri: String, keyText: String) -> [String: Any] in
      let size = try SongNookSeal.sealFile(
        from: try localURL(sourceUri), to: try localURL(destinationUri), key: try SongNookSeal.key(keyText))
      return ["sizeBytes": Double(size)]
    }

    AsyncFunction("openSealedFileAsync") { (sourceUri: String, destinationUri: String, keyText: String) -> [String: Any] in
      let size = try SongNookSeal.openFile(
        from: try localURL(sourceUri), to: try localURL(destinationUri), key: try SongNookSeal.key(keyText))
      return ["sizeBytes": Double(size)]
    }

    AsyncFunction("sealBase64Async") { (base64: String, keyText: String) -> String in
      guard let plain = Data(base64Encoded: base64) else { throw IOError(message: "Expected base64.") }
      return try SongNookSeal.seal(plain, key: try SongNookSeal.key(keyText)).base64EncodedString()
    }

    AsyncFunction("openSealedBase64Async") { (base64: String, keyText: String) -> String in
      guard let sealed = Data(base64Encoded: base64) else { throw IOError(message: "Expected base64.") }
      return try SongNookSeal.open(sealed, key: try SongNookSeal.key(keyText)).base64EncodedString()
    }

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
          // The whole step in one pool (05-E11): the write and the hash allocate too.
          let ended = try autoreleasepool { () -> Bool in
            let chunk = try input.read(upToCount: ioChunk) ?? Data()
            if chunk.isEmpty { return true }
            try writer.handle.write(contentsOf: chunk)
            crc.update(chunk)
            sha?.update(chunk)
            written += UInt64(chunk.count)
            sinceProgress += UInt64(chunk.count)
            return false
          }
          if ended { break }
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
        let zip64 = writer.entryCount >= 0xFFFF || centralOffset >= zip32Max || centralSize >= zip32Max
        var end = Data()
        if zip64 {
          let zip64EndOffset = centralOffset + centralSize
          end += le32(0x0606_4B50); end += le64(44); end += le16(45); end += le16(45); end += le32(0); end += le32(0)
          end += le64(UInt64(writer.entryCount)); end += le64(UInt64(writer.entryCount))
          end += le64(centralSize); end += le64(centralOffset)
          end += le32(0x0706_4B50); end += le32(0); end += le64(zip64EndOffset); end += le32(1)
        }
        let count16 = zip64 ? 0xFFFF : writer.entryCount
        end += le32(0x0605_4B50); end += le16(0); end += le16(0)
        end += le16(count16); end += le16(count16)
        end += le32(zip64 ? zip32Max : centralSize); end += le32(zip64 ? zip32Max : centralOffset); end += le16(0)
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
          // The whole step in one pool (05-E11): the write and the hash allocate too.
          try autoreleasepool {
            let chunk = try input.read(upToCount: want) ?? Data()
            if chunk.isEmpty { throw IOError(message: "The archive ended early.") }
            try output.write(contentsOf: chunk)
            crc.update(chunk)
            sha?.update(chunk)
            remaining -= UInt64(chunk.count)
            written += UInt64(chunk.count)
            sinceProgress += UInt64(chunk.count)
          }
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

    // Zip64 past 4 GB (2026-11-02). Builds without it report nothing and the JS writer
    // makes a > 4 GB archive instead.
    Function("zipSupportsZip64") { () -> Bool in true }

    // ── Backup folder (2026-11-02). Missing on builds made before automatic backup. ──

    AsyncFunction("folderBookmarkAsync") { (uri: String) -> String in
      let url = try folderURL(uri)
      let started = url.startAccessingSecurityScopedResource()
      defer { if started { url.stopAccessingSecurityScopedResource() } }
      return try url.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil)
        .base64EncodedString()
    }

    AsyncFunction("folderResolveAsync") { (handle: String) -> [String: Any] in
      guard let data = Data(base64Encoded: handle) else { throw IOError(message: folderGone) }
      var stale = false
      let url: URL
      do {
        url = try URL(resolvingBookmarkData: data, options: [], relativeTo: nil, bookmarkDataIsStale: &stale)
      } catch {
        throw IOError(message: folderGone)
      }
      self.lock.lock()
      let alreadyOpen = self.accessedFolders[url.absoluteString] != nil
      self.lock.unlock()
      if !alreadyOpen {
        guard url.startAccessingSecurityScopedResource() else { throw IOError(message: folderNoAccess) }
        self.lock.lock(); self.accessedFolders[url.absoluteString] = url; self.lock.unlock()
      }
      var isDirectory: ObjCBool = false
      guard FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory), isDirectory.boolValue else {
        throw IOError(message: folderGone)
      }
      var refreshed = handle
      if stale, let fresh = try? url.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil) {
        refreshed = fresh.base64EncodedString()
      }
      return ["uri": url.absoluteString, "name": url.lastPathComponent, "handle": refreshed]
    }

    AsyncFunction("folderChildAsync") { (dirUri: String, name: String, createDirectory: Bool) -> String? in
      let dir = try folderURL(dirUri)
      let child = dir.appendingPathComponent(name, isDirectory: createDirectory)
      if FileManager.default.fileExists(atPath: child.path)
        || FileManager.default.fileExists(atPath: placeholderURL(dir, name).path) {
        return child.absoluteString
      }
      guard createDirectory else { return nil }
      try coordinated(writing: child) { actual in
        try FileManager.default.createDirectory(at: actual, withIntermediateDirectories: true)
      }
      return child.absoluteString
    }

    AsyncFunction("folderListAsync") { (dirUri: String) -> [[String: Any]] in
      // Listed directly, not coordinated: coordinating a read of the folder could make
      // iCloud download every recording in it.
      let dir = try folderURL(dirUri)
      let items = try FileManager.default.contentsOfDirectory(
        at: dir, includingPropertiesForKeys: [.fileSizeKey, .isDirectoryKey], options: [])
      var out: [[String: Any]] = []
      for item in items {
        var name = item.lastPathComponent
        var size: Double = -1
        var isDirectory = false
        if name.hasPrefix("."), name.hasSuffix(".icloud") {
          name = String(name.dropFirst().dropLast(".icloud".count))
        } else if name.hasPrefix(".") {
          if name.hasPrefix(".partial-") {
            out.append(["name": name, "uri": item.absoluteString, "size": -1, "isDirectory": false])
          }
          continue
        } else {
          let values = try? item.resourceValues(forKeys: [.fileSizeKey, .isDirectoryKey])
          isDirectory = values?.isDirectory ?? false
          if let fileSize = values?.fileSize { size = Double(fileSize) }
        }
        out.append([
          "name": name, "uri": dir.appendingPathComponent(name).absoluteString, "size": size, "isDirectory": isDirectory,
        ])
      }
      return out
    }

    AsyncFunction("folderWriteFileAsync") { (dirUri: String, name: String, sourceUri: String) -> [String: Any] in
      let source = try localURL(sourceUri)
      guard let expected = fileSize(source) else { throw IOError(message: "Missing file: \(name)") }
      let placed = try self.folderPlace(try folderURL(dirUri), name) { temp in
        try FileManager.default.copyItem(at: source, to: temp)
      }
      if let size = placed["sizeBytes"] as? Double, UInt64(size) != expected {
        throw IOError(message: "The backup folder received an incomplete file.")
      }
      return placed
    }

    AsyncFunction("folderWriteTextAsync") { (dirUri: String, name: String, text: String) -> [String: Any] in
      let data = Data(text.utf8)
      let placed = try self.folderPlace(try folderURL(dirUri), name) { temp in
        try data.write(to: temp, options: .atomic)
      }
      if let size = placed["sizeBytes"] as? Double, Int(size) != data.count {
        throw IOError(message: "The backup folder received an incomplete file.")
      }
      return placed
    }

    AsyncFunction("folderReadTextAsync") { (fileUri: String) -> String in
      try coordinated(reading: try folderURL(fileUri)) { actual in
        try String(contentsOf: actual, encoding: .utf8)
      }
    }

    AsyncFunction("folderCopyOutAsync") {
      (fileUri: String, destinationUri: String, computeSha256: Bool, operationId: String) -> [String: Any] in
      self.startOperation(operationId)
      defer { self.endOperation(operationId) }
      let destination = try localURL(destinationUri)
      return try coordinated(reading: try folderURL(fileUri)) { actual in
        guard let size = fileSize(actual) else { throw IOError(message: "Missing file in the backup folder.") }
        return try self.streamCopy(
          from: actual, offset: 0, length: size, to: destination, computeSha256: computeSha256, operationId: operationId)
      }
    }

    AsyncFunction("folderDeleteAsync") { (fileUri: String) in
      let url = try folderURL(fileUri)
      try coordinated(writing: url, writeOptions: .forDeleting) { actual in
        if FileManager.default.fileExists(atPath: actual.path) { try FileManager.default.removeItem(at: actual) }
      }
    }

    // Keeps a temporary file out of the iPhone's iCloud device backup (G12: a stale
    // multi-GB backup-tmp archive used to ride along).
    AsyncFunction("setExcludedFromBackupAsync") { (uri: String) in
      var url = try localURL(uri)
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      try url.setResourceValues(values)
    }

    Function("cancelCopy") { (operationId: String) in
      self.lock.lock()
      if self.cancellations[operationId] != nil { self.cancellations[operationId] = true }
      self.lock.unlock()
    }
  }
}
