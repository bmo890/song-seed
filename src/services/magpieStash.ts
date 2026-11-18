import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { drawPage, gutenbergMirrorUrl, type MagpiePage } from "../domain/magpie";
import { EMPTY_ROTATION, CURATED_SHELVES, nextShelfBook, type ShelfRotation } from "../domain/magpieBooks";
import { MagpieFetchError } from "../domain/magpieFetchError";
import type { MagpieHeGenre } from "../config/magpieService";
import type { MagpieBook, MagpieLanguage, MagpieSpark } from "../types";

/**
 * Borrowed Words' stash (founder, 2026-11-18): a few unseen pages kept ready on
 * the phone for each language, so a new book opens at once, offline, or while
 * the library is down (gutenberg.org was down for a day, 2026-11-17); the
 * covers of the books drawn, on disk; and a memory of what was shown, so books
 * come round in a shuffled rotation and a book's pages don't repeat.
 *
 * A cache, not the library: its own AsyncStorage key and folder, never in a
 * backup. Losing it costs nothing but a slower first page.
 */

const STASH_KEY = "songnook-magpie-stash";
/** Pages kept ready per language: about 15 KB of text. */
const READY_PAGES = 5;
/** Windows remembered per book, and Hebrew works remembered. */
const WINDOWS_PER_BOOK = 60;
const HE_SEEN_LIMIT = 400;
/** A Hebrew draw that comes back a work already shown tries again this often. */
const HE_REDRAWS = 3;

type GutenbergLanguage = Exclude<MagpieLanguage, "he">;

type Stash = {
  rotations: Partial<Record<GutenbergLanguage, ShelfRotation>>;
  /** Book id → starts of the windows shown from it. */
  windows: Record<string, number[]>;
  heSeen: string[];
  /** Language (Hebrew: with its genres) → pages ready to show. */
  ready: Record<string, MagpiePage[]>;
};

type DrawSpec = Pick<MagpieSpark, "language" | "book"> & { heGenres?: MagpieHeGenre[] };

let stash: Stash = { rotations: {}, windows: {}, heSeen: [], ready: {} };
let loading: Promise<void> | null = null;
const filling = new Set<string>();

const isList = (value: unknown): value is unknown[] => Array.isArray(value);
const strings = (value: unknown): string[] => (isList(value) ? value.filter((v): v is string => typeof v === "string") : []);

function sanitize(raw: unknown): Stash {
  const value = (raw && typeof raw === "object" ? raw : {}) as Partial<Stash>;
  const rotations: Stash["rotations"] = {};
  for (const language of Object.keys(CURATED_SHELVES) as GutenbergLanguage[]) {
    const rotation = value.rotations?.[language];
    if (rotation) rotations[language] = { round: strings(rotation.round), recent: strings(rotation.recent) };
  }
  const windows: Stash["windows"] = {};
  for (const [id, starts] of Object.entries(value.windows ?? {})) {
    if (isList(starts)) windows[id] = starts.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  }
  const ready: Stash["ready"] = {};
  for (const [key, pages] of Object.entries(value.ready ?? {})) {
    if (!isList(pages)) continue;
    ready[key] = pages.filter(
      (page): page is MagpiePage =>
        !!page &&
        typeof (page as MagpiePage).pageText === "string" &&
        !!(page as MagpiePage).pageText &&
        typeof (page as MagpiePage).book?.id === "string"
    );
  }
  return { rotations, windows, heSeen: strings(value.heSeen), ready };
}

function ensureLoaded(): Promise<void> {
  loading ??= (async () => {
    try {
      const raw = await AsyncStorage.getItem(STASH_KEY);
      if (raw) stash = sanitize(JSON.parse(raw));
    } catch {
      // A stash that won't read starts empty.
    }
    await loadCoverIndex();
  })();
  return loading;
}

function save() {
  void AsyncStorage.setItem(STASH_KEY, JSON.stringify(stash)).catch(() => {});
}

function readyKey(spec: DrawSpec): string {
  return spec.language === "he" ? `he:${[...(spec.heGenres ?? [])].sort().join(",")}` : spec.language;
}

// ── Memory of what was shown ────────────────────────────────────────────────

function nextBook(language: GutenbergLanguage): MagpieBook {
  const { book, rotation } = nextShelfBook(language, stash.rotations[language] ?? EMPTY_ROTATION);
  stash.rotations[language] = rotation;
  return book;
}

function seenWindows(book: MagpieBook): readonly number[] {
  return stash.windows[book.id] ?? [];
}

function remember(page: MagpiePage) {
  if (page.book.source === "benyehuda") {
    stash.heSeen = [...stash.heSeen.filter((id) => id !== page.book.id), page.book.id].slice(-HE_SEEN_LIMIT);
  } else if (page.start != null) {
    stash.windows[page.book.id] = [...seenWindows(page.book), page.start].slice(-WINDOWS_PER_BOOK);
  }
}

/** One live draw, clear of what was shown; a Hebrew work already shown is
 *  drawn again a few times before it is let through. */
async function drawFresh(spec: DrawSpec, mode: "book" | "page"): Promise<MagpiePage> {
  if (spec.language !== "he") {
    const page = await drawPage(spec, mode, { nextBook, seenWindows });
    remember(page);
    return page;
  }
  let page = await drawPage(spec, mode);
  for (let redraw = 0; redraw < HE_REDRAWS && stash.heSeen.includes(page.book.id); redraw++) {
    page = await drawPage(spec, mode);
  }
  remember(page);
  return page;
}

// ── Pages kept ready ────────────────────────────────────────────────────────

function takeReady(key: string): MagpiePage | null {
  const pages = stash.ready[key] ?? [];
  const shelves = CURATED_SHELVES as Record<string, { id: number }[]>;
  // A book that left its shelf in an update is not shown.
  const index = pages.findIndex(
    (page) =>
      page.book.source === "benyehuda" ||
      (shelves[key]?.some((entry) => String(entry.id) === page.book.id) ?? false)
  );
  stash.ready[key] = index < 0 ? [] : pages.slice(index + 1);
  save();
  return index < 0 ? null : pages[index]!;
}

/** Tops the ready pages up in the background, one at a time, stopping at the
 *  first failure (offline, or the library down: the next draw tries again). */
function refill(spec: DrawSpec) {
  const key = readyKey(spec);
  if (filling.has(key)) return;
  filling.add(key);
  void (async () => {
    try {
      while ((stash.ready[key]?.length ?? 0) < READY_PAGES) {
        const page = await drawFresh({ ...spec, book: null }, "book");
        stash.ready[key] = [...(stash.ready[key] ?? []), page];
        save();
        void cacheCover(page.book);
      }
    } catch {
      // Left as it is; the next draw tops it up.
    } finally {
      filling.delete(key);
    }
  })();
}

/**
 * The page a reader turns to. A new book comes from the ready pages when there
 * are some (instant, and never one shown before); otherwise, and for a new page
 * of the same book, it is drawn live, and if that fails a ready page stands in.
 * Either way the ready pages are topped up behind it.
 */
export async function drawMagpiePage(spec: DrawSpec, mode: "book" | "page"): Promise<MagpiePage> {
  await ensureLoaded();
  const key = readyKey(spec);
  const sameBookPage =
    mode === "page" && spec.language !== "he" && !!spec.book && spec.book.source !== "benyehuda";
  try {
    if (!sameBookPage) {
      const ready = takeReady(key);
      if (ready) return ready;
    }
    const page = await drawFresh(spec, mode);
    save();
    void cacheCover(page.book);
    return page;
  } catch (error) {
    const ready = takeReady(key);
    if (ready) return ready;
    throw error instanceof MagpieFetchError ? error : new MagpieFetchError("unavailable", "No page came back.");
  } finally {
    refill(spec);
  }
}

// ── Covers on disk ──────────────────────────────────────────────────────────

const COVER_DIR = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}magpie-covers/` : null;
const cachedCovers = new Set<string>();

const coverFile = (book: MagpieBook) => `${book.source ?? "gutenberg"}-${book.id.replace(/[^\w-]/g, "")}.jpg`;

async function loadCoverIndex() {
  if (!COVER_DIR) return;
  try {
    const info = await FileSystem.getInfoAsync(COVER_DIR);
    if (!info.exists) return;
    for (const name of await FileSystem.readDirectoryAsync(COVER_DIR)) cachedCovers.add(name);
  } catch {
    // No index: covers load from the library.
  }
}

/** Saves a book's cover to disk, from Gutenberg or its mirror. */
async function cacheCover(book: MagpieBook) {
  if (!COVER_DIR || !book.thumbnailUrl || cachedCovers.has(coverFile(book))) return;
  const target = `${COVER_DIR}${coverFile(book)}`;
  try {
    await FileSystem.makeDirectoryAsync(COVER_DIR, { intermediates: true });
    for (const url of [book.thumbnailUrl, gutenbergMirrorUrl(book.thumbnailUrl)]) {
      if (!url) continue;
      const result = await FileSystem.downloadAsync(url, target).catch(() => null);
      if (result?.status === 200) {
        cachedCovers.add(coverFile(book));
        return;
      }
      await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => {});
    }
  } catch {
    // The cover loads from the library next time.
  }
}

/** Where a book's cover can be read from, best first: the copy on disk, the
 *  library, its mirror. */
export function magpieCoverSources(book: MagpieBook | null): string[] {
  if (!book?.thumbnailUrl) return [];
  const sources: string[] = [];
  if (COVER_DIR && cachedCovers.has(coverFile(book))) sources.push(`${COVER_DIR}${coverFile(book)}`);
  sources.push(book.thumbnailUrl);
  const mirror = gutenbergMirrorUrl(book.thumbnailUrl);
  if (mirror) sources.push(mirror);
  return sources;
}

/** Starts the stash early (the Borrowed Words screen opening), so the first
 *  page can come from it and the covers index is read. */
export function warmMagpieStash(spec: DrawSpec) {
  void ensureLoaded().then(() => refill(spec));
}
