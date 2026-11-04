# SongNook timing audit: every clock boundary, recording and playback

Read-only code audit, 2026-10-30, `main` at `c2a3c08f`. Nothing in the app was changed.

**The question.** The founder records a clip with the metronome on the phone speaker (no
headphones), so the mic picks up the click. On playback with the play-along click on, the
recorded click and the play-along click do not sit together. The offset is small but audible,
on Android at least. This document maps every place where time crosses from one clock to
another, marks each as measured or assumed, and ranks the likely causes. Haptic and visual
alignment get their own section (§7).

**Labels used below**
- **MEASURED**: a number from a doc or harness run in this repo (with the source).
- **CODE**: what the code does, read directly (file:line).
- **INFERRED**: expected size from platform behaviour. Plausible, but not measured here.
- **ASSUMED**: a constant the app uses with no measurement behind it.

Line numbers are for `main` at `c2a3c08f`.

---

## 0. Summary

1. **The recording side has a ground-truth check and the playback side has none.** After every
   click take, the saved grid is shifted onto the clicks the mic recorded
   (onset-envelope self-alignment). That step runs on Android too: the Float32 PCM stream is
   delivered there. With speaker bleed, the saved grid should match the recorded clicks to
   within about 1 to 6 ms. The exception is Android's AAC priming (item 3). The playback
   click has no equivalent check. It lines up start events and React-committed positions,
   not clocks.
2. **Code defect (certain, both platforms).** The playback click reads the playhead from a
   React-committed value (`playerPositionMsRef = effectivePlayerPosition`). That value only
   commits when the displayed second changes, so it is up to about 1 s stale. The 10 s drift
   check compares the engine to this stale position. If the gap is over 35 ms it restarts the
   click at the stale position's phase. With staleness spread evenly over 0 to 1000 ms, about
   96% of drift checks should trigger a resync to a wrong phase.
   (`usePlaybackClick.ts:361-388`, `PlayerScreen/index.tsx:597-598,624`,
   `useThrottledAudioPlayerStatus.ts:46-81`.)
3. **Android-only suspect (unverified, could be exactly the founder's offset).** Android takes
   are head-trimmed and re-encoded to AAC by media3 Transformer
   (`SongNookPitchShiftRenderer.kt:213-223,347-382`). Nobody has checked that the m4a carries
   an edit list for the encoder priming (about 1024 to 2112 samples, roughly 23 to 48 ms). If
   it does not, ExoPlayer plays the priming. Every recorded click is then heard about 23 to
   48 ms later than the grid the play-along click follows. The grid itself is right, because
   self-alignment measured it on the pre-encode PCM. The repo's own harness would hide this
   on a Mac: `grid-truth.py` decodes with `afconvert`, which strips priming the Apple way.
4. **Design gap (certain, size unmeasured).** The play-along click starts from a position read
   before several async bridge calls, and nothing compensates for that delay. It runs in the
   engine's render domain, while ExoPlayer's position is its presentation estimate. The comment
   "Click and song share the output route — both delayed equally"
   (`usePlaybackClick.ts:220-222`) is contradicted by the latency model's own note that the
   media-player path and the click path differ (`latencyModel.ts:35-37`, about 500 ms vs about
   200 ms measured on Samsung + AirPods). The drift check cannot see this offset even with a
   fresh position, and it tolerates 35 ms anyway.
5. **"The haptic always lags".** There are systematic, always-late terms in the code:
   - Each beat's haptic is timed from the moment the 8 ms poll noticed the previous beat, not
     from that beat's computed time.
   - iOS fires a fresh, never-`prepare()`d `UIImpactFeedbackGenerator` on the main (UI)
     queue.
   - The motor constants (35 ms iOS, 60 ms Android) are guesses.
   - iOS very likely suppresses haptics during recording outright:
     `setAllowHapticsAndSystemSoundsDuringRecording` is never set.

   Visual cues on the Metronome page and in the recorder actually ride the late event path,
   not the anchor scheduler. So visual and haptic come from different pipelines. See §7.

---

## 1. Clock inventory

| Clock | Where | Notes |
|---|---|---|
| **Wall / epoch ms**: `System.currentTimeMillis()` (Android), `Date()` (iOS), JS `Date.now()` | Grid anchors, capture start, every JS scheduling decision | All bridging between domains goes through this clock. NTP can step it (rare; a step during a take would break every epoch difference). |
| **Monotonic**: `System.nanoTime` / `SystemClock.elapsedRealtime` (Android), `ProcessInfo.systemUptime` / `mach_absolute_time` host time (iOS) | Android capture timestamp, engine silent-run clocks, handler `postDelayed` (uptimeMillis), iOS `asyncAfter` | Bridged to epoch at a single instant (error under 1 ms unless preempted between the two reads). |
| **Click render clock**: Android `AudioTrack.playbackHeadPosition` (frames the server mixer consumed); iOS `AVAudioPlayerNode.lastRenderTime → playerTime.sampleTime` (last render cycle) | Native metronome: beat detection, `getGridAnchor()` | **Render domain**: leads the speaker by the click path's output latency. Neither engine uses `AudioTrack.getTimestamp` or `AVAudioTime.hostTime` (CODE, Android `SongNookMetronomeEngine.kt:787-799,985-1034`; iOS `SongNookMetronomeEngine.swift:562-618,713-749`). |
| **Capture clock**: Android `AudioRecord.getTimestamp(TIMEBASE_MONOTONIC)` projected to frame 0; iOS first tap buffer's `AVAudioTime.hostTime` | Recorder `captureStartTimeEpochMs` | Patched into @siteed (`patches/@siteed+audio-studio+3.0.2.patch`; Android `AudioRecorderManager.kt:1690-1723`; iOS `AudioStreamManager.swift:741-755`). |
| **Capture sample clock**: frames counted into the onset envelope and the WAV | Self-alignment, head trim | The envelope assumes the PCM stream is gap-free and identical to the WAV from frame 0. |
| **File clock (file ms)**: the saved m4a/wav as a decoder presents it | Grid (`firstDownbeatMs`), reel, playback | Depends on how the decoder treats AAC priming / edit lists (iOS strips; ExoPlayer honours `elst`/gapless metadata only). |
| **Player position clock**: expo-audio (ExoPlayer on Android, AVPlayer on iOS) `currentTime`; practice engine (ExoPlayer+Sonic on Android; AVAudioEngine `lastRenderTime` on iOS) | `getPositionMs` for the playback click | Raw status every 50 ms (`useFullPlayer.ts:176`), but **React only commits it once per displayed second** (`useThrottledAudioPlayerStatus.ts:46-81`; native transport `nativeStateCommit.ts:16-40`). The click reads the committed value. |
| **JS timer clock**: `setTimeout` | Visual scheduler, playback-click boundary timers | On Android, RN timers fire on Choreographer frame callbacks, adding 0 to about 16.7 ms (INFERRED from RN's JavaTimerManager design). |
| **Vibrator / Taptic** | Haptic cues | Android `Vibrator.vibrate(VibrationEffect.createOneShot)` (Binder → system_server → HAL); iOS `UIImpactFeedbackGenerator` on the main queue. |

---

## 2. Recording chain, boundary by boundary

Path: metronome engine renders a click (render clock) → speaker → air → mic → recorder
(capture clock) → JS (head trim, grid stamp, onset envelope) → trim/encode → saved file
(file clock) → self-alignment.

### R1. Click render → speaker (click path output latency)
- **What crosses:** the frame the engine counts as "played" vs when it leaves the speaker.
- **Clocks:** render clock → acoustic time.
- **How the app models it:** `outputMs` from `getCurrentAudioRouteLatencyMs`
  (`latencyModel.ts:129-229`).
  - **Android:** hidden `AudioTrack#getLatency()` minus the track's own buffer: a whole bar
    for the static loop, the min buffer for the probe track
    (`SongNookMetronomeEngine.kt:639-676`). This is AudioFlinger's nominal mixer/HAL latency.
    It does not include speaker-protection or smart-amp DSP unless the HAL folds it in.
  - **iOS:** `AVAudioSession.outputLatency` (`SongNookMetronomeModule.swift:126-140`). It does
    not include the IO buffer the render clock runs ahead by.
  - **Sanitizing:** values over 600 ms are bar-stripped once more or treated as unknown, and
    unknown resolves to 0 (`latencyModel.ts:95-112`).
- **Measured or assumed:** OS-reported, never checked against audio on a device. MEASURED
  facts nearby:
  - The simulator reports 0 while true round trip was about 75 ms (`grid-truth.md:87-92`).
  - "209 ms reported on a route whose real sink latency is 108 ms" on an Android probe
    (engine comment, `:646-649`).
  - Layers recorded over the speaker sat +30 ms late from "speaker → microphone path that the
    latency model could not see" (`RUN-LOG.md` 2026-10-22, iOS sim).
- **Expected error:** iOS speaker ±10 to 20 ms (IO buffer not counted). Android speaker
  ±10 to 50 ms (nominal afLatency vs true DSP chain), or the whole latency when hidden-API
  access is denied (0 = unknown). Bluetooth 100 to 300 ms without calibration.
- **Route differences:**
  - **Speaker:** OS number only.
  - **Wired:** OS number only; usually small and well reported.
  - **Bluetooth:** ear calibration wins outright when saved (`latencyModel.ts:149-181`).
- **Bug-shaped detail (Android):** while a **map run** is playing (multi-segment take), the
  live track is the stream track. But `currentOutputLatencyMs` strips `totalFrames` (the
  single-tempo loop's bar), not the stream buffer (`:650-652`). That is likely a wrong
  number or unknown during tempo-mapped takes.

### R2. Speaker → mic (acoustic)
- Under 1 ms at phone distances (INFERRED). Not modelled; negligible.

### R3. Mic → capture timestamp (input latency)
- **Clocks:** acoustic → capture clock → epoch.
- **Android:** `inputMs` is always 0. The Android module returns `outputMs` only
  (`SongNookMetronomeModule.kt:125-131`). **Confirmed.** Capture start comes from
  `AudioRecord.getTimestamp` projected back to frame 0, then bridged nanoTime→epoch at one
  instant. Up to 20 retries. Fallback is `"start-call"`, the wall clock at `startRecording()`
  (`AudioRecorderManager.kt:1010,1690-1723`). Per the API doc, the timestamp is "the earliest
  point available in the capture pipeline", so input latency is mostly inside it already, and
  `inputMs = 0` is consistent. **The fallback is not:** start-call precedes the first captured
  frame by the record start-up latency (INFERRED 20 to 200 ms). That makes captureStart too
  early and the cut too late, so the stamped grid lands late (line after the click) by that
  amount.
- **iOS:** first tap buffer `hostTime` projected to epoch (`AudioStreamManager.swift:741-755`),
  plus `session.inputLatency` added by the model (`latencyModel.ts:186-188,222`). Whether the
  tap's hostTime already reflects ADC time (making `inputMs` a double count) is unverified.
- **Measured or assumed:** the plan expected ±5 ms
  (`docs/metronome-timing-plan.md:27`, "Needs device verification"). Never verified on a
  device. The one-line check is the `[timing] captureStart native=… (source)
  estimatorDelta=…` log (`useRecording.ts:571-576`). The source tells you which path ran.

### R4. Grid anchor: render clock → epoch
- **CODE:** `anchorEpochMs = now − framesPlayed/sr`.
  - Android: `framesPlayed = loopCount·bar + playbackHeadPosition` (`:1015-1023`).
  - iOS: `lastRenderTime` sampleTime (`:596-608`).
  - Map mode is the same idea (`:992-1013`; iOS `:569-593`).
  - No hostTime is used on iOS, and no `AudioTrack.getTimestamp` on Android.
- **Expected error (INFERRED):**
  - **Android:** `playbackHeadPosition` advances in mixer-period steps (about 5 to 20 ms,
    more on deep-buffer outputs), so the anchor reads *late* by 0 to one period.
  - **iOS:** `lastRenderTime` is the last render cycle (0 to one IO buffer, about 5 to 23 ms
    old), and `Date()` is read later.
  - Both errors fold into the head trim, and self-alignment removes them when they reach 6 ms
    or more.
- **Rare race (CODE, both platforms):** `loopCount` is maintained only by the 8 ms poll
  (Android `:787-795`, iOS `:730-736`). A `getGridAnchor()` landing between a loop wrap and
  the next poll reads one bar too few frames, so the anchor is one bar late. The chance is
  about 8 ms per bar, roughly 0.3 to 0.5% per call. In a count-in take that cuts a whole bar
  of music off the head. Self-alignment works modulo a beat, so it cannot see it. It is
  harmless for the drift check and the visual scheduler (modular math).

### R5. Head trim: epoch arithmetic → capture sample index
- **CODE (count-in):**
  `headMs = downbeatEpoch − captureStartEpoch + recordingCorrectionMs − 15`, where
  `downbeatEpoch = anchor + countInPulses·msPerPulse` and
  `recordingCorrectionMs = outputMs + inputMs` for an audible reference
  (`useRecordingScreenModel.ts:1916-1990`; `latencyModel.ts:199-222`).
  The no-count-in path is the same with pulse 0 (`:2496-2516`). Record over a running preview
  stamps the next bar line instead of cutting (`:2529-2556`).
- **HEAD_TRIM_SAFETY_EARLY_MS = 15** (`:75`). The grid is stamped `firstDownbeatMs = 15` when
  a trim happened (`:349-363`). This was fixed after it measured as part of the 89.5 ms error
  (`grid-truth.md:87-92`).
- **Note:** this whole stamp is *expected* to be off by the R1 + R3 + R4 errors. It is a first
  guess that R6 corrects.
- **Trim floor:** trims under 24 ms are skipped (`useRecording.ts:84,990-1008`).

### R6. Self-alignment: capture samples → grid (the ground-truth step)
- **CODE:**
  - Every float32 delivery is folded into a 1 ms high-passed energy envelope
    (`useRecording.ts:554-556`; `onsetEnvelope.ts:105-136`).
  - At save, the head trim is dropped (`finishOnsetEnvelope`, `onsetEnvelope.ts:139-147`;
    `useRecording.ts:1082`).
  - The comb is run on the rising edge (`clickGridAlignment.ts`), and `firstDownbeatMs` is
    shifted (`gridSelfAlignment.ts:43-118`).
- **Gates:**

  | Gate | Value | Where |
  |---|---|---|
  | Minimum contrast | 1.35 (4 for short takes) | `:39`, `:80` |
  | Halves must agree within | 45 ms | `:60` |
  | Correction must be at least | max(6 ms, half a bin) | `:51-54` |
  | Correction must be at most | 0.45 beat | `:41` |

  Tempo-mapped takes are measured inside segment 1 only (`:247-262`).
- **Does it run on Android? Yes, by code.**
  - The recorder config requests `streamFormat: "float32"` (`useRecording.ts:499`).
  - Android's @siteed converts PCM16 to a `FloatArray` `pcmFloat32` (`AudioRecorderManager.kt:1780-1799`).
  - The patched JS wrapper normalizes it to `Float32Array` (`build/esm/useAudioRecorder.js:~218-221`),
    so `appendOnset` runs.
  - The audio source is `MediaRecorder.AudioSource.MIC` (`AudioRecorderManager.kt:676,855`),
    not VOICE_COMMUNICATION, so no echo cancellation removes the click bleed.
- **When it declines** (logged `[timing] click self-align: unchanged (<reason>)`): the take
  keeps the R5 stamp, with all of R1 + R3 + R4 in it. With speaker bleed and a click running
  through the take, contrast should be high: MEASURED 30.4 on a real take in
  `grid-truth.md:143-155`.
- **Accuracy:** MEASURED app vs harness agreement 0.4 ms on one iOS-sim take
  (`grid-truth.md:148-154`). Residual is under 6 ms by the floor. Signs to watch:
  - The comb locks onto the rising-edge bin, about 1 to 2 ms after the click's 3 ms attack
    starts (INFERRED). Both clicks share the waveform, so this mostly cancels.
  - The 6 ms floor leaves up to 6 ms uncorrected by design.
- **Assumptions that can break it (unverified on Android):**
  - (a) No PCM deliveries dropped. A gap would compress the envelope's time axis.
  - (b) Stream frame 0 = WAV frame 0.
  - (c) The trimmed and re-encoded file starts exactly at `headTrimmedMs` in that axis, with
    no codec priming added (see R7).

  Self-alignment cannot see (c): it measures the PCM, never the saved file.
- **Android device verification: none recorded.** `RUN-LOG.md` has only iOS-simulator grid
  truth (2026-07-30). The postmortem lists "Physical Android" as open (`reel-and-grid-postmortem.md:222-223`).

### R7. Trim + encode → saved file (file clock)
- **CODE:** `trimAudioRanges` prefers the native renderer (`audioTrim.ts:25-42`).
  - **Android:** media3 **Transformer 1.8.0**, `ClippingConfiguration.setStartPositionMs`,
    AAC 256 kbps m4a (`SongNookPitchShiftRenderer.kt:213-223,347-382`;
    `modules/songnook-pitch-shift/android/build.gradle:21-23`).
  - **iOS:** AVFoundation renderer.
- **Priming:**
  - **iOS:** the app's takes carry the edit list (MEASURED on the iOS simulator library,
    `layer-truth.md`; `RUN-LOG.md` 2026-10-22), and Apple decoders strip 2112 frames even
    without one.
  - **Android: unchecked.** It depends on whether Transformer's muxer writes an `elst` (or
    gapless metadata) for the AAC encoder delay, and on whether ExoPlayer applies it. If not,
    every played-back sample sits about 1024 to 2112 frames late (23 to 48 ms at 44.1 kHz)
    relative to the file-ms grid. The RUN-LOG already flags this as unknown for *imported*
    files: "Android unchecked: ExoPlayer may play such a file 48 ms later than iOS".
- **Clipping precision:** whether Transformer's clip start is sample-accurate for WAV input is
  unchecked (ms granularity at least).

### Recording-side summary per platform and route

| | Stamp (R5) depends on | Self-align (R6) | Net expectation for a speaker take |
|---|---|---|---|
| **Android, speaker** | afLatency estimate (or 0), AudioRecord timestamp (or start-call), head-step anchor | Runs; bleed strong | Grid ≈ recorded clicks in **PCM axis** (±6 ms). File-axis offset = AAC priming if no `elst` (unverified). |
| **Android, wired** | Same; no bleed into the mic | Declines (no click) | Stamp only: R1 + R3 + R4 errors, unmeasured |
| **Android, Bluetooth** | Ear calibration (tap-based, §5) | Declines (no bleed) | ±10 to 20 ms with a fresh calibration (`metronome-grid-and-transport.md:455-456`), else 100 ms+ |
| **iOS, speaker** | outputLatency + inputLatency + hostTime | Runs | ±6 ms; MEASURED only in the simulator |
| **iOS, wired / Bluetooth** | Same as Android rows | Declines | Same as Android rows |

---

## 3. Playback chain, boundary by boundary

Path: saved file → player (ExoPlayer via expo-audio, or the practice engine) → position report
→ React commit → `getPositionMs` → `clickEngineParamsAt` → async bridge calls →
`startAtPhase` (click render clock) → speaker. Drift check every 10 s.

### P1. File clock → player position
- **Android (expo-audio = ExoPlayer):** position is ExoPlayer's
  `DefaultAudioSink` estimate. It is derived from `AudioTrack.getTimestamp` once timestamps
  stabilise, and from head position minus `getLatency` before that. So it is a
  **presentation-domain** estimate (INFERRED from media3 design; not verified here).
- **iOS (AVPlayer):** presentation-compensated item time (INFERRED).
- **Practice engine (pitch/tone non-neutral, or sticky):**
  - **iOS:** `lastRenderTime`-based, render domain, measured before
    `AVAudioUnitTimePitch`, whose latency is not subtracted
    (`SongNookPitchShiftPracticeEngine.swift:310-323`).
  - **Android:** ExoPlayer + Sonic + a 5 ms look-ahead limiter
    (`SoundChainAudioProcessor.kt:323`) whose delay is not reported to the sink.
- **Priming:** see R7. Without an `elst`, Android position 0 = the first priming sample.
- **Measured:** nothing on speaker. On Bluetooth the latency model's comment records
  "~500 ms player vs ~200 ms click on Samsung + AirPods" (`latencyModel.ts:35-37`, from
  device logs via the tap calibration). So the two pipelines are **not** equally delayed
  relative to what each reports.

### P2. Player position → React → `getPositionMs` (staleness)
- **CODE:**
  - `getPositionMs: () => playerPositionMsRef.current` (`PlayerScreen/index.tsx:620-625`).
  - `playerPositionMsRef.current = effectivePlayerPosition` (`:597-598`).
  - `effectivePlayerPosition = practicePitchTransport.effectivePositionMs` (`:591-594`), which
    is `source.positionMs` (full player) or the committed native state
    (`useNativePitchTransport.ts:878`).
  - The full player's `playerPosition` is the throttled React status (`useFullPlayer.ts:226-256`).
    It commits on transitions, on jumps over 1.5 s, and otherwise **only when
    `floor(currentTime)` changes** (`useThrottledAudioPlayerStatus.ts:46-81`). The native
    transport follows the same rule (`nativeStateCommit.ts:16-40`).
  - Nothing extrapolates it. The fresh per-tick value exists on `positionChannel` and is used
    for loop wraps (`PlayerScreen/index.tsx:707-720`), but not for the click.
- **Expected error:** spread evenly over 0 to about 1050 ms, by construction. At a play
  transition it is fresh (the transition commits immediately), within about 50 ms.
- **Measured:** no.

### P3. Position → phase → engine start (async chain, uncompensated)
- **CODE (`syncClick`, `usePlaybackClick.ts:234-311`):**
  1. Read `positionMs` (t0).
  2. `await configureForParams` (`:210-231`). When haptic is on, this first awaits
     `refreshHapticLead` → `resolveCurrentRouteLatencyProfile`, which is two native calls.
     On Android with no live track, `currentOutputLatencyMs` *creates and releases a probe
     AudioTrack* (`SongNookMetronomeEngine.kt:639-705`).
  3. Then `configure` and `clearTempoMap`.
  4. Then `startAtPhase(phaseOffsetWallMs)` computed for t0.

  On Android the start path builds a static AudioTrack, writes the whole bar of PCM, and
  calls `play()` (`:550-625`).
- **Effect:** the click joins at the phase of t0, at time t0 + chain + track start-up. Nothing
  advances the phase by the elapsed time. The click therefore runs **late** against the song
  by (chain + start-up).
- **Expected error:** about 10 to 60 ms (INFERRED: React effect + 3 or 4 bridge round trips +
  AudioTrack build). Add about 10 to 50 ms for the probe track when haptic is on (Android).

### P4. Click render → speaker vs song presentation (domain mismatch)
- **CODE:** `outputLatencyMs: 0` and no lead for the play-along click (`usePlaybackClick.ts:220-222`).
- The click's phase is a **render-domain** phase (R1 applies: it is heard one click-path
  output latency later). The song's position is the player's **presentation** estimate (P1).
  So the click is heard late by about the click path's output latency, minus whatever the
  player's position fails to compensate.
- The latency model already expresses this difference for recording over a guide
  (`guideStartAdvanceMs = max(0, player − click)`, `latencyModel.ts:39-41,213`). Playback does
  not use it. On speaker, the model sets player = click when no calibration exists (`:182-184`).
- **Contradiction in the code base:** `docs/metronome-timing-plan.md:407-408` rule 3 says
  "same-route outputs cancel". The model's own Bluetooth measurement says they don't. That is
  why `guidePlayerOutputMs` exists.
- **Expected error:** speaker unknown. INFERRED tens of ms: the click's static track sits on
  the primary or normal mixer, ExoPlayer often on deep buffer, and they differ by 20 to 60 ms
  on many devices. Bluetooth: about 300 ms, click early (from the Samsung + AirPods numbers).

### P5. Start-up race: two independent start events
- The click starts when JS reacts to the `isPlaying` transition (`usePlaybackClick.ts:396-402`).
  The song's first audible sample comes from ExoPlayer's own start-up. Neither waits for the
  other, and there is no shared clock. This is Phase F, not built
  (`metronome-grid-and-transport.md:414-436`).
- **Seek:** `notifySeek(targetMs)` restarts the click at the target right after the seek call
  returns (`PlayerScreen/index.tsx:1048-1053`), while ExoPlayer is still re-buffering. The
  click runs ahead by the seek's re-buffer time.
- **Count-in:** `onCountInComplete` fires **on the last count-in click** (engine
  `finishBeatEmission`, Android `:893-903`, iOS `:842-851`), one beat before the downbeat.
  The recorder accounts for that (`useRecordingScreenModel.ts:1911-1913`). The playback hook
  starts the song immediately (`usePlaybackClick.ts:420-443` → `PlayerScreen/index.tsx:1001-1017`),
  so the song enters about one beat (minus player start-up) **before** the count-in's implied
  "one". The `isPlaying` effect then re-syncs the click (P3), so the steady state matches a
  plain play.

### P6. Drift check (engine clock vs player clock)
- **CODE:** every 10 s, `enginePhase = (Date.now() − anchorEpochMs) mod bar` (render domain)
  vs the phase of `getPositionRef.current()` (stale per P2). If the error is over 35 ms,
  `syncClick()` re-reads the same stale position (`usePlaybackClick.ts:361-388`).
- **Consequences:**
  - (a) With a fresh position, it still could not see P4 (render vs presentation). It tolerates
    35 ms, which is above the audibility of a click flam (INFERRED: about 10 to 20 ms).
  - (b) With the stale position it reads, the error is about +staleness, and the resync
    **moves the click to the stale phase**. The click should hop by up to about 1 s (mod one
    bar) at most 10 s checks. That is a seam plus a new wrong offset.
  - (c) Map runs skip the check entirely (`:358-360`).
- **Rate rounding:** `Math.round(bpm × rate)` (`playbackClick.ts:85`). At a non-integer scaled
  tempo (92 × 0.9 = 82.8 → 83) the click drifts about 145 ms/min. That is caught at 35 ms,
  which comes back to (b).
- **Measured:** never. The `[timing] click drift:` log is the "Phase F KPI" and has no recorded
  values in `docs/`. It is `console.log`, so it shows in logcat (`ReactNativeJS`), not in the
  persisted diagnostic log.

### Playback-side summary per platform and route

| | P2 stale pos | P3 chain | P4 domain | P7 priming | Net |
|---|---|---|---|---|---|
| **Android, speaker** | 0 to 1 s at drift checks | Click late 10 to 60 ms (+ probe) | Click late by about the click path's output latency (uncompensated) | Recorded click late 0 or about 23 to 48 ms | Small constant offset at play start; hops after drift checks |
| **Android, Bluetooth** | Same | Same | Click about 300 ms **early** (Samsung + AirPods data) | Same | Large |
| **iOS, speaker (AVPlayer)** | Same | Same | Likely click late by outputLatency + IO buffer | None (stripped) | Small |
| **iOS, practice engine** | Same | Same | Song late by the TimePitch latency (not subtracted), so the click is early | None | Unmeasured |

---

## 4. Other clock crossings worth knowing

- **Engine pulse timing is sample-exact** (Bresenham; CODE Android `:190-196,1047-1061`). The
  map engine schedules clicks at sample positions (iOS `scheduleBuffer(at:)` `:451-480`;
  Android stream writer `:440-527`, primed in `:404-437`). Tempo is integer BPM, so there is
  no BPM drift at rate 1.
- **Capture vs playback crystals:** same device clock. Drift is at the ppm level, negligible.
- **Sample rates:** both engines run at 44.1 kHz. A 48 kHz hardware route adds an SRC
  (a few samples). Negligible.
- **Live recording ruler:** `firstBeatCaptureMs = downbeat − captureStart + correction`
  (`useRecordingScreenModel.ts:1998-2006`) is the pre-alignment estimate, drawn during the
  take. It can be off by everything self-alignment later corrects.

---

## 5. Calibration flows

- **Bluetooth only.** `BluetoothCalibrationScreen` saves per route key only on Bluetooth
  routes (`index.tsx:166-169,517`), and the model applies calibrations only when the route is
  Bluetooth (`latencyModel.ts:149`). **There is no speaker or wired calibration;** those routes
  rely entirely on the OS report.
- **Method:** a player pass measures the media-player path, and a click pass is anchored to
  the engine's render-domain grid via `getGridAnchor` (`index.tsx:445-501`).
  Taps are stamped `Date.now()` at touch-down on the UI thread (`:125-134`). The touch-panel
  scan and delivery latency (INFERRED 10 to 30 ms) and the human anticipation bias go into
  the saved offset uncorrected.
- **Drift across connections:** current OS report minus the OS report at calibration time
  (`latencyModel.ts:157-164`).
- **No loopback calibration.** Deferred: "item 3 (loopback auto-calibration)",
  `metronome-timing-plan.md:28`.

---

## 6. Ranked candidate causes for the founder's observation (Android, speaker, play-along click)

The first step is the same for all of them. Get the exported take (sharing copies the file
byte for byte, `audioStorage.ts:761-778`) plus its stored `bpm` / `firstDownbeatMs`, and a
logcat capture of one playback (`adb logcat | grep '\[timing\]'`).

| # | Cause | Status | Expected size / sign | Single measurement that tells it apart |
|---|---|---|---|---|
| 1 | **Android AAC priming not stripped** in the head-trimmed m4a (R7/P1). The recorded click plays late against a correct grid. | Unverified; plausible | Constant +23 to 48 ms (recorded click **after** the play-along click), every take, every play | Inspect the exported file for an edit list or gapless info (`ffprobe -v trace take.m4a 2>&1 \| grep -i -E 'elst\|edit list\|iTunSMPB'`). Then run `grid-truth.py --audio take.m4a --bpm B --downbeat D` twice: once as-is (afconvert path, Apple semantics) and once with the decode forced through ffmpeg. A difference of about 23 to 48 ms, with no `elst`, confirms it. |
| 2 | **Playback start not compensated** (P3 + P4 + P5): position read at t0, click started after the async chain, render vs presentation domain, independent start-ups | Certain in code; size unmeasured | Constant per play, tens of ms; INFERRED click late on speaker | Record the phone's speaker output during playback with the click on (a second device mic, or a cable into a laptop). Measure play-along click onset vs recorded-click onset per beat over the first 8 s, before any drift check. Repeat 5 plays. A constant that varies between plays points to start-up; a constant that never varies points to the domain/latency term. |
| 3 | **Drift check resyncs to a stale position** (P2 + P6) | Certain in code | Hops of 0 to about 1 s (mod one bar) every 10 s | The `[timing] click drift: Nms` and `[timing] click sync: pos=…` lines in logcat. Values in the hundreds, each followed by a sync, confirm it. By ear: does the offset change every 10 s? |
| 4 | **Saved grid off the recorded clicks** (self-align declined or wrong; R5/R6) | Possible | Whatever R1 + R3 + R4 left: tens of ms; sign depends on device | `grid-truth.py --audio take.m4a --bpm B --downbeat D` (with afconvert) gives grid vs recorded clicks in file ms. Cross-check the take's `[timing] click self-align:` and `[timing] latency profile:` log lines. Note: this tests the **recording** side only; a pass here says nothing about playback. |
| 5 | **Drift tolerance + correction floor** (35 ms resync threshold; 6 ms self-align floor) | By design | Up to 35 ms tolerated during playback | Same recording as #2, over 60 s. A slow walk that stops near 35 ms. |
| 6 | **Count-in hand-off** (P5): the song enters about one beat early against the count-in, then re-syncs | Certain in code | Only when count-in is on | Play with and without count-in. |
| 7 | **Bar-off anchor race** (R4) | Rare (about 0.3 to 0.5%) | A whole bar trimmed off the head | `grid-truth` shows "ON THE GRID" while the take is visibly missing its first bar. |

**Why #1 ranks first for "small, constant, Android":** it is the only candidate that fits all
three words. It is exactly the class of offset the iOS work already found once (48 ms, the
layer-truth notes). And the repo's Mac harness would hide it. #2 is certain to exist too, but
its size is unknown. #3 should produce jumps rather than a steady small offset, unless the
founder listened only in the first 10 s.

**A playback test separate from grid-truth is required.** grid-truth reads only the file. The
measurement that settles playback is the acoustic recording in #2, ideally compared with the
`[timing] click sync`/`drift` logs from the same run.

---

## 7. Haptic and visual paths ("there's ALWAYS a delay in the haptic")

### 7.1 How the haptic is fired

**Shared math (both platforms):**
- `hapticLeadMs = outputMs − HAPTIC_PIPELINE_LATENCY_MS` (`latencyModel.ts:220`).
- `HAPTIC_PIPELINE_LATENCY_MS` is **35 on iOS and 60 on Android**, and `VISUAL_PIPELINE_LATENCY_MS`
  is **50** (`:80-87`). Both are **ASSUMED** perceptual defaults, labelled "refined per-device
  later". No measurement exists in the repo.
- The value is sent as `hapticOffsetMs` (clamped −200..1000 natively; Android `:941`, iOS `:929-932`).

**Scheduling (CODE: Android `finishBeatEmission` `:851-904`, `scheduleHaptic` `:906-916`;
iOS `:794-863`):**
1. The 8 ms poll runs on the engine thread (Android `HandlerThread` `:198-209`; iOS
   `DispatchSourceTimer` on the engine queue `:703-711`).
2. When it notices the render clock crossed pulse *k*, it emits beat *k*.
3. In the same call it schedules the haptic for **pulse k+1** at
   `now + beatInterval + hapticOffsetMs`.

So a **negative lead is honoured for pulses 1 and up.** The latency-model comment "negative =
must fire early — needs anchor scheduling, Stage B" (`latencyModel.ts:54-58`) is stale for
haptics. Native one-beat-ahead scheduling is Stage B for haptics.

**Pulse 0:** aimed at "now + offset", with **negative offsets clamped**: iOS `max(0, …)`
(`:237-239`), Android `max(1, …)` (`:617-619`). Phase starts (the playback click) skip it.

**Fire:**
- **Android:** `postDelayed` on the engine's handler thread → `fireVibrator` → a synchronous
  Binder call `vibrator.vibrate(VibrationEffect.createOneShot(28–70 ms, amp))`, with no
  `VibrationAttributes` (`SongNookMetronomeModule.kt:35-59`).
- **iOS:** `DispatchQueue.main.asyncAfter` → a **new `UIImpactFeedbackGenerator` every beat**,
  `impactOccurred(intensity:)`, **never `prepare()`d** (`SongNookMetronomeEngine.swift:854-863`).

**Who uses it:**
- **Metronome page and recorder:** via `useMetronome.syncNativeConfig`
  (`useMetronome.ts:411-441`). The profile is refreshed *before* `start` (`:161-185`), and the
  log line is `[timing] cue profile @start: … hapticLead=…`.
- **Playback click:** `refreshHapticLead` → `profile.hapticLeadMs` (`usePlaybackClick.ts:192-208`).
  It aims at the *click's* audible time, so it inherits every playback-click error in §3.
- **Older binaries:** JS `Vibration` / `expo-haptics` fallback, fired at the bridge event
  (`useMetronome.ts:349-409`). Unused on binaries with `supportsScheduledCues`.

### 7.2 How the visual is driven
- **Two paths exist:**
  - **(a) Event path.** The engine emits `onBeat` after `postDelayed(outputLatencyMs)` (≥ 0,
    never early: Android `:864-871`, iOS `:807-817`). It crosses the bridge to JS,
    `setBeatCount` (`useMetronome.ts:521-530`), a React commit, a `useEffect`, then a native-driver
    `Animated.timing` start on the next frame.
  - **(b) Anchor scheduler.** JS `setTimeout` at
    `anchor + k·pulse + visualLeadMs` → `setPulseToken` (`useMetronome.ts:209-288`). It
    re-anchors every bar and waits 90 ms after start. This is not Reanimated. The plan's
    "visual on a UI-thread clock" (Stage B item 2) was never built
    (`metronome-timing-plan.md:26,455-470`).
- **Recorder:** `useMetronome({ visualPulse: false })` (`useRecordingScreenModel.ts:336`). The
  beat bar and breath are driven only by `beatCount`, which is the **event path** (a). The
  breath has a 45 ms attack ramp (`RecordingBeatBreath.tsx:34,64-70`). During a take the JS
  thread is also processing a 40 ms audio delivery each time (live waveform + onset envelope
  loop), so bridge latency grows.
- **Metronome page:** the visible pulse is `MetronomeBeatBar` (the halo is no longer rendered).
  It takes `pulseToken` from scheduler (b) **and** `currentBeat` from `beatCount` (event path a)
  (`MetronomeScreenContent.tsx:56-63`; `useMetronome.ts:722-731`). Its effect fires on *either*
  change (`MetronomeBeatBar.tsx:91-98`):
  - The scheduler fires first, about 50 ms + bridge before `onBeat`, and re-flashes the
    **previous** dot.
  - The right dot lights only when the late `onBeat` lands.

  So the scheduler's lead is effectively discarded, and the page's visual rides path (a).
- **Playback click:** no visual (`usePlaybackClick.ts:221`).

### 7.3 Timing of each cue relative to the audible click (per beat k+1)

`d_det` is the beat-detection lag: poll phase 0 to 8 ms, plus render-clock granularity.
INFERRED Android 0 to 20 ms (mixer period); iOS 0 to 23 ms (IO buffer).

| Cue | Lands at (minus the audible click) | Terms |
|---|---|---|
| Audible click | 0 (reference) | render + true click output latency `L` |
| Haptic | `d_det + (outputMs_est − L) + (M_true − M_assumed)` | `M_assumed` = 35 iOS / 60 Android; on iOS, + main-queue wait + unprepared Taptic wake |
| Visual, recorder | `d_det + (outputMs_est − L) + bridge + commit/effect + ≤1 frame (+45 ms breath ramp)` | Never early (event delay ≥ 0) |
| Visual, Metronome page (dots) | Same as the recorder (event path); the scheduled pulse only re-flashes the old dot | — |

### 7.4 Ranked causes for "the haptic always lags"

1. **Detection lag is built into every haptic (CODE, both platforms, always late).**
   Pulse k+1's buzz is timed from the moment the poll *noticed* pulse k, not from pulse k's
   exact render time. The engines know that time exactly (frame math) but discard it.
   INFERRED mean about 5 to 15 ms late, up to about 25 ms, with jitter.
   *Distinguish:* log `(now − computedPulseTime)` at each emit, or film 240 fps against the click.
2. **iOS fire path (CODE).** A fresh `UIImpactFeedbackGenerator` per beat with no `prepare()`
   means the Taptic Engine may be idle at fire time; Apple documents `prepare()` as the
   latency reducer. It is dispatched on `DispatchQueue.main`, the RN UI thread, which is
   mounting the per-beat React commit at about the same moment (the recorder re-renders on
   every `onBeat`). INFERRED tens of ms, variable.
   *Distinguish:* compare a prepared, reused generator on a dedicated path (a
   build-time experiment), or film it.
3. **iOS recording suppresses haptics (CODE + platform rule; unverified on device).** iOS
   disables haptics while the session is recording unless
   `AVAudioSession.setAllowHapticsAndSystemSoundsDuringRecording(true)`. That call appears
   nowhere in `modules/`, `patches/`, `src/`, the expo-audio or @siteed iOS code. Record-through
   means capture is rolling from the count-in, so the recorder's haptic may be silent or
   intermittent on iOS rather than late.
   *Distinguish:* enable Haptic only on the recorder on an iPhone and listen/feel.
4. **The assumed motor/pipeline constants (ASSUMED 60 Android / 35 iOS).** Android vibrate is
   Binder → VibratorManagerService → HAL → actuator. ERM motors take tens of ms to reach
   perceptible amplitude. A 28 to 70 ms one-shot is *felt* at its peak, not its onset, while
   the click has a 3 ms attack. If the true value is above 60, the haptic lags by the
   difference on every beat.
   *Distinguish:* a 240 fps video with the phone on a surface plus an accelerometer/contact-mic
   trace, or a contact mic taped to the phone recording both the click and the buzz in one file.
5. **Output-latency estimate wrong in the "late" direction.** The haptic aims at render +
   `outputMs_est`. If the OS over-reports (Android probe-track buffer stripping uses
   `getMinBufferSize`, but the real track frame count can be larger; the engine comment
   records 209 reported vs 108 real), the haptic is late by the excess. If it is unknown (0),
   the lead is −60 and the haptic is early instead.
   *Distinguish:* the `[timing] cue profile @start: … out=Nms(source) hapticLead=…` log.
6. **First buzz of a run** (CODE): a negative lead is clamped at pulse 0, so the first buzz
   cannot lead. On Android it fires before the static track has even started.
7. **Android engine thread contention** (CODE, small): the vibrator Binder call, the 8 ms
   poll and the map writer share one `HandlerThread`. The poll runs under the engine lock.
   Sub-ms to a few ms normally.
8. **Playback click only:** the haptic follows the play-along click, so every §3 error
   (P3/P4/P6) moves the buzz relative to the *song*.

**Visual vs haptic:** on the recorder and the Metronome page the visual rides the late event
path, while the haptic is natively scheduled to lead. If the founder judges the haptic against
the dots or breath, the two errors partly cancel. Against the click alone, haptic terms 1 to 4
are the suspects. The plan's acceptance bar, "Beep + visual + haptic … within ≤ ~20 ms
pairwise … film at 240 fps" (`metronome-timing-plan.md:510-513`), has never been run.
`metronome-grid-and-transport.md:53-56` (§0a item 6, "Practice click haptic … the buzz lands
with the click") is still an owed device check. The original gap list already named this
symptom: "G2. Haptic always feels late" (`metronome-timing-plan.md:412`).

---

## 8. Open items and deferred plans found in the docs

- **Phase F, shared transport**: one sample clock for click, guide, playback and recording.
  Not started; "rides the next audio-engine opening". Its urgency was meant to be decided by
  the `[timing] click drift` KPI, which has never been recorded
  (`metronome-grid-and-transport.md:414-436,621-622`).
- **Stage E, timed-take capture engine** (pure-Kotlin AudioTimestamp, ±5 to 10 ms file
  exactness). Sequenced last, not started (`metronome-timing-plan.md:492-503`).
- **Phase 7, unified engine:** not started (`metronome-timing-plan.md:29`).
- **Stage B item 2, Reanimated visual clock seeded from the anchor:** not built. JS
  `setTimeout` is used instead, and the dots ignore it (§7.2).
- **Owed device checks** (`metronome-grid-and-transport.md:21-56`):
  - Android Kotlin map-engine compile (since done: the 2026-10-29 fix shipped it).
  - Simulator 10-minute soak.
  - Device listening pass: "is the phase-started click actually aligned to the take?"
  - Practice-click haptic on speaker and Bluetooth.
- **Capture-start native timestamps** "Needs device verification (check the estimatorDelta
  log…)" (`metronome-timing-plan.md:27`).
- **Grid truth on a device:** "re-run after recording a fresh take on a device"
  (`RUN-LOG.md` 2026-07-30). Only iOS-simulator runs exist. Physical Android is listed as open
  (`reel-and-grid-postmortem.md:209-224`).
- **Android priming:** "Needs one Android listen" for imported files (`RUN-LOG.md` 2026-10-22).
  App-recorded Android takes (Transformer AAC) were never checked at all.
- **Click on a fresh click take after the `punchPhaseInBarMs` fix:** "not yet measured"
  (`RUN-LOG.md` 2026-10-22).
- **Loopback auto-calibration:** deferred (`metronome-timing-plan.md:28`). There is no speaker
  or wired calibration.
- **Map-writer thread** shares the beat poll's handler; switching to `WRITE_NON_BLOCKING` or a
  second thread was suggested (`metronome-grid-and-transport.md:70-76`). Priming now makes
  blocking writes unlikely.
- **v1 limits accepted in Phase C:** "count-in from mid-bar restarts click at position phase
  (small seam)" and "loop-wrap resync rides the drift check, not notifySeek"
  (`metronome-grid-and-transport.md:561-563`). The current code does route seeks through
  `notifySeek` (`PlayerScreen/index.tsx:1048-1053`).

---

## 9. Measured vs assumed, at a glance

| Quantity | Status | Value / source |
|---|---|---|
| Harness noise floor | MEASURED | ±0.2 to 1 ms (`grid-truth.md:56-61`) |
| Onset-envelope vs harness | MEASURED (iOS sim, 1 take) | 0.4 ms (`grid-truth.md:148-154`) |
| Pre-fix grid error | MEASURED (iOS sim) | −89.5 ms (15 margin + about 75 unreported round trip) |
| Scheduled vs perceived click | MEASURED (sim) | +230 ms (`reel-and-grid-postmortem.md:167-170`) |
| Speaker → mic unseen path | MEASURED (iOS sim layers) | about +30 ms (`RUN-LOG.md` 2026-10-22) |
| Bluetooth player vs click pipelines | MEASURED (device logs, tap calibration) | about 500 vs about 200 ms, Samsung + AirPods (`latencyModel.ts:35-37`) |
| Android probe latency bias | MEASURED (device logs) | 209 reported vs 108 real (`SongNookMetronomeEngine.kt:646-649`) |
| iOS AAC priming | MEASURED | 2112 frames ≈ 48 ms, stripped by Apple decoders |
| Android output latency on speaker | **OS-reported, unverified** | — |
| Android input latency | **Not modelled** (0); covered by the AudioRecord timestamp if accurate | — |
| Android capture-start accuracy | **Unverified** (plan expected ±5 ms) | — |
| Android AAC priming / `elst` | **Unchecked** | — |
| Playback click vs recorded click on any device | **Never measured** | — |
| Haptic / visual pipeline constants | **ASSUMED** | 35 / 60 / 50 ms |
| Haptic / visual / audio pairwise alignment | **Never measured** (acceptance ≤ 20 ms) | — |
