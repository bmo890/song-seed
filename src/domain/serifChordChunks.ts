import type { LyricsLine } from "../types";
import { chordGraphemeAnchor, splitGraphemes, stringIndexToGraphemeIndex } from "./chords";

/** One word of a read-mode chord chart line: the word, plus any chord labels
 * whose anchors fall inside it. */
export type WordChunk = {
  key: string;
  chords: string[];
  text: string;
};

/**
 * Word-chunking for the serif (reading) chord chart: the line splits into
 * words, and each chord rides the word its grapheme anchor falls inside — an
 * anchor in the gap between words leans on the next word, one past the line
 * leans on the last. The editor's monospace grid keeps exact-character
 * anchoring; reading only needs word fidelity, which survives any font.
 */
export function buildWordChunks(line: LyricsLine): WordChunk[] {
  const graphemeTotal = splitGraphemes(line.text).length;
  // Word tokens with their grapheme ranges (string index → grapheme index).
  const tokens: { text: string; gStart: number; gEnd: number }[] = [];
  const matcher = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(line.text)) !== null) {
    tokens.push({
      text: match[0],
      gStart: stringIndexToGraphemeIndex(line.text, match.index),
      gEnd: stringIndexToGraphemeIndex(line.text, match.index + match[0].length),
    });
  }

  const chunks: WordChunk[] = tokens.map((token, index) => ({
    key: `w${index}`,
    chords: [],
    text: token.text,
  }));

  const sortedChords = [...line.chords].sort(
    (a, b) => chordGraphemeAnchor(a, line.text) - chordGraphemeAnchor(b, line.text)
  );
  for (const chord of sortedChords) {
    const at = Math.max(0, Math.min(graphemeTotal, chordGraphemeAnchor(chord, line.text)));
    let target = tokens.findIndex((token) => at < token.gEnd);
    if (target === -1) target = tokens.length - 1;
    if (target >= 0) {
      chunks[target].chords.push(chord.chord);
    }
  }
  return chunks;
}
