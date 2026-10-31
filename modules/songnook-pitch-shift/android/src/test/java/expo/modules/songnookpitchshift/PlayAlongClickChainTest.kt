package expo.modules.songnookpitchshift

import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.AudioProcessingPipeline
import androidx.media3.common.audio.SonicAudioProcessor
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.audio.TrimmingAudioProcessor
import com.google.common.collect.ImmutableList
import java.nio.ByteBuffer
import java.nio.ByteOrder
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The real chain the practice engine plays through (Sonic → sound chain → click), driven
 * the way DefaultAudioSink drives it: the click must land where the grid says in the
 * SONG's time, whatever the speed, through Sonic's own mapping and the limiter's delay.
 */
@UnstableApi
class PlayAlongClickChainTest {
  private val sampleRate = 44_100
  private val channels = 2

  /** The take's AAC priming: ExoPlayer stamps it as time and trims it once per configure. */
  private val primingFrames = 2_048

  /**
   * Plays a FILE through the chain the sink builds (trim → Sonic → sound chain → click):
   * priming, then silence with a loud burst on the RIGHT channel at each grid beat (91 bpm
   * from 1200 ms, in the trimmed time the grid lives in). Buffer times are stamped the way
   * ExoPlayer stamps them: on the untrimmed timeline. Optionally plays a while from the top
   * and then seeks. Returns where the song's bursts and the play-along clicks begin.
   */
  private fun run(
    speed: Float,
    pitch: Float,
    seconds: Double,
    anchorMs: Double,
    playFromTopFirstMs: Double? = null,
  ): Pair<List<Int>, List<Int>> {
    val trimming = TrimmingAudioProcessor().apply { setTrimFrameCount(primingFrames, 0) }
    val sonic = SonicAudioProcessor().apply {
      setSpeed(speed)
      setPitch(pitch)
    }
    val soundChain = SoundChainAudioProcessor()
    val click = PlayAlongClickAudioProcessor(sonic, soundChain)
    click.loadedSourceUri = "file:///take.m4a"
    click.encoderDelayUs = primingFrames * 1_000_000L / sampleRate
    val beatMs = 60_000.0 / 91
    click.plan = PlayAlongClickPlan(
      sourceUri = "file:///take.m4a",
      segments = listOf(PlayAlongClickSegment(1200.0, beatMs, 4, doubleArrayOf(1.0, 0.46, 0.72, 0.46), Double.POSITIVE_INFINITY)),
      stopAtMs = Double.POSITIVE_INFINITY,
      volume = 0.5,
      voice = "click",
    )

    val pipeline = AudioProcessingPipeline(ImmutableList.of<AudioProcessor>(trimming, sonic, soundChain, click))
    pipeline.configure(AudioProcessor.AudioFormat(sampleRate, channels, C.ENCODING_PCM_16BIT))
    // File frames: the priming, then the take (trimmed content time t at P + t·sr).
    val markerFileFrames = (0 until 64).map { primingFrames + Math.round((1200.0 + it * beatMs) * sampleRate / 1000) }

    fun play(fromFileFrame: Long, frames: Int, collect: Boolean, left: MutableList<Short>, right: MutableList<Short>) {
      click.inputPresentationTimeUs = fromFileFrame * 1_000_000L / sampleRate
      pipeline.flush()
      var fed = 0
      while (true) {
        if (fed < frames) {
          val count = minOf(1_024, frames - fed)
          val buffer = ByteBuffer.allocateDirect(count * channels * 2).order(ByteOrder.LITTLE_ENDIAN)
          for (index in 0 until count) {
            val fileFrame = fromFileFrame + fed + index
            val inBurst = markerFileFrames.any { fileFrame >= it && fileFrame < it + 40 }
            buffer.putShort(0)
            buffer.putShort(if (inBurst) 20_000 else 0)
          }
          buffer.flip()
          pipeline.queueInput(buffer)
          fed += count - buffer.remaining() / (channels * 2)
          if (fed >= frames && collect) pipeline.queueEndOfStream()
        }
        val output = pipeline.output.order(ByteOrder.LITTLE_ENDIAN)
        while (output.remaining() >= 4) {
          val l = output.short
          val r = output.short
          if (collect) {
            left += l
            right += r
          }
        }
        if (fed >= frames && (!collect || pipeline.isEnded)) break
      }
    }

    val left = ArrayList<Short>()
    val right = ArrayList<Short>()
    if (playFromTopFirstMs != null) {
      play(0, (playFromTopFirstMs * sampleRate / 1000).toInt(), collect = false, left, right)
    }
    // anchorMs is where the player is sent, as ExoPlayer's (untrimmed) time.
    play((anchorMs * sampleRate / 1000).toLong(), (seconds * sampleRate).toInt(), collect = true, left, right)
    // The click is identical on both channels: right minus left is the song alone.
    val song = right.indices.map { right[it].toInt() - left[it].toInt() }
    return onsets(song, threshold = 8_000) to onsets(left.map { it.toInt() }, threshold = 1)
  }

  private fun onsets(signal: List<Int>, threshold: Int): List<Int> {
    val found = mutableListOf<Int>()
    var quiet = Int.MAX_VALUE
    for (frame in signal.indices) {
      if (kotlin.math.abs(signal[frame]) >= threshold) {
        if (quiet > 2_000) found += frame
        quiet = 0
      } else if (quiet != Int.MAX_VALUE) {
        quiet += 1
      }
    }
    return found
  }

  private fun assertTogether(
    speed: Float,
    pitch: Float,
    anchorMs: Double,
    toleranceMs: Double = 3.0,
    playFromTopFirstMs: Double? = null,
  ) {
    val (song, clicks) = run(speed, pitch, seconds = 8.0, anchorMs = anchorMs, playFromTopFirstMs = playFromTopFirstMs)
    assertTrue("song beats heard: $song", song.size >= 6)
    assertTrue("clicks heard: $clicks", clicks.size >= 6)
    val pairs = song.zip(clicks)
    for ((songFrame, clickFrame) in pairs) {
      val errorMs = (clickFrame - songFrame) * 1000.0 / sampleRate
      // The click's first audible sample trails its onset by a frame or two; Sonic moves
      // the song's own transient by up to a pitch period (most at half speed, pitched).
      assertTrue(
        "speed $speed pitch $pitch: click ${"%.2f".format(errorMs)} ms off ($pairs)",
        kotlin.math.abs(errorMs) <= toleranceMs,
      )
    }
    // Never a drift: the last beats sit no further off than the first ones.
    val errors = pairs.map { (songFrame, clickFrame) -> (clickFrame - songFrame) * 1000.0 / sampleRate }
    println("speed $speed pitch $pitch: click − song ms ${errors.map { "%.1f".format(it) }}")
    val third = errors.size / 3
    val early = errors.take(third).average()
    val late = errors.takeLast(third).average()
    assertTrue("speed $speed drifts: $early → $late ms", kotlin.math.abs(late - early) <= toleranceMs / 2)
  }

  @Test fun fullSpeed() = assertTogether(1f, 1f, anchorMs = 0.0)

  @Test fun slowPractice() = assertTogether(0.73f, 1f, anchorMs = 0.0)

  @Test fun fastAndPitchedAfterASeek() = assertTogether(1.25f, 1.189f, anchorMs = 3_333.0)

  // Half speed and pitched is Sonic's hardest case: its period-by-period splicing moves
  // a sharp transient around by a few ms. The click is placed by the song's clock and
  // still never drifts.
  @Test fun halfSpeedPitchedDown() = assertTogether(0.5f, 0.84f, anchorMs = 950.0, toleranceMs = 10.0)

  // ExoPlayer trims the priming only from the first data after a configure: a seek after
  // playing from the top hears untrimmed time, and the click must follow it there too.
  @Test fun seekAfterPlayingFromTheTop() = assertTogether(1f, 1f, anchorMs = 5_000.0, playFromTopFirstMs = 2_000.0)

  @Test fun seekAfterPlayingFromTheTopSlowed() = assertTogether(0.73f, 1f, anchorMs = 4_321.0, playFromTopFirstMs = 1_500.0)

  /** A load that starts mid-take: the sink trims its first 2048 frames of real audio. */
  @Test fun loadStartingMidTake() = assertTogether(1f, 1f, anchorMs = 6_000.0)

  @Test
  fun clicksStayOnTheGridAtTheSameSpeedFromAnySeek() {
    val (song, clicks) = run(1f, 1f, seconds = 4.0, anchorMs = 2_000.0)
    assertEquals(song.size, clicks.size)
  }
}
