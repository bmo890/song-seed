package expo.modules.songseedmetronome

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

private data class MetronomeConfig(
  val bpm: Int = 92,
  val meterId: String = "4/4",
  val pulsesPerBar: Int = 4,
  val denominator: Int = 4,
  val accentPattern: List<Double> = listOf(1.0, 0.46, 0.72, 0.46),
  val clickEnabled: Boolean = true,
  val clickVolume: Double = 0.5
)

class SongseedMetronomeEngine(
  private val onBeat: (Map<String, Any>) -> Unit,
  private val onStateChange: (Map<String, Any>) -> Unit,
  private val onCountInComplete: (Map<String, Any>) -> Unit,
  private val onError: (String) -> Unit
) {
  private val sampleRate = 44_100
  private val pollIntervalMs = 8L

  private var config = MetronomeConfig()
  private var audioTrack: AudioTrack? = null
  private var handlerThread: HandlerThread? = null
  private var handler: Handler? = null

  private var isRunning = false
  private var isCountIn = false
  private var countInPulsesRemaining = 0
  private var beatInBar = 1
  private var barNumber = 1
  private var absolutePulse = 0
  private var lastEmittedPulse = -1
  private var startUptimeMs = 0L
  private var loopCount = 0L
  private var lastPlaybackHeadFrames = 0L

  private var framesPerPulse = framesPerPulseForBpm(config.bpm)
  private var totalFrames = framesPerPulse * config.pulsesPerBar

  private val pollRunnable = object : Runnable {
    override fun run() {
      pollBeatProgress()
      handler?.postDelayed(this, pollIntervalMs)
    }
  }

  fun configure(rawConfig: Map<String, Any?>): Map<String, Any> {
    val nextConfig = parseConfig(rawConfig)
    val wasRunning = isRunning
    val pendingCountInBars = if (isCountIn && countInPulsesRemaining > 0) {
      ceil(countInPulsesRemaining.toDouble() / nextConfig.pulsesPerBar.toDouble()).toInt()
    } else {
      0
    }

    config = nextConfig
    framesPerPulse = framesPerPulseForBpm(config.bpm)
    totalFrames = max(1, framesPerPulse * config.pulsesPerBar)

    if (wasRunning) {
      return start(pendingCountInBars)
    }

    releaseAudioTrack()
    val state = getState()
    onStateChange(state)
    return state
  }

  fun start(countInBars: Int): Map<String, Any> {
    stopInternal(releaseTrack = true, emitState = false)

    isRunning = true
    isCountIn = countInBars > 0
    countInPulsesRemaining = max(0, countInBars) * config.pulsesPerBar
    beatInBar = 1
    barNumber = 1
    absolutePulse = 0
    lastEmittedPulse = -1
    loopCount = 0
    lastPlaybackHeadFrames = 0
    startUptimeMs = SystemClock.elapsedRealtime()

    ensureHandler()

    try {
      if (config.clickEnabled) {
        val pcm = buildLoopPcm16(config, framesPerPulse, totalFrames, sampleRate)
        val minBufferSize = AudioTrack.getMinBufferSize(
          sampleRate,
          AudioFormat.CHANNEL_OUT_MONO,
          AudioFormat.ENCODING_PCM_16BIT
        )
        val bufferSizeInBytes = max(minBufferSize, pcm.size)
        val track = AudioTrack(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build(),
          AudioFormat.Builder()
            .setSampleRate(sampleRate)
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
            .build(),
          bufferSizeInBytes,
          AudioTrack.MODE_STATIC,
          AudioManager.AUDIO_SESSION_ID_GENERATE
        )
        track.write(pcm, 0, pcm.size)
        track.setLoopPoints(0, totalFrames, -1)
        track.setVolume(config.clickVolume.toFloat())
        track.play()
        audioTrack = track
      }
    } catch (error: Throwable) {
      onError("Android metronome audio start failed: ${error.message ?: "unknown error"}")
      releaseAudioTrack()
    }

    handler?.post(pollRunnable)
    val state = getState()
    onStateChange(state)
    return state
  }

  fun stop(): Map<String, Any> {
    stopInternal(releaseTrack = true, emitState = true)
    return getState()
  }

  fun getState(): Map<String, Any> {
    return mapOf(
      "isAvailable" to true,
      "isRunning" to isRunning,
      "isCountIn" to isCountIn,
      "bpm" to config.bpm,
      "meterId" to config.meterId,
      "pulsesPerBar" to config.pulsesPerBar,
      "denominator" to config.denominator,
      "clickEnabled" to config.clickEnabled,
      "clickVolume" to config.clickVolume,
      "beatIntervalMs" to beatIntervalMsForBpm(config.bpm),
      "beatInBar" to beatInBar,
      "barNumber" to barNumber,
      "absolutePulse" to absolutePulse,
      "countInBarsRemaining" to countInBarsRemaining(),
    )
  }

  private fun stopInternal(releaseTrack: Boolean, emitState: Boolean) {
    handler?.removeCallbacks(pollRunnable)
    isRunning = false
    isCountIn = false
    countInPulsesRemaining = 0
    beatInBar = 1
    barNumber = 1
    absolutePulse = 0
    lastEmittedPulse = -1
    loopCount = 0
    lastPlaybackHeadFrames = 0
    startUptimeMs = 0L

    if (releaseTrack) {
      releaseAudioTrack()
    }

    if (emitState) {
      onStateChange(getState())
    }
  }

  private fun ensureHandler() {
    if (handlerThread == null) {
      handlerThread = HandlerThread("SongseedMetronome").also { thread ->
        thread.start()
        handler = Handler(thread.looper)
      }
    }
  }

  private fun releaseAudioTrack() {
    try {
      audioTrack?.pause()
      audioTrack?.flush()
      audioTrack?.stop()
    } catch (_: Throwable) {
    }
    try {
      audioTrack?.release()
    } catch (_: Throwable) {
    }
    audioTrack = null
  }

  private fun pollBeatProgress() {
    if (!isRunning) {
      return
    }

    val pulseOrdinal = if (config.clickEnabled && audioTrack != null) {
      val track = audioTrack ?: return
      val currentPlaybackHeadFrames = track.playbackHeadPosition.toLong() and 0xffffffffL
      if (currentPlaybackHeadFrames + framesPerPulse < lastPlaybackHeadFrames) {
        loopCount += 1
      }
      lastPlaybackHeadFrames = currentPlaybackHeadFrames
      val absoluteFrames = loopCount * totalFrames + currentPlaybackHeadFrames
      floor(absoluteFrames.toDouble() / framesPerPulse.toDouble()).toInt()
    } else {
      val elapsedMs = max(0L, SystemClock.elapsedRealtime() - startUptimeMs).toDouble()
      floor(elapsedMs / beatIntervalMsForBpm(config.bpm)).toInt()
    }

    if (pulseOrdinal <= lastEmittedPulse) {
      return
    }

    for (nextPulse in (lastEmittedPulse + 1)..pulseOrdinal) {
      emitBeat(nextPulse)
    }
  }

  private fun emitBeat(pulseOrdinal: Int) {
    lastEmittedPulse = pulseOrdinal
    absolutePulse = pulseOrdinal
    beatInBar = (pulseOrdinal % config.pulsesPerBar) + 1
    barNumber = (pulseOrdinal / config.pulsesPerBar) + 1

    val accent = config.accentPattern[(beatInBar - 1).coerceAtMost(config.accentPattern.lastIndex)]
    val barsRemainingBeforeBeat = countInBarsRemaining()

    onBeat(
      mapOf(
        "beatInBar" to beatInBar,
        "barNumber" to barNumber,
        "absolutePulse" to absolutePulse,
        "isDownbeat" to (beatInBar == 1),
        "accent" to accent,
        "isCountIn" to isCountIn,
        "countInBarsRemaining" to barsRemainingBeforeBeat,
        "timestampMs" to System.currentTimeMillis()
      )
    )

    if (isCountIn && countInPulsesRemaining > 0) {
      countInPulsesRemaining -= 1
      if (countInPulsesRemaining <= 0) {
        isCountIn = false
        onCountInComplete(
          mapOf(
            "timestampMs" to System.currentTimeMillis()
          )
        )
      }
    }

    onStateChange(getState())
  }

  private fun countInBarsRemaining(): Int {
    if (!isCountIn || countInPulsesRemaining <= 0) {
      return 0
    }
    return ceil(countInPulsesRemaining.toDouble() / config.pulsesPerBar.toDouble()).toInt()
  }

  private fun parseConfig(rawConfig: Map<String, Any?>): MetronomeConfig {
    val bpm = (rawConfig["bpm"] as? Number)?.toInt()?.coerceIn(40, 240) ?: config.bpm
    val meterId = rawConfig["meterId"] as? String ?: config.meterId
    val pulsesPerBar = max(1, (rawConfig["pulsesPerBar"] as? Number)?.toInt() ?: config.pulsesPerBar)
    val denominator = max(1, (rawConfig["denominator"] as? Number)?.toInt() ?: config.denominator)
    val accentPattern = ((rawConfig["accentPattern"] as? List<*>)?.mapNotNull {
      (it as? Number)?.toDouble()
    }?.takeIf { it.isNotEmpty() } ?: config.accentPattern).map { min(1.0, max(0.0, it)) }
    val clickEnabled = rawConfig["clickEnabled"] as? Boolean ?: config.clickEnabled
    val clickVolume = (rawConfig["clickVolume"] as? Number)?.toDouble()?.coerceIn(0.0, 1.0)
      ?: config.clickVolume

    return MetronomeConfig(
      bpm = bpm,
      meterId = meterId,
      pulsesPerBar = pulsesPerBar,
      denominator = denominator,
      accentPattern = accentPattern,
      clickEnabled = clickEnabled,
      clickVolume = clickVolume
    )
  }

  private fun beatIntervalMsForBpm(bpm: Int): Double {
    return 60_000.0 / bpm.toDouble()
  }

  private fun framesPerPulseForBpm(bpm: Int): Int {
    return max(1, (sampleRate * beatIntervalMsForBpm(bpm) / 1000.0).roundToInt())
  }
}

private fun buildLoopPcm16(
  config: MetronomeConfig,
  framesPerPulse: Int,
  totalFrames: Int,
  sampleRate: Int
): ByteArray {
  val clickDurationFrames = min(totalFrames, max(1, (sampleRate * 0.034).roundToInt()))
  val attackFrames = max(1, (sampleRate * 0.003).roundToInt())
  val pcm = ShortArray(totalFrames)

  for (pulseIndex in 0 until config.pulsesPerBar) {
    val accent = config.accentPattern[pulseIndex.coerceAtMost(config.accentPattern.lastIndex)]
    val startFrame = pulseIndex * framesPerPulse
    val baseFrequency = if (pulseIndex == 0) 1960.0 else 1560.0
    val overtoneFrequency = if (pulseIndex == 0) 2940.0 else 2350.0
    val amplitude = 0.22 + accent * 0.46

    for (frameIndex in 0 until clickDurationFrames) {
      val absoluteFrame = startFrame + frameIndex
      if (absoluteFrame >= totalFrames) {
        break
      }

      val sampleTime = frameIndex.toDouble() / sampleRate.toDouble()
      val attack = min(1.0, frameIndex.toDouble() / attackFrames.toDouble())
      val decay = Math.pow(1.0 - frameIndex.toDouble() / clickDurationFrames.toDouble(), if (pulseIndex == 0) 2.8 else 2.4)
      val envelope = attack * decay
      val sample =
        (sin(2.0 * Math.PI * baseFrequency * sampleTime) * 0.78 +
          sin(2.0 * Math.PI * overtoneFrequency * sampleTime) * 0.22) *
          amplitude *
          envelope

      val mixed = (pcm[absoluteFrame] / Short.MAX_VALUE.toDouble()) + sample
      val clamped = min(1.0, max(-1.0, mixed))
      pcm[absoluteFrame] = (clamped * Short.MAX_VALUE).roundToInt().toShort()
    }
  }

  val bytes = ByteArray(pcm.size * 2)
  for (index in pcm.indices) {
    val sample = pcm[index].toInt()
    bytes[index * 2] = (sample and 0xff).toByte()
    bytes[index * 2 + 1] = ((sample shr 8) and 0xff).toByte()
  }
  return bytes
}
