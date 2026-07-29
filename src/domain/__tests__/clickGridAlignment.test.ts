import {
  estimateClickPhase,
  alignGridToRecordedClicks,
  MIN_CLICK_CONTRAST,
} from "../clickGridAlignment";
import type { RecordingGrid } from "../../types";

const BPM = 92;
const BEAT_MS = 60000 / BPM;

/** Synthesize a sidecar: quiet noise floor with click spikes at phase + k*beat. */
function sidecarWithClicks(args: {
  durationMs: number;
  phaseMs: number;
  bins?: number;
  clickGain?: number;
  noise?: number;
}): number[] {
  const { durationMs, phaseMs, bins = 2048, clickGain = 0.5, noise = 0.05 } = args;
  const msPerBin = durationMs / bins;
  const values = new Array(bins).fill(0).map((_, index) => noise * ((index * 7919) % 13) / 13);
  for (let t = phaseMs; t < durationMs; t += BEAT_MS) {
    const bin = Math.floor(t / msPerBin);
    if (bin >= 0 && bin < bins) values[bin] += clickGain;
  }
  return values;
}

function grid(overrides: Partial<RecordingGrid> = {}): RecordingGrid {
  return {
    bpm: BPM,
    meterId: "3/4",
    countInBars: 0,
    clickThroughTake: true,
    firstDownbeatMs: 0,
    source: "metronome",
    ...overrides,
  };
}

describe("estimateClickPhase", () => {
  it("finds the click phase within a sidecar bin", () => {
    const durationMs = 40000;
    const estimate = estimateClickPhase({
      bins: sidecarWithClicks({ durationMs, phaseMs: 244 }),
      durationMs,
      beatMs: BEAT_MS,
    });
    expect(estimate).not.toBeNull();
    expect(estimate!.contrast).toBeGreaterThan(MIN_CLICK_CONTRAST);
    // one bin at this resolution is ~19.5ms
    expect(Math.abs(estimate!.phaseMs - 244)).toBeLessThan(25);
  });

  it("reports low contrast on click-free audio", () => {
    const durationMs = 40000;
    const bins = new Array(2048).fill(0).map((_, index) => ((index * 104729) % 17) / 17);
    const estimate = estimateClickPhase({ bins, durationMs, beatMs: BEAT_MS });
    expect(estimate === null || estimate.contrast < MIN_CLICK_CONTRAST).toBe(true);
  });

  it("refuses takes too short to measure", () => {
    expect(
      estimateClickPhase({ bins: [1, 2, 3], durationMs: 2000, beatMs: BEAT_MS })
    ).toBeNull();
  });
});

describe("alignGridToRecordedClicks", () => {
  const durationMs = 40000;

  it("corrects a stamped grid by the measured device latency", () => {
    // Grid says the downbeat is at 0; the mic heard clicks 244ms later (uncompensated
    // output+input latency) — the founder's "clicks a half beat off the grid lines".
    const result = alignGridToRecordedClicks({
      grid: grid({ firstDownbeatMs: 0 }),
      bins: sidecarWithClicks({ durationMs, phaseMs: 244 }),
      durationMs,
    });
    expect(result.kind).toBe("corrected");
    if (result.kind === "corrected") {
      expect(Math.abs(result.grid.firstDownbeatMs! - 244)).toBeLessThan(25);
    }
  });

  it("stamps a null downbeat from the audio instead of leaving the take gridless", () => {
    const result = alignGridToRecordedClicks({
      grid: grid({ firstDownbeatMs: null }),
      bins: sidecarWithClicks({ durationMs, phaseMs: 300 }),
      durationMs,
    });
    expect(result.kind).toBe("stamped");
    if (result.kind === "stamped") {
      expect(Math.abs(result.grid.firstDownbeatMs! - 300)).toBeLessThan(25);
    }
  });

  it("leaves an already-aligned grid alone", () => {
    const result = alignGridToRecordedClicks({
      grid: grid({ firstDownbeatMs: 200 }),
      bins: sidecarWithClicks({ durationMs, phaseMs: 205 }),
      durationMs,
    });
    expect(result.kind).toBe("unchanged");
  });

  it("refuses an ambiguous near-half-beat correction", () => {
    const result = alignGridToRecordedClicks({
      grid: grid({ firstDownbeatMs: 0 }),
      bins: sidecarWithClicks({ durationMs, phaseMs: BEAT_MS / 2 }),
      durationMs,
    });
    expect(result.kind).toBe("unchanged");
  });

  it("never touches a grid when the click did not run through the take", () => {
    const result = alignGridToRecordedClicks({
      grid: grid({ clickThroughTake: false, firstDownbeatMs: 0 }),
      bins: sidecarWithClicks({ durationMs, phaseMs: 244 }),
      durationMs,
    });
    expect(result.kind).toBe("unchanged");
  });

  it("never touches noise — a quiet vocal take must not get a hallucinated grid shift", () => {
    const bins = new Array(2048).fill(0).map((_, index) => ((index * 104729) % 17) / 17);
    const result = alignGridToRecordedClicks({
      grid: grid({ firstDownbeatMs: 0 }),
      bins,
      durationMs,
    });
    expect(result.kind).toBe("unchanged");
  });

  it("leaves tempo-mapped takes alone", () => {
    const result = alignGridToRecordedClicks({
      grid: grid({
        firstDownbeatMs: 0,
        tempoMap: {
          schemaVersion: 1,
          segments: [
            { atBar: 1, bpm: BPM, meterId: "3/4" },
            { atBar: 9, bpm: 120, meterId: "4/4" },
          ],
        },
      }),
      bins: sidecarWithClicks({ durationMs, phaseMs: 244 }),
      durationMs,
    });
    expect(result.kind).toBe("unchanged");
  });
});
