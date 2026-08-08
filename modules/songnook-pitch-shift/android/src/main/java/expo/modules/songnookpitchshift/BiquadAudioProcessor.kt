package expo.modules.songnookpitchshift

import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.BaseAudioProcessor
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.sin

/**
 * Second-order (biquad) IIR filter over 16-bit PCM, per channel — the Android side of the
 * tone flags that need more than a first-order slope. Coefficients follow the RBJ Audio
 * EQ Cookbook and are derived from the actual sample rate at configure time, matching the
 * iOS renderer's AVAudioUnitEQ bands:
 *   - hi cut    = low-pass (7.2 kHz on the mix path)
 *   - mid boost = peaking (+4 dB around 1.8 kHz)
 * Same 16-bit contract and per-channel state discipline as LowCutAudioProcessor.
 */
class BiquadAudioProcessor private constructor(
  private val kind: Kind,
  private val frequencyHz: Double,
  private val gainDb: Double,
  private val q: Double,
) : BaseAudioProcessor() {
  private enum class Kind { LOW_PASS, PEAKING }

  companion object {
    fun lowPass(frequencyHz: Double, q: Double = 0.707): BiquadAudioProcessor =
      BiquadAudioProcessor(Kind.LOW_PASS, frequencyHz, 0.0, q)

    fun peaking(frequencyHz: Double, gainDb: Double, q: Double): BiquadAudioProcessor =
      BiquadAudioProcessor(Kind.PEAKING, frequencyHz, gainDb, q)
  }

  // Normalized coefficients (divided by a0).
  private var b0 = 1.0
  private var b1 = 0.0
  private var b2 = 0.0
  private var a1 = 0.0
  private var a2 = 0.0

  // Direct form 1 state, per channel.
  private var x1 = DoubleArray(0)
  private var x2 = DoubleArray(0)
  private var y1 = DoubleArray(0)
  private var y2 = DoubleArray(0)

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

    ensureChannelState(channelCount)

    val input = inputBuffer.order(ByteOrder.LITTLE_ENDIAN)
    val output = replaceOutputBuffer(bytesRemaining).order(ByteOrder.LITTLE_ENDIAN)
    val frameCount = bytesRemaining / inputAudioFormat.bytesPerFrame

    for (frameIndex in 0 until frameCount) {
      for (channel in 0 until channelCount) {
        val x = input.short.toDouble() / Short.MAX_VALUE.toDouble()
        val y = b0 * x + b1 * x1[channel] + b2 * x2[channel] - a1 * y1[channel] - a2 * y2[channel]

        x2[channel] = x1[channel]
        x1[channel] = x
        y2[channel] = y1[channel]
        y1[channel] = y

        val clamped = y.coerceIn(-1.0, 1.0)
        output.putShort((clamped * Short.MAX_VALUE.toDouble()).toInt().toShort())
      }
    }

    inputBuffer.position(inputBuffer.limit())
    output.flip()
  }

  override fun onFlush() {
    ensureChannelState(inputAudioFormat.channelCount)
    updateCoefficients()
    x1.fill(0.0)
    x2.fill(0.0)
    y1.fill(0.0)
    y2.fill(0.0)
  }

  override fun onReset() {
    x1 = DoubleArray(0)
    x2 = DoubleArray(0)
    y1 = DoubleArray(0)
    y2 = DoubleArray(0)
  }

  private fun ensureChannelState(channelCount: Int) {
    if (x1.size != channelCount) {
      x1 = DoubleArray(channelCount)
      x2 = DoubleArray(channelCount)
      y1 = DoubleArray(channelCount)
      y2 = DoubleArray(channelCount)
      updateCoefficients()
    }
  }

  private fun updateCoefficients() {
    val sampleRate = inputAudioFormat.sampleRate.toDouble()
    if (sampleRate <= 0.0) {
      return
    }
    val omega = 2.0 * PI * frequencyHz / sampleRate
    val sinOmega = sin(omega)
    val cosOmega = cos(omega)
    val alpha = sinOmega / (2.0 * q)

    when (kind) {
      Kind.LOW_PASS -> {
        val a0 = 1.0 + alpha
        b0 = ((1.0 - cosOmega) / 2.0) / a0
        b1 = (1.0 - cosOmega) / a0
        b2 = ((1.0 - cosOmega) / 2.0) / a0
        a1 = (-2.0 * cosOmega) / a0
        a2 = (1.0 - alpha) / a0
      }
      Kind.PEAKING -> {
        val amp = 10.0.pow(gainDb / 40.0)
        val a0 = 1.0 + alpha / amp
        b0 = (1.0 + alpha * amp) / a0
        b1 = (-2.0 * cosOmega) / a0
        b2 = (1.0 - alpha * amp) / a0
        a1 = (-2.0 * cosOmega) / a0
        a2 = (1.0 - alpha / amp) / a0
      }
    }
  }
}
