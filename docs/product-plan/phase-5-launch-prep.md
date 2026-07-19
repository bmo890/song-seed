# Phase 5 — Launch Prep & Store Submission

**Effort:** ~3–4 days of work + review wait time · **Dependencies:** Phases 0–4 complete (Phase 1 is the hard gate for iOS; Android can technically ship after 0+2)

## Purpose

Everything between "the app is done" and "the app is live": store listings, screenshots, final QA matrix, versioning, and the submissions themselves — including the review-team quirks a local-first audio app should anticipate.

## Background you need

- **Identifiers:** Android package `com.bmostudio.songnook` (dev variant `.dev`), iOS bundle `com.bmostudio.songnook` + the share-extension target ("SongNook Import"). Version `1.0.0`, Android `versionCode 1` (in `android/app/build.gradle`); EAS `autoIncrement` from Phase 0.7 manages increments going forward.
- **Privacy posture:** no accounts, no user data leaves the device except (a) Datamuse word-lookup queries, (b) Gutenberg public-book fetches, (c) crash reports **if** Phase 0.4 chose Sentry. Privacy policy URL from Phase 0.9.
- **Permissions the reviewer will see:** microphone (recording — usage string already set), Android `MODIFY_AUDIO_SETTINGS`, notifications (Android recording foreground-service notification via the siteed plugin), background audio/processing modes on iOS.
- The app is **free with no IAP at v1.0** (monetization is Phase 6, post-launch) — this simplifies both reviews substantially.

## Work items

### 5.1 Store listings

Write once, adapt per store:
- **Name:** "SongNook" (verify availability; App Store names are unique — have fallbacks like "SongNook — Idea Recorder").
- **Subtitle (iOS, 30 chars) / short description (Play, 80):** the capture promise, e.g. "Catch song ideas instantly".
- **Description:** lead with capture speed, then organization (workspaces/collections), practice tools (loop/slow/pitch), overdub layers, lyric tools, and close with the trust story: *"Your music never leaves your device. No account. No cloud. Backups you control."* — for this audience that's a differentiator, not boilerplate.
- **Keywords (iOS 100-char field):** songwriting, voice memo, song ideas, riff, demo recorder, practice, looper, lyric, chord.
- **Category:** Music. **Age rating:** 4+/Everyone (questionnaires: no UGC sharing, no web content — Magpie's book text is curated public domain; answer "no" to unrestricted web access).
- Support URL (can be the GitHub Pages site from Phase 0.9), marketing URL optional, contact email bmostudio.dev@gmail.com.

### 5.2 Screenshots & preview

Required sets: iPhone 6.9"/6.7" and 6.1" (or per current ASC requirements at submission time); Play needs phone + optionally 7"/10" tablet (skip tablet if `supportsTablet` was set false in Phase 1.6 — **do the same on Play**: don't declare tablet support you haven't QA'd).
- 6–8 shots telling the story in order: (1) recording in progress with live waveform, (2) a workspace full of ideas, (3) full player with sections/waveform, (4) practice panel (loop + speed/pitch), (5) overdub layers, (6) lyric tools / word finder, (7) backup/privacy statement card.
- Use real-looking content (seed a demo library — plausible titles, varied durations), device frames + one-line captions in brand type on paper background. Keep sources (Figma or a script) in `docs/store-assets/` so they're regenerable.
- App preview video: optional, skip for v1 unless cheap.

### 5.3 Data safety / privacy questionnaires

- **Play Data Safety:** no data collected/shared (if Sentry: "crash logs collected, not linked to identity, for app functionality"). Data encrypted in transit (the two/three HTTPS calls), user can request deletion N/A (nothing held).
- **App Store privacy nutrition label:** same answers; "Data Not Collected" if 0.4-B was chosen, else Diagnostics → Crash Data, not linked to user.
- **Play declarations:** the `FOREGROUND_SERVICE`/notification usage for background recording may require the foreground-service declaration form (mediaProcessing/microphone type) — check the Play Console prompts against what the siteed plugin's manifest actually declares (`android/app/src/main/AndroidManifest.xml` after build).

### 5.4 Final QA matrix (the pre-flight)

Run the full pass on: newest-iOS iPhone, an older/smaller iPhone, a flagship Android, and a **mid-tier Android** (performance truth-teller). For each:

- [ ] Fresh install → welcome → seeded workspace → record → save → play (the Phase 4 golden path)
- [ ] Record 10+ min take with screen locked; interruption (incoming call) mid-record and mid-play
- [ ] Import via share sheet from Voice Memos (iOS) / Files (both); duplicate review flow
- [ ] Full backup → save to Files/Drive → wipe → restore; merge-restore into a non-empty library
- [ ] Practice: loop a section, speed/pitch change, pins; overdub: record layer, mute/solo, nudge alignment, flatten & trim
- [ ] Trim editor: keep + remove regions, export both, "remove original" toggle
- [ ] **Airplane mode:** word finder, Magpie, Cut-Up degrade with friendly in-app messages (no infinite spinners / raw errors) — this was never explicitly QA'd; budget fix time
- [ ] **Low storage:** fill the device, attempt recording + backup — errors must be styled and truthful
- [ ] Permission denial: deny mic → guidance + Settings deep-link → grant → works without restart
- [ ] Large library (100+ clips — restore a big backup): scroll perf, player open latency, startup time < 4s warm device
- [ ] Accessibility smoke: VoiceOver/TalkBack through record→save→play; text at largest OS font size doesn't truncate critical actions
- [ ] Battery/thermal sanity: 30-min practice-loop session doesn't cook the phone

File every failure as a blocker/non-blocker decision with the owner before submitting.

### 5.5 Submission mechanics

- Android: Play Console → internal testing track first (validates signing/declarations) → production with staged rollout (20% → 100% over a few days; halt if crash rate spikes — this is why Phase 0.4 matters).
- iOS: EAS Submit → TestFlight (external group optional) → App Review. **Review notes:** explain background-audio usage ("audio recording app; background mode allows recordings to continue when the screen locks") and that no login exists (reviewers look for demo credentials — state "no account required"). Expect possible rejection-questions on background modes; the honest answer above is the accepted one.
- Prepare a 1.0.1 runway: keep `main` releasable; hotfix branch process agreed; EAS Update (OTA) is **not** configured — decide now whether to add `expo-updates` for JS-only hotfixes (recommended: yes, before launch, since audio-native code rarely changes but JS bugs will happen; if added, it must be declared in App Review notes? — no, OTA of JS is allowed on both stores within guidelines).

### 5.6 Launch-day/week checklist

- [ ] Crash dashboard (or diagnostic-log inbox) watched daily for week 1
- [ ] Store reviews monitored + replied to (Play replies are public and indexed — use them)
- [ ] A pinned known-issues note in the repo; triage labels ready
- [ ] Versioning: next milestones pre-named (1.0.x hotfixes, 1.1 = Phase 6 monetization)

## Out of scope

Paid marketing, press kits, localized listings (English-only v1), Android tablet/ChromeOS support.
