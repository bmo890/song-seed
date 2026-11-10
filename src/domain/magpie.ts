import type {
  MagpieBook,
  MagpieFragment,
  MagpieFragmentSource,
  MagpieLanguage,
  MagpieSource,
  MagpieSpark,
  MagpieStep,
} from "../types";
import { i18n } from "../i18n/instance";
import type { MagpieHeGenre } from "../config/magpieService";
import { randomCuratedBook } from "./magpieBooks";
import { fetchBenYehudaPage } from "./magpieBenYehuda";

function randomId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── Fetching a page ──────────────────────────────────────────────────────────
// A "page" is a Range-fetched window of a public-domain book's plain-text file on
// Project Gutenberg. Native fetch (iOS/Android) ignores CORS, so gutenberg.org's
// missing CORS header is a non-issue; the whole feature simply requires a network
// connection, and a failed fetch is what we surface as "offline".

/** ~a paperback page of prose (kept modest so the page isn't a wall of text). */
const PAGE_BYTES = 3000;
/** Skip the license header (top) and license/appendix (bottom) by drawing the
 * window from the middle band of the file. */
const WINDOW_START_FRACTION = 0.1;
const WINDOW_END_FRACTION = 0.82;

import { MagpieFetchError } from "./magpieFetchError";
export { MagpieFetchError, type MagpieFetchErrorKind } from "./magpieFetchError";

/** A connection that opens but never responds (one-bar mobile, an unresponsive
 * gutenberg.org/gutendex.com, a captive portal) would otherwise leave the reader
 * spinning forever — RN's OkHttp default read timeout is infinite. Bound every
 * request the same way wordTools does. */
const REQUEST_TIMEOUT_MS = 8000;

/** Wraps fetch so a thrown network error (no connection) OR a hung request that
 * times out becomes an "offline" MagpieFetchError rather than a raw TypeError or a
 * permanent stall — the reader's ErrorState + retry then handle it. `read` runs
 * under the same timer (2026-10-23): headers that arrive and a body that stalls
 * used to spin the page until the OS dropped the socket. It must only throw for
 * a failed read — anything it throws reads as "offline". */
async function safeFetch<T>(
  url: string,
  init: RequestInit | undefined,
  read: (res: Response) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return await read(res);
  } catch {
    throw new MagpieFetchError("offline", "No connection to the shelf.");
  } finally {
    clearTimeout(timeout);
  }
}

/** Headers for a byte-range read. `Accept-Encoding: identity` matters: iOS and
 * Android ask for gzip by default, and gutenberg.org answers a gzip request with
 * the WHOLE compressed book (200, no Content-Range, no length) instead of the
 * range (2026-10-17: every English page failed with "That page wouldn't open"). */
export function rangeHeaders(start: number, end: number): Record<string, string> {
  return { Range: `bytes=${start}-${end}`, "Accept-Encoding": "identity" };
}

/** Reads the file's total byte length from a tiny Range probe (the number after
 * the slash in Content-Range), falling back to Content-Length. */
async function probeTotalBytes(url: string): Promise<number | null> {
  // Headers only — the two-byte body is never read.
  const res = await safeFetch(url, { headers: rangeHeaders(0, 1) }, async (r) => r);
  const contentRange = res.headers.get("content-range");
  if (contentRange) {
    const match = contentRange.match(/\/(\d+)\s*$/);
    if (match) return parseInt(match[1], 10);
  }
  const contentLength = res.headers.get("content-length");
  if (contentLength) {
    const total = parseInt(contentLength, 10);
    if (Number.isFinite(total) && total > 0) return total;
  }
  return null;
}

/** Chooses a byte window in the middle band of a file of `size` bytes. */
function pickWindow(size: number): { start: number; end: number } {
  if (size <= PAGE_BYTES) return { start: 0, end: Math.max(0, size - 1) };
  const lo = Math.floor(size * WINDOW_START_FRACTION);
  const hi = Math.max(lo + 1, Math.floor(size * WINDOW_END_FRACTION) - PAGE_BYTES);
  const start = lo + Math.floor(Math.random() * (hi - lo));
  return { start, end: start + PAGE_BYTES };
}

const GUTENBERG_BOILERPLATE = /project gutenberg|gutenberg\.org|gutenberg-tm|\*\*\* ?(start|end) of/i;

/** Tidies a raw Range slice into a readable page: normalises newlines, drops the
 * partial first/last lines (the window starts and ends mid-line), removes any
 * stray Gutenberg boilerplate lines, collapses blank runs, and turns the
 * plain-text markup into print: "_word_" italics lose their underscores and a
 * typed "--" becomes the dash it stands for. */
export function cleanPassage(raw: string): string {
  const normalised = raw.replace(/\r\n?/g, "\n");
  let lines = normalised.split("\n");
  // A mid-file window opens and closes mid-line — those partials read as broken.
  if (lines.length > 2) lines = lines.slice(1, -1);
  lines = lines.filter((line) => !GUTENBERG_BOILERPLATE.test(line));
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/_/g, "")
    .replace(/-{2,3}/g, "—")
    .trim();
}

/** Fetches a fresh page from a specific book. Throws MagpieFetchError. */
export async function fetchPassage(book: MagpieBook): Promise<string> {
  const size = await probeTotalBytes(book.textUrl);
  if (!size) throw new MagpieFetchError("unavailable", "That book wouldn't open.");
  const { start, end } = pickWindow(size);
  const res = await safeFetch(book.textUrl, { headers: rangeHeaders(start, end) }, async (r) => ({
    ok: r.ok,
    status: r.status,
    body: r.ok ? await r.text() : "",
  }));
  if (!res.ok && res.status !== 206) {
    throw new MagpieFetchError("unavailable", "That book wouldn't open.");
  }
  const body = res.body;
  // A server that ignores the range answers 200 with the whole book; take the
  // window ourselves rather than show a whole novel as one "page".
  const raw = res.status === 206 ? body : body.slice(start, end);
  const page = cleanPassage(raw);
  if (!page) throw new MagpieFetchError("empty", "That page came back blank.");
  return page;
}

export type MagpiePage = { book: MagpieBook; pageText: string };

/** Draws the next page for a spark, dispatching by language, trimmed to one
 * page (`toOnePage`).
 *
 * - English, Spanish, German, Portuguese: mode "book" (or no/foreign current
 *   book) picks a fresh book from that language's hand-picked shelf
 *   (magpieBooks.ts), then Range-fetches a window; mode "page" re-windows the
 *   current book.
 * - Hebrew: every draw is a fresh Ben-Yehuda work (each work is one short page),
 *   so mode is irrelevant. */
export async function drawPage(
  spark: Pick<MagpieSpark, "language" | "book"> & { heGenres?: MagpieHeGenre[] },
  mode: "book" | "page"
): Promise<MagpiePage> {
  if (spark.language === "he") {
    const page = await fetchBenYehudaPage(spark.heGenres);
    return { book: page.book, pageText: toOnePage(page.pageText, { fromStart: true }) };
  }
  let book = spark.book;
  // A fresh book on an explicit reshuffle, when none exists yet, or when the
  // current book came from a different (Hebrew) source.
  if (mode === "book" || !book || book.source === "benyehuda") book = randomCuratedBook(spark.language);
  return { book, pageText: toOnePage(await fetchPassage(book)) };
}

// ── One page ─────────────────────────────────────────────────────────────────

/** About one phone screen of prose at the default size: the founder found ~500
 *  words read as a wall (2026-11-09). A page ends on a sentence between the two. */
const PAGE_WORDS_MIN = 110;
const PAGE_WORDS_MAX = 170;
const SENTENCE_END = /[.!?…»"”'’)\]]*[.!?…][»"”'’)\]]*$/;

/**
 * Trims a passage to one page. A window cut from the middle of a book opens at
 * its first paragraph (or, failing that, its first full sentence) so the page
 * doesn't begin mid-thought; `fromStart` keeps the opening (a whole short work).
 * It closes on the last sentence end between PAGE_WORDS_MIN and PAGE_WORDS_MAX
 * words, or at PAGE_WORDS_MAX when the prose runs on without one.
 */
export function toOnePage(text: string, opts: { fromStart?: boolean } = {}): string {
  let paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!opts.fromStart && paragraphs.length > 1) {
    // Drop the opening fragment when a real paragraph starts soon after it.
    const firstWords = paragraphs[0]!.split(/\s+/).length;
    if (firstWords < PAGE_WORDS_MAX * 0.6) paragraphs = paragraphs.slice(1);
  } else if (!opts.fromStart && paragraphs.length === 1) {
    const sentenceStart = paragraphs[0]!.search(/[.!?…]["”»’)]?\s+(?=[\p{Lu}"“«¿¡—])/u);
    if (sentenceStart > -1 && sentenceStart < paragraphs[0]!.length / 3) {
      paragraphs[0] = paragraphs[0]!.slice(sentenceStart + 1).replace(/^["”»’)]?\s+/, "");
    }
  }
  const out: string[] = [];
  let count = 0;
  for (const paragraph of paragraphs) {
    const lines = paragraph.split("\n");
    const kept: string[] = [];
    for (const line of lines) {
      const words = line.split(/\s+/).filter(Boolean);
      if (count + words.length <= PAGE_WORDS_MAX) {
        kept.push(line);
        count += words.length;
        continue;
      }
      // This line would run past the page: end on its last sentence in range,
      // or on a sentence already kept, or cut at the limit.
      const room = words.slice(0, PAGE_WORDS_MAX - count);
      let end = -1;
      for (let i = room.length - 1; i >= 0; i--) {
        if (count + i + 1 >= PAGE_WORDS_MIN && SENTENCE_END.test(room[i]!)) {
          end = i;
          break;
        }
      }
      if (end >= 0) kept.push(room.slice(0, end + 1).join(" "));
      else if (count < PAGE_WORDS_MIN || !endsSentence(out, kept)) kept.push(`${room.join(" ")}…`);
      if (kept.length) out.push(kept.join("\n"));
      return out.join("\n\n").trim();
    }
    out.push(kept.join("\n"));
  }
  return out.join("\n\n").trim();
}

function endsSentence(done: string[], current: string[]): boolean {
  const last = current.length ? current[current.length - 1]! : done[done.length - 1] ?? "";
  return SENTENCE_END.test(last.trim());
}

// ── Tokenising a page for tap-to-pocket ──────────────────────────────────────

export type MagpieToken = {
  /** Position in the token stream. */
  index: number;
  text: string;
  /** Word tokens are tappable; if a word, its running word index (else -1). */
  wordIndex: number;
};

// A word keeps internal apostrophes/hyphens (don't, well-being); everything else
// (spaces, punctuation, quotes, em-dashes) is a non-word separator.
const WORD_RE = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;

/** A reflowed paragraph for rendering: its own token slice plus the word indices
 * it contains (so a screen can cheaply memoise per-paragraph). */
export type MagpieParagraph = { key: string; text: string; tokens: MagpieToken[]; wordIndices: number[] };

/** Splits a page into paragraphs (blank-line separated), reflowing each so the
 * book's hard line-wraps don't survive, and tokenises the lot with a single
 * running word index. Returns both the flat token stream (for phrase
 * reconstruction) and the per-paragraph groups (for rendering + memoisation).
 * Paragraphs are separated in the flat stream by a synthetic space so a selection
 * spanning a paragraph break still reconstructs cleanly. */
export function tokenizePageIntoParagraphs(text: string): {
  tokens: MagpieToken[];
  paragraphs: MagpieParagraph[];
} {
  const rawParas = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);
  const tokens: MagpieToken[] = [];
  const paragraphs: MagpieParagraph[] = [];
  let wordIndex = 0;
  rawParas.forEach((para, pi) => {
    const pTokens: MagpieToken[] = [];
    const wordIndices: number[] = [];
    let lastEnd = 0;
    let match: RegExpExecArray | null;
    WORD_RE.lastIndex = 0;
    while ((match = WORD_RE.exec(para))) {
      if (match.index > lastEnd) {
        const sep: MagpieToken = { index: tokens.length, text: para.slice(lastEnd, match.index), wordIndex: -1 };
        tokens.push(sep);
        pTokens.push(sep);
      }
      const word: MagpieToken = { index: tokens.length, text: match[0], wordIndex };
      tokens.push(word);
      pTokens.push(word);
      wordIndices.push(wordIndex);
      wordIndex++;
      lastEnd = match.index + match[0].length;
    }
    if (lastEnd < para.length) {
      const sep: MagpieToken = { index: tokens.length, text: para.slice(lastEnd), wordIndex: -1 };
      tokens.push(sep);
      pTokens.push(sep);
    }
    paragraphs.push({ key: `p${pi}`, text: para, tokens: pTokens, wordIndices });
    if (pi < rawParas.length - 1) {
      tokens.push({ index: tokens.length, text: " ", wordIndex: -1 });
    }
  });
  return { tokens, paragraphs };
}

/** Text of a contiguous word run [startWord, endWord], keeping the punctuation
 * between the words but trimming the ends (so trailing punctuation is dropped). */
function phraseForWordRun(tokens: MagpieToken[], startWord: number, endWord: number): string {
  const startTok = tokens.findIndex((t) => t.wordIndex === startWord);
  let endTok = -1;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].wordIndex === endWord) {
      endTok = i;
      break;
    }
  }
  if (startTok < 0 || endTok < 0) return "";
  return tokens
    .slice(startTok, endTok + 1)
    .map((t) => t.text)
    .join("")
    .trim();
}

/** Groups selected word indices into maximal contiguous runs (each an ascending
 * list). A phrase corresponds to one run; the long-press splitter subdivides a run. */
export function selectedRuns(selectedWords: number[]): number[][] {
  const sorted = [...new Set(selectedWords)].sort((a, b) => a - b);
  const runs: number[][] = [];
  let current: number[] = [];
  for (const word of sorted) {
    if (current.length === 0 || word === current[current.length - 1] + 1) {
      current.push(word);
    } else {
      runs.push(current);
      current = [word];
    }
  }
  if (current.length) runs.push(current);
  return runs;
}

// ── The collected pile (fragments) ───────────────────────────────────────────

function nextOrder(fragments: MagpieFragment[]): number {
  return fragments.reduce((max, f) => Math.max(max, f.order), -1) + 1;
}

export function removeFragment(fragments: MagpieFragment[], id: string): MagpieFragment[] {
  return fragments
    .filter((f) => f.id !== id)
    .map((f, index) => ({ ...f, order: index }));
}

/** Edits a fragment's text (originalText is preserved so the UI can show what it
 * was pocketed as, e.g. after a tense change). */
export function editFragmentText(
  fragments: MagpieFragment[],
  id: string,
  text: string
): MagpieFragment[] {
  return fragments.map((f) => (f.id === id ? { ...withoutSource(f), text } : f));
}

/** Splits a multi-word fragment into one fragment per word, in place. Single-word
 * fragments are left untouched. */
export function splitFragment(fragments: MagpieFragment[], id: string): MagpieFragment[] {
  const index = fragments.findIndex((f) => f.id === id);
  if (index < 0) return fragments;
  const fragment = fragments[index];
  const words = fragment.text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return fragments;
  const pieces: MagpieFragment[] = words.map((word) => ({
    ...withoutSource(fragment),
    id: randomId("frag"),
    text: word,
    originalText: word,
  }));
  const next = [...fragments.slice(0, index), ...pieces, ...fragments.slice(index + 1)];
  return next.map((f, i) => ({ ...f, order: i }));
}

// ── Marking words on the page (collect on tap) ───────────────────────────────
// A tap collects at once: the page's marks ARE the collection, read back from
// each fragment's `source`. A word beside a marked phrase joins it; a tap on a
// marked word lets it go (the phrase shrinks, or splits around it).

/** A short stable key for a page's text, so a fragment knows which page it is on. */
export function magpiePageKey(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${text.length}:${(hash >>> 0).toString(36)}`;
}

function withoutSource(fragment: MagpieFragment): MagpieFragment {
  if (!fragment.source) return fragment;
  const { source: _source, ...rest } = fragment;
  return rest;
}

/** Each marked word on this page → the id of the fragment that holds it. */
export function pageMarks(fragments: MagpieFragment[], page: string): Map<number, string> {
  const marks = new Map<number, string>();
  for (const fragment of fragments) {
    if (fragment.source?.page !== page) continue;
    for (const word of fragment.source.words) marks.set(word, fragment.id);
  }
  return marks;
}

function anchored(
  base: MagpieFragment,
  tokens: MagpieToken[],
  page: string,
  words: number[]
): MagpieFragment {
  const sorted = [...words].sort((a, b) => a - b);
  const text = phraseForWordRun(tokens, sorted[0], sorted[sorted.length - 1]);
  return { ...base, text, originalText: text, source: { page, words: sorted } };
}

/** Replaces one fragment with `pieces` in its place in the order. */
function replaceInOrder(
  fragments: MagpieFragment[],
  id: string,
  pieces: MagpieFragment[]
): MagpieFragment[] {
  const sorted = [...fragments].sort((a, b) => a.order - b.order);
  const index = sorted.findIndex((f) => f.id === id);
  if (index < 0) return fragments;
  return [...sorted.slice(0, index), ...pieces, ...sorted.slice(index + 1)].map((f, i) => ({ ...f, order: i }));
}

/** Tap a word on the page: collect it (joining a marked neighbour) or let it go. */
export function toggleWordOnPage(
  fragments: MagpieFragment[],
  opts: { tokens: MagpieToken[]; page: string; word: number; book: MagpieBook | null }
): MagpieFragment[] {
  const { tokens, page, word, book } = opts;
  if (!tokens.some((token) => token.wordIndex === word)) return fragments;
  const marks = pageMarks(fragments, page);
  const byId = new Map(fragments.map((f) => [f.id, f]));
  const ownerId = marks.get(word);

  if (ownerId) {
    const owner = byId.get(ownerId)!;
    const rest = owner.source!.words.filter((w) => w !== word);
    if (rest.length === 0) return removeFragment(fragments, ownerId);
    const [first, second] = selectedRuns(rest);
    const pieces = [anchored(owner, tokens, page, first)];
    if (second) pieces.push(anchored({ ...owner, id: randomId("frag"), createdAt: Date.now() }, tokens, page, second));
    return replaceInOrder(fragments, ownerId, pieces);
  }

  const left = byId.get(marks.get(word - 1) ?? "");
  const right = byId.get(marks.get(word + 1) ?? "");
  if (left && right && left.id !== right.id) {
    const joined = anchored(left, tokens, page, [...left.source!.words, word, ...right.source!.words]);
    return replaceInOrder(
      fragments.filter((f) => f.id !== right.id),
      left.id,
      [joined]
    );
  }
  const neighbour = left ?? right;
  if (neighbour) {
    return replaceInOrder(fragments, neighbour.id, [anchored(neighbour, tokens, page, [...neighbour.source!.words, word])]);
  }
  const fresh: MagpieFragment = {
    id: randomId("frag"),
    text: "",
    originalText: "",
    bookTitle: book?.title ?? "",
    bookAuthor: book?.author ?? "",
    order: nextOrder(fragments),
    createdAt: Date.now(),
  };
  return [...fragments, anchored(fresh, tokens, page, [word])];
}

/** The long-press "pull apart": cuts one marked phrase at the chosen seams; the
 *  first piece keeps the fragment's id, the rest follow it in the order. */
export function pullApartOnPage(
  fragments: MagpieFragment[],
  opts: { tokens: MagpieToken[]; id: string; cutAfter: Set<number> }
): MagpieFragment[] {
  const owner = fragments.find((f) => f.id === opts.id);
  if (!owner?.source) return fragments;
  const { page, words } = owner.source;
  const groups: number[][] = [];
  let current: number[] = [];
  for (const word of words) {
    current.push(word);
    if (opts.cutAfter.has(word)) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length) groups.push(current);
  if (groups.length < 2) return fragments;
  const pieces = groups.map((group, i) =>
    anchored(i === 0 ? owner : { ...owner, id: randomId("frag"), createdAt: Date.now() }, opts.tokens, page, group)
  );
  return replaceInOrder(fragments, owner.id, pieces);
}

/** Merges a fragment with the one after it (in order) into a single fragment,
 * joining their text with a space. Keeps the first fragment's id/provenance. A
 * no-op if it's the last fragment. Inverse of a split. */
export function mergeFragmentWithNext(fragments: MagpieFragment[], id: string): MagpieFragment[] {
  const sorted = [...fragments].sort((a, b) => a.order - b.order);
  const index = sorted.findIndex((f) => f.id === id);
  if (index < 0 || index >= sorted.length - 1) return fragments;
  const a = sorted[index];
  const b = sorted[index + 1];
  const merged: MagpieFragment = {
    ...withoutSource(a),
    text: `${a.text.trim()} ${b.text.trim()}`.trim(),
    originalText: `${a.originalText.trim()} ${b.originalText.trim()}`.trim(),
  };
  return [...sorted.slice(0, index), merged, ...sorted.slice(index + 2)].map((f, i) => ({ ...f, order: i }));
}

/** Splits one contiguous run of selected words into phrases at chosen seams.
 * `runWords` is the ascending word indices of the run; `cutAfter` holds the word
 * indices after which to break. Powers the page's long-press "pull apart" editor:
 * every grouping of the run is one set of cut seams. */
export function runToPhrases(
  tokens: MagpieToken[],
  runWords: number[],
  cutAfter: Set<number>
): string[] {
  if (runWords.length === 0) return [];
  const pieces: string[] = [];
  let start = runWords[0];
  let prev = runWords[0];
  for (let k = 1; k < runWords.length; k++) {
    const word = runWords[k];
    if (cutAfter.has(prev)) {
      const phrase = phraseForWordRun(tokens, start, prev);
      if (phrase) pieces.push(phrase);
      start = word;
    }
    prev = word;
  }
  const tail = phraseForWordRun(tokens, start, prev);
  if (tail) pieces.push(tail);
  return pieces;
}

/** Applies a new visual order (fragment ids, top to bottom). */
export function reorderFragments(fragments: MagpieFragment[], orderedIds: string[]): MagpieFragment[] {
  const byId = new Map(fragments.map((f) => [f.id, f]));
  const reordered: MagpieFragment[] = [];
  orderedIds.forEach((id, index) => {
    const fragment = byId.get(id);
    if (fragment) reordered.push({ ...fragment, order: index });
  });
  // Keep any not named in the order (defensive) parked at the end.
  let tail = reordered.length;
  for (const fragment of fragments) {
    if (!orderedIds.includes(fragment.id)) reordered.push({ ...fragment, order: tail++ });
  }
  return reordered;
}

/** Assembles the fragments (in order) into a draft, one per line. */
export function assembleDraft(fragments: MagpieFragment[]): string {
  return [...fragments]
    .sort((a, b) => a.order - b.order)
    .map((f) => f.text.trim())
    .filter((text) => text.length > 0)
    .join("\n");
}

// ── Factory + summaries ──────────────────────────────────────────────────────

export function deriveMagpieTitle(spark: Pick<MagpieSpark, "draft" | "fragments">): string {
  const draftLine = spark.draft
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  const source = draftLine ?? spark.fragments[0]?.text ?? "";
  if (!source) return i18n.t("magpie.untitledSpark");
  const words = source.split(/\s+/).slice(0, 6).join(" ");
  return words.length < source.length ? `${words}…` : words;
}

export function createMagpieSpark(language: MagpieLanguage = "en"): MagpieSpark {
  const now = Date.now();
  return {
    id: randomId("magpie"),
    type: "magpie",
    title: i18n.t("magpie.untitledSpark"),
    createdAt: now,
    updatedAt: now,
    step: "page",
    book: null,
    pageText: "",
    fragments: [],
    draft: "",
    language,
    wholeLibrary: false,
    seenHelpSteps: [],
    usedFragmentIds: [],
  };
}

// ── Defensive sanitization (persisted data may be partial/corrupt) ───────────

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function sanitizeSource(value: unknown): MagpieSource | undefined {
  return value === "gutenberg" || value === "benyehuda" ? value : undefined;
}

function sanitizeBook(raw: unknown): MagpieBook | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!isString(obj.id) || !isString(obj.textUrl)) return null;
  return {
    id: obj.id,
    title: isString(obj.title) ? obj.title : "",
    author: isString(obj.author) ? obj.author : "",
    textUrl: obj.textUrl,
    source: sanitizeSource(obj.source),
    thumbnailUrl: isString(obj.thumbnailUrl) ? obj.thumbnailUrl : undefined,
    sourceUrl: isString(obj.sourceUrl) ? obj.sourceUrl : undefined,
  };
}

function sanitizeFragmentSource(raw: unknown): MagpieFragmentSource | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  if (!isString(obj.page) || !Array.isArray(obj.words)) return undefined;
  const words = obj.words.filter((w): w is number => Number.isInteger(w) && (w as number) >= 0);
  return words.length > 0 ? { page: obj.page, words } : undefined;
}

function sanitizeFragments(raw: unknown): MagpieFragment[] {
  if (!Array.isArray(raw)) return [];
  const out: MagpieFragment[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    if (!isString(obj.id) || seen.has(obj.id) || !isString(obj.text)) continue;
    seen.add(obj.id);
    const source = sanitizeFragmentSource(obj.source);
    out.push({
      id: obj.id,
      text: obj.text,
      originalText: isString(obj.originalText) ? obj.originalText : obj.text,
      bookTitle: isString(obj.bookTitle) ? obj.bookTitle : "",
      bookAuthor: isString(obj.bookAuthor) ? obj.bookAuthor : "",
      order: typeof obj.order === "number" ? obj.order : out.length,
      createdAt: typeof obj.createdAt === "number" ? obj.createdAt : Date.now(),
      ...(source ? { source } : {}),
    });
  }
  return out;
}

function sanitizeStep(value: unknown): MagpieStep {
  return value === "build" ? "build" : "page";
}

export function sanitizeMagpieSpark(raw: unknown): MagpieSpark | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!isString(obj.id)) return null;
  return {
    id: obj.id,
    type: "magpie",
    title: isString(obj.title) && obj.title.trim() ? obj.title : i18n.t("magpie.untitledSpark"),
    createdAt: typeof obj.createdAt === "number" ? obj.createdAt : Date.now(),
    updatedAt: typeof obj.updatedAt === "number" ? obj.updatedAt : Date.now(),
    step: sanitizeStep(obj.step),
    book: sanitizeBook(obj.book),
    pageText: isString(obj.pageText) ? obj.pageText : "",
    fragments: sanitizeFragments(obj.fragments),
    draft: isString(obj.draft) ? obj.draft : "",
    language: obj.language === "he" || obj.language === "es" || obj.language === "de" || obj.language === "pt" ? obj.language : "en",
    wholeLibrary: obj.wholeLibrary === true,
    savedLyricId: isString(obj.savedLyricId) ? obj.savedLyricId : undefined,
    finishedAt: typeof obj.finishedAt === "number" && Number.isFinite(obj.finishedAt) ? obj.finishedAt : undefined,
    seenHelpSteps: Array.isArray(obj.seenHelpSteps)
      ? obj.seenHelpSteps.filter((s): s is MagpieStep => s === "page" || s === "build")
      : [],
    usedFragmentIds: Array.isArray(obj.usedFragmentIds)
      ? obj.usedFragmentIds.filter((s): s is string => isString(s))
      : [],
  };
}

export function sanitizeMagpieSparks(raw: unknown): MagpieSpark[] {
  if (!Array.isArray(raw)) return [];
  const out: MagpieSpark[] = [];
  for (const item of raw) {
    const sanitized = sanitizeMagpieSpark(item);
    if (sanitized) out.push(sanitized);
  }
  return out;
}
