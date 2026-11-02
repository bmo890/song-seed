import { appActions } from "../../state/actions";
import { useStore } from "../../state/useStore";
import { locateIdea } from "../../domain/itemLocator";
import { getLatestLyricsVersion, lyricsDocumentToText } from "../../domain/lyrics";
import type { ContentDirection } from "../../types";

/**
 * The player's writer saves into the sketch's latest lyric version as you type.
 * It may only write over the words it started from: if the latest version moved on
 * while it held its copy (an edit in the lyric editor while the player sat docked,
 * a new version), writing in place would put its older copy back over them
 * (12a A-H3). Then its words become a new version instead, and nothing is lost.
 */
export type WriterBase = { versionId: string | null; updatedAt: number | null };

export function readWriterBase(ideaId: string): WriterBase & { text: string } {
  const idea = locateIdea(useStore.getState().workspaces, ideaId)?.idea ?? null;
  const latest = getLatestLyricsVersion(idea);
  return {
    versionId: latest?.id ?? null,
    updatedAt: latest?.updatedAt ?? null,
    text: lyricsDocumentToText(latest?.document),
  };
}

export function sameBase(a: WriterBase, b: WriterBase): boolean {
  return a.versionId === b.versionId && a.updatedAt === b.updatedAt;
}

/** Saves the writer's words; returns the base it now stands on and whether they
 *  went into a new version because the latest had moved on. */
export function saveWriterLyrics(
  ideaId: string,
  text: string,
  textDirection: ContentDirection,
  base: WriterBase
): { base: WriterBase; forked: boolean } {
  const now = readWriterBase(ideaId);
  const forked = !sameBase(now, base) && now.text !== text;
  if (forked) {
    appActions.saveProjectLyricsAsNewVersion(ideaId, text, undefined, textDirection);
  } else {
    appActions.saveProjectLyrics(ideaId, text, textDirection);
  }
  const after = readWriterBase(ideaId);
  return { base: { versionId: after.versionId, updatedAt: after.updatedAt }, forked };
}
