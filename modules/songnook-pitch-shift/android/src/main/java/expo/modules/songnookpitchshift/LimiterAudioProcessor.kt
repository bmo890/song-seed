package expo.modules.songnookpitchshift

import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.BaseAudioProcessor
import java.nio.ByteOrder
import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.max

/**
 * A peak limiter over 16-bit PCM, after the level lift, so a +12 dB take never
 * crackles. One gain envelope shared by all channels (so the stereo image holds):
 * it drops at once when a peak would exceed the ceiling and recovers over
 * [releaseMs]. The Android side of the iOS practice engine's PeakLimiter unit.
 * Same 16-bit contract as the other processors in this module.
 */
class LimiterAudioProcessor(
  private val ceiling: Double = 0.97,
  private val releaseMs: Double = 80.0,
) : BaseAudioProcessor() {
  private var envelope = 1.0
  private var releaseCoefficient = 1.0

  override fun onConfigure(
    inputAudioFormat: AudioProcessor.AudioFormat,
  ): AudioProcessor.AudioFormat {
    if (inputAudioFormat.encoding != C.ENCODING_PCM_16BIT) {
      throw AudioProcessor.UnhandledAudioFormatException(inputAudioFormat)
    }
    return inputAudioFormat
  }

  override fun isActive(): Boolean = true

  override fun queueInput(inputBuffer: java.nio.ByteBuffer) {
    val bytesRemaining = inputBuffer.remaining()
    if (bytesRemaining == 0) {
      return
    }
    val channelCount = inputAudioFormat.channelCount
    if (channelCount <= 0) {
      inputBuffer.position(inputBuffer.limit())
      return
    }
    if (releaseCoefficient >= 1.0) {
      updateRelease()
    }

    val input = inputBuffer.order(ByteOrder.LITTLE_ENDIAN)
    val output = replaceOutputBuffer(bytesRemaining).order(ByteOrder.LITTLE_ENDIAN)
    val frameCount = bytesRemaining / inputAudioFormat.bytesPerFrame
    val frame = DoubleArray(channelCount)

    for (frameIndex in 0 until frameCount) {
      var peak = 0.0
      for (channel in 0 until channelCount) {
        val sample = input.short.toDouble() / Short.MAX_VALUE.toDouble()
        frame[channel] = sample
        peak = max(peak, abs(sample))
      }
      // The gain this frame needs to sit under the ceiling; the envelope falls
      // to it at once and climbs back toward unity between peaks.
      val needed = if (peak > ceiling) ceiling / peak else 1.0
      envelope = if (needed < envelope) needed else envelope + (1.0 - envelope) * (1.0 - releaseCoefficient)
      for (channel in 0 until channelCount) {
        val limited = (frame[channel] * envelope).coerceIn(-1.0, 1.0)
        output.putShort((limited * Short.MAX_VALUE.toDouble()).toInt().toShort())
      }
    }

    inputBuffer.position(inputBuffer.limit())
    output.flip()
  }

  override fun onFlush() {
    envelope = 1.0
    updateRelease()
  }

  override fun onReset() {
    envelope = 1.0
    releaseCoefficient = 1.0
  }

  private fun updateRelease() {
    val sampleRate = inputAudioFormat.sampleRate
    if (sampleRate <= 0) {
      releaseCoefficient = 1.0
      return
    }
    releaseCoefficient = exp(-1.0 / (sampleRate.toDouble() * releaseMs / 1000.0))
  }
}
