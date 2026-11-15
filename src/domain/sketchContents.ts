import type { SongIdea } from "../types";
import { isChordSheetEmpty } from "./chordSheet";

/**
 * What a sketch holds beyond its takes: the one answer the sketch's tabs (a quiet dot
 * on Lyrics, Chart, Notes) and its card in a list (quiet glyphs) both read, so the two
 * never disagree. Founder, 2026-11-15: a bandmate opening a sent sketch should see at
 * a glance that there are notes for them to read.
 */
export type SketchContents = {
  lyrics: boolean;
  chart: boolean;
  notes: boolean;
};

export const NO_SKETCH_CONTENTS: SketchContents = { lyrics: false, chart: false, notes: false };

/** A lyric version with any word or chord on any line. */
export function sketchHasLyrics(idea: SongIdea): boolean {
  return (idea.lyrics?.versions ?? []).some((version) =>
    version.document.lines.some((line) => line.text.trim().length > 0 || line.chords.length > 0)
  );
}

export function sketchContents(idea: SongIdea | null | undefined): SketchContents {
  if (!idea || idea.kind !== "project") return NO_SKETCH_CONTENTS;
  return {
    lyrics: sketchHasLyrics(idea),
    chart: !isChordSheetEmpty(idea.chordSheet),
    notes: (idea.notes ?? "").trim().length > 0,
  };
}
