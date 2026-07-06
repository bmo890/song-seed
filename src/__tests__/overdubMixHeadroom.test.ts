import { buildClipOverdubMixInputs, getMixHeadroomDb } from "../overdub";
import type { ClipVersion } from "../types";

function buildLayeredClip(stemCount: number, stemGainDb = 0): ClipVersion {
  return {
    id: "clip-1",
    title: "Clip",
    notes: "",
    createdAt: 1,
    isPrimary: true,
    audioUri: "file:///master.m4a",
    durationMs: 10_000,
    overdub: {
      stems: Array.from({ length: stemCount }, (_, index) => ({
        id: `stem-${index}`,
        title: `Layer ${index + 1}`,
        audioUri: `file:///stem-${index}.m4a`,
        gainDb: stemGainDb,
        offsetMs: 0,
        tonePreset: "neutral" as const,
        isMuted: false,
        durationMs: 5_000,
        createdAt: 1,
      })),
    },
  };
}

describe("getMixHeadroomDb", () => {
  it("applies no trim to a single source", () => {
    expect(getMixHeadroomDb(1)).toBe(0);
    expect(getMixHeadroomDb(0)).toBe(0);
  });

  it("trims power-preservingly as sources stack (−3dB at 2, ~−7.8dB at 6)", () => {
    expect(getMixHeadroomDb(2)).toBeCloseTo(-3.01, 1);
    expect(getMixHeadroomDb(6)).toBeCloseTo(-7.78, 1);
  });
});

describe("buildClipOverdubMixInputs headroom", () => {
  it("folds the headroom trim into every input's gain", () => {
    const inputs = buildClipOverdubMixInputs(buildLayeredClip(5));
    expect(inputs).toHaveLength(6);
    const headroom = getMixHeadroomDb(6);
    for (const input of inputs) {
      expect(input.gainDb).toBeCloseTo(headroom, 5);
    }
  });

  it("stacks the user's layer gain on top of the headroom", () => {
    const inputs = buildClipOverdubMixInputs(buildLayeredClip(1, 4));
    const headroom = getMixHeadroomDb(2);
    expect(inputs[0].gainDb).toBeCloseTo(headroom, 5); // master at 0dB + headroom
    expect(inputs[1].gainDb).toBeCloseTo(4 + headroom, 5);
  });

  it("excludes muted stems from both the mix and the headroom count", () => {
    const clip = buildLayeredClip(2);
    clip.overdub!.stems[1] = { ...clip.overdub!.stems[1], isMuted: true };
    const inputs = buildClipOverdubMixInputs(clip);
    expect(inputs).toHaveLength(2);
    expect(inputs[0].gainDb).toBeCloseTo(getMixHeadroomDb(2), 5);
  });
});
