package expo.modules.songnookpitchshift

import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.BaseAudioProcessor
import androidx.media3.common.audio.SonicAudioProcessor
import androidx.media3.common.util.UnstableApi
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.roundToLong
import kotlin.math.sin

/**
 * The play-along click, inside the song's own stream (2026-10-31, "one clock").
 *
 * Until now the click was a second player kept in step with the song from JS, and every
 * bug in it was the two clocks disagreeing. Here the click is mixed into the song's
 * samples after pitch and speed, at the frame where its beat falls in the FILE: it
 * cannot drift, start late, or hear a different route delay than the song, and it
 * follows seeks, loops, speed and pitch with no restarts.
 *
 * Positions are content (file) milliseconds, the grid's own unit. A frame's content time
 * is the first input buffer's presentation time after the last processor flush, plus
 * Sonic's own playout→media mapping (the one the player reports its position with).
 * DefaultAudioSink flushes the processors only at a buffer boundary (seek, speed
 * change, start), so that buffer's time is exactly where the flushed stream begins.
 */

/** One constant-tempo stretch of the take's grid, in content ms. */
internal class PlayAlongClickSegment(
  val startMs: Double,
  val pulseMs: Double,
  val pulsesPerBar: Int,
  val accents: DoubleArray,
  /** First content ms past this segment (the next one's start), or +∞. */
  val endMs: Double,
)

internal class PlayAlongClickPlan(
  /** The file this grid belongs to: another file loaded in the engine never clicks. */
  val sourceUri: String?,
  val segments: List<PlayAlongClickSegment>,
  /** The grid is not trusted from here on: no click at or past it. */
  val stopAtMs: Double,
  val volume: Double,
  val voice: String,
) {
  /** Same beats (the cursor survives a volume or voice change). */
  fun sameTimingAs(other: PlayAlongClickPlan?): Boolean {
    if (other == null || other.sourceUri != sourceUri || other.stopAtMs != stopAtMs) return false
    if (other.segments.size != segments.size) return false
    for (index in segments.indices) {
      val a = segments[index]
      val b = other.segments[index]
      if (a.startMs != b.startMs || a.pulseMs != b.pulseMs || a.pulsesPerBar != b.pulsesPerBar ||
        a.endMs != b.endMs || !a.accents.contentEquals(b.accents)
      ) {
        return false
      }
    }
    return true
  }

  companion object {
    @Suppress("UNCHECKED_CAST")
    fun fromMap(raw: Map<String, Any?>): PlayAlongClickPlan? {
      val rawSegments = raw["segments"] as? List<Map<String, Any?>> ?: return null
      val stopAtMs = (raw["stopAtMs"] as? Number)?.toDouble() ?: Double.POSITIVE_INFINITY
      val parsed = rawSegments.mapNotNull { segment ->
        val startMs = (segment["startMs"] as? Number)?.toDouble() ?: return@mapNotNull null
        val pulseMs = (segment["pulseMs"] as? Number)?.toDouble() ?: return@mapNotNull null
        val pulsesPerBar = (segment["pulsesPerBar"] as? Number)?.toInt() ?: return@mapNotNull null
        val accents = (segment["accentPattern"] as? List<Any?>)
          ?.map { (it as? Number)?.toDouble() ?: 0.0 }
          ?.toDoubleArray()
          ?: return@mapNotNull null
        if (!startMs.isFinite() || !(pulseMs > 1.0) || pulsesPerBar <= 0 || accents.isEmpty()) {
          return@mapNotNull null
        }
        startMs to Triple(pulseMs, pulsesPerBar, accents)
      }.sortedBy { it.first }
      if (parsed.isEmpty()) return null
      val segments = parsed.mapIndexed { index, (startMs, rest) ->
        PlayAlongClickSegment(
          startMs = startMs,
          pulseMs = rest.first,
          pulsesPerBar = rest.second,
          accents = rest.third,
          endMs = parsed.getOrNull(index + 1)?.first ?: Double.POSITIVE_INFINITY,
        )
      }
      return PlayAlongClickPlan(
        sourceUri = raw["sourceUri"] as? String,
        segments = segments,
        stopAtMs = stopAtMs,
        volume = ((raw["volume"] as? Number)?.toDouble() ?: 0.5).coerceIn(0.0, 1.0),
        voice = raw["clickVoice"] as? String ?: "click",
      )
    }
  }
}

/** One beat of the plan: where it falls and how it sounds. */
internal class PlayAlongBeat(val atMs: Double, val isDownbeat: Boolean, val accent: Double)

/** Walks a plan's beats in time order from any content position. */
internal class PlayAlongBeatCursor(private val plan: PlayAlongClickPlan, fromMs: Double) {
  private var segmentIndex = 0
  private var pulse = 0L

  init {
    while (segmentIndex < plan.segments.size - 1 && plan.segments[segmentIndex].endMs <= fromMs) {
      segmentIndex += 1
    }
    val segment = plan.segments[segmentIndex]
    // Half a microsecond of slack: a seek that lands exactly on a beat still clicks it.
    pulse = max(0.0, kotlin.math.ceil((fromMs - segment.startMs - 0.0005) / segment.pulseMs)).toLong()
  }

  /** The next beat, or null past the end of the trusted grid. Rests (accent 0) are skipped. */
  fun next(): PlayAlongBeat? {
    while (segmentIndex < plan.segments.size) {
      val segment = plan.segments[segmentIndex]
      val atMs = segment.startMs + pulse * segment.pulseMs
      if (atMs >= segment.endMs - 0.0005) {
        segmentIndex += 1
        pulse = 0
        continue
      }
      if (atMs >= plan.stopAtMs) return null
      val inBar = (pulse % segment.pulsesPerBar).toInt()
      pulse += 1
      val accent = segment.accents[min(inBar, segment.accents.lastIndex)]
      if (accent <= 0.0) continue
      return PlayAlongBeat(atMs, isDownbeat = inBar == 0, accent = accent)
    }
    return null
  }
}

/** One click timbre. Mirrors the metronome engine's table (and the iOS and JS copies):
 *  the click you play along with is the click you recorded with. */
private class ClickVoice(
  val baseFrequency: Double,
  val overtoneFrequency: Double,
  val decayPower: Double,
  val mixBase: Double,
  val mixOvertone: Double,
  val durationSec: Double,
  val attackSec: Double,
  val amplitudeBase: Double,
  val amplitudeScale: Double,
) {
  fun amplitude(accent: Double): Double = amplitudeBase + accent * amplitudeScale

  /** The click at unit amplitude, one sample per frame. */
  fun render(sampleRate: Int): FloatArray {
    val frames = max(1, (sampleRate * durationSec).roundToInt())
    val attackFrames = max(1, (sampleRate * attackSec).roundToInt())
    return FloatArray(frames) { index ->
      val time = index.toDouble() / sampleRate
      val attack = min(1.0, index.toDouble() / attackFrames)
      val decay = (1.0 - index.toDouble() / frames).pow(decayPower)
      ((sin(2.0 * Math.PI * baseFrequency * time) * mixBase +
        sin(2.0 * Math.PI * overtoneFrequency * time) * mixOvertone) * attack * decay).toFloat()
    }
  }
}

private fun clickVoice(voice: String, isDownbeat: Boolean): ClickVoice {
  if (voice == "wood") {
    return if (isDownbeat) {
      ClickVoice(1180.0, 1770.0, 3.2, 0.70, 0.30, 0.046, 0.0015, 0.26, 0.50)
    } else {
      ClickVoice(880.0, 1320.0, 2.9, 0.70, 0.30, 0.046, 0.0015, 0.26, 0.50)
    }
  }
  return if (isDownbeat) {
    ClickVoice(1960.0, 2940.0, 2.8, 0.78, 0.22, 0.034, 0.003, 0.22, 0.46)
  } else {
    ClickVoice(1560.0, 2350.0, 2.4, 0.78, 0.22, 0.034, 0.003, 0.22, 0.46)
  }
}

/**
 * The mixing core, free of Media3 so it can be tested on the JVM. Frames are counted
 * from the last flush; `playoutFramesFor` maps content ms since the flush to output
 * frames (Sonic's mapping in the player, identity × rate in tests), and `lagFrames` is
 * how far stages after Sonic delay the song (the limiter's look-ahead).
 */
internal class PlayAlongClickMixer(
  private val sampleRate: Int,
  private val channels: Int,
  private val playoutFramesFor: (contentMs: Double) -> Double,
  private val lagFrames: () -> Int,
) {
  private class Scheduled(val onsetFrame: Long, val wave: FloatArray, val gain: Float)

  private val waves = HashMap<String, FloatArray>()
  private var anchorMs = 0.0
  private var framesSinceFlush = 0L
  private var plan: PlayAlongClickPlan? = null
  private var cursor: PlayAlongBeatCursor? = null
  private var pending: PlayAlongBeat? = null
  private val scheduled = ArrayDeque<Scheduled>()

  /** A new stream starts here: `anchorMs` is the content time of its first frame. */
  fun flush(anchorMs: Double) {
    this.anchorMs = anchorMs
    framesSinceFlush = 0
    scheduled.clear()
    cursor = null
    pending = null
  }

  /** Content ms the song frame now leaving this stage was recorded at. */
  private fun contentMsAtFrame(frame: Long): Double {
    val sinceAnchor = (frame - lagFrames()).toDouble() * 1000.0 / sampleRate
    return anchorMs + sinceAnchor * (contentMsPerPlayoutMs())
  }

  /** Content ms per playout ms right now (the speed), from the same mapping. */
  private fun contentMsPerPlayoutMs(): Double {
    val probeMs = 1000.0
    val frames = playoutFramesFor(probeMs)
    return if (frames > 0.0) probeMs * sampleRate / 1000.0 / frames else 1.0
  }

  private fun wave(voice: String, isDownbeat: Boolean): FloatArray =
    waves.getOrPut("$voice/$isDownbeat") { clickVoice(voice, isDownbeat).render(sampleRate) }

  /** Mix the clicks that fall in this interleaved 16-bit block, in place. */
  fun process(pcm: ShortArray, frames: Int, nextPlan: PlayAlongClickPlan?) {
    val start = framesSinceFlush
    val end = start + frames
    framesSinceFlush = end
    if (channels <= 0) return

    if (nextPlan == null) {
      plan = null
      cursor = null
      pending = null
    } else if (!nextPlan.sameTimingAs(plan)) {
      // A new grid (or the first one): take beats from where the song is now, never
      // one that has already passed.
      cursor = PlayAlongBeatCursor(nextPlan, contentMsAtFrame(start))
      pending = null
      scheduled.clear()
    }
    plan = nextPlan

    val activePlan = plan
    val activeCursor = cursor
    if (activePlan != null && activeCursor != null) {
      while (true) {
        val beat = pending ?: activeCursor.next() ?: break
        val onset = lagFrames() + playoutFramesFor(beat.atMs - anchorMs).roundToLong()
        if (onset >= end) {
          pending = beat
          break
        }
        pending = null
        if (onset < start) continue // passed while it was being scheduled: skip, never late
        val voice = clickVoice(activePlan.voice, beat.isDownbeat)
        val gain = (voice.amplitude(beat.accent) * activePlan.volume).toFloat()
        scheduled.addLast(Scheduled(onset, wave(activePlan.voice, beat.isDownbeat), gain))
      }
    }

    val iterator = scheduled.iterator()
    while (iterator.hasNext()) {
      val click = iterator.next()
      val from = max(start, click.onsetFrame)
      val to = min(end, click.onsetFrame + click.wave.size)
      for (frame in from until to) {
        val sample = click.wave[(frame - click.onsetFrame).toInt()] * click.gain
        val base = ((frame - start) * channels).toInt()
        for (channel in 0 until channels) {
          val mixed = pcm[base + channel] + sample * Short.MAX_VALUE
          pcm[base + channel] = mixed.coerceIn(Short.MIN_VALUE.toFloat(), Short.MAX_VALUE.toFloat()).toInt().toShort()
        }
      }
      if (click.onsetFrame + click.wave.size <= end) iterator.remove()
    }
  }
}

/**
 * The Media3 stage: last in the practice engine's chain, after Sonic and the sound
 * chain, so the click is neither pitched, stretched, toned nor turned down with the take.
 */
@UnstableApi
class PlayAlongClickAudioProcessor(
  private val sonic: SonicAudioProcessor,
  private val soundChain: SoundChainAudioProcessor,
) : BaseAudioProcessor() {
  @Volatile internal var plan: PlayAlongClickPlan? = null
  /** The file the engine has loaded; a plan for another file stays silent. */
  @Volatile var loadedSourceUri: String? = null
  /** Presentation time of the input buffer the sink is handling (set before Sonic sees it). */
  @Volatile var inputPresentationTimeUs = 0L

  private var mixer: PlayAlongClickMixer? = null
  private var scratch = ShortArray(0)

  override fun onConfigure(inputAudioFormat: AudioProcessor.AudioFormat): AudioProcessor.AudioFormat {
    if (inputAudioFormat.encoding != C.ENCODING_PCM_16BIT) {
      throw AudioProcessor.UnhandledAudioFormatException(inputAudioFormat)
    }
    return inputAudioFormat
  }

  override fun queueInput(inputBuffer: ByteBuffer) {
    val bytes = inputBuffer.remaining()
    if (bytes == 0) return
    val format = inputAudioFormat
    val frames = bytes / format.bytesPerFrame
    val samples = frames * format.channelCount
    if (scratch.size < samples) scratch = ShortArray(samples)
    inputBuffer.order(ByteOrder.LITTLE_ENDIAN).asShortBuffer().get(scratch, 0, samples)
    inputBuffer.position(inputBuffer.limit())

    val current = plan
    val sounding = current?.takeIf { it.sourceUri == null || it.sourceUri == loadedSourceUri }
    (mixer ?: newMixer().also { mixer = it }).process(scratch, frames, sounding)

    val output = replaceOutputBuffer(bytes).order(ByteOrder.LITTLE_ENDIAN)
    output.asShortBuffer().put(scratch, 0, samples)
    output.position(bytes)
    output.flip()
  }

  override fun onFlush() {
    mixer = newMixer().also { it.flush(inputPresentationTimeUs / 1000.0) }
  }

  override fun onReset() {
    mixer = null
    scratch = ShortArray(0)
  }

  private fun newMixer(): PlayAlongClickMixer {
    val format = inputAudioFormat
    val sampleRate = format.sampleRate
    return PlayAlongClickMixer(
      sampleRate = sampleRate,
      channels = format.channelCount,
      playoutFramesFor = { contentMs ->
        sonic.getPlayoutDuration((contentMs * 1000.0).roundToLong()).toDouble() * sampleRate / 1_000_000.0
      },
      lagFrames = { soundChain.latencyFrames },
    )
  }
}
