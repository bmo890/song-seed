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
 * Only the weekly cron builds the index (a request's `waitUntil` budget is far
 * shorter than the ~6 min a full build takes, and the request path stays
 * read-only). The build writes the pool after every genre, so a build cut short
 * still leaves the finished genres in KV. While the index has nothing in the
 * requested genres, a request serves a live search instead.
 *
 * Deploy:
 *   1. Get a free key at https://benyehuda.org/api_keys/new
 *   2. `npx wrangler kv namespace create MAGPIE_KV` → put the id in wrangler.toml
 *   3. `npx wrangler deploy`
 *   4. `npx wrangler secret put BENYEHUDA_KEY`
 *   5. First build (or after a pool-key bump): don't wait for Monday —
 *      `npx wrangler dev --remote --test-scheduled` then
 *      `curl "http://localhost:8787/__scheduled?cron=0+4+*+*+1"`.
 *
 * App-side contract:
 *   GET /magpie/he/random
 *     → 200 { id, title, author, sourceUrl, text }   // text = cleaned plaintext
 *     → 429 { error } rate limited (per IP, or the worker-wide breaker)
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
// than a whole novella. Sized to roughly match the English (Gutenberg) page so a
// Hebrew page isn't a wall of text — which also keeps the tap/selection render
// cheap (fewer word spans to mount). Poems/short prose pass through whole.
const MAX_TEXT_CHARS = 3600;

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

const HOUR = 3600;

// ── Rate limiting (KV fixed-window; approximate, fail-open) ───────────────────
// Same shape as word-he. Ben-Yehuda allows 50 req/min on the shared key, and a
// draw costs 2 upstream calls (live fallback: up to 5) — so one person tapping
// "New page" fast, or any script on the public URL, would exhaust the key for
// everyone. Counters tick only on the UPSTREAM path (edge-cache hits are free).
// KV is eventually consistent, so counts can race under load — fine for
// blunting abuse. Fail open when MAGPIE_KV is unbound so dev isn't blocked.

function clientIp(request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    "unknown"
  );
}

function numVar(env, name, fallback) {
  const n = Number(env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Increment a fixed-window counter; allow until `limit`. Returns { ok } or
 * { ok:false, retryAfter } (seconds until the window rolls over). */
async function bumpCounter(env, prefix, limit, windowSec) {
  if (!env.MAGPIE_KV) return { ok: true };
  const nowSec = Date.now() / 1000;
  const key = `${prefix}:${Math.floor(nowSec / windowSec)}`;
  const current = parseInt((await env.MAGPIE_KV.get(key)) || "0", 10);
  if (current >= limit) {
    return { ok: false, retryAfter: Math.ceil(windowSec - (nowSec % windowSec)) };
  }
  // TTL a bit past the window so stale counters self-expire.
  await env.MAGPIE_KV.put(key, String(current + 1), { expirationTtl: Math.ceil(windowSec) + HOUR });
  return { ok: true };
}

function json429(retryAfter) {
  return new Response(JSON.stringify({ error: "rate limited — try again shortly" }), {
    status: 429,
    headers: { ...JSON_HEADERS, "Retry-After": String(retryAfter ?? 60) },
  });
}

/** Per-IP hourly limit, then a worker-wide hourly breaker that catches
 * distributed (many-IP) abuse before it burns the shared upstream key.
 * Returns a 429 Response to short-circuit, or null to proceed upstream. */
async function upstreamGuard(env, ip) {
  const perIp = await bumpCounter(env, `rl:draw:${ip}`, numVar(env, "RATE_DRAWS_PER_HOUR", 120), HOUR);
  if (!perIp.ok) return json429(perIp.retryAfter);
  const global = await bumpCounter(env, "rl:global:draw", numVar(env, "RATE_DRAWS_GLOBAL_PER_HOUR", 1000), HOUR);
  if (!global.ok) return json429(global.retryAfter);
  return null;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/magpie/he/random") {
      return handleRandom(env, ctx, requestedGenres(url), clientIp(request));
    }
    return json({ error: "not found" }, 404);
  },

  // Weekly refresh — the corpus is near-static, so this rarely changes anything.
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(maybeRebuildInBackground(env));
  },
};

// ── Random draw ────────────────────────────────────────────────────────────

async function handleRandom(env, ctx, genres, ip) {
  const wanted = new Set(genres);
  const pool = await readPool(env);
  const eligible = pool ? pool.filter((item) => wanted.has(item.genre)) : [];

  // Cold start, OR the current pool has nothing in the requested genres yet:
  // serve a single live search (in the requested genres). The request path
  // never builds the index — only the cron does (see the header comment).
  if (eligible.length === 0) {
    const blocked = await upstreamGuard(env, ip);
    if (blocked) return blocked;
    const fallback = await liveFallbackDraw(env, genres);
    if (fallback) return json(fallback, 200);
    return json({ error: "index unavailable" }, 503);
  }

  const pick = eligible[Math.floor(Math.random() * eligible.length)];
  let work = await cachedWork(pick.id);
  if (!work) {
    const blocked = await upstreamGuard(env, ip);
    if (blocked) return blocked;
    work = await fetchWork(env, ctx, pick.id);
  }
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

function workCacheKey(id) {
  return new Request(`https://magpie.cache/he/text/${id}`);
}

// A work already at the edge (repeat draws of the same work never re-hit
// Ben-Yehuda, and never count against the rate limit). Null on a miss.
async function cachedWork(id) {
  const cached = await caches.default.match(workCacheKey(id));
  return cached ? cached.json() : null;
}

// Fetch one work's plaintext from Ben-Yehuda and edge-cache it per id.
// Returns { title, author, sourceUrl, text }. Callers run `upstreamGuard` first.
async function fetchWork(env, ctx, id) {
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
  ctx.waitUntil(caches.default.put(workCacheKey(id), toCache));
  return work;
}

// If the index has nothing in the requested genres yet, one live search + text
// fetch so the feature still responds. Pages a few times in case of thin pages.
// Upstream-only path: the caller has already passed `upstreamGuard`.
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
  const work = (await cachedWork(item.id)) || (await fetchWork(env, { waitUntil: () => {} }, item.id));
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

// One build at a time: the lock outlives a full build (4 genres × ≤60 pages ×
// 1.5 s ≈ 6 min, matching the cron's 15-min budget) so a hand-fired cron can't
// run alongside the weekly one; it self-expires if a build dies mid-way.
const BUILD_LOCK_KEY = "he:building";
const BUILD_LOCK_TTL = 900; // seconds

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
// The pool is written after EVERY genre (that genre's entries replaced, the
// others kept), so a build cut short by the runtime still lands what it
// finished, and the pool is never empty between the start and end of a build.
async function rebuildIndex(env) {
  let pool = (await readPool(env)) || [];
  let built = 0;

  for (const genre of CANDIDATE_GENRES) {
    const entries = [];
    let searchAfter = null;
    while (entries.length < PER_GENRE_CAP) {
      const page = await searchPage(env, searchAfter, [genre]);
      if (!page || !page.data || page.data.length === 0) break;

      for (const item of page.data) {
        // Trust the item's own genre tag (defensive: the API filter works, but a
        // work is only ever stored under a candidate genre).
        const g = item?.metadata?.genre;
        if (!CANDIDATE_GENRE_SET.has(g)) continue;
        entries.push({ id: item.id, title: item.metadata?.title || "", author: item.metadata?.author_string || "", genre: g });
      }

      searchAfter = page.next_page_search_after;
      if (!searchAfter) break; // last page for this genre
      await sleep(REBUILD_PAGE_DELAY_MS); // stay under 50 req/min
    }

    // An upstream failure on the first page leaves the genre's old entries alone.
    if (entries.length === 0) continue;
    pool = pool.filter((item) => item.genre !== genre).concat(entries);
    await env.MAGPIE_KV.put(KV_POOL_KEY, JSON.stringify(pool));
    built += entries.length;
  }

  return built;
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
