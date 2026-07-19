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

---

## Owner action items — what's needed from the owner (not the agent)

Reconciled against the live state above. **Done already:** backend deployed + live
(`send.songnook.app`), R2/D1/KV provisioned, worker secrets set, domain decided,
app base-URL config + universal-link app config (`associatedDomains` + Android
`/t/*` filter) present, app-side send/receive/outbox built and tsc-clean.

### BLOCKING a real universal-link test and any release build
1. **Apple Team ID** — from Apple Developer enrollment (in progress). The server's
   `.well-known/apple-app-site-association` serves a placeholder until this lands;
   until then, tapping a link does not open the app.
2. **Android signing SHA-256 fingerprint(s)** — for `.well-known/assetlinks.json`
   (also placeholder). Get from the EAS credentials for the release keystore.
3. **A native rebuild (EAS) + device install** — the only way to activate what's
   already configured but inert in JS: `associatedDomains`, the Android `/t/*`
   intent filter, the `.songstead` iOS UTI, and the zip share-intent filters.
   Nothing native-dependent (universal links, branded file type, share-intent
   receive) can be device-verified before this.
4. **Real App Store numeric ID** — needs an App Store Connect record; replaces the
   `id0000000000` placeholder in the install-funnel store link.

### Product decisions (each unblocks one piece of polish, not the whole feature)
5. **Sender name** — ship as "Someone" (`sender.userId` null) for v1, or add a
   stored profile-name field so recipients see who sent it? Gates the receive
   screen's sender line and the `senderName` passed to `createShareLink`.
6. **Settings-import origin** — a Settings→import archive currently lands as a
   *personal* workspace (not a received package). Keep, or route Settings imports
   to Received too?
7. **iOS deferred deep link** — confirm the clipboard-check approach for
   first-launch (remaining item #3), or prefer a typed code.

### Verify on device now (no new infra needed — backend is live)
8. Device-test the JS-only work already merged on this branch: the Library
   redesign, Received R1, and the send flow against prod — "Get a link" on a
   setlist/songbook → link created + copied → open the link in another device's
   browser → download the `.songstead` → Settings→import → it lands in Received.
   (Universal-link auto-open is the one part that must wait for items 1–3.)

### Not owner work — remaining FRONT-END scope (the agent's, §"REMAINS" above)
The receive-flow landing screen, the Settings sent-links list, the iOS clipboard
check, and design polish are all **unblocked** (backend is live) and can be built
now without any of items 1–4. Only their on-device verification waits on the
native rebuild.
