# Audio engine & native audit — SongNook (2026-10-22)

Scope: src/hooks (transport, recording, metronome, pitch), src/services (audio*, soloMix,
waveform*, metronomeLoop, alignment, latency, recovery, lockScreen*), src/domain (metronome,
tempo, onset, tuner, overdub, layerAlignment), modules/** (3 Expo modules, Swift + Kotlin),
patches/*. Read-only; every finding below was traced from a real caller.

Counts: P0 0 · P1 3 · P2 7 · P3 8. [SMALL-WIN] tagged where ≤ ~15 lines.

---

## P1 — fix before launch

### 1. Native metronome engines mutate state from two threads with no lock (crash race)
- **Severity P1 · confidence med** (small window, but a hard crash on a recurring user path)
- iOS: `modules/songnook-metronome/ios/SongNookMetronomeEngine.swift:81,694-760` — the 8 ms poll
  timer runs on `queue`; `configure/configureTempoMap/clearTempoMap/start/stop` run on Expo's
  shared `expo.modules.AsyncFunctionQueue` (expo-modules-core `AsyncFunctionDefinition.swift:19`).
  `pollBeatProgress` checks `mapSegments != nil` (l.709) then `pollMapBeatProgress` /
  `mapGridPulse` / `emitMapBeat` / `scheduleMapClicks` force-unwrap `mapSegments!`
  (l.349,357,372,401,460,781). `configure()` sets `mapSegments = nil` (l.176) and
  `clearTempoMap()` (l.334) do so from the other thread.
  Path: playback click on, seek while playing → `usePlaybackClick.syncClick` →
  `configure` + `configureTempoMap` + `startAtPhase` while the engine is running in map mode
  (`src/hooks/usePlaybackClick.ts:237-253`); the drift check does the same every 10 s.
  A poll handler in flight at that instant crashes on the unwrap. `stopInternal` only cancels
  the timer (`cancel()` does not wait for a running handler) and then resets every counter
  while the handler may still be reading them.
- Android: `modules/songnook-metronome/android/.../SongNookMetronomeEngine.kt:742-744,766-769,
  951-952` — `pollBeatProgress` on the HandlerThread does `val track = audioTrack ?: return`
  then `track.playbackHeadPosition`; `stop()` from the module thread calls `releaseAudioTrack()`
  (l.718-730). `AudioTrack.getPlaybackHeadPosition()` on a released track throws
  `IllegalStateException` (JNI `getAudioTrack == NULL`), uncaught on the handler thread →
  process crash. `removeCallbacks` does not interrupt the runnable already executing.
  Same `mapSegments!!` NPE race in `pollMapBeatProgress` (l.775 → `mapGridPulseAtFrame` l.303).
- Fix: funnel every public entry point through the engine's own queue — iOS `queue.sync { … }`
  in `configure/start/startAtPhase/stop/configureTempoMap/clearTempoMap/getGridAnchor`
  (returning the dict from inside the block); Android run the same methods on `handler` with a
  `CountDownLatch` (or make `pollBeatProgress`/`pollMapBeatProgress`/`writeMapChunks`
  `synchronized(this)` together with `stopInternal`/`configure`, and wrap the
  `playbackHeadPosition` reads in try/catch as a belt-and-braces).

### 2. A kept-for-recovery take can be orphaned by cancelling the next count-in
- **Severity P1 · confidence med-high** — data loss under the Data law.
- `src/hooks/useRecording.ts:1070-1089 cancelPreparedRecording()` unconditionally calls
  `clearPendingRecordingSession()`. It is reached from
  `useRecordingScreenModel.cancelPendingRecordingStart()` (l.1244-1255), called while
  `isArmingRecording` from `cancelRecording` (l.1260), the redo path (l.1286),
  `minimizeRecording` (l.2649), and the count-in/metronome start failure branches
  (l.2002, 2273, 2545).
- Sequence: a save fails → `saveRecordingNow` keeps the recorder temp file + the pending
  marker and sets `unrecoveredTakeThisSession = true` ("Kept for recovery" alert, l.1317-1322).
  The user taps record again with a count-in. Recovery of the kept take only runs inside
  `startPreparedRecording` (`recoverKeptTakeBeforeNewOne`, l.1017), i.e. AFTER the count-in.
  Cancelling, minimizing, or a count-in start failure during that count-in →
  `cancelPreparedRecording` → marker deleted. `unrecoveredTakeThisSession` is still true but
  the next recovery reads no marker → `{status:"none"}`; the kept WAV sits in audio-studio's
  temp dir forever and never reaches the library.
- Fix [SMALL-WIN]: in `cancelPreparedRecording` only clear the marker this take wrote:
  `if (take.facts.sessionPersisted) await clearPendingRecordingSession();`
  (a prepared-but-not-started take never wrote one).

### 3. iOS practice/pitch engine never learns the OS stopped it (interruption, route change)
- **Severity P1 · confidence high** (stuck UI; borderline P2 for the player because the twin masks it)
- `modules/songnook-pitch-shift/ios/SongNookPitchShiftPracticeEngine.swift` registers no
  `AVAudioSession.interruptionNotification` / `AVAudioEngineConfigurationChange` observer
  (grep: none in modules/). A phone call, Siri, or unplugging headphones stops the
  `AVAudioEngine`; the engine keeps `isPlaying = true`, the 100 ms `tickTimer` (l.451-460)
  keeps emitting, and `computedCurrentPositionMs` falls back to the frozen `pausedPositionMs`
  because `lastRenderTime` is nil (l.428-441). JS (`useNativePitchTransport`) shows a playing
  transport that does not move.
  - Full player: the muted twin (expo-audio) IS paused by expo-audio's handler
    (`AudioModule.swift:388-395`), so the twin→engine mirror pauses the engine after
    ~1.15 s — the user sees a self-pause and must press play; the engine restarts because
    `playInternal` calls `ensureEngineRunning`. Degraded but recoverable.
  - Editor preview (`twinSource` false): nothing pauses it; the play button stays in the
    "playing" state until the user toggles twice.
- Fix: observe `AVAudioSession.interruptionNotification` (`.began` → stop node, timer,
  `isPlaying=false`, emit state) and `AVAudioEngineConfigurationChange` (same, and on resume
  re-`engine.start()` before `play`). ~25 lines; mirrors what expo-audio already does for its
  players.

---

## P2 — should fix soon

### 4. iOS practice engine keeps the AVAudioEngine (and audio I/O) running while paused
- **P2 · high** · `SongNookPitchShiftPracticeEngine.swift:259-280` — `pause()`/`stop()` stop
  the player node only; `engine.pause()` is never called (only `unload()` stops it). The
  render thread keeps pulling the EQ/limiter/time-pitch chain with silence and the I/O unit
  stays open for as long as the player screen holds the practice transport (e.g. practice
  mode paused, phone locked). The metronome engine does this right (`stopPlayer` →
  `engine.pause()`, l.685-692).
- Fix [SMALL-WIN]: call `engine.pause()` in `pause()` and `stop()`; `playInternal` already
  calls `ensureEngineRunning()` which restarts a paused engine.

### 5. Waveform decoders bin samples by buffer timestamp, not by sample — comb-shaped envelopes
- **P2 · med** (masked on cards by downsampling; visible in the reel at high zoom; verify on device)
- iOS `SongNookPitchShiftRenderer.swift:565-604`: every sample of a `CMSampleBuffer` is added
  to ONE bin chosen from the buffer's presentation time (l.591-592). AVAssetReader LPCM buffers
  hold thousands of frames (typically ~8192 for AAC → PCM, ≈186 ms at 44.1 kHz); with
  `WAVEFORM_DETAIL_BINS = 2048` a bin is 186 ms only for clips ≥ 6 min, so for a 30 s clip
  (14.6 ms bins) ~12 of every 13 bins stay at the −60 dB floor (0.004).
- Android `SongNookPitchShiftRenderer.kt:542-556`: identical scheme per MediaCodec output
  buffer (1024 frames ≈ 23 ms for AAC) → every other bin empty for clips < ~47 s at 2048 bins.
- The card thumbnail (`deriveThumbnailPeaks` max over 8) hides it; the sidecar read by the
  reel and by `gridSelfAlignment`'s sidecar fallback does not. Recorder-made takes are
  unaffected (their sidecar comes from capture analysis), imports are affected.
- Fix: compute the bin per sample: `bin = clamp(Int((ptsSec + i / sampleRate) / total *
  points))` inside the loop (Android: `ptsUs + i * 1_000_000 / (sampleRate * channels)`),
  or accumulate into a running sample index. ~6 lines each.

### 6. Android limiter look-ahead is never drained: rendered mixes are 5 ms late and lose their last 5 ms
- **P2 · high for the mechanism, low for audibility**
- `SoundChainAudioProcessor.kt:143-153,159-165` keeps a 5 ms delay line (`LOOKAHEAD_SECONDS`)
  and never flushes it at end of stream (BaseAudioProcessor `queueEndOfStream` just sets
  `inputEnded`). Used at composition level in `renderMixedFile` (Renderer.kt:173) and in
  `renderFile` (l.188): every rendered mix / solo mix / pitch render on Android starts 5 ms
  late relative to its inputs and drops its final 5 ms. The live chain has the same 5 ms
  latency (consistent, harmless). iOS uses `kAudioUnitSubType_PeakLimiter`
  (`SongNookToneEQ.swift:710-719`) whose look-ahead (= attack time, default 12 ms) is also
  not compensated in offline rendering — unverified; `scripts/layer-truth.py` can measure both.
- Why it matters: `layerSelfAlignment` places layers against the guide the mic heard; if the
  guide was a rendered mix the whole mix moves together, so relative layer alignment is kept,
  but mix-vs-root-take and bake-vs-live differ by the look-ahead.
- Fix: override `queueEndOfStream()` to push `lookaheadFrames` of zeros through the limiter
  before `super.queueEndOfStream()` (≈10 lines); on iOS set the limiter's attack time
  explicitly and trim that many frames from the head of the offline render.

### 7. Android practice engine ticker keeps posting 10 state events/s after a focus-loss pause
- **P2 · high** · `SongNookPitchShiftPracticeEngine.kt:269-276` — `onIsPlayingChanged(false)`
  stops the ticker only in `STATE_ENDED`; a pause caused by audio-focus loss (call,
  navigation prompt), or by the OS, leaves `tickerRunning` true. Each tick is a bridge event +
  `getStateUnsafe()` allocation, forever, until the user presses pause/unload — including
  with the screen off.
- Fix [SMALL-WIN]: in `onIsPlayingChanged`, `if (!isPlaying && player?.playWhenReady != true)
  stopTicker()`; restart it in `play()` (already done).

### 8. Android playback does not pause when headphones are unplugged
- **P2 · med** · expo-audio (patched) Android never registers `ACTION_AUDIO_BECOMING_NOISY`
  nor `setHandleAudioBecomingNoisy(true)` (grep over `node_modules/expo-audio/android` → no
  hits); `SongNookPitchShiftPracticeEngine.kt:248` builds its ExoPlayer without it either.
  Pulling the jack / BT dropping mid-song switches the song to the speaker. iOS is covered
  (`AudioModule.swift:432-435`, `.oldDeviceUnavailable` → pause). Recording is covered by
  audio-studio's receiver.
- Fix: `ExoPlayer.Builder(...).setHandleAudioBecomingNoisy(true)` in the practice engine
  (1 line) and the same in expo-audio's `AudioPlayer` factory inside the existing patch.

### 9. Metronome engines ignore AVAudioEngine stops too
- **P2 · med** · `SongNookMetronomeEngine.swift` has no interruption/configuration-change
  observer. After a call the click is silent while `isRunning` stays true; `getGridAnchor`
  falls through to the uptime clock (l.596-598) so the visual scheduler keeps pulsing a grid
  nobody hears. On the recorder this is partly covered because audio-studio pauses the take
  and `useRecordingScreenModel` stops the metronome on the interruption token (l.2033-2053);
  the standalone metronome page and the playback click are not.
- Fix: same observer as #3; on `.began` call `stopInternal(emitState: true)` so JS sees
  `isRunning=false`.

### 10. A 15 s `stopRecording` timeout leaves the native recorder running
- **P2 · med** · `useRecording.ts:1030-1032` races `recorder.stopRecording()` against a 15 s
  timeout; on timeout the catch path (l.1209-1226) shows "kept for recovery" and releases the
  audio session while the native recorder may still be capturing (wake lock, foreground
  service, mic indicator). Nothing stops it until the next take's `startRecording` sees
  `recorder.isRecording` (l.865-869). Same in `discardRecording` (l.1244-1252) which only
  deletes the late file.
- Fix: in the timeout branch, schedule a follow-up `recorder.stopRecording()` via
  `onLateResult`/a retry, or at least `void recorder.stopRecording().catch(() => {})` once
  after the failure so capture cannot continue unattended.

---

## P3 — nice to have

### 11. `useNativePitchTransport` leaves one timeout alive across unmount [SMALL-WIN]
`src/hooks/useNativePitchTransport.ts:197-201` — `presentRecheckRef` timeout is not cleared
in the unmount effect (l.775-784); it fires `receiveNativeStateRef.current(…)` → `setNativeState`
on an unmounted hook. Harmless in React 19, but add `clearTimeout(presentRecheckRef.current)`
to the cleanup.

### 12. Tuner screen runs two `setInterval`s for its whole mount, focus or not
`src/components/TunerScreen/hooks/useTunerScreenModel.ts:138-198` — a 100 ms stale check and
a 1.6 s health check run while the page is mounted but blurred/backgrounded (the tuner is a
pushed tool page, so this is bounded by the page's life). Gate both on `isFocused` or start
them in `startListening`/stop in `stopListening`.

### 13. iOS `scheduleHaptic` builds a fresh `UIImpactFeedbackGenerator` per beat
`SongNookMetronomeEngine.swift:845-854` — allocation on the main thread at up to 4 Hz and no
`prepare()`, which is what gives the Taptic engine its latency variance. Keep one generator
per style and call `prepare()` after scheduling. [SMALL-WIN]

### 14. iOS practice engine `tickTimer` is scheduled on a thread without a run loop, then re-added to main
`SongNookPitchShiftPracticeEngine.swift:453-459` — `Timer.scheduledTimer` registers on the
Expo async queue's (non-running) run loop, then `RunLoop.main.add` registers it a second
time. Works today by accident; use `Timer(timeInterval:repeats:block:)` + `RunLoop.main.add`.
[SMALL-WIN]

### 15. `runOnPlayerThreadSync` blocks the shared Expo thread with an unbounded latch
`SongNookPitchShiftPracticeEngine.kt:196-220` — every pitch/seek/state call parks Expo's shared
AsyncFunction thread until the main looper runs the block. Under a main-thread stall (large
list commit, ANR) every other Expo async call (file system, recorder) queues behind it.
Consider `latch.await(2, SECONDS)` with a logged fallback, or run the player on its own
`HandlerThread` looper (`ExoPlayer.Builder.setLooper`).

### 16. Hardcoded English in the audio scope
- `useRecording.ts:245` `recordingNotificationTitle = "Recording…"` (iOS lock screen /
  Android card title) — deliberate per the comment, but not through `t()`.
- `src/domain/pitchShift.ts:551-559 formatPitchShiftLabel` ("Original", "semitone(s)") and
  `src/domain/tuner.ts:56 tuningLabel` ("In tune"/"Tune up"/"Tune down") — both UNUSED outside
  their module (grep); delete or route through `t()`.

### 17. Dead / near-dead code
- `formatPitchShiftLabel`, `TunerReading.tuningLabel`, `overdubGainDbToPlayerVolume`
  (`domain/overdub.ts:299`), `readPlaybackTimingMs` export (`transportPlayback.ts:298`, internal
  only) — no callers.
- `useLegacyMetronomeImpl` (`useMetronome.ts:748-1181`, ~430 lines) + `metronomeLoop.ensureMetronomeLoopFile`
  + `SongNookMetronomeModule.web.ts`: only reachable when the native module is absent (web /
  Expo Go). Fine to keep for web, but note it is untested on device and duplicates the click
  synthesis table a third time.
- `src/dev/jsStallMonitor.ts` and `components/dev/SyncProbe.tsx` run `setInterval`s — confirm
  they are `__DEV__`-only at the import site (out of my scope to trace; flagging).

### 18. Android `renderMapChunk` recomputes `sin()` per sample per click; iOS caches clicks
`SongNookMetronomeEngine.kt:413-482` renders each click's waveform from scratch for every
2048-frame chunk (~21 chunks/s), while iOS keeps a `clickCache`. CPU is small (one click ≈
1.5 k frames) but it is the hottest loop on the handler thread; pre-render per
(voice, accent) like iOS does.

---

## Questions from the brief, answered

**Audio session / keep-awake / foreground service left on after stop?**
- Metronome page: keep-awake held only while beating, released on stop and on blur
  (`useMetronomeScreenModel.ts:35-56`). Songbook/setlist: `useKeepAwakeWhileFocused` releases
  on blur. Recording: audio-studio wake lock + microphone foreground service released on stop
  (`AudioRecorderManager.kt:1129,1314,1440`). Playback (Android): the patched
  `AudioControlsService` leaves foreground 1.5 s after a pause and ends the session after 30 min
  idle (patch l.361-405) — good. The only "left running" cases are #4 (iOS practice engine
  while paused) and #7 (Android ticker after focus loss). Audio session role bookkeeping in
  `services/audioSession.ts` is a queued priority ladder; owners release on unmount in every
  hook I traced (recording, metronome, native transport).

**Timers surviving unmount?** All `setInterval`/rAF in scope are cleaned up except #11 (one
timeout) and #12 (intervals run while mounted-but-blurred). `recordTrace` rAF loops are
begun/ended symmetrically on every path I traced (`useRecording.ts:295-304,655-692`;
model l.1367-1465, 2078).

**CPU hot spots.**
- Waveform decoding is native on both platforms (AVAssetReader / MediaCodec), serialized and
  idle-gated (`waveformAnalysis.ts:132-170`); JS only maps the 256/2048 peaks. The remaining
  JS-thread decode is `extractAudioData` in `clipAnalysisRunner.ts` (tempo, ≤30 s at 8 kHz →
  240 k samples, O(n·lags) autocorrelation over a 100 Hz envelope: cheap) and
  `layerSelfAlignment.ts` (20 s PCM → floats + 1 ms envelope, yielded every 16 k frames —
  acceptable; it already avoids the Android `normalizedData` array trap).
- Per-tick allocations: `useThrottledAudioPlayerStatus` commits ~1/s; position goes through a
  channel; store writes are throttled to 150 ms / 250 ms deltas (`useFullPlayer.ts:303-351`).
  No render-per-tick path found.
- Metronome scheduling: sample-exact Bresenham onsets, audio-clock-anchored beats, 8 ms polls
  on a dedicated thread/queue; haptics scheduled natively. Precision is good; CPU cost is the
  8 ms poll (cheap) plus #18 on Android.
- Onset envelope accumulation during recording is one subtract per sample on the JS thread
  (`onsetEnvelope.ts:786-818`) — ~1.1 M ops/s at 44.1 kHz mono; measured by the team as fine.

**Native modules: leaks / thread-safety / bounds / file handles / main thread.**
- Thread-safety: #1 (metronome engines), #15. The pitch-shift renderer is stateless with a
  locked cancel flag; file-io uses an `NSLock`/`ConcurrentHashMap` correctly.
- Leaks: AVAudioEngine nodes are attached once per engine lifetime (fine); offline render
  engines are local and freed. Kotlin: `renderComposition` spins a HandlerThread per render
  and `quitSafely`s it; dispatchers closed `OnDestroy`. The metronome `HandlerThread` lives
  for the process (idle; acceptable). No coroutine leaks found.
- Bounds: accent-pattern lookups are clamped; `configureTempoMap` does not validate that
  `atBar` increases (a non-monotonic map from JS would make `mapSegment(forGridPulse:)`
  choose wrong segments; `domain/playbackClick.nativeTempoMapSegments` is the only producer
  — unverified that it sorts, low risk). `pulsesPerBar` has no upper clamp (loop buffer size
  = bar); JS presets cap it at 12.
- File handles: zip writers close on finish/abort; `FileHandle`/`RandomAccessFile` in
  `defer`/`use`. If JS dies between `zipCreateAsync` and finish, one handle lingers until
  process exit (acceptable).
- Main thread: Android `fireVibrator` is called from the handler thread (fine); iOS
  `scheduleHaptic` hops to main (fine). `renderTrim`/`extractAudioTrack` block on a semaphore
  on the render queue, not main.

**Recording crash recovery.** Solid: marker written right after native start (and again on the
first stream event), WAV placeholder headers repaired from file size at recovery
(`domain/wavHeader.ts`), temp file + marker preserved until `flushPersistedSnapshot()`
succeeds, journal fallback when the flush fails, in-session recovery before the next take.
The one hole is #2. A crash in the ms between native start and `persistPendingRecordingSession`
leaves an unmarked temp file (unrecoverable but unavoidable short of writing the marker
first with a provisional path).

**Solo mix.** `services/soloMix.ts` is correct: LRU of 4 rendered files keyed by the input
list, MRU-touched on reuse, evictions and `releaseSoloMixFiles()` delete only scratch files
(`solo-mix-*` in the renderer's temp dir), a failed render evicts its key, and
`usePlayerScreenLifecycle.ts:195-226` swaps the engine back to the real mix while unfocused
before the files go. `buildSoloMixInputs` keeps length by rendering silent inputs at −120 dB.
Only caveat: the rendered solo file inherits #6 (5 ms late on Android).

**Interruptions.**
- iOS playback: expo-audio pauses/resumes players on interruption and pauses on
  `.oldDeviceUnavailable`; the practice engine and metronome do not (#3, #9).
- iOS recording: audio-studio pauses on `.began`, auto-resumes 2 s after `.ended`
  (`AudioStreamManager.swift:173-235`); the app stops guide/click on the token and the user
  resumes capture. OK.
- Android playback: expo-audio handles focus loss/gain; no becoming-noisy (#8). The practice
  ExoPlayer handles focus (`setAudioAttributes(…, true)`) and reports `playWhenReady` so JS
  keeps "playing" during a transient loss and resumes after — acceptable.
- Android recording: audio-studio pauses on focus loss, resumes on gain with
  `autoResumeAfterInterruption` (`AudioRecorderManager.kt:2017-2047`). OK.
- Bluetooth switch mid-take: the recorder stamps `gridValidToMs` and warns (model l.1715-1735).

---

## Patches (`/patches`) — what each does, still needed?

| Patch | What it changes | Still needed at pinned version |
|---|---|---|
| `expo-audio+1.1.1` | Android: status loop only while playing + 1 s background cadence; lock-screen prev/next as standard commands; foreground-service grace/idle lifecycle; dismiss/task-removed teardown; stale card cancel. iOS: next/prev commands, now-playing push only on change, artwork cache. Types for `updateLockScreenOptions`/`lockScreenCommand`. | Yes — all of it is app behaviour the hooks depend on (`useFullPlayer` uses `lockScreenCommand`, `updateLockScreenOptions`, `setBackgroundUpdateInterval`). Must be ported on any expo-audio bump; nothing upstream provides it. |
| `@siteed/audio-studio+3.0.2` | Capture-start timestamps (AudioRecord.getTimestamp / AVAudioTime host time) exposed on stream events; stop no longer joins the loop under the lock; `setPreferredDevice` for the chosen input; one-line notification layout + MediaSession for headset keys + Live Updates promotion; no per-interval React dispatch. | Yes — the latency model and head-trim depend on `captureStartTimeEpochMs`. |
| `react-native-pitchy+1.2.0` | Replaces the naive autocorrelation with MPM/NSDF + clarity + level; Android AudioRecord lifecycle rewrite, UNPROCESSED source, 16 KB page alignment; iOS session re-assert, weak self in tap, sample-rate from buffer. | Yes — the tuner tracker consumes `clarity`/`level`. |
| `expo-file-system+19.0.24` | Loops `FileChannel.read/write` until full (short reads returned zero-padded buffers); drops the `publication` block. | Likely still needed; verify against upstream before bumping (the short-read bug was real; check expo-file-system ≥ 19.1 changelog). |
| `expo-haptics+15.0.8` | Runs haptics on the main queue instead of the shared module thread. | Yes (shared queue is also where the recorder/file system run). |
| `react-native+0.81.5` | `Text` gets `textAlign:'left'` under RTL so unaligned text mirrors. | Yes until RN fixes RTL default alignment on iOS. |
| `react-native-draggable-flatlist+4.0.3` | `getItemLayout`-based cell measurements; no auto-scroll jump on first drag frame. | Yes (project-specific). |
| `react-native-worklets+0.5.1` | Registers `WorkletsModule` as a lifecycle listener so the frame queue pauses in background. | Yes at 0.5.1; the comment says upstream registers in later releases — drop on bump. |
| `xcode+3.0.1` | Null-guards `pbxGroupByName(group)`. | Yes (build tooling). |

---

## Feature inventory (audio scope)

- Recorder page → Record / Pause / Resume / Save / Discard / Redo; count-in (0/1/2/4 bars);
  click-through-take with grid self-alignment; record-through pre-roll trimmed at save;
  input picker (built-in / wired / USB / Bluetooth); headset play/pause and the notification
  card pause/resume the take; background recording with foreground service; mid-take route
  change warning; takes survive a crash (recovered at next launch or next take).
- Recorder → Layer (overdub) mode: punch-in point snapped to bar, guide playback with
  latency-model start advance, measured self-alignment of the layer after save, Bluetooth
  ear calibration (tap test, per route/profile, ± fine tune).
- Player page → play/pause/seek/scrub, prev/next queue, repeat, lock-screen & headset
  controls (prev/next/scrub), background playback (Android media card with 30-min idle end);
  practice mode: speed 0.5–2×, pitch ±12 semitones (native engine with muted twin), loop,
  playback click with count-in and haptic, Sound room (level ±12 dB, low-cut/low-boost/
  mid-boost/hi-cut); Layers lanes: solo (switch, rendered solo mix), mute, nudge ±10/25 ms,
  merge layers, rendered mix self-heal.
- Editor → trim / cut / extract ranges rendered natively (AAC), pitch/speed render for export.
- Metronome page → BPM (slider, ± nudge, tap tempo), 8 meters with groupings/feels, custom
  accent/rests, subdivision 1–4, click vs wood voice, outputs: click volume / visual / haptic
  strength, count-in bars; keeps the screen awake while running.
- Tuner page → chromatic tuner (27.5 Hz–2 kHz), clarity-gated note lock, in-tune haptic,
  auto-restart after route loss.
- Import → audio files, videos (sound extracted), AIFF (iOS, converted), background duration
  probe + waveform hydration with sidecars; share single clip / zip bundle; native stored-zip
  backups and restores.
