import { buildTunerReading } from "../domain/tuner";
import {
  TRACKER_CONFIG,
  createTrackerState,
  foldOctaveTowardReference,
  isTrackerStale,
  smoothCents,
  trackPitchFrame,
  type PitchFrame,
  type TrackerState,
} from "../domain/tunerTracker";

const E2 = 82.4069;
const A2 = 110;
const E4 = 329.6276;

function cents(frequency: number, reference: number) {
  return 1200 * Math.log2(frequency / reference);
}

function detuned(frequency: number, byCents: number) {
  return frequency * Math.pow(2, byCents / 1200);
}

function feed(
  state: TrackerState,
  frames: Array<Partial<PitchFrame> & { pitch: number }>,
  startAt = 1000,
  stepMs = 100
) {
  let current = state;
  let output = null;
  frames.forEach((frame, index) => {
    const result = trackPitchFrame(current, {
      clarity: 0.98,
      timestamp: startAt + index * stepMs,
      ...frame,
    });
    current = result.state;
    output = result.output;
  });
  return { state: current, output: output as ReturnType<typeof trackPitchFrame>["output"] };
}

describe("buildTunerReading", () => {
  it("names notes across the instrument range", () => {
    expect(buildTunerReading(E2)).toMatchObject({ noteName: "E", octave: 2 });
    expect(buildTunerReading(440)).toMatchObject({ noteName: "A", octave: 4 });
    expect(buildTunerReading(30.868)).toMatchObject({ noteName: "B", octave: 0 });
    expect(buildTunerReading(20)).toBeNull();
    expect(buildTunerReading(NaN)).toBeNull();
  });
});

describe("trackPitchFrame", () => {
  it("shows a confident frame immediately", () => {
    const { output } = feed(createTrackerState(), [{ pitch: detuned(A2, -7) }]);
    expect(output).not.toBeNull();
    expect(output?.noteName).toBe("A");
    expect(output?.octave).toBe(2);
    expect(output?.centsOff).toBeCloseTo(-7, 1);
  });

  it("makes a shaky frame wait for one agreeing neighbour", () => {
    const first = feed(createTrackerState(), [{ pitch: A2, clarity: 0.85 }]);
    expect(first.output).toBeNull();
    expect(first.state.pending).toEqual({ noteKey: "A2", count: 1 });

    const second = feed(first.state, [{ pitch: detuned(A2, 3), clarity: 0.85 }], 1100);
    expect(second.output?.noteName).toBe("A");
  });

  it("ignores frames below the clarity floor and out-of-range pitches", () => {
    const { state, output } = feed(createTrackerState(), [
      { pitch: A2, clarity: 0.4 },
      { pitch: -1, clarity: 0 },
      { pitch: 5000 },
    ]);
    expect(output).toBeNull();
    expect(state.activeNoteKey).toBeNull();
  });

  it("treats a missing clarity (older native build) as confident", () => {
    const { output } = feed(createTrackerState(), [{ pitch: E4, clarity: undefined }]);
    expect(output?.noteName).toBe("E");
  });

  it("follows the held note through a median of recent cents", () => {
    const held = feed(createTrackerState(), [
      { pitch: detuned(A2, -10) },
      { pitch: detuned(A2, -10) },
      { pitch: detuned(A2, -10) },
    ]);
    expect(held.output?.centsOff).toBeCloseTo(-10, 0);

    // A single glitch frame is absorbed by the median.
    const glitched = feed(held.state, [{ pitch: detuned(A2, 30) }], 1300);
    expect(glitched.output?.centsOff).toBeCloseTo(-10, 0);
  });

  it("switches note immediately on a confident frame of a different note", () => {
    const onA = feed(createTrackerState(), [{ pitch: A2 }, { pitch: A2 }]);
    const onE = feed(onA.state, [{ pitch: E4 }], 1200);
    expect(onE.output?.noteName).toBe("E");
    expect(onE.output?.octave).toBe(4);
  });

  it("does not fold a real octave jump back onto the previous note", () => {
    // Low E then high E: the classic case the old history normaliser got wrong.
    const onE2 = feed(createTrackerState(), [{ pitch: E2 }, { pitch: E2 }]);
    const onE4 = feed(onE2.state, [{ pitch: E4 }], 1200);
    expect(onE4.output?.octave).toBe(4);
  });

  it("folds an unconfident octave slip back onto the held note", () => {
    const onE2 = feed(createTrackerState(), [{ pitch: E2 }, { pitch: E2 }]);
    const slipped = feed(onE2.state, [{ pitch: E2 * 2 * Math.pow(2, 4 / 1200), clarity: 0.85 }], 1200);
    expect(slipped.output?.noteName).toBe("E");
    expect(slipped.output?.octave).toBe(2);
    expect(slipped.state.pending).toBeNull();
  });

  it("holds the note name across the ±50 cent boundary (hysteresis)", () => {
    const flatA = detuned(A2, -46);
    const held = feed(createTrackerState(), [{ pitch: flatA }, { pitch: flatA }]);
    expect(held.output?.noteName).toBe("A");

    // Drifting to -54 cents is still A (pegged), not G#.
    const drifted = feed(held.state, [{ pitch: detuned(A2, -54) }], 1200);
    expect(drifted.output?.noteName).toBe("A");
    expect(drifted.state.activeNoteKey).toBe("A2");

    // Past the hysteresis band it becomes G#.
    const beyond = feed(held.state, [{ pitch: detuned(A2, -62) }], 1200);
    expect(beyond.output?.noteName).toBe("G#");
  });

  it("reaches the target within a few frames instead of a second", () => {
    const first = feed(createTrackerState(), [{ pitch: detuned(A2, 20) }]);
    expect(first.output?.centsOff).toBeCloseTo(20, 1);

    // Peg turned: the needle should be most of the way to the new value in 3 frames.
    const moved = feed(first.state, [
      { pitch: detuned(A2, 2) },
      { pitch: detuned(A2, 2) },
      { pitch: detuned(A2, 2) },
    ], 1100);
    expect(Math.abs((moved.output?.centsOff ?? 99) - 2)).toBeLessThan(5);
  });

  it("reports the smoothed frequency consistent with the displayed cents", () => {
    const { output } = feed(createTrackerState(), [{ pitch: detuned(E4, 12) }]);
    expect(output).not.toBeNull();
    expect(cents(output!.frequency, output!.referenceFrequency)).toBeCloseTo(output!.centsOff, 6);
  });
});

describe("smoothCents", () => {
  it("snaps to the first value and clamps to the meter range", () => {
    expect(smoothCents(null, 80)).toBe(50);
    expect(smoothCents(null, -3)).toBe(-3);
  });

  it("moves faster on dramatic changes than on fine adjustments", () => {
    const dramatic = smoothCents(0, 40);
    const fine = smoothCents(0, 10);
    expect(dramatic / 40).toBeGreaterThan(fine / 10);
    expect(dramatic / 40).toBeCloseTo(TRACKER_CONFIG.smoothing.dramatic, 5);
  });

  it("calms down inside the in-tune band", () => {
    const inTune = smoothCents(1, 4);
    expect((inTune - 1) / 3).toBeCloseTo(TRACKER_CONFIG.smoothing.inTune, 5);
  });
});

describe("foldOctaveTowardReference", () => {
  it("folds an octave up or down within tolerance", () => {
    expect(foldOctaveTowardReference(E2 * 2, E2)).toBeCloseTo(E2, 3);
    expect(foldOctaveTowardReference(E2 / 2, E2)).toBeCloseTo(E2, 3);
  });

  it("leaves unrelated pitches alone", () => {
    expect(foldOctaveTowardReference(A2, E2)).toBeNull();
  });
});

describe("isTrackerStale", () => {
  it("is stale before any frame and after the hold window", () => {
    const fresh = createTrackerState();
    expect(isTrackerStale(fresh, 5000)).toBe(true);

    const { state } = feed(fresh, [{ pitch: A2 }], 1000);
    expect(isTrackerStale(state, 1000 + TRACKER_CONFIG.holdMs)).toBe(false);
    expect(isTrackerStale(state, 1000 + TRACKER_CONFIG.holdMs + 1)).toBe(true);
  });
});
