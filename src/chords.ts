import type {
  ChordAccidental,
  ChordPlacement,
  ChordRoot,
  LyricsLine,
  SongChordPaletteItem,
} from "./types";

export const CHORD_ROOTS: ChordRoot[] = ["A", "B", "C", "D", "E", "F", "G"];

export const ACCIDENTAL_OPTIONS: Array<{ value: ChordAccidental; label: string }> = [
  { value: "natural", label: "♮" },
  { value: "sharp", label: "♯" },
  { value: "flat", label: "♭" },
];

/** Quality/extension suffixes. `value` is appended verbatim to the display text
 * (ASCII, matching how online chord charts read: "C#m7", "Gsus4", "Am7b5"). */
export const QUALITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "maj" },
  { value: "m", label: "m" },
  { value: "min", label: "min" },
  { value: "maj", label: "Maj" },
  { value: "maj7", label: "Maj7" },
  { value: "m7", label: "m7" },
  { value: "min7", label: "min7" },
  { value: "7", label: "7" },
  { value: "sus2", label: "sus2" },
  { value: "sus4", label: "sus4" },
  { value: "add9", label: "add9" },
  { value: "6", label: "6" },
  { value: "m6", label: "m6" },
  { value: "9", label: "9" },
  { value: "11", label: "11" },
  { value: "13", label: "13" },
  { value: "dim", label: "dim" },
  { value: "dim7", label: "dim7" },
  { value: "aug", label: "aug" },
  { value: "m7b5", label: "ø (m7b5)" },
];

/** Parts that compose a chord's display text. */
export type ChordParts = {
  root?: ChordRoot;
  accidental?: ChordAccidental;
  quality?: string;
  extension?: string;
  bassRoot?: ChordRoot;
  bassAccidental?: ChordAccidental;
  customSuffix?: string;
};

/** ASCII accidental, matching common chord-chart notation ("#"/"b"). */
export function accidentalSymbol(accidental?: ChordAccidental): string {
  if (accidental === "sharp") return "#";
  if (accidental === "flat") return "b";
  return "";
}

/** Composes the rendered chord text from its structured parts, e.g.
 * { root:"C", accidental:"sharp", quality:"m7", bassRoot:"G", bassAccidental:"sharp" }
 * -> "C#m7/G#". Falls back to customSuffix when there is no root. */
export function buildChordDisplay(parts: ChordParts): string {
  const { root, accidental, quality, extension, bassRoot, bassAccidental, customSuffix } = parts;
  if (!root) return (customSuffix ?? "").trim();

  let text = `${root}${accidentalSymbol(accidental)}`;
  if (quality) text += quality;
  if (extension) text += extension;
  if (customSuffix) text += customSuffix;
  if (bassRoot) text += `/${bassRoot}${accidentalSymbol(bassAccidental)}`;
  return text;
}

/** Clamps a chord's character anchor into a line of the given length. A chord
 * may sit at index === length (just past the final character). */
export function clampChordIndex(at: number, textLength: number): number {
  if (!Number.isFinite(at)) return 0;
  const max = Math.max(0, textLength);
  return Math.min(Math.max(0, Math.round(at)), max);
}

/** Dedupe key for a song's chord palette — chords with the same display text are
 * the same palette entry. */
export function paletteKey(displayText: string): string {
  return displayText.trim().toLowerCase();
}

/** Builds (or refreshes) a song palette item from a chord placement. */
export function paletteItemFromChord(
  chord: ChordPlacement,
  id: string,
  now: number
): SongChordPaletteItem {
  return {
    id,
    displayText: chord.chord,
    root: chord.root,
    accidental: chord.accidental,
    quality: chord.quality,
    extension: chord.extension,
    bassRoot: chord.bassRoot,
    bassAccidental: chord.bassAccidental,
    customSuffix: chord.customSuffix,
    useCount: 1,
    lastUsedAt: now,
  };
}

/** Merges a just-used chord into a song palette: bumps useCount/lastUsedAt for an
 * existing entry (matched by display text) or prepends a new one. */
export function recordChordInPalette(
  palette: SongChordPaletteItem[] | undefined,
  chord: ChordPlacement,
  newId: string,
  now: number
): SongChordPaletteItem[] {
  const list = Array.isArray(palette) ? palette : [];
  const key = paletteKey(chord.chord);
  if (!key) return list;
  const existingIndex = list.findIndex((item) => paletteKey(item.displayText) === key);
  if (existingIndex >= 0) {
    const existing = list[existingIndex];
    const updated: SongChordPaletteItem = {
      ...existing,
      useCount: (existing.useCount ?? 0) + 1,
      lastUsedAt: now,
    };
    return [...list.slice(0, existingIndex), updated, ...list.slice(existingIndex + 1)];
  }
  return [paletteItemFromChord(chord, newId, now), ...list];
}

/** Palette sorted for quick-insert: most recently used first, then by use count. */
export function sortedPalette(palette: SongChordPaletteItem[] | undefined): SongChordPaletteItem[] {
  const list = Array.isArray(palette) ? [...palette] : [];
  return list.sort((a, b) => {
    const recencyDiff = (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0);
    if (recencyDiff !== 0) return recencyDiff;
    return (b.useCount ?? 0) - (a.useCount ?? 0);
  });
}

/** Renders a chord-over-lyrics plaintext block (monospace-aligned), suitable for
 * copy/export. Lines without chords render as the lyric line alone. */
export function serializeChordChartText(lines: LyricsLine[]): string {
  const out: string[] = [];
  for (const line of lines) {
    const text = line.text ?? "";
    const chords = [...(line.chords ?? [])].sort((a, b) => a.at - b.at);
    if (chords.length > 0) {
      let chordLine = "";
      for (const chord of chords) {
        const at = clampChordIndex(chord.at, text.length);
        if (chordLine.length < at) chordLine += " ".repeat(at - chordLine.length);
        // If two chords collide, leave a single space between them.
        if (chordLine.length > at) chordLine += " ";
        chordLine += chord.chord;
      }
      out.push(chordLine.replace(/\s+$/, ""));
    }
    out.push(text);
  }
  return out.join("\n");
}
