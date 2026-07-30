import { describeGridPosition, resolveResumeClickPhase } from "../resumeClickPhase";
import { normalizeTempoMap } from "../tempoMap";

const BPM = 92;
const BEAT = 60000 / BPM; // 652.17ms
const PULSES = 3; // 3/4
const BAR = BEAT * PULSES; // 1956.5ms

const BASE = {
  firstBeatCaptureMs: 1000,
  beatMs: BEAT,
  pulsesPerBar: PULSES,
};

describe("resolveResumeClickPhase", () => {
  it("continues the bar the take was paused in", () => {
    // Paused two bars and one beat past the downbeat: the click must come back in one beat
    // into a bar, not on a fresh downbeat.
    const captureMs = 1000 + 2 * BAR + BEAT;
    const phase = resolveResumeClickPhase({ ...BASE, captureMs })!;
    expect(phase.unit).toBe("bar");
    expect(phase.offsetMs).toBeCloseTo(BEAT, 6);
  });

  it("comes back in on the downbeat when that is where the pause landed", () => {
    const phase = resolveResumeClickPhase({ ...BASE, captureMs: 1000 + 4 * BAR })!;
    expect(phase.offsetMs).toBeCloseTo(0, 6);
  });

  it("always lands inside one bar", () => {
    for (let offset = 0; offset < BAR * 3; offset += 97) {
      const phase = resolveResumeClickPhase({ ...BASE, captureMs: 1000 + offset })!;
      expect(phase.offsetMs).toBeGreaterThanOrEqual(0);
      expect(phase.offsetMs).toBeLessThan(BAR);
    }
  });

  // The click is started early on a monitored route so what the ear hears matches what the
  // mic takes. Without rolling the phase back by the same amount, the compensation itself
  // would push the click off the grid by exactly the compensation.
  it("rolls the phase back by however early the click is started", () => {
    const captureMs = 1000 + 2 * BAR + BEAT;
    const plain = resolveResumeClickPhase({ ...BASE, captureMs })!;
    const monitored = resolveResumeClickPhase({ ...BASE, captureMs, startsEarlyByMs: 120 })!;
    expect(plain.offsetMs - monitored.offsetMs).toBeCloseTo(120, 6);
  });

  it("declines when the pause landed before the take musically started", () => {
    expect(resolveResumeClickPhase({ ...BASE, captureMs: 400 })).toBeNull();
  });

  it("declines on a grid it cannot use", () => {
    expect(resolveResumeClickPhase({ ...BASE, captureMs: 5000, beatMs: 0 })).toBeNull();
    expect(resolveResumeClickPhase({ ...BASE, captureMs: 5000, pulsesPerBar: 0 })).toBeNull();
    expect(resolveResumeClickPhase({ ...BASE, captureMs: NaN })).toBeNull();
  });

  describe("with a programmed tempo map", () => {
    const tempoMap = normalizeTempoMap({
      schemaVersion: 1,
      segments: [
        { atBar: 1, bpm: BPM, meterId: "3/4" },
        { atBar: 9, bpm: 102, meterId: "4/4" },
      ],
    });

    // In map mode the native engine reads the offset as a position along the WHOLE grid, not
    // within a bar — the map is what carries the meter changes.
    it("hands the engine a whole-grid position", () => {
      const captureMs = 1000 + 5 * BAR;
      const phase = resolveResumeClickPhase({ ...BASE, captureMs, tempoMap })!;
      expect(phase.unit).toBe("grid");
      expect(phase.offsetMs).toBeCloseTo(5 * BAR, 6);
    });

    it("treats a single-segment map as plain single tempo", () => {
      const single = normalizeTempoMap({
        schemaVersion: 1,
        segments: [{ atBar: 1, bpm: BPM, meterId: "3/4" }],
      });
      const phase = resolveResumeClickPhase({
        ...BASE,
        captureMs: 1000 + 2 * BAR + BEAT,
        tempoMap: single,
      })!;
      expect(phase.unit).toBe("bar");
      expect(phase.offsetMs).toBeCloseTo(BEAT, 6);
    });
  });
});

describe("describeGridPosition", () => {
  it("names the bar and beat a pause landed on", () => {
    expect(describeGridPosition({ ...BASE, captureMs: 1000 })).toEqual({ bar: 1, beat: 1 });
    expect(describeGridPosition({ ...BASE, captureMs: 1000 + BEAT })).toEqual({ bar: 1, beat: 2 });
    expect(describeGridPosition({ ...BASE, captureMs: 1000 + 3 * BEAT })).toEqual({
      bar: 2,
      beat: 1,
    });
  });

  it("follows the map across a meter change", () => {
    const tempoMap = normalizeTempoMap({
      schemaVersion: 1,
      segments: [
        { atBar: 1, bpm: BPM, meterId: "3/4" },
        { atBar: 9, bpm: 102, meterId: "4/4" },
      ],
    });
    // Bar 9 beat 1 is where the change lands: eight 3/4 bars in.
    expect(describeGridPosition({ ...BASE, captureMs: 1000 + 8 * BAR, tempoMap })).toEqual({
      bar: 9,
      beat: 1,
    });
  });

  it("returns null before the downbeat", () => {
    expect(describeGridPosition({ ...BASE, captureMs: 0 })).toBeNull();
  });
});
