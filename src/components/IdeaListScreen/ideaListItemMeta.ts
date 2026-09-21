import { fmtCardDuration } from "../../utils";
import { getPlayableClipForIdea } from "../../domain/clipPresentation";
import type { SongIdea } from "../../types";
import type { IdeaListItemMeta } from "./types";

export const projectHasLyrics = (idea: SongIdea) =>
  idea.kind === "project" &&
  (idea.lyrics?.versions ?? []).some((version) =>
    version.document.lines.some((line) => line.text.trim().length > 0 || line.chords.length > 0)
  );

/** The precomputed row model for an idea-list entry. The list model builds these in
 *  bulk; IdeaListItem falls back to building one itself when handed a bare idea. */
export const buildIdeaListItemMeta = (idea: SongIdea): IdeaListItemMeta => {
  const primaryClip = idea.clips.find((clip) => clip.isPrimary) ?? null;
  const playClip = getPlayableClipForIdea(idea) ?? null;
  const hasProjectLyrics = projectHasLyrics(idea);
  const hasProjectClipCount = idea.kind === "project" && idea.clips.length > 0;

  return {
    playClip,
    clipDurationLabel: playClip?.durationMs ? fmtCardDuration(playClip.durationMs) : "0:00",
    projectPrimaryDurationLabel: primaryClip?.durationMs ? fmtCardDuration(primaryClip.durationMs) : "0:00",
    projectClipCount: idea.kind === "project" ? idea.clips.length : 0,
    hasProjectLyrics,
    hasProjectClipCount,
    hasExpandedProjectIndicators: idea.kind === "project" && (hasProjectLyrics || hasProjectClipCount),
  };
};
