import type { Note } from "../types";

export function deriveNotePreviewTitle(note: Note) {
  if (note.title.trim()) return note.title.trim();
  const firstLine = note.body.trim().split("\n")[0] ?? "";
  return firstLine.trim() || "New Page";
}

/** A title for a page saved out of a spark exercise. When the exercise was
 * built from an existing page (or the derived title happens to match one), the
 * saved page would shadow its source in the list — so the exercise's name is
 * appended ("River Song · Cut-Up"), and a counter after that if it's somehow
 * still taken. Case-insensitive comparison; untitled stays untitled. */
export function sparkSaveTitle(title: string, sparkName: string, notes: Note[]): string {
  const base = title.trim();
  if (!base) return base;
  const taken = new Set(notes.map((note) => note.title.trim().toLowerCase()).filter(Boolean));
  if (!taken.has(base.toLowerCase())) return base;
  const suffixed = `${base} · ${sparkName}`;
  if (!taken.has(suffixed.toLowerCase())) return suffixed;
  for (let n = 2; ; n++) {
    const numbered = `${suffixed} ${n}`;
    if (!taken.has(numbered.toLowerCase())) return numbered;
  }
}

export function deriveNotePreviewBody(note: Note) {
  if (!note.title.trim()) {
    const lines = note.body.trim().split("\n");
    return lines.slice(1).join(" ").trim() || null;
  }

  return note.body.trim() || null;
}

/** Flattens a Lyrics Pad page into plain text suitable for a new song lyrics
 *  version — the title (if any) becomes a heading line above the body. */
export function buildLyricsTextFromNote(note: Note) {
  const title = note.title.trim();
  const body = note.body.trim();
  if (!title) return body;
  if (!body) return title;
  return `${title}\n\n${body}`;
}

/** Combines one or more Lyrics Pad pages into a single shareable text block. */
export function buildShareTextFromNotes(notes: Note[]) {
  return notes
    .map((note) => buildLyricsTextFromNote(note))
    .filter((text) => text.length > 0)
    .join("\n\n— — —\n\n");
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
