package expo.modules.songnookpitchshift

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PlayAlongHapticPlannerTest {
  /** 120 bpm in 4/4 from content 1000 ms, a beat every 500 ms; the third beat a rest. */
  private fun plan(strength: Double? = 0.6, latencyMs: Double = 60.0) = PlayAlongClickPlan(
    sourceUri = null,
    segments = listOf(
      PlayAlongClickSegment(1000.0, 500.0, 4, doubleArrayOf(1.0, 0.5, 0.0, 0.5), Double.POSITIVE_INFINITY),
    ),
    stopAtMs = Double.POSITIVE_INFINITY,
    volume = 0.5,
    voice = "click",
    hapticStrength = strength,
    hapticLatencyMs = latencyMs,
  )

  /**
   * Plays from `fromMs` at `speed`, reporting a position every `stepMs` of wall time,
   * and returns the wall time each buzz is felt (send time + latency).
   */
  private fun felt(
    fromMs: Double,
    speed: Double,
    wallMs: Double,
    stepMs: Double = 10.0,
    plan: PlayAlongClickPlan = plan(),
  ): List<Double> {
    val planner = PlayAlongHapticPlanner()
    val out = mutableListOf<Double>()
    var wall = 0.0
    while (wall <= wallMs) {
      val heard = fromMs + wall * speed
      planner.due(heard, speed, plan).forEach { out += wall + it + plan.hapticLatencyMs }
      wall += stepMs
    }
    return out
  }

  /** When content `beatMs` is heard, in wall ms after starting at `fromMs`. */
  private fun heardAt(beatMs: Double, fromMs: Double, speed: Double) = (beatMs - fromMs) / speed

  private fun assertNear(expected: List<Double>, actual: List<Double>) {
    assertEquals("$expected vs $actual", expected.size, actual.size)
    expected.zip(actual).forEach { (e, a) -> assertTrue("$e vs $a", kotlin.math.abs(e - a) < 0.001) }
  }

  @Test
  fun eachBuzzIsFeltWithItsClickOnceAndRestsStayStill() {
    val got = felt(fromMs = 0.0, speed = 1.0, wallMs = 3000.0)
    // 1000, 1500, (2000 rest), 2500, 3000
    assertNear(listOf(1000.0, 1500.0, 2500.0, 3000.0).map { heardAt(it, 0.0, 1.0) }, got)
  }

  @Test
  fun slowPracticeStretchesTheBuzzesWithTheClick() {
    val got = felt(fromMs = 900.0, speed = 0.73, wallMs = 1500.0)
    assertNear(listOf(1000.0, 1500.0).map { heardAt(it, 900.0, 0.73) }, got)
  }

  @Test
  fun aBeatTooCloseToReachIsSkippedNotLate() {
    // Starting 20 ms before a beat: the motor needs 60, so that beat goes unfelt.
    val got = felt(fromMs = 1480.0, speed = 1.0, wallMs = 1100.0)
    assertNear(listOf(2500.0).map { heardAt(it, 1480.0, 1.0) }, got)
  }

  @Test
  fun aSeekStartsTheWalkOverFromTheNewPlace() {
    val planner = PlayAlongHapticPlanner()
    val p = plan()
    var wall = 0.0
    val out = mutableListOf<Double>()
    while (wall <= 400.0) {
      planner.due(800.0 + wall, 1.0, p).forEach { out += wall + it + 60.0 }
      wall += 10.0
    }
    // The buzz for 1000 was sent ahead; at wall 410 the player jumps back to 0.
    while (wall <= 1500.0) {
      planner.due(wall - 410.0, 1.0, p).forEach { out += wall + it + 60.0 }
      wall += 10.0
    }
    assertNear(listOf(200.0, 410.0 + 1000.0), out)
  }

  @Test
  fun noStrengthMeansNoBuzz() {
    assertTrue(felt(fromMs = 0.0, speed = 1.0, wallMs = 3000.0, plan = plan(strength = null)).isEmpty())
  }

  @Test
  fun aSlowReportRateMovesNothing() {
    val fine = felt(fromMs = 0.0, speed = 1.25, wallMs = 2500.0, stepMs = 5.0)
    val coarse = felt(fromMs = 0.0, speed = 1.25, wallMs = 2500.0, stepMs = 40.0)
    assertNear(fine, coarse)
    assertTrue(fine.isNotEmpty())
  }
}
