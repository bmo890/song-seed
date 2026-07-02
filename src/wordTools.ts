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

export type WordLookupMode =
  | "rhymes"
  | "near"
  | "similar"
  | "related"
  | "homophones"
  | "consonance"
  | "soundsLike"
  | "opposite"
  | "synonyms"
  | "describe"
  | "kinds"
  | "parts";

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
  /** Sound-alike modes group results by syllable count for meter matching. */
  groupBySyllables?: boolean;
};

export const WORD_LOOKUP_MODES: Record<WordLookupMode, ModeConfig> = {
  // Quick modes — always visible in the sheet's segmented row.
  rhymes: { label: "Rhymes", param: "rel_rhy", description: "Perfect rhymes.", groupBySyllables: true },
  near: { label: "Near", param: "rel_nry", description: "Near rhymes — close but not exact.", groupBySyllables: true },
  similar: { label: "Similar", param: "ml", description: "Words with a similar meaning." },
  related: { label: "Related", param: "rel_trg", description: "Words the theme brings to mind." },
  // Extended modes — behind the ••• picker, grouped by goal.
  homophones: {
    label: "Homophones",
    param: "rel_hom",
    description: "Same sound, different word — course, coarse.",
    groupBySyllables: true,
  },
  consonance: {
    label: "Consonance",
    param: "rel_cns",
    description: "Same consonant bones — sample, simple.",
    groupBySyllables: true,
  },
  soundsLike: {
    label: "Sounds like",
    param: "sl",
    description: "Close in sound, loose on spelling.",
    groupBySyllables: true,
  },
  opposite: { label: "Opposites", param: "rel_ant", description: "Antonyms — for contrast lines." },
  synonyms: { label: "Synonyms", param: "rel_syn", description: "Strict synonyms only." },
  describe: { label: "Describing words", param: "rel_jjb", description: "Adjectives for it — ocean: deep, vast." },
  kinds: { label: "Kinds of it", param: "rel_gen", description: "More specific — bird: sparrow, heron." },
  parts: { label: "Parts of it", param: "rel_com", description: "What it contains — car: dashboard." },
};

/** The four quick modes shown as segments. */
export const WORD_LOOKUP_MODE_ORDER: WordLookupMode[] = ["rhymes", "near", "similar", "related"];

/** Extended modes for the ••• picker, grouped by the writer's goal. */
export const EXTENDED_WORD_MODE_GROUPS: { title: string; modes: WordLookupMode[] }[] = [
  { title: "Sound", modes: ["homophones", "consonance", "soundsLike"] },
  { title: "Meaning", modes: ["opposite", "synonyms"] },
  { title: "Imagery", modes: ["describe", "kinds", "parts"] },
];

export function isQuickWordMode(mode: WordLookupMode): boolean {
  return WORD_LOOKUP_MODE_ORDER.includes(mode);
}

/**
 * Normalize a free-typed theme ("love, leaving  town") into Datamuse topic
 * words — the API accepts at most five.
 */
export function sanitizeThemeWords(theme: string): string[] {
  return theme
    .toLowerCase()
    .split(/[,\s]+/)
    .map((word) => word.replace(/[^a-z'-]/g, ""))
    .filter((word) => /[a-z]/.test(word))
    .slice(0, 5);
}

export type SyllableGroup = { syllables: number | null; suggestions: WordSuggestion[] };

/**
 * Bucket suggestions by syllable count (ascending, unknown last) so a writer
 * matching a melody can scan same-length words together. Relevance order is
 * preserved within each bucket.
 */
export function groupBySyllableCount(suggestions: WordSuggestion[]): SyllableGroup[] {
  const buckets = new Map<number | null, WordSuggestion[]>();
  for (const suggestion of suggestions) {
    const key = suggestion.numSyllables ?? null;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(suggestion);
    else buckets.set(key, [suggestion]);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return a - b;
    })
    .map(([syllables, grouped]) => ({ syllables, suggestions: grouped }));
}

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

export type WordLookupOptions = {
  baseUrl?: string;
  /** Free-typed theme words — biases any mode via Datamuse's topics param. */
  theme?: string;
};

export function buildWordLookupUrl(
  mode: WordLookupMode,
  word: string,
  options?: WordLookupOptions
): string {
  const config = WORD_LOOKUP_MODES[mode];
  const params = new URLSearchParams();
  params.set(config.param, word.trim().toLowerCase());
  const topics = sanitizeThemeWords(options?.theme ?? "");
  if (topics.length > 0) params.set("topics", topics.join(","));
  params.set("max", String(MAX_RESULTS));
  // Syllable counts let the UI (and future meter tools) speak a songwriter's language.
  params.set("md", "s");
  return `${options?.baseUrl ?? WORD_SERVICE_BASE_URL}/words?${params.toString()}`;
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

/** Shared fetch: timeout, external-abort passthrough, and the offline mapping. */
async function fetchWordServiceJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);
  const abort = () => timeoutController.abort();
  signal?.addEventListener("abort", abort);

  let response: Response;
  try {
    response = await fetch(url, { signal: timeoutController.signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new WordLookupOfflineError();
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }

  if (!response.ok) throw new Error(`Word lookup failed (${response.status})`);
  return response.json();
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
  options?: WordLookupOptions & { signal?: AbortSignal }
): Promise<WordSuggestion[]> {
  const normalized = word.trim().toLowerCase();
  if (!normalized) return [];

  const themeKey = sanitizeThemeWords(options?.theme ?? "").join(",");
  const cacheKey = `${mode}:${themeKey}:${normalized}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const url = buildWordLookupUrl(mode, normalized, options);
  const suggestions = parseWordSuggestions(await fetchWordServiceJson(url, options?.signal));

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(cacheKey, suggestions);
  return suggestions;
}

// ── Definitions ──────────────────────────────────────────────────────────────

export type WordDefinition = { partOfSpeech: string; text: string };

const PART_OF_SPEECH_LABELS: Record<string, string> = {
  n: "noun",
  v: "verb",
  adj: "adjective",
  adv: "adverb",
  u: "other",
};

export function partOfSpeechLabel(tag: string): string {
  return PART_OF_SPEECH_LABELS[tag] ?? tag;
}

function parseWordDefinitions(raw: unknown): WordDefinition[] {
  if (!Array.isArray(raw)) return [];
  const defs: WordDefinition[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const tab = entry.indexOf("\t");
    if (tab === -1) continue;
    const text = entry.slice(tab + 1).trim();
    if (!text) continue;
    defs.push({ partOfSpeech: entry.slice(0, tab).trim(), text });
  }
  return defs;
}

export function buildDefinitionLookupUrl(word: string, baseUrl: string = WORD_SERVICE_BASE_URL): string {
  const params = new URLSearchParams();
  // sp= (spelled like) is Datamuse's documented way to fetch a single word's
  // record — an exact word also matches as its own best "spelled like" hit.
  params.set("sp", word.trim().toLowerCase());
  params.set("md", "d");
  params.set("max", "1");
  return `${baseUrl}/words?${params.toString()}`;
}

// Separate from the suggestions cache: keyed by word only, no mode/theme.
const definitionCache = new Map<string, WordDefinition[]>();
const DEFINITION_CACHE_LIMIT = 200;

/**
 * Fetch a word's definitions for the "hold to preview" popover. Returns an
 * empty array when the word isn't in Datamuse's dictionary data (common for
 * slang, names, or coined lyric words) — not an error, just nothing to show.
 */
export async function fetchWordDefinitions(
  word: string,
  options?: { signal?: AbortSignal; baseUrl?: string }
): Promise<WordDefinition[]> {
  const normalized = word.trim().toLowerCase();
  if (!normalized) return [];

  const cached = definitionCache.get(normalized);
  if (cached) return cached;

  const url = buildDefinitionLookupUrl(normalized, options?.baseUrl);
  const payload = await fetchWordServiceJson(url, options?.signal);
  const first = Array.isArray(payload) ? payload[0] : null;
  const matchesWord =
    first && typeof first === "object" && (first as { word?: unknown }).word === normalized;
  const defs = matchesWord ? parseWordDefinitions((first as { defs?: unknown }).defs) : [];

  if (definitionCache.size >= DEFINITION_CACHE_LIMIT) {
    const oldest = definitionCache.keys().next().value;
    if (oldest !== undefined) definitionCache.delete(oldest);
  }
  definitionCache.set(normalized, defs);
  return defs;
}
