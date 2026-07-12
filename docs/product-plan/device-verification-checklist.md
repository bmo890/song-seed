# Songstead — device verification checklist

Everything to check on a real device, covering all work since Phase 0. Ordered by
stakes: data/playback first (a bug here is worst), polish last. Account steps
(Apple/Google/EAS/Pages) live in [OWNER-TODO](OWNER-TODO.md) — this doc is only the
"does the code work on a phone" pass.

**Do this first:** rebuild the dev client (`npm run android`). Two native modules
changed (the waveform cancel hook) and two packages were installed
(expo-splash-screen, expo-store-review) — a JS reload won't pick them up.

Legend: 🔴 critical (data/audio) · 🟡 important · ⚪ polish

---

## 1. 🔴 Playback — the first-play stall & friends (commit f7eacc5c)

The bug you flagged as critical. Native code, so the rebuild matters most here.

- [ ] Import a fresh song → open it in the full player → **tap play within ~2s**. It should play straight through, no play-then-pause.
- [ ] Same, but tap play *during* waveform generation (open, wait ~1s, then play).
- [ ] Play a clip, let it run a while, seek around — no stalls, no stutter.
- [ ] Rapidly open several different clips into the player back-to-back — each loads and plays, none get stuck.
- [ ] Inline players (clip cards in a list) and region previews in the editor also start cleanly (the preemption was centralized to cover these too).

## 2. 🔴 Clip durations — no more "0:00" (commit f7eacc5c)

- [ ] Newly imported clips show their real length on the card within a few seconds (no lingering 0:00).
- [ ] Import several at once → all fill in their durations (paced, but all land).
- [ ] Kill and relaunch the app while a clip still shows 0:00 → it self-heals on next launch (startup backfill).
- [ ] Restore/import a library archive → restored clips get durations too.

## 3. 🔴 Stale playhead on clip switch (commit f7eacc5c)

- [ ] Play clip A, pause mid-track (or background the app), then open clip B → B's playhead shows **0:00**, never A's position.
- [ ] Watch the mini-dock during the switch — it shouldn't flash the old clip's time/duration.
- [ ] Open a clip whose audio file is missing (e.g. offloaded) → graceful, no phantom "playing at 0:00 of the old clip."

## 4. 🔴 Editor & overdub audio (Phase 3 + f7eacc5c)

- [ ] Trim editor: keep-regions and remove-regions both export correctly; the saved clip's waveform is **real** (not a flat/fake envelope).
- [ ] Editor **Save while the dock is playing another clip** → completes promptly (NOT a ~45s hang) and saves a real waveform.
- [ ] Overdub stem-alignment overlay while auditioning → the zoomed view shows **detailed** waveforms (so nudges move pixels), not blocky fallbacks.
- [ ] Record an overdub layer, mute/solo/nudge it — behaves as expected.

## 5. 🔴 Backups & legacy compatibility (rename + f7eacc5c)

- [ ] Full backup → save to Files/Drive → wipe (or reinstall) → restore. Round-trips losslessly.
- [ ] **Import a PRE-RENAME backup/archive** (any "Song Seed"-era export you have) → still imports (legacy `song-seed-archive` format + `.songseed-workspace.zip` are still accepted).
- [ ] Export → the file carries the Songstead name; re-import it.

## 6. 🔴 First-run & the welcome flow (Phase 4 + review fix)

Test on a **fresh install** (clear app data or reinstall).

- [ ] Fresh install → splash → **welcome (3 panes, skippable)** → lands in an auto-created **"My Songs" workspace with an "Ideas" collection**, record one tap away. (This was the review-caught bug — confirm you don't land on a bare "Main" workspace.)
- [ ] Swipe through the panes; "Skip" and "Start" both dismiss and don't reappear.
- [ ] Kill + relaunch → welcome does **not** show again.
- [ ] **Upgrade path (your existing library):** after this build, the welcome must **not** show for you — you already have data.
- [ ] Settings → About → **"Replay intro"** → the intro shows again immediately.
- [ ] (Hard to stage) If you ever hit the "Restore your library?" recovery prompt, the welcome must **not** appear over it.

## 7. 🟡 Metronome rebuild (commit a4b59ad0)

- [ ] Standalone Metronome page: **one screen, no scrolling** on your device — with a cue's level controls open (worst case) it still fits.
- [ ] Start/stop works; the big BPM readout + beat-dot bar are clear.
- [ ] **Visual beat cue** reads well at high and low BPM (this was the "make it more obvious" ask) — the pulse/halo should be easy to catch.
- [ ] The page's tempo/meter/cue controls match the in-recorder metronome sheet (they share code now).
- [ ] Recording screen: the compact **beat bar appears above the transport** during count-in and while recording; record-button halo punches harder on downbeats.

## 8. 🟡 Player zoom (commits 4f3a3db, bfe4e7a)

- [ ] Every song **opens at the same zoom (8×)** — no more different-every-time.
- [ ] The zoom pill has a **fit button** (viewfinder-frame icon) at the left → tapping snaps to 1× (whole clip); it dims at 1×.
- [ ] The fit icon is clearly distinct from the reel-size collapse (diagonal arrows) and the sheet minimize (chevron) — no confusion.
- [ ] **Short clips** (a ~15–30s idea) open showing the whole gesture, not a sliver. If the ~8s floor feels off, tell me — it's one constant (`MIN_OPEN_ZOOM_WINDOW_MS`).

## 9. 🟡 Haptics & toasts (Phase 3)

Physical device only (emulators don't buzz). Check with the Settings haptics toggle **on**, then **off** (off must silence everything new).

- [ ] Editor: region add/remove, keep/remove intent switch, speed/pitch steppers all tick.
- [ ] AudioReel: a tick on scrub grab/release and on zoom steps (but **not** at the zoom limits — a no-op tap shouldn't buzz).
- [ ] Tuner: a single success buzz when the needle **locks in tune** (fires once, not machine-gun; re-arms after you drift out).
- [ ] PlayerSheet: a settle tick when it lands fully open or docked.
- [ ] Toasts: trigger "clip saved" (editor export), "copied" (lyrics/chords, backup name), "added to song" → a paper pill appears above the dock, auto-dismisses, doesn't cover dialogs. Fire two in quick succession → the newest shows (isn't dropped). VoiceOver/TalkBack announces it.
- [ ] Overdub layer sections and practice-panel tools **settle in** (fade + slight slide) instead of popping.

## 10. ⚪ Brand / visual pass (Phase 2 — ~50 files touched)

Pixels can't be unit-tested; a scroll-through is the real check.

- [ ] These screens render in the **app fonts** (no OS system-font stragglers): Metronome, Tuner, Bluetooth calibration, Recording + its metronome sheet, overdub layer cards, Editor + both export dialogs, Search, Activity, Share-import.
- [ ] Corner radii look consistent (no oddly sharp/round outliers).
- [ ] Destructive actions (delete) are a consistent brick-red.
- [ ] Editor's "Save a combined clip first" overdub screen looks intentional (Playfair headline, icon).
- [ ] Status bar icons are the right contrast on every screen (one root setting now).

## 11. ⚪ App shell (Phase 0)

- [ ] Real **app icon** on the launcher (not the grey Expo placeholder) — both a home screen and the app switcher.
- [ ] Cold start: splash → app in **one continuous motion** on the paper background, no white flash, no spinner flash.
- [ ] Launcher label reads **"Songstead"** (dev build: "Songstead Dev").
- [ ] Force a crash in dev (temporarily `throw` in a screen render) → a branded **"Something went wrong"** screen with a Restart button that recovers the app with your library intact.
- [ ] After that crash: Settings → About → **"Share diagnostic log"** has an entry to share.
- [ ] The 4 formerly-native alerts (empty-library restore, recovered/failed recording, backup reminder) render as **styled** in-app dialogs, not OS popups. (Backup reminder is the easiest to trigger.)

## 12. 🟡 Help-sheet accuracy — I need your eyes here (Phase 4)

I wrote these from the code; you know the real behavior. Open the **?** on each and confirm every claim is true:

- [ ] **Recording** (header ? button) — count-in, metronome cues, naming, Bluetooth latency, background recording.
- [ ] **Trim editor** (header ? button) — keep vs remove, regions, save-as-new-clip + remove-original, permanent speed/pitch.
- [ ] **Practice tools** (player "More options" menu → "How practice works") — loop, pins, sections, non-destructive speed/pitch, key/tempo.
- [ ] **Overdubs** (player "More options" → "How overdubs work", shown when the clip is layered) — layers ride the take, levels, timing nudge, solo/mute, flatten-before-trimming.

## 13. 🟡 Store-review prompt (Phase 4)

- [ ] Nothing prompts for a review prematurely (by design it needs 10+ saved clips AND 5+ days installed — so on a fresh test it should stay silent).

## 14. 🟡 Cross-cutting QA (device pass essentials)

- [ ] **Airplane mode**: Word Finder, Magpie, Cut-Up degrade with friendly in-app messages — no infinite spinners or raw errors.
- [ ] **Low storage**: fill the device, attempt a recording + a backup — errors are styled and truthful.
- [ ] **Mic permission**: deny it → guidance + a working "Open Settings" deep link → grant → recording works without an app restart.
- [ ] **Large library** (restore a big backup): scrolling stays smooth, the full player opens quickly, cold start under ~4s.
- [ ] General feel after the rebuild — if navigation/opening a clip still feels laggy, tell me (no code regression was found, so the next step would be on-device profiling).

---

### If something's wrong

For anything that fails, note the screen + what you saw and hand it back — most of the tunable bits (haptic intensities, the zoom floor, the beat-cue punch, timings) are single named constants, and logic bugs I can reproduce from a clear description.
