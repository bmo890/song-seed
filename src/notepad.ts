import type { Note } from "./types";

export function deriveNotePreviewTitle(note: Note) {
  if (note.title.trim()) return note.title.trim();
  const firstLine = note.body.trim().split("\n")[0] ?? "";
  return firstLine.trim() || "New Note";
}

export function deriveNotePreviewBody(note: Note) {
  if (!note.title.trim()) {
    const lines = note.body.trim().split("\n");
    return lines.slice(1).join(" ").trim() || null;
  }

  return note.body.trim() || null;
}

export type SearchPreviewSegment =
  | { kind: "text"; value: string }
  | { kind: "match"; value: string };

const SNIPPET_BEFORE = 24;
const SNIPPET_AFTER = 60;

export function buildSearchPreviewSegments(
  source: string,
  query: string
): SearchPreviewSegment[] | null {
  const trimmed = source.replace(/\s+/g, " ").trim();
  const needle = query.trim().toLowerCase();
  if (!trimmed || !needle) return null;

  const lower = trimmed.toLowerCase();
  const matchIndex = lower.indexOf(needle);
  if (matchIndex < 0) return null;

  const startIdx = Math.max(0, matchIndex - SNIPPET_BEFORE);
  const endIdx = Math.min(trimmed.length, matchIndex + needle.length + SNIPPET_AFTER);

  const before = trimmed.slice(startIdx, matchIndex);
  const match = trimmed.slice(matchIndex, matchIndex + needle.length);
  const after = trimmed.slice(matchIndex + needle.length, endIdx);

  const segments: SearchPreviewSegment[] = [];
  if (startIdx > 0) segments.push({ kind: "text", value: "…" });
  if (before) segments.push({ kind: "text", value: before });
  segments.push({ kind: "match", value: match });
  if (after) segments.push({ kind: "text", value: after });
  if (endIdx < trimmed.length) segments.push({ kind: "text", value: "…" });

  return segments;
}
