import type { ClipVersion, SongIdea } from "./types";
import { buildStaticWaveform } from "./utils";

type PlayableClipOptions = {
  preferPrimaryProjectClip?: boolean;
};

export function getPlayableClipForIdea(
  idea: SongIdea,
  { preferPrimaryProjectClip = true }: PlayableClipOptions = {}
): ClipVersion | null {
  if (idea.kind === "clip") {
    return idea.clips.find((clip) => hasClipPlaybackSource(clip)) ?? null;
  }

  if (preferPrimaryProjectClip) {
    return (
      idea.clips.find((clip) => clip.isPrimary && hasClipPlaybackSource(clip)) ??
      idea.clips.find((clip) => hasClipPlaybackSource(clip)) ??
      null
    );
  }

  return idea.clips.find((clip) => hasClipPlaybackSource(clip)) ?? null;
}

export function buildPlayableQueueFromIdeas(
  ideas: SongIdea[],
  options?: PlayableClipOptions
): Array<{ ideaId: string; clipId: string }> {
  return ideas
    .map((idea) => {
      const clip = getPlayableClipForIdea(idea, options);
      if (!clip) return null;
      return { ideaId: idea.id, clipId: clip.id };
    })
    .filter((item): item is { ideaId: string; clipId: string } => !!item);
}

export function getClipPlaybackUri(clip: ClipVersion): string | undefined {
  return clip.overdub?.renderedMixUri || clip.audioUri;
}

export function getClipPlaybackDurationMs(clip: ClipVersion): number | undefined {
  return clip.overdub?.renderedMixDurationMs || clip.durationMs;
}

export function getClipPlaybackWaveformPeaks(clip: ClipVersion): number[] | undefined {
  // The clip's visual identity is the MASTER's waveform. Layers draw as their own lanes
  // under the reel, so the wave itself must not reshuffle after every layer edit — the
  // rendered-mix peaks are lightweight placeholders that made the reel jump to a new
  // random-looking shape on each background render.
  return clip.waveformPeaks?.length ? clip.waveformPeaks : clip.overdub?.renderedMixWaveformPeaks;
}

export function getClipPlaybackWaveformPeaksOrFallback(
  clip: ClipVersion,
  peakCount = 256
): number[] {
  const storedPeaks = getClipPlaybackWaveformPeaks(clip);
  return storedPeaks?.length
    ? storedPeaks
    : buildStaticWaveform(`${clip.id}-${getClipPlaybackDurationMs(clip) ?? 0}`, peakCount);
}

// A REAL analyzed waveform is full-resolution (this equals audioStorage's
// MANAGED_WAVEFORM_PEAK_COUNT — kept as a local literal so this pure presentation
// helper doesn't pull in the native audio module). Anything shorter is a placeholder:
// a fresh import stores a sub-resolution one until background analysis lands.
const REAL_WAVEFORM_MIN_PEAK_COUNT = 256;
// Display density for a placeholder in the zoomable PLAYER reel. The reel caps its bar
// count at the source length, so a ~128-point placeholder gets stretched into sparse
// ticks at high zoom; a dense synthetic renders as a full, calm band instead. This is
// DISPLAY-only — the clip's stored placeholder stays sub-resolution so the hydration
// state machine still treats it as "needs real analysis".
const PLACEHOLDER_REEL_PEAK_COUNT = 1024;

/**
 * Peaks for the zoomable PLAYER reel. Real analyzed peaks are used as-is; a placeholder
 * (or a clip with none) becomes a DENSE synthetic wave so the reel doesn't stretch a
 * low-res source into sparse bars at high zoom. Distinct from
 * getClipPlaybackWaveformPeaksOrFallback (which selects the source and is also used by
 * non-zoomable surfaces that don't need the extra density).
 */
export function getClipReelWaveformPeaks(
  clip: ClipVersion,
  placeholderPeakCount = PLACEHOLDER_REEL_PEAK_COUNT
): number[] {
  const storedPeaks = getClipPlaybackWaveformPeaks(clip);
  if (storedPeaks?.length && storedPeaks.length >= REAL_WAVEFORM_MIN_PEAK_COUNT) {
    return storedPeaks;
  }
  return buildStaticWaveform(`${clip.id}-${getClipPlaybackDurationMs(clip) ?? 0}`, placeholderPeakCount);
}

export function getClipOverdubStemCount(clip: ClipVersion): number {
  return clip.overdub?.stems.length ?? 0;
}

export function clipHasOverdubs(clip: ClipVersion): boolean {
  return getClipOverdubStemCount(clip) > 0;
}

export function hasClipPlaybackSource(clip: ClipVersion): boolean {
  return Boolean(getClipPlaybackUri(clip));
}
