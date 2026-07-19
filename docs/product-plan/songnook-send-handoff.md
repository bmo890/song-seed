# Handoff prompt — Songnook Send front-end completion

_Copy everything below the line into the agent working on the app front end._

---

You are continuing front-end work in the Songstead/Songnook app repo (`song-seed`,
branch **`feat/songnook-send`** — work on top of it). The "Songnook Send" transfer
feature (WeTransfer-style share links) is **already built end-to-end and the backend
is LIVE in production**. Your job is the remaining front-end polish and integration —
do NOT rebuild what exists.

## What is already DONE — do not redo

**Backend (live at `https://send.songnook.app`, code in `server/songnook-send/`,
Cloudflare Worker + R2 + D1 + KV):** create → presigned upload → finalize →
metadata → ranged download; branded sender/recipient web pages; content allowlist
(audio + `.songstead` only, 415 otherwise); finalize-time size/zip verification;
per-IP rate limits; 7-day expiry sweep. Wire contract (do not change unilaterally):
`docs/product-plan/transfer-service-brief.md`. Only secrets are two R2 keys in
Worker secrets — **never put any credential in app code**.

**App-side send (built, tested, tsc-clean):**
- `src/config/sendService.ts` — base URL config. Prod builds default to
  `https://send.songnook.app`; dev defaults to `http://localhost:8799`; a gitignored
  `.env` sets `EXPO_PUBLIC_SEND_BASE_URL=https://send.songnook.app` for dev-client
  testing against prod. UI visibility gate: `isSendServiceConfigured()` / `__DEV__`.
- `src/services/sendTransfer.ts` — HTTP client (create/upload/finalize).
- `src/services/shareLink.ts` — `createShareLink` (archive flows; creates the
  transfer FIRST so the `transferId` is stamped into the manifest `share` block
  before upload) and `createFilesShareLink` (raw files). `EmptyShareError` /
  `SendTransferError` for UX branching.
- `src/services/shareLinkFlow.ts` — `presentShareLink`: progress toast → clipboard
  copy → success toast with Share tap-through; error dialogs.
- `src/services/clipShareLink.ts` — clips → files-link.
- Entry points wired: Setlist detail menu "Get a link", Songbook detail menu
  "Get a link", clip SelectionBars "Get link" (`useSetlistModel.getLinkForActiveSetlist`,
  `useSongbookModel.getLinkForActiveSongbook`, `SelectionBars.handleGetLinkSelected`).
- `src/state/useSentLinksStore.ts` + `src/domain/sentLinks.ts` — persisted outbox
  keyed by `transferId`, self-pruning (3-day grace after expiry).
- `src/components/common/SentLinkChip.tsx` — "Link active · N days left · Copy"
  chip, rendered in Setlist + Songbook detail headers via `linkForEntity(entityId)`.

**Receive side (R1, mostly pre-existing + hardened):** received packages
(`workspace.origin === "received"`), visibility choke point
(`src/domain/workspaceVisibility.ts` — all discovery/creation surfaces use
`personalWorkspaces`), ReceivedScreen drawer page, share-intent imports land as
received packages, `src/domain/receiveRouting.ts` makes manifest `share.kind` the
routing authority. Tests: `receiveRouting.test.ts`, `sentLinks.test.ts`,
`shareLink.test.ts` (+ full suite green: 528 tests).

**Universal links:** `app.json` already has `ios.associatedDomains =
["applinks:send.songnook.app"]` and the Android `/t/*` intent filter. The server's
`.well-known` files serve **placeholders** — real Apple Team ID + Android signing
fingerprints are PENDING (owner is enrolling in Apple Developer now). Links opening
the app directly therefore does NOT work yet and cannot be tested until a native
rebuild + real IDs. Don't burn time on it.

## Front-end work that REMAINS (your scope)

1. **Receive-flow UI for a tapped link (pre-universal-link path).** Today a phone
   user downloads the `.songstead` from the web page and opens it via the share
   sheet. Add the in-app landing: a route/screen that, given a transfer URL or id,
   fetches `GET /api/transfers/:id` (no auth; see contract §3), shows the parcel
   (title, sender, note, items), downloads items with progress, and hands archives
   to the existing import pipeline (`readSongSeedArchive` →
   `importLibraryArchiveIntoLibrary(parsed, { origin: "received" })` — see
   `useShareImportScreenModel.ts` for the pattern) deduped by `transferId`. Wire the
   deep-link route (`App.tsx` `linking` config — only `home`/`share-import` exist
   today) so `songstead://` and later universal links can target it.
2. **Sent-links list in Settings** ("Settings → Sharing" per
   `docs/product-plan/sharing-and-received-architecture.md` R2): humble list from
   `useSentLinksStore` — title, kind, days left, copy, forget. Expired entries grey
   out (store already prunes).
3. **iOS first-launch clipboard check** (deferred deep link): on first run, if the
   pasteboard holds a `send.songnook.app/t/…` URL, offer to open that transfer
   (user-visible prompt, never silent). Android Install Referrer half needs a
   native module — SKIP unless already trivial.
4. **Polish per design memories**: match the app's design system (warm paper,
   terracotta `#824f3f`, tonal layering, no shadows/borders, Newsreader + Plus
   Jakarta Sans). Haptics on link-created. The web pages' "letterpress parcel" look
   is the reference for the receive screen's tone.
5. **QA**: run `docs/qa/MANUAL-CHECKLIST.md` §16 (Songnook Send) for whatever you
   build; add Maestro flows where drivable (see `.maestro/README.md` conventions).

## Constraints & gotchas

- **Do not rename** `com.bmostudio.songseed`, `songseed` storage keys, or the
  `.songstead` file extension (rebrand sweep is a separate task; server allowlist
  expects `.songstead`).
- Sender name is currently always `null` (receiver sees "Someone") — a stored
  profile name is an OPEN product decision; don't invent one without asking.
- Settings-import stays `origin: personal` (open decision — leave as is).
- `npx tsc --noEmit` must stay at 0 errors; run `npx jest` before finishing.
- The transfer service repo lives in `server/songnook-send/` — you should not need
  to touch it; if you believe the wire contract needs a change, STOP and surface it.
- Test against prod freely (links expire in 7 days) or run the Worker locally:
  `cd server/songnook-send && npm run dev` (see its README; local R2 seeds go in
  the `songnook-send-preview` bucket).
