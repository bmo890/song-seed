/**
 * Word-lookup proxy — Song Seed's first (and only) backend piece.
 *
 * Datamuse requires an app-level API key starting Jan 1 2027. That key must not
 * ship inside the app bundle, so this thin Cloudflare Worker fronts the API:
 *
 *   app  →  this worker (injects DATAMUSE_KEY, caches)  →  api.datamuse.com
 *
 * Until the key deadline the app talks to Datamuse directly and this worker does
 * not need to be deployed at all. To cut over: `wrangler deploy`, set the
 * DATAMUSE_KEY secret, and point WORD_SERVICE_BASE_URL (src/wordTools.ts) here.
 *
 * Deliberately unauthenticated for now — Song Seed has no accounts. When Pro
 * entitlements become server-verifiable, gate here (see the marked block below).
 */

const UPSTREAM = "https://api.datamuse.com";

// Only the query params the app actually uses may pass through
// (keep in sync with WORD_LOOKUP_MODES in src/wordTools.ts).
const ALLOWED_PARAMS = new Set([
  "rel_rhy", "rel_nry", "ml", "rel_trg",
  "rel_hom", "rel_cns", "sl",
  "rel_ant", "rel_syn",
  "rel_jjb", "rel_gen", "rel_com",
  "topics", "max", "md", "v",
]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method !== "GET" || url.pathname !== "/words") {
      return new Response("Not found", { status: 404 });
    }

    // ── Entitlement gate (future) ─────────────────────────────────────────
    // When Pro accounts exist, verify the user's token here and 403 non-Pro
    // callers before spending shared Datamuse quota.

    const upstream = new URL(`${UPSTREAM}/words`);
    for (const [key, value] of url.searchParams) {
      if (ALLOWED_PARAMS.has(key)) upstream.searchParams.set(key, value);
    }
    if (env.DATAMUSE_KEY) upstream.searchParams.set("key", env.DATAMUSE_KEY);

    // Rhymes/synonyms for a word never change — cache hard at the edge so most
    // lookups never reach Datamuse (protects the per-key daily quota).
    const cacheKey = new Request(upstream.toString().replace(/([?&])key=[^&]*&?/, "$1"), request);
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const upstreamResponse = await fetch(upstream, {
      headers: { Accept: "application/json" },
    });
    const response = new Response(upstreamResponse.body, upstreamResponse);
    response.headers.set("Cache-Control", "public, max-age=604800");
    response.headers.set("Access-Control-Allow-Origin", "*");
    if (upstreamResponse.ok) ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};
