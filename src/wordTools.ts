/**
 * Word Finder — rhyming dictionary + thesaurus for lyric writing.
 *
 * Backed by the Datamuse API (https://www.datamuse.com/api/). Datamuse is keyless
 * until Jan 1 2027; after that every request needs an app-level API key, which must
 * NOT ship in the client bundle. The migration path is a thin proxy (see
 * server/word-proxy/) that injects the key server-side — when it's deployed, point
 * WORD_SERVICE_BASE_URL at it and nothing else in the app changes.
 */

export const WORD_SERVICE_BASE_URL = "https://api.datamuse.com";

const MAX_RESULTS = 40;
const REQUEST_TIMEOUT_MS = 8000;

export type WordLookupMode = "rhymes" | "near" | "similar" | "related";

export type WordSuggestion = {
  word: string;
  score: number;
  numSyllables?: number;
};

type ModeConfig = {
  label: string;
  /** Datamuse query parameter carrying the looked-up word. */
  param: string;
  description: string;
};

export const WORD_LOOKUP_MODES: Record<WordLookupMode, ModeConfig> = {
  rhymes: { label: "Rhymes", param: "rel_rhy", description: "Perfect rhymes." },
  near: { label: "Near", param: "rel_nry", description: "Near rhymes — close but not exact." },
  similar: { label: "Similar", param: "ml", description: "Words with a similar meaning." },
  related: { label: "Related", param: "rel_trg", description: "Words the theme brings to mind." },
};

export const WORD_LOOKUP_MODE_ORDER: WordLookupMode[] = ["rhymes", "near", "similar", "related"];

/** Characters that count as part of a lyric word (apostrophes for contractions, hyphens). */
const WORD_CHAR = /[A-Za-z0-9'’-]/;

export type WordRange = { word: string; start: number; end: number };

/**
 * Find the word at a cursor position or inside a selection. A collapsed cursor
 * expands to the word around it; a selection is trimmed to its word characters.
 * Returns null when there is no word at the position.
 */
export function extractWordRange(text: string, start: number, end: number): WordRange | null {
  const length = text.length;
  let from = Math.max(0, Math.min(start, length));
  let to = Math.max(from, Math.min(end, length));

  if (from === to) {
    // Collapsed cursor: expand outward to word boundaries. A cursor sitting just
    // after a word (the common "just typed it" position) still finds that word.
    if (from > 0 && !WORD_CHAR.test(text[from] ?? "") && WORD_CHAR.test(text[from - 1])) {
      from -= 1;
      to = from;
    }
    while (from > 0 && WORD_CHAR.test(text[from - 1])) from -= 1;
    while (to < length && WORD_CHAR.test(text[to])) to += 1;
  } else {
    // Selection: trim leading/trailing non-word characters.
    while (from < to && !WORD_CHAR.test(text[from])) from += 1;
    while (to > from && !WORD_CHAR.test(text[to - 1])) to -= 1;
  }

  const word = text.slice(from, to).trim();
  if (!word || !/[A-Za-z]/.test(word)) return null;
  return { word, start: from, end: to };
}

/**
 * Insert a picked word into lyric text. Replaces [start, end) when the range is a
 * real selection, otherwise inserts at the caret with spaces added where the word
 * would otherwise fuse with its neighbors. Returns the new text and caret position.
 */
export function insertWordIntoText(
  text: string,
  start: number,
  end: number,
  word: string
): { text: string; caret: number } {
  const length = text.length;
  const from = Math.max(0, Math.min(start, length));
  const to = Math.max(from, Math.min(end, length));
  const before = text.slice(0, from);
  const after = text.slice(to);

  let insert = word;
  if (from === to) {
    if (before.length > 0 && !/\s$/.test(before)) insert = ` ${insert}`;
    if (after.length > 0 && WORD_CHAR.test(after[0])) insert = `${insert} `;
  }

  return { text: before + insert + after, caret: from + insert.length };
}

/**
 * Place a picked suggestion into text, given the editor's current selection.
 * An explicit selection is replaced (trimmed to its word characters); a caret
 * strictly inside a word replaces the whole word rather than splitting it;
 * otherwise the word is inserted at the caret with smart spacing. Shared by
 * every editor that hosts the Word Finder so picking behaves identically.
 */
export function applyPickedWord(
  text: string,
  selStart: number,
  selEnd: number,
  word: string
): { text: string; caret: number } {
  let start = selStart;
  let end = selEnd;
  const range = extractWordRange(text, selStart, selEnd);
  if (range && (selEnd > selStart || (range.start < selStart && selStart < range.end))) {
    start = range.start;
    end = range.end;
  }
  return insertWordIntoText(text, start, end, word);
}

export function buildWordLookupUrl(
  mode: WordLookupMode,
  word: string,
  baseUrl: string = WORD_SERVICE_BASE_URL
): string {
  const config = WORD_LOOKUP_MODES[mode];
  const params = new URLSearchParams();
  params.set(config.param, word.trim().toLowerCase());
  params.set("max", String(MAX_RESULTS));
  // Syllable counts let the UI (and future meter tools) speak a songwriter's language.
  params.set("md", "s");
  return `${baseUrl}/words?${params.toString()}`;
}

export function parseWordSuggestions(payload: unknown): WordSuggestion[] {
  if (!Array.isArray(payload)) return [];
  const suggestions: WordSuggestion[] = [];
  for (const entry of payload) {
    if (!entry || typeof entry !== "object") continue;
    const word = (entry as { word?: unknown }).word;
    if (typeof word !== "string" || !word.trim()) continue;
    const score = (entry as { score?: unknown }).score;
    const numSyllables = (entry as { numSyllables?: unknown }).numSyllables;
    suggestions.push({
      word: word.trim(),
      score: typeof score === "number" ? score : 0,
      numSyllables: typeof numSyllables === "number" ? numSyllables : undefined,
    });
  }
  return suggestions;
}

export class WordLookupOfflineError extends Error {
  constructor() {
    super("Word lookup needs a connection");
    this.name = "WordLookupOfflineError";
  }
}

// Session-scoped cache: rhymes/synonyms for a word never change, so repeat lookups
// while writing (flipping between modes, re-checking a word) should be instant and free.
const cache = new Map<string, WordSuggestion[]>();
const CACHE_LIMIT = 200;

export function clearWordLookupCache() {
  cache.clear();
}

export async function fetchWordSuggestions(
  mode: WordLookupMode,
  word: string,
  options?: { signal?: AbortSignal; baseUrl?: string }
): Promise<WordSuggestion[]> {
  const normalized = word.trim().toLowerCase();
  if (!normalized) return [];

  const cacheKey = `${mode}:${normalized}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const url = buildWordLookupUrl(mode, normalized, options?.baseUrl);
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);
  const abort = () => timeoutController.abort();
  options?.signal?.addEventListener("abort", abort);

  let response: Response;
  try {
    response = await fetch(url, { signal: timeoutController.signal });
  } catch (error) {
    if (options?.signal?.aborted) throw error;
    throw new WordLookupOfflineError();
  } finally {
    clearTimeout(timeout);
    options?.signal?.removeEventListener("abort", abort);
  }

  if (!response.ok) throw new Error(`Word lookup failed (${response.status})`);
  const suggestions = parseWordSuggestions(await response.json());

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(cacheKey, suggestions);
  return suggestions;
}
