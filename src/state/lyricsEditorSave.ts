import { appActions } from "./actions";
import { useStore } from "./useStore";
import { locateIdea } from "../domain/itemLocator";
import { getLatestLyricsVersion } from "../domain/lyrics";
import type { ContentDirection, LyricsDocument } from "../types";

/** The version an edit started from, as it was then. */
export type LyricsEditBase = { versionId: string | null; updatedAt: number | null };

export function currentLyricsBase(ideaId: string): LyricsEditBase {
  const idea = locateIdea(useStore.getState().workspaces, ideaId)?.idea ?? null;
  const latest = getLatestLyricsVersion(idea);
  return { versionId: latest?.id ?? null, updatedAt: latest?.updatedAt ?? null };
}

/**
 * Saves the lyric editor's words. "In place" edits the latest version — but only
 * the one the edit started from, as it was then. If the latest moved on meanwhile
 * (the player's writer, another editor, a new version), writing in place would put
 * this older copy over those words; the edit becomes a new version instead and
 * nothing is lost (data-safety audit 2026-11-02, root cause 4).
 */
export function saveLyricsFromEditor(
  ideaId: string,
  text: string,
  textDirection: ContentDirection,
  options: { asNew: boolean; baseDocument?: LyricsDocument; editBase: LyricsEditBase }
): { forked: boolean } {
  if (options.asNew) {
    appActions.saveProjectLyricsAsNewVersion(ideaId, text, options.baseDocument, textDirection);
    return { forked: false };
  }
  const now = currentLyricsBase(ideaId);
  const moved = now.versionId !== options.editBase.versionId || now.updatedAt !== options.editBase.updatedAt;
  if (moved && now.versionId !== null) {
    appActions.saveProjectLyricsAsNewVersion(ideaId, text, options.baseDocument, textDirection);
    return { forked: true };
  }
  appActions.saveProjectLyrics(ideaId, text, textDirection);
  return { forked: false };
}
