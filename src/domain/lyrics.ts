import { ContentDirection, LyricsDocument, LyricsLine, LyricsVersion, SongIdea } from "../types";
import { chordGraphemeAnchor, graphemeCount, graphemeIndexToStringIndex } from "./chords";

function buildLyricsLineId() {
  return `lyrics-line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildLyricsVersionId() {
  return `lyrics-version-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function lyricsDocumentToText(document?: LyricsDocument | null) {
  if (!document?.lines?.length) return "";
  return document.lines.map((line) => line.text).join("\n");
}

export function lyricsTextToDocument(text: string, previousDocument?: LyricsDocument | null): LyricsDocument {
  const normalizedText = text.replace(/\r\n/g, "\n");
  if (normalizedText.trim().length === 0) {
    return { lines: [] };
  }

  const rawLines = normalizedText.split("\n");
  const previousLines = previousDocument?.lines ?? [];

  const lines: LyricsLine[] = rawLines.map((lineText, index) => {
    const previousLine = previousLines[index];
    // Keep chords anchored to the same line index across edits. When the text is
    // unchanged the anchors are exact; when it changed we clamp each anchor into
    // the new length rather than dropping the chart the writer built.
    const previousChords = previousLine?.chords ?? [];
    const preserveChords =
      previousLine?.text === lineText
        ? previousChords
        : previousChords.map((chord) => {
            const graphemeAt = Math.min(chordGraphemeAnchor(chord, previousLine?.text ?? ""), graphemeCount(lineText));
            return { ...chord, graphemeAt, at: graphemeIndexToStringIndex(lineText, graphemeAt) };
          });

    return {
      id: previousLine?.id ?? buildLyricsLineId(),
      text: lineText,
      chords: preserveChords,
    };
  });

  return { lines };
}

export function createLyricsVersion(document: LyricsDocument, textDirection: ContentDirection = "auto"): LyricsVersion {
  const now = Date.now();
  return {
    id: buildLyricsVersionId(),
    createdAt: now,
    updatedAt: now,
    textDirection,
    document,
  };
}

export function getLatestLyricsVersion(idea?: SongIdea | null): LyricsVersion | null {
  if (!idea || idea.kind !== "project") return null;
  const versions = idea.lyrics?.versions ?? [];
  return versions.length > 0 ? versions[versions.length - 1] ?? null : null;
}

/** What still points at these lyrics versions — deleting them severs takes,
 *  songbook charts, and setlist parts, so the confirm owes the user a count. */
export function countLyricsVersionReferences(
  idea: SongIdea,
  versionIds: string[],
  songbooks: { items: { ideaId: string; versionId?: string }[] }[],
  setlists: { entries: { ideaId: string; lyricVersionIds: string[] }[] }[]
): { takes: number; charts: number; setlists: number } {
  const ids = new Set(versionIds);
  const takes = idea.clips.filter(
    (clip) => clip.lyricsVersionId && ids.has(clip.lyricsVersionId)
  ).length;
  const charts = songbooks.reduce(
    (count, songbook) =>
      count +
      songbook.items.filter((item) => item.ideaId === idea.id && item.versionId && ids.has(item.versionId))
        .length,
    0
  );
  const setlistCount = setlists.filter((setlist) =>
    setlist.entries.some(
      (entry) => entry.ideaId === idea.id && entry.lyricVersionIds.some((id) => ids.has(id))
    )
  ).length;
  return { takes, charts, setlists: setlistCount };
}

/** Tape seals the page: once any take stamps a lyrics version, that version is
 *  history — edits fork forward instead of rewriting it. Until then the latest
 *  version is the living draft and edits land in place. */
export function isLyricsVersionSealed(idea: SongIdea, versionId: string): boolean {
  return idea.clips.some((clip) => clip.lyricsVersionId === versionId);
}

/** Resolve the lyrics version a take should display: its stamp when that
 *  version still exists, otherwise the latest (old takes, imports, or a
 *  deleted stamp). `stampMissing` is true only when a stamp exists but its
 *  version was deleted — the honest "showing latest instead" case. */
export function resolveClipLyricsVersion(
  idea: SongIdea | null | undefined,
  lyricsVersionId: string | undefined
): { version: LyricsVersion | null; index: number; total: number; stampMissing: boolean } {
  if (!idea || idea.kind !== "project") {
    return { version: null, index: 0, total: 0, stampMissing: false };
  }
  const versions = idea.lyrics?.versions ?? [];
  const total = versions.length;
  if (lyricsVersionId) {
    const index = versions.findIndex((version) => version.id === lyricsVersionId);
    if (index >= 0) {
      return { version: versions[index] ?? null, index: index + 1, total, stampMissing: false };
    }
    return {
      version: versions[total - 1] ?? null,
      index: total,
      total,
      stampMissing: total > 0,
    };
  }
  return { version: versions[total - 1] ?? null, index: total, total, stampMissing: false };
}

export function getLatestLyricsText(idea?: SongIdea | null) {
  return lyricsDocumentToText(getLatestLyricsVersion(idea)?.document);
}

export function getLyricsPreview(idea?: SongIdea | null) {
  const lines = getLatestLyricsVersion(idea)?.document.lines ?? [];
  const firstNonEmpty = lines.find((line) => line.text.trim().length > 0);
  return firstNonEmpty?.text ?? "";
}
