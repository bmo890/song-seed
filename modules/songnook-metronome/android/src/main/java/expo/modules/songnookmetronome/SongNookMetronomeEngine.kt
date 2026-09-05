package expo.modules.songnookmetronome

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
  val outputLatencyMs: Int = 0,
  /** Native scheduled haptics: fired from the engine (no bridge at fire time), offset by
   *  `hapticOffsetMs` relative to the render-domain beat so the buzz LANDS with the
   *  audible click (signed: route latency − motor spin-up; may be negative). */
  val hapticEnabled: Boolean = false,
  val hapticStrength: Double = 0.6,
  val hapticOffsetMs: Int = 0,
  /** Audio-only ornament: each pulse is split into `subdivision` equal parts and the extra
   *  onsets sound as quiet weak-voice sub-clicks. Beat events, the grid anchor, count-in
   *  math and haptics never see them — they are pure PCM. */
  val subdivision: Int = 1,
  /** Click timbre: "click" (bright stock voice) or "wood" (softer wood-block voice). */
  val clickVoice: String = "click"
)

/** One click timbre. The same table lives in the iOS engine and the JS WAV fallback —
 *  keep the three verbatim so every surface sounds identical. */
private data class ClickVoiceSpec(
  val baseFrequency: Double,
  val overtoneFrequency: Double,
  val decayPower: Double,
  val mixBase: Double,
  val mixOvertone: Double,
  val durationSec: Double,
  val attackSec: Double,
  val amplitudeBase: Double,
  val amplitudeScale: Double
) {
  fun amplitude(accent: Double): Double = amplitudeBase + accent * amplitudeScale
}

private fun clickVoiceSpec(voice: String, isDownbeat: Boolean): ClickVoiceSpec {
  if (voice == "wood") {
    return if (isDownbeat) {
      ClickVoiceSpec(1180.0, 1770.0, 3.2, 0.70, 0.30, 0.046, 0.0015, 0.26, 0.50)
    } else {
      ClickVoiceSpec(880.0, 1320.0, 2.9, 0.70, 0.30, 0.046, 0.0015, 0.26, 0.50)
    }
  }
  return if (isDownbeat) {
    ClickVoiceSpec(1960.0, 2940.0, 2.8, 0.78, 0.22, 0.034, 0.003, 0.22, 0.46)
  } else {
    ClickVoiceSpec(1560.0, 2350.0, 2.4, 0.78, 0.22, 0.034, 0.003, 0.22, 0.46)
  }
}

/** Weight of every sub-click: quiet and present, well under a weak beat. */
private const val SUB_CLICK_ACCENT = 0.18

private fun clickFramesFor(spec: ClickVoiceSpec, sampleRate: Int): Int =
  max(1, (sampleRate * spec.durationSec).roundToInt())

/** Additively mix one click (voice + amplitude) into `pcm` at `onset`, truncated at `totalFrames`. */
private fun mixClick(
  pcm: ShortArray,
  onset: Int,
  spec: ClickVoiceSpec,
  amplitude: Double,
  totalFrames: Int,
  sampleRate: Int
) {
  val clickFrames = min(totalFrames, clickFramesFor(spec, sampleRate))
  val attackFrames = max(1, (sampleRate * spec.attackSec).roundToInt())
  for (frameIndex in 0 until clickFrames) {
    val absoluteFrame = onset + frameIndex
    if (absoluteFrame < 0) continue
    if (absoluteFrame >= totalFrames) break
    val sampleTime = frameIndex.toDouble() / sampleRate.toDouble()
    val attack = min(1.0, frameIndex.toDouble() / attackFrames.toDouble())
    val decay = Math.pow(1.0 - frameIndex.toDouble() / clickFrames.toDouble(), spec.decayPower)
    val sample =
      (sin(2.0 * Math.PI * spec.baseFrequency * sampleTime) * spec.mixBase +
        sin(2.0 * Math.PI * spec.overtoneFrequency * sampleTime) * spec.mixOvertone) *
        amplitude * attack * decay
    val mixed = (pcm[absoluteFrame] / Short.MAX_VALUE.toDouble()) + sample
    pcm[absoluteFrame] = (mixed.coerceIn(-1.0, 1.0) * Short.MAX_VALUE).roundToInt().toShort()
  }
}

/** One constant-tempo stretch of a tempo map, precomputed in grid frames.
 *  Grid zero = the downbeat of bar 1; count-in pulses live at negative grid frames. */
private data class MapSegment(
  val atBar: Int,
  val bpm: Int,
  val pulsesPerBar: Int,
  val accentPattern: List<Double>,
  val startGridPulse: Int,
  val startFrame: Double,
  val exactFramesPerPulse: Double
)

class SongNookMetronomeEngine(
  private val onBeat: (Map<String, Any>) -> Unit,
  private val onStateChange: (Map<String, Any>) -> Unit,
  private val onCountInComplete: (Map<String, Any>) -> Unit,
  private val onError: (String) -> Unit,
  /** Fires the platform vibrator with a 0..1 strength — injected by the module (it owns
   *  the Context). Called from the engine's handler thread at the scheduled time. */
  private val triggerHaptic: (Double) -> Unit = {}
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

  // ── Tempo-map mode (streamed clicks) ──────────────────────────────────────
  // When `mapSegments` is set, the engine streams rendered audio instead of looping a
  // static bar: the writer keeps ~100ms ahead of the playback head, placing each click
  // at its exact frame along the map — changes land seamlessly at their bar lines.
  private var mapSegments: List<MapSegment>? = null
  /** Grid frame at which THIS RUN began (count-in start → negative; phase start → offset). */
  private var runStartGridFrame = 0.0
  /** Grid pulse index of run pulse 0 (the first pulse this run sounds). */
  private var firstRunGridPulse = 0
  /** Frames already written to the streaming track (its own timeline starts at 0). */
  private var mapWriteFrame = 0L
  private val mapChunkFrames = 2048
  private val mapAheadFrames = 6615 // ~150ms of schedule-ahead
  /** Longest click the current voice renders — the chunk lookback must cover it. */
  private val mapClickFrames: Int
    get() = clickFramesFor(clickVoiceSpec(config.clickVoice, isDownbeat = true), sampleRate)

  private val mapWriterRunnable = object : Runnable {
    override fun run() {
      writeMapChunks()
      if (isRunning && mapSegments != null && config.clickEnabled) {
        handler?.postDelayed(this, pollIntervalMs)
      }
    }
  }

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
        previous.clickEnabled != config.clickEnabled ||
        previous.subdivision != config.subdivision ||
        previous.clickVoice != config.clickVoice

    if (!structuralChange) {
      try {
        audioTrack?.setVolume(config.clickVolume.toFloat())
      } catch (_: Throwable) {
      }
      val state = getState()
      onStateChange(state)
      return state
    }

    // A structural configure() is the single-tempo world talking (the standalone
    // metronome's controls) — an installed map is stale the moment it happens.
    mapSegments = null

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

  // ── Tempo-map mode ─────────────────────────────────────────────────────────

  /** Install a tempo map (bar-anchored segments, first at bar 1). See the iOS twin. */
  fun configureTempoMap(rawSegments: List<Map<String, Any?>>): Map<String, Any> {
    val segments = mutableListOf<MapSegment>()
    for (raw in rawSegments) {
      val atBar = (raw["atBar"] as? Number)?.toInt() ?: continue
      val bpm = ((raw["bpm"] as? Number)?.toInt() ?: continue).coerceIn(40, 240)
      val pulsesPerBar = (raw["pulsesPerBar"] as? Number)?.toInt()?.takeIf { it > 0 } ?: continue
      val accents = ((raw["accentPattern"] as? List<*>)?.mapNotNull { (it as? Number)?.toDouble() })
        ?.map { it.coerceIn(0.0, 1.0) }
        ?.takeIf { it.isNotEmpty() } ?: listOf(1.0)
      val efpp = max(1.0, sampleRate * 60_000.0 / bpm / 1000.0)
      val previous = segments.lastOrNull()
      val barsSincePrevious = previous?.let { (atBar - it.atBar).toDouble() } ?: 0.0
      segments.add(
        MapSegment(
          atBar = max(1, atBar),
          bpm = bpm,
          pulsesPerBar = pulsesPerBar,
          accentPattern = accents,
          startGridPulse = previous?.let { it.startGridPulse + barsSincePrevious.toInt() * it.pulsesPerBar } ?: 0,
          startFrame = previous?.let { it.startFrame + barsSincePrevious * it.exactFramesPerPulse * it.pulsesPerBar } ?: 0.0,
          exactFramesPerPulse = efpp
        )
      )
    }
    mapSegments = segments.ifEmpty { null }
    return getState()
  }

  fun clearTempoMap(): Map<String, Any> {
    mapSegments = null
    return getState()
  }

  private fun mapSegmentForGridPulse(gridPulse: Int): MapSegment {
    val segments = mapSegments!!
    var active = segments[0]
    for (segment in segments) {
      if (segment.startGridPulse <= gridPulse) active = segment else break
    }
    return active
  }

  private fun mapFrameOfGridPulse(gridPulse: Int): Double {
    val segments = mapSegments!!
    if (gridPulse < 0) return gridPulse * segments[0].exactFramesPerPulse
    val segment = mapSegmentForGridPulse(gridPulse)
    return segment.startFrame + (gridPulse - segment.startGridPulse) * segment.exactFramesPerPulse
  }

  private fun mapGridPulseAtFrame(frame: Double): Int {
    val segments = mapSegments!!
    if (frame < 0) return floor(frame / segments[0].exactFramesPerPulse).toInt()
    var active = segments[0]
    for (segment in segments) {
      if (segment.startFrame <= frame + 0.5) active = segment else break
    }
    return active.startGridPulse + floor((frame - active.startFrame) / active.exactFramesPerPulse).toInt()
  }

  /** Beat metadata for a grid pulse: beatInBar / barNumber / accent / pulsesPerBar. */
  private fun mapPulseMeta(gridPulse: Int): Array<Any> {
    val segments = mapSegments!!
    if (gridPulse < 0) {
      val ppb = segments[0].pulsesPerBar
      val position = ((gridPulse % ppb) + ppb) % ppb
      val accents = segments[0].accentPattern
      return arrayOf(position + 1, 1, accents[min(position, accents.lastIndex)], ppb)
    }
    val segment = mapSegmentForGridPulse(gridPulse)
    val pulsesInto = gridPulse - segment.startGridPulse
    val beat = pulsesInto % segment.pulsesPerBar + 1
    val bar = segment.atBar + pulsesInto / segment.pulsesPerBar
    return arrayOf(beat, bar, segment.accentPattern[min(beat - 1, segment.accentPattern.lastIndex)], segment.pulsesPerBar)
  }

  private fun startMapRun(countInPulses: Int, gridOffsetMs: Double): Map<String, Any> {
    stopInternal(releaseTrack = true, emitState = false)

    isRunning = true
    isCountIn = countInPulses > 0
    countInPulsesRemaining = max(0, countInPulses)
    beatInBar = 1
    barNumber = 1
    absolutePulse = 0
    lastEmittedPulse = -1
    mapWriteFrame = 0
    lastPlaybackHeadFrames = 0
    loopCount = 0

    val segments = mapSegments!!
    if (countInPulses > 0) {
      runStartGridFrame = -countInPulses * segments[0].exactFramesPerPulse
      firstRunGridPulse = -countInPulses
    } else {
      runStartGridFrame = max(0.0, gridOffsetMs) / 1000.0 * sampleRate
      var pulse = mapGridPulseAtFrame(runStartGridFrame)
      if (mapFrameOfGridPulse(pulse) < runStartGridFrame - 1) pulse += 1
      firstRunGridPulse = pulse
    }
    startUptimeMs = SystemClock.elapsedRealtime()

    ensureHandler()

    try {
      if (config.clickEnabled) {
        val minBufferSize = AudioTrack.getMinBufferSize(
          sampleRate,
          AudioFormat.CHANNEL_OUT_MONO,
          AudioFormat.ENCODING_PCM_16BIT
        )
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
          max(minBufferSize, mapAheadFrames * 2 * 2),
          AudioTrack.MODE_STREAM,
          AudioManager.AUDIO_SESSION_ID_GENERATE
        )
        track.setVolume(config.clickVolume.toFloat())
        track.play()
        audioTrack = track
        writeMapChunks()
        handler?.post(mapWriterRunnable)
      }
    } catch (error: Throwable) {
      onError("Android metronome map start failed: ${error.message ?: "unknown error"}")
      releaseAudioTrack()
    }

    handler?.post(pollRunnable)
    val state = getState()
    onStateChange(state)
    return state
  }

  /** Keep the stream ~150ms ahead of the head, placing clicks at their exact frames. */
  private fun writeMapChunks() {
    val track = audioTrack ?: return
    if (!isRunning || mapSegments == null || !config.clickEnabled) return
    val head = track.playbackHeadPosition.toLong() and 0xffffffffL
    var guard = 0
    while (mapWriteFrame - head < mapAheadFrames && guard < 16) {
      val chunk = renderMapChunk(mapWriteFrame, mapChunkFrames)
      try {
        track.write(chunk, 0, chunk.size)
      } catch (_: Throwable) {
        return
      }
      mapWriteFrame += mapChunkFrames
      guard += 1
    }
  }

  /** Render `frames` of the run timeline starting at run frame `startFrame` (PCM16). */
  private fun renderMapChunk(startFrame: Long, frames: Int): ByteArray {
    val pcm = ShortArray(frames)
    val chunkGridStart = runStartGridFrame + startFrame
    val chunkGridEnd = chunkGridStart + frames
    // Pulses whose click could overlap this chunk (click length back from the start). A
    // pulse's sub-clicks all lie before the NEXT pulse's onset, so this range covers them too.
    val clickFrames = mapClickFrames
    var pulse = mapGridPulseAtFrame(chunkGridStart - clickFrames)
    val lastPulse = mapGridPulseAtFrame(chunkGridEnd) + 1
    val weakSpec = clickVoiceSpec(config.clickVoice, isDownbeat = false)
    val subdivision = max(1, config.subdivision)
    while (pulse <= lastPulse) {
      if (pulse < firstRunGridPulse) {
        pulse += 1
        continue
      }
      val meta = mapPulseMeta(pulse)
      val isDownbeat = meta[0] as Int == 1
      val accent = meta[2] as Double
      // Accent 0 is a rest, not a quiet click — the calibration screen leans on this to
      // render gap patterns on the real click pipeline. A rest has no sub-clicks either.
      if (accent <= 0.0) {
        pulse += 1
        continue
      }
      val clickGridStart = mapFrameOfGridPulse(pulse)
      val mainSpec = clickVoiceSpec(config.clickVoice, isDownbeat)
      // Sub-clicks ride the pulse's own segment spacing: segments are bar-aligned, so the
      // gap to the next pulse always equals this segment's spacing — including the last
      // pulse before a tempo change.
      val framesPerPulse =
        if (pulse < 0) mapSegments!![0].exactFramesPerPulse
        else mapSegmentForGridPulse(pulse).exactFramesPerPulse
      for (step in 0 until subdivision) {
        val onset = clickGridStart + step * framesPerPulse / subdivision
        val spec = if (step == 0) mainSpec else weakSpec
        val amplitude = if (step == 0) mainSpec.amplitude(accent) else weakSpec.amplitude(SUB_CLICK_ACCENT)
        val onsetFrames = clickFramesFor(spec, sampleRate)
        val attackFrames = max(1, (sampleRate * spec.attackSec).roundToInt())
        // Straddle-safe: start at the chunk edge if the onset is behind it, stop at its end.
        var frameIndex = max(0, (chunkGridStart - onset).toInt())
        while (frameIndex < onsetFrames) {
          val absoluteGridFrame = onset + frameIndex
          if (absoluteGridFrame >= chunkGridEnd) break
          val chunkIndex = (absoluteGridFrame - chunkGridStart).toInt()
          if (chunkIndex in 0 until frames) {
            val sampleTime = frameIndex.toDouble() / sampleRate
            val attack = min(1.0, frameIndex.toDouble() / attackFrames)
            val decay = Math.pow(1.0 - frameIndex.toDouble() / onsetFrames, spec.decayPower)
            val sample =
              (sin(2.0 * Math.PI * spec.baseFrequency * sampleTime) * spec.mixBase +
                sin(2.0 * Math.PI * spec.overtoneFrequency * sampleTime) * spec.mixOvertone) *
                amplitude * attack * decay
            val mixed = (pcm[chunkIndex] / Short.MAX_VALUE.toDouble()) + sample
            pcm[chunkIndex] = (mixed.coerceIn(-1.0, 1.0) * Short.MAX_VALUE).roundToInt().toShort()
          }
          frameIndex += 1
        }
      }
      pulse += 1
    }

    val bytes = ByteArray(pcm.size * 2)
    for (index in pcm.indices) {
      val sample = pcm[index].toInt()
      bytes[index * 2] = (sample and 0xff).toByte()
      bytes[index * 2 + 1] = ((sample shr 8) and 0xff).toByte()
    }
    return bytes
  }

  fun start(countInBars: Int): Map<String, Any> {
    mapSegments?.let { segments ->
      return startMapRun(max(0, countInBars) * max(segments[0].pulsesPerBar, 1), 0.0)
    }
    return startInternal(countInBars = countInBars, phaseOffsetMs = 0.0)
  }

  /**
   * Start the click mid-bar: `phaseOffsetMs` (wall-clock, wrapped into one bar) becomes
   * the loop position of the first rendered sample, so a playback click can join an
   * already-moving take exactly in phase. No count-in, no pulse-0 haptic (the start is
   * mid-bar by definition — cues self-correct from the next beat via emitBeat).
   */
  fun startAtPhase(offsetMs: Double): Map<String, Any> {
    mapSegments?.let {
      // Map mode: the offset is a position along the WHOLE grid, not within one bar.
      return startMapRun(0, max(0.0, offsetMs))
    }
    return startInternal(countInBars = 0, phaseOffsetMs = max(0.0, offsetMs))
  }

  private fun startInternal(countInBars: Int, phaseOffsetMs: Double): Map<String, Any> {
    stopInternal(releaseTrack = true, emitState = false)

    val phaseFrames = if (phaseOffsetMs > 0.0 && totalFrames > 0) {
      ((phaseOffsetMs / 1000.0 * sampleRate).roundToInt() % totalFrames).coerceAtLeast(0)
    } else {
      0
    }
    val initialPulse = floor(phaseFrames.toDouble() / exactFramesPerPulse).toInt()

    isRunning = true
    isCountIn = countInBars > 0
    countInPulsesRemaining = max(0, countInBars) * config.pulsesPerBar
    // The pulse we start inside has already sounded its onset — never re-emit it.
    absolutePulse = initialPulse
    lastEmittedPulse = if (phaseFrames > 0) initialPulse else -1
    beatInBar = (initialPulse % config.pulsesPerBar) + 1
    barNumber = 1
    loopCount = 0
    // The static track reports the REAL head (which starts at phaseFrames), so the
    // audio-clock path needs no extra offset; back-date only the silent-run clock.
    lastPlaybackHeadFrames = phaseFrames.toLong()
    startUptimeMs = SystemClock.elapsedRealtime() -
      (phaseFrames.toDouble() / sampleRate.toDouble() * 1000.0).toLong()

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
        if (phaseFrames > 0) {
          track.playbackHeadPosition = phaseFrames
        }
        track.setVolume(config.clickVolume.toFloat())
        track.play()
        audioTrack = track
      }
    } catch (error: Throwable) {
      onError("Android metronome audio start failed: ${error.message ?: "unknown error"}")
      releaseAudioTrack()
    }

    // Pulse 0's haptic can't be scheduled from a previous beat — aim it at "now + offset"
    // (audio starts near-immediately from the pre-written static buffer); pulses 1+
    // self-correct off the audio clock via emitBeat. Mid-bar phase starts skip it.
    if (config.hapticEnabled && phaseFrames == 0) {
      scheduleHaptic(max(1L, config.hapticOffsetMs.toLong()))
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
      // MODE_STATIC click loop that buffer is a whole bar (2s+ at slow tempos); for the
      // throwaway probe it's the MODE_STREAM min buffer (~80-100ms — device logs showed
      // 209ms reported on a route whose real sink latency is 108ms). Strip whichever
      // applies to recover the actual route latency.
      val bufferMs = if (existing != null) {
        (totalFrames.toDouble() / sampleRate.toDouble() * 1000.0).roundToInt()
      } else {
        val minBufferBytes = AudioTrack.getMinBufferSize(
          sampleRate,
          AudioFormat.CHANNEL_OUT_MONO,
          AudioFormat.ENCODING_PCM_16BIT
        )
        if (minBufferBytes > 0) {
          // PCM16 mono → 2 bytes per frame.
          ((minBufferBytes / 2).toDouble() / sampleRate.toDouble() * 1000.0).roundToInt()
        } else {
          0
        }
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
      "subdivision" to config.subdivision,
      "clickVoice" to config.clickVoice,
      "beatIntervalMs" to beatIntervalMsForBpm(config.bpm),
      "beatInBar" to beatInBar,
      "barNumber" to barNumber,
      "absolutePulse" to absolutePulse,
      "countInBarsRemaining" to countInBarsRemaining(),
    )
  }

  private fun stopInternal(releaseTrack: Boolean, emitState: Boolean) {
    handler?.removeCallbacks(pollRunnable)
    handler?.removeCallbacks(mapWriterRunnable)
    runStartGridFrame = 0.0
    firstRunGridPulse = 0
    mapWriteFrame = 0
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
      handlerThread = HandlerThread("SongNookMetronome").also { thread ->
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

    if (mapSegments != null) {
      pollMapBeatProgress()
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

  private fun pollMapBeatProgress() {
    val track = audioTrack
    val currentGridFrame = if (config.clickEnabled && track != null) {
      val head = track.playbackHeadPosition.toLong() and 0xffffffffL
      runStartGridFrame + head
    } else {
      val elapsedMs = max(0L, SystemClock.elapsedRealtime() - startUptimeMs).toDouble()
      runStartGridFrame + elapsedMs / 1000.0 * sampleRate
    }

    val runPulseNow = mapGridPulseAtFrame(currentGridFrame) - firstRunGridPulse
    if (runPulseNow > lastEmittedPulse) {
      for (nextPulse in (lastEmittedPulse + 1)..runPulseNow) {
        emitMapBeat(nextPulse)
      }
    }
  }

  /** Map-mode twin of emitBeat: meta from the segment table; cues use the CURRENT
   *  segment's pulse spacing so the haptic lead stays true across changes. */
  private fun emitMapBeat(runPulse: Int) {
    lastEmittedPulse = runPulse
    absolutePulse = runPulse
    val gridPulse = firstRunGridPulse + runPulse
    val meta = mapPulseMeta(gridPulse)
    beatInBar = meta[0] as Int
    barNumber = max(1, meta[1] as Int)
    val segment = if (gridPulse >= 0) mapSegmentForGridPulse(gridPulse) else mapSegments!![0]
    finishBeatEmission(meta[2] as Double, segment.exactFramesPerPulse / sampleRate * 1000.0)
  }

  private fun emitBeat(pulseOrdinal: Int) {
    lastEmittedPulse = pulseOrdinal
    absolutePulse = pulseOrdinal
    beatInBar = (pulseOrdinal % config.pulsesPerBar) + 1
    barNumber = (pulseOrdinal / config.pulsesPerBar) + 1

    val accent = config.accentPattern[(beatInBar - 1).coerceAtMost(config.accentPattern.lastIndex)]
    finishBeatEmission(accent, beatIntervalMsForBpm(config.bpm))
  }

  private fun finishBeatEmission(accent: Double, beatIntervalMsForCues: Double) {
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

    // Schedule the NEXT beat's haptic natively: one beat of lead means the signed offset
    // (route latency − motor spin-up) can land the buzz exactly on the audible click, even
    // when it must fire BEFORE the beat event — something a bridge-event chain can never do.
    if (config.hapticEnabled) {
      scheduleHaptic(max(1L, (beatIntervalMsForCues + config.hapticOffsetMs).toLong()))
    }

    // Snapshot state for *this* beat before flipping isCountIn off below, so the final count-in
    // beat (e.g. dot 4 of 4) still reports isCountIn=true and gets a chance to render before the
    // UI transitions to "recording" on the next beat. The snapshot is emitted with the SAME
    // output-latency delay as onBeat: beat numbers / count-in dots are driven off this state,
    // and undelayed they run a full route latency AHEAD of the audible click (the "screen
    // counts before I hear the beep" bug on Bluetooth).
    val beatStateSnapshot = getState()
    if (latency > 0L) {
      handler?.postDelayed({ if (isRunning) onStateChange(beatStateSnapshot) }, latency)
    } else {
      onStateChange(beatStateSnapshot)
    }

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

  private fun scheduleHaptic(delayMs: Long) {
    val strength = config.hapticStrength.coerceIn(0.0, 1.0)
    handler?.postDelayed({
      if (isRunning && config.hapticEnabled) {
        try {
          triggerHaptic(strength)
        } catch (_: Throwable) {
        }
      }
    }, delayMs)
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
    val hapticEnabled = rawConfig["hapticEnabled"] as? Boolean ?: config.hapticEnabled
    val hapticStrength = (rawConfig["hapticStrength"] as? Number)?.toDouble()?.coerceIn(0.0, 1.0)
      ?: config.hapticStrength
    val hapticOffsetMs = (rawConfig["hapticOffsetMs"] as? Number)?.toInt()?.coerceIn(-200, 1000)
      ?: config.hapticOffsetMs
    val subdivision = (rawConfig["subdivision"] as? Number)?.toInt()?.coerceIn(1, 4)
      ?: config.subdivision
    // A present-but-unknown voice falls back to the stock click; absent keeps running.
    val clickVoice = (rawConfig["clickVoice"] as? String)?.let { if (it == "wood") "wood" else "click" }
      ?: config.clickVoice

    return MetronomeConfig(
      bpm = bpm,
      meterId = meterId,
      pulsesPerBar = pulsesPerBar,
      denominator = denominator,
      accentPattern = accentPattern,
      clickEnabled = clickEnabled,
      clickVolume = clickVolume,
      outputLatencyMs = outputLatencyMs,
      hapticEnabled = hapticEnabled,
      hapticStrength = hapticStrength,
      hapticOffsetMs = hapticOffsetMs,
      subdivision = subdivision,
      clickVoice = clickVoice
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

    mapSegments?.let { segments ->
      // Map mode: still "epoch of run pulse 0 + current pulse spacing" — consumers
      // re-derive per bar, so a spacing that changes at a boundary self-heals.
      val track = audioTrack
      val currentGridFrame = if (config.clickEnabled && track != null) {
        runStartGridFrame + (track.playbackHeadPosition.toLong() and 0xffffffffL)
      } else {
        val elapsedMs = max(0L, SystemClock.elapsedRealtime() - startUptimeMs).toDouble()
        runStartGridFrame + elapsedMs / 1000.0 * sampleRate
      }
      val framesSincePulseZero = currentGridFrame - mapFrameOfGridPulse(firstRunGridPulse)
      val gridPulseNow = mapGridPulseAtFrame(currentGridFrame)
      val segment = if (gridPulseNow >= 0) mapSegmentForGridPulse(gridPulseNow) else segments[0]
      return mapOf(
        "isRunning" to true,
        "isCountIn" to isCountIn,
        "anchorEpochMs" to nowEpochMs - framesSincePulseZero / sampleRate * 1000.0,
        "msPerPulse" to segment.exactFramesPerPulse / sampleRate * 1000.0,
        "pulsesPerBar" to segment.pulsesPerBar,
        "countInPulsesRemaining" to countInPulsesRemaining,
        "absolutePulse" to absolutePulse,
      )
    }
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
  val pcm = ShortArray(totalFrames)
  val weakSpec = clickVoiceSpec(config.clickVoice, isDownbeat = false)
  val subdivision = max(1, config.subdivision)

  for (pulseIndex in 0 until config.pulsesPerBar) {
    val accent = config.accentPattern[pulseIndex.coerceAtMost(config.accentPattern.lastIndex)]
    // Accent 0 is a rest, not a quiet click (see the map scheduler above).
    if (accent <= 0.0) {
      continue
    }
    // Bresenham onsets: round(k · exact) for the beat AND its sub-clicks, so the ornament
    // rides the same sample-exact bar as the grid.
    val startFrame = (pulseIndex * exactFramesPerPulse).roundToInt()
    val spec = clickVoiceSpec(config.clickVoice, isDownbeat = pulseIndex == 0)
    mixClick(pcm, startFrame, spec, spec.amplitude(accent), totalFrames, sampleRate)
    for (step in 1 until subdivision) {
      val subFrame = ((pulseIndex + step.toDouble() / subdivision) * exactFramesPerPulse).roundToInt()
      mixClick(pcm, subFrame, weakSpec, weakSpec.amplitude(SUB_CLICK_ACCENT), totalFrames, sampleRate)
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
