import { LyricsDocument, LyricsLine, LyricsVersion, SongIdea } from "./types";
import { clampChordIndex } from "./chords";

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
        : previousChords.map((chord) => ({ ...chord, at: clampChordIndex(chord.at, lineText.length) }));

    return {
      id: previousLine?.id ?? buildLyricsLineId(),
      text: lineText,
      chords: preserveChords,
    };
  });

  return { lines };
}

export function createLyricsVersion(document: LyricsDocument): LyricsVersion {
  const now = Date.now();
  return {
    id: buildLyricsVersionId(),
    createdAt: now,
    updatedAt: now,
    document,
  };
}

export function getLatestLyricsVersion(idea?: SongIdea | null): LyricsVersion | null {
  if (!idea || idea.kind !== "project") return null;
  const versions = idea.lyrics?.versions ?? [];
  return versions.length > 0 ? versions[versions.length - 1] ?? null : null;
}

export function getLatestLyricsText(idea?: SongIdea | null) {
  return lyricsDocumentToText(getLatestLyricsVersion(idea)?.document);
}

export function getLyricsPreview(idea?: SongIdea | null) {
  const lines = getLatestLyricsVersion(idea)?.document.lines ?? [];
  const firstNonEmpty = lines.find((line) => line.text.trim().length > 0);
  return firstNonEmpty?.text ?? "";
}

