package expo.modules.songnookpitchshift

import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.BaseAudioProcessor
import androidx.media3.common.util.UnstableApi
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * A take's sound as one stage (2026-10-21): level, then the tone keys, then a
 * look-ahead limiter, over 16-bit PCM in and out with doubles inside. The
 * Android side of the iOS chain (EQ globalGain → EQ bands → PeakLimiter).
 *
 * One processor instead of five so that
 *  - the level is lifted in floating point and limited BEFORE anything is
 *    rounded back to 16 bits (the old GainProcessor clipped at 16 bits before
 *    the limiter ever saw the signal: the "overdrive" at +12 dB);
 *  - level and tone change LIVE: the player no longer has to be rebuilt for a
 *    slider move (which dropped out and re-seeked on every change);
 *  - the limiter looks 5 ms ahead and attacks over 1 ms instead of slamming
 *    the gain per sample, so a hot take is held under the ceiling without the
 *    crackle an instant limiter adds.
 *
 * Tone stages mirror SongNookToneEQ on iOS: low-cut = first-order high-pass
 * 140 Hz, low-boost = low shelf +4 dB at 120 Hz, mid-boost = peak +4 dB at
 * 1.8 kHz (Q 1), hi-cut = low-pass 7.2 kHz. Coefficients follow the RBJ Audio
 * EQ Cookbook and the real sample rate.
 */
@UnstableApi
class SoundChainAudioProcessor(
  gainDb: Double = 0.0,
  tonePreset: String = "neutral",
  /** Off for a per-layer stage inside a mix: the sum is limited once, after mixing. */
  private val limit: Boolean = true,
) : BaseAudioProcessor() {

  @Volatile
  var gainDb: Double = gainDb
    set(value) {
      field = value.coerceIn(SOUND_GAIN_MIN_DB, SOUND_GAIN_MAX_DB)
    }

  @Volatile
  var tonePreset: String = tonePreset

  // ── per-buffer snapshot of the live parameters ─────────────────────────────
  private var targetGain = 1.0
  private var smoothedGain = 1.0
  private var gainCoefficient = 1.0
  private var lowCutOn = false
  private var lowBoostOn = false
  private var midBoostOn = false
  private var hiCutOn = false

  // ── tone stage state (per channel) ─────────────────────────────────────────
  private var channelCount = 0
  private var lowCutAlpha = 0.0
  private var lowCutPrevIn = DoubleArray(0)
  private var lowCutPrevOut = DoubleArray(0)
  private val lowShelf = Biquad()
  private val peak = Biquad()
  private val lowPass = Biquad()

  // ── limiter ────────────────────────────────────────────────────────────────
  private var lookaheadFrames = 0
  private var delay = Array(0) { DoubleArray(0) }
  private var delayWrite = 0
  // Sliding-window minimum of the gain each frame needs, over the frame being
  // output and every frame still inside the delay line (window = delay + 1):
  // a monotonic deque of window slots.
  private var windowSize = 0
  private var needed = DoubleArray(0)
  private var dequeIdx = IntArray(0)
  private var dequeHead = 0
  private var dequeTail = 0
  private var frameCounter = 0L
  private var envelope = 1.0
  private var attackCoefficient = 1.0
  private var releaseCoefficient = 0.0

  override fun onConfigure(inputAudioFormat: AudioProcessor.AudioFormat): AudioProcessor.AudioFormat {
    if (inputAudioFormat.encoding != C.ENCODING_PCM_16BIT) {
      throw AudioProcessor.UnhandledAudioFormatException(inputAudioFormat)
    }
    return inputAudioFormat
  }

  override fun isActive(): Boolean = true

  /** Frames this stage delays the song by (the limiter's look-ahead): the play-along
   *  click, mixed after it, lands its beats this much later to stay with the song. */
  val latencyFrames: Int
    get() = if (limit) lookaheadFrames else 0

  override fun queueInput(inputBuffer: java.nio.ByteBuffer) {
    val bytesRemaining = inputBuffer.remaining()
    if (bytesRemaining == 0) return
    val channels = inputAudioFormat.channelCount
    if (channels <= 0) {
      inputBuffer.position(inputBuffer.limit())
      return
    }
    if (channels != channelCount) prepareState(channels)
    snapshotParameters()

    val input = inputBuffer.order(ByteOrder.LITTLE_ENDIAN)
    val output = replaceOutputBuffer(bytesRemaining).order(ByteOrder.LITTLE_ENDIAN)
    val frameCount = bytesRemaining / inputAudioFormat.bytesPerFrame
    val frame = DoubleArray(channels)

    for (f in 0 until frameCount) {
      smoothedGain += (targetGain - smoothedGain) * gainCoefficient
      var framePeak = 0.0
      for (c in 0 until channels) {
        var x = input.short.toDouble() / Short.MAX_VALUE.toDouble() * smoothedGain
        if (lowCutOn) {
          val y = lowCutAlpha * (lowCutPrevOut[c] + x - lowCutPrevIn[c])
          lowCutPrevIn[c] = x
          lowCutPrevOut[c] = y
          x = y
        }
        if (lowBoostOn) x = lowShelf.run(c, x)
        if (midBoostOn) x = peak.run(c, x)
        if (hiCutOn) x = lowPass.run(c, x)
        frame[c] = x
        framePeak = max(framePeak, abs(x))
      }

      if (!limit) {
        for (c in 0 until channels) output.putShort(toPcm(frame[c]))
        continue
      }

      // The gain this frame needs to sit under the ceiling, pushed into the
      // window; the window's minimum is what the envelope attacks toward.
      val needs = if (framePeak > CEILING) CEILING / framePeak else 1.0
      pushNeeded(needs)
      val target = needed[dequeIdx[dequeHead]]
      envelope += if (target < envelope) (target - envelope) * attackCoefficient else (target - envelope) * releaseCoefficient

      // Out comes the frame that entered the delay line `lookaheadFrames` ago,
      // whose peak the envelope has had the whole look-ahead to prepare for.
      val slot = delayWrite
      for (c in 0 until channels) {
        val delayed = delay[c][slot]
        delay[c][slot] = frame[c]
        output.putShort(toPcm(delayed * envelope))
      }
      delayWrite = (delayWrite + 1) % lookaheadFrames
    }

    inputBuffer.position(inputBuffer.limit())
    output.flip()
  }

  override fun onFlush() {
    prepareState(inputAudioFormat.channelCount)
  }

  override fun onReset() {
    channelCount = 0
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private fun snapshotParameters() {
    targetGain = 10.0.pow(gainDb / 20.0)
    val flags = tonePreset.split("+")
    val nextLowCut = "low-cut" in flags
    val nextLowBoost = "low-boost" in flags
    val nextMidBoost = "mid-boost" in flags
    val nextHiCut = "hi-cut" in flags
    // A stage that just switched on starts from silence, not from stale state.
    if (nextLowCut && !lowCutOn) {
      lowCutPrevIn.fill(0.0)
      lowCutPrevOut.fill(0.0)
    }
    if (nextLowBoost && !lowBoostOn) lowShelf.clear()
    if (nextMidBoost && !midBoostOn) peak.clear()
    if (nextHiCut && !hiCutOn) lowPass.clear()
    lowCutOn = nextLowCut
    lowBoostOn = nextLowBoost
    midBoostOn = nextMidBoost
    hiCutOn = nextHiCut
  }

  private fun prepareState(channels: Int) {
    channelCount = channels
    val sampleRate = inputAudioFormat.sampleRate.toDouble()
    if (channels <= 0 || sampleRate <= 0.0) return

    smoothedGain = 10.0.pow(gainDb / 20.0)
    targetGain = smoothedGain
    gainCoefficient = 1.0 - exp(-1.0 / (sampleRate * GAIN_SMOOTHING_SECONDS))

    val rc = 1.0 / (2.0 * PI * LOW_CUT_HZ)
    val dt = 1.0 / sampleRate
    lowCutAlpha = rc / (rc + dt)
    lowCutPrevIn = DoubleArray(channels)
    lowCutPrevOut = DoubleArray(channels)
    lowShelf.lowShelf(sampleRate, 120.0, 4.0, 0.707, channels)
    peak.peaking(sampleRate, 1800.0, 4.0, 1.0, channels)
    lowPass.lowPass(sampleRate, 7200.0, 0.707, channels)

    lookaheadFrames = max(1, (sampleRate * LOOKAHEAD_SECONDS).toInt())
    delay = Array(channels) { DoubleArray(lookaheadFrames) }
    delayWrite = 0
    windowSize = lookaheadFrames + 1
    needed = DoubleArray(windowSize)
    dequeIdx = IntArray(windowSize)
    dequeHead = 0
    dequeTail = 0
    frameCounter = 0
    envelope = 1.0
    attackCoefficient = 1.0 - exp(-1.0 / (sampleRate * ATTACK_SECONDS))
    releaseCoefficient = 1.0 - exp(-1.0 / (sampleRate * RELEASE_SECONDS))
  }

  /** Push this frame's needed gain and drop what has left the look-ahead window. */
  private fun pushNeeded(value: Double) {
    val n = windowSize
    val slot = (frameCounter % n).toInt()
    // Evict the frame that is `n` frames old: it was output last frame.
    if (dequeTail != dequeHead && dequeIdx[dequeHead] == slot) {
      dequeHead = (dequeHead + 1) % n
    }
    needed[slot] = value
    // Keep the deque increasing: anything larger than the new value can never
    // be the window's minimum again.
    while (dequeTail != dequeHead && needed[dequeIdx[(dequeTail + n - 1) % n]] >= value) {
      dequeTail = (dequeTail + n - 1) % n
    }
    dequeIdx[dequeTail] = slot
    dequeTail = (dequeTail + 1) % n
    frameCounter++
  }

  private fun toPcm(sample: Double): Short =
    (sample.coerceIn(-1.0, 1.0) * Short.MAX_VALUE.toDouble()).toInt().toShort()

  /** One RBJ biquad in direct form 1, per channel. */
  private class Biquad {
    private var b0 = 1.0
    private var b1 = 0.0
    private var b2 = 0.0
    private var a1 = 0.0
    private var a2 = 0.0
    private var x1 = DoubleArray(0)
    private var x2 = DoubleArray(0)
    private var y1 = DoubleArray(0)
    private var y2 = DoubleArray(0)

    fun run(c: Int, x: Double): Double {
      val y = b0 * x + b1 * x1[c] + b2 * x2[c] - a1 * y1[c] - a2 * y2[c]
      x2[c] = x1[c]
      x1[c] = x
      y2[c] = y1[c]
      y1[c] = y
      return y
    }

    fun clear() {
      x1.fill(0.0); x2.fill(0.0); y1.fill(0.0); y2.fill(0.0)
    }

    private fun state(channels: Int) {
      x1 = DoubleArray(channels); x2 = DoubleArray(channels)
      y1 = DoubleArray(channels); y2 = DoubleArray(channels)
    }

    fun lowPass(sampleRate: Double, frequencyHz: Double, q: Double, channels: Int) {
      state(channels)
      val omega = 2.0 * PI * frequencyHz / sampleRate
      val cosOmega = cos(omega)
      val alpha = sin(omega) / (2.0 * q)
      val a0 = 1.0 + alpha
      b0 = ((1.0 - cosOmega) / 2.0) / a0
      b1 = (1.0 - cosOmega) / a0
      b2 = ((1.0 - cosOmega) / 2.0) / a0
      a1 = (-2.0 * cosOmega) / a0
      a2 = (1.0 - alpha) / a0
    }

    fun peaking(sampleRate: Double, frequencyHz: Double, gainDb: Double, q: Double, channels: Int) {
      state(channels)
      val omega = 2.0 * PI * frequencyHz / sampleRate
      val cosOmega = cos(omega)
      val alpha = sin(omega) / (2.0 * q)
      val amp = 10.0.pow(gainDb / 40.0)
      val a0 = 1.0 + alpha / amp
      b0 = (1.0 + alpha * amp) / a0
      b1 = (-2.0 * cosOmega) / a0
      b2 = (1.0 - alpha * amp) / a0
      a1 = (-2.0 * cosOmega) / a0
      a2 = (1.0 - alpha / amp) / a0
    }

    fun lowShelf(sampleRate: Double, frequencyHz: Double, gainDb: Double, q: Double, channels: Int) {
      state(channels)
      val omega = 2.0 * PI * frequencyHz / sampleRate
      val cosOmega = cos(omega)
      val alpha = sin(omega) / (2.0 * q)
      val amp = 10.0.pow(gainDb / 40.0)
      val sqrtTerm = 2.0 * sqrt(amp) * alpha
      val a0 = (amp + 1.0) + (amp - 1.0) * cosOmega + sqrtTerm
      b0 = (amp * ((amp + 1.0) - (amp - 1.0) * cosOmega + sqrtTerm)) / a0
      b1 = (2.0 * amp * ((amp - 1.0) - (amp + 1.0) * cosOmega)) / a0
      b2 = (amp * ((amp + 1.0) - (amp - 1.0) * cosOmega - sqrtTerm)) / a0
      a1 = (-2.0 * ((amp - 1.0) + (amp + 1.0) * cosOmega)) / a0
      a2 = ((amp + 1.0) + (amp - 1.0) * cosOmega - sqrtTerm) / a0
    }
  }

  companion object {
    const val SOUND_GAIN_MIN_DB = -24.0
    const val SOUND_GAIN_MAX_DB = 12.0
    private const val LOW_CUT_HZ = 140.0
    /** -0.45 dBFS: under full scale with room for the 16-bit rounding. */
    private const val CEILING = 0.95
    private const val LOOKAHEAD_SECONDS = 0.005
    private const val ATTACK_SECONDS = 0.001
    private const val RELEASE_SECONDS = 0.15
    /** A level change glides over this, so a slider move never zippers. */
    private const val GAIN_SMOOTHING_SECONDS = 0.02
  }
}
