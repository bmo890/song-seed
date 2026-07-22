# Magpie Hebrew-source proxy

A single-file Cloudflare Worker that fronts the [Project Ben-Yehuda public API](https://benyehuda.org/page/api)
for the Hebrew side of the Magpie ("steal words") feature. Sibling to `../word-proxy`.

## Why it exists

Magpie shows a random passage from a public-domain literary work. English draws
from Project Gutenberg directly (keyless). Hebrew draws from Project Ben-Yehuda,
whose API **requires an app key** (must not ship in the bundle) and caps usage at
**50 requests/minute**. This worker:

- holds the key server-side and injects it on every upstream call;
- keeps a cached **index** of eligible work IDs in KV, so a user tapping "new
  page" almost never triggers an upstream request;
- edge-caches each work's text (public-domain text never changes).

The index matters for variety, not just cost: Ben-Yehuda search is cursor-paginated
with no random-page jump, so without a cached pool every query returns the same
first-page works. The index (id + title + author per work) is a few hundred KB.

## Corpus selection

`periods: [revival, modern]` (`PERIODS`) and **no `original_language` filter** — so
the pool includes both original Hebrew works and translations-into-Hebrew from any
language. Poetry and drama are deliberately excluded (verse is too song-shaped for
the exercise); reference/lexicon are dictionaries.

The index covers the prose-family genres in `CANDIDATE_GENRES` (`prose, memoir,
letters, fables`), tagging each work with its `genre`. It's built one genre at a
time (each capped at `PER_GENRE_CAP`) so smaller genres aren't buried behind prose.
The app selects any non-empty subset per request; keep `CANDIDATE_GENRES` in sync
with `MAGPIE_HE_GENRES` in `src/config/magpieService.ts`.

## App-side contract

```
GET /magpie/he/random?genres=prose,memoir
  → 200 { id, title, author, sourceUrl, text }   // text = cleaned plaintext
  → 503 { error }                                 // no works in requested genres + fallback failed
```

`genres` is a comma-separated subset of `CANDIDATE_GENRES` (invalid/empty → defaults
to `prose`). `sourceUrl` is the canonical Ben-Yehuda page, for the credit / click-through.

## Attribution (required)

Project Ben-Yehuda's terms ask that reuse credit the project with a link back, and
crediting the author and work is basic good practice. **The Magpie UI must display,
for every Hebrew passage:**

- the **work title** (`title`)
- the **author** (`author`)
- **"Project Ben-Yehuda" as the source**, linking to `sourceUrl`

This credit must be visible while the passage is shown (not buried in a settings or
about screen). The worker returns all three fields on every `/magpie/he/random`
response specifically so the credit block always has them. The English/Gutenberg
side should likewise credit author, work, and "Project Gutenberg".

## Deploying

1. Get a free key at https://benyehuda.org/api_keys/new
2. `npx wrangler kv namespace create MAGPIE_KV` → paste the id into `wrangler.toml`
3. `npx wrangler deploy`
4. `npx wrangler secret put BENYEHUDA_KEY`
5. Point `MAGPIE_HE_SERVICE_BASE_URL` (src/config/magpieService.ts) at the worker URL.

The index is self-building: the first Hebrew draw with an empty index triggers a
background rebuild (serving a lower-variety live fallback meanwhile), and the
weekly cron (`0 4 * * 1`) keeps it fresh. No manual build step.

## To verify once the key is live (the "spike")

These were written against Ben-Yehuda's published API source, not a live call.
Confirm with a real key and adjust if needed:

- **Auth passing** — `key` is sent as a query param on GET and a body field on
  POST. Confirm both are accepted (vs. a required header).
- **Response fields** — `metadata.title`, `metadata.author_string`, `download_url`,
  and `url` on `GET /texts/:id`; `total_count` / `next_page_search_after` / `data`
  on `POST /search`.
- **Boilerplate marker** — `preparePassage()` strips a trailing rule-of-dashes
  block; check the real files' header/footer shape and tighten the regex.
- **Pool size** — after the first background build, check `he:pool` in the KV
  dashboard (or `npx wrangler kv key get --binding MAGPIE_KV he:pool`). If small,
  widen `CORPUS_FILTERS` (add genres / periods).
