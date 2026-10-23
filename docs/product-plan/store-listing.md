# SongNook — store listing copy & submission answers

Ready-to-paste metadata for the App Store and Play Store, plus the privacy
questionnaire answers. Written in SongNook's voice; the privacy story is the
strongest differentiator, so it leads. **Verify the two flagged items** (crash
capture, third-party calls) against the final build before submitting — see the
privacy section.

Character limits noted are current-as-of-2026; confirm in the console at submission.

---

## Names & taglines

- **App name (both stores):** `SongNook`
- **App Store subtitle** (30 chars): `Catch song ideas, grow them` (27)
  - Alt: `Your songwriting sketchbook` (27)
- **Play short description** (80 chars):
  `Record song ideas the moment they strike, then grow them into finished songs.` (78)

---

## Promotional text (App Store, 170 chars — updatable without review)

`Every song starts as a hum in the car or a riff at 2am. SongNook catches it before it's gone — then helps you shape it. Everything stays on your device.` (154)

---

## Description (App Store + Play — same body)

> SongNook is a songwriting sketchbook for the ideas that arrive when you least
> expect them. Hum a melody, strum a riff, or sing a line — capture it in a tap,
> before it slips away. Then grow it into a song, at your own pace.
>
> Everything you make stays on your device. No account, no cloud, no sign-up.
>
> CATCH THE SPARK
> • One-tap recording with a count-in and a metronome to keep you steady
> • Import voice memos and audio files from anywhere on your phone
> • Record while the screen is locked — your take keeps going
>
> GROW EVERY IDEA
> • Organize takes into workspaces and collections — one idea, one home
> • Keep lyrics, chords, and multiple versions alongside the audio
> • Layer overdubs: stack a harmony or a second part over a take
>
> LEARN AND PRACTICE
> • Loop the hard part, slow it down, or shift the pitch — without changing the recording
> • Detect the tempo of steady clips
> • Drop pins and mark sections to navigate a song
>
> TOOLS FOR WORDS
> • A rhyme, synonym, and related-word finder for when a line won't come
> • Cut-up and "magpie" tools to shake loose a new direction
>
> YOURS, AND ONLY YOURS
> • Your library never leaves your device
> • Back up and export whenever you like — to Files, iCloud, or Drive — you choose where
> • Nothing is uploaded automatically, ever
>
> Made for songwriters, by a songwriter. Start with a hum.

---

## Keywords (App Store — 100-char field, comma-separated, no spaces)

`songwriting,voice memo,song ideas,riff,demo,recorder,practice,looper,lyrics,chords,melody,rhyme,tuner` (101 → trim one)

Final (99): `songwriting,voice memo,song idea,riff,demo,recorder,practice,looper,lyrics,chords,melody,rhyme,tuner`

Notes: the app *name* ("SongNook") and *category* are indexed separately — don't
spend keyword chars on them. "metronome" and "audio editor" are strong but cut for
space; rotate in later based on Search Ads / console analytics.

---

## Category & rating

- **Primary category:** Music. **Secondary (App Store):** Productivity.
- **Age rating:** 4+ (App Store) / Everyone (Play).
- Content questionnaire answers (both stores):
  - User-generated content shared between users: **Yes, narrowly.** SongNook Send
    lets a person hand their own clips or a sketch to someone they choose, by an
    expiring link (7 days, unguessable, no account). No feed, search, discovery, or
    messaging — a recipient sees only what a sender gave them. The recipient page
    carries a Report link (abuse-report funnel to the support mailbox, with
    takedown), and the privacy policy already describes Send. Per-store wording:
    `store-privacy-answers.md`.
  - No unrestricted web access. (Magpie shows curated public-domain book text from
    Project Gutenberg; the word finder queries a rhyme/synonym API. Neither is open
    web browsing — answer the "unrestricted web" question **No**.)
  - No ads, no gambling, no mature content. Data: see the privacy section below.

---

## URLs

- **Privacy policy:** `https://songnook.app/privacy` (content: docs/privacy-policy.md,
  served by the Send Worker; the app links the same URL from `src/config/legalLinks.ts`,
  alongside `https://songnook.app/terms`)
- **Support URL:** same site, or a simple page with the support email.
- **Marketing URL** (optional): a landing page if/when one exists; leave blank for v1.
- **Support email:** bmostudio.dev@gmail.com

---

## Privacy questionnaire — App Store "nutrition label" & Play "Data safety"

**Decided by the founder, 2026-10-23: declare honestly, not "Data Not Collected".** Pro
ships in v1 through RevenueCat, which keeps purchase history under an anonymous ID, and
SongNook Send holds what a person chooses to send for 7 days. Neither is linked to
anyone, neither tracks, and the page reads "Data Not Linked to You". The facts these
answers rest on are listed in `store-privacy-answers.md` (no analytics, ads, crash SDK
or accounts; the crash log is local and shared only by the user; IPs serve only short
rate-limit counters; word lookups send only the word).

**App Store — App Privacy:**
- **Purchases → Purchase History.** Used for: App Functionality. Linked to the user: No.
  Tracking: No.
- **User Content → Audio Data** and **Other User Content** (titles, the optional sender
  name and note on a Send link). Used for: App Functionality. Linked: No. Tracking: No.
- Data used to track you: None.
- Check RevenueCat's App Store privacy guide when billing is wired in, in case its SDK
  version also requires **Identifiers → User ID** (anonymous, not linked).

**Play — Data safety:**
- Collects data: **Yes.** Shares data: **No.**
- **Financial info → Purchase history**: collected, not shared, required for Pro, used
  for App functionality.
- **Audio → Voice or sound recordings** and **Files and docs**: collected only when the
  user sends a link; optional; App functionality; deleted after 7 days.
- Encrypted in transit: **Yes** (HTTPS). Users can request deletion: a link expires on
  its own after 7 days; abuse reports go to the support email.

**Export compliance (App Store):** `ITSAppUsesNonExemptEncryption = false` is already
in app.json — the standard-encryption-only answer. No extra docs needed.

**Android foreground service (Play):** the app declares a microphone/media foreground
service for background recording. When Play prompts for the foreground-service
declaration, select the **microphone** use case and describe it: "Continues an
in-progress audio recording when the app is backgrounded or the screen locks."

**Notes for the reviewer (append to the paragraph in `store-privacy-answers.md`):**

> The app never reads the pasteboard on its own. The audio background mode keeps a
> recording or playback going when the screen locks — the lock-screen controls and the
> recording notification belong to that session, and nothing runs in the background
> otherwise.

---

## What's New — v1.0.0

`Welcome to SongNook. Catch your song ideas the moment they strike, grow them with lyrics, chords, and overdub layers, and practice until they're real — all on your device. This is our first release; tell us what you'd love to see next.`

---

## Screenshots — plan (needs a device/simulator to capture)

6–7 shots, in narrative order, device-framed, one short caption each on the paper
background in the app's type. Seed a demo library first (plausible titles, varied
durations). Captions:

1. **Recording in progress** — live waveform, count-in visible. → "Catch it in a tap."
2. **A workspace of ideas** — collection list with clips. → "Every idea, one home."
3. **Full player** — waveform reel at 8x, sections/pins. → "Hear it, shape it."
4. **Practice panel** — loop + speed/pitch controls. → "Slow it down. Loop the hard part."
5. **Overdub layers** — stacked layers on a take. → "Layer a harmony over your take."
6. **Word tools** — rhyme/synonym finder or Magpie. → "Find the word that won't come."
7. **Privacy card** — the Settings → About privacy statement. → "Yours, and only yours."

Required sizes (confirm current requirements at submission): iPhone 6.9"/6.7" and
6.1"; Play phone (and 7"/10" tablet only if you declared tablet support — you did NOT,
so skip tablet). Keep the Figma/script in `docs/store-assets/` so they regenerate.

---

## Pre-submit checklist (metadata only — build/QA is in OWNER-TODO)

- [ ] Privacy policy URL live and pasted into both consoles + Settings → About.
- [ ] Confirm crash capture is still local-only → "Data Not Collected" holds.
- [ ] App name "SongNook" available in App Store Connect (unique-name requirement).
- [ ] Screenshots captured at required sizes with captions.
- [ ] Keywords pasted (the 99-char line above).
- [ ] Age rating questionnaire completed per the answers above.
- [ ] Support email/URL set.
