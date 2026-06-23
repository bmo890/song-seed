package expo.modules.songseedfileio

import android.net.Uri
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

class SongseedFileIOModule : Module() {
  private val cancellations = ConcurrentHashMap<String, AtomicBoolean>()

  override fun definition() = ModuleDefinition {
    Name("SongseedFileIO")

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
}
