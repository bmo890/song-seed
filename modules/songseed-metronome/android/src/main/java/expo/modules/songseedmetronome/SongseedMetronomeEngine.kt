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
  val clickVolume: Double = 0.5,
  /** Output latency (ms) of the active route. Delays only the visual beat so it lands
   *  with the audible click (e.g. Bluetooth lag). 0 = immediate / no compensation. */
  val outputLatencyMs: Int = 0
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

  // Keep the BAR sample-exact for the nominal BPM (Bresenham: pulse boundaries are
  // round(k · exact), so per-pulse rounding error never accumulates). A uniformly rounded
  // framesPerPulse quantizes the tempo and drifts several ms/minute against an external
  // metronome or DAW set to the same BPM.
  private var exactFramesPerPulse = exactFramesPerPulseForBpm(config.bpm)
  private var framesPerPulse = framesPerPulseForBpm(config.bpm)
  private var totalFrames = (exactFramesPerPulse * config.pulsesPerBar).roundToInt()

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

    val previous = config
    config = nextConfig

    // Live params (volume) must never restart a running engine — a restart resets the
    // beat phase, which is audible and breaks grid continuity mid-take. Only structural
    // changes (tempo, meter, accent shape, click on/off) rebuild and rephase.
    val structuralChange =
      previous.bpm != config.bpm ||
        previous.meterId != config.meterId ||
        previous.pulsesPerBar != config.pulsesPerBar ||
        previous.denominator != config.denominator ||
        previous.accentPattern != config.accentPattern ||
        previous.clickEnabled != config.clickEnabled

    if (!structuralChange) {
      try {
        audioTrack?.setVolume(config.clickVolume.toFloat())
      } catch (_: Throwable) {
      }
      val state = getState()
      onStateChange(state)
      return state
    }

    exactFramesPerPulse = exactFramesPerPulseForBpm(config.bpm)
    framesPerPulse = framesPerPulseForBpm(config.bpm)
    totalFrames = max(1, (exactFramesPerPulse * config.pulsesPerBar).roundToInt())

    if (wasRunning) {
      return start(pendingCountInBars)
    }

    releaseAudioTrack()
    val state = getState()
    onStateChange(state)
    return state
  }

  /** Apply click volume live, without touching the running grid. */
  fun setClickVolume(volume: Double): Map<String, Any> {
    config = config.copy(clickVolume = min(1.0, max(0.0, volume)))
    try {
      audioTrack?.setVolume(config.clickVolume.toFloat())
    } catch (_: Throwable) {
    }
    return getState()
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
        val pcm = buildLoopPcm16(config, exactFramesPerPulse, totalFrames, sampleRate)
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

  /**
   * Best-effort output latency (ms) of the active route via the hidden
   * `AudioTrack#getLatency()` — the only Android API that folds in the A2DP sink delay on
   * devices that report it. Hidden-API access can be denied (OEM/AOSP greylist), so this
   * returns null on any failure and callers must treat null as "unknown", not zero.
   * Reuses the live click track when running; otherwise probes with a throwaway track.
   */
  fun currentOutputLatencyMs(): Int? {
    val existing = audioTrack
    val track = existing ?: buildProbeTrack() ?: return null
    return try {
      val method = AudioTrack::class.java.getMethod("getLatency")
      val rawLatencyMs = (method.invoke(track) as? Int) ?: return null
      // getLatency() folds the track's OWN buffer into the number. For the live
      // MODE_STATIC click loop that buffer is a whole bar (2s+ at slow tempos) — strip
      // it to recover the actual sink latency. The throwaway probe's MODE_STREAM buffer
      // is a few ms and is a fair part of real playback latency, so it stays.
      val bufferMs = if (existing != null) {
        (totalFrames.toDouble() / sampleRate.toDouble() * 1000.0).roundToInt()
      } else {
        0
      }
      (rawLatencyMs - bufferMs).takeIf { it in 1..600 }
    } catch (_: Throwable) {
      null
    } finally {
      if (existing == null) {
        try {
          track.release()
        } catch (_: Throwable) {
        }
      }
    }
  }

  private fun buildProbeTrack(): AudioTrack? {
    return try {
      val minBufferSize = AudioTrack.getMinBufferSize(
        sampleRate,
        AudioFormat.CHANNEL_OUT_MONO,
        AudioFormat.ENCODING_PCM_16BIT
      )
      if (minBufferSize <= 0) {
        return null
      }
      AudioTrack(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build(),
        AudioFormat.Builder()
          .setSampleRate(sampleRate)
          .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
          .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
          .build(),
        minBufferSize,
        AudioTrack.MODE_STREAM,
        AudioManager.AUDIO_SESSION_ID_GENERATE
      )
    } catch (_: Throwable) {
      null
    }
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
      floor(absoluteFrames.toDouble() / exactFramesPerPulse).toInt()
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

    val beatPayload = mapOf(
      "beatInBar" to beatInBar,
      "barNumber" to barNumber,
      "absolutePulse" to absolutePulse,
      "isDownbeat" to (beatInBar == 1),
      "accent" to accent,
      "isCountIn" to isCountIn,
      "countInBarsRemaining" to barsRemainingBeforeBeat,
      "timestampMs" to System.currentTimeMillis()
    )
    // Delay only the visual/haptic beat event by the configured output latency so the
    // on-screen beat lands with the audible click. The audio itself is untouched.
    val latency = config.outputLatencyMs.toLong()
    if (latency > 0L) {
      handler?.postDelayed({ if (isRunning) onBeat(beatPayload) }, latency)
    } else {
      onBeat(beatPayload)
    }

    // Snapshot state for *this* beat before flipping isCountIn off below, so the final count-in
    // beat (e.g. dot 4 of 4) still reports isCountIn=true and gets a chance to render before the
    // UI transitions to "recording" on the next beat.
    onStateChange(getState())

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
    val outputLatencyMs = (rawConfig["outputLatencyMs"] as? Number)?.toInt()?.coerceIn(0, 1000)
      ?: config.outputLatencyMs

    return MetronomeConfig(
      bpm = bpm,
      meterId = meterId,
      pulsesPerBar = pulsesPerBar,
      denominator = denominator,
      accentPattern = accentPattern,
      clickEnabled = clickEnabled,
      clickVolume = clickVolume,
      outputLatencyMs = outputLatencyMs
    )
  }

  private fun beatIntervalMsForBpm(bpm: Int): Double {
    return 60_000.0 / bpm.toDouble()
  }

  private fun exactFramesPerPulseForBpm(bpm: Int): Double {
    return max(1.0, sampleRate * beatIntervalMsForBpm(bpm) / 1000.0)
  }

  private fun framesPerPulseForBpm(bpm: Int): Int {
    return max(1, exactFramesPerPulseForBpm(bpm).roundToInt())
  }

  /**
   * One anchor instead of an event stream: the epoch time of pulse 0 (grid t=0), plus the
   * exact pulse spacing. Everything else — current beat, time-to-next-downbeat, count-in
   * progress, UI cue scheduling — derives from this without racing bridge events. When the
   * click is audible the anchor comes from the audio clock (playback head position);
   * silent runs fall back to the uptime clock.
   */
  fun getGridAnchor(): Map<String, Any> {
    if (!isRunning) {
      return mapOf("isRunning" to false)
    }

    val nowEpochMs = System.currentTimeMillis().toDouble()
    val track = audioTrack
    val anchorEpochMs = if (config.clickEnabled && track != null) {
      val currentPlaybackHeadFrames = track.playbackHeadPosition.toLong() and 0xffffffffL
      val absoluteFrames = loopCount * totalFrames + currentPlaybackHeadFrames
      nowEpochMs - absoluteFrames.toDouble() / sampleRate.toDouble() * 1000.0
    } else {
      val elapsedMs = max(0L, SystemClock.elapsedRealtime() - startUptimeMs).toDouble()
      nowEpochMs - elapsedMs
    }

    return mapOf(
      "isRunning" to true,
      "isCountIn" to isCountIn,
      "anchorEpochMs" to anchorEpochMs,
      "msPerPulse" to beatIntervalMsForBpm(config.bpm),
      "pulsesPerBar" to config.pulsesPerBar,
      "countInPulsesRemaining" to countInPulsesRemaining,
      "absolutePulse" to absolutePulse,
    )
  }
}

private fun buildLoopPcm16(
  config: MetronomeConfig,
  exactFramesPerPulse: Double,
  totalFrames: Int,
  sampleRate: Int
): ByteArray {
  val clickDurationFrames = min(totalFrames, max(1, (sampleRate * 0.034).roundToInt()))
  val attackFrames = max(1, (sampleRate * 0.003).roundToInt())
  val pcm = ShortArray(totalFrames)

  for (pulseIndex in 0 until config.pulsesPerBar) {
    val accent = config.accentPattern[pulseIndex.coerceAtMost(config.accentPattern.lastIndex)]
    val startFrame = (pulseIndex * exactFramesPerPulse).roundToInt()
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
