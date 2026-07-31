import {
  detectTempoFromSamples,
  TEMPO_ANALYSIS_SAMPLE_RATE,
} from "../tempoDetection";

const SAMPLE_RATE = TEMPO_ANALYSIS_SAMPLE_RATE;

function clickTrack(
  bpm: number,
  durationSeconds = 12,
  options: { noise?: number; omitEvery?: number } = {}
): Float32Array {
  const samples = new Float32Array(Math.round(SAMPLE_RATE * durationSeconds));
  const beatFrames = (SAMPLE_RATE * 60) / bpm;
  const clickFrames = Math.round(SAMPLE_RATE * 0.025);
  let beat = 0;
  for (let start = 0; start < samples.length; start = Math.round(++beat * beatFrames)) {
    if (options.omitEvery && beat > 0 && beat % options.omitEvery === 0) continue;
    for (let offset = 0; offset < clickFrames && start + offset < samples.length; offset += 1) {
      const envelope = Math.exp(-offset / (SAMPLE_RATE * 0.006));
      samples[start + offset] += Math.sin((2 * Math.PI * 1_400 * offset) / SAMPLE_RATE) * envelope * 0.8;
    }
  }
  if (options.noise) {
    let state = 0x12345678;
    for (let index = 0; index < samples.length; index += 1) {
      state = (state * 1664525 + 1013904223) >>> 0;
      samples[index] += (((state / 0xffffffff) * 2 - 1) * options.noise);
    }
  }
  return samples;
}

describe("detectTempoFromSamples", () => {
  it.each([40, 60, 92, 120, 180, 240])(
    "detects a clean %i BPM click track within one BPM",
    (bpm) => {
      const estimate = detectTempoFromSamples(clickTrack(bpm), SAMPLE_RATE);
      expect(estimate.bpm).not.toBeNull();
      expect(Math.abs((estimate.bpm ?? 0) - bpm)).toBeLessThanOrEqual(1);
      expect(estimate.confidence).toBeGreaterThanOrEqual(0.55);
    }
  );

  it("stays accurate with background noise and occasional missing beats", () => {
    const estimate = detectTempoFromSamples(
      clickTrack(92, 16, { noise: 0.025, omitEvery: 7 }),
      SAMPLE_RATE
    );
    expect(estimate.bpm).not.toBeNull();
    expect(Math.abs((estimate.bpm ?? 0) - 92)).toBeLessThanOrEqual(1);
  });

  it("abstains on silence", () => {
    expect(detectTempoFromSamples(new Float32Array(SAMPLE_RATE * 12), SAMPLE_RATE).bpm).toBeNull();
  });

  it("abstains when the clip is too short", () => {
    expect(detectTempoFromSamples(clickTrack(120, 2), SAMPLE_RATE).bpm).toBeNull();
  });

  it("abstains on a single isolated transient", () => {
    const samples = new Float32Array(SAMPLE_RATE * 12);
    samples[Math.round(SAMPLE_RATE * 2)] = 1;
    expect(detectTempoFromSamples(samples, SAMPLE_RATE).bpm).toBeNull();
  });

  it("abstains on non-periodic background noise", () => {
    const samples = new Float32Array(SAMPLE_RATE * 12);
    let state = 0x9e3779b9;
    for (let index = 0; index < samples.length; index += 1) {
      state = (state * 1664525 + 1013904223) >>> 0;
      samples[index] = (state / 0xffffffff) * 0.2 - 0.1;
    }
    expect(detectTempoFromSamples(samples, SAMPLE_RATE).bpm).toBeNull();
  });
});
