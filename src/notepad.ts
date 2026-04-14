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
