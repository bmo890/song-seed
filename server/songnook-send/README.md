# Songnook Send

Branded, WeTransfer-style transfer service for Songnook. A sender packages files
(from the desktop web page **or** from inside the app's "Get a link" share action),
gets one canonical link, and the recipient opens it on a phone (in-app if installed;
branded install-funnel + deferred deep link if not) or on desktop (branded download).

Canonical spec: [`../../docs/product-plan/transfer-service-brief.md`](../../docs/product-plan/transfer-service-brief.md).
App-side model: [`../../docs/product-plan/sharing-and-received-architecture.md`](../../docs/product-plan/sharing-and-received-architecture.md).

## Stack

- **Cloudflare Workers** (Hono) — JSON API + SSR web pages + `.well-known` files, one origin.
- **R2** — opaque file bytes. Egress-free; downloads are Worker-proxied (ranged) so we can
  gate on finalize/expiry, add `noindex`, and count downloads. Uploads are browser/app →
  **presigned** R2 PUT (bytes bypass the Worker).
- **D1 (SQLite)** — transfer + item metadata; `sender_user_id` is nullable from day one so
  accounts are additive later.
- **Cron** — nightly expiry sweep (deletes expired R2 objects + rows).

## The hard contract (do not break unilaterally — the app builds against this)

1. Files are **opaque** — never unpacked/interpreted server-side.
2. `transferId` is returned at **create**, before any upload (the app stamps it into the
   `.songstead` file's internal manifest, then uploads).
3. Nothing is fetchable until **finalize**. Links unguessable, HTTPS-only, `noindex`, expiring.
4. Metadata + download endpoints work with **no cookies and no `Origin`** (native access).
5. `sender.userId` is present in every payload, always `null` in v1.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/transfers` | create → `{transferId, expiresAt}` (id before upload) |
| POST | `/api/transfers/:id/items` | register file → `{itemId, uploadUrl}` (presigned PUT) |
| POST | `/api/transfers/:id/finalize` | → `{shareUrl}` (nothing fetchable until now) |
| GET | `/api/transfers/:id` | metadata JSON (cookie/Origin-free, finalized+unexpired only) |
| GET | `/t/:id/dl/:itemId` | ranged download (resume; `noindex`; counts) |
| GET | `/t/:id` | recipient page (desktop / mobile-no-app funnel) |
| GET | `/` | web sender page (drag-drop) |
| GET | `/.well-known/apple-app-site-association`, `/.well-known/assetlinks.json` | universal/app links |
| GET | `/report/:id` | abuse report mailto funnel |
| GET | `/robots.txt` | disallow all |

## Secrets — none in any client

The **only** secrets are `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`, used solely to mint
presigned upload URLs. They live in Worker secrets (`.dev.vars` locally, `wrangler secret put`
in prod) — never in source, `wrangler.toml`, the app, or browser JS. The app/web only embed the
public `PUBLIC_ORIGIN`. Downloads use the Worker's R2 **binding** (no credentials at all).

## Abuse & content controls

Every client is untrusted (the desktop page is public HTML; the raw API is reachable by anyone), so all of this is **server-enforced**:

- **Content allowlist** (`lib/contentPolicy.ts`) at item registration — audio + `.songstead` only, checked on **both** extension and mime → `415`. Blocks video/office/pdf/exe/bare-zip. The desktop page also filters client-side (UX only).
- **Finalize verification** — every item must actually exist in R2; real bytes must not exceed the declared size or the per-file cap; `.songstead` files must start with the ZIP magic. Offenders are deleted and finalize fails. Nothing is fetchable until this passes.
- **Origin allowlist** (`lib/guard.ts`) on create/upload — browser calls must come from `ALLOWED_WEB_ORIGINS` (blocks other sites' JS). The native app sends no Origin → allowed.
- **Per-IP rate limiting** (KV fixed window) on create/upload — `RATE_CREATE_PER_HOUR` (30) / `RATE_ITEMS_PER_HOUR` (300). Fails open if `RATE` KV is unbound (dev); **bind it before going public**.
- **Caps** — 1 GB/transfer, 512 MB/file, 200 items, 7-day expiry.

**Inherent residual:** `.songstead` is an opaque ZIP we must not unpack, so a determined abuser can smuggle bytes inside one (an `.xlsx` is also a ZIP). Content-typing can't close that — rate limits, expiry, and the launch-hardening below do.

**Launch hardening (not yet built — needs your setup + client work):**
- **Cloudflare Turnstile** on the web create endpoint (invisible; blocks bots; sitekey is public, secret verifies server-side — no client secret).
- **App Attest (iOS) / Play Integrity (Android)** on the app's create path — proves it's really your app, the true "no one but us" control.

## Setup

```sh
npm install
cp .dev.vars.example .dev.vars            # fill in R2 S3 API token (local only)
# create the D1 db + R2 bucket in your CF account, paste ids into wrangler.toml:
npx wrangler d1 create songnook_send
npx wrangler r2 bucket create songnook-send
npx wrangler kv namespace create RATE   # paste id into wrangler.toml (rate limiting)
npm run db:migrate:local
npm run dev
```

Tests: `node --test --experimental-strip-types src/lib/__tests__/contentPolicy.test.ts`.

## Settled v1 decisions (brief §9)

| Item | Decision |
|---|---|
| Domain | `send.songnook.app` |
| Per-transfer cap | **1 GB** |
| Expiry | **7 days**, then swept |
| Zip-all | **not in v1** |
| iOS deferred deep link | **clipboard-token** (funnel copies URL w/ notice; app reads pasteboard on first launch) |
| Android deferred deep link | Play Install Referrer carries `transferId` |
| Abuse | report link + takedown; **no AV scan v1** |
| Location | `server/songnook-send/` (this repo) |

## Still needed from the app team (blocks only the `.well-known` files)

- Apple **Team ID** → `APPLE_TEAM_ID` var, for `apple-app-site-association`.
- Android release **signing SHA-256 fingerprint(s)** → `ANDROID_CERT_FINGERPRINTS`, for `assetlinks.json`.

Until supplied, both files serve with clearly-marked `REPLACE_*` placeholders.
