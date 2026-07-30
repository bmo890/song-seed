import {
  appendOnsetSamples,
  createOnsetEnvelopeState,
  finishOnsetEnvelope,
  onsetFlux,
  ONSET_BIN_MS,
} from "../onsetEnvelope";
import { alignGridToRecordedClicks, estimateClickPhase } from "../clickGridAlignment";
import type { RecordingGrid } from "../../types";

const SAMPLE_RATE = 44100;
const BPM = 92;
const BEAT_MS = 60000 / BPM;

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

/**
 * A take, as the recorder would hand it over: metronome clicks at a known phase, on top of
 * sustained musical content that is LOUDER than the clicks. This is the case that matters —
 * a bare metronome is easy and is not what people record.
 */
function synthesizeTake({
  durationMs,
  phaseMs,
  clickGain = 0.25,
  musicGain = 0.5,
}: {
  durationMs: number;
  phaseMs: number;
  clickGain?: number;
  musicGain?: number;
}) {
  const total = Math.round((SAMPLE_RATE * durationMs) / 1000);
  const samples = new Float32Array(total);

  // "Music": a low, slowly-swelling tone. Loud, sustained, low-frequency — everything a
  // click is not.
  for (let index = 0; index < total; index += 1) {
    const seconds = index / SAMPLE_RATE;
    samples[index] =
      musicGain * Math.sin(2 * Math.PI * 196 * seconds) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 0.6 * seconds));
  }

  // Clicks: a short high-frequency burst with a fast decay, quieter than the music.
  const clickSamples = Math.round(SAMPLE_RATE * 0.04);
  let deterministic = 12345;
  const click = new Float32Array(clickSamples);
  for (let index = 0; index < clickSamples; index += 1) {
    deterministic = (deterministic * 1103515245 + 12345) & 0x7fffffff;
    const noise = (deterministic / 0x3fffffff) - 1;
    click[index] = noise * Math.exp(-index / (SAMPLE_RATE * 0.006)) * clickGain;
  }
  for (let timeMs = phaseMs; timeMs < durationMs; timeMs += BEAT_MS) {
    const start = Math.round((SAMPLE_RATE * timeMs) / 1000);
    for (let index = 0; index < clickSamples && start + index < total; index += 1) {
      samples[start + index] += click[index];
    }
  }
  return samples;
}

/** Push the take through in realistic delivery-sized chunks. */
function envelopeOf(samples: Float32Array, chunkFrames = Math.round(SAMPLE_RATE * 0.04)) {
  const state = createOnsetEnvelopeState(SAMPLE_RATE, 1);
  for (let offset = 0; offset < samples.length; offset += chunkFrames) {
    appendOnsetSamples(state, samples.subarray(offset, offset + chunkFrames));
  }
  return state;
}

/** The loudness envelope the waveform sidecar is: RMS into 2048 bins, no high-pass. */
function sidecarOf(samples: Float32Array, bins = 2048) {
  const perBin = Math.floor(samples.length / bins);
  const values: number[] = [];
  for (let bin = 0; bin < bins; bin += 1) {
    let sumSquares = 0;
    for (let index = bin * perBin; index < (bin + 1) * perBin; index += 1) {
      sumSquares += (samples[index] ?? 0) ** 2;
    }
    const rms = Math.sqrt(sumSquares / Math.max(1, perBin));
    const db = 20 * Math.log10(Math.max(rms, 0.001));
    values.push(Math.max(0, Math.min(1, (db + 60) / 60)) ** 1.15);
  }
  return values;
}

describe("onset envelope accumulation", () => {
  it("bins at ONSET_BIN_MS and counts every sample", () => {
    const state = envelopeOf(new Float32Array(SAMPLE_RATE)); // exactly 1s of silence
    const envelope = finishOnsetEnvelope(state)!;
    expect(envelope.binMs).toBeCloseTo(44 / 44.1, 5);
    expect(envelope.bins.length).toBeCloseTo(1000 / ONSET_BIN_MS, -1);
  });

  it("is unaffected by how the audio is chunked", () => {
    const samples = synthesizeTake({ durationMs: 4000, phaseMs: 137 });
    const big = finishOnsetEnvelope(envelopeOf(samples, 8192))!;
    const small = finishOnsetEnvelope(envelopeOf(samples, 271))!;
    expect(small.bins.length).toBe(big.bins.length);
    // The high-pass carries across delivery boundaries, so results are identical, not close.
    for (let index = 0; index < big.bins.length; index += 1) {
      expect(small.bins[index]).toBeCloseTo(big.bins[index], 10);
    }
  });

  it("drops the trimmed head so the envelope lands in file ms", () => {
    const state = envelopeOf(synthesizeTake({ durationMs: 3000, phaseMs: 0 }));
    const full = finishOnsetEnvelope(state)!;
    const trimmed = finishOnsetEnvelope(state, 1000)!;
    // Counted in REAL bins, not nominal ones — 1000ms is 1002 bins of 0.9977ms.
    const dropped = Math.round(1000 / full.binMs);
    expect(full.bins.length - trimmed.bins.length).toBe(dropped);
    expect(trimmed.bins[0]).toBeCloseTo(full.bins[dropped], 10);
  });

  it("returns null for a take with no audio", () => {
    expect(finishOnsetEnvelope(createOnsetEnvelopeState(SAMPLE_RATE))).toBeNull();
  });

  it("flux is the rising edge only", () => {
    expect(onsetFlux([0, 5, 3, 4])).toEqual([0, 5, 0, 1]);
  });
});

describe("finding a click under music", () => {
  const durationMs = 20_000;
  const phaseMs = 137;
  const samples = synthesizeTake({ durationMs, phaseMs });

  it("the onset envelope finds the click phase to within a few ms", () => {
    const envelope = finishOnsetEnvelope(envelopeOf(samples))!;
    const estimate = estimateClickPhase({
      signal: { kind: "onset", bins: envelope.bins, binMs: envelope.binMs },
      durationMs,
      beatMs: BEAT_MS,
    })!;
    expect(estimate).not.toBeNull();
    expect(estimate.signalKind).toBe("onset");
    expect(estimate.contrast).toBeGreaterThan(3);
    expect(Math.abs(estimate.phaseMs - phaseMs)).toBeLessThan(5);
  });

  /**
   * The measured reason self-alignment never worked on real takes. Same audio, same comb,
   * same gates — only the signal differs. Documented in docs/qa/grid-truth.md, where the
   * app scored 1.07 on a real take that a sample-level measurement scored 30.3 on.
   */
  it("the loudness envelope does not, which is why the sidecar path was blind", () => {
    const estimate = estimateClickPhase({
      signal: { kind: "sidecar", bins: sidecarOf(samples) },
      durationMs,
      beatMs: BEAT_MS,
    });
    const foundIt =
      estimate != null &&
      estimate.contrast > 1.35 &&
      Math.abs(estimate.phaseMs - phaseMs) < 30;
    expect(foundIt).toBe(false);
  });

  it("corrects a grid that was stamped in the render domain", () => {
    const envelope = finishOnsetEnvelope(envelopeOf(samples))!;
    const result = alignGridToRecordedClicks({
      grid: grid({ firstDownbeatMs: 0 }),
      signal: { kind: "onset", bins: envelope.bins, binMs: envelope.binMs },
      durationMs,
    });
    expect(result.kind).toBe("corrected");
    if (result.kind === "corrected") {
      expect(result.signalKind).toBe("onset");
      expect(Math.abs(result.grid.firstDownbeatMs! - phaseMs)).toBeLessThan(5);
    }
  });

  /**
   * A 6.3s take (about ten beats at 92bpm) used to be refused as "too short to verify",
   * because the phase-lock gate wanted six beats in EACH half. Measured on a real one: the
   * click scored contrast 452 with a 0.6ms spread and the grid was 68ms early — overwhelming
   * evidence, thrown away. Short takes verify now, against a much higher contrast bar.
   */
  it("verifies a short take when the click is unmistakable", () => {
    const shortMs = 6_300;
    const short = synthesizeTake({ durationMs: shortMs, phaseMs: 83, clickGain: 0.6, musicGain: 0.2 });
    const envelope = finishOnsetEnvelope(envelopeOf(short))!;
    const result = alignGridToRecordedClicks({
      grid: grid({ firstDownbeatMs: 15 }),
      signal: { kind: "onset", bins: envelope.bins, binMs: envelope.binMs },
      durationMs: shortMs,
    });
    expect(result.kind).toBe("corrected");
    if (result.kind === "corrected") {
      expect(Math.abs(result.grid.firstDownbeatMs! - 83)).toBeLessThan(6);
    }
  });

  it("does not let a short take with a weak signal move the grid", () => {
    const shortMs = 6_300;
    const weak = synthesizeTake({ durationMs: shortMs, phaseMs: 83, clickGain: 0.01, musicGain: 0.6 });
    const envelope = finishOnsetEnvelope(envelopeOf(weak))!;
    const result = alignGridToRecordedClicks({
      grid: grid({ firstDownbeatMs: 15 }),
      signal: { kind: "onset", bins: envelope.bins, binMs: envelope.binMs },
      durationMs: shortMs,
    });
    expect(result.kind).toBe("unchanged");
  });

  it("still refuses a take with no click in it", () => {
    const noClicks = synthesizeTake({ durationMs, phaseMs, clickGain: 0 });
    const envelope = finishOnsetEnvelope(envelopeOf(noClicks))!;
    const result = alignGridToRecordedClicks({
      grid: grid({ firstDownbeatMs: 0 }),
      signal: { kind: "onset", bins: envelope.bins, binMs: envelope.binMs },
      durationMs,
    });
    expect(result.kind).toBe("unchanged");
  });
});
