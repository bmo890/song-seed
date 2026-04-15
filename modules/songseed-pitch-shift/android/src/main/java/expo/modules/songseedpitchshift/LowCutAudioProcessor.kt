package expo.modules.songseedpitchshift

import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.BaseAudioProcessor
import java.nio.ByteOrder
import kotlin.math.PI

private const val DEFAULT_LOW_CUT_HZ = 140.0

class LowCutAudioProcessor(
  private val cutoffHz: Double = DEFAULT_LOW_CUT_HZ,
) : BaseAudioProcessor() {
  private var alpha = 0.0
  private var previousInputByChannel = DoubleArray(0)
  private var previousOutputByChannel = DoubleArray(0)

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
    if (alpha <= 0.0) {
      updateAlpha()
    }

    val input = inputBuffer.order(ByteOrder.LITTLE_ENDIAN)
    val output = replaceOutputBuffer(bytesRemaining).order(ByteOrder.LITTLE_ENDIAN)
    val frameCount = bytesRemaining / inputAudioFormat.bytesPerFrame

    for (frameIndex in 0 until frameCount) {
      for (channelIndex in 0 until channelCount) {
        val inputSample = input.short.toDouble() / Short.MAX_VALUE.toDouble()
        val filteredSample =
          alpha *
            (previousOutputByChannel[channelIndex] + inputSample - previousInputByChannel[channelIndex])

        previousInputByChannel[channelIndex] = inputSample
        previousOutputByChannel[channelIndex] = filteredSample

        val clamped = filteredSample.coerceIn(-1.0, 1.0)
        output.putShort((clamped * Short.MAX_VALUE.toDouble()).toInt().toShort())
      }
    }

    inputBuffer.position(inputBuffer.limit())
    output.flip()
  }

  override fun onFlush() {
    ensureChannelState(inputAudioFormat.channelCount)
    updateAlpha()
    previousInputByChannel.fill(0.0)
    previousOutputByChannel.fill(0.0)
  }

  override fun onReset() {
    alpha = 0.0
    previousInputByChannel = DoubleArray(0)
    previousOutputByChannel = DoubleArray(0)
  }

  private fun ensureChannelState(channelCount: Int) {
    if (channelCount <= 0) {
      previousInputByChannel = DoubleArray(0)
      previousOutputByChannel = DoubleArray(0)
      return
    }

    if (previousInputByChannel.size != channelCount) {
      previousInputByChannel = DoubleArray(channelCount)
      previousOutputByChannel = DoubleArray(channelCount)
    }
  }

  private fun updateAlpha() {
    val sampleRate = inputAudioFormat.sampleRate
    if (sampleRate <= 0) {
      alpha = 0.0
      return
    }

    val dt = 1.0 / sampleRate.toDouble()
    val rc = 1.0 / (2.0 * PI * cutoffHz)
    alpha = rc / (rc + dt)
  }
}
