import { downmixInterleaved } from "../domain/stereoDownmix";

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
