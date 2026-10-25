# SongNook — what we tell people (one source for both stores)

**Status:** draft for the founder's review, 2026-10-25. Once approved, this file is the
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

## 2. Decisions for the founder

Each is "fix the app" or "say it in the policy". My recommendation first.

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

## 3. Privacy policy (proposed full text, replaces docs/privacy-policy.md)

> # SongNook Privacy Policy
>
> **Effective date:** [the day it is published]
>
> SongNook is a songwriting app built on a simple promise: **your music stays yours, on
> your phone.** There are no accounts, no ads, no analytics and no tracking.
>
> ## What stays on your phone
>
> Everything you make in SongNook (recordings, ideas, lyrics, chords, notes, marks and
> settings) is stored on your device. There is no library sync: we cannot see, open or
> recover your work, because it never reaches us unless you send something with
> SongNook Send.
>
> Your phone's own backup (iCloud on iPhone, Google backup on Android) includes SongNook's
> data unless you turn that off. Those backups are held by Apple or Google under their
> policies; we never see them.
>
> When you back up, export or share through your phone's share sheet, the files go only
> where you choose (Files, iCloud Drive, Google Drive, another app).
>
> ## What SongNook sends, and why
>
> SongNook makes a few network requests. None of them carry your name, an account, or
> anything from your library unless you choose to send it.
>
> - **App updates.** When it opens, the app asks Expo, the service that delivers our
>   updates, whether a newer version of its code is available. This sends the app version,
>   your platform, a random install ID created by the app, and, if the app failed to start
>   last time, the error message.
> - **Purchases.** If you buy SongNook Pro, the App Store or Google Play handles the
>   payment. We use RevenueCat to check and restore your purchase. RevenueCat receives an
>   anonymous ID, your device's app-specific identifier, device model, system version,
>   language, store country and your purchase history. We never see your payment details.
> - **Word tools.** Word Finder lookups send the word you look up, plus any theme words you
>   add, to Datamuse (English and Spanish) or, for Hebrew, to our own server, which asks
>   Anthropic's Claude and Dicta (a non-profit Hebrew language institute) for
>   suggestions. Our Hebrew server keeps a shared cache of results, with nothing that
>   identifies who looked them up. Your lyrics are never sent.
> - **Magpie.** Borrowed Words loads pages of public-domain books from Project Gutenberg
>   and, for Hebrew, from the Ben-Yehuda Project through our server.
>
> ## Sharing with SongNook Send
>
> Send hands clips or a whole sketch to someone with a link. Nothing uploads until you tap
> **Get a link**.
>
> - **What uploads:** only what you picked. Clips, or a sketch as one package, which
>   includes its lyrics, notes, chords and marks, with file names and the optional title,
>   name and message you add.
> - **Where:** a server we operate (send.songnook.app), hosted by Cloudflare. We don't
>   open, listen to or analyze what you send; we deliver it.
> - **Who can see it:** anyone with the link. Links are long and random, and not listed or
>   searchable anywhere. Share a link only with people you want to have the files.
> - **How long:** every parcel is deleted **7 days** after it is made, files and details
>   both. Unfinished uploads are cleaned up within a day. To remove one sooner, email us.
> - **What we count:** how many times each file was downloaded, never by whom.
>
> ## Abuse prevention
>
> Send, our Hebrew word server and our Magpie server use your device's IP address briefly
> to limit how often they can be called. These counters expire on their own within about
> two hours. We keep no log of who sent or looked up what.
>
> ## What we collect
>
> Only what is described above. No analytics, no advertising, no tracking, and nothing
> sold or shared for advertising.
>
> If the app crashes, it writes a diagnostic log **on your device only**, with a short
> journal of whether each save succeeded (times and outcomes, never your recordings or
> lyrics). You can send them to us from Settings → About when reporting a problem; nothing
> is sent automatically.
>
> SongNook keeps a small record of when your free month of Pro began, in your phone's
> secure storage, so that reinstalling doesn't restart it. It stays on your phone.
>
> ## Permissions
>
> - **Microphone:** to record, and for the tuner. Audio is captured only while you record
>   or tune.
> - **Notifications:** for the notification that keeps a recording or playback going while
>   the screen is locked.
> - **Photos (choosing a video):** the system picker hands SongNook only the video you pick,
>   to take its sound. The video stays on your phone.
> - **Face ID or fingerprint:** only to confirm Erase everything.
> - **Bluetooth and USB (Android):** to record from external microphones and interfaces.
>
> ## Children
>
> SongNook is not directed at children under 13 and does not knowingly collect their
> personal information.
>
> ## Changes
>
> If this policy changes, the new version is posted here with a new effective date.
>
> ## Contact
>
> Questions, requests, or a Send link being misused: **bmostudio.dev@gmail.com**

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

**Name:** SongNook
**Apple subtitle (30):** `Catch song ideas, grow them`
**Play short description (80):** `Record song ideas the moment they strike, then grow them into finished songs.`
**Apple promotional text (170):** `Every song starts as a hum in the car or a riff at 2am. SongNook catches it before it's gone, then helps you shape it. No account. Your songs stay on your phone.`

**Full description:**

> SongNook is a songwriting sketchbook for the ideas that arrive when you least expect
> them. Hum a melody, strum a riff, sing a line: catch it in a tap, then grow it into a
> song at your own pace.
>
> No account, no sign-up, no ads. Your songs live on your phone.
>
> CATCH THE SPARK
> • One tap to record, with a count-in and a metronome
> • Keeps recording with the screen locked
> • Bring in voice memos and audio files, or the sound from a video
>
> GROW EVERY IDEA
> • Gather takes into sketches, collections and workspaces
> • Keep lyrics, chord charts and notes beside the audio
> • Layer a harmony or a second part over a take
> • Trim and edit takes
>
> PRACTICE
> • Loop the hard part and slow it down without changing the pitch
> • Tuner and metronome built in
>
> WORDS
> • Word games to shake a line loose: Word Ladder, Cut-Up, Borrowed Words (three
>   free tries of each)
>
> SHARE WHEN YOU CHOOSE
> • Send clips or a whole sketch to a bandmate with a private link that expires in 7 days
> • Back up and export to Files, iCloud or Drive, wherever you choose
>
> SONGNOOK PRO
> Try every Pro tool free for a month, no card needed. Then Pro adds: more layers per
> take, more workspaces, the Word Finder (rhymes, synonyms, related words), every word
> game as often as you like, pins, pitch
> shift and tempo analysis, the full editor, transpose, capo, chart books, setlists and the
> stage reader, PDF export, and unlimited Send links.
> Recording, your library, lyrics and backups are never locked.
>
> English, עברית, Español.
>
> Made for songwriters, by a songwriter. Start with a hum.

**Apple subscription disclosure (end of description, required for auto-renewing Pro):**

> SongNook Pro is available as a yearly or monthly subscription, or a one-time lifetime
> purchase. Subscriptions renew automatically unless cancelled at least 24 hours before
> the end of the period; manage or cancel them in your App Store account settings.
> Terms: https://songnook.app/terms · Privacy: https://songnook.app/privacy

(The Play listing doesn't need this paragraph; Google shows subscription terms itself. It
can stay for one shared text.)

**Translations:** Hebrew and Spanish listings, translated from this text once approved.

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
