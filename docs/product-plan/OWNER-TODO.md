# Owner TODO — account-bound launch steps & device verification

## 0. Device verification checklist (Phases 0–2 + playback fixes)

Everything below shipped code-complete with tests/typecheck green, but only a real device can confirm feel and native behavior. **First: rebuild the dev client (`npm run android`)** — the waveform-cancel hook is native code; a JS reload will not pick it up.

**Playback fixes (commit f7eacc5c) — the critical ones:**
- [ ] Import a fresh song → open full player → tap play within ~2s. Must play through, no play-then-pause. (Also try tapping play *mid*-waveform-generation: open, wait 1s, play.)
- [ ] Imported clip cards: durations fill in shortly after import (no 0:00 stragglers); kill + relaunch the app with a 0:00 clip present → it self-heals via the launch backfill.
- [ ] Stale playhead: play clip A, pause mid-track (or background the app), open clip B → playhead shows 0:00 immediately, never A's position. Also check the mini dock during the switch.
- [ ] Editor save while the dock is playing another clip → save completes promptly (no long hang), saved clip gets a REAL waveform thumbnail.
- [ ] Overdub stem-alignment overlay while auditioning → detailed (not blocky) waveforms in the zoom view.
- [ ] Restore/import a PRE-RENAME backup or archive (old "Song Seed" export) → imports fine.
- [ ] General nav feel after rebuild — if lag persists in this build, report it; no code regression was found, so next step is on-device profiling.

**Phase 3 interaction polish (haptics/animation — device-only, needs a physical device, not emulator):**
- [ ] Haptics feel right and aren't buzzy: editor (region add/remove, intent switch, speed/pitch steppers), AudioReel scrub grab/release + zoom detents, tuner in-tune lock buzz (should fire once on locking green, not machine-gun), PlayerSheet expand/collapse settle. All gated by the Settings haptics toggle — confirm turning it OFF silences everything new.
- [ ] Toasts: trigger "clip saved" (editor export), "copied" (lyrics/chords, backup name), "added to song" — pill appears above the dock, auto-dismisses, doesn't cover dialogs. VoiceOver/TalkBack announces it.
- [ ] AnimatedCollapse: overdub Levels/Timing sections and practice-panel tool disclosure settle in (fade + slight slide) instead of popping; 60fps on a mid-tier Android.
- [ ] Any intensity/timing that feels off → tell me the surface; every value is a single named constant.

**Phase 4 first-run & help (verify on a FRESH install — clear app data or reinstall):**
- [ ] Fresh install → splash → welcome (2-3 panes, skippable) → lands in an auto-created "My Songs" workspace with recording one tap away.
- [ ] Kill + relaunch → welcome does NOT reappear. Replay it from Settings → About → "Replay intro".
- [ ] Upgrade path (existing library): confirm the welcome does NOT show for you (you already have data) after this build lands.
- [ ] Empty states read well: open Library tabs, Search (before typing + no results), Revisit, Activity, an empty collection, the overdub section — each teaches what it's for.
- [ ] **Help-sheet accuracy (I need your eyes here):** open the help (?) on Recording, Full player/practice, Overdubs, and the Trim editor — confirm every claim about how the feature works is actually true. I drafted from the code, but you know the real behavior.
- [ ] Review prompt: won't fire for a while by design (10th saved clip + 5 days) — just confirm nothing prompts prematurely.

**Phase 2 visual pass (fonts/radii/colors changed on ~50 files — pixels need eyes):**
- [ ] Scroll through: Metronome, Tuner, Bluetooth calibration, Recording (incl. metronome sheet), overdub layer cards, Editor (both export dialogs), Search, Activity, Share-import. Everything should render in the app fonts (no OS-font stragglers) with consistent corner radii.
- [ ] Metronome page rebuild: one screen no scrolling on your device; beat bar reads clearly; pulse/halo intensity feels right at high + low BPM (all values are single constants if anything needs dialing).
- [ ] Recording screen: compact beat bar above the transport during count-in and while recording; record-button halo punch (downbeats hit harder).
- [ ] New app icon/splash on the launcher + cold start (one continuous motion, no white flash, paper-toned splash).
- [ ] Songstead label under the icon (dev build shows "Songstead Dev").
- [ ] Force a crash in dev (temporary `throw` in a screen) → branded "Something went wrong" screen → Restart recovers → Settings → About → "Share diagnostic log" has the entry.


Things only the account owner can do. None of these block Phases 2–4 (code work continues without them), but **items 1 and 3 gate Phase 1 (iOS) and Phase 5 (store submission)** — knock them out when convenient, the earlier the better since some have approval lead time.

## 1. Developer accounts (longest lead time — start first)
- [ ] **Apple Developer Program** — developer.apple.com, $99/year. Enrollment approval can take 1–2 days. Needed for: any iOS device build, TestFlight, App Store submission (Phases 1 & 5).
- [ ] **Google Play Console** — play.google.com/console, $25 one-time. New personal accounts require a closed-testing period (14 days, 12+ testers) before production access — check current policy early, this can affect the launch timeline. Needed for Phase 5.

## 2. Link the repo to EAS (5 minutes)
```
npm install -g eas-cli    # or use npx eas-cli
eas login                 # your Expo account (create one at expo.dev if needed)
eas init                  # writes extra.eas.projectId into app.json — commit that change
```
Build profiles already exist in `eas.json`. After this, `eas build --profile production --platform android` should work end to end.

## 3. Host the privacy policy (10 minutes)
- [ ] The policy is written: `docs/privacy-policy.md`.
- [ ] Enable **GitHub Pages** on the repo: GitHub → Settings → Pages → Source: "Deploy from a branch" → branch `main`, folder `/docs`.
- [ ] Note the resulting URL (e.g. `https://bmo890.github.io/song-seed/privacy-policy`). Both store listings require it (Phase 5).
- [ ] Tell Claude the URL — a "Privacy policy" link row gets added to Settings → About pointing at it.
- Alternative if you prefer: any static host (Netlify, Cloudflare Pages) — only the stable URL matters.

## 4. When Phase 1 (iOS) starts — hardware & signing
- [ ] A Mac with Xcode installed (current stable) + a physical iPhone with a cable.
- [ ] After the Apple account exists: `eas credentials` (or let `eas build --platform ios` walk you through it) to generate signing certs — EAS manages the share-extension provisioning automatically.

## 5. Songstead housekeeping (non-blocking, whenever)
- [ ] Register a domain if wanted (songstead.app / songstead.com) — nice for the store listing's marketing URL and a future landing page; not required to ship.
- [ ] Sanity search "Songstead" on the App Store / Play Store / USPTO (Classes 9 & 41) before first submission — the name was locked without a formal clearance pass; a 30-minute check de-risks it. (See phase-0.0 ticket, Step 1.)
- [ ] Rename the GitHub repo `song-seed` → `songstead` if desired (GitHub auto-redirects old remotes; run `git remote set-url` afterward). Cosmetic only.

## Already handled (no action)
- eas.json build profiles · privacy policy text · export-compliance key · app icon first pass (refine art whenever — replace the four PNGs in `assets/`) · bundle ID decision (keeping `com.bmostudio.songseed`).
