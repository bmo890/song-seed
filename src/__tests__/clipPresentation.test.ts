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

  it("prefers persisted rendered-mix peaks for overdub playback", () => {
    const renderedMixWaveformPeaks = [0.2, 0.8, 0.3];
    const clip = buildClip({
      waveformPeaks: [0.1],
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
