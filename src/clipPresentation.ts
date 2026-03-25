import type { ClipVersion, SongIdea } from "./types";

type PlayableClipOptions = {
  preferPrimaryProjectClip?: boolean;
};

export function getPlayableClipForIdea(
  idea: SongIdea,
  { preferPrimaryProjectClip = true }: PlayableClipOptions = {}
): ClipVersion | null {
  if (idea.kind === "clip") {
    return idea.clips.find((clip) => !!clip.audioUri) ?? null;
  }

  if (preferPrimaryProjectClip) {
    return (
      idea.clips.find((clip) => clip.isPrimary && !!clip.audioUri) ??
      idea.clips.find((clip) => !!clip.audioUri) ??
      null
    );
  }

  return idea.clips.find((clip) => !!clip.audioUri) ?? null;
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
