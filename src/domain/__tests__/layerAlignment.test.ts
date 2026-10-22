import { measureLayerAgainstGuide } from "../layerAlignment";

/** A song-like envelope: sparse onsets of varied strength over a noise floor. */
function songEnvelope(lengthMs: number, seed = 7): number[] {
  let state = seed;
  const random = () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
  const bins = new Array<number>(lengthMs).fill(0).map(() => 0.02 * random());
  for (let ms = 0; ms < lengthMs; ms += 90 + Math.floor(random() * 220)) {
    const strength = 0.3 + random();
    for (let k = 0; k < 25 && ms + k < lengthMs; k += 1) bins[ms + k] += strength * Math.exp(-k / 6);
  }
  return bins;
}

/** The layer: what a microphone `lateMs` behind would have heard of the song from `offsetMs`. */
function heardLayer(song: number[], offsetMs: number, lateMs: number, lengthMs: number, noise = 0.05) {
  let state = 3;
  const out = new Array<number>(lengthMs);
  for (let k = 0; k < lengthMs; k += 1) {
    state = (state * 1103515245 + 12345) % 2147483648;
    const source = song[offsetMs + k - lateMs] ?? 0;
    out[k] = 0.4 * source + noise * (state / 2147483648);
  }
  return out;
}

describe("measuring a layer against the song it heard", () => {
  const song = songEnvelope(40_000);

  it("finds how late the layer is", () => {
    const layer = heardLayer(song, 12_000, 37, 15_000);
    const result = measureLayerAgainstGuide({
      layer: { bins: layer, binMs: 1 },
      guide: { bins: song.slice(11_000, 28_000), binMs: 1 },
      guideStartMs: 11_000,
      offsetMs: 12_000,
    });
    expect(result).not.toBeNull();
    expect(result!.residualMs).toBeCloseTo(37, 0);
  });

  it("finds an early layer too, through a non-millisecond bin", () => {
    const layer = heardLayer(song, 5_000, -22, 12_000);
    // 0.9977 ms bins, as a 44.1 kHz capture really has them.
    const binMs = 44 / 44.1;
    const resampled = Array.from({ length: Math.floor(layer.length / binMs) }, (_, i) => layer[Math.floor(i * binMs)]);
    const result = measureLayerAgainstGuide({
      layer: { bins: resampled, binMs },
      guide: { bins: song, binMs: 1 },
      guideStartMs: 0,
      offsetMs: 5_000,
    });
    expect(result).not.toBeNull();
    expect(Math.abs(result!.residualMs - -22)).toBeLessThan(1.5);
  });

  it("moves nothing when the microphone heard no song (headphones)", () => {
    const silence = heardLayer(new Array(40_000).fill(0), 0, 0, 12_000, 0.3);
    expect(
      measureLayerAgainstGuide({
        layer: { bins: silence, binMs: 1 },
        guide: { bins: song, binMs: 1 },
        guideStartMs: 0,
        offsetMs: 2_000,
      })
    ).toBeNull();
  });
});
