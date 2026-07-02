# Administrator Checklist

Future operational / administrative work that lives outside day-to-day feature
development. Check items off as they're completed; add new ones with a "why" and
a rough deadline.

**Standing policy: no secrets in the repo.** No API keys, tokens, or `.env` files
are ever committed. As of July 2026 the app has none at all — the only environment
variable in the codebase is `APP_VARIANT` (a build flavor flag, not a secret).
When secrets do arrive, they live in the platform's secret store (Cloudflare
`wrangler secret`, EAS secrets for builds), never in git.

---

## Word Finder / Datamuse cutover — do in fall 2026, before Jan 1 2027

Datamuse (the API behind the lyrics Word Finder) is keyless today. Starting
**Jan 1, 2027** every request needs an app-level API key, which must not ship in
the app bundle. Full details: `server/word-proxy/README.md`.

- [ ] **Request a Datamuse API key** via their feedback form at
      <https://www.datamuse.com/api/> (describe the app + expected traffic).
      Do this first — a human replies, so allow lead time.
- [ ] **Create a Cloudflare account** (free tier: 100k requests/day, matches
      Datamuse's per-key quota).
- [ ] **Deploy the proxy:** from `server/word-proxy/` run `npx wrangler deploy`,
      then `npx wrangler secret put DATAMUSE_KEY` and paste the key.
- [ ] **Point the app at the proxy:** change `WORD_SERVICE_BASE_URL` in
      `src/wordTools.ts` to the worker URL and ship an app update. Nothing else
      in the app changes.
- [ ] **After cutover:** glance at Cloudflare's request analytics once or twice
      to confirm edge caching is absorbing most lookups and the Datamuse quota
      isn't at risk.

The worker passes requests through fine without a key, so deploying early (before
the deadline) is safe and removes time pressure.

## When billing / Pro accounts arrive

- [ ] Flip `ALL_FEATURES_FREE` to `false` in `src/entitlements.ts` and drive
      `proEntitlement` from the billing provider (RevenueCat or native
      StoreKit/Play Billing). Gated call sites are already in place.
- [ ] Decide whether Word Finder is Pro-gated; if so, add the entitlement check
      in the marked block in `server/word-proxy/worker.js` so non-Pro clients
      can't spend the shared Datamuse quota.
- [ ] Store any billing API keys as platform secrets (EAS / wrangler), never in
      the repo.

## If a real backend is ever built

- [ ] Fold the word-proxy into it: expose the same `GET /words?...` contract,
      update `WORD_SERVICE_BASE_URL`, retire the Cloudflare worker.
