package expo.modules.songnookfileio

import android.util.Base64
import java.io.DataInputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.nio.ByteBuffer
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * SNS1, the sealed format of SongNook Send (docs/product-plan/send-e2e-encryption.md):
 * AES-256-GCM in the STREAM construction, 64 KiB records, the key carried only in the
 * link's #k= part. Byte for byte the same as the browser's server/songnook-send/src/
 * pages/sealJs.ts and the iOS SongNookSeal.swift.
 *
 *   header = "SNS1" | record size, u32 BE | nonce prefix (7, random per file)
 *   nonce  = prefix | record index, u32 BE | 1 on the last record, else 0
 *   record = ciphertext | 16-byte tag, AAD = header
 */
internal object SongNookSeal {
  const val RECORD = 65536
  const val HEADER = 15
  const val TAG = 16
  private val random = SecureRandom()

  /** The parcel key from its base64url text (43 characters, 32 bytes). */
  fun key(text: String): SecretKeySpec {
    val raw = try {
      Base64.decode(text, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
    } catch (e: IllegalArgumentException) {
      throw IOException("A parcel key is 32 bytes.")
    }
    if (raw.size != 32) throw IOException("A parcel key is 32 bytes.")
    return SecretKeySpec(raw, "AES")
  }

  private fun header(prefix: ByteArray, recordSize: Int): ByteArray =
    byteArrayOf(0x53, 0x4E, 0x53, 0x31) + ByteBuffer.allocate(4).putInt(recordSize).array() + prefix

  private fun nonce(prefix: ByteArray, index: Int, last: Boolean): ByteArray =
    prefix + ByteBuffer.allocate(4).putInt(index).array() + byteArrayOf(if (last) 1 else 0)

  private fun randomPrefix(): ByteArray = ByteArray(7).also { random.nextBytes(it) }

  private fun cipher(mode: Int, key: SecretKeySpec, prefix: ByteArray, index: Int, last: Boolean, header: ByteArray): Cipher =
    Cipher.getInstance("AES/GCM/NoPadding").apply {
      init(mode, key, GCMParameterSpec(TAG * 8, nonce(prefix, index, last)))
      updateAAD(header)
    }

  private fun recordCount(plainSize: Long): Int = maxOf(1L, (plainSize + RECORD - 1) / RECORD).toInt()

  private class Header(val bytes: ByteArray, val recordSize: Int, val prefix: ByteArray)

  private fun parseHeader(h: ByteArray): Header {
    if (h.size != HEADER || h[0] != 0x53.toByte() || h[1] != 0x4E.toByte() || h[2] != 0x53.toByte() || h[3] != 0x31.toByte()) {
      throw IOException("Not a sealed file.")
    }
    val size = ByteBuffer.wrap(h, 4, 4).int
    if (size < 1 || size > 16 * 1024 * 1024) throw IOException("Sealed file has a bad record size.")
    return Header(h, size, h.copyOfRange(8, 15))
  }

  /** Records and the last one's sealed length, for a sealed body of `body` bytes. */
  private fun layout(body: Long, recordSize: Int): Pair<Int, Int> {
    val step = (recordSize + TAG).toLong()
    val count = maxOf(1L, (body + step - 1) / step)
    val lastLength = body - (count - 1) * step
    if (lastLength < TAG) throw IOException("Sealed file is cut short.")
    return Pair(count.toInt(), lastLength.toInt())
  }

  // ── Small things in memory: the parcel's envelope ───────────────────────────

  fun seal(plain: ByteArray, key: SecretKeySpec): ByteArray {
    val prefix = randomPrefix()
    val h = header(prefix, RECORD)
    var out = h
    val count = recordCount(plain.size.toLong())
    for (i in 0 until count) {
      val start = i * RECORD
      val length = minOf(RECORD, plain.size - start)
      out += cipher(Cipher.ENCRYPT_MODE, key, prefix, i, i == count - 1, h).doFinal(plain, start, length)
    }
    return out
  }

  fun open(sealed: ByteArray, key: SecretKeySpec): ByteArray {
    if (sealed.size < HEADER + TAG) throw IOException("Sealed file is too short.")
    val header = parseHeader(sealed.copyOfRange(0, HEADER))
    val (count, lastLength) = layout((sealed.size - HEADER).toLong(), header.recordSize)
    val step = header.recordSize + TAG
    var out = ByteArray(0)
    for (i in 0 until count) {
      val start = HEADER + i * step
      val length = if (i == count - 1) lastLength else step
      out += cipher(Cipher.DECRYPT_MODE, key, header.prefix, i, i == count - 1, header.bytes).doFinal(sealed, start, length)
    }
    return out
  }

  // ── Files, a record at a time ───────────────────────────────────────────────

  fun sealFile(source: File, destination: File, key: SecretKeySpec): Long {
    val plainSize = source.length()
    val prefix = randomPrefix()
    val h = header(prefix, RECORD)
    var written = 0L
    DataInputStream(FileInputStream(source).buffered()).use { input ->
      FileOutputStream(destination).buffered().use { output ->
        output.write(h)
        written += h.size
        val count = recordCount(plainSize)
        val buffer = ByteArray(RECORD)
        for (i in 0 until count) {
          val want = minOf(RECORD.toLong(), plainSize - i.toLong() * RECORD).toInt()
          if (want > 0) input.readFully(buffer, 0, want)
          val sealed = cipher(Cipher.ENCRYPT_MODE, key, prefix, i, i == count - 1, h).doFinal(buffer, 0, want)
          output.write(sealed)
          written += sealed.size
        }
      }
    }
    return written
  }

  fun openFile(source: File, destination: File, key: SecretKeySpec): Long {
    val sealedSize = source.length()
    if (sealedSize < HEADER + TAG) throw IOException("Sealed file is too short.")
    var written = 0L
    var finished = false
    try {
      DataInputStream(FileInputStream(source).buffered()).use { input ->
        val h = ByteArray(HEADER)
        input.readFully(h)
        val header = parseHeader(h)
        val (count, lastLength) = layout(sealedSize - HEADER, header.recordSize)
        val buffer = ByteArray(header.recordSize + TAG)
        FileOutputStream(destination).buffered().use { output ->
          for (i in 0 until count) {
            val want = if (i == count - 1) lastLength else header.recordSize + TAG
            input.readFully(buffer, 0, want)
            val plain = cipher(Cipher.DECRYPT_MODE, key, header.prefix, i, i == count - 1, header.bytes).doFinal(buffer, 0, want)
            output.write(plain)
            written += plain.size
          }
        }
      }
      finished = true
    } finally {
      // A parcel that fails to open leaves nothing half-written behind.
      if (!finished) destination.delete()
    }
    return written
  }
}
