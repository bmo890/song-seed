import type { ChordSheet, LyricsLine } from "../types";

/**
 * Display-level chord transposition. Non-destructive by design: these helpers
 * produce transposed COPIES for rendering/export — user chart data is never
 * mutated. Anything that doesn't parse as a chord symbol passes through
 * unchanged (never mangle free text).
 */

const PITCH_CLASS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const SHARP_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const FLAT_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
/** Idiomatic default per pitch class when the source symbol had no accidental:
 *  E♭/A♭/B♭ read better flat; C♯/F♯ read better sharp. */
const DEFAULT_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

type AccidentalFamily = "sharp" | "flat" | "natural";

type ParsedNote = {
  pitchClass: number;
  family: AccidentalFamily;
  /** Characters consumed from the input (root letter + accidental). */
  length: number;
};

function parseNote(text: string, from: number): ParsedNote | null {
  const letter = text[from]?.toUpperCase();
  if (!letter || !(letter in PITCH_CLASS)) return null;
  // Reject lowercase roots ("go home" is not a G chord).
  if (text[from] !== letter) return null;
  let pitchClass = PITCH_CLASS[letter]!;
  const next = text[from + 1];
  if (next === "♯" || next === "#") return { pitchClass: (pitchClass + 1) % 12, family: "sharp", length: 2 };
  if (next === "♭" || next === "b") return { pitchClass: (pitchClass + 11) % 12, family: "flat", length: 2 };
  return { pitchClass, family: "natural", length: 1 };
}

function noteName(pitchClass: number, family: AccidentalFamily): string {
  const pc = ((pitchClass % 12) + 12) % 12;
  if (family === "sharp") return SHARP_NAMES[pc]!;
  if (family === "flat") return FLAT_NAMES[pc]!;
  return DEFAULT_NAMES[pc]!;
}

export type ParsedChordSymbol = {
  rootPitchClass: number;
  rootFamily: AccidentalFamily;
  /** Quality/extension text between root and bass (may be empty). */
  rest: string;
  bassPitchClass?: number;
  bassFamily?: AccidentalFamily;
};

/** Parses a chord display symbol ("C", "F♯m7", "E♭/G", "Am7b5"). Returns null
 *  for anything that isn't chord-shaped. A "/x" tail only counts as a bass note
 *  when x is exactly a note name (so "C6/9" keeps its "/9"). */
export function parseChordSymbol(text: string): ParsedChordSymbol | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const root = parseNote(trimmed, 0);
  if (!root) return null;

  let rest = trimmed.slice(root.length);
  let bassPitchClass: number | undefined;
  let bassFamily: AccidentalFamily | undefined;

  const slashAt = rest.lastIndexOf("/");
  if (slashAt >= 0) {
    const bassText = rest.slice(slashAt + 1);
    const bass = parseNote(bassText, 0);
    if (bass && bass.length === bassText.length) {
      bassPitchClass = bass.pitchClass;
      bassFamily = bass.family;
      rest = rest.slice(0, slashAt);
    }
  }

  // The quality tail must look chord-like, not prose: letters like "maj7",
  // "sus4", "dim", "add9", digits and a few symbols (incl. "/" for tails like
  // "6/9" that aren't bass notes). A space means free text.
  if (/[^0-9A-Za-z♯#♭+°ø/\-()]/.test(rest)) return null;

  return { rootPitchClass: root.pitchClass, rootFamily: root.family, rest, bassPitchClass, bassFamily };
}

/** Spelling family for a transposed symbol: keep the source's accidental family
 *  when it had one; otherwise use the idiomatic default per pitch class. */
function shiftedName(pitchClass: number, semitones: number, family: AccidentalFamily): string {
  return noteName(pitchClass + semitones, family);
}

/** Transposes one chord display symbol. Unparseable input returns unchanged. */
export function transposeChordSymbol(text: string, semitones: number): string {
  if (!Number.isInteger(semitones) || semitones === 0) return text;
  const parsed = parseChordSymbol(text);
  if (!parsed) return text;

  const root = shiftedName(parsed.rootPitchClass, semitones, parsed.rootFamily);
  const bass =
    parsed.bassPitchClass != null
      ? `/${shiftedName(parsed.bassPitchClass, semitones, parsed.bassFamily ?? "natural")}`
      : "";
  // Preserve leading/trailing whitespace from the original token.
  const leading = text.match(/^\s*/)?.[0] ?? "";
  const trailing = text.match(/\s*$/)?.[0] ?? "";
  return `${leading}${root}${parsed.rest}${bass}${trailing}`;
}

/** Transposed copy of a block chord sheet for display/export. */
export function transposeChordSheet(sheet: ChordSheet, semitones: number): ChordSheet {
  if (semitones === 0) return sheet;
  return {
    ...sheet,
    sections: sheet.sections.map((section) => ({
      ...section,
      measures: section.measures.map((measure) => ({
        ...measure,
        chords: measure.chords.map((chord) => transposeChordSymbol(chord, semitones)),
      })),
    })),
  };
}

/** Transposed copy of chord-over-lyrics lines for display/export. Only the
 *  display text shifts; structured picker fields are left untouched because
 *  these copies are never written back. */
export function transposeLyricsLines(lines: LyricsLine[], semitones: number): LyricsLine[] {
  if (semitones === 0) return lines;
  return lines.map((line) => ({
    ...line,
    chords: line.chords.map((placement) => ({
      ...placement,
      chord: transposeChordSymbol(placement.chord, semitones),
    })),
  }));
}

/** Clamp + normalize a stepper offset into the musically useful window. */
export function clampTransposeOffset(offset: number): number {
  if (!Number.isFinite(offset)) return 0;
  return Math.max(-11, Math.min(11, Math.round(offset)));
}

/** "+3" / "−2" / "0" for the stepper chip. */
export function formatTransposeOffset(offset: number): string {
  if (offset > 0) return `+${offset}`;
  if (offset < 0) return `−${Math.abs(offset)}`;
  return "0";
}
