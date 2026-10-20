package expo.modules.songnookfileio

import android.net.Uri
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.util.Base64
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.io.RandomAccessFile
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import java.util.zip.CRC32

/**
 * Backups and archives in one native pass (2026-10-20): each file is read once, written
 * straight into a STORED zip, and its CRC-32 (the zip needs it) and SHA-256 of its base64
 * form (the v1 backup manifest digest) are computed from the same bytes. The JS path read
 * every file four times through the bridge (~1.7 MB/s). The archive layout matches
 * src/services/zipArchive.ts byte for byte: version 20, UTF-8 flag, no timestamps.
 */
private class ZipWriter(val file: File) {
  val raf = RandomAccessFile(file, "rw")
  val central = ArrayList<ByteArray>()
  var entryCount = 0
}

/** Streaming SHA-256 over the base64 text of a byte stream (no padding until the end). */
private class Base64Sha256 {
  private val digest = MessageDigest.getInstance("SHA-256")
  private val carry = ByteArray(2)
  private var carryLength = 0

  fun update(bytes: ByteArray, length: Int) {
    var buffer = bytes
    var available = length
    if (carryLength > 0) {
      val joined = ByteArray(carryLength + length)
      System.arraycopy(carry, 0, joined, 0, carryLength)
      System.arraycopy(bytes, 0, joined, carryLength, length)
      buffer = joined
      available = joined.size
      carryLength = 0
    }
    val whole = available - available % 3
    if (whole > 0) {
      digest.update(Base64.encode(buffer, 0, whole, Base64.NO_WRAP))
    }
    val rest = available - whole
    if (rest > 0) System.arraycopy(buffer, whole, carry, 0, rest)
    carryLength = rest
  }

  fun hex(): String {
    if (carryLength > 0) digest.update(Base64.encode(carry, 0, carryLength, Base64.NO_WRAP))
    return digest.digest().joinToString("") { "%02x".format(it) }
  }
}

private const val ZIP32_MAX = 0xFFFFFFFFL
private const val IO_CHUNK = 1024 * 1024
private const val PROGRESS_EVERY = 4L * 1024 * 1024

private fun le16(value: Int) = byteArrayOf((value and 0xFF).toByte(), ((value shr 8) and 0xFF).toByte())
private fun le32(value: Long) = byteArrayOf(
  (value and 0xFF).toByte(), ((value shr 8) and 0xFF).toByte(),
  ((value shr 16) and 0xFF).toByte(), ((value shr 24) and 0xFF).toByte()
)

private fun localHeader(name: ByteArray, size: Long, crc: Long): ByteArray =
  le32(0x04034b50) + le16(20) + le16(0x0800) + le16(0) + le16(0) + le16(0) +
    le32(crc) + le32(size) + le32(size) + le16(name.size) + le16(0) + name

private fun centralHeader(name: ByteArray, size: Long, crc: Long, offset: Long): ByteArray =
  le32(0x02014b50) + le16(20) + le16(20) + le16(0x0800) + le16(0) + le16(0) + le16(0) +
    le32(crc) + le32(size) + le32(size) + le16(name.size) + le16(0) + le16(0) + le16(0) +
    le16(0) + le32(0) + le32(offset) + name

private fun localPath(uri: String): String {
  val parsed = Uri.parse(uri)
  if (parsed.scheme != null && parsed.scheme != "file") throw IOException("Expected a local file: $uri")
  return parsed.path ?: throw IOException("Invalid file path: $uri")
}

class SongNookFileIOModule : Module() {
  private val cancellations = ConcurrentHashMap<String, AtomicBoolean>()
  private val writers = ConcurrentHashMap<String, ZipWriter>()

  override fun definition() = ModuleDefinition {
    Name("SongNookFileIO")

    Events("onCopyProgress")

    AsyncFunction("copyFileToContentUriAsync") {
        operationId: String,
        sourceUri: String,
        targetUri: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val source = Uri.parse(sourceUri)
      val target = Uri.parse(targetUri)
      if (source.scheme != "file") {
        throw IOException("Backup source must be a local file.")
      }
      if (target.scheme != "content") {
        throw IOException("Backup destination must be a document-provider URI.")
      }

      val sourcePath = source.path ?: throw IOException("Backup source path is invalid.")
      val sourceFile = File(sourcePath)
      if (!sourceFile.isFile) {
        throw IOException("Backup source file could not be found.")
      }
      val cancelled = AtomicBoolean(false)
      if (cancellations.putIfAbsent(operationId, cancelled) != null) {
        throw IOException("A copy operation with this ID is already running.")
      }

      var copiedBytes = 0L
      val totalBytes = sourceFile.length()
      val buffer = ByteArray(256 * 1024)
      try {
        FileInputStream(sourceFile).use { input ->
          val output = context.contentResolver.openOutputStream(target, "wt")
            ?: throw IOException("The selected folder provider could not open the backup file.")
          output.use {
            var bytesSinceProgress = 0L
            while (true) {
              if (cancelled.get()) {
                throw IOException("BACKUP_COPY_CANCELLED")
              }
              val count = input.read(buffer)
              if (count < 0) break
              output.write(buffer, 0, count)
              copiedBytes += count
              bytesSinceProgress += count
              if (bytesSinceProgress >= 1024 * 1024) {
                sendEvent(
                  "onCopyProgress",
                  mapOf(
                    "operationId" to operationId,
                    "completedBytes" to copiedBytes.toDouble(),
                    "totalBytes" to totalBytes.toDouble()
                  )
                )
                bytesSinceProgress = 0
              }
            }
            output.flush()
          }
        }
        val providerSize = runCatching {
          context.contentResolver.openAssetFileDescriptor(target, "r")?.use {
            it.length
          } ?: -1L
        }.getOrDefault(-1L)
        if (providerSize >= 0 && providerSize != copiedBytes) {
          throw IOException("The folder provider saved an incomplete backup file.")
        }
        sendEvent(
          "onCopyProgress",
          mapOf(
            "operationId" to operationId,
            "completedBytes" to copiedBytes.toDouble(),
            "totalBytes" to totalBytes.toDouble()
          )
        )
        mapOf(
          "copiedBytes" to copiedBytes.toDouble(),
          "totalBytes" to totalBytes.toDouble()
        )
      } finally {
        cancellations.remove(operationId)
      }
    }

    AsyncFunction("zipCreateAsync") { writerId: String, destinationUri: String ->
      if (writers.containsKey(writerId)) throw IOException("A zip writer with this ID is already open.")
      val file = File(localPath(destinationUri))
      file.parentFile?.mkdirs()
      if (file.exists()) file.delete()
      writers[writerId] = ZipWriter(file)
    }

    AsyncFunction("zipAddFileAsync") {
        writerId: String,
        archiveName: String,
        sourceUri: String,
        expectedSize: Double,
        computeSha256: Boolean,
        operationId: String ->
      val writer = writers[writerId] ?: throw IOException("Zip writer is not open.")
      val source = File(localPath(sourceUri))
      if (!source.isFile) throw IOException("Missing file: $archiveName")
      val cancelled = AtomicBoolean(false)
      cancellations[operationId] = cancelled
      val name = archiveName.toByteArray(Charsets.UTF_8)
      val entryStart = writer.raf.filePointer
      try {
        val totalBytes = source.length()
        if (expectedSize >= 0 && expectedSize.toLong() != totalBytes) {
          throw IOException("File changed while it was being backed up.")
        }
        if (totalBytes > ZIP32_MAX) throw IOException("File too large for the archive: $archiveName")
        writer.raf.write(localHeader(name, totalBytes, 0))
        val crc = CRC32()
        val sha = if (computeSha256) Base64Sha256() else null
        val buffer = ByteArray(IO_CHUNK)
        var written = 0L
        var sinceProgress = 0L
        FileInputStream(source).use { input ->
          while (true) {
            if (cancelled.get()) throw IOException("SONGNOOK_IO_CANCELLED")
            val count = input.read(buffer)
            if (count < 0) break
            writer.raf.write(buffer, 0, count)
            crc.update(buffer, 0, count)
            sha?.update(buffer, count)
            written += count
            sinceProgress += count
            if (sinceProgress >= PROGRESS_EVERY) {
              sendEvent("onCopyProgress", mapOf("operationId" to operationId, "completedBytes" to written.toDouble(), "totalBytes" to totalBytes.toDouble()))
              sinceProgress = 0
            }
          }
        }
        if (written != totalBytes) throw IOException("File changed while it was being backed up.")
        val end = writer.raf.filePointer
        writer.raf.seek(entryStart + 14)
        writer.raf.write(le32(crc.value))
        writer.raf.seek(end)
        writer.central.add(centralHeader(name, written, crc.value, entryStart))
        writer.entryCount += 1
        mapOf("crc32" to crc.value.toDouble(), "sizeBytes" to written.toDouble(), "sha256" to sha?.hex())
      } catch (error: Throwable) {
        // Leave the archive exactly as it was before this entry: a missing or changed
        // file is recorded by the caller and the backup goes on without it.
        runCatching {
          writer.raf.setLength(entryStart)
          writer.raf.seek(entryStart)
        }
        throw error
      } finally {
        cancellations.remove(operationId)
      }
    }

    AsyncFunction("zipAddDataAsync") { writerId: String, archiveName: String, base64Data: String ->
      addData(writerId, archiveName, Base64.decode(base64Data, Base64.DEFAULT))
    }

    // Text entries (the library snapshot, the manifest) go in as UTF-8 without a base64 trip.
    AsyncFunction("zipAddTextAsync") { writerId: String, archiveName: String, text: String ->
      addData(writerId, archiveName, text.toByteArray(Charsets.UTF_8))
    }

    AsyncFunction("zipFinishAsync") { writerId: String ->
      val writer = writers.remove(writerId) ?: throw IOException("Zip writer is not open.")
      try {
        val centralOffset = writer.raf.filePointer
        var centralSize = 0L
        for (header in writer.central) {
          writer.raf.write(header)
          centralSize += header.size
        }
        if (writer.entryCount >= 0xFFFF || centralOffset + centralSize + 22 > ZIP32_MAX) {
          throw IOException("Archive exceeds the 4 GB limit of the supported ZIP format.")
        }
        writer.raf.write(
          le32(0x06054b50) + le16(0) + le16(0) + le16(writer.entryCount) + le16(writer.entryCount) +
            le32(centralSize) + le32(centralOffset) + le16(0)
        )
        writer.raf.fd.sync()
        mapOf("sizeBytes" to writer.raf.length().toDouble())
      } catch (error: Throwable) {
        runCatching { writer.raf.close() }
        writer.file.delete()
        throw error
      } finally {
        runCatching { writer.raf.close() }
      }
    }

    AsyncFunction("zipAbortAsync") { writerId: String ->
      val writer = writers.remove(writerId) ?: return@AsyncFunction
      runCatching { writer.raf.close() }
      writer.file.delete()
    }

    AsyncFunction("extractRangeAsync") {
        sourceUri: String,
        offset: Double,
        length: Double,
        destinationUri: String,
        computeSha256: Boolean,
        operationId: String ->
      val cancelled = AtomicBoolean(false)
      cancellations[operationId] = cancelled
      val destination = File(localPath(destinationUri))
      val total = length.toLong()
      try {
        destination.parentFile?.mkdirs()
        val crc = CRC32()
        val sha = if (computeSha256) Base64Sha256() else null
        val buffer = ByteArray(IO_CHUNK)
        var remaining = total
        var written = 0L
        var sinceProgress = 0L
        RandomAccessFile(File(localPath(sourceUri)), "r").use { input ->
          input.seek(offset.toLong())
          FileOutputStream(destination).use { output ->
            while (remaining > 0) {
              if (cancelled.get()) throw IOException("SONGNOOK_IO_CANCELLED")
              val count = input.read(buffer, 0, minOf(buffer.size.toLong(), remaining).toInt())
              if (count < 0) throw IOException("The archive ended early.")
              output.write(buffer, 0, count)
              crc.update(buffer, 0, count)
              sha?.update(buffer, count)
              remaining -= count
              written += count
              sinceProgress += count
              if (sinceProgress >= PROGRESS_EVERY) {
                sendEvent("onCopyProgress", mapOf("operationId" to operationId, "completedBytes" to written.toDouble(), "totalBytes" to total.toDouble()))
                sinceProgress = 0
              }
            }
            output.flush()
            output.fd.sync()
          }
        }
        mapOf("crc32" to crc.value.toDouble(), "sizeBytes" to written.toDouble(), "sha256" to sha?.hex())
      } catch (error: Throwable) {
        destination.delete()
        throw error
      } finally {
        cancellations.remove(operationId)
      }
    }

    Function("cancelCopy") { operationId: String ->
      cancellations[operationId]?.set(true)
    }

    AsyncFunction("deleteContentUriAsync") { targetUri: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val target = Uri.parse(targetUri)
      if (target.scheme == "content") {
        context.contentResolver.delete(target, null, null)
      }
    }
  }

  private fun addData(writerId: String, archiveName: String, data: ByteArray): Map<String, Double> {
    val writer = writers[writerId] ?: throw IOException("Zip writer is not open.")
    val name = archiveName.toByteArray(Charsets.UTF_8)
    val crc = CRC32().apply { update(data) }
    val entryStart = writer.raf.filePointer
    writer.raf.write(localHeader(name, data.size.toLong(), crc.value))
    writer.raf.write(data)
    writer.central.add(centralHeader(name, data.size.toLong(), crc.value, entryStart))
    writer.entryCount += 1
    return mapOf("crc32" to crc.value.toDouble(), "sizeBytes" to data.size.toDouble())
  }
}
