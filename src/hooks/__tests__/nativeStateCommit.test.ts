import { shouldCommitNativeState } from "../nativeStateCommit";

const base = {
  isAvailable: true,
  isLoaded: true,
  isPlaying: true,
  didJustFinish: false,
  currentTimeMs: 10_100,
  durationMs: 64_000,
  playbackRate: 1,
  pitchShiftSemitones: 2,
  sourceUri: "file:///a.m4a",
};

describe("shouldCommitNativeState", () => {
  it("a tick inside the same second does not render", () => {
    expect(shouldCommitNativeState(base, { ...base, currentTimeMs: 10_200 }, 0, 5_000)).toBe(false);
  });

  it("the clock turning over a second renders, as the plain player does", () => {
    expect(shouldCommitNativeState(base, { ...base, currentTimeMs: 11_000 }, 0, 5_000)).toBe(true);
  });

  it("not twice within the throttle window", () => {
    expect(shouldCommitNativeState(base, { ...base, currentTimeMs: 11_000 }, 4_900, 5_000)).toBe(false);
  });

  it("play, pause, pitch and speed changes render at once", () => {
    expect(shouldCommitNativeState(base, { ...base, isPlaying: false }, 4_999, 5_000)).toBe(true);
    expect(shouldCommitNativeState(base, { ...base, pitchShiftSemitones: 3 }, 4_999, 5_000)).toBe(true);
    expect(shouldCommitNativeState(base, { ...base, playbackRate: 0.75 }, 4_999, 5_000)).toBe(true);
    expect(shouldCommitNativeState(base, { ...base, soundTonePreset: "lowCut" }, 4_999, 5_000)).toBe(true);
  });

  it("a jump renders at once", () => {
    expect(shouldCommitNativeState(base, { ...base, currentTimeMs: 30_000 }, 4_999, 5_000)).toBe(true);
  });
});
