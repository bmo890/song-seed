package expo.modules.songnookpitchshift

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import java.io.File
import java.nio.ByteOrder
import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.sqrt

/**
 * Measures a clip for the Sound drawer's Auto (2026-11-22). One pass over the audio,
 * folded to mono, reported in 0.4 s windows: the RMS of the whole signal, of the rumble
 * band (below ~60 Hz) and of the hiss band (above ~6 kHz), plus the peak. The app
 * decides what to do with them (src/domain/autoSound.ts); this only measures. Mirrors
 * SongNookSoundAnalysis.swift.
 */
internal class SongNookSoundMeter(sampleRate: Int) {
  private val windowFrames = max(1, (sampleRate * WINDOW_SECONDS).toInt())
  private val subA = exp(-2.0 * Math.PI * 60.0 / sampleRate)
  private val highA = exp(-2.0 * Math.PI * 6000.0 / sampleRate)
  private var sub1 = 0.0
  private var sub2 = 0.0
  private var hiLp1 = 0.0
  private var hiLp2 = 0.0
  private var sumAll = 0.0
  private var sumSub = 0.0
  private var sumHigh = 0.0
  private var framesInWindow = 0
  private val rms = ArrayList<Double>()
  private val sub = ArrayList<Double>()
  private val high = ArrayList<Double>()
  private var peak = 0.0

  fun feed(x: Double) {
    peak = max(peak, abs(x))
    // Rumble: two one-pole low-passes at 60 Hz (12 dB/oct).
    sub1 = (1 - subA) * x + subA * sub1
    sub2 = (1 - subA) * sub1 + subA * sub2
    // Hiss: two one-pole high-passes at 6 kHz (x minus its low-pass, twice).
    hiLp1 = (1 - highA) * x + highA * hiLp1
    val hp1 = x - hiLp1
    hiLp2 = (1 - highA) * hp1 + highA * hiLp2
    val hp2 = hp1 - hiLp2
    sumAll += x * x
    sumSub += sub2 * sub2
    sumHigh += hp2 * hp2
    framesInWindow += 1
    if (framesInWindow >= windowFrames) closeWindow()
  }

  fun finish(): Map<String, Any> {
    if (framesInWindow > 0) closeWindow()
    return mapOf(
      "windowMs" to WINDOW_SECONDS * 1000,
      "rms" to rms.toList(),
      "sub" to sub.toList(),
      "high" to high.toList(),
      "peak" to peak,
    )
  }

  private fun closeWindow() {
    val n = framesInWindow.toDouble()
    rms.add(sqrt(sumAll / n))
    sub.add(sqrt(sumSub / n))
    high.add(sqrt(sumHigh / n))
    sumAll = 0.0
    sumSub = 0.0
    sumHigh = 0.0
    framesInWindow = 0
  }

  companion object {
    const val WINDOW_SECONDS = 0.4
  }
}

internal fun analyzeSound(context: Context, request: Map<String, Any?>): Map<String, Any> {
  val inputUri = request["inputUri"] as? String
    ?: throw IllegalArgumentException("Sound analysis requires inputUri.")
  val parsed = Uri.parse(inputUri)
  val uri = if (parsed.scheme.isNullOrBlank()) Uri.fromFile(File(inputUri)) else parsed

  val extractor = MediaExtractor()
  var codec: MediaCodec? = null
  try {
    extractor.setDataSource(context, uri, null)
    val trackIndex = (0 until extractor.trackCount).firstOrNull { index ->
      extractor.getTrackFormat(index).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
    } ?: throw IllegalStateException("No audio track found.")
    val format = extractor.getTrackFormat(trackIndex)
    extractor.selectTrack(trackIndex)
    val mime = format.getString(MediaFormat.KEY_MIME) ?: throw IllegalStateException("Unknown audio mime type.")
    codec = MediaCodec.createDecoderByType(mime)
    codec.configure(format, null, null, 0)
    codec.start()

    var channels = if (format.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) format.getInteger(MediaFormat.KEY_CHANNEL_COUNT) else 1
    var sampleRate = if (format.containsKey(MediaFormat.KEY_SAMPLE_RATE)) format.getInteger(MediaFormat.KEY_SAMPLE_RATE) else 44_100
    // Some decoders hand back float PCM (a float WAV, some hi-res imports): read as
    // 16-bit it is noise, and Auto would "fix" what it never heard.
    var floatPcm = false
    var meter: SongNookSoundMeter? = null
    val bufferInfo = MediaCodec.BufferInfo()
    var sawInputEos = false
    var sawOutputEos = false
    val timeoutUs = 10_000L

    while (!sawOutputEos) {
      if (!sawInputEos) {
        val inIndex = codec.dequeueInputBuffer(timeoutUs)
        if (inIndex >= 0) {
          val inputBuffer = codec.getInputBuffer(inIndex)
          val size = if (inputBuffer != null) extractor.readSampleData(inputBuffer, 0) else -1
          if (size < 0) {
            codec.queueInputBuffer(inIndex, 0, 0, 0L, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
            sawInputEos = true
          } else {
            codec.queueInputBuffer(inIndex, 0, size, extractor.sampleTime, 0)
            extractor.advance()
          }
        }
      }
      val outIndex = codec.dequeueOutputBuffer(bufferInfo, timeoutUs)
      if (outIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
        val out = codec.outputFormat
        if (out.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) channels = out.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
        if (out.containsKey(MediaFormat.KEY_SAMPLE_RATE)) sampleRate = out.getInteger(MediaFormat.KEY_SAMPLE_RATE)
        floatPcm = out.containsKey(MediaFormat.KEY_PCM_ENCODING) &&
          out.getInteger(MediaFormat.KEY_PCM_ENCODING) == android.media.AudioFormat.ENCODING_PCM_FLOAT
      } else if (outIndex >= 0) {
        if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) sawOutputEos = true
        val outputBuffer = codec.getOutputBuffer(outIndex)
        if (outputBuffer != null && bufferInfo.size > 0) {
          val m = meter ?: SongNookSoundMeter(sampleRate).also { meter = it }
          outputBuffer.position(bufferInfo.offset)
          outputBuffer.limit(bufferInfo.offset + bufferInfo.size)
          val frameWidth = max(1, channels)
          val ordered = outputBuffer.order(ByteOrder.LITTLE_ENDIAN)
          if (floatPcm) {
            val floats = ordered.asFloatBuffer()
            val frames = floats.remaining() / frameWidth
            for (frame in 0 until frames) {
              var sum = 0.0
              for (channel in 0 until frameWidth) sum += floats.get(frame * frameWidth + channel).toDouble()
              m.feed(sum / frameWidth)
            }
          } else {
            val shorts = ordered.asShortBuffer()
            val frames = shorts.remaining() / frameWidth
            for (frame in 0 until frames) {
              var sum = 0.0
              for (channel in 0 until frameWidth) sum += shorts.get(frame * frameWidth + channel) / 32768.0
              m.feed(sum / frameWidth)
            }
          }
        }
        codec.releaseOutputBuffer(outIndex, false)
      }
    }
    return (meter ?: SongNookSoundMeter(sampleRate)).finish()
  } finally {
    try { codec?.stop() } catch (_: Throwable) {}
    try { codec?.release() } catch (_: Throwable) {}
    try { extractor.release() } catch (_: Throwable) {}
  }
}
