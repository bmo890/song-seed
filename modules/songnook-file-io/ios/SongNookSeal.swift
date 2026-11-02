import CryptoKit
import Foundation
import Security

/**
 * SNS1, the sealed format of SongNook Send (docs/product-plan/send-e2e-encryption.md):
 * AES-256-GCM in the STREAM construction, 64 KiB records, the key carried only in the
 * link's #k= part. Byte for byte the same as the browser's server/songnook-send/src/
 * pages/sealJs.ts (its Node test writes the format out independently).
 *
 *   header = "SNS1" | record size, u32 BE | nonce prefix (7, random per file)
 *   nonce  = prefix | record index, u32 BE | 1 on the last record, else 0
 *   record = ciphertext | 16-byte tag, AAD = header
 */
enum SongNookSeal {
  static let record = 65536
  static let headerSize = 15
  static let tagSize = 16

  struct SealError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
  }

  /** The parcel key from its base64url text (43 characters, 32 bytes). */
  static func key(_ text: String) throws -> SymmetricKey {
    var t = text.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
    while t.count % 4 != 0 { t += "=" }
    guard let raw = Data(base64Encoded: t), raw.count == 32 else {
      throw SealError(message: "A parcel key is 32 bytes.")
    }
    return SymmetricKey(data: raw)
  }

  private static func header(prefix: Data, recordSize: Int) -> Data {
    var h = Data("SNS1".utf8)
    var size = UInt32(recordSize).bigEndian
    h.append(Data(bytes: &size, count: 4))
    h.append(prefix)
    return h
  }

  private static func nonce(prefix: Data, index: Int, last: Bool) throws -> AES.GCM.Nonce {
    var n = prefix
    var i = UInt32(index).bigEndian
    n.append(Data(bytes: &i, count: 4))
    n.append(last ? 1 : 0)
    return try AES.GCM.Nonce(data: n)
  }

  private static func randomPrefix() throws -> Data {
    var bytes = [UInt8](repeating: 0, count: 7)
    guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
      throw SealError(message: "No randomness for a nonce.")
    }
    return Data(bytes)
  }

  private static func sealRecord(_ plain: Data, key: SymmetricKey, prefix: Data, index: Int, last: Bool, header: Data) throws -> Data {
    let box = try AES.GCM.seal(plain, using: key, nonce: nonce(prefix: prefix, index: index, last: last), authenticating: header)
    var out = Data(box.ciphertext)
    out.append(box.tag)
    return out
  }

  private static func openRecord(_ sealed: Data, key: SymmetricKey, prefix: Data, index: Int, last: Bool, header: Data) throws -> Data {
    guard sealed.count >= tagSize else { throw SealError(message: "Sealed file is cut short.") }
    let box = try AES.GCM.SealedBox(
      nonce: nonce(prefix: prefix, index: index, last: last),
      ciphertext: sealed.prefix(sealed.count - tagSize),
      tag: sealed.suffix(tagSize)
    )
    return try AES.GCM.open(box, using: key, authenticating: header)
  }

  private static func recordCount(_ plainSize: Int) -> Int { max(1, (plainSize + record - 1) / record) }

  /** Reads and checks a header: its record size and nonce prefix. */
  private static func parseHeader(_ h: Data) throws -> (recordSize: Int, prefix: Data) {
    let bytes = [UInt8](h)
    guard bytes.count == headerSize, bytes[0] == 0x53, bytes[1] == 0x4E, bytes[2] == 0x53, bytes[3] == 0x31 else {
      throw SealError(message: "Not a sealed file.")
    }
    let size = Int(bytes[4]) << 24 | Int(bytes[5]) << 16 | Int(bytes[6]) << 8 | Int(bytes[7])
    guard size >= 1, size <= 16 * 1024 * 1024 else { throw SealError(message: "Sealed file has a bad record size.") }
    return (size, Data(bytes[8..<15]))
  }

  /** Records and the last one's sealed length, for a sealed body of `body` bytes. */
  private static func layout(body: Int, recordSize: Int) throws -> (count: Int, lastLength: Int) {
    let step = recordSize + tagSize
    let count = max(1, (body + step - 1) / step)
    let lastLength = body - (count - 1) * step
    guard lastLength >= tagSize else { throw SealError(message: "Sealed file is cut short.") }
    return (count, lastLength)
  }

  // ── Small things in memory: the parcel's envelope ─────────────────────────

  static func seal(_ plain: Data, key: SymmetricKey) throws -> Data {
    let prefix = try randomPrefix()
    let h = header(prefix: prefix, recordSize: record)
    var out = h
    let count = recordCount(plain.count)
    for i in 0..<count {
      let start = i * record
      let end = min(plain.count, start + record)
      out.append(try sealRecord(plain.subdata(in: start..<end), key: key, prefix: prefix, index: i, last: i == count - 1, header: h))
    }
    return out
  }

  static func open(_ sealed: Data, key: SymmetricKey) throws -> Data {
    guard sealed.count >= headerSize + tagSize else { throw SealError(message: "Sealed file is too short.") }
    let h = sealed.subdata(in: 0..<headerSize)
    let (recordSize, prefix) = try parseHeader(h)
    let (count, lastLength) = try layout(body: sealed.count - headerSize, recordSize: recordSize)
    let step = recordSize + tagSize
    var out = Data()
    for i in 0..<count {
      let start = headerSize + i * step
      let length = i == count - 1 ? lastLength : step
      out.append(try openRecord(sealed.subdata(in: start..<(start + length)), key: key, prefix: prefix, index: i, last: i == count - 1, header: h))
    }
    return out
  }

  // ── Files, a record at a time ─────────────────────────────────────────────

  static func sealFile(from source: URL, to destination: URL, key: SymmetricKey) throws -> UInt64 {
    let plainSize = (try FileManager.default.attributesOfItem(atPath: source.path)[.size] as? NSNumber)?.intValue ?? 0
    let input = try FileHandle(forReadingFrom: source)
    defer { try? input.close() }
    FileManager.default.createFile(atPath: destination.path, contents: nil)
    let output = try FileHandle(forWritingTo: destination)
    defer { try? output.close() }
    try output.truncate(atOffset: 0)

    let prefix = try randomPrefix()
    let h = header(prefix: prefix, recordSize: record)
    try output.write(contentsOf: h)
    var written = UInt64(h.count)
    let count = recordCount(plainSize)
    for i in 0..<count {
      // One pool per record (audit 05-E11): the read, the sealed copy and the write are
      // autoreleased, and without a pool they pile up until the whole file is done, so
      // sealing a long take for Send could hold its size in memory and get killed.
      try autoreleasepool {
        let want = min(record, plainSize - i * record)
        let plain = want > 0 ? (try input.read(upToCount: want) ?? Data()) : Data()
        guard plain.count == want else { throw SealError(message: "The file changed while it was being sealed.") }
        let sealed = try sealRecord(plain, key: key, prefix: prefix, index: i, last: i == count - 1, header: h)
        try output.write(contentsOf: sealed)
        written += UInt64(sealed.count)
      }
    }
    return written
  }

  static func openFile(from source: URL, to destination: URL, key: SymmetricKey) throws -> UInt64 {
    let sealedSize = (try FileManager.default.attributesOfItem(atPath: source.path)[.size] as? NSNumber)?.intValue ?? 0
    guard sealedSize >= headerSize + tagSize else { throw SealError(message: "Sealed file is too short.") }
    let input = try FileHandle(forReadingFrom: source)
    defer { try? input.close() }
    let h = try input.read(upToCount: headerSize) ?? Data()
    let (recordSize, prefix) = try parseHeader(h)
    let (count, lastLength) = try layout(body: sealedSize - headerSize, recordSize: recordSize)

    FileManager.default.createFile(atPath: destination.path, contents: nil)
    let output = try FileHandle(forWritingTo: destination)
    var finished = false
    defer {
      try? output.close()
      // A parcel that fails to open leaves nothing half-written behind.
      if !finished { try? FileManager.default.removeItem(at: destination) }
    }
    try output.truncate(atOffset: 0)
    var written: UInt64 = 0
    for i in 0..<count {
      // One pool per record, as in sealFile (05-E11).
      try autoreleasepool {
        let want = i == count - 1 ? lastLength : recordSize + tagSize
        let sealed = try input.read(upToCount: want) ?? Data()
        guard sealed.count == want else { throw SealError(message: "Sealed file is cut short.") }
        let plain = try openRecord(sealed, key: key, prefix: prefix, index: i, last: i == count - 1, header: h)
        try output.write(contentsOf: plain)
        written += UInt64(plain.count)
      }
    }
    finished = true
    return written
  }
}
