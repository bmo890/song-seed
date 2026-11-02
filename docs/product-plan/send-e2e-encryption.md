# SongNook Send: end-to-end encryption

Founder, 2026-11-01: "make sure we can promise it's secure and unreachable to
anyone who doesn't have the link (even me)". Decided after the Send security
report (claude.ai/artifact/W99F3YEyLhs5Z5M4zBiSRK): seal every parcel on the
sender's device, carry the key only in the link's `#` part, open it on the
recipient's device. The server stores bytes it cannot read.

Until this ships everywhere, the copy may not say "secure" or "not even we can
see it" (docs/product-plan/pricing-and-marketing.md).

## The promise, exactly

- Only someone holding the full link can open a parcel's audio, files, title,
  sender name, note and file names. Not SongNook, not Cloudflare, not someone
  who steals the server's keys or database.
- The server still sees: that a parcel exists, how many files, their sizes,
  when it was made and fetched, the IP addresses involved, and what KIND of
  parcel it is (clips, sketch, setlist…; a category, not content).
- A lost link is lost for good. Nobody can recover it.
- If someone's phone or messages are compromised, the link is there too. The
  copy never says "unhackable".

## The key

- One random 32-byte key per parcel, made on the sending device.
- The link is `https://send.songnook.app/t/<transferId>#k=<base64url key>`.
  Browsers never send the part after `#` to a server, so it never reaches our
  logs; link previews (iMessage, WhatsApp) fetch the page without it and show
  a generic card.

## The sealed file format (SNS1)

Every file, and the parcel's metadata, is sealed the same way: AES-256-GCM in
the STREAM construction (Hoang, Reyhanitabar, Rogaway, Vizár; as in Tink and
age), so a file of any size is sealed and opened in fixed-size pieces, never
whole in memory, and pieces cannot be reordered, dropped or cut short.

```
header  = "SNS1" (4 bytes) | record size R, u32 big-endian (4) | nonce prefix (7, random per file)
record  = AES-256-GCM(key, nonce, plaintext piece, aad = header)  → piece + 16-byte tag
nonce   = nonce prefix (7) | record index, u32 big-endian (4) | 0x01 if last record else 0x00 (1)
file    = header | record 0 | record 1 | … | last record
```

- R = 65536. Every record but the last holds exactly R plaintext bytes; the
  last holds 0..R (an empty file is one empty last record).
- Sealed size = 15 + plaintext + 16 × records, records = max(1, ceil(P / R)).
- Opening reads R + 16 bytes at a time; the record that ends the file must be
  marked last, and no marked-last record may be followed by more bytes.
- Every file gets its own random nonce prefix; with ≤ 200 files per parcel the
  chance two share one is negligible (2^-56 per pair).

## What the server stores for a sealed parcel

- `transfers.sealed = 1`; `title`, `sender_name`, `message` empty.
- `transfers.sealed_meta`: the SNS1-sealed JSON envelope, base64:
  `{ v: 1, title, senderName, message, items: [{ name, mime, size }] }` in
  upload order (item i ↔ the i-th item by sort_order).
- Items are named `1.sealed`, `2.sealed`… with type
  `application/octet-stream`; the real names live in the envelope.
- Content checks change: a sealed parcel accepts only `.sealed` items, checks
  each starts with `SNS1` at finalize (the zip check can't see inside), and
  needs a known sender (the app's send key or a paired browser) so the server
  is not an anonymous host for opaque bytes.

## Opening

- **Web page** (`/t/<id>`): for a sealed parcel the server sends a generic shell;
  the page reads `#k=`, fetches the metadata, opens the envelope with WebCrypto
  and renders the same page as today. Play and the quiet raw-download list
  fetch a file, open it record by record, and hand the browser a Blob. No key
  in the link: "This link is missing its key. Ask the sender for the full link."
- **App**: the link's `#k=` travels with the transfer id into the receive
  screen; files download sealed to the cache, the native module opens them to
  plain files, then import continues exactly as today.

## Sending

- **App**: the native module seals each file to the cache, the envelope is
  sealed too, and the upload is the sealed copies. The key joins the link the
  app shows and keeps in Sent links.
- **Web sender page**: WebCrypto seals each picked file the same way before
  upload.

## Rollout (three steps, because old app versions can't open sealed parcels)

1. **Server + web, dormant** (no store build): the server accepts and serves
   sealed parcels; the recipient page opens them; the web sender can seal but
   doesn't yet (`SEAL_WEB_SENDS=false`), because recipients on today's app
   couldn't import them.
2. **Store build**: native seal/open in `modules/songnook-file-io`
   (CryptoKit on iOS, javax.crypto on Android); the app opens sealed parcels
   and seals what it sends whenever the native side is present. Builds without
   it keep sending unsealed and say "Update SongNook to open this" for a
   sealed parcel.
3. **Switch on** once the store build is the one people have: web sends seal
   (`SEAL_WEB_SENDS=true`), unsealed sends from the app stop, and the copy may
   say "Only people with the link can open it, not even SongNook".

## Status (2026-11-01)

All three steps are built. The founder said to see them through (no real users yet).

- Step 1, server + web: c94df33f.
- Step 2, native seal/open (`modules/songnook-file-io`: SongNookSeal.swift,
  SongNookSeal.kt), app send (`services/sendSeal.ts`, `shareLink.ts`: sealed copies,
  envelope at finalize), app receive (`receiveTransfer.ts`, key routed by App.tsx
  linking into TransferReceive `key`, preview downloads and opens before playing).
- Step 3: `SEAL_WEB_SENDS=true`; the privacy promise shows only where this build
  seals (`sendSheet.sealedHint`, `send.sealedThesis`); privacy policy updated.
- Verified on the iOS simulator against the live server: app → web, web → app (Node
  and the real page), app → app; missing key; byte-identical opens. Android compiled
  locally (`:songnook-file-io:compileDebugKotlin`); not yet run on a device.

## Export compliance (decided 2026-11-02)

Founder decision: keep `ITSAppUsesNonExemptEncryption = false` in app.json. The
sealing uses only the platform's own encryption (CryptoKit on iOS, javax.crypto
on Android), standard AES-256-GCM, nothing proprietary. If App Store Connect asks
the questions directly: "Yes, it uses encryption", then "None of the algorithms
mentioned above" (only encryption within Apple's operating system). No export
documents, no French declaration. Revisit if we ever ship our own crypto code or
a non-OS library.
