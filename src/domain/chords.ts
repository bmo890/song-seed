import type {
  ChordAccidental,
  ChordPlacement,
  ChordRoot,
  LyricsLine,
  SongChordPaletteItem,
} from "../types";
import GraphemeSplitter from "grapheme-splitter";

const graphemeSplitter = new GraphemeSplitter();

export function splitGraphemes(text: string): string[] {
  return graphemeSplitter.splitGraphemes(text ?? "");
}

export function graphemeCount(text: string): number {
  return splitGraphemes(text).length;
}

export function graphemeIndexToStringIndex(text: string, index: number): number {
  return splitGraphemes(text).slice(0, clampChordIndex(index, graphemeCount(text))).join("").length;
}

export function stringIndexToGraphemeIndex(text: string, index: number): number {
  const target = clampChordIndex(index, text.length);
  let stringIndex = 0;
  const units = splitGraphemes(text);
  for (let graphemeIndex = 0; graphemeIndex < units.length; graphemeIndex += 1) {
    if (stringIndex >= target) return graphemeIndex;
    stringIndex += units[graphemeIndex].length;
  }
  return units.length;
}

export function chordGraphemeAnchor(chord: ChordPlacement, text: string): number {
  return clampChordIndex(
    Number.isFinite(chord.graphemeAt) ? chord.graphemeAt! : stringIndexToGraphemeIndex(text, chord.at),
    graphemeCount(text)
  );
}

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

/** Rendered accidental glyph (♯/♭). Natural and undefined render as nothing. */
export function accidentalSymbol(accidental?: ChordAccidental): string {
  if (accidental === "sharp") return "♯";
  if (accidental === "flat") return "♭";
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

/** Best-effort reverse of buildChordDisplay for chart bars (which store only the
 * rendered string). Splits off the root + accidental and keeps everything else
 * as `quality`, so buildChordDisplay round-trips the original string exactly. */
export function parseChordDisplay(display: string): ChordParts {
  const text = (display ?? "").trim();
  const match = text.match(/^([A-G])(♯|♭|#|b)?(.*)$/);
  if (!match) return { quality: "", customSuffix: text };
  const accidental: ChordAccidental =
    match[2] === "♯" || match[2] === "#" ? "sharp" : match[2] === "♭" || match[2] === "b" ? "flat" : "natural";
  return { root: match[1] as ChordRoot, accidental, quality: match[3] ?? "" };
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

/** Renders ChordPro inline-bracket notation ("[C]hello [G]world"), the most
 * widely importable chord-lyric format. */
export function serializeChordPro(lines: LyricsLine[]): string {
  return lines
    .map((line) => {
      const text = line.text ?? "";
      const chords = [...(line.chords ?? [])].sort((a, b) => chordGraphemeAnchor(a, text) - chordGraphemeAnchor(b, text));
      if (chords.length === 0) return text;
      let result = "";
      let cursor = 0;
      for (const chord of chords) {
        const at = graphemeIndexToStringIndex(text, chordGraphemeAnchor(chord, text));
        if (at > cursor) {
          result += text.slice(cursor, at);
          cursor = at;
        }
        result += `[${chord.chord}]`;
      }
      result += text.slice(cursor);
      return result;
    })
    .join("\n");
}

/** Builds the space-aligned chord row that sits above a lyric line (monospace).
 * Returns "" when the line has no chords. */
export function buildChordRowLine(line: LyricsLine): string {
  const text = line.text ?? "";
  const chords = [...(line.chords ?? [])].sort((a, b) => chordGraphemeAnchor(a, text) - chordGraphemeAnchor(b, text));
  if (chords.length === 0) return "";
  let row = "";
  for (const chord of chords) {
    const at = chordGraphemeAnchor(chord, text);
    if (row.length < at) row += " ".repeat(at - row.length);
    // If two chords collide, leave a single space between them.
    if (row.length > at) row += " ";
    row += chord.chord;
  }
  return row.replace(/\s+$/, "");
}

/** Renders a chord-over-lyrics plaintext block (monospace-aligned), suitable for
 * copy/export. Lines without chords render as the lyric line alone. */
export function serializeChordChartText(lines: LyricsLine[]): string {
  const out: string[] = [];
  for (const line of lines) {
    const row = buildChordRowLine(line);
    if (row) out.push(row);
    out.push(line.text ?? "");
  }
  return out.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Builds a printable HTML chord chart (monospace, chords in accent colour above
 * each lyric line) for PDF export. Pure string — no native deps. */
export function buildChordChartHtml(
  title: string,
  subtitle: string,
  lines: LyricsLine[]
): string {
  const body = lines
    .map((line) => {
      const row = buildChordRowLine(line);
      const chordPre = row ? `<pre class="chords">${escapeHtml(row)}</pre>` : "";
      const lyric = line.text ?? "";
      const lyricPre = `<pre class="lyric">${escapeHtml(lyric.length > 0 ? lyric : " ")}</pre>`;
      return `<div class="line">${chordPre}${lyricPre}</div>`;
    })
    .join("\n");

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { margin: 40px; }
  body { color: #1b1c1a; -webkit-text-size-adjust: 100%; }
  h1 { font-family: Georgia, 'Times New Roman', serif; font-size: 22px; margin: 0 0 2px; }
  .sub { color: #6b7280; font-size: 12px; margin: 0 0 22px; font-family: -apple-system, Helvetica, Arial, sans-serif; }
  .line { margin-bottom: 10px; break-inside: avoid; }
  pre { margin: 0; font-family: 'Courier New', Courier, monospace; font-size: 13px; line-height: 1.2; white-space: pre; }
  pre.chords { color: #824f3f; font-weight: 700; }
  pre.lyric { color: #1b1c1a; }
</style></head><body>
  <h1>${escapeHtml(title || "Untitled")}</h1>
  <div class="sub">${escapeHtml(subtitle)}</div>
  ${body}
</body></html>`;
}
