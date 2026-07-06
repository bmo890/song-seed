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

export function getClipOverdubStemCount(clip: ClipVersion): number {
  return clip.overdub?.stems.length ?? 0;
}

export function clipHasOverdubs(clip: ClipVersion): boolean {
  return getClipOverdubStemCount(clip) > 0;
}

export function hasClipPlaybackSource(clip: ClipVersion): boolean {
  return Boolean(getClipPlaybackUri(clip));
}
