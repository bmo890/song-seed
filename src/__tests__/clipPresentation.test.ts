import {
  getClipPlaybackWaveformPeaksOrFallback,
} from "../clipPresentation";
import type { ClipVersion } from "../types";

function buildClip(overrides: Partial<ClipVersion> = {}): ClipVersion {
  return {
    id: "clip-1",
    title: "Clip",
    notes: "",
    createdAt: 1,
    isPrimary: true,
    durationMs: 1_000,
    ...overrides,
  };
}

describe("getClipPlaybackWaveformPeaksOrFallback", () => {
  it("returns persisted clip peaks without rebuilding them", () => {
    const waveformPeaks = [0.1, 0.4, 0.2];

    expect(getClipPlaybackWaveformPeaksOrFallback(buildClip({ waveformPeaks }))).toBe(
      waveformPeaks
    );
  });

  it("prefers the MASTER's peaks for layered clips — layers render as their own lanes, so the wave must stay stable across mix re-renders", () => {
    const masterPeaks = [0.1, 0.5, 0.2];
    const clip = buildClip({
      waveformPeaks: masterPeaks,
      overdub: {
        stems: [],
        renderedMixUri: "file:///mix.m4a",
        renderedMixWaveformPeaks: [0.2, 0.8, 0.3],
      },
    });

    expect(getClipPlaybackWaveformPeaksOrFallback(clip)).toBe(masterPeaks);
  });

  it("falls back to rendered-mix peaks only when the master has none", () => {
    const renderedMixWaveformPeaks = [0.2, 0.8, 0.3];
    const clip = buildClip({
      waveformPeaks: undefined,
      overdub: {
        stems: [],
        renderedMixUri: "file:///mix.m4a",
        renderedMixWaveformPeaks,
      },
    });

    expect(getClipPlaybackWaveformPeaksOrFallback(clip)).toBe(renderedMixWaveformPeaks);
  });

  it("builds an immediate deterministic fallback for legacy clips without peaks", () => {
    const clip = buildClip({ waveformPeaks: undefined });

    expect(getClipPlaybackWaveformPeaksOrFallback(clip, 32)).toEqual(
      getClipPlaybackWaveformPeaksOrFallback(clip, 32)
    );
    expect(getClipPlaybackWaveformPeaksOrFallback(clip, 32)).toHaveLength(32);
  });
});
