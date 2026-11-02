package expo.modules.songnookfileio

import android.content.ContentResolver
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
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

private fun le64(value: Long) = ByteArray(8) { ((value ushr (it * 8)) and 0xFF).toByte() }

/*
 * Zip64 (2026-11-02, audit G1): an entry of 4 GB or more, an entry starting past 4 GB, or
 * a directory past either ZIP32 ceiling carries the standard Zip64 records, exactly as
 * src/services/zipArchive.ts writes them. Under 4 GB the bytes are unchanged.
 */
private fun localHeader(name: ByteArray, size: Long, crc: Long): ByteArray {
  val zip64 = size >= ZIP32_MAX
  val head = le32(0x04034b50) + le16(if (zip64) 45 else 20) + le16(0x0800) + le16(0) + le16(0) + le16(0) +
    le32(crc) + le32(if (zip64) ZIP32_MAX else size) + le32(if (zip64) ZIP32_MAX else size) +
    le16(name.size) + le16(if (zip64) 20 else 0) + name
  return if (zip64) head + le16(0x0001) + le16(16) + le64(size) + le64(size) else head
}

private fun centralHeader(name: ByteArray, size: Long, crc: Long, offset: Long): ByteArray {
  val zip64 = size >= ZIP32_MAX || offset >= ZIP32_MAX
  val head = le32(0x02014b50) + le16(if (zip64) 45 else 20) + le16(if (zip64) 45 else 20) + le16(0x0800) +
    le16(0) + le16(0) + le16(0) +
    le32(crc) + le32(if (zip64) ZIP32_MAX else size) + le32(if (zip64) ZIP32_MAX else size) +
    le16(name.size) + le16(if (zip64) 28 else 0) + le16(0) + le16(0) +
    le16(0) + le32(0) + le32(if (zip64) ZIP32_MAX else offset) + name
  return if (zip64) head + le16(0x0001) + le16(24) + le64(size) + le64(size) + le64(offset) else head
}

private fun localPath(uri: String): String {
  val parsed = Uri.parse(uri)
  if (parsed.scheme != null && parsed.scheme != "file") throw IOException("Expected a local file: $uri")
  return parsed.path ?: throw IOException("Invalid file path: $uri")
}

// ── Backup folder (2026-11-02, automatic backup) ─────────────────────────────────────
// One folder picked once through the Storage Access Framework; the persisted tree grant
// survives launches. Writes land under a temporary name and are renamed into place, so a
// reader never sees a half-written file under the real name.

private const val FOLDER_GONE = "SONGNOOK_FOLDER_GONE"
private const val FOLDER_NO_ACCESS = "SONGNOOK_FOLDER_NO_ACCESS"
private const val OCTET = "application/octet-stream"

private data class FolderChild(val name: String, val uri: Uri, val size: Long, val isDirectory: Boolean)

private fun documentUriOf(treeOrDocument: Uri): Uri {
  // content://<authority>/tree/<treeId>[/document/<documentId>]
  val segments = treeOrDocument.pathSegments
  val documentId = if (segments.size >= 4 && segments[2] == "document") {
    DocumentsContract.getDocumentId(treeOrDocument)
  } else {
    DocumentsContract.getTreeDocumentId(treeOrDocument)
  }
  return DocumentsContract.buildDocumentUriUsingTree(treeOrDocument, documentId)
}

private fun listChildren(resolver: ContentResolver, dir: Uri): List<FolderChild> {
  val parentId = DocumentsContract.getDocumentId(dir)
  val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(dir, parentId)
  val out = ArrayList<FolderChild>()
  resolver.query(
    childrenUri,
    arrayOf(
      DocumentsContract.Document.COLUMN_DOCUMENT_ID,
      DocumentsContract.Document.COLUMN_DISPLAY_NAME,
      DocumentsContract.Document.COLUMN_SIZE,
      DocumentsContract.Document.COLUMN_MIME_TYPE
    ),
    null, null, null
  )?.use { cursor ->
    while (cursor.moveToNext()) {
      val id = cursor.getString(0) ?: continue
      val name = cursor.getString(1) ?: continue
      val size = if (cursor.isNull(2)) -1L else cursor.getLong(2)
      val isDirectory = cursor.getString(3) == DocumentsContract.Document.MIME_TYPE_DIR
      out.add(FolderChild(name, DocumentsContract.buildDocumentUriUsingTree(dir, id), size, isDirectory))
    }
  } ?: throw IOException(FOLDER_GONE)
  return out
}

private fun documentSize(resolver: ContentResolver, uri: Uri): Long =
  runCatching { resolver.openAssetFileDescriptor(uri, "r")?.use { it.length } ?: -1L }.getOrDefault(-1L)

class SongNookFileIOModule : Module() {
  private val cancellations = ConcurrentHashMap<String, AtomicBoolean>()
  private val writers = ConcurrentHashMap<String, ZipWriter>()

  override fun definition() = ModuleDefinition {
    Name("SongNookFileIO")

    Events("onCopyProgress")

    // SongNook Send, sealed end to end (SongNookSeal.kt). Files a record at a
    // time; the envelope (title, sender, note, file names) as base64.
    AsyncFunction("sealFileAsync") { sourceUri: String, destinationUri: String, keyText: String ->
      val size = SongNookSeal.sealFile(File(localPath(sourceUri)), File(localPath(destinationUri)), SongNookSeal.key(keyText))
      mapOf("sizeBytes" to size.toDouble())
    }

    AsyncFunction("openSealedFileAsync") { sourceUri: String, destinationUri: String, keyText: String ->
      val size = SongNookSeal.openFile(File(localPath(sourceUri)), File(localPath(destinationUri)), SongNookSeal.key(keyText))
      mapOf("sizeBytes" to size.toDouble())
    }

    AsyncFunction("sealBase64Async") { base64: String, keyText: String ->
      val plain = Base64.decode(base64, Base64.DEFAULT)
      Base64.encodeToString(SongNookSeal.seal(plain, SongNookSeal.key(keyText)), Base64.NO_WRAP)
    }

    AsyncFunction("openSealedBase64Async") { base64: String, keyText: String ->
      val sealed = Base64.decode(base64, Base64.DEFAULT)
      Base64.encodeToString(SongNookSeal.open(sealed, SongNookSeal.key(keyText)), Base64.NO_WRAP)
    }

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
        val zip64 = writer.entryCount >= 0xFFFF || centralOffset >= ZIP32_MAX || centralSize >= ZIP32_MAX
        if (zip64) {
          val zip64EndOffset = centralOffset + centralSize
          writer.raf.write(
            le32(0x06064b50) + le64(44) + le16(45) + le16(45) + le32(0) + le32(0) +
              le64(writer.entryCount.toLong()) + le64(writer.entryCount.toLong()) +
              le64(centralSize) + le64(centralOffset) +
              le32(0x07064b50) + le32(0) + le64(zip64EndOffset) + le32(1)
          )
        }
        val count16 = if (zip64) 0xFFFF else writer.entryCount
        writer.raf.write(
          le32(0x06054b50) + le16(0) + le16(0) + le16(count16) + le16(count16) +
            le32(if (zip64) ZIP32_MAX else centralSize) + le32(if (zip64) ZIP32_MAX else centralOffset) + le16(0)
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

    // Zip64 past 4 GB (2026-11-02). Builds without it report nothing and the JS writer
    // makes a > 4 GB archive instead.
    Function("zipSupportsZip64") { true }

    // ── Backup folder (2026-11-02). Missing on builds made before automatic backup. ──

    AsyncFunction("folderBookmarkAsync") { uri: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val tree = Uri.parse(uri)
      runCatching {
        context.contentResolver.takePersistableUriPermission(
          tree, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        )
      }
      uri
    }

    AsyncFunction("folderResolveAsync") { handle: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val tree = Uri.parse(handle)
      val granted = context.contentResolver.persistedUriPermissions.any {
        it.uri == tree && it.isReadPermission && it.isWritePermission
      }
      if (!granted) throw IOException(FOLDER_NO_ACCESS)
      val root = documentUriOf(tree)
      var name: String? = null
      context.contentResolver.query(
        root, arrayOf(DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE),
        null, null, null
      )?.use { cursor ->
        if (cursor.moveToFirst() && cursor.getString(1) == DocumentsContract.Document.MIME_TYPE_DIR) {
          name = cursor.getString(0)
        }
      }
      val folderName = name ?: throw IOException(FOLDER_GONE)
      mapOf("uri" to root.toString(), "name" to folderName, "handle" to handle)
    }

    AsyncFunction("folderChildAsync") { dirUri: String, name: String, createDirectory: Boolean ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val dir = Uri.parse(dirUri)
      val existing = listChildren(context.contentResolver, dir).firstOrNull { it.name == name }
      when {
        existing != null -> existing.uri.toString()
        createDirectory -> DocumentsContract.createDocument(
          context.contentResolver, dir, DocumentsContract.Document.MIME_TYPE_DIR, name
        )?.toString() ?: throw IOException("Could not create a folder in the backup location.")
        else -> null
      }
    }

    AsyncFunction("folderListAsync") { dirUri: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      listChildren(context.contentResolver, Uri.parse(dirUri)).map {
        mapOf("name" to it.name, "uri" to it.uri.toString(), "size" to it.size.toDouble(), "isDirectory" to it.isDirectory)
      }
    }

    AsyncFunction("folderWriteFileAsync") { dirUri: String, name: String, sourceUri: String ->
      val source = File(localPath(sourceUri))
      if (!source.isFile) throw IOException("Missing file: $name")
      folderPlace(Uri.parse(dirUri), name, source.length()) { output ->
        FileInputStream(source).use { input -> input.copyTo(output, IO_CHUNK) }
      }
    }

    AsyncFunction("folderWriteTextAsync") { dirUri: String, name: String, text: String ->
      val bytes = text.toByteArray(Charsets.UTF_8)
      folderPlace(Uri.parse(dirUri), name, bytes.size.toLong()) { output -> output.write(bytes) }
    }

    AsyncFunction("folderReadTextAsync") { fileUri: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      context.contentResolver.openInputStream(Uri.parse(fileUri))?.use { it.readBytes().toString(Charsets.UTF_8) }
        ?: throw IOException("Missing file in the backup folder.")
    }

    AsyncFunction("folderCopyOutAsync") {
        fileUri: String,
        destinationUri: String,
        computeSha256: Boolean,
        operationId: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val cancelled = AtomicBoolean(false)
      cancellations[operationId] = cancelled
      val source = Uri.parse(fileUri)
      val destination = File(localPath(destinationUri))
      try {
        destination.parentFile?.mkdirs()
        val total = documentSize(context.contentResolver, source)
        val crc = CRC32()
        val sha = if (computeSha256) Base64Sha256() else null
        val buffer = ByteArray(IO_CHUNK)
        var written = 0L
        var sinceProgress = 0L
        val input = context.contentResolver.openInputStream(source) ?: throw IOException("Missing file in the backup folder.")
        input.use {
          FileOutputStream(destination).use { output ->
            while (true) {
              if (cancelled.get()) throw IOException("SONGNOOK_IO_CANCELLED")
              val count = input.read(buffer)
              if (count < 0) break
              output.write(buffer, 0, count)
              crc.update(buffer, 0, count)
              sha?.update(buffer, count)
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
        if (total >= 0 && total != written) throw IOException("The backup folder returned an incomplete file.")
        mapOf("crc32" to crc.value.toDouble(), "sizeBytes" to written.toDouble(), "sha256" to sha?.hex())
      } catch (error: Throwable) {
        destination.delete()
        throw error
      } finally {
        cancellations.remove(operationId)
      }
    }

    AsyncFunction("folderDeleteAsync") { fileUri: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      runCatching { DocumentsContract.deleteDocument(context.contentResolver, Uri.parse(fileUri)) }
      Unit
    }

    // iOS keeps a temp file out of the iCloud device backup; Android's rules live in the
    // manifest (plugins/withSongNookBackupRules.js), so there is nothing to do here.
    AsyncFunction("setExcludedFromBackupAsync") { _: String -> Unit }

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

  /** Write `name` into `dir` under a temporary name, check its size, then rename it in. */
  private fun folderPlace(
    dir: Uri,
    name: String,
    expectedSize: Long,
    write: (java.io.OutputStream) -> Unit
  ): Map<String, Any> {
    val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
    val resolver = context.contentResolver
    val children = listChildren(resolver, dir)
    val tempName = ".partial-$name"
    children.filter { it.name == tempName }.forEach { runCatching { DocumentsContract.deleteDocument(resolver, it.uri) } }
    val temp = DocumentsContract.createDocument(resolver, dir, OCTET, tempName)
      ?: throw IOException("Could not write to the backup folder.")
    try {
      (resolver.openOutputStream(temp, "wt") ?: throw IOException("Could not write to the backup folder.")).use { output ->
        write(output)
        output.flush()
      }
      val size = documentSize(resolver, temp)
      if (size >= 0 && size != expectedSize) throw IOException("The backup folder received an incomplete file.")
      children.filter { it.name == name }.forEach { DocumentsContract.deleteDocument(resolver, it.uri) }
      val placed = DocumentsContract.renameDocument(resolver, temp, name)
        ?: throw IOException("Could not finish a file in the backup folder.")
      return mapOf("uri" to placed.toString(), "sizeBytes" to expectedSize.toDouble())
    } catch (error: Throwable) {
      runCatching { DocumentsContract.deleteDocument(resolver, temp) }
      throw error
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
