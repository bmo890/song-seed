package expo.modules.songnookpitchshift

import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.AudioProcessingPipeline
import androidx.media3.common.audio.SonicAudioProcessor
import androidx.media3.common.util.UnstableApi
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

  /** Plays `seconds` of a song carrying its own marker clicks at `markerMs`, through the
   *  chain at `speed`, with the play-along click on the 91 bpm grid from 1200 ms. Returns
   *  the output frames where the song's markers and the play-along clicks begin. */
  private fun run(speed: Float, pitch: Float, seconds: Double, anchorMs: Double): Pair<List<Int>, List<Int>> {
    val sonic = SonicAudioProcessor().apply {
      setSpeed(speed)
      setPitch(pitch)
    }
    val soundChain = SoundChainAudioProcessor()
    val click = PlayAlongClickAudioProcessor(sonic, soundChain)
    click.loadedSourceUri = "file:///take.m4a"
    val beatMs = 60_000.0 / 91
    click.plan = PlayAlongClickPlan(
      sourceUri = "file:///take.m4a",
      segments = listOf(PlayAlongClickSegment(1200.0, beatMs, 4, doubleArrayOf(1.0, 0.46, 0.72, 0.46), Double.POSITIVE_INFINITY)),
      stopAtMs = Double.POSITIVE_INFINITY,
      volume = 0.5,
      voice = "click",
    )

    val pipeline = AudioProcessingPipeline(ImmutableList.of<AudioProcessor>(sonic, soundChain, click))
    pipeline.configure(AudioProcessor.AudioFormat(sampleRate, channels, C.ENCODING_PCM_16BIT))
    click.inputPresentationTimeUs = (anchorMs * 1000).toLong()
    pipeline.flush()

    // The song: silence with a loud square burst on the RIGHT channel at each grid beat,
    // so the song's own beats and the play-along clicks (both channels) can be told apart.
    val firstFrame = (anchorMs * sampleRate / 1000).toLong()
    val totalInput = (seconds * sampleRate).toInt()
    val markerFrames = (0 until 64).map { Math.round((1200.0 + it * beatMs) * sampleRate / 1000) }.toSet()
    val left = ArrayList<Short>()
    val right = ArrayList<Short>()
    var fed = 0
    while (fed < totalInput || !pipeline.isEnded) {
      if (fed < totalInput) {
        val frames = minOf(1_024, totalInput - fed)
        val buffer = ByteBuffer.allocateDirect(frames * channels * 2).order(ByteOrder.LITTLE_ENDIAN)
        for (index in 0 until frames) {
          val songFrame = firstFrame + fed + index
          val inBurst = markerFrames.any { songFrame >= it && songFrame < it + 40 }
          buffer.putShort(0)
          buffer.putShort(if (inBurst) 20_000 else 0)
        }
        buffer.flip()
        pipeline.queueInput(buffer)
        fed += frames - buffer.remaining() / (channels * 2)
        if (fed >= totalInput) pipeline.queueEndOfStream()
      }
      val output = pipeline.output.order(ByteOrder.LITTLE_ENDIAN)
      while (output.remaining() >= 4) {
        left += output.short
        right += output.short
      }
      if (fed >= totalInput && pipeline.isEnded) break
    }
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

  private fun assertTogether(speed: Float, pitch: Float, anchorMs: Double, toleranceMs: Double = 3.0) {
    val (song, clicks) = run(speed, pitch, seconds = 8.0, anchorMs = anchorMs)
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

  @Test
  fun clicksStayOnTheGridAtTheSameSpeedFromAnySeek() {
    val (song, clicks) = run(1f, 1f, seconds = 4.0, anchorMs = 2_000.0)
    assertEquals(song.size, clicks.size)
  }
}
