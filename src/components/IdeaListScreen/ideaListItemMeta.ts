import { fmtCardDuration } from "../../utils";
import { getPlayableClipForIdea } from "../../domain/clipPresentation";
import { buildClipLineages } from "../../domain/clipGraph";
import type { SongIdea } from "../../types";
import type { IdeaListItemMeta } from "./types";

export const projectHasLyrics = (idea: SongIdea) =>
  idea.kind === "project" &&
  (idea.lyrics?.versions ?? []).some((version) =>
    version.document.lines.some((line) => line.text.trim().length > 0 || line.chords.length > 0)
  );

/** The precomputed row model for an idea-list entry. Rows read it through
 *  getIdeaListItemMeta, which caches by idea identity: an untouched idea keeps its
 *  object across library writes, so its meta is built once. */
export const buildIdeaListItemMeta = (idea: SongIdea): IdeaListItemMeta => {
  const primaryClip = idea.clips.find((clip) => clip.isPrimary) ?? null;
  const playClip = getPlayableClipForIdea(idea) ?? null;
  const hasProjectLyrics = projectHasLyrics(idea);
  const hasProjectClipCount = idea.kind === "project" && idea.clips.length > 0;

  return {
    playClip,
    clipDurationLabel: playClip?.durationMs ? fmtCardDuration(playClip.durationMs) : "0:00",
    projectPrimaryDurationLabel: primaryClip?.durationMs ? fmtCardDuration(primaryClip.durationMs) : "0:00",
    // Takes as the sketch page counts them: a take and its older versions are one.
    projectClipCount: idea.kind === "project" ? buildClipLineages(idea.clips).length : 0,
    hasProjectLyrics,
    hasProjectClipCount,
    hasExpandedProjectIndicators: idea.kind === "project" && (hasProjectLyrics || hasProjectClipCount),
  };
};

const metaByIdea = new WeakMap<SongIdea, IdeaListItemMeta>();

export function getIdeaListItemMeta(idea: SongIdea): IdeaListItemMeta {
  let meta = metaByIdea.get(idea);
  if (!meta) {
    meta = buildIdeaListItemMeta(idea);
    metaByIdea.set(idea, meta);
  }
  return meta;
}
