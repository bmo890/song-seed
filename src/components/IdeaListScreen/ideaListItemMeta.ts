import { fmtDuration } from "../../utils";
import { getIdeaCreatedAt, getIdeaUpdatedAt } from "../../domain/ideaSort";
import { getPlayableClipForIdea } from "../../domain/clipPresentation";
import type { SongIdea } from "../../types";
import type { IdeaListItemMeta } from "./types";

const formatIdeaTimestamp = (timestamp: number) => {
  const dateValue = new Date(timestamp);
  const date = dateValue.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = dateValue.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} • ${time}`;
};

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
  const projectProgressPct =
    idea.kind === "project" ? Math.max(0, Math.min(100, Math.round(idea.completionPct))) : null;

  return {
    playClip,
    clipDurationLabel: playClip?.durationMs ? fmtDuration(playClip.durationMs) : "0:00",
    projectPrimaryDurationLabel: primaryClip?.durationMs ? fmtDuration(primaryClip.durationMs) : "0:00",
    projectClipCount: idea.kind === "project" ? idea.clips.length : 0,
    hasProjectLyrics,
    hasProjectClipCount,
    hasExpandedProjectIndicators: idea.kind === "project" && (hasProjectLyrics || hasProjectClipCount),
    createdAtLabel: formatIdeaTimestamp(getIdeaCreatedAt(idea)),
    updatedAtLabel: formatIdeaTimestamp(getIdeaUpdatedAt(idea)),
    projectProgressPct,
  };
};
