import { buildMergeLayerInputs, getMixHeadroomDb } from "../overdub";

const stem = (offsetMs: number, durationMs: number, gainDb = 0, tonePreset = "neutral") => ({
  audioUri: `file:///stem-${offsetMs}.wav`,
  offsetMs,
  durationMs,
  gainDb,
  tonePreset,
});

test("five harmony spots merge from the earliest, each at its own place", () => {
  const { startMs, inputs } = buildMergeLayerInputs([
    stem(40_000, 4_000),
    stem(8_000, 3_000),
    stem(20_000, 5_000),
    stem(61_000, 2_000),
    stem(90_000, 6_000),
  ]);
  expect(startMs).toBe(8_000);
  expect(inputs.map((input) => input.offsetMs)).toEqual([32_000, 0, 12_000, 53_000, 82_000]);
});

test("side-by-side spots keep their level; each layer's own level and tone carry over", () => {
  const { inputs } = buildMergeLayerInputs([stem(0, 2_000, -3, "low-cut"), stem(5_000, 2_000, 2)]);
  expect(inputs.map((input) => input.gainDb)).toEqual([-3, 2]);
  expect(inputs[0].tonePreset).toBe("low-cut");
});

test("overlapping layers take headroom for how many sound at once", () => {
  const { inputs } = buildMergeLayerInputs([stem(0, 10_000), stem(2_000, 3_000), stem(20_000, 1_000)]);
  expect(inputs[0].gainDb).toBeCloseTo(getMixHeadroomDb(2));
  expect(inputs[2].gainDb).toBeCloseTo(getMixHeadroomDb(2));
});

test("a layer nudged before the take's start merges from there", () => {
  const { startMs, inputs } = buildMergeLayerInputs([stem(-150, 2_000), stem(4_000, 1_000)]);
  expect(startMs).toBe(-150);
  expect(inputs.map((input) => input.offsetMs)).toEqual([0, 4_150]);
});
