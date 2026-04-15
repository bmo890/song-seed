package expo.modules.songseedpitchshift

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.HandlerThread
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.DefaultGainProvider
import androidx.media3.common.audio.GainProcessor
import androidx.media3.common.audio.SonicAudioProcessor
import androidx.media3.common.audio.ToInt16PcmAudioProcessor
import androidx.media3.common.util.UnstableApi
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.EditedMediaItemSequence
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
private const val MIX_OFFSET_US = 1_000L
private const val OVERDUB_GAIN_MIN_DB = -18.0
private const val OVERDUB_GAIN_MAX_DB = 6.0

private data class MixedRenderInput(
  val inputUri: String,
  val gainDb: Double,
  val offsetMs: Long,
  val tonePreset: String,
)

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
    try {
      return renderComposition(
        buildPitchComposition(inputUri, semitones, playbackRate),
        outputFile,
      )
    } catch (throwable: Throwable) {
      if (outputFile.exists()) {
        outputFile.delete()
      }
      throw throwable
    }
  }

  fun renderMixedFile(request: Map<String, Any?>): Map<String, Any> {
    val rawInputs = request["inputs"] as? List<*>
      ?: throw IllegalArgumentException("Mixed rendering requires inputs.")
    val outputFileName = (request["outputFileName"] as? String)?.trim()
    val inputs =
      rawInputs.mapNotNull { parseMixedInput(it) }
        .filter { it.inputUri.isNotBlank() }

    if (inputs.isEmpty()) {
      throw IllegalArgumentException("Mixed rendering requires at least one playable input.")
    }

    val outputFile = buildOutputFile(outputFileName)
    try {
      return renderComposition(buildMixedComposition(inputs), outputFile)
    } catch (throwable: Throwable) {
      if (outputFile.exists()) {
        outputFile.delete()
      }
      throw throwable
    }
  }

  private fun buildPitchComposition(
    inputUri: String,
    semitones: Int,
    playbackRate: Double,
  ): Composition {
    val mediaItem = MediaItem.fromUri(parseInputUri(inputUri))
    val editedItem =
      EditedMediaItem.Builder(mediaItem)
        .setRemoveVideo(true)
        .setEffects(
          Effects(
            buildPitchAudioProcessors(semitones, playbackRate),
            emptyList(),
          )
        )
        .build()

    return Composition.Builder(EditedMediaItemSequence(editedItem))
      .experimentalSetForceAudioTrack(true)
      .build()
  }

  private fun buildMixedComposition(inputs: List<MixedRenderInput>): Composition {
    val sequences =
      inputs.map { input ->
        val mediaItem = MediaItem.fromUri(parseInputUri(input.inputUri))
        val editedItem =
          EditedMediaItem.Builder(mediaItem)
            .setRemoveVideo(true)
            .setEffects(
              Effects(
                buildMixAudioProcessors(input),
                emptyList(),
              )
            )
            .build()

        val builder = EditedMediaItemSequence.Builder(emptyList())
        if (input.offsetMs > 0) {
          builder.addGap(input.offsetMs * MIX_OFFSET_US)
        }
        builder.addItem(editedItem)
        builder.build()
      }

    return Composition.Builder(sequences)
      .experimentalSetForceAudioTrack(true)
      .build()
  }

  private fun buildPitchAudioProcessors(
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

  private fun buildMixAudioProcessors(input: MixedRenderInput): List<AudioProcessor> {
    val processors = mutableListOf<AudioProcessor>()
    processors += ToInt16PcmAudioProcessor()

    val gainDb = input.gainDb
    if (gainDb != 0.0) {
      processors += GainProcessor(DefaultGainProvider.Builder(dbToGainFactor(gainDb)).build())
    }

    if (input.tonePreset == "low-cut") {
      processors += LowCutAudioProcessor()
    }

    return processors
  }

  private fun renderComposition(
    composition: Composition,
    outputFile: File,
  ): Map<String, Any> {
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
          transformer.start(composition, outputFile.absolutePath)
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
        throw IllegalStateException("Audio rendering timed out.")
      }

      errorRef.get()?.let { throw mapRenderError(it) }
      return resultRef.get() ?: throw IllegalStateException("Audio rendering completed without an output file.")
    } finally {
      renderThread.quitSafely()
      try {
        renderThread.join(2_000)
      } catch (_: InterruptedException) {
        Thread.currentThread().interrupt()
      }
    }
  }

  private fun parseMixedInput(value: Any?): MixedRenderInput? {
    val request = value as? Map<*, *> ?: return null
    val inputUri = request["inputUri"] as? String ?: return null
    val gainDb = max(OVERDUB_GAIN_MIN_DB, min(OVERDUB_GAIN_MAX_DB, (request["gainDb"] as? Number)?.toDouble() ?: 0.0))
    val offsetMs = max(0L, (request["offsetMs"] as? Number)?.toLong() ?: 0L)
    val tonePreset = (request["tonePreset"] as? String)?.trim()?.ifEmpty { "neutral" } ?: "neutral"

    return MixedRenderInput(
      inputUri = inputUri,
      gainDb = gainDb,
      offsetMs = offsetMs,
      tonePreset = tonePreset,
    )
  }

  private fun dbToGainFactor(gainDb: Double): Float {
    return Math.pow(10.0, gainDb / 20.0).toFloat()
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
        is ExportException -> throwable.message ?: "Audio rendering failed."
        is IllegalStateException -> throwable.message ?: "Audio rendering failed."
        else -> throwable.message ?: "Audio rendering failed."
      }

    return IllegalStateException(message, throwable)
  }
}
