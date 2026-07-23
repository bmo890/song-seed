import type {
  CutUpBoardItem,
  CutUpChunk,
  CutUpChunkMode,
  CutUpSpark,
  CutUpStep,
} from "../types";

function randomId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Guards against runaway rendering on very long pastes. */
export const MAX_SOURCE_LEN = 8000;
export const MAX_CHUNKS = 400;
/** Phrase mode: split a phrase longer than this into ~PHRASE_GROUP-word groups
 * so a long, comma-less line doesn't become one giant strip. */
const MAX_PHRASE_WORDS = 6;
const PHRASE_GROUP = 4;

export const CHUNK_MODE_OPTIONS: Array<{ key: Exclude<CutUpChunkMode, "custom">; label: string }> = [
  { key: "phrase", label: "Phrase" },
  { key: "line", label: "Line" },
  { key: "word", label: "Word" },
];

// ── Slicing the source into raw spans ────────────────────────────────────────

type RawChunk = { text: string; start: number; end: number };

function isSpace(ch: string) {
  return ch === " " || ch === "\t" || ch === "\r" || ch === "\n" || ch === "\f" || ch === "\v";
}

/** Trims surrounding whitespace from a [start,end) span, returning a tight span
 * (so chunk text never leads/trails with spaces and offsets stay honest). */
function tightenSpan(source: string, start: number, end: number): RawChunk | null {
  let s = start;
  let e = end;
  while (s < e && isSpace(source[s])) s++;
  while (e > s && isSpace(source[e - 1])) e--;
  if (e <= s) return null;
  return { text: source.slice(s, e), start: s, end: e };
}

/** Each line (split on \n) becomes one chunk; blank lines are dropped. */
function lineChunks(source: string): RawChunk[] {
  const out: RawChunk[] = [];
  let idx = 0;
  for (const line of source.split("\n")) {
    const span = tightenSpan(source, idx, idx + line.length);
    if (span) out.push(span);
    idx += line.length + 1; // + 1 for the consumed "\n"
  }
  return out;
}

/** Every whitespace-delimited token becomes its own chunk (punctuation stays
 * attached to the word it touches). */
function wordChunks(source: string): RawChunk[] {
  const out: RawChunk[] = [];
  const re = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    out.push({ text: match[0], start: match.index, end: match.index + match[0].length });
  }
  return out;
}

const BOUNDARY_PUNCT = new Set([",", ";", ":", ".", "!", "?", "…", "׃", "—", "–"]);

/** Splits one line into phrase spans, preferring punctuation boundaries (commas,
 * semicolons, colons, dashes) and keeping the punctuation with the phrase it
 * closes. Long, punctuation-less phrases are further split into word groups. */
function phraseChunksForLine(source: string, lineStart: number, lineEnd: number): RawChunk[] {
  const line = source.slice(lineStart, lineEnd);
  if (!line.trim()) return [];

  // 1) Cut at boundary punctuation (kept attached to the left side).
  const pieces: Array<[number, number]> = [];
  let pieceStart = 0;
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    const spacedDash = ch === "-" && line[i - 1] === " " && line[i + 1] === " ";
    if (BOUNDARY_PUNCT.has(ch)) {
      let j = i + 1;
      while (j < line.length && BOUNDARY_PUNCT.has(line[j])) j++;
      pieces.push([pieceStart, j]);
      pieceStart = j;
      i = j;
    } else if (spacedDash) {
      pieces.push([pieceStart, i + 1]); // keep the dash with the left phrase
      pieceStart = i + 1;
      i += 1;
    } else {
      i++;
    }
  }
  if (pieceStart < line.length) pieces.push([pieceStart, line.length]);

  // 2) Tighten each piece; split overly long ones into word groups.
  const out: RawChunk[] = [];
  for (const [s0, e0] of pieces) {
    const span = tightenSpan(source, lineStart + s0, lineStart + e0);
    if (!span) continue;
    const wordCount = span.text.split(/\s+/).filter(Boolean).length;
    if (wordCount > MAX_PHRASE_WORDS) {
      out.push(...wordGroups(source, span.start, span.end));
    } else {
      out.push(span);
    }
  }
  return out;
}

/** Splits a span into consecutive groups of PHRASE_GROUP words. */
function wordGroups(source: string, start: number, end: number): RawChunk[] {
  const re = /\S+/g;
  re.lastIndex = start;
  const words: Array<[number, number]> = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) && match.index < end) {
    words.push([match.index, Math.min(match.index + match[0].length, end)]);
  }
  const out: RawChunk[] = [];
  for (let k = 0; k < words.length; k += PHRASE_GROUP) {
    const group = words.slice(k, k + PHRASE_GROUP);
    if (group.length === 0) continue;
    const gs = group[0][0];
    const ge = group[group.length - 1][1];
    out.push({ text: source.slice(gs, ge), start: gs, end: ge });
  }
  return out;
}

function phraseChunks(source: string): RawChunk[] {
  const out: RawChunk[] = [];
  let idx = 0;
  for (const line of source.split("\n")) {
    out.push(...phraseChunksForLine(source, idx, idx + line.length));
    idx += line.length + 1;
  }
  return out;
}

/** Raw spans for a source + mode, guarded against empties, length, and runaway
 * counts. "custom" re-cuts as "phrase" (regenerating discards custom edits). */
export function sliceSource(source: string, mode: CutUpChunkMode): RawChunk[] {
  const capped = source.length > MAX_SOURCE_LEN ? source.slice(0, MAX_SOURCE_LEN) : source;
  let raws: RawChunk[];
  if (mode === "word") raws = wordChunks(capped);
  else if (mode === "line") raws = lineChunks(capped);
  else raws = phraseChunks(capped);
  return raws.filter((r) => r.text.trim().length > 0).slice(0, MAX_CHUNKS);
}

// Sentence punctuation to drop from a strip — periods, commas, colons,
// semicolons, question/exclamation marks, ellipses, and the Hebrew sof pasuk.
// Apostrophes and hyphens survive (they live inside words: don't, half-lit).
const STRIP_PUNCT_RE = /[.,;:!?…״׃"“”«»]/g;

/** A strip reads cleaner without the source's sentence punctuation — a comma
 * that made sense in the original line rarely does once the words are recombined
 * on the board. Collapses any doubled spaces the removal leaves behind. */
export function stripStripPunctuation(text: string): string {
  return text.replace(STRIP_PUNCT_RE, "").replace(/\s{2,}/g, " ").trim();
}

function rawToChunk(raw: RawChunk): CutUpChunk {
  const now = Date.now();
  return {
    id: randomId("chunk"),
    text: raw.text,
    sourceStartIndex: raw.start,
    sourceEndIndex: raw.end,
    included: true,
    createdAt: now,
    updatedAt: now,
  };
}

/** Generates a fresh set of chunks from the source in the given mode. */
export function generateChunks(source: string, mode: CutUpChunkMode): CutUpChunk[] {
  return sliceSource(source, mode).map(rawToChunk);
}

// ── Seam-based cutting (direct "mark up the text" surface) ───────────────────
// The Cut step lets the writer cut where they want rather than picking a mode.
// The source is tokenised into words; a "seam" sits before each word (seam `s`
// separates word s-1 | s, for s in 1..N-1). A cut seam is a chunk boundary; a run
// of words between cuts is one chunk. Tapping a seam toggles it (split ⇄ join);
// sliding across words binds them into one unit.

/** A word token with its character span in the source (offsets are reference
 * only — chunk text is the words joined by single spaces). */
export type CutWord = { index: number; text: string; start: number; end: number };

/** Every whitespace-delimited token, punctuation kept attached to its word. */
export function tokenizeWords(source: string): CutWord[] {
  const out: CutWord[] = [];
  const re = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    out.push({ index: out.length, text: match[0], start: match.index, end: match.index + match[0].length });
  }
  return out;
}

const SEAM_END_PUNCT = /[,;:.!?…”"’')\]]$/;
const SEAM_DASH = /[—–]$/;
/** After this many words with no natural break, force a seam so no unit is huge. */
const SEAM_MAX_RUN = 6;

/** Connective words that open a new phrase — a seed cut lands just before one so
 * pieces read as phrases ("with the gold of sunshine" → "with the gold" + "of
 * sunshine") instead of arbitrary every-N-words groups. English only; Hebrew
 * fuses these as prefixes, so Hebrew falls back to punctuation + max-run. */
const PHRASE_LEADERS = new Set([
  "and", "but", "or", "nor", "so", "yet",
  "when", "where", "while", "till", "until", "before", "after",
  "that", "which", "who", "whom", "whose", "because", "though", "although", "if", "unless",
  "as", "like", "than",
  "through", "with", "without", "into", "onto", "over", "under", "between", "beyond",
  "for", "from", "of", "to", "in", "on", "at", "by", "down", "up",
]);

function isPhraseLeader(word: string): boolean {
  const bare = word.toLowerCase().replace(/^[^a-z']+|[^a-z']+$/g, "");
  return PHRASE_LEADERS.has(bare);
}

/** Whether there's a natural break between two words: the left word ends a clause
 * (punctuation or dash) or a line break sits between them. */
function seamBreaksNaturally(source: string, prev: CutWord, cur: CutWord): boolean {
  if (SEAM_END_PUNCT.test(prev.text) || SEAM_DASH.test(prev.text)) return true;
  return source.slice(prev.end, cur.start).includes("\n");
}

/** Seeds cut seams at natural phrase boundaries (so the writer starts with
 * phrases, not single words): line breaks and clause punctuation first, then
 * connective words once a piece has grown, with a max-run backstop. A leader cut
 * is skipped when it would strand a one-word piece against the next break. */
export function seedCutSeams(source: string, words: CutWord[]): number[] {
  const cuts: number[] = [];
  let runStart = 0;
  for (let s = 1; s < words.length; s++) {
    const natural = seamBreaksNaturally(source, words[s - 1], words[s]);
    const lastBeforeBreak =
      s + 1 >= words.length || seamBreaksNaturally(source, words[s], words[s + 1]);
    const leader = !natural && !lastBeforeBreak && s - runStart >= 3 && isPhraseLeader(words[s].text);
    if (natural || leader || s - runStart >= SEAM_MAX_RUN) {
      cuts.push(s);
      runStart = s;
    }
  }
  return cuts;
}

/** The seams that sit on a source line break. Structural: the Cut surface lays
 * strips out line by line, so these are always cut and carry no join control —
 * they're baked into generation so a strip never spans two source lines. */
export function lineBreakSeams(source: string, words: CutWord[]): number[] {
  const out: number[] = [];
  for (let s = 1; s < words.length; s++) {
    if (source.slice(words[s - 1].end, words[s].start).includes("\n")) out.push(s);
  }
  return out;
}

/** The unit (strip) index each cut seam opens — i.e. the words grouped into
 * strips by the current cuts. Each returned group is one strip on the Cut
 * surface: a run of words with no cut between them. */
export type CutUnit = { words: CutWord[]; startSeam: number };

export function unitGroups(words: CutWord[], cutSeams: number[]): CutUnit[] {
  const cutSet = new Set(cutSeams);
  const groups: CutUnit[] = [];
  for (let i = 0; i < words.length; i++) {
    if (i === 0 || cutSet.has(i)) groups.push({ words: [words[i]], startSeam: i });
    else groups[groups.length - 1].words.push(words[i]);
  }
  return groups;
}

/** Toggles a seam between cut and joined. */
export function toggleSeam(cutSeams: number[], seam: number): number[] {
  const set = new Set(cutSeams);
  if (set.has(seam)) set.delete(seam);
  else set.add(seam);
  return [...set].sort((a, b) => a - b);
}

/** Binds words [startWord..endWord] into a single unit: clears the seams inside
 * the range and cuts at its edges. */
export function bindWordRange(
  cutSeams: number[],
  startWord: number,
  endWord: number,
  wordCount: number
): number[] {
  const a = Math.min(startWord, endWord);
  const b = Math.max(startWord, endWord);
  const set = new Set(cutSeams);
  for (let s = a + 1; s <= b; s++) set.delete(s);
  if (a >= 1) set.add(a);
  if (b + 1 <= wordCount - 1) set.add(b + 1);
  return [...set].sort((x, y) => x - y);
}

/** The unit (chunk) index each word belongs to, for tinting units on the mat. */
export function unitIndexByWord(words: CutWord[], cutSeams: number[]): number[] {
  const cutSet = new Set(cutSeams);
  const out: number[] = [];
  let unit = 0;
  for (let i = 0; i < words.length; i++) {
    if (i > 0 && cutSet.has(i)) unit++;
    out.push(unit);
  }
  return out;
}

/** Word-runs between cuts → chunk text spans. */
function seamChunkSpans(words: CutWord[], cutSeams: number[]): RawChunk[] {
  if (words.length === 0) return [];
  const cutSet = new Set(cutSeams);
  const spans: RawChunk[] = [];
  let begin = 0;
  for (let i = 1; i <= words.length; i++) {
    if (i === words.length || cutSet.has(i)) {
      const slice = words.slice(begin, i);
      const text = slice.map((w) => w.text).join(" ");
      spans.push({ text, start: slice[0].start, end: slice[slice.length - 1].end });
      begin = i;
    }
  }
  return spans;
}

/** Generates board-ready chunks from the source + the writer's cut seams.
 * Line-break seams are structural (the Cut surface offers no cross-line join),
 * so they're always included. Strips sentence punctuation so the recombined
 * strips read clean on the board. */
export function generateChunksFromSeams(source: string, cutSeams: number[]): CutUpChunk[] {
  const words = tokenizeWords(source);
  const seams = [...new Set([...cutSeams, ...lineBreakSeams(source, words)])].sort((a, b) => a - b);
  return seamChunkSpans(words, seams).map((raw) =>
    rawToChunk({ ...raw, text: stripStripPunctuation(raw.text) })
  );
}

/** Whether two chunk lists carry the same text in the same order — used to keep
 * the board intact when the cut hasn't actually changed. */
export function chunkTextsEqual(a: CutUpChunk[], b: CutUpChunk[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((chunk, i) => chunk.text === b[i].text);
}

// ── Chunk editing (manual adjustments → custom mode) ─────────────────────────

export function toggleChunkIncluded(chunks: CutUpChunk[], chunkId: string): CutUpChunk[] {
  return chunks.map((chunk) =>
    chunk.id === chunkId ? { ...chunk, included: !chunk.included, updatedAt: Date.now() } : chunk
  );
}

/** Splits a chunk into two at the whitespace nearest its middle (or mid-text for
 * a single word). Order, inclusion, and lock state carry to both halves. */
export function splitChunk(chunks: CutUpChunk[], chunkId: string): CutUpChunk[] {
  const index = chunks.findIndex((chunk) => chunk.id === chunkId);
  if (index < 0) return chunks;
  const chunk = chunks[index];
  const text = chunk.text;
  if (text.trim().length < 2) return chunks;

  const mid = Math.floor(text.length / 2);
  let splitAt = -1;
  for (let offset = 0; offset < text.length; offset++) {
    const left = mid - offset;
    const right = mid + offset;
    if (left > 0 && isSpace(text[left])) {
      splitAt = left;
      break;
    }
    if (right < text.length && isSpace(text[right])) {
      splitAt = right;
      break;
    }
  }
  if (splitAt <= 0) splitAt = mid; // single word — split mid-character

  const leftText = text.slice(0, splitAt).trim();
  const rightText = text.slice(splitAt).trim();
  if (!leftText || !rightText) return chunks;

  const now = Date.now();
  const left: CutUpChunk = {
    ...chunk,
    id: randomId("chunk"),
    text: leftText,
    sourceEndIndex: chunk.sourceStartIndex + splitAt,
    updatedAt: now,
  };
  const right: CutUpChunk = {
    ...chunk,
    id: randomId("chunk"),
    text: rightText,
    sourceStartIndex: chunk.sourceStartIndex + splitAt,
    updatedAt: now,
  };
  return [...chunks.slice(0, index), left, right, ...chunks.slice(index + 1)];
}

/** Merges a chunk with the one immediately after it. No-op for the last chunk. */
export function mergeChunkWithNext(chunks: CutUpChunk[], chunkId: string): CutUpChunk[] {
  const index = chunks.findIndex((chunk) => chunk.id === chunkId);
  if (index < 0 || index >= chunks.length - 1) return chunks;
  const a = chunks[index];
  const b = chunks[index + 1];
  const merged: CutUpChunk = {
    ...a,
    id: randomId("chunk"),
    text: `${a.text} ${b.text}`.replace(/\s+/g, " ").trim(),
    sourceStartIndex: Math.min(a.sourceStartIndex, b.sourceStartIndex),
    sourceEndIndex: Math.max(a.sourceEndIndex, b.sourceEndIndex),
    included: a.included || b.included,
    locked: a.locked || b.locked,
    updatedAt: Date.now(),
  };
  return [...chunks.slice(0, index), merged, ...chunks.slice(index + 2)];
}

// ── The cut-out board ────────────────────────────────────────────────────────

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function makeBoardItem(chunkId: string, order: number): CutUpBoardItem {
  return { id: randomId("strip"), chunkId, order };
}

/** Builds a randomized board from the currently-included chunks. */
export function buildBoardItems(chunks: CutUpChunk[]): CutUpBoardItem[] {
  const included = chunks.filter((chunk) => chunk.included);
  return shuffle(included).map((chunk, index) => makeBoardItem(chunk.id, index));
}

/** Brings the board in line with the current chunk selection without disturbing
 * the writer's arrangement: drops strips whose chunk was excluded or deleted,
 * adds strips for newly-included chunks, and keeps existing order/locks/edits.
 * An empty board is freshly built (randomized). */
export function reconcileBoard(chunks: CutUpChunk[], boardItems: CutUpBoardItem[]): CutUpBoardItem[] {
  if (boardItems.length === 0) return buildBoardItems(chunks);

  const includedIds = new Set(chunks.filter((chunk) => chunk.included).map((chunk) => chunk.id));
  const kept = boardItems.filter((item) => includedIds.has(item.chunkId));
  const onBoard = new Set(kept.map((item) => item.chunkId));

  let nextOrder = kept.reduce((max, item) => Math.max(max, item.order), -1) + 1;
  const added: CutUpBoardItem[] = [];
  for (const chunk of chunks) {
    if (chunk.included && !onBoard.has(chunk.id)) {
      added.push(makeBoardItem(chunk.id, nextOrder++));
    }
  }
  return [...kept, ...added];
}

/** Shuffles the order of unlocked, non-removed strips; locked strips hold their
 * visual slot, removed strips stay parked at the end. */
export function shuffleBoard(items: CutUpBoardItem[]): CutUpBoardItem[] {
  const removed = items.filter((item) => item.removed);
  const active = items.filter((item) => !item.removed).sort((a, b) => a.order - b.order);
  const shuffledUnlocked = shuffle(active.filter((item) => !item.locked));
  let u = 0;
  const arranged = active.map((item) => (item.locked ? item : shuffledUnlocked[u++]));
  const reordered = arranged.map((item, index) => ({ ...item, order: index }));
  const removedReordered = removed.map((item, index) => ({ ...item, order: reordered.length + index }));
  return [...reordered, ...removedReordered];
}

/** Applies a new visual order (active strip ids, top to bottom) from a reorder
 * gesture; removed strips stay parked at the end. */
export function reorderBoard(items: CutUpBoardItem[], orderedIds: string[]): CutUpBoardItem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const reordered: CutUpBoardItem[] = [];
  orderedIds.forEach((id, index) => {
    const item = byId.get(id);
    if (item) reordered.push({ ...item, order: index });
  });
  const removed = items
    .filter((item) => item.removed)
    .map((item, index) => ({ ...item, order: reordered.length + index }));
  return [...reordered, ...removed];
}

/** Restores active strips to source (chunk) order. */
export function resetBoardOrder(items: CutUpBoardItem[], chunks: CutUpChunk[]): CutUpBoardItem[] {
  const chunkIndex = new Map(chunks.map((chunk, index) => [chunk.id, index]));
  const active = items
    .filter((item) => !item.removed)
    .sort((a, b) => (chunkIndex.get(a.chunkId) ?? 0) - (chunkIndex.get(b.chunkId) ?? 0))
    .map((item, index) => ({ ...item, order: index }));
  const removed = items
    .filter((item) => item.removed)
    .map((item, index) => ({ ...item, order: active.length + index }));
  return [...active, ...removed];
}

export function duplicateBoardItem(items: CutUpBoardItem[], itemId: string): CutUpBoardItem[] {
  const index = items.findIndex((item) => item.id === itemId);
  if (index < 0) return items;
  const source = items[index];
  const copy: CutUpBoardItem = { ...source, id: randomId("strip"), locked: false };
  const next = [...items.slice(0, index + 1), copy, ...items.slice(index + 1)];
  // Re-sequence active orders so the copy lands right after its source.
  const active = next.filter((item) => !item.removed).map((item, order) => ({ ...item, order }));
  const removed = next
    .filter((item) => item.removed)
    .map((item, offset) => ({ ...item, order: active.length + offset }));
  return [...active, ...removed];
}

/** Replaces one strip with several, in place — the Arrange step's "cut this
 * strip again". Each piece keeps the source chunk link but carries its own
 * text override; locks don't survive the cut (the pieces are new material). */
export function splitBoardItemByTexts(
  items: CutUpBoardItem[],
  itemId: string,
  pieceTexts: string[]
): CutUpBoardItem[] {
  const index = items.findIndex((item) => item.id === itemId);
  const texts = pieceTexts.map((text) => text.trim()).filter((text) => text.length > 0);
  if (index < 0 || texts.length < 2) return items;
  const source = items[index];
  const pieces: CutUpBoardItem[] = texts.map((text) => ({
    ...source,
    id: randomId("strip"),
    textOverride: text,
    locked: false,
  }));
  const next = [...items.slice(0, index), ...pieces, ...items.slice(index + 1)];
  const active = next.filter((item) => !item.removed).map((item, order) => ({ ...item, order }));
  const removed = next
    .filter((item) => item.removed)
    .map((item, offset) => ({ ...item, order: active.length + offset }));
  return [...active, ...removed];
}

export function setBoardItemRemoved(items: CutUpBoardItem[], itemId: string, removed: boolean): CutUpBoardItem[] {
  return items.map((item) => (item.id === itemId ? { ...item, removed, locked: removed ? false : item.locked } : item));
}

export function toggleBoardItemLock(items: CutUpBoardItem[], itemId: string): CutUpBoardItem[] {
  return items.map((item) => (item.id === itemId ? { ...item, locked: !item.locked } : item));
}

export function setBoardItemText(items: CutUpBoardItem[], itemId: string, text: string): CutUpBoardItem[] {
  return items.map((item) => (item.id === itemId ? { ...item, textOverride: text } : item));
}

/** The displayed text of a board strip — its edit override, else its chunk. */
export function boardItemText(item: CutUpBoardItem, chunks: CutUpChunk[]): string {
  if (typeof item.textOverride === "string") return item.textOverride;
  return chunks.find((chunk) => chunk.id === item.chunkId)?.text ?? "";
}

/** The active strips' text, in board order. */
function orderedStripTexts(chunks: CutUpChunk[], boardItems: CutUpBoardItem[]): string[] {
  return boardItems
    .filter((item) => !item.removed)
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((item) => boardItemText(item, chunks).trim())
    .filter((text) => text.length > 0);
}

/** Assembles the active strips (in order) into a draft, one strip per line. */
export function assembleDraftText(chunks: CutUpChunk[], boardItems: CutUpBoardItem[]): string {
  return orderedStripTexts(chunks, boardItems).join("\n");
}

// ── The table: a ruled canvas of scraps ──────────────────────────────────────
// The Arrange step is a table with faint ruled lines. Each scrap carries a free
// `x` (px from the leading edge) and a `y` = ruled-band index. Scraps sharing a
// band read as one draft line (ordered by x, mirrored for RTL). No slots, no
// insertion logic — the scrap lands where the writer drops it and settles onto
// the nearest rule.
//
// Spacing vs. blank lines: auto-layouts leave ONE empty rule between lines for
// breathing room (easier to grab and rearrange), and that single gap is NOT a
// draft blank. A draft blank line needs a bigger deliberate gap —
// MIN_BLANK_EMPTY_RULES empty rules — so the spread-out default never injects
// blanks into the draft.

/** Bands between consecutive auto-laid lines (one empty rule of breathing room). */
export const LINE_STEP = 2;
/** Empty rules a gap must span to read as one blank line in the draft. */
const MIN_BLANK_EMPTY_RULES = 2;

/** Whether every active scrap has a position; older sparks (pre-canvas) don't. */
export function canvasNeedsDeal(items: CutUpBoardItem[]): boolean {
  return items.some((it) => !it.removed && (typeof it.x !== "number" || typeof it.y !== "number"));
}

/** Deals the active scraps one per band, in the given order (by current board
 * order when `chunkIndex` is null, else by source/chunk order), x at the edge.
 * Removed scraps are left untouched. */
export function dealCanvas(items: CutUpBoardItem[], chunkIndex: Map<string, number> | null): CutUpBoardItem[] {
  const active = items
    .filter((it) => !it.removed)
    .slice()
    .sort((a, b) =>
      chunkIndex
        ? (chunkIndex.get(a.chunkId) ?? 0) - (chunkIndex.get(b.chunkId) ?? 0)
        : a.order - b.order
    );
  const bandOf = new Map(active.map((it, i) => [it.id, i * LINE_STEP]));
  return items.map((it) =>
    bandOf.has(it.id) ? { ...it, x: 0, y: bandOf.get(it.id) } : it
  );
}

/** Gives positions ONLY to scraps that lack them, on fresh rules below the
 * lowest occupied one — so reconciling in a new scrap never disturbs the
 * writer's arrangement. Falls back to a full deal when nothing is placed. */
export function placeMissingScraps(items: CutUpBoardItem[]): CutUpBoardItem[] {
  const hasAny = items.some((it) => !it.removed && typeof it.y === "number");
  if (!hasAny) return dealCanvas(items, null);
  let band = nextFreeBand(items);
  return items.map((it) => {
    if (it.removed || (typeof it.x === "number" && typeof it.y === "number")) return it;
    const placed = { ...it, x: 0, y: band };
    band += LINE_STEP;
    return placed;
  });
}

/** Places one scrap at (x, band). */
export function moveCanvasScrap(items: CutUpBoardItem[], id: string, x: number, band: number): CutUpBoardItem[] {
  return items.map((it) =>
    it.id === id ? { ...it, x: Math.max(0, x), y: Math.max(0, Math.round(band)) } : it
  );
}

/** The first free band below every occupied one — where restored scraps land
 * (one breathing rule below the lowest scrap). */
export function nextFreeBand(items: CutUpBoardItem[]): number {
  let max = -1;
  for (const it of items) {
    if (!it.removed && typeof it.y === "number" && it.y > max) max = it.y;
  }
  return max < 0 ? 0 : max + LINE_STEP;
}

/** Sends every scrap to the set-aside pool (marks active ones removed). */
export function poolAllScraps(items: CutUpBoardItem[]): CutUpBoardItem[] {
  return items.map((it) => (it.removed ? it : { ...it, removed: true }));
}

/** Brings every pooled scrap back onto the table, on fresh spaced rules below
 * whatever's already placed — the already-arranged scraps aren't disturbed. */
export function restorePooledScraps(items: CutUpBoardItem[]): CutUpBoardItem[] {
  const hasPlaced = items.some((it) => !it.removed && typeof it.y === "number");
  let band = hasPlaced ? nextFreeBand(items) : 0;
  return items.map((it) => {
    if (!it.removed) return it;
    const back = { ...it, removed: false, x: 0, y: band };
    band += LINE_STEP;
    return back;
  });
}

/** Re-deals the unlocked scraps in random order into rows of varied length
 * (1–3 scraps, width permitting) — the table-wide "surprise me" that composes
 * lines, not just a stack. Locked scraps hold their exact spot; unlocked ones
 * fill the rules around them. `widthOf` is the measured scrap width. */
export function shuffleCanvas(
  items: CutUpBoardItem[],
  widthOf: (id: string) => number,
  canvasW: number,
  gap: number
): CutUpBoardItem[] {
  const lockedBands = new Set(
    items.filter((it) => !it.removed && it.locked && typeof it.y === "number").map((it) => it.y as number)
  );
  const loose = shuffle(items.filter((it) => !it.removed && !it.locked).map((it) => it.id));
  const assign = new Map<string, { x: number; y: number }>();
  let band = -LINE_STEP;
  let x = 0;
  let count = 0;
  let rowTarget = 0;
  const openRow = () => {
    band += LINE_STEP; // one empty rule between rows for breathing room
    while (lockedBands.has(band)) band++;
    x = 0;
    count = 0;
    rowTarget = 1 + Math.floor(Math.random() * 3); // 1–3 scraps per row
  };
  openRow();
  for (const id of loose) {
    const w = widthOf(id);
    if (count >= rowTarget || (x > 0 && x + w > canvasW)) openRow();
    assign.set(id, { x, y: band });
    x += w + gap;
    count++;
  }
  return items.map((it) => {
    const pos = assign.get(it.id);
    return pos ? { ...it, x: pos.x, y: pos.y } : it;
  });
}

/** Lays the scraps out as the source lyric is written: each source line's
 * scraps share a rule (in source order, packed with `gap`), a stanza gap keeps
 * one empty rule, and an over-long line wraps to the next rule. Split pieces
 * and duplicates ride with their chunk's line. */
export function packSourceLines(
  items: CutUpBoardItem[],
  chunks: CutUpChunk[],
  sourceText: string,
  widthOf: (id: string) => number,
  canvasW: number,
  gap: number
): CutUpBoardItem[] {
  const chunkById = new Map(chunks.map((c) => [c.id, c]));
  const lineOf = (chunkId: string): number => {
    const chunk = chunkById.get(chunkId);
    if (!chunk) return Number.MAX_SAFE_INTEGER;
    const upto = Math.max(0, Math.min(chunk.sourceStartIndex, sourceText.length));
    return (sourceText.slice(0, upto).match(/\n/g) ?? []).length;
  };
  const arrayIndex = new Map(items.map((it, i) => [it.id, i]));
  const active = items
    .filter((it) => !it.removed)
    .slice()
    .sort((a, b) => {
      const la = lineOf(a.chunkId);
      const lb = lineOf(b.chunkId);
      if (la !== lb) return la - lb;
      const sa = chunkById.get(a.chunkId)?.sourceStartIndex ?? 0;
      const sb = chunkById.get(b.chunkId)?.sourceStartIndex ?? 0;
      if (sa !== sb) return sa - sb;
      return (arrayIndex.get(a.id) ?? 0) - (arrayIndex.get(b.id) ?? 0);
    });

  const assign = new Map<string, { x: number; y: number }>();
  let band = -1;
  let x = 0;
  let prevLine: number | null = null;
  for (const it of active) {
    const line = lineOf(it.chunkId);
    if (prevLine === null) {
      band = 0;
      x = 0;
      prevLine = line;
    } else if (line !== prevLine) {
      // Each new source line steps down one breathing rule; a stanza gap in the
      // source adds an extra empty rule so it reads as a draft blank line.
      band += line - prevLine > 1 ? LINE_STEP + 1 : LINE_STEP;
      x = 0;
      prevLine = line;
    }
    const w = widthOf(it.id);
    if (x > 0 && x + w > canvasW) {
      band++; // a wrapped continuation sits on the very next rule (same line feel)
      x = 0;
    }
    assign.set(it.id, { x, y: band });
    x += w + gap;
  }
  return items.map((it) => {
    const pos = assign.get(it.id);
    return pos ? { ...it, x: pos.x, y: pos.y } : it;
  });
}

/** The canvas read back as lines of scrap ids: bands in order, each sorted by x
 * (descending for RTL). A single empty rule between lines is just breathing room
 * (no blank); a gap of MIN_BLANK_EMPTY_RULES or more empty rules reads as one
 * blank line. */
export function canvasLines(items: CutUpBoardItem[], rtl: boolean): string[][] {
  const byBand = new Map<number, CutUpBoardItem[]>();
  for (const it of items) {
    if (it.removed || typeof it.y !== "number") continue;
    const band = byBand.get(it.y) ?? [];
    band.push(it);
    byBand.set(it.y, band);
  }
  const bands = [...byBand.keys()].sort((a, b) => a - b);
  const out: string[][] = [];
  for (let i = 0; i < bands.length; i++) {
    if (i > 0 && bands[i] - bands[i - 1] - 1 >= MIN_BLANK_EMPTY_RULES) out.push([]);
    const sorted = (byBand.get(bands[i]) ?? [])
      .slice()
      .sort((a, b) => (rtl ? (b.x ?? 0) - (a.x ?? 0) : (a.x ?? 0) - (b.x ?? 0)));
    out.push(sorted.map((it) => it.id));
  }
  return out;
}

/** Assembles the draft straight off the table: each band's scraps joined by
 * spaces in reading order; an empty band becomes a blank line. */
export function assembleDraftFromCanvas(
  items: CutUpBoardItem[],
  textOf: (id: string) => string,
  rtl: boolean
): string {
  return canvasLines(items, rtl)
    .map((line) =>
      line
        .map((id) => textOf(id).trim())
        .filter((t) => t.length > 0)
        .join(" ")
    )
    .join("\n");
}

/** Shuffles the given scrap texts and composes them into varied fragment lines
 * — the Draft step's "surprise me" over the table's scraps. */
export function composeShuffledTexts(texts: string[], flavor: CutUpComposeFlavor): string {
  return composeLines(shuffle(texts), flavor);
}

/** Every scrap text on the table, in reading order — feed for the compose
 * flavors that ignore the table's layout. */
export function canvasScrapTexts(
  items: CutUpBoardItem[],
  textOf: (id: string) => string,
  rtl: boolean
): string[] {
  return canvasLines(items, rtl)
    .flat()
    .map((id) => textOf(id).trim())
    .filter((t) => t.length > 0);
}

// ── Composing strips into fragment lines ─────────────────────────────────────
// A shuffle that reorders is fine, but the payoff of cut-up is unexpected *lines*.
// Composing groups the strips into varied-length lines so the draft reads as
// verse fragments rather than one strip per line.

export type CutUpComposeFlavor = "short" | "mixed" | "long";

/** Line-length distributions (in strips per line) to draw from per flavor. */
const COMPOSE_SIZES: Record<CutUpComposeFlavor, number[]> = {
  short: [1, 1, 2, 2],
  mixed: [1, 2, 2, 3, 3, 4],
  long: [3, 3, 4, 4, 5],
};

/** Groups strip texts into lines of varied length per the flavor. */
export function composeLines(strips: string[], flavor: CutUpComposeFlavor): string {
  const sizes = COMPOSE_SIZES[flavor];
  const lines: string[] = [];
  let i = 0;
  while (i < strips.length) {
    let take = sizes[Math.floor(Math.random() * sizes.length)];
    // Absorb a lonely last strip into the previous line rather than orphaning it.
    if (strips.length - (i + take) === 1) take += 1;
    lines.push(strips.slice(i, i + take).join(" "));
    i += take;
  }
  return lines.join("\n");
}

/** Shuffles the strips into a fresh order, then composes them into fragment lines
 * — the "surprise me" draft. Board order/locks are untouched; this only produces
 * text for the draft. */
export function composeDraftText(
  chunks: CutUpChunk[],
  boardItems: CutUpBoardItem[],
  flavor: CutUpComposeFlavor
): string {
  const strips = shuffle(orderedStripTexts(chunks, boardItems));
  return composeLines(strips, flavor);
}

// ── Importing from a Lyrics Pad page (line picker) ───────────────────────────
// Importing shouldn't dump a whole song; the writer picks the verse or lines
// they want to work. These helpers back that picker: split a page into
// stanza-tagged lines, and join a selection back into source text.

export type SourceLine = { index: number; text: string; stanza: number };

/** Non-empty lines of a lyric, each tagged with its stanza (blank-line-delimited
 * group) so the picker can offer whole-verse selection. */
export function splitSourceLines(body: string): SourceLine[] {
  const out: SourceLine[] = [];
  let stanza = 0;
  let sawContent = false;
  for (const raw of body.split("\n")) {
    const text = raw.trim();
    if (!text) {
      if (sawContent) stanza++;
      sawContent = false;
      continue;
    }
    out.push({ index: out.length, text, stanza });
    sawContent = true;
  }
  return out;
}

/** Joins the selected lines in original order, keeping a blank line between
 * picks that came from different stanzas so verse structure survives. */
export function joinSelectedLines(lines: SourceLine[], selected: Iterable<number>): string {
  const picked = new Set(selected);
  const chosen = lines.filter((line) => picked.has(line.index));
  let text = "";
  chosen.forEach((line, i) => {
    if (i > 0) text += chosen[i - 1].stanza === line.stanza ? "\n" : "\n\n";
    text += line.text;
  });
  return text;
}

/** Expands/collapses a stanza in a selection: selects every line of the stanza
 * unless all are already selected, in which case it clears them. */
export function toggleStanzaSelection(
  lines: SourceLine[],
  selected: Set<number>,
  stanza: number
): Set<number> {
  const members = lines.filter((line) => line.stanza === stanza).map((line) => line.index);
  const next = new Set(selected);
  const allIn = members.every((index) => next.has(index));
  for (const index of members) {
    if (allIn) next.delete(index);
    else next.add(index);
  }
  return next;
}

// ── Factory + summaries ──────────────────────────────────────────────────────

export function deriveCutUpTitle(sourceText: string): string {
  const firstLine = sourceText.split("\n").map((line) => line.trim()).find((line) => line.length > 0);
  if (!firstLine) return "Untitled Cut-Up";
  const words = firstLine.split(/\s+/).slice(0, 6).join(" ");
  return words.length < firstLine.length ? `${words}…` : words;
}

export function createCutUpSpark(sourceText: string = ""): CutUpSpark {
  const now = Date.now();
  return {
    id: randomId("cutup"),
    type: "cut-up",
    title: deriveCutUpTitle(sourceText),
    createdAt: now,
    updatedAt: now,
    step: "source",
    sourceText,
    chunkMode: "phrase",
    chunks: [],
    boardItems: [],
    assembledDraftText: "",
    seenHelpSteps: [],
  };
}

export function cutUpSummary(spark: CutUpSpark): string {
  const included = spark.chunks.filter((chunk) => chunk.included).length;
  const parts = [`${included} chunk${included === 1 ? "" : "s"}`];
  if (spark.assembledDraftText.trim()) parts.push("draft started");
  else if (spark.boardItems.some((item) => !item.removed)) parts.push("on the board");
  return parts.join(" · ");
}

// ── Defensive sanitization (persisted data may be partial/corrupt) ───────────

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function sanitizeChunks(raw: unknown): CutUpChunk[] {
  if (!Array.isArray(raw)) return [];
  const out: CutUpChunk[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    if (!isString(obj.id) || seen.has(obj.id) || !isString(obj.text)) continue;
    seen.add(obj.id);
    out.push({
      id: obj.id,
      text: obj.text,
      sourceStartIndex: typeof obj.sourceStartIndex === "number" ? obj.sourceStartIndex : 0,
      sourceEndIndex: typeof obj.sourceEndIndex === "number" ? obj.sourceEndIndex : 0,
      included: obj.included !== false,
      locked: obj.locked === true,
      createdAt: typeof obj.createdAt === "number" ? obj.createdAt : Date.now(),
      updatedAt: typeof obj.updatedAt === "number" ? obj.updatedAt : Date.now(),
    });
  }
  return out;
}

function sanitizeBoardItems(raw: unknown, chunks: CutUpChunk[]): CutUpBoardItem[] {
  if (!Array.isArray(raw)) return [];
  const chunkIds = new Set(chunks.map((chunk) => chunk.id));
  const seen = new Set<string>();
  const out: CutUpBoardItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    if (!isString(obj.id) || seen.has(obj.id) || !isString(obj.chunkId) || !chunkIds.has(obj.chunkId)) continue;
    seen.add(obj.id);
    out.push({
      id: obj.id,
      chunkId: obj.chunkId,
      textOverride: isString(obj.textOverride) ? obj.textOverride : undefined,
      order: typeof obj.order === "number" ? obj.order : out.length,
      x: typeof obj.x === "number" ? obj.x : undefined,
      y: typeof obj.y === "number" ? obj.y : undefined,
      locked: obj.locked === true,
      removed: obj.removed === true,
    });
  }
  return out;
}

function sanitizeStep(value: unknown): CutUpStep {
  return value === "chunk" || value === "board" || value === "draft" ? value : "source";
}

function sanitizeMode(value: unknown): CutUpSpark["chunkMode"] {
  return value === "line" || value === "word" || value === "custom" ? value : "phrase";
}

export function sanitizeCutUpSpark(raw: unknown): CutUpSpark | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!isString(obj.id)) return null;

  const chunks = sanitizeChunks(obj.chunks);
  const boardItemsForSpark = sanitizeBoardItems(obj.boardItems, chunks);
  return {
    id: obj.id,
    type: "cut-up",
    title: isString(obj.title) && obj.title.trim() ? obj.title : "Untitled Cut-Up",
    createdAt: typeof obj.createdAt === "number" ? obj.createdAt : Date.now(),
    updatedAt: typeof obj.updatedAt === "number" ? obj.updatedAt : Date.now(),
    step: sanitizeStep(obj.step),
    sourceText: isString(obj.sourceText) ? obj.sourceText : "",
    sourceLyricId: isString(obj.sourceLyricId) ? obj.sourceLyricId : undefined,
    sourceSongId: isString(obj.sourceSongId) ? obj.sourceSongId : undefined,
    sourceLyricVersionId: isString(obj.sourceLyricVersionId) ? obj.sourceLyricVersionId : undefined,
    chunkMode: sanitizeMode(obj.chunkMode),
    cutSeams: Array.isArray(obj.cutSeams)
      ? obj.cutSeams.filter((s): s is number => typeof s === "number" && s >= 1)
      : undefined,
    chunks,
    boardItems: boardItemsForSpark,
    assembledDraftText: isString(obj.assembledDraftText) ? obj.assembledDraftText : "",
    savedLyricId: isString(obj.savedLyricId) ? obj.savedLyricId : undefined,
    seenHelpSteps: Array.isArray(obj.seenHelpSteps)
      ? obj.seenHelpSteps.filter(
          (s): s is CutUpStep => s === "source" || s === "chunk" || s === "board" || s === "draft"
        )
      : [],
  };
}

export function sanitizeCutUpSparks(raw: unknown): CutUpSpark[] {
  if (!Array.isArray(raw)) return [];
  const out: CutUpSpark[] = [];
  for (const item of raw) {
    const sanitized = sanitizeCutUpSpark(item);
    if (sanitized) out.push(sanitized);
  }
  return out;
}
