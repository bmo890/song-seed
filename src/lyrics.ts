import { LyricsDocument, LyricsLine, LyricsVersion, SongIdea } from "./types";

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
    const preserveChords = previousLine?.text === lineText ? previousLine.chords : [];

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

export function getLyricsVersionPreview(version?: LyricsVersion | null) {
  const lines = version?.document.lines ?? [];
  const firstNonEmpty = lines.find((line) => line.text.trim().length > 0);
  return firstNonEmpty?.text ?? "";
}
