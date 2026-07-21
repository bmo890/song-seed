/**
 * Magpie Hebrew-source proxy — fronts the Project Ben-Yehuda public API.
 *
 *   app  →  this worker (injects BENYEHUDA_KEY, caches)  →  benyehuda.org/api/v1
 *
 * The Magpie "steal words" feature draws a random passage from a public-domain
 * literary work. For English it hits Gutenberg directly (keyless). For Hebrew we
 * use Project Ben-Yehuda, whose API (a) REQUIRES an app key that must not ship in
 * the bundle, and (b) is limited to 50 req/min per key. This worker holds the key
 * server-side and keeps a cached INDEX of eligible work IDs so a user tapping
 * "new page" almost never triggers an upstream call.
 *
 * Why an index and not "just query on each request": Ben-Yehuda search is
 * cursor-paginated (no random-page jump), so without a cached pool the cheapest
 * query returns the same first-page works every time — the opposite of variety.
 * The index is tiny (id + title + author per work, a few hundred KB) and lives in
 * KV; the actual text is fetched fresh per draw and edge-cached per work id.
 *
 * The index is self-building: the first Hebrew draw with an empty index kicks off
 * a background rebuild (and serves a live fallback meanwhile), and a weekly cron
 * keeps it fresh. No manual build step or admin token needed.
 *
 * Deploy:
 *   1. Get a free key at https://benyehuda.org/api_keys/new
 *   2. `npx wrangler kv namespace create MAGPIE_KV` → put the id in wrangler.toml
 *   3. `npx wrangler deploy`
 *   4. `npx wrangler secret put BENYEHUDA_KEY`
 *
 * App-side contract:
 *   GET /magpie/he/random
 *     → 200 { id, title, author, sourceUrl, text }   // text = cleaned plaintext
 *     → 503 { error } if the index is empty and the live fallback also fails
 *
 * ATTRIBUTION (required): every field except `text` exists so the Magpie UI can
 * credit the WORK (title), the AUTHOR, and PROJECT BEN-YEHUDA as the source
 * (link to sourceUrl) while the passage is shown. See README "Attribution".
 */

const API_BASE = "https://benyehuda.org/api/v1";
// Bumped to :v2 when the index gained a `genre` per item — old flat pools ignored.
const KV_POOL_KEY = "he:pool:v2";

// No original_language filter, so the corpus intentionally includes BOTH original
// Hebrew works and translations-into-Hebrew. 'revival' (1880–1948) is the
// readable-modern sweet spot; 'modern' (1948+) is thin under public-domain rules
// but adds a little more.
const PERIODS = ["revival", "modern"];

// Prose-family genres the app can offer (poetry + drama are excluded — verse
// arrives song-shaped, defeating the exercise; reference/lexicon are dictionaries).
// The index covers all of these with a `genre` tag per work; the app picks a
// subset per request via ?genres=. Keep in sync with MAGPIE_HE_GENRES in the app.
const CANDIDATE_GENRES = ["prose", "memoir", "letters", "fables"];
const CANDIDATE_GENRE_SET = new Set(CANDIDATE_GENRES);
const DEFAULT_GENRES = ["prose"];

// Cap PER GENRE so smaller genres (fables/letters) are represented rather than
// buried behind prose in one combined alphabetical cap.
const PER_GENRE_CAP = 1500;
const PAGE_SIZE = 25; // Ben-Yehuda's fixed page size
// Stay comfortably under 50 req/min while paging the index.
const REBUILD_PAGE_DELAY_MS = 1500;

/** Parse ?genres=prose,memoir into a validated subset of the candidates. */
function requestedGenres(url) {
  const raw = (url.searchParams.get("genres") || "").split(",").map((g) => g.trim());
  const valid = raw.filter((g) => CANDIDATE_GENRE_SET.has(g));
  return valid.length ? valid : DEFAULT_GENRES;
}

// Keep Magpie's "one page" feel: if a work is long, show a random window rather
// than a whole novella. Poems/short prose fall under this and pass through whole.
const MAX_TEXT_CHARS = 8000;

// Ben-Yehuda txt carries nikkud (vowel points). Stripped by default: Hebrew lyrics
// are written without them, so a word pocketed with nikkud would drag diacritics
// into the draft. Set false to keep the pointed text as-is.
const STRIP_NIKKUD = true;
// Hebrew niqqud + cantillation marks (U+0591–U+05C7), excluding maqaf U+05BE
const NIKKUD_RE = /[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g;

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/magpie/he/random") {
      return handleRandom(env, ctx, requestedGenres(url));
    }
    return json({ error: "not found" }, 404);
  },

  // Weekly refresh — the corpus is near-static, so this rarely changes anything.
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(maybeRebuildInBackground(env));
  },
};

// ── Random draw ────────────────────────────────────────────────────────────

async function handleRandom(env, ctx, genres) {
  const wanted = new Set(genres);
  const pool = await readPool(env);
  const eligible = pool ? pool.filter((item) => wanted.has(item.genre)) : [];

  // Cold start, OR the current pool has nothing in the requested genres yet:
  // kick off a background rebuild so variety ramps up on its own, and serve a
  // single live search (in the requested genres) meanwhile.
  if (eligible.length === 0) {
    ctx.waitUntil(maybeRebuildInBackground(env));
    const fallback = await liveFallbackDraw(env, genres);
    if (fallback) return json(fallback, 200);
    return json({ error: "index unavailable" }, 503);
  }

  const pick = eligible[Math.floor(Math.random() * eligible.length)];
  const work = await fetchWork(env, ctx, pick.id);
  if (!work) return json({ error: "text fetch failed" }, 502);

  return json(
    {
      id: pick.id,
      title: pick.title || work.title || "",
      author: pick.author || work.author || "",
      sourceUrl: work.sourceUrl,
      text: work.text,
    },
    200,
  );
}

// Fetch one work's plaintext, edge-cached per id (so repeat draws of the same
// work never re-hit Ben-Yehuda). Returns { title, author, sourceUrl, text }.
async function fetchWork(env, ctx, id) {
  const cache = caches.default;
  const cacheKey = new Request(`https://magpie.cache/he/text/${id}`);
  const cached = await cache.match(cacheKey);
  if (cached) return cached.json();

  // 1. Metadata + a fresh download_url for the txt format.
  const metaUrl = new URL(`${API_BASE}/texts/${id}`);
  metaUrl.searchParams.set("key", env.BENYEHUDA_KEY);
  metaUrl.searchParams.set("file_format", "txt");
  metaUrl.searchParams.set("view", "basic");
  const metaRes = await fetch(metaUrl, { headers: { Accept: "application/json" } });
  if (!metaRes.ok) return null;
  const meta = await metaRes.json();

  const downloadUrl = meta.download_url || meta.download_link;
  if (!downloadUrl) return null;

  // 2. The actual plaintext file.
  const txtRes = await fetch(downloadUrl);
  if (!txtRes.ok) return null;
  const raw = await txtRes.text();

  const work = {
    title: meta.metadata?.title || "",
    author: meta.metadata?.author_string || "",
    sourceUrl: meta.url || `https://benyehuda.org/read/${id}`,
    text: preparePassage(raw),
  };

  // Text of a public-domain work never changes — cache hard at the edge.
  const toCache = new Response(JSON.stringify(work), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=2592000" },
  });
  ctx.waitUntil(cache.put(cacheKey, toCache));
  return work;
}

// If the index has nothing in the requested genres yet, one live search + text
// fetch so the feature still responds. Pages a few times in case of thin pages.
async function liveFallbackDraw(env, genres) {
  const wanted = new Set(genres);
  let candidates = [];
  let searchAfter = null;
  for (let i = 0; i < 3 && candidates.length === 0; i++) {
    const page = await searchPage(env, searchAfter, genres);
    if (!page || !page.data || page.data.length === 0) break;
    candidates = page.data.filter((item) => wanted.has(item?.metadata?.genre));
    searchAfter = page.next_page_search_after;
    if (!searchAfter) break;
  }
  if (candidates.length === 0) return null;
  const item = candidates[Math.floor(Math.random() * candidates.length)];
  const work = await fetchWork(env, { waitUntil: () => {} }, item.id);
  if (!work) return null;
  return {
    id: item.id,
    title: item.metadata?.title || work.title || "",
    author: item.metadata?.author_string || work.author || "",
    sourceUrl: work.sourceUrl,
    text: work.text,
  };
}

// ── Index build ──────────────────────────────────────────────────────────────

// Rebuild at most once per BUILD_LOCK_TTL, so a burst of cold-start requests
// doesn't fire many concurrent rebuilds (each pages the API for minutes).
const BUILD_LOCK_KEY = "he:building";
const BUILD_LOCK_TTL = 300; // seconds

async function maybeRebuildInBackground(env) {
  const inProgress = await env.MAGPIE_KV.get(BUILD_LOCK_KEY);
  if (inProgress) return;
  await env.MAGPIE_KV.put(BUILD_LOCK_KEY, "1", { expirationTtl: BUILD_LOCK_TTL });
  try {
    await rebuildIndex(env);
  } finally {
    await env.MAGPIE_KV.delete(BUILD_LOCK_KEY);
  }
}

// Build the index one genre at a time (each capped at PER_GENRE_CAP) so every
// candidate genre is represented, storing { id, title, author, genre } per work.
async function rebuildIndex(env) {
  const pool = [];

  for (const genre of CANDIDATE_GENRES) {
    let searchAfter = null;
    let count = 0;
    while (count < PER_GENRE_CAP) {
      const page = await searchPage(env, searchAfter, [genre]);
      if (!page || !page.data || page.data.length === 0) break;

      for (const item of page.data) {
        // Trust the item's own genre tag (defensive: the API filter works, but a
        // work is only ever stored under a candidate genre).
        const g = item?.metadata?.genre;
        if (!CANDIDATE_GENRE_SET.has(g)) continue;
        pool.push({ id: item.id, title: item.metadata?.title || "", author: item.metadata?.author_string || "", genre: g });
        count++;
      }

      searchAfter = page.next_page_search_after;
      if (!searchAfter) break; // last page for this genre
      await sleep(REBUILD_PAGE_DELAY_MS); // stay under 50 req/min
    }
  }

  await env.MAGPIE_KV.put(KV_POOL_KEY, JSON.stringify(pool));
  return pool.length;
}

async function searchPage(env, searchAfter, genres) {
  const body = {
    key: env.BENYEHUDA_KEY,
    periods: PERIODS,
    genres,
    view: "metadata",
    sort_by: "alphabetical",
  };
  if (searchAfter) body.search_after = searchAfter;

  const res = await fetch(`${API_BASE}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  return res.json();
}

async function readPool(env) {
  const raw = await env.MAGPIE_KV.get(KV_POOL_KEY);
  return raw ? JSON.parse(raw) : null;
}

// ── Text prep ────────────────────────────────────────────────────────────────

// Strip Ben-Yehuda's file boilerplate and, for long works, show a random window
// so Magpie keeps its single-page feel. Word tokenization / RTL happen app-side.
function preparePassage(raw) {
  let text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/^\n+/, "");

  // Ben-Yehuda files open with a byline header on the first line — always
  // "{title} מאת {author}", and for translations "… תורגם מ{lang} מאת {translator}".
  // It's redundant with the credit block, so drop the first line when it carries
  // the "מאת" ("by") connective. (Verified live across originals + translations.)
  const firstBreak = text.indexOf("\n");
  const firstLine = firstBreak === -1 ? text : text.slice(0, firstBreak);
  if (/\sמאת\s/.test(firstLine)) {
    text = firstBreak === -1 ? "" : text.slice(firstBreak + 1).replace(/^\n+/, "");
  }

  // Some files also carry a trailing attribution/licence block, separated by a
  // rule of dashes/underscores. Drop everything from that rule on.
  text = text.replace(/\n[_\-–—]{5,}[\s\S]*$/, "\n");

  text = text.replace(/\n{3,}/g, "\n\n").trim();

  if (STRIP_NIKKUD) text = text.replace(NIKKUD_RE, "");

  if (text.length <= MAX_TEXT_CHARS) return text;

  // Long work: take a window starting at a paragraph break in the middle band.
  const start = Math.floor(text.length * 0.1);
  const nl = text.indexOf("\n\n", start);
  const from = nl >= 0 ? nl + 2 : start;
  return text.slice(from, from + MAX_TEXT_CHARS).trim();
}

// ── helpers ──────────────────────────────────────────────────────────────────

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
