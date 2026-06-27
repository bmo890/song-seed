package expo.modules.songseedpitchshift

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
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
import java.nio.ByteOrder
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

  // --- Tier 2: trim/extract/cut via media3 Transformer ---------------------------

  fun renderTrim(request: Map<String, Any?>): Map<String, Any> {
    val inputUri = request["inputUri"] as? String
      ?: throw IllegalArgumentException("Trim rendering requires inputUri.")
    val rawRanges = request["ranges"] as? List<*>
      ?: throw IllegalArgumentException("Trim rendering requires ranges.")
    val outputFileName = (request["outputFileName"] as? String)?.trim()
    val ranges = rawRanges.mapNotNull { parseTrimRange(it) }
    if (ranges.isEmpty()) {
      throw IllegalArgumentException("Trim rendering requires at least one valid range.")
    }

    val outputFile = buildOutputFile(outputFileName)
    try {
      return renderComposition(buildTrimComposition(inputUri, ranges), outputFile)
    } catch (throwable: Throwable) {
      if (outputFile.exists()) {
        outputFile.delete()
      }
      throw throwable
    }
  }

  private fun buildTrimComposition(inputUri: String, ranges: List<TrimRange>): Composition {
    val uri = parseInputUri(inputUri)
    val sequenceBuilder = EditedMediaItemSequence.Builder(emptyList())
    for (range in ranges) {
      val mediaItem = MediaItem.Builder()
        .setUri(uri)
        .setClippingConfiguration(
          MediaItem.ClippingConfiguration.Builder()
            .setStartPositionMs(range.startMs)
            .setEndPositionMs(range.endMs)
            .build()
        )
        .build()
      val editedItem = EditedMediaItem.Builder(mediaItem)
        .setRemoveVideo(true)
        .setEffects(Effects(listOf(ToInt16PcmAudioProcessor()), emptyList()))
        .build()
      sequenceBuilder.addItem(editedItem)
    }

    // A single sequence of multiple clipped items plays them back-to-back, i.e.
    // concatenates the kept ranges into one continuous output.
    return Composition.Builder(sequenceBuilder.build())
      .experimentalSetForceAudioTrack(true)
      .build()
  }

  private data class TrimRange(val startMs: Long, val endMs: Long)

  private fun parseTrimRange(value: Any?): TrimRange? {
    val map = value as? Map<*, *> ?: return null
    val start = max(0L, (map["startTimeMs"] as? Number)?.toLong() ?: return null)
    val end = (map["endTimeMs"] as? Number)?.toLong() ?: return null
    if (end <= start) return null
    return TrimRange(start, end)
  }

  // --- Tier 3: waveform analysis via MediaExtractor + MediaCodec ------------------

  fun computeWaveform(request: Map<String, Any?>): Map<String, Any> {
    val inputUri = request["inputUri"] as? String
      ?: throw IllegalArgumentException("Waveform analysis requires inputUri.")
    val numberOfPoints = max(1, (request["numberOfPoints"] as? Number)?.toInt() ?: 256)
    val startTimeMs = max(0L, (request["startTimeMs"] as? Number)?.toLong() ?: 0L)
    val endTimeMsRaw = (request["endTimeMs"] as? Number)?.toLong() ?: 0L

    val extractor = MediaExtractor()
    var codec: MediaCodec? = null
    try {
      extractor.setDataSource(appContext, parseInputUri(inputUri), null)
      val trackIndex = (0 until extractor.trackCount).firstOrNull { index ->
        extractor.getTrackFormat(index).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
      } ?: throw IllegalStateException("No audio track found.")

      val format = extractor.getTrackFormat(trackIndex)
      extractor.selectTrack(trackIndex)

      val durationUs = if (format.containsKey(MediaFormat.KEY_DURATION)) format.getLong(MediaFormat.KEY_DURATION) else 0L
      val durationMs = durationUs / 1000L
      val startUs = startTimeMs * 1000L
      val endUs = if (endTimeMsRaw > 0L) endTimeMsRaw * 1000L else durationUs
      val rangeUs = max(1L, endUs - startUs)

      if (startUs > 0L) {
        extractor.seekTo(startUs, MediaExtractor.SEEK_TO_PREVIOUS_SYNC)
      }

      val mime = format.getString(MediaFormat.KEY_MIME) ?: throw IllegalStateException("Unknown audio mime type.")
      codec = MediaCodec.createDecoderByType(mime)
      codec.configure(format, null, null, 0)
      codec.start()

      val peaks = FloatArray(numberOfPoints)
      val bufferInfo = MediaCodec.BufferInfo()
      var sawInputEos = false
      var sawOutputEos = false
      val timeoutUs = 10_000L

      while (!sawOutputEos) {
        if (!sawInputEos) {
          val inIndex = codec.dequeueInputBuffer(timeoutUs)
          if (inIndex >= 0) {
            val inputBuffer = codec.getInputBuffer(inIndex)
            val sampleSize = if (inputBuffer != null) extractor.readSampleData(inputBuffer, 0) else -1
            if (sampleSize < 0) {
              codec.queueInputBuffer(inIndex, 0, 0, 0L, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
              sawInputEos = true
            } else {
              codec.queueInputBuffer(inIndex, 0, sampleSize, extractor.sampleTime, 0)
              extractor.advance()
            }
          }
        }

        val outIndex = codec.dequeueOutputBuffer(bufferInfo, timeoutUs)
        if (outIndex >= 0) {
          if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
            sawOutputEos = true
          }
          val outputBuffer = codec.getOutputBuffer(outIndex)
          if (outputBuffer != null && bufferInfo.size > 0) {
            val ptsUs = bufferInfo.presentationTimeUs
            if (ptsUs in startUs..endUs) {
              outputBuffer.order(ByteOrder.LITTLE_ENDIAN)
              val shorts = outputBuffer.asShortBuffer()
              val sampleCount = shorts.remaining()
              val frac = ((ptsUs - startUs).toDouble() / rangeUs).coerceIn(0.0, 0.999999)
              val bin = (frac * numberOfPoints).toInt().coerceIn(0, numberOfPoints - 1)
              var localPeak = peaks[bin]
              var i = 0
              while (i < sampleCount) {
                val sample = Math.abs(shorts.get(i).toInt()) / 32768f
                if (sample > localPeak) localPeak = sample
                i += 1
              }
              peaks[bin] = localPeak
            }
          }
          codec.releaseOutputBuffer(outIndex, false)
        }
      }

      return mapOf(
        "peaks" to peaks.map { it.toDouble() },
        "durationMs" to durationMs,
      )
    } finally {
      try { codec?.stop() } catch (_: Throwable) {}
      try { codec?.release() } catch (_: Throwable) {}
      try { extractor.release() } catch (_: Throwable) {}
    }
  }
}
