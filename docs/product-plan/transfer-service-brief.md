# SongNook Send — Backend/Web Service Brief

_A self-contained handoff for the owner of the web-based upload/transfer service. Written 2026-07-18. Everything the service needs to know to build the feature end to end, plus the contract the mobile app will integrate against._

_Companion doc: `sharing-and-received-architecture.md` (the app-side model). Its §3 wire contract is duplicated here where relevant so this brief stands alone._

---

## 1. What you're building, in one paragraph

A WeTransfer-style transfer service branded for **SongNook** (a mobile app for capturing and developing song ideas — voice memos, songs, lyrics, chord charts). A sender packages files on a web page (or directly from inside the app), gets a link, and sends it to a friend however they like. The friend opens the link on their phone: if they have SongNook, the transfer opens **inside the app** and lands as a "received package"; if not, the page prompts them to install SongNook and the transfer survives the install (deferred deep link). On desktop, the page is a plain download page. The service stores **opaque files + a metadata manifest**; it never needs to understand SongNook's file internals.

## 2. The two senders

1. **Web sender**: any person on a desktop browser. Drags in files (audio, `.songnook` archives, anything), types a display name and a transfer title, gets a link. No account required (v1).
2. **The app itself**: when a SongNook user taps "Share" on a setlist/songbook/collection/clip, one of the options (alongside the OS share sheet's WhatsApp/Messages/etc.) is **"Get a link"** — the app calls your API directly, uploads the exported file(s), and receives the share URL to drop into the OS share sheet or copy. **No browser round-trip on the phone.** This means your upload API must be a clean, CORS-independent HTTPS API the native app can call, not something coupled to the web page's session flow.

## 3. Data model: the transfer

A **transfer** = one send event = (on the receiving phone) one "received package."

```jsonc
// GET /api/transfers/{transferId} → 200
{
  "transferId": "t_8f3k2…",           // unguessable, URL-safe; THE identity
  "title": "Spring Show stems",        // sender-typed; may be empty
  "sender": {
    "name": "Ben",                     // sender-typed display name (v1 trust level: like an email From line)
    "userId": null                     // ALWAYS present, null in v1 — reserved for accounts (see §8)
  },
  "message": "Learn track 2 first",   // optional sender note
  "createdAt": "2026-07-18T18:20:00Z",
  "expiresAt": "2026-08-01T18:20:00Z",
  "items": [
    {
      "itemId": "i_1",
      "fileName": "spring-show.songnook",
      "size": 48211,
      "mimeType": "application/zip",
      "downloadUrl": "https://…"       // direct or short-lived signed URL
    },
    {
      "itemId": "i_2",
      "fileName": "bass-rough.m4a",
      "size": 2311094,
      "mimeType": "audio/mp4",
      "downloadUrl": "https://…"
    }
  ]
}
```

Key points:

- **`transferId` is the dedupe key.** The app records it; re-opening the same link must not create a duplicate package. Make it stable for the transfer's lifetime.
- **Items are opaque.** Don't unpack `.songnook` files server-side. The app types each item on device (see §5). The web download page may show friendly labels from extension/mime only.
- **A transfer can be mixed** (archives + raw audio in one send). The app still lands it as ONE package.
- The `sender.userId: null` field must exist from day one even though it's always null in v1 — the app's schema is built to light up verified identity later without a wire change.

## 4. API surface the app needs

Exact paths/shapes are yours to design; these are the required capabilities:

1. **Create transfer** — `POST /api/transfers` with `{title?, senderName?, message?}` → `{transferId, uploadUrls | uploadEndpoint}`. Presigned-URL-per-file or direct multipart both fine; the app will upload from a background-capable HTTP client, so uploads must be resumable-friendly or at least tolerate retries per file.
2. **Upload items** — per-file, with fileName + mimeType preserved.
3. **Finalize** — `POST /api/transfers/{id}/finalize` → `{shareUrl}`. Nothing is fetchable until finalized (prevents half-uploaded links).
4. **Fetch metadata** — the JSON above. Must be callable by the app without cookies/session (the link is the capability).
5. **Download items** — ranged GETs (large audio on mobile networks; the app may resume).
6. **(Nice-to-have) `GET …/archive`** — everything as one zip, for the desktop download page.

Operational requirements: HTTPS only · links unguessable and `noindex` · configurable expiry (suggest 14 days default, deleted after) · per-transfer size cap (suggest 1–2 GB v1) · rate limiting on create/upload · standard malware scanning if feasible · CORS open for the web sender page, but the JSON/download endpoints must also work from native clients with no Origin.

## 5. File types: how the app decides what things are

You don't need to implement this — but it explains why the server stays dumb about content:

- **`.songnook` file** = a zip with a `manifest.json` inside. The manifest carries a `share` block declaring what it is: `kind: "setlist" | "songbook" | "collection" | "workspace" | "clips" | "library"`, plus title/sender/`transferId`/timestamps. The app trusts the manifest, not the filename.
- **Raw audio** (m4a/mp3/wav/…) = a plain file item.
- Anything else = a generic file item.

One ask that DOES touch you: when the app uploads a `.songnook` file it created, it stamps the same `transferId` into the file's internal manifest after create-transfer returns the id — so give the app the `transferId` at **create** time, before upload.

## 6. The link & the recipient experience

**Link format**: one canonical URL per transfer, e.g. `https://send.songnook.app/t/{transferId}`.

That URL serves double duty, and this is the part with hard requirements on your side:

1. **Universal/App Link**: the domain must serve `/.well-known/apple-app-site-association` (iOS) and `/.well-known/assetlinks.json` (Android) so that tapping the link on a phone **with SongNook installed** opens the app directly (no browser interstitial). The app team supplies the bundle id (`com.bmostudio.songnook`, dev variant `com.bmostudio.songnook.dev`) and signing fingerprints. The app then calls your metadata endpoint with the `transferId` and downloads items itself.
2. **Web fallback page** (no app, or desktop):
   - **Desktop**: transfer title, sender name, item list, download buttons (+ zip-all). Plus a quiet "SongNook files open best in the app" note.
   - **Mobile without the app**: a branded page — "Ben sent you music" — with a primary **Get SongNook** button (store link) and secondary plain downloads. This page is an onboarding funnel; treat its design accordingly.
3. **Deferred deep link** (install-first-run): after install, the app must still find the transfer. Options, in order of preference:
   - **Android**: Play Install Referrer — pass `transferId` as the referrer on the store link; the app reads it on first launch. Reliable, build it.
   - **iOS**: no clean first-party mechanism. v1 pragmatic approach: the web page copies the link to the clipboard on "Get SongNook" tap (with user-visible notice), and the app checks the pasteboard for a `send.songnook.app` URL on first launch (iOS will show a paste prompt — acceptable). Alternative: a code the user types. A linking SDK (Branch et al.) is a later optimization, not a v1 requirement.

## 7. What the app will build against this (context, not your scope)

- **Share integration**: every existing share flow (setlist file, songbook file, collection/workspace export, audio clips) gains a "Get a link" option that runs §4's create→upload→finalize and hands the URL to the OS share sheet. Upload progress UI in-app; links copyable later from a small "sent links" list (app-side, local, v1).
- **Receive integration**: universal link → in-app receive screen → items downloaded → lands as ONE "received package" in the app's Received space (never mixed into the user's own workspaces), deduped by `transferId`. SongNook files present as what their manifest declares; raw audio as playable files.
- The app already has the import pipeline for `.songnook` archives; your service is transport, not format.

## 8. v1 vs. later (so nothing gets painted into a corner)

| Concern | v1 | Later (accounts arrive with Pro) |
|---|---|---|
| Sender identity | typed display name, `userId: null` | authenticated senders; `userId` filled; app shows verified sender, groups packages by sender, detects self-sends |
| Auth on API | none; link = capability | token auth for create/upload; downloads stay link-capability |
| Sent-links management | none (app keeps a local list) | server-side "my transfers" per account, revoke link |
| Expiry | fixed default | per-transfer choice, Pro extensions |

Design the API so adding an `Authorization` header and a filled `userId` is additive — no v2 rewrite.

## 9. Open items to settle together (app owner ↔ backend owner)

1. Final domain (`send.songnook.app`?) — needed early for universal-link entitlements in the app's native build.
2. Size caps, expiry default, and whether zip-all is v1.
3. Store-link strategy for the iOS deferred deep link (clipboard vs. code).
4. Where the web sender page lives relative to the API (same origin is simplest for CORS).
5. Abuse posture: report link, takedown path, scanning.
