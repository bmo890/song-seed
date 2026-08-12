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
- **App Store subtitle** (30 chars): `Write it. Learn it. Play it.` (28)
  - Alt: `From first hum to the gig` (25) · `Write, practice, perform` (24)
- **Play short description** (80 chars):
  `Write songs, learn them cold, and play them. Every version kept, all offline.` (76)

> **Changed 2026-08-12** — was `Catch song ideas, grow them`. Rationale in
> [positioning.md](positioning.md): the old line described the first fifth of the
> product and filed us in the voice-memo category. The verb triad names both the
> writing and the performance halves in the user's own words, and "Learn" carries the
> practice suite — the part no competitor has — without listing a single feature.

---

## Promotional text (App Store, 170 chars — updatable without review)

`Most apps hold one moment of a song. SongNook holds all of them — the first hum, every lyric version, the take you practice at 70%, the setlist on Friday. All on your device.` (174 → trim)

Final (168): `Most apps hold one moment of a song. SongNook holds them all — the first hum, every lyric version, the take you practice at 70%, the setlist Friday. All on your device.`

Counts verified in-repo; the em dash is one character. Re-count in the console before
pasting — Apple counts what it counts.

---

## Description (App Store + Play — same body)

> A song has a whole life — the hum in the car, the verse that takes three weeks, the
> take you play at 70% until your fingers know it, the setlist on Friday night.
> SongNook holds all of it, in one place, from the first idea to the stage.
>
> Everything you make stays on your device. No account, no cloud, no sign-up.
>
> WRITE IT
> • One-tap recording with a count-in and a metronome to keep you steady
> • Import voice memos and audio files from anywhere on your phone
> • Record while the screen is locked — your take keeps going
> • Organize takes into workspaces and collections — one idea, one home
> • Layer overdubs: stack a harmony or a second part over a take
> • Lyrics that keep every version — nothing you wrote is lost
> • Chords alongside the audio, and word tools for when a line won't come
>
> LEARN IT
> • Loop the hard bar until it's yours
> • Slow it down or shift the pitch — without changing the recording
> • Drop pins and mark sections to navigate a song
> • Detect the tempo of steady clips
> • Tune up and count in without leaving the app
>
> PLAY IT
> • Build setlists in the order you'll play them
> • Keep songbooks you can read from a music stand
> • Export chord charts and setlists as PDFs
>
> AND IT'S YOURS
> • Your library never leaves your device
> • Back up and export whenever you like — to Files, iCloud, or Drive — you choose where
> • Nothing is uploaded automatically, ever
>
> Made by a songwriter, for anyone with a song to finish.

> **Restructured 2026-08-12** — the old body ran CATCH THE SPARK → GROW EVERY IDEA →
> LEARN AND PRACTICE → TOOLS FOR WORDS → YOURS, AND ONLY YOURS. Same capabilities,
> resequenced into the three acts from [positioning.md](positioning.md) §5 so the
> practice and performance halves aren't buried below the fold. Privacy moves to the
> closer: it's what earns trust, not what earns the download. The word tools fold into
> WRITE IT rather than standing as their own section — they're a means, not a category.

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
  - No user-generated content shared between users (the library is private/local).
  - No unrestricted web access. (Magpie shows curated public-domain book text from
    Project Gutenberg; the word finder queries a rhyme/synonym API. Neither is open
    web browsing — answer the "unrestricted web" question **No**.)
  - No ads, no gambling, no mature content, no data collection.

---

## URLs

- **Privacy policy:** `<GitHub Pages URL — see OWNER-TODO>` (content: docs/privacy-policy.md)
- **Support URL:** same site, or a simple page with the support email.
- **Marketing URL** (optional): a landing page if/when one exists; leave blank for v1.
- **Support email:** bmostudio.dev@gmail.com

---

## Privacy questionnaire — App Store "nutrition label" & Play "Data safety"

SongNook's answer is the short one: **Data Not Collected.** Two things to confirm
against the shipped build before you commit to that:

1. **Crash capture is LOCAL-ONLY** (the `crashLog` service writes to the device;
   nothing is transmitted unless the user taps "Share diagnostic log"). As long as
   that's still true at ship time, no crash/diagnostics data is "collected" by you →
   **Data Not Collected** stands. (If you ever add Sentry/analytics, this flips to
   "Diagnostics → Crash Data, not linked to identity.")
2. **Third-party API calls** — the Word Finder sends the looked-up word to the
   Datamuse API; Magpie fetches public-domain text from Project Gutenberg. These are
   anonymous (no account, no identifier you create), you don't store them, and they're
   only made when the user uses those features. You are not *collecting* this data.
   Both stores' forms ask about data **you or your SDKs collect** — a stateless
   third-party API call that you don't log doesn't count as collection. Safe to answer
   **Data Not Collected**; if you want to be maximally conservative, Play lets you note
   it and it does not change the "no data collected" headline.

**App Store — App Privacy:**
- Data Not Collected. (Toggle every category off.)
- "Data used to track you": None.

**Play — Data safety:**
- Does your app collect or share any user data? **No.**
- Is all data encrypted in transit? The few HTTPS calls are — but since you collect
  no data, this section is moot. If prompted: yes, HTTPS.
- Data deletion: N/A (nothing held server-side).

**Export compliance (App Store):** `ITSAppUsesNonExemptEncryption = false` is already
in app.json — the standard-encryption-only answer. No extra docs needed.

**Android foreground service (Play):** the app declares a microphone/media foreground
service for background recording. When Play prompts for the foreground-service
declaration, select the **microphone** use case and describe it: "Continues an
in-progress audio recording when the app is backgrounded or the screen locks."

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
