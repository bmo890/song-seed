# Store privacy questionnaires — corrected answers (SongNook Send era)

**Drafted 2026-08-26, for founder review.** Supersedes the privacy-questionnaire
and content-questionnaire sections of `store-listing.md` (lines ~81–135), which
predate SongNook Send and answer "Data Not Collected" / "no user-generated
content shared between users". Both of those are now wrong: Send uploads
user-selected audio to a developer-operated server (send.songnook.app,
Cloudflare Workers + R2), and users can share content with each other via links.

Verified facts these answers rest on (audit 2026-08-26):

- No analytics, crash SDKs, ads, or accounts. Crash log is local-only,
  user-initiated share.
- Send: user taps "Get a link" → selected audio clips / .songnook packages
  upload to R2 with file names + optional title, sender name, message. Held
  7 days (`EXPIRY_DAYS=7`), then deleted by a nightly sweep; abandoned drafts
  deleted in ~24h. Retrievable by anyone with the unguessable link; download
  responses are `noindex`, `no-store`. Per-file download counts are stored;
  no downloader identity.
- Client IP is used for per-IP rate limiting in Workers KV; counters live at
  most 2 hours (TTL = two 1-hour windows). No upload/IP logs kept beyond that.
- Word tools send only the search word: Datamuse (English); developer worker →
  Anthropic Claude API + Dicta (Hebrew). Magpie fetches public-domain text from
  Gutendex/Project Gutenberg. No identifiers attached; nothing stored.

---

## Apple — App Privacy ("nutrition label")

"Data Not Collected" no longer holds. Declare:

**Data type: User Content → Audio Data**
- Collected: **Yes** (only when the user shares via SongNook Send)
- Purpose: **App Functionality**
- Linked to the user's identity: **No** (no accounts, no identifiers; transfers
  carry at most a freely-typed display name)
- Used for tracking: **No**

**Data type: User Content → Other User Content**
(covers the optional transfer title, sender name, message, and file names)
- Collected: **Yes** — App Functionality — Not linked — No tracking

**Everything else: not collected.**
- No Identifiers, no Usage Data, no Diagnostics (crash log never leaves the
  device unless the user manually shares it — user-initiated, so not
  "collected").
- Word lookups / Magpie: the search word is a transient, stateless service
  request that is not retained — not declared. (Same posture as before.)
- IP address for rate limiting: **recommended not to declare.** Apple's
  definition of "collect" is transmitting data off-device and retaining it
  longer than needed to service the request; the rate-limit counter is a
  security measure that self-expires within ≤2h and is never associated with
  content or identity. This is the standard posture for abuse-prevention IP
  handling, but it is a judgment call — the conservative alternative is
  "Identifiers → Device ID: No / Diagnostics: No, Other Data: IP for security,
  not linked". FLAGGED for founder decision below.

"Data used to track you": **None.**

## Apple — age rating / content questionnaire corrections

- "Unrestricted web access": still **No** (Magpie/word tools are curated
  fetches, not a browser; Send's web page is outside the app).
- User-generated content / user interaction: the old "No UGC shared between
  users" answer must flip wherever the questionnaire asks. Accurate answer:
  users can **share their own content with people they choose via expiring
  links**; there is **no in-app feed, browsing, discovery, or messaging** —
  recipients only ever see what a sender deliberately handed them. If the
  form only offers a binary "can users see content from other users?", answer
  **Yes** and rely on the reviewer notes below.
- Age rating stays 4+ / Everyone: no ads, no gambling, no mature content.

## Apple — "Notes for the reviewer" (ready to paste)

> SongNook is a local-first songwriting sketchbook: no accounts, no analytics,
> and the user's library never leaves the device. The only sharing feature is
> "SongNook Send", a point-to-point file transfer the user must explicitly
> invoke: they select their own audio clips, tap "Get a link", and hand that
> link to a recipient themselves (share sheet / QR). Links are long random
> unguessable tokens, marked noindex, and every transfer is automatically
> deleted after 7 days. There is no in-app browsing, feed, search, or
> discovery of other users' content — a recipient can only open a link a
> sender gave them, so users are never exposed to unsolicited third-party
> content. Regarding guideline 1.2: uploads are restricted to audio files and
> SongNook's own package format (server-enforced allowlist); an abuse-report
> funnel exists at send.songnook.app/report/{id} (mailto) and the contact is
> published in the privacy policy, and we can delete any reported transfer
> and rate-limit/block the uploading source. No data is linked to user
> identity; the App Privacy
> declaration (User Content, not linked, no tracking) reflects the Send
> feature only.

## Google Play — Data safety

"Does your app collect or share any user data?" → **Yes** (collect), **No**
(share — Cloudflare and Anthropic/Dicta/Datamuse act as service providers /
transient processing, which Play's definition excludes from "sharing").

Declare, under **Files and docs → Audio files** *(if the console's current
taxonomy offers "Music and audio → Voice or sound recordings / Music files",
use that instead — pick the audio-specific category shown)*:
- Collected: **Yes** · Shared: **No**
- Optional: **Yes** (only when the user uses SongNook Send)
- Purpose: **App functionality**
- Processed ephemerally: **No** (held up to 7 days)
- Required vs optional: **Optional**

Under **Other user-generated content** (title, sender name, message):
- Same answers as above.

- Encrypted in transit: **Yes** (HTTPS everywhere).
- Data deletion: transfers are **automatically deleted after 7 days**; users
  can request earlier deletion via the support email. If the form requires a
  deletion-request URL, point it at the privacy policy page (which names the
  contact address).
- IP address for rate limiting: **recommended not to declare** under Play's
  ephemeral-processing carve-out (used only to service/protect the request
  flow, retained ≤2h, never linked to content or person). Same judgment call
  as Apple — flagged below.
- Account creation: none. Account deletion section: N/A.

Word lookups / Magpie: transient stateless requests, not retained → not
declared (unchanged from store-listing.md reasoning).

## Google Play — content / IARC corrections

- "Does your app allow users to interact or exchange content?" — the honest
  answer is **Yes, users can share content via links**, with no chat, no
  public visibility, no discovery. Play's UGC policy questionnaire (if
  triggered) should note: sender-controlled distribution only, expiring
  links, abuse-report contact, server-side content-type allowlist, ability to
  remove content and block sources.
- Foreground-service (microphone) declaration: unchanged from
  store-listing.md.

---

## Judgment calls needing founder review

1. **IP / rate-limit declaration.** Recommended "do not declare" on both
   stores per the transient-security-processing carve-outs, but neither
   store's guidance is perfectly explicit for a 2-hour KV counter. The
   conservative alternative costs little on Play; on Apple it would add a
   category to the label. Founder decision.
2. **Word-lookup words.** Kept the store-listing.md posture (stateless
   third-party call, not collection). Note the Hebrew path now transits a
   developer-operated worker — if that worker ever adds logging, this flips.
   Confirm the worker keeps no logs before submitting.
3. **Report funnel visibility.** The `/report/:id` mailto page exists, but
   the recipient (download) page footer does not link to it
   (`server/songnook-send/src/pages/shell.ts`). For a clean Apple 1.2 story,
   consider adding a quiet "Report" link to that footer before submission —
   the reviewer paragraph above claims only what exists today.
4. **"Optional message/name" category.** Apple's "Other User Content" and
   Play's "Other user-generated content" are the closest buckets; consoles
   occasionally rename these — map to whatever the live form calls free-text
   user content.
