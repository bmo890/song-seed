package expo.modules.songnookpitchshift

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PlayAlongClickMixerTest {
  private val sampleRate = 48_000
  private val lag = 240

  /** 120 bpm in 4/4 from content 1000 ms: a beat every 500 ms. */
  private fun plan(
    accents: DoubleArray = doubleArrayOf(1.0, 0.46, 0.72, 0.46),
    stopAtMs: Double = Double.POSITIVE_INFINITY,
    segments: List<PlayAlongClickSegment>? = null,
  ) = PlayAlongClickPlan(
    sourceUri = null,
    segments = segments ?: listOf(PlayAlongClickSegment(1000.0, 500.0, 4, accents, Double.POSITIVE_INFINITY)),
    stopAtMs = stopAtMs,
    volume = 0.5,
    voice = "click",
  )

  /** Runs silence through the mixer and returns the frame each click starts at. */
  private fun onsets(
    rate: Double,
    anchorMs: Double,
    totalFrames: Int,
    plan: PlayAlongClickPlan,
    chunk: Int = 1_024,
  ): List<Int> {
    val mixer = PlayAlongClickMixer(
      sampleRate = sampleRate,
      channels = 2,
      contentFramesAt = { outputFrames -> if (rate == 1.0) null else Math.round(outputFrames * rate) },
      lagFrames = { lag },
    )
    mixer.flush(anchorMs)
    val signal = ShortArray(totalFrames)
    var at = 0
    while (at < totalFrames) {
      val frames = minOf(chunk, totalFrames - at)
      val block = ShortArray(frames * 2)
      mixer.process(block, frames, plan)
      for (frame in 0 until frames) signal[at + frame] = block[frame * 2]
      at += frames
    }
    // A click's first sample is sin(0) = 0; its onset is the frame before the first sound.
    val found = mutableListOf<Int>()
    var silentRun = Int.MAX_VALUE
    for (frame in signal.indices) {
      if (signal[frame].toInt() != 0) {
        if (silentRun > 200) found += frame - 1
        silentRun = 0
      } else if (silentRun != Int.MAX_VALUE) {
        silentRun += 1
      }
    }
    return found
  }

  private fun expectedFrame(contentMs: Double, anchorMs: Double, rate: Double) =
    lag + Math.round((contentMs - anchorMs) / rate * sampleRate / 1000.0).toInt()

  @Test
  fun clicksLandOnTheGridSampleExactAtFullSpeed() {
    val got = onsets(rate = 1.0, anchorMs = 0.0, totalFrames = sampleRate * 3, plan = plan())
    val want = listOf(1000.0, 1500.0, 2000.0, 2500.0).map { expectedFrame(it, 0.0, 1.0) }
    assertEquals(want, got)
  }

  @Test
  fun slowPracticeStretchesTheGridNotTheClick() {
    val rate = 0.73
    val got = onsets(rate = rate, anchorMs = 0.0, totalFrames = sampleRate * 3, plan = plan())
    val want = listOf(1000.0, 1500.0, 2000.0).map { expectedFrame(it, 0.0, rate) }
    // The simulated speed stage counts whole frames: within one frame (0.02 ms).
    assertEquals(want.size, got.size)
    want.zip(got).forEach { (expected, actual) -> assertTrue("$expected vs $actual", kotlin.math.abs(expected - actual) <= 1) }
  }

  @Test
  fun aSeekMidBeatWaitsForTheNextBeatAndNeverClicksLate() {
    val got = onsets(rate = 1.0, anchorMs = 1_250.0, totalFrames = sampleRate, plan = plan())
    assertEquals(listOf(expectedFrame(1500.0, 1250.0, 1.0), expectedFrame(2000.0, 1250.0, 1.0)), got)
  }

  @Test
  fun aSeekExactlyOnABeatClicksIt() {
    val got = onsets(rate = 1.0, anchorMs = 1_500.0, totalFrames = sampleRate / 4, plan = plan())
    assertEquals(listOf(expectedFrame(1500.0, 1500.0, 1.0)), got)
  }

  @Test
  fun restsStayQuietAndTheGridStopsWhereItIsNoLongerTrusted() {
    val got = onsets(
      rate = 1.0,
      anchorMs = 0.0,
      totalFrames = sampleRate * 4,
      plan = plan(accents = doubleArrayOf(1.0, 0.0, 0.72, 0.0), stopAtMs = 3000.0),
    )
    assertEquals(listOf(1000.0, 2000.0).map { expectedFrame(it, 0.0, 1.0) }, got)
  }

  @Test
  fun aTempoChangeTakesOverAtItsBarLine() {
    val segments = listOf(
      PlayAlongClickSegment(0.0, 500.0, 2, doubleArrayOf(1.0, 0.5), 1000.0),
      PlayAlongClickSegment(1000.0, 250.0, 2, doubleArrayOf(1.0, 0.5), Double.POSITIVE_INFINITY),
    )
    val got = onsets(rate = 1.0, anchorMs = 0.0, totalFrames = sampleRate * 3 / 2, plan = plan(segments = segments))
    val want = listOf(0.0, 500.0, 1000.0, 1250.0).map { expectedFrame(it, 0.0, 1.0) }
    assertEquals(want, got)
  }

  @Test
  fun chunkSizeNeverMovesAClick() {
    val big = onsets(rate = 1.0, anchorMs = 0.0, totalFrames = sampleRate * 3, plan = plan(), chunk = 4_096)
    val tiny = onsets(rate = 1.0, anchorMs = 0.0, totalFrames = sampleRate * 3, plan = plan(), chunk = 37)
    assertEquals(big, tiny)
    assertTrue(big.isNotEmpty())
  }
}
