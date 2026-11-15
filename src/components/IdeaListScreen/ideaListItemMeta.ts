import { fmtCardDuration } from "../../utils";
import { getPlayableClipForIdea } from "../../domain/clipPresentation";
import { buildClipLineages } from "../../domain/clipGraph";
import type { SongIdea } from "../../types";
import type { IdeaListItemMeta } from "./types";
import { sketchContents, sketchHasLyrics } from "../../domain/sketchContents";

export const projectHasLyrics = (idea: SongIdea) => idea.kind === "project" && sketchHasLyrics(idea);

/** The precomputed row model for an idea-list entry. Rows read it through
 *  getIdeaListItemMeta, which caches by idea identity: an untouched idea keeps its
 *  object across library writes, so its meta is built once. */
export const buildIdeaListItemMeta = (idea: SongIdea): IdeaListItemMeta => {
  const primaryClip = idea.clips.find((clip) => clip.isPrimary) ?? null;
  const playClip = getPlayableClipForIdea(idea) ?? null;
  const contents = sketchContents(idea);
  const hasProjectLyrics = contents.lyrics;
  const hasProjectClipCount = idea.kind === "project" && idea.clips.length > 0;

  return {
    playClip,
    clipDurationLabel: playClip?.durationMs ? fmtCardDuration(playClip.durationMs) : "0:00",
    projectPrimaryDurationLabel: primaryClip?.durationMs ? fmtCardDuration(primaryClip.durationMs) : "0:00",
    // Takes as the sketch page counts them: a take and its older versions are one.
    projectClipCount: idea.kind === "project" ? buildClipLineages(idea.clips).length : 0,
    hasProjectLyrics,
    hasProjectChart: contents.chart,
    hasProjectNotes: contents.notes,
    hasProjectClipCount,
    hasExpandedProjectIndicators:
      idea.kind === "project" && (hasProjectLyrics || contents.chart || contents.notes || hasProjectClipCount),
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
