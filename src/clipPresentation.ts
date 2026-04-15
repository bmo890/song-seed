import type { ClipVersion, SongIdea } from "./types";

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
  return clip.overdub?.renderedMixWaveformPeaks?.length
    ? clip.overdub.renderedMixWaveformPeaks
    : clip.waveformPeaks;
}

export function getClipOverdubStemCount(clip: ClipVersion): number {
  return clip.overdub?.stems.length ?? 0;
}

export function clipHasOverdubs(clip: ClipVersion): boolean {
  return getClipOverdubStemCount(clip) > 0;
}

export function clipUsesRenderedMix(clip: ClipVersion): boolean {
  return Boolean(clip.overdub?.renderedMixUri);
}

export function hasClipPlaybackSource(clip: ClipVersion): boolean {
  return Boolean(getClipPlaybackUri(clip));
}
