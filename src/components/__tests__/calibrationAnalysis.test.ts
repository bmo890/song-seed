import {
  CALIBRATION_BEAT_COUNT,
  CALIBRATION_BEAT_INTERVAL_MS,
  PATTERN_LOCK_IN_BEATS,
  PATTERN_SILENT_BEAT_COUNT,
  analyzeAudioPhaseTaps,
  analyzePatternPhaseTaps,
  buildCalibrationGapPattern,
  buildResultWarning,
} from "../BluetoothCalibrationScreen/calibrationAnalysis";

const BEAT = CALIBRATION_BEAT_INTERVAL_MS; // 667 ms at 90 BPM
const TOTAL_BEATS = 12;

// 16 slots, silent at 4/7/10/13 — a representative run pattern with fixed gaps.
const FIXED_PATTERN = Array.from({ length: CALIBRATION_BEAT_COUNT }, (_, index) => ![4, 7, 10, 13].includes(index));
const PLAYED_SLOTS = FIXED_PATTERN.map((played, index) => (played ? index : -1)).filter(
  (index) => index >= 2 // analysis ignores the lead-in beats
);

describe("analyzeAudioPhaseTaps", () => {
  it("returns the median residual for a typical steady pass", () => {
    // One tap per beat on beats 2-9 with a ~300 ms ear latency and small jitter.
    const residuals = [290, 300, 310, 295, 305, 300, 320, 280];
    const taps = residuals.map((residual, index) => (index + 2) * BEAT + residual);

    const analysis = analyzeAudioPhaseTaps(taps, TOTAL_BEATS);

    expect(analysis).not.toBeNull();
    // Sorted residuals: 280,290,295,300,300,305,310,320 → median (300+300)/2 = 300.
    expect(analysis!.medianMs).toBe(300);
    // Absolute deviations from 300 sorted: 0,0,5,5,10,10,20,20 → median (5+10)/2 = 7.5.
    expect(analysis!.madMs).toBe(7.5);
    expect(analysis!.tapCount).toBe(8);
  });

  it("ignores lead-in beats and dedupes double-taps inside the 120 ms window", () => {
    const residuals = [290, 300, 310, 295, 305, 300, 320, 280];
    const taps = residuals.map((residual, index) => (index + 2) * BEAT + residual);
    // Lead-in beats 0 and 1 are discarded even with clean taps.
    taps.push(0 * BEAT + 300, 1 * BEAT + 300);
    // A stray double-tap 50 ms after the beat-5 tap (residual 295) is deduped, not counted twice.
    taps.push(5 * BEAT + 295 + 50);

    const analysis = analyzeAudioPhaseTaps(taps, TOTAL_BEATS);

    expect(analysis).not.toBeNull();
    expect(analysis!.medianMs).toBe(300);
    expect(analysis!.tapCount).toBe(8);
  });

  it("returns null when fewer than 7 beats have usable taps", () => {
    // Only beats 2-7 tapped → 6 residuals, one short of AUDIO_MIN_VALID_BEAT_TAPS.
    const taps = [2, 3, 4, 5, 6, 7].map((beat) => beat * BEAT + 300);

    expect(analyzeAudioPhaseTaps(taps, TOTAL_BEATS)).toBeNull();
  });

  it("returns null when the tap spread exceeds the allowed MAD", () => {
    // Residuals alternate 0 / 400 on beats 2-9: median 200, MAD 200 > 130.
    const taps = [2, 3, 4, 5, 6, 7, 8, 9].map(
      (beat, index) => beat * BEAT + (index % 2 === 0 ? 0 : 400)
    );

    expect(analyzeAudioPhaseTaps(taps, TOTAL_BEATS)).toBeNull();
  });
});

describe("buildCalibrationGapPattern", () => {
  it("keeps the lock-in beats and the last beat played, gaps never adjacent", () => {
    // Deterministic rng sweep — the invariants must hold for any draw.
    for (let seed = 0; seed < 20; seed += 1) {
      let state = seed + 1;
      const rng = () => {
        state = (state * 48271) % 2147483647;
        return state / 2147483647;
      };
      const pattern = buildCalibrationGapPattern(CALIBRATION_BEAT_COUNT, rng);

      expect(pattern).toHaveLength(CALIBRATION_BEAT_COUNT);
      for (let index = 0; index < PATTERN_LOCK_IN_BEATS; index += 1) {
        expect(pattern[index]).toBe(true);
      }
      expect(pattern[CALIBRATION_BEAT_COUNT - 1]).toBe(true);
      const silentCount = pattern.filter((played) => !played).length;
      expect(silentCount).toBeGreaterThan(0);
      expect(silentCount).toBeLessThanOrEqual(PATTERN_SILENT_BEAT_COUNT);
      for (let index = 1; index < pattern.length; index += 1) {
        expect(pattern[index - 1] || pattern[index]).toBe(true);
      }
    }
  });
});

describe("analyzePatternPhaseTaps", () => {
  it("measures an ordinary late tapper like the steady analysis", () => {
    const taps = PLAYED_SLOTS.map((slot, index) => slot * BEAT + 300 + (index % 2 === 0 ? -8 : 8));

    const analysis = analyzePatternPhaseTaps(taps, FIXED_PATTERN);

    expect(analysis).not.toBeNull();
    expect(analysis!.medianMs).toBeGreaterThanOrEqual(292);
    expect(analysis!.medianMs).toBeLessThanOrEqual(308);
    expect(analysis!.tapCount).toBe(PLAYED_SLOTS.length);
  });

  it("recovers a consistent EARLY tapper as slightly negative, not aliased a beat late", () => {
    // The steady beat-bucket analysis reads a −50 ms tap as +617 ms on the previous
    // beat — the exact aliasing the gap fingerprint exists to break.
    const taps = PLAYED_SLOTS.map((slot) => slot * BEAT - 50);

    const analysis = analyzePatternPhaseTaps(taps, FIXED_PATTERN);

    expect(analysis).not.toBeNull();
    expect(analysis!.medianMs).toBeGreaterThanOrEqual(-60);
    expect(analysis!.medianMs).toBeLessThanOrEqual(-40);
    expect(analysis!.tapCount).toBe(PLAYED_SLOTS.length);
  });

  it("still resolves a genuinely huge late offset to the late side", () => {
    const taps = PLAYED_SLOTS.map((slot) => slot * BEAT + 600);

    const analysis = analyzePatternPhaseTaps(taps, FIXED_PATTERN);

    expect(analysis).not.toBeNull();
    expect(analysis!.medianMs).toBe(600);
  });

  it("ignores taps at silent slots instead of letting them skew the median", () => {
    // A tapper who keeps tapping through the gaps: gap-slot taps match no played beat.
    const taps = [
      ...PLAYED_SLOTS.map((slot) => slot * BEAT + 250),
      ...[4, 7, 10, 13].map((slot) => slot * BEAT + 250),
    ];

    const analysis = analyzePatternPhaseTaps(taps, FIXED_PATTERN);

    expect(analysis).not.toBeNull();
    expect(analysis!.medianMs).toBe(250);
    expect(analysis!.tapCount).toBe(PLAYED_SLOTS.length);
  });

  it("returns null when too few played beats were tapped", () => {
    const taps = PLAYED_SLOTS.slice(0, 5).map((slot) => slot * BEAT + 300);

    expect(analyzePatternPhaseTaps(taps, FIXED_PATTERN)).toBeNull();
  });

  it("returns null when the spread exceeds the allowed MAD", () => {
    const taps = PLAYED_SLOTS.map((slot, index) => slot * BEAT + (index % 2 === 0 ? 0 : 400));

    expect(analyzePatternPhaseTaps(taps, FIXED_PATTERN)).toBeNull();
  });
});

describe("buildResultWarning", () => {
  it("returns null when either pass is missing", () => {
    expect(buildResultWarning(null, 340, 200)).toBeNull();
    expect(buildResultWarning(600, null, 200)).toBeNull();
    expect(buildResultWarning(null, null, null)).toBeNull();
  });

  it("warns when the music pass is far above the click pass", () => {
    const warning = buildResultWarning(600, 340, null);
    expect(warning).toContain("260 ms");
    expect(warning).toContain("above");
    expect(warning).toContain("retry is recommended");
  });

  it("warns when the music pass is far below the click pass", () => {
    const warning = buildResultWarning(100, 200, null);
    expect(warning).toContain("100 ms");
    expect(warning).toContain("below");
  });

  it("warns when the music pass is far from the OS-reported latency", () => {
    // Gap between passes is fine (50 ms), but 400 vs reported 50 exceeds 300.
    const warning = buildResultWarning(400, 350, 50);
    expect(warning).toContain("OS-reported route latency");
    expect(warning).toContain("400 ms");
    expect(warning).toContain("~50 ms");
  });

  it("returns null for consistent results", () => {
    expect(buildResultWarning(400, 350, 380)).toBeNull();
    // Boundary: a +250 ms pipeline gap is still accepted (strictly greater triggers).
    expect(buildResultWarning(590, 340, null)).toBeNull();
    // Boundary: a -80 ms gap is still accepted (strictly less triggers).
    expect(buildResultWarning(260, 340, null)).toBeNull();
  });
});
