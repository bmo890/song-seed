import type { SongIdea } from "../types";

/**
 * Quick record creates its idea BEFORE the recorder opens (so the take has a home
 * the moment it lands). If the recorder is left without a take, that idea is an
 * empty clip-kind shell: 00:00, greyed play, nothing to open — the "recovered-
 * looking idea" from the 2026-09-07 Android field report. It must go.
 *
 * Only a clip-kind idea with no clips qualifies. A sketch (project) may be empty
 * on purpose, and an idea that already holds a take is never touched.
 */
export function isEmptyRecordingPlaceholder(idea: SongIdea | undefined | null): idea is SongIdea {
  return !!idea && idea.kind === "clip" && idea.clips.length === 0;
}

/** Returns the same array when nothing is removed, so callers can skip a write. */
export function removeEmptyRecordingPlaceholder(ideas: SongIdea[], recordingIdeaId: string | null): SongIdea[] {
  if (!recordingIdeaId) return ideas;
  const target = ideas.find((idea) => idea.id === recordingIdeaId);
  if (!isEmptyRecordingPlaceholder(target)) return ideas;
  return ideas.filter((idea) => idea.id !== recordingIdeaId);
}
