package expo.modules.songseedpitchshift

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.HandlerThread
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.SonicAudioProcessor
import androidx.media3.common.audio.ToInt16PcmAudioProcessor
import androidx.media3.common.util.UnstableApi
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import java.io.File
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.max
import kotlin.math.min

private const val RENDER_TIMEOUT_MINUTES = 10L

@androidx.annotation.OptIn(UnstableApi::class)
class SongseedPitchShiftRenderer(
  context: Context,
) {
  private val appContext = context.applicationContext

  fun renderFile(request: Map<String, Any?>): Map<String, Any> {
    val inputUri = request["inputUri"] as? String
      ?: throw IllegalArgumentException("Pitch shift rendering requires inputUri.")
    val semitones = ((request["semitones"] as? Number)?.toInt() ?: 0).coerceIn(-12, 12)
    val playbackRate = max(0.5, min(2.0, (request["playbackRate"] as? Number)?.toDouble() ?: 1.0))
    val outputFileName = (request["outputFileName"] as? String)?.trim()

    val outputFile = buildOutputFile(outputFileName)
    val renderThread = HandlerThread("SongseedPitchShiftRender").apply { start() }
    val renderHandler = Handler(renderThread.looper)
    val transformerRef = AtomicReference<Transformer?>()
    val resultRef = AtomicReference<Map<String, Any>?>()
    val errorRef = AtomicReference<Throwable?>()
    val completionLatch = CountDownLatch(1)

    try {
      renderHandler.post {
        try {
          val transformer =
            Transformer.Builder(appContext)
              .setLooper(renderThread.looper)
              .setAudioMimeType(MimeTypes.AUDIO_AAC)
              .addListener(
                object : Transformer.Listener {
                  override fun onCompleted(
                    composition: Composition,
                    exportResult: ExportResult,
                  ) {
                    resultRef.set(mapOf("outputUri" to Uri.fromFile(outputFile).toString()))
                    completionLatch.countDown()
                  }

                  override fun onError(
                    composition: Composition,
                    exportResult: ExportResult,
                    exportException: ExportException,
                  ) {
                    errorRef.set(exportException)
                    completionLatch.countDown()
                  }
                }
              )
              .build()

          transformerRef.set(transformer)
          transformer.start(buildEditedMediaItem(inputUri, semitones, playbackRate), outputFile.absolutePath)
        } catch (throwable: Throwable) {
          errorRef.set(throwable)
          completionLatch.countDown()
        }
      }

      val completed = completionLatch.await(RENDER_TIMEOUT_MINUTES, TimeUnit.MINUTES)
      if (!completed) {
        renderHandler.post {
          try {
            transformerRef.get()?.cancel()
          } catch (_: Throwable) {
          }
        }
        throw IllegalStateException("Pitch shift rendering timed out.")
      }

      errorRef.get()?.let { throw mapRenderError(it) }
      return resultRef.get() ?: throw IllegalStateException("Pitch shift rendering completed without an output file.")
    } finally {
      if (errorRef.get() != null && outputFile.exists()) {
        outputFile.delete()
      }
      renderThread.quitSafely()
      try {
        renderThread.join(2_000)
      } catch (_: InterruptedException) {
        Thread.currentThread().interrupt()
      }
    }
  }

  private fun buildEditedMediaItem(
    inputUri: String,
    semitones: Int,
    playbackRate: Double,
  ): EditedMediaItem {
    val mediaItem = MediaItem.fromUri(parseInputUri(inputUri))
    return EditedMediaItem.Builder(mediaItem)
      .setRemoveVideo(true)
      .setEffects(
        Effects(
          buildAudioProcessors(semitones, playbackRate),
          emptyList(),
        )
      )
      .build()
  }

  private fun buildAudioProcessors(
    semitones: Int,
    playbackRate: Double,
  ): List<AudioProcessor> {
    val toInt16Processor = ToInt16PcmAudioProcessor()
    val sonicProcessor = SonicAudioProcessor().apply {
      setSpeed(playbackRate.toFloat())
      setPitch(semitonesToPitchMultiplier(semitones))
    }

    return listOf(toInt16Processor, sonicProcessor)
  }

  private fun semitonesToPitchMultiplier(semitones: Int): Float {
    return Math.pow(2.0, semitones / 12.0).toFloat()
  }

  private fun parseInputUri(inputUri: String): Uri {
    val parsed = Uri.parse(inputUri)
    return if (parsed.scheme.isNullOrBlank()) {
      Uri.fromFile(File(inputUri))
    } else {
      parsed
    }
  }

  private fun buildOutputFile(outputFileName: String?): File {
    val safeName = outputFileName
      ?.replace(Regex("[^A-Za-z0-9._-]+"), "-")
      ?.trim('-')
      ?.takeIf { it.isNotBlank() }
      ?: "songseed-transform-${UUID.randomUUID()}"
    val finalName =
      when {
        safeName.endsWith(".m4a", ignoreCase = true) -> safeName
        safeName.endsWith(".mp4", ignoreCase = true) -> safeName
        else -> "$safeName.m4a"
      }

    return File(appContext.cacheDir, finalName).apply {
      parentFile?.mkdirs()
      if (exists()) {
        delete()
      }
    }
  }

  private fun mapRenderError(throwable: Throwable): Throwable {
    val message =
      when (throwable) {
        is ExportException -> throwable.message ?: "Pitch shift rendering failed."
        is IllegalStateException -> throwable.message ?: "Pitch shift rendering failed."
        else -> throwable.message ?: "Pitch shift rendering failed."
      }

    return IllegalStateException(message, throwable)
  }
}
