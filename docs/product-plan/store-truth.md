# SongNook — what we tell people (one source for both stores)

**Status:** approved by the founder 2026-10-25 ("go with your recommendations for all
eight"). D1–D4 are built (D2/D3 ship with the next store builds); the policy and terms
below are published at songnook.app. Once approved, this file is the
single source: the privacy policy, the terms, Apple's App Privacy answers, Google's Data
safety answers, the ratings and the store descriptions are all taken from it, word for
word, on both stores. `store-listing.md` and `store-privacy-answers.md` are superseded
where they disagree.

The facts below come from a code sweep of `main` on 2026-10-25 (file references kept in
section 1), not from earlier docs.

---

## 1. The facts (verified in code, 2026-10-25)

**Never happens:** analytics, crash-reporting SDKs, ads, ad networks, tracking, accounts,
sign-in, email collection, contact forms, reading the clipboard. No library sync: the
library lives on the phone.

**Leaves the phone automatically (no tap):**

| What | Where to | What is sent | Why |
|---|---|---|---|
| App update check, every launch | Expo (`u.expo.dev`) | App version, platform, update channel, a random install ID made by the app, and after a failed launch the error text (up to 1 KB) | Delivering fixes between store releases |
| Purchase status, every launch (iOS today; Android once its key is added) | RevenueCat (`api.revenuecat.com`) | An anonymous RevenueCat ID, Apple's per-app device ID (IDFV), device model, OS, app version, language, store country, purchase receipts | Knowing whether Pro is bought, restoring it |

RevenueCat starts today even though every feature is still free (`App.tsx:1220`,
`services/billing.ts:113`). See decision D1.

**Leaves the phone only when the person uses a feature:**

| Feature | Where to | What is sent |
|---|---|---|
| Word Finder, English (and Spanish) | Datamuse (`api.datamuse.com`) | The word, plus up to 5 theme words if set (Spanish: a spelling pattern) |
| Word Finder, Hebrew | Our server → Anthropic (Claude) and Dicta | The word and theme words. Our server keeps an anonymous shared cache of results (word → suggestions, no person or IP attached) |
| Magpie (borrowed words) | Gutendex / Project Gutenberg (English), our server → Ben-Yehuda Project (Hebrew) | Which page of which public-domain book; loads a book cover image. Starts when the Magpie screen first opens |
| SongNook Send (making a link) | Our server, `send.songnook.app` (Cloudflare) | What the person picked: audio clips, or a whole sketch as one package (which can carry its lyrics, notes, chords and pins), file names, optional title, sender name and message |
| Opening a Send link | Our server | Nothing about the person; downloads the parcel |
| Feedback / diagnostics | The person's own mail app | Only if they choose to: the crash log, the save journal, app and OS version |

**Our servers:**
- Send keeps a parcel **7 days**, then deletes files and details. Abandoned uploads go
  within a day. It counts downloads per file, never who downloaded. There is no button
  to delete a link early; email does it. Abuse reports: a Report link on the recipient
  page (email).
- Send, the Hebrew word server and the Magpie server use the requester's **IP address
  for rate limits only**: counters that expire within about 2 hours, no logs of who did
  what.
- The Send recipient web page loads its fonts from Google Fonts (so the recipient's
  browser contacts Google). See D4.

**Stays on the phone:**
- The library (SQLite + audio files), settings, word lookup cache.
- A local crash log (last 20) and save journal (last 400 saves): never sent unless shared.
- The free-month record (when the month began) in the phone's secure storage (Keychain on
  iOS), deliberately kept through reinstall and Erase everything, so the month can't be
  restarted. Never sent.
- **Device backups:** iCloud backup (iOS) and Google's Android backup include the library
  by default. We don't see these; Apple and Google hold them.

**Permissions:**
- Microphone (recording, tuner).
- Notifications (the recording / playback notification that keeps a take going with the
  screen locked).
- Photos picker (iOS: choosing a video to take its sound; no library access is granted, the
  system picker hands over one file). Video never leaves the phone; only its sound is kept.
- Face ID / fingerprint: only to confirm Erase everything.
- Android: Bluetooth and USB (to use external microphones and interfaces), foreground
  services of type microphone and media playback, storage access for the file picker.
- iOS also carries an unused **camera** description from the image picker plugin. See D2.

---

## 2. Decisions (all eight: the recommendation, founder 2026-10-25)

Each is "fix the app" or "say it in the policy".

- **D1. RevenueCat before Pro exists.** It contacts RevenueCat on every launch today though
  nothing is for sale. **Recommend: start it only once the paywall is live** (one line in
  `initBilling`, ships by OTA). The policy still describes purchases, for when Pro opens.
- **D2. Unused camera permission text (iOS).** **Recommend: remove it** (image-picker plugin
  `cameraPermission: false`; needs the next store build). Otherwise reviewers may ask why.
- **D3. Advertising ID (Android).** RevenueCat's Android library may pull in Google's
  advertising-ID permission. **Recommend: block it** (`blockedPermissions` +=
  `com.google.android.gms.permission.AD_ID`, next store build), then answer Play's
  "Advertising ID: No".
- **D4. Google Fonts on the Send page.** **Recommend: serve the fonts from our own server**
  (a small server deploy), so a recipient's browser talks only to us. Otherwise disclose.
- **D5. Search words in the privacy labels.** Words typed into the Word Finder go to
  Datamuse / Anthropic / Dicta, and our Hebrew cache keeps word → results with no person
  attached. In August we called this "not collection". Apple and Google count third
  parties too, and Datamuse's own logging is outside our control. **Recommend: declare it
  honestly** as Search history, not linked to the person, for app functionality. It adds
  one line to the label and removes any doubt.
- **D6. The install and device IDs.** Expo's update check sends a random install ID;
  RevenueCat sends Apple's per-app device ID. **Recommend: declare** "Device ID / Device or
  other IDs", not linked, app functionality, no tracking. (Many apps skip this; we said we
  would be honest.)
- **D7. Target audience on Play.** **Recommend: 13 and over.** Teen songwriters are real
  users; under-13 puts the app in Google's Families program, with much stricter rules. (If
  you prefer the simplest path, 18 and over.)
- **D8. Device backups and the free-month record.** **Recommend: keep both, and say so.**
  Backups protect people's work; the month record stops reinstall loops. Both are
  disclosed below.

---

## 3. Privacy policy and terms

Published 2026-10-25: `docs/privacy-policy.md` and `docs/terms-of-use.md` are the text,
built into the Send Worker (`npm run build:legal`) and served at songnook.app/privacy and
/terms. Edit those files, never a copy here.

---

## 4. The privacy labels (same facts, each store's words)

**Apple: App Privacy** (all items: Not linked to you · Not used for tracking · App
Functionality)
- Purchases → **Purchase History**
- Identifiers → **Device ID** (D6)
- User Content → **Audio Data**, **Other User Content** (titles, lyrics and notes in a
  sent sketch, sender name, message)
- Search History → **Search History** (D5)
- "Data Used to Track You": **None**.

**Google: Data safety**
- Collects data: **Yes**. Shares data: **No** (Expo, RevenueCat, Cloudflare, Datamuse,
  Anthropic, Dicta act as service providers). Encrypted in transit: **Yes**. Account
  deletion: no accounts.
- Financial info → **Purchase history**: optional (only if Pro is bought), App
  functionality.
- Device or other IDs: **required** (the update check runs for everyone), App
  functionality.
- Audio → **Voice or sound recordings**, **Music files**: optional (only when sending),
  App functionality, deleted after 7 days.
- Files and docs: optional (a sent sketch package), App functionality.
- App activity → **In-app search history**: optional (Word Finder), App functionality.
- Other user-generated content (title, name, message, lyrics in a sketch): optional, App
  functionality.
- Deletion: parcels delete themselves after 7 days; by email sooner.
- **Advertising ID:** No (after D3).

**Play foreground services:** microphone ("continues a recording while the app is in the
background or the screen is locked") and media playback ("keeps playback and its lock-screen
controls going in the background").

---

## 5. Ratings and audience

- **Apple age rating:** answer No to violence, mature themes, gambling, unrestricted web
  access. "User-generated content" / sharing: **Yes**, narrowly: people send their own
  recordings by private expiring link; no public feed, search, chat or profiles; a Report
  link. Let the console compute the rating; expect 4+ or 9+.
- **Google (IARC):** category **"All other app types"**. Users interact / share content: **Yes** (private links only). Expect
  "Everyone", possibly with a "Users interact" note.
- **Play target audience:** **13 and over** (D7). Not designed for children.
- **Ads:** No ads (both stores).
- **App access (Play):** everything usable with no login; no credentials needed.
- **Government / financial / health / news / dating apps:** No.

---

## 6. Store description (one voice, both stores)

This is the founder-approved copy, live in both consoles since 2026-10-25. The two stores
differ only where marked.

- **Name:** SongNook
- **Tagline (both stores, the intro screen and the feature graphic):** A quiet corner to finish songs.
- **Apple subtitle (30):** `A quiet corner to finish songs`
- **Play short description (80):** `A quiet corner to finish songs. Record, organize, rehearse, never lose a gem.`
- **Apple promotional text (170):** `A quiet corner to finish songs. Catch ideas the moment they hit, find them again, rehearse them until they're done. No account, and your songs stay on your phone.`
- **Apple keywords (100):** `songwriting,songwriter,lyrics,chords,voice memo,recorder,song ideas,setlist,tuner,metronome,demo`
- **Categories:** Apple: Music, then Productivity.
- **Links:** support https://songnook.app/privacy#contact · marketing https://songnook.app

**Full description.** Play uses this text as is. Apple changes the backup line to
"Files, iCloud Drive or wherever you keep things", because Apple doesn't allow naming
other platforms. Apple also appends the subscription paragraph below.

```
SongNook records your song ideas, keeps them organized, and helps you finish them. No account, no ads.

Your songs stay on your phone. We never see them, and they are never used to train AI.

CAPTURE
• Record in one tap
• Stuck for a title? Get a name suggestion, so ideas don't end up as a list of dates
• Import voice memos, audio files, or the sound from a video

FIND IT AGAIN
• Revisit - brings back unfinished sketches, untouched ideas, and what you wrote this week in past years
• Shelf - found something worth coming back to? Set it aside for later so it doesn't get lost again
• Activity - shows what you worked on in any date range
• Tags, and search across titles, notes and lyrics

FINISH THE SONG
• Sketches - every take of a song in one place, with version history so nothing you tried is lost
• Lyric versions, chord charts, and lyrics with chords
• Record layers over a take and solo any of them
• Collections and workspaces to keep it all in order

REHEARSE
• Mark sections, drop pins and add notes on the timeline
• Change speed without changing pitch, and pitch without changing speed
• Loop any part
• Step up - work a hard part up to speed: the loop gets a little faster each pass
• Count-in, click, tuner and metronome

WRITE
• Word Finder - rhymes, near rhymes, synonyms
• Lyric Spark - games for writer's block
• Lyric Pad - a home for loose lines

SHARE
• SongNook Send - share clips or a whole sketch, with its lyrics, chords, notes and pins, by private link
• Open what co-writers and bandmates send you, notes and all
• Recording a band rehearsal? Drop pins as it happens to mark the moments worth coming back to
• Playlists, setlists, and chart books with transpose, capo and an autoscrolling stage reader
• Back up and export to Files, iCloud Drive or Google Drive

PRO
Your first month includes every tool, free, no card needed. After that, recording, writing and organizing your songs stay free, and SongNook Pro unlocks the extended tools.
```

**Apple only, appended (required for auto-renewing Pro):**

```
SongNook Pro is available as a yearly or monthly subscription, or a one-time lifetime purchase. Subscriptions renew automatically unless cancelled at least 24 hours before the end of the period; manage or cancel them in your App Store account settings.
Terms of Use: https://songnook.app/terms
Privacy Policy: https://songnook.app/privacy
```

**Writing rules the founder set:**
- Describe only what users do. Leave out crash safety, settings and other non-features.
- When a feature has a proper name, write "Name - what it does".
- Don't list languages.
- No marketing flourishes.

**Graphics:** see `docs/store-assets/`. Render them with `npm run brand:render`.

**Translations:** the Hebrew, Spanish, German and Portuguese listings are still to do.

---

## 7. Terms of use: what has to change

`docs/terms-of-use.md` still says SongNook and Send are "free of charge". It needs a
**SongNook Pro** section:
- Pro is sold through the App Store or Google Play, at the price shown in the app before
  buying; payment, renewal, cancellation and refunds are handled by the store.
- Subscriptions renew automatically until cancelled in the store's account settings.
- The free month: every Pro tool for 30 days, once per device; when it ends nothing made
  with Pro is lost; you can keep using what's free.
- Restore purchases from Settings.
- Send: free for 3 links a month; unlimited with Pro. (Receiving is always free.)
- Word games: three free tries of each game; unlimited with Pro.
- The "No warranty" liability cap stays "the amount you paid", which now can be non-zero.

---

## 8. Next steps once approved

1. Code: D1 (OTA), D2 + D3 (next store build), D4 (server deploy).
2. Publish the new privacy policy and terms at songnook.app (`npm run build:legal` + Send
   Worker deploy with `--config`).
3. Fill Play Console App content from sections 4–5; Apple App Privacy from section 4.
4. Store listings from section 6 (en, then he and es).
5. Screenshots and the Play feature graphic.
