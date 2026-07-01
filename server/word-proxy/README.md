# Word-lookup proxy

A single-file Cloudflare Worker that fronts the [Datamuse API](https://www.datamuse.com/api/)
for the in-app Word Finder (rhymes / near rhymes / synonyms / related words).

## Why it exists

Datamuse is keyless today, so **the app calls `api.datamuse.com` directly and this
worker does not need to be deployed yet**. Starting **Jan 1 2027** every Datamuse
request needs an app-level API key (100k requests/day per key). That key must not
ship in the app bundle, so this proxy injects it server-side and caches responses
at the edge to protect the shared quota.

## Deploying (when needed)

1. Request an API key from Datamuse via their feedback form (describe the app).
2. `npx wrangler deploy` from this directory.
3. `npx wrangler secret put DATAMUSE_KEY`
4. Point `WORD_SERVICE_BASE_URL` in `src/wordTools.ts` at the worker URL.
   Nothing else in the app changes.

## Future

- **Pro gating:** when server-verifiable entitlements exist, verify them in the
  marked block in `worker.js` before forwarding.
- If a bigger backend materializes, this endpoint folds into it — the app-side
  contract is just `GET /words?rel_rhy=…` (Datamuse's own shape).
