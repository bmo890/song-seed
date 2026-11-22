import { createStereoMeter, downmixInterleaved, judgeStereo, meterStereo } from "../domain/stereoDownmix";

describe("downmixInterleaved", () => {
  it("leaves a mono stream as it is", () => {
    const mono = new Float32Array([0.1, -0.2, 0.3]);
    expect(downmixInterleaved(mono, 1)).toBe(mono);
  });

  it("averages each L R pair into one sample, so the stream keeps one channel's clock", () => {
    const stereo = new Float32Array([1, 0, 0.5, 0.5, -1, 1, 0.2, 0.4]);
    const mono = downmixInterleaved(stereo, 2);
    expect(mono).toHaveLength(4);
    expect(Array.from(mono)).toEqual([0.5, 0.5, 0, expect.closeTo(0.3, 6)]);
  });

  it("drops a half frame at the end rather than inventing a sample", () => {
    expect(downmixInterleaved(new Float32Array([0.2, 0.4, 0.6]), 2)).toHaveLength(1);
  });
});


/** Interleave two channels of `frames` samples made by `left(n)` and `right(n)`. */
function pair(frames: number, left: (n: number) => number, right: (n: number) => number) {
  const out = new Float32Array(frames * 2);
  for (let n = 0; n < frames; n++) {
    out[n * 2] = left(n);
    out[n * 2 + 1] = right(n);
  }
  return out;
}

function judge(samples: Float32Array, chunk = 4096 * 2) {
  const meter = createStereoMeter();
  for (let at = 0; at < samples.length; at += chunk) meterStereo(meter, samples.subarray(at, at + chunk));
  return judgeStereo(meter);
}

// A deterministic noise-ish source, the kind of broadband sound a room gives.
const noise = (seed: number) => (n: number) => Math.sin(n * 12.9898 + seed) * 43758.5453 % 1 * 0.3;
const THREE_SECONDS = 44_100 * 3;

describe("judgeStereo", () => {
  it("hears one mic copied into both sides", () => {
    const source = noise(1);
    expect(judge(pair(THREE_SECONDS, source, source))).toBe("copied");
  });

  it("hears a missing side", () => {
    expect(judge(pair(THREE_SECONDS, noise(1), () => 0))).toBe("one-sided");
  });

  it("hears two mics that share most of the sound but not all of it", () => {
    const shared = noise(1);
    const own = noise(2);
    expect(judge(pair(THREE_SECONDS, shared, (n) => shared(n) * 0.9 + own(n) * 0.2))).toBe("stereo");
  });

  it("says nothing about a short or silent take", () => {
    expect(judge(pair(44_100, noise(1), noise(1)))).toBe("unsure");
    expect(judge(pair(THREE_SECONDS, () => 0, () => 0))).toBe("unsure");
  });
});
