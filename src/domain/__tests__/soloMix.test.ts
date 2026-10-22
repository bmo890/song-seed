import { buildClipOverdubMixInputs, buildSoloMixInputs } from "../overdub";

const clip = {
  id: "c",
  audioUri: "take.m4a",
  durationMs: 60_000,
  overdub: {
    stems: [
      { id: "a", title: "A", audioUri: "a.m4a", durationMs: 20_000, offsetMs: 4_000, gainDb: 0, isMuted: false, tonePreset: "neutral" },
      { id: "b", title: "B", audioUri: "b.m4a", durationMs: 20_000, offsetMs: 8_000, gainDb: -3, isMuted: false, tonePreset: "low-cut" },
      { id: "c", title: "C", audioUri: "c.m4a", durationMs: 20_000, offsetMs: 0, gainDb: 2, isMuted: true, tonePreset: "neutral" },
    ],
  },
} as never;

describe("a solo mix", () => {
  it("is silent except for the soloed layers, which keep their mix level and tone", () => {
    const inputs = buildSoloMixInputs(clip, ["b"])!;
    const mix = buildClipOverdubMixInputs(clip);
    const heard = inputs.filter((input) => input.gainDb! > -100);
    expect(heard).toEqual([mix.find((input) => input.inputUri === "b.m4a")]);
    // The take and the unsoloed layer are still inputs, so the file has the mix's length.
    expect(inputs.map((input) => input.inputUri)).toEqual(["take.m4a", "a.m4a", "b.m4a"]);
  });

  it("sums any number of soloed layers, a muted one included", () => {
    const inputs = buildSoloMixInputs(clip, ["a", "c"])!;
    const heard = inputs.filter((input) => input.gainDb! > -100).map((input) => input.inputUri);
    expect(heard).toEqual(["a.m4a", "c.m4a"]);
  });

  it("is nothing when nothing soloed is left", () => {
    expect(buildSoloMixInputs(clip, [])).toBeNull();
    expect(buildSoloMixInputs(clip, ["gone"])).toBeNull();
  });
});
