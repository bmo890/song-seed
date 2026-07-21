import type { MagpieBook } from "../types";
import { MAGPIE_HE_SERVICE_BASE_URL, type MagpieHeGenre } from "../config/magpieService";
import { MagpieFetchError } from "./magpie";

// ── Hebrew source: Project Ben-Yehuda via the Magpie worker ──────────────────
// Unlike the Gutenberg path (Range-fetch a byte window of a big book), a Hebrew
// work is short — usually a whole poem or short prose piece — so the worker
// returns the cleaned passage AND its credit metadata in a single call. Each call
// yields a fresh random work, so "new page" and "new book" behave identically.

const REQUEST_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

type WorkerWork = { id?: unknown; title?: unknown; author?: unknown; sourceUrl?: unknown; text?: unknown };

// Hebrew niqqud + cantillation marks (U+0591–U+05C7), minus the maqaf U+05BE —
// matches the worker's body strip so titles read the same way as the passage.
const HE_NIKKUD_RE = /[֑-ׇֽֿׁׂׅׄ]/g;

// Tidy a Ben-Yehuda title for display: strip nikkud (to match the stripped body)
// and a trailing decorative asterisk. Some works also carry meaningless titles (a
// bare number like "5233", a date range) — an artifact of the catalogue; treat a
// title with fewer than two letters as absent, so the UI shows "Untitled" and
// leans on the (always meaningful) author. Also keeps junk out of provenance.
function cleanBenYehudaTitle(raw: unknown): string {
  let title = typeof raw === "string" ? raw.trim() : "";
  title = title.replace(HE_NIKKUD_RE, "").replace(/\s*\*+\s*$/, "").trim();
  const letters = (title.match(/\p{L}/gu) || []).length;
  return letters >= 2 ? title : "";
}

/** Draws a random modern-Hebrew work (original or translation) from Ben-Yehuda.
 * Returns the book (with credit + source link) and its ready-to-read passage.
 * Throws MagpieFetchError so the reader's ErrorState + retry handle failures. */
export async function fetchBenYehudaPage(
  genres?: MagpieHeGenre[]
): Promise<{ book: MagpieBook; pageText: string }> {
  const base = MAGPIE_HE_SERVICE_BASE_URL;
  if (!base) throw new MagpieFetchError("unavailable", "Hebrew source isn't configured.");

  const query = genres && genres.length ? `?genres=${genres.join(",")}` : "";
  let res: Response;
  try {
    res = await fetchWithTimeout(`${base}/magpie/he/random${query}`);
  } catch {
    throw new MagpieFetchError("offline", "No connection to the shelf.");
  }
  if (!res.ok) throw new MagpieFetchError("unavailable", "Couldn't open a Hebrew page.");

  let data: WorkerWork;
  try {
    data = (await res.json()) as WorkerWork;
  } catch {
    throw new MagpieFetchError("unavailable", "Couldn't open a Hebrew page.");
  }

  const text = typeof data.text === "string" ? data.text.trim() : "";
  if (!text) throw new MagpieFetchError("empty", "That page came back blank.");

  const idStr = data.id != null ? String(data.id) : "";
  const sourceUrl = typeof data.sourceUrl === "string" ? data.sourceUrl : "";
  const book: MagpieBook = {
    id: idStr ? `by-${idStr}` : `by-${Date.now()}`,
    title: cleanBenYehudaTitle(data.title),
    author: typeof data.author === "string" ? data.author : "",
    // Ben-Yehuda text isn't Range-fetched, so textUrl only serves as a stable
    // reference; point it at the canonical source page.
    textUrl: sourceUrl,
    source: "benyehuda",
    sourceUrl: sourceUrl || undefined,
  };
  return { book, pageText: text };
}
