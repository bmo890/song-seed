import type {
  CutUpBoardItem,
  CutUpChunk,
  CutUpChunkMode,
  CutUpSpark,
  CutUpStep,
} from "./types";

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

export function chunkModeLabel(mode: CutUpChunkMode): string {
  if (mode === "custom") return "Custom";
  return CHUNK_MODE_OPTIONS.find((option) => option.key === mode)?.label ?? "Phrase";
}

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

const BOUNDARY_PUNCT = new Set([",", ";", ":", "—", "–"]);

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

/** Assembles the active strips (in order) into a draft, one strip per line. */
export function assembleDraftText(chunks: CutUpChunk[], boardItems: CutUpBoardItem[]): string {
  return boardItems
    .filter((item) => !item.removed)
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((item) => boardItemText(item, chunks).trim())
    .filter((text) => text.length > 0)
    .join("\n");
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
    chunks,
    boardItems: sanitizeBoardItems(obj.boardItems, chunks),
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
