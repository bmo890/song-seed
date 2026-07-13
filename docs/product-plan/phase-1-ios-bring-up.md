# Phase 1 — iOS Bring-Up

**Effort:** ~1 week with hardware in hand · **Dependencies:** a Mac with Xcode, a physical iPhone (audio work cannot be validated in the simulator), an Apple Developer account · **Blocks:** Phase 5 (submission)

## Purpose

Song Seed has **never been built or run on iOS**. All development and testing to date happened on Android. The codebase was written with iOS in mind — platform forks exist and read correctly — but every one of them is unverified speculation until this phase. The goal: a TestFlight build where every core flow works on a real iPhone.

## Background you need

- **Recording** uses `@siteed/audio-studio` v3.0.2. The repo patches it (`patches/@siteed+audio-studio+3.0.2.patch`, 25 hunks) but **every hunk touches Android Kotlin** — iOS runs the stock library, completely unexercised.
- **Three custom Expo native modules** in `modules/`:
  - `songseed-metronome` — has iOS Swift (`SongseedMetronomeEngine.swift`, module + podspec). Drives count-in and practice click via `src/hooks/useMetronome.ts`.
  - `songseed-pitch-shift` — has iOS Swift (renderer + practice engine + podspec). Drives pitch/speed practice playback (`src/hooks/useNativePitchTransport.ts`) **and** waveform decoding (`computeWaveform` called from `src/services/waveformAnalysis.ts`, with `@siteed extractPreview` as automatic fallback — so a broken decoder degrades to slower waveforms, not crashes).
  - `songseed-file-io` — **Android-only by design** (`expo-module.config.json` declares `platforms: ["android"]`). It streams backups to Android SAF content URIs. iOS intentionally takes a different path: `src/services/archiveSave.ts` forks on `Platform.OS === "android"`; the non-Android path shares/exports via the system share sheet. **Do not try to port this module to iOS.**
- **Patches beyond siteed:** `expo-file-system` (Android Kotlin — irrelevant to iOS), `react-native-pitchy` (Android CMake — irrelevant), and `xcode+3.0.1.patch` (patches the Node `xcode` lib used at **prebuild time** — evidence someone already hit iOS build friction once; expect prebuild to need attention).
- **Share extension:** `expo-share-intent` config in `app.json` creates an iOS share extension target ("Song Seed Import", max 20 files, audio). Separate bundle ID + App Group + provisioning profile. EAS (Phase 0.7) manages the credentials.
- **Audio session config** is centralized in `src/services/audioSession.ts` — three roles (playback/recording/metronome) with queued, priority-arbitrated `setAudioModeAsync` calls. `playsInSilentMode: true` everywhere (correct for a music app). Background audio + processing modes are enabled via the siteed plugin config in `app.json`.
- Known iOS-aware code (verify each): `src/services/latencyModel.ts` (iOS haptic latency constant 35ms vs 60), `src/hooks/useRecording.ts` (notification permission is Android-only — iOS returns true), `src/hooks/useFullPlayer.ts` (Android foreground-service error swallow), `src/hooks/useMetronome.ts` (iOS uses expo-haptics tiers instead of `Vibration.vibrate` durations), `src/services/audioStorage.ts` (share path), `src/hooks/useBrowseRootBackHandler.ts` (Android back button — iOS no-op).

## Work items

### 1.1 First build

Get `npx expo run:ios --device` (dev variant) compiling and launching. Expect friction: CocoaPods install for the three local podspecs + patched deps, the `xcode` lib patch, New Architecture (`newArchEnabled: true`) with RN 0.81. Fix build issues as they come; document each fix in this file's changelog section. Then produce a production-variant build via `eas build --platform ios` to validate signing including the share extension target.

**Acceptance:** app launches on a physical iPhone in both dev and production variants.

### 1.2 Recording end-to-end

The heart of the app, entirely stock-library on iOS. Test matrix:

- First-run mic permission: prompt appears with the copy from `NSMicrophoneUsageDescription`; denial path shows the app's guidance and `Linking.openSettings()` deep-link works (`useRecording.ts` handles this — verify the dialog is styled, not raw).
- Record → save → clip appears with waveform; auto-name flow (`promptForClipName=false`) and named flow both work.
- **Background recording:** start recording, lock the screen, wait 2+ minutes, return — recording continued, file intact. (Plugin sets `UIBackgroundModes` audio; verify actually functioning.)
- **Interruption:** receive a phone call / trigger Siri mid-recording → app handles gracefully per `useRecording`'s interruption bookkeeping (head-trim/`interruptionToken` logic); no crash, user informed.
- Crash recovery: force-kill the app mid-recording; on relaunch the "Recovered recording" flow (`src/services/recordingRecovery.ts`) restores the take.
- Inputs: built-in mic, wired, **Bluetooth** (AirPods). BT monitoring calibration screen (`BluetoothCalibrationScreen`) — run it on iOS; the latency model was tuned on Android and iOS BT profiles differ. Recalibrate constants if measurements are consistently off.
- Overdub recording along an existing clip: alignment sanity check (record a clap over a click track, inspect offset).

### 1.3 Playback & transport

- Full player (PlayerSheet), mini dock, inline players: play/pause/seek/scrub.
- **Lock-screen / Control Center controls** (`useFullPlayer.ts` `showLockScreenControls`): artwork/title/seek buttons appear and work; controls clear when playback stops.
- **Silent switch:** playback audible with the ringer switch muted (`playsInSilentMode: true` — verify).
- **Route changes:** unplug wired headphones mid-play (iOS convention: playback should pause — observe what expo-audio does and decide); AirPods connect/disconnect.
- Interruption: phone call mid-playback → pauses; resumes or stays paused sanely after.
- Playback rate + pitch-corrected speed changes in the practice panel (expo-audio `shouldCorrectPitch` behavior differs by platform — listen for artifacts).
- Waveform generation on iOS: open imported clips, watch `[waveform]` logs — confirm `decoder=native` (the Swift decoder working) rather than permanent fallback; confirm no play-then-stall (the Android MediaCodec contention fix defers generation during playback — iOS shares the code path, verify no equivalent stall).

### 1.4 Metronome & pitch-shift modules

- Metronome: audible click at correct BPM, stable over 5 minutes (drift test against a reference metronome), count-in bars fire correctly in the recording flow, haptic tiers feel distinct (iOS path uses `Haptics.notificationAsync`/`impactAsync` tiers — see `useMetronome.ts`), visual pulse synced.
- Pitch shift: practice playback at ±semitones and speed changes; A/B against Android for artifact parity; `isPitchPreviewAvailable` reports true (i.e., the module loaded).

### 1.5 Share extension & file flows

- From Voice Memos / Files: Share → "Song Seed Import" appears, multi-file audio import lands in the in-app import flow with progress banner and duplicate review.
- Backup round trip: Settings → export a full backup → save to Files/iCloud via the share path → delete + reinstall app (or clear state) → restore from that file. **This is the data-safety story; it must round-trip losslessly.** Merge-restore and salvage-restore paths too if time allows (tests cover logic; this validates iOS file plumbing).
- Workspace archive + offload to Files, then re-import.
- Document/audio import via the in-app picker (`expo-document-picker`).

### 1.6 iOS-specific UI pass

- Safe areas: notch/Dynamic Island overlap on every screen (the app uses `react-native-safe-area-context` — spot-check PlayerSheet, RecordingScreen, drawers, bottom sheets, the media dock).
- Keyboard: iOS keyboard vs the 7 `KeyboardAvoidingView` usages — name inputs, lyrics editor, notes.
- Gestures: the drawer + PlayerSheet pan vs iOS edge-swipe-back conflicts (native-stack screens have `headerShown: false` — check swipe-back still works where expected and doesn't fight the reel/scrubber gestures).
- Set `supportsTablet: false` in `app.json` unless someone commits to iPad QA — currently `true`, which puts un-QA'd iPad layouts in review scope. **Recommend false for v1.**
- Status bar rendering on the ~10 screens that set it and spot-check ones that don't (Phase 2 owns the full sweep).

### 1.7 TestFlight

Upload via EAS Submit; distribute to internal testers; confirm the build passes App Store Connect processing (this catches Info.plist issues early — e.g. the export-compliance key from Phase 0.6 and any missing usage descriptions surfaced by static analysis).

## Verification checklist

- [ ] All 1.2–1.5 flows pass on a physical iPhone (keep a written pass/fail log per flow — that log is the phase deliverable alongside fixes)
- [ ] No regressions on Android after any cross-platform fix (`npx jest`, spot-check on Android device)
- [ ] TestFlight build installable by a second person

## Out of scope

Porting `songseed-file-io` to iOS (deliberate non-goal); iPad optimization; visual polish (Phases 2–3).

## Changelog (fill in as you fix things)

- **2026-07-13 — First iOS build compiles (simulator).** The app had never been
  built on iOS; fixed three things to get a clean `xcodebuild` (Debug, iphonesimulator):
  1. **Stale `@siteed` package reference** — the prebuilt `ios/` referenced the audio
     library's old name `@siteed/expo-audio-studio`; it's since been renamed to
     `@siteed/audio-studio`, so the Pods project pointed at 18 Swift files that no
     longer existed there. Fixed by `expo prebuild --clean -p ios` (regenerates the
     whole native project from config; `ios/` is gitignored so nothing was lost). The
     regen also renamed the workspace/scheme to `SongsteadDev` (dev variant of the
     renamed app) and recreated the share extension as `SongsteadImport`.
  2. **Pitch-shift podspec source glob was wrong** — `modules/songseed-pitch-shift/ios/SongseedPitchShift.podspec`
     had `s.source_files = 'ios/**/*.{…}'`, but the podspec already lives *in* `ios/`,
     so it looked for a non-existent `ios/ios/` and matched **zero** Swift files → the
     module never built → downstream `no such module 'SongseedPitchShift'`. Fixed the
     glob to `'**/*.{…}'` and added `DEFINES_MODULE => YES` (matching the working
     `songseed-metronome` podspec). This bug was invisible until now because iOS was
     never built. (This is a real source fix, committed.)
  3. Set `ios.supportsTablet: false` (Phase 1.6 recommendation — keep un-QA'd iPad
     layouts out of App Review scope for v1).
  - **Result:** `** BUILD SUCCEEDED **` — AudioStudio pod, both custom Swift modules
    (metronome + pitch-shift, including the new `getAudioDurationMs`), and the app all
    compile; `SongsteadDev.app` produced. NOT yet run on a device (needs the owner's
    iPhone + Apple account for on-device signing); simulator can't validate audio.
  - **To run on your iPhone:** plug it in + trust the Mac, then `npx expo run:ios --device`
    (dev variant). Xcode will ask for your Apple Developer team for signing.
