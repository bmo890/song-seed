import type { MagpieBook, MagpieFragment, MagpieSource, MagpieSpark, MagpieStep } from "../types";
import type { MagpieHeGenre } from "../config/magpieService";
import { gutenbergCoverUrl, gutenbergSourceUrl, randomCuratedBook } from "./magpieBooks";
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

const GUTENDEX_EN_PAGES = 1900; // ~62k English books / 32 per page

export type MagpieFetchErrorKind = "offline" | "unavailable" | "empty";

/** A typed failure so the UI can distinguish "you're offline" from "that book
 * wouldn't load" and respond appropriately. */
export class MagpieFetchError extends Error {
  kind: MagpieFetchErrorKind;
  constructor(kind: MagpieFetchErrorKind, message: string) {
    super(message);
    this.name = "MagpieFetchError";
    this.kind = kind;
  }
}

/** A connection that opens but never responds (one-bar mobile, an unresponsive
 * gutenberg.org/gutendex.com, a captive portal) would otherwise leave the reader
 * spinning forever — RN's OkHttp default read timeout is infinite. Bound every
 * request the same way wordTools does. */
const REQUEST_TIMEOUT_MS = 8000;

/** Wraps fetch so a thrown network error (no connection) OR a hung request that
 * times out becomes an "offline" MagpieFetchError rather than a raw TypeError or a
 * permanent stall — the reader's ErrorState + retry then handle it. */
async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw new MagpieFetchError("offline", "No connection to the shelf.");
  } finally {
    clearTimeout(timeout);
  }
}

/** Reads the file's total byte length from a tiny Range probe (the number after
 * the slash in Content-Range), falling back to Content-Length. */
async function probeTotalBytes(url: string): Promise<number | null> {
  const res = await safeFetch(url, { headers: { Range: "bytes=0-1" } });
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
 * stray Gutenberg boilerplate lines, and collapses blank runs. */
export function cleanPassage(raw: string): string {
  const normalised = raw.replace(/\r\n?/g, "\n");
  let lines = normalised.split("\n");
  // A mid-file window opens and closes mid-line — those partials read as broken.
  if (lines.length > 2) lines = lines.slice(1, -1);
  lines = lines.filter((line) => !GUTENBERG_BOILERPLATE.test(line));
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Fetches a fresh page from a specific book. Throws MagpieFetchError. */
export async function fetchPassage(book: MagpieBook): Promise<string> {
  const size = await probeTotalBytes(book.textUrl);
  if (!size) throw new MagpieFetchError("unavailable", "That book wouldn't open.");
  const { start, end } = pickWindow(size);
  const res = await safeFetch(book.textUrl, { headers: { Range: `bytes=${start}-${end}` } });
  if (!res.ok && res.status !== 206) {
    throw new MagpieFetchError("unavailable", "That book wouldn't open.");
  }
  const raw = await res.text();
  const page = cleanPassage(raw);
  if (!page) throw new MagpieFetchError("empty", "That page came back blank.");
  return page;
}

// ── Picking a book ───────────────────────────────────────────────────────────

/** "Last, First" → "First Last"; leaves single-token names alone. */
function formatAuthor(name: string): string {
  const parts = name.split(",");
  if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
    return `${parts[1].trim()} ${parts[0].trim()}`;
  }
  return name.trim();
}

/** Cleans a Gutendex title: first line only, MARC "$a/$b" subfield markers out. */
function cleanTitle(title: string): string {
  return title
    .split("\n")[0]
    .replace(/\s*\$[a-z]\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textPlainUrl(formats: Record<string, string>): string | null {
  for (const [mime, url] of Object.entries(formats)) {
    if (mime.startsWith("text/plain") && !url.endsWith(".zip")) return url;
  }
  return null;
}

/** Draws a random English book from anywhere in the Gutenberg library via a
 * random Gutendex page. Retries a few pages if a page has no plain-text books. */
async function fetchRandomLibraryBook(attempts = 3): Promise<MagpieBook> {
  for (let i = 0; i < attempts; i++) {
    const page = 1 + Math.floor(Math.random() * GUTENDEX_EN_PAGES);
    const res = await safeFetch(`https://gutendex.com/books?languages=en&page=${page}`);
    if (!res.ok) continue;
    const data = (await res.json()) as { results?: Array<Record<string, any>> };
    const candidates = (data.results ?? [])
      .map((book) => {
        const url = textPlainUrl(book.formats ?? {});
        if (!url) return null;
        const author = Array.isArray(book.authors) && book.authors[0]?.name ? book.authors[0].name : "Unknown";
        return {
          id: String(book.id),
          title: cleanTitle(String(book.title ?? "Untitled")),
          author: formatAuthor(String(author)),
          textUrl: url,
          source: "gutenberg",
          thumbnailUrl: gutenbergCoverUrl(book.id),
          sourceUrl: gutenbergSourceUrl(book.id),
        } as MagpieBook;
      })
      .filter((book): book is MagpieBook => book !== null);
    if (candidates.length) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
  }
  throw new MagpieFetchError("unavailable", "Couldn't find a book on that shelf.");
}

/** Picks an English book to pull from: the curated pool, or the whole library. */
export async function pickBook(wholeLibrary: boolean): Promise<MagpieBook> {
  if (wholeLibrary) return fetchRandomLibraryBook();
  return randomCuratedBook();
}

export type MagpiePage = { book: MagpieBook; pageText: string };

/** Draws the next page for a spark, dispatching by language. Returns the book and
 * its passage together (the two-call English flow is folded in here so the Hebrew
 * source, which returns both at once, fits the same shape).
 *
 * - English: mode "book" (or no/foreign current book) picks a fresh book, then
 *   Range-fetches a window; mode "page" re-windows the current book.
 * - Hebrew: every draw is a fresh Ben-Yehuda work (each work is one short page),
 *   so mode is irrelevant. */
export async function drawPage(
  spark: Pick<MagpieSpark, "language" | "wholeLibrary" | "book"> & { heGenres?: MagpieHeGenre[] },
  mode: "book" | "page"
): Promise<MagpiePage> {
  if (spark.language === "he") {
    return fetchBenYehudaPage(spark.heGenres);
  }
  let book = spark.book;
  // Force a fresh English book on an explicit reshuffle, when none exists yet, or
  // when the current book came from a different (Hebrew) source.
  if (mode === "book" || !book || book.source === "benyehuda") {
    book = await pickBook(spark.wholeLibrary);
  }
  const pageText = await fetchPassage(book);
  return { book, pageText };
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
export type MagpieParagraph = { key: string; tokens: MagpieToken[]; wordIndices: number[] };

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
    paragraphs.push({ key: `p${pi}`, tokens: pTokens, wordIndices });
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

/** Turns a set of selected word indices into phrases: each maximal run of
 * consecutive words becomes one phrase. */
export function selectionToPhrases(tokens: MagpieToken[], selectedWords: number[]): string[] {
  const sorted = [...new Set(selectedWords)].sort((a, b) => a - b);
  const phrases: string[] = [];
  let runStart: number | null = null;
  let prev: number | null = null;
  const flush = () => {
    if (runStart !== null && prev !== null) {
      const phrase = phraseForWordRun(tokens, runStart, prev);
      if (phrase) phrases.push(phrase);
    }
  };
  for (const word of sorted) {
    if (runStart === null) {
      runStart = word;
      prev = word;
    } else if (word === (prev as number) + 1) {
      prev = word;
    } else {
      flush();
      runStart = word;
      prev = word;
    }
  }
  flush();
  return phrases;
}

// ── The collected pile (fragments) ───────────────────────────────────────────

function nextOrder(fragments: MagpieFragment[]): number {
  return fragments.reduce((max, f) => Math.max(max, f.order), -1) + 1;
}

/** Appends pocketed phrases as fragments, tagged with the book they came from. */
export function addFragments(
  fragments: MagpieFragment[],
  texts: string[],
  book: MagpieBook | null
): MagpieFragment[] {
  const now = Date.now();
  let order = nextOrder(fragments);
  const added = texts
    .map((raw) => raw.trim())
    .filter((text) => text.length > 0)
    .map((text) => ({
      id: randomId("frag"),
      text,
      originalText: text,
      bookTitle: book?.title ?? "",
      bookAuthor: book?.author ?? "",
      order: order++,
      createdAt: now,
    }));
  return [...fragments, ...added];
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
  return fragments.map((f) => (f.id === id ? { ...f, text } : f));
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
    ...fragment,
    id: randomId("frag"),
    text: word,
    originalText: word,
  }));
  const next = [...fragments.slice(0, index), ...pieces, ...fragments.slice(index + 1)];
  return next.map((f, i) => ({ ...f, order: i }));
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
  if (!source) return "Untitled Magpie";
  const words = source.split(/\s+/).slice(0, 6).join(" ");
  return words.length < source.length ? `${words}…` : words;
}

export function createMagpieSpark(): MagpieSpark {
  const now = Date.now();
  return {
    id: randomId("magpie"),
    type: "magpie",
    title: "Untitled Magpie",
    createdAt: now,
    updatedAt: now,
    step: "page",
    book: null,
    pageText: "",
    fragments: [],
    draft: "",
    language: "en",
    wholeLibrary: false,
    seenHelpSteps: [],
  };
}

export function magpieSummary(spark: MagpieSpark): string {
  const count = spark.fragments.length;
  const parts = [`${count} word${count === 1 ? "" : "s"}`];
  if (spark.draft.trim()) parts.push("draft started");
  return parts.join(" · ");
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

function sanitizeFragments(raw: unknown): MagpieFragment[] {
  if (!Array.isArray(raw)) return [];
  const out: MagpieFragment[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    if (!isString(obj.id) || seen.has(obj.id) || !isString(obj.text)) continue;
    seen.add(obj.id);
    out.push({
      id: obj.id,
      text: obj.text,
      originalText: isString(obj.originalText) ? obj.originalText : obj.text,
      bookTitle: isString(obj.bookTitle) ? obj.bookTitle : "",
      bookAuthor: isString(obj.bookAuthor) ? obj.bookAuthor : "",
      order: typeof obj.order === "number" ? obj.order : out.length,
      createdAt: typeof obj.createdAt === "number" ? obj.createdAt : Date.now(),
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
    title: isString(obj.title) && obj.title.trim() ? obj.title : "Untitled Magpie",
    createdAt: typeof obj.createdAt === "number" ? obj.createdAt : Date.now(),
    updatedAt: typeof obj.updatedAt === "number" ? obj.updatedAt : Date.now(),
    step: sanitizeStep(obj.step),
    book: sanitizeBook(obj.book),
    pageText: isString(obj.pageText) ? obj.pageText : "",
    fragments: sanitizeFragments(obj.fragments),
    draft: isString(obj.draft) ? obj.draft : "",
    language: obj.language === "he" ? "he" : "en",
    wholeLibrary: obj.wholeLibrary === true,
    savedLyricId: isString(obj.savedLyricId) ? obj.savedLyricId : undefined,
    seenHelpSteps: Array.isArray(obj.seenHelpSteps)
      ? obj.seenHelpSteps.filter((s): s is MagpieStep => s === "page" || s === "build")
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
