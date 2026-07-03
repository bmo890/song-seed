# Song Seed — Metronome/Recording Timing: Handoff Brief

**Purpose of this doc:** hand this project to a *local* Claude Code session (one that can
run `adb logcat`, do native builds, and iterate on-device without round-tripping logs).
It assumes **zero prior context**. Read it top to bottom once, then jump to
**§6 (the active bug)** — that's the live task.

Date of handoff: 2026-07-03. Branch: `claude/metronome-consistency-audit-dqnvk8`.

---

## 1. TL;DR — where we are this minute

- A large timing-system overhaul (Phases 1–6 + Stages A–E + 4 recent UX features) is
  **built, committed, and pushed** on the branch above. `tsc` + 235 Jest tests green.
- The app **works on device today**: recorded takes trim to the musical downbeat using a
  **JS estimator** for capture-start (±15–25 ms). Device logs show clean trims
  (e.g. `no-count-in head trim: 88ms (target=pulse0, captureStart=measured)`).
- **The former active bug is FIXED in code (commit `673833f`), pending device verify.**
  The native patch emitted `captureStartTimeEpochMs`, but `@siteed/audio-studio`'s
  **compiled JS layer dropped it** (Metro loads `build/`, not `src/`). The patch now also
  forwards the field through `build/cjs` + `build/esm` `useAudioRecorder.js`. Until this is
  confirmed on device, the estimator fallback keeps everything working — this was a
  **precision upgrade, not a breakage**. See §6 for the full write-up.
- **What we're looking for on device:** the log line
  `[timing] captureStart native=… (audio-timestamp) estimatorDelta=…ms`.
  It should now appear after a clean patch-apply + native rebuild (see §3.3 / §6). If it
  still doesn't, the native half isn't compiled in — grep the `.kt` (§6 condition A).

---

## 2. The project & the goal

Song Seed (`bmo890/song-seed`) is a React Native / Expo music-sketching app (NOT a full
DAW). The owner wants a **trustworthy, consistent metronome + recording timing system**:
count-in that isn't a gamble, overdubs that line up with the master by construction, and
tempo metadata saved with clips so a take is shareable at the same BPM. "Trustworthy
recording and time system" is the north star — precision and honesty over features.

Owner's device for testing: **Samsung SM-S921U1 (Android)**, often with **AirPods Pro
(Bluetooth)**. iOS must be kept at parity (this is React Native — every native change is
Kotlin **and** Swift).

---

## 3. Hard constraints — read before touching anything

1. **Branch discipline.** All work goes to `claude/metronome-consistency-audit-dqnvk8`.
   **Do NOT push to or merge into `main`** until the owner explicitly says "done." This is
   a standing instruction from the owner.
2. **Native builds are real builds.** JS changes hot-reload via Metro. **Native (Kotlin/
   Swift) changes — including anything under `patches/` that touches native code — require
   a full rebuild:** `npm run android` (which runs `scripts/android-dev.sh`) or
   `npm run ios`. A "Bundled 1000ms" line is a JS reload and will NOT pick up native or
   patch changes.
3. **patch-package gotcha (this bit us — see §6).** Patches under `patches/` only reach
   `node_modules` when `patch-package` runs. That happens on `npm install` (postinstall),
   **but NOT on a bare `git pull` + `npm run android`.** If you pull new patches, run
   `npx patch-package` (or `npm install`) before building, or Gradle compiles the
   **unpatched** source.
4. **Commit convention.** Messages end with a `Co-Authored-By: Claude …` line and a
   `Claude-Session: …` line (match existing commits via `git log`). Keep committer email
   `noreply@anthropic.com`. Never put model IDs in commits/PRs/code.
5. **Two capture stacks, on purpose.** We OWN the timed-take path (count-in, trims, grid)
   and RENT quick-record from `@siteed/audio-studio`. We patch siteed rather than replace
   it (replacement = deferred Phase 7 / Stage E, deliberately not done).

---

## 4. The mental model (essential — everything below depends on it)

- **Render domain vs audible domain.** The metronome engine's grid and the guide player's
  positions live in the *render* domain (when the app *emits* audio). The performer hears
  it later by the route's **output latency**, plays to what they *perceive*, and the mic
  stamps that another **input latency** later. Alignment must reference the *perceived*
  beat, not the render clock.
- **Two output pipelines, different latencies.** The metronome **click** rides a raw audio
  track (~108 ms on the owner's speaker, ~200 ms over BT). The **guide/master** rides the
  ExoPlayer media pipeline (~370–500 ms over BT). They are calibrated and compensated
  **separately** (`outputMs` vs `guidePlayerOutputMs`, `guideStartAdvanceMs`).
- **Record-through + measured trim.** For timed takes, capture starts BEFORE the count-in.
  We never guess where the downbeat is — we *measure* it (grid anchor + guide start) and
  trim the head at save (`trimAudioRanges`). "Never trim on a guess" is a core rule: if a
  value is unknown, we commit head=0 and keep the pre-roll rather than cut wrong.
- **Grid anchor.** The native metronome exposes `getGridAnchor()` →
  `{ anchorEpochMs, msPerPulse, pulsesPerBar, isRunning, … }` (epoch of pulse 0).
  Count-in = pulses 0..N−1; downbeat = pulse N.
- **Latency model = single source of truth.** `src/services/latencyModel.ts` is the ONLY
  place latency numbers are resolved/combined. It merges OS-reported latency, BT ear
  calibration, per-connection BT drift, and the active cue "reference modality" (audible >
  haptic > visual — what the performer locks to) into one `RouteLatencyProfile`. Nothing
  outside that file may invent or combine latency numbers.
- **Capture-start estimator (the thing we're upgrading).** Today capture-start epoch is
  estimated in JS from the recorder's reported duration: `min(now − durationMs)` over the
  first ~50 events (delivery latency ≥ 0, so the min converges, biased ~15–20 ms late).
  Phase 5's native patch replaces this with an exact native timestamp; the estimator stays
  as fallback.

---

## 5. What's already built (all on the branch, all green)

**Phases (from `docs/metronome-timing-plan.md` — read its STATUS table for detail):**

- **Phase 1 — recordingGrid metadata.** `{ bpm, meterId, countInBars, clickThroughTake,
  firstDownbeatMs, … }` saved on `ClipVersion` + `ClipOverdubStem`, round-tripped through
  archive export/import in all fidelities, restored on overdub.
- **Phase 2 — Calibration sharpening.** Tap grid re-anchored to real playback start;
  `getCurrentAudioRouteLatencyMs` on both platforms; reported-latency seed in the
  calibration screen.
- **Phase 3 — Stem nudge UI.** Manual overdub alignment: superimposed master/stem
  waveforms, ±10/±25 ms nudges, beat-grid overlay, in-place audition (two pre-seeked
  players). Negative offsets supported in both native mixers.
- **Phase 4 — Engine hardening.** Live-vs-structural `configure()` split, `setClickVolume`,
  Bresenham pulse framing (sample-exact bars), `getGridAnchor()`, `currentOutputLatencyMs()`
  with Android buffer-strip, scheduled native haptics, beat-state snapshot delayed by
  output latency so count-in display lands with audio.
- **Phase 5 — Deterministic downbeat.** Record-through + measured trim shipped. Capture
  start intended to come from the **native recorder patch** (`patches/@siteed+audio-studio+3.0.2.patch`)
  — **this is the piece currently not reaching JS; see §6.** Estimator fallback active.
- **Phase 6 — Non-count-in measured alignment.** Same record-through discipline for takes
  without a count-in: overdubs trim to the guide's measured start, fresh click takes trim
  to pulse 0, record-over-a-running-preview stamps `firstDownbeatMs` instead of chopping.
  Recorder sleep-gating on BT compensation deleted everywhere except resume.

**Stages A–E (the "Part 2" cue-alignment work):**

- **A — Latency model** as single source of truth (`latencyModel.ts` + 18 tests).
- **B — Anchor-scheduled cues:** native haptics fired a beat ahead with signed offset;
  visual pulse on a JS scheduler seeded from the anchor; `supportsScheduledCues()` feature
  detection.
- **C — Calibration UX:** uncalibrated-BT / stale (30d) / BT-mic / route-changed warnings
  with a one-tap Calibrate path.
- **D — Silent-click trim correctness:** reference modality picks the correction source, so
  a haptic/visual-only take isn't given an audible-domain correction.
- **E — Full custom capture engine: DEFERRED** (this is essentially Phase 7).

**4 recent UX/behavior features (commit `079961e`):**

1. **No-count-in guide lock (cached latency + join-at-bar).** Module-level cache of the
   measured guide **resume** latency (stable within a session); a no-count-in click take
   schedules the guide at the earliest reachable bar line (implicit one-bar count-in),
   shorter lead once the cache is warm.
2. **Overdub inherits master metronome settings.** Opening an overdub/variation restores
   the master's **full** grid — bpm, meter, count-in bars, click-through — not just
   bpm/meter.
3. **Metronome button = on/off toggle** (active/inactive state on the chip) with a
   separate small **customize** button that opens the settings sheet. The on/off Switch was
   removed from the sheet header.
4. **Redo-take button.** A refresh button next to discard scraps the in-flight take
   (works during count-in/arming too), keeps the session + settings armed, restores the
   one-shot count-in from the take's grid snapshot, and lands back at Ready — no more
   delete→exit→reopen.

---

## 6. Native capture-start timestamp → JS  (FIXED in `673833f`, verify on device)

> **Status:** the JS-layer forward is now applied (commit `673833f`). This section is kept
> as the full diagnosis + the remaining verification. The waveform/count-in fix shipped in
> the same commit — see the note at the end.


### What is supposed to happen (data flow)

1. Native recorder measures the wall-clock epoch of the recording's **sample 0** and puts
   it on every audio-stream event as `captureStartTimeEpochMs` (+ `captureStartSource`).
2. `@siteed/audio-studio`'s JS layer forwards event fields to our `onAudioStream` callback.
3. Our `src/hooks/useRecording.ts` reads `event.captureStartTimeEpochMs`, prefers it over
   the estimator, and logs `[timing] captureStart native=… (source) estimatorDelta=…ms`.
4. The record screen's trim math uses `getCaptureStartEpochMs()` → exact head trim.

### What actually happens — CONFIRMED root cause

- **Step 1 (native) is CORRECT.** Our patch emits the field:
  - Android: `node_modules/@siteed/audio-studio/android/.../AudioRecorderManager.kt:1769`
    → `baseBundle.putLong("captureStartTimeEpochMs", captureStartMs)`
    (value from `resolveCaptureStartEpochMs()`, which projects
    `AudioRecord.getTimestamp(TIMEBASE_MONOTONIC)` back to frame 0, with the
    `startRecording()` wall clock as fallback).
  - iOS: `ios/AudioStudioModule.swift:970` sets `resultDict["captureStartTimeEpochMs"]`
    from `AudioStreamManager.captureStartTimeEpochMs` (projected from the first tap
    buffer's `AVAudioTime` host time).
- **Step 2 (siteed JS) DROPPED THE FIELD — this was the bug, now patched.**
  `handleAudioEvent()` rebuilds the `onAudioStream` event from a **fixed** field list and
  didn't include `captureStartTimeEpochMs`. The patch now destructures and forwards
  `captureStartTimeEpochMs` + `captureStartSource` in both the float32 and encoded branches
  of both compiled builds (`build/cjs` + `build/esm` `useAudioRecorder.js`), plus `src/`
  and the event types for consistency. Verify it's still present after any reinstall:
  `grep -c captureStartTimeEpochMs node_modules/@siteed/audio-studio/build/esm/useAudioRecorder.js`
  (expect `3`).
- **CRITICAL: Metro bundles the COMPILED build, not `src/`.** `package.json` of the
  package: `main: ./build/cjs/index.js`, `module: ./build/esm/index.js` (no `react-native`/
  `source` field). So patching `src/useAudioRecorder.tsx` does **nothing at runtime** — the
  fix must edit the **built** files:
  - `node_modules/@siteed/audio-studio/build/cjs/useAudioRecorder.js`
  - `node_modules/@siteed/audio-studio/build/esm/useAudioRecorder.js`
  (Confirmed: `grep -rn captureStart build/` returns nothing today.)
- **Step 3 (our code) is CORRECT** and already in place:
  `src/hooks/useRecording.ts:444–456` reads `(event as any).captureStartTimeEpochMs`, and
  `getCaptureStartEpochMs()` (line ~131) prefers native → estimator → start stamp.

### Two independent conditions to actually see the native log

- **(A) Native binary contains the patch.** Requires the patch applied to `node_modules`
  **before** Gradle compiled, AND that Gradle recompiled the siteed module. Verify on the
  **owner's machine** (not this container):
  ```
  grep -c captureStartTimeEpochMs node_modules/@siteed/audio-studio/android/src/main/java/net/siteed/audiostudio/AudioRecorderManager.kt
  ```
  `1` = on disk; `0` = never applied → run `npx patch-package`, then rebuild.
- **(B) JS layer forwards the field.** Requires the `build/*.js` edit above + a Metro
  reload. This is currently **broken** (the field is dropped). **This is the fix to make.**

Both A and B must be true. The estimator fallback is why takes still trim correctly today.

### The fix (DONE in `673833f` — steps kept for verification/redo)

1. ✅ Both `build/cjs/useAudioRecorder.js` and `build/esm/useAudioRecorder.js` now
   destructure `captureStartTimeEpochMs` + `captureStartSource` and forward them in the
   `pcmFloat32` and `encoded` branches. `src/` + event types mirrored.
2. ✅ Patch regenerated: `patches/@siteed+audio-studio+3.0.2.patch` now diffs 8 files
   (2 native Kotlin/Swift-emit, 2 iOS, 2 build JS, 2 src/types).
3. **To verify on device:** ensure the patch is applied on disk, then rebuild:
   ```
   npx patch-package        # apply patches/ to node_modules (if not already)
   npm run android          # real native rebuild (Metro reload alone won't recompile .kt)
   ```
   grep condition (A): `grep -c captureStartTimeEpochMs …/AudioRecorderManager.kt` → `1`.
4. Record ONE take, watch for:
   ```
   [timing] captureStart native=<epoch> (audio-timestamp) estimatorDelta=<n>ms
   ```
   - `source=audio-timestamp` (Android HAL) / `host-time` (iOS) = real measurement.
   - `source=start-call` / `wall-clock` = fallback fired (HAL silent — coarser but OK).
   - `estimatorDelta` within ~±20 ms = native and the old estimator agree (sanity pass).

### Also fixed in `673833f`: live waveform showed the count-in

Capture rolls through the count-in (record-through), so the **live tape** was drawing the
silent pre-roll that the saved file trims off — the on-screen waveform didn't match the
trimmed audio. Fix: `useRecording.ts` suppresses live-tape appends while the head is
`pending`, and realigns the tape to the musical start in `commitHeadTrim` (also resets it).
The saved-waveform head-drop now uses the analysis's own `segmentDurationMs` (not an assumed
constant) so kept peaks line up exactly with the trimmed audio. **Verify:** record a
count-in take; during the count-in the live tape stays empty; after the downbeat it starts
at the musical start; the saved clip's waveform matches its (trimmed) audio on playback.

---

## 7. Diagnostics & log-monitoring workflow

- **On-device logs (owner uses a Mac, Samsung over USB, `adb devices` shows RFCWC0JKSMD).**
  In zsh, quote the wildcard:
  ```
  adb logcat -c                                   # clear buffer before each take
  adb logcat '*:S' ReactNativeJS:V | grep --line-buffered "\[timing\]"
  ```
  Or save per-take: `adb logcat -c && adb logcat '*:S' ReactNativeJS:V > take1.log`.
  The Metro terminal also mirrors these `console.log` lines live (no adb needed) but
  doesn't clear between takes.
- **Is the native patch on disk?** `grep -c captureStartTimeEpochMs …/AudioRecorderManager.kt`
- **Does the built JS forward it yet?** `grep -rn captureStart node_modules/@siteed/audio-studio/build`
  (empty = not fixed).

---

## 8. Git state at handoff

- **HEAD = `079961e`**, working tree **clean**, branch **pushed** and up to date with
  origin. All Phase 1–6 + Stage A–E + the 4 UX features are safely on the branch.
- There is a **dangling commit `db2299f`** ("Apply patch-package before native dev builds")
  that is **NOT in HEAD history and NOT pushed.** It contained two small convenience edits
  (add `npx patch-package` to `scripts/android-dev.sh`; prepend `patch-package &&` to the
  `ios` npm script). Those edits are **not currently in the working tree.** They're
  optional insurance against the §3.3 gotcha — **recommended to re-apply** (cheap, prevents
  exactly the confusion that cost us this session), but the owner pushed back on the
  original framing, so treat as optional and confirm before committing.
- Recent commit trail for orientation:
  `079961e` (4 UX features) · `0d03eb0` (Phase 6) · `da315f2` (teardown warning) ·
  `c9b312d` (Phase 5 native patch) · `bc04b83` (BT drift) · `644138d` (pipeline split).

---

## 9. Remaining / future work

- **Finish §6** (the active task) — get the native timestamp flowing, verify on device.
- **BT drift device verification** (parked "calibration tweak"). One fresh calibration to
  arm `osOutputAtCalibrationMs`, then disconnect/reconnect AirPods and record; expect a
  small nonzero `btDrift=…ms` in the `latency profile` log, proving the per-connection
  drift correction engages instead of no-oping.
- **Punch-in / spot overdubs (next big feature, designed but not built).** Goal: scrub to,
  say, 1:23 of the master, record a 2-second harmony (metronome optional, count-in
  optional), and have it sit **only at that time point** as a stem, not as a full-length
  overdub. The architecture already supports it: capture-start + measured guide-start work
  the same whether the guide starts at 0:00 or mid-song, and the native mixers already
  place stems at an offset. What's missing: (a) UI to arm a punch point from the player,
  (b) raise the stem `offsetMs` clamp (currently ±2 s, designed for nudging) to allow
  arbitrary in-song positions, (c) save path writes the measured punch position as the
  stem offset. Optional stretch: a click that starts in phase with an already-playing
  master needs the native engine to start at a *scheduled* instant (small Kotlin/Swift
  add; Phase 1 tempo grid gives the beat math at 1:23).
- **Deferred by decision:** Phase 7 / Stage E (own capture engine), Reanimated visual-pulse
  worklet, speaker loopback auto-calibration. Don't start these without an explicit ask.
- **Minor:** the `[timing] cue profile @start` line sometimes logs twice (likely a dev
  double-effect, not a real double-start) — only chase if audible.

---

## 10. Device verification checklist (condensed)

Run on **speaker** and on **Bluetooth** where noted. Look for the `[timing]` lines.

1. **Setup:** `npm run android` (real native rebuild after any patch change), adb logcat
   filtered on `[timing]`.
2. **Native timestamp (§6):** any take → expect `captureStart native=… estimatorDelta=…`.
3. **Solo takes:** count-in+click; no-count-in+click (`target=pulse0`); no metronome;
   record-over-preview (`preview take: first bar line stamped …`, take not chopped). Every
   head-trim log should read `captureStart=measured`, never `MISSING`.
4. **Inheritance:** open an overdub → metronome preloads master bpm/meter/count-in/click.
5. **Overdubs (the owner's core case — must "sit together" live):**
   - master+met / overdub+met **with** count-in → `guide phase vs metronome grid: <small>ms`.
   - master+met / overdub+met **without** count-in → `no-count-in guide lock: joining at
     the bar line …`; 2nd take in session locks faster (warm cache).
   - master+met / overdub **without** met → `no-count-in overdub head trim: … (guideStart=
     measured, captureStart=measured)`.
   After saving, the overdub's alignment offset should sit at/near 0 with no nudging.
6. **Redo:** mid-take and mid-count-in → lands at Ready, settings + count-in re-armed.
7. **Metronome button:** chip toggles on/off; customize button opens sheet (no Switch in
   sheet); chip disabled mid-record.
8. **BT drift:** fresh calibration → reconnect → record → `btDrift=…ms` nonzero small.

---

## 11. Key files

- `docs/metronome-timing-plan.md` — phased plan + STATUS table (source of truth for scope).
- `docs/metronome-timing-audit.md` — original findings F1–F15.
- `src/services/latencyModel.ts` (+ `__tests__/latencyModel.test.ts`) — all latency math.
- `src/hooks/useRecording.ts` — capture, head-trim state, `getCaptureStartEpochMs()`,
  `onAudioStream` (native-timestamp read at ~444–456).
- `src/components/RecordingScreen/hooks/useRecordingScreenModel.ts` — the orchestration
  brain: count-in path, guide phase-lock (`schedulePhaseLockedGuideStart`,
  `sessionGuideResumeLatencyMs` cache), no-count-in paths, head-trim commit, grid
  inheritance, `redoTake`, timing warnings.
- `src/components/RecordingScreen/{RecordingControls,RecordingMeta,RecordingMetronomeSheet,
  RecordingBottomDock,RecordingBody,index}.tsx` — the UI (redo button, metronome
  toggle/customize split).
- `modules/songseed-metronome/{ios,android}` — native engine: `getGridAnchor()`,
  scheduled cues, `currentOutputLatencyMs()`, `supportsScheduledCues()`.
- `patches/@siteed+audio-studio+3.0.2.patch` — the native capture-timestamp patch
  (**to be extended with the build/*.js forward — §6**).
- `scripts/android-dev.sh` — the Android build/install/launch script.

---

## 12. `[timing]` log glossary (expected values on the owner's device)

- `cue profile @start: route=speaker/SM-S921U1 out=109ms(os) visualLead=59ms hapticLead=49ms`
  — metronome start; `out` = click output latency (speaker ~108–109 ms).
- `latency profile: click=108ms(os) player=108ms guideAdvance=0ms in=0ms(unknown) ref=audible
  → correction 108ms` — resolved profile. Speaker: click==player, no guide advance.
  `in=0ms(unknown)` is EXPECTED on Android (no reliable input-latency API; ~20–40 ms
  uncorrected residual). Over BT expect `click`/`player` to diverge and `guideAdvance>0`.
- `head trim committed: <n>ms (captureStart=measured, anchor=measured)` — count-in take
  trim. `measured` = value present (note: today that's the ESTIMATOR; "measured" does not
  by itself prove the native path — the `captureStart native=` line is the proof).
- `no-count-in head trim: <n>ms (target=pulse0, captureStart=measured)` — Phase 6 path.
- `guide start latency: cold=<n>ms resume=<n>ms` — measured guide player warm-up.
- `guide phase vs metronome grid: <n>ms (+ = guide late)` — overdub live lock quality;
  small = good (owner has seen −6…−37 ms).
- `captureStart native=<epoch> (<source>) estimatorDelta=<n>ms` — **the line we're chasing.**
  Absent today. `source` ∈ {audio-timestamp, host-time (good) | start-call, wall-clock
  (fallback)}.
