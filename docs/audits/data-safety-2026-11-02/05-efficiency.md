# 05 — Efficiency audit: memory, CPU, battery (2026-11-02)

Scope: every screen in `src/components/**`, `src/hooks/**`, `src/services/**`, `src/state/**`,
domain hot paths, `App.tsx`, native modules (`modules/songnook-*`, Swift + Kotlin), `patches/*`,
plus the `node_modules` code those patches sit on (`@siteed/audio-studio`, `expo-audio`).
Read-only; nothing measured on a device. Confidence labels: **verified** = read in the code
path end to end; **plausible** = code is clear, the size of the cost needs a device;
**speculative** = depends on platform behaviour I could not confirm.

History read first: `project_background_cpu_2026_10_02`, `project_ui_lag_audit_2026_09_24`,
`project_js_thread_exam_2026_09_29`, `project_large_library_perf_2026_09_21`,
`project_android_sleep_after_queue`, `project_android_media_card_leak`,
`project_playback_stability_architecture`, `project_recorder_latency_2026_10_17`,
`docs/performance-audit.md`. Fixed items are not re-reported; the fixes that still hold are
listed at the end.

Scale used for estimates: a 2,000-clip library in one workspace. The repo's own measurement
is 324 ideas = 893 KB persisted (~2.75 KB per idea, peaks inline), so 2,000 ideas is about
**5.5 MB per workspace shard**.

---

## Summary

| # | Sev | Finding | Conf. |
|---|-----|---------|-------|
| E1 | HIGH | iOS recorder disables auto-lock for the whole take (`keepAwake: true` → `isIdleTimerDisabled = true`) | verified |
| E2 | HIGH | Every library write re-stringifies the whole workspace shard (peaks inline); 5.5 MB per write at 2,000 clips, up to every 0.8–4 s | verified |
| E3 | HIGH (large imports) | Waveform backfill flushes every 4 clips, so a big import triggers hundreds of full-shard writes plus the full collection pipeline | verified |
| E4 | MEDIUM | First write of every session rewrites every workspace shard (refs never seeded after hydrate) | verified |
| E5 | MEDIUM | Shadow manifest: full-library stringify + copy + move every 15–45 s while editing, and on every backgrounding | verified |
| E6 | MEDIUM | `@siteed` JS hook copies the whole take's analysis array on every 75 ms event (quadratic over a take) | verified |
| E7 | MEDIUM | Reel frame callbacks stay active while the player is docked and hidden, or paused (frames requested every vsync) | verified / plausible |
| E8 | MEDIUM | Metronome engines poll at 8 ms (125 Hz) on both platforms for as long as the click runs, including background | verified |
| E9 | MEDIUM | iOS expo-audio status fires at 20 Hz into JS while playing with the screen locked (Android got a 1 s background cadence, iOS did not) | verified |
| E10 | MEDIUM | `recordTrace` rAF loop leaks when a record start fails (several early `return`s skip `endRecordTrace("rec")`) | verified |
| E11 | MEDIUM | iOS seal/open (Send) and zip SHA path build autoreleased buffers outside a pool → memory can grow to file size | plausible |
| E12 | MEDIUM | Recorder save copies the take (not move); a 1-hour WAV is ~318 MB × up to 3 copies on disk | verified |
| E13 | MEDIUM | iOS lock-screen remote command targets accumulate (`addTarget` per activation, `removeTarget(self)` removes nothing) | verified (effect on device: plausible) |
| E14 | LOW–MED | Live playback position still written into the main persisted store at ~6 Hz (old audit item A) | verified |
| E15 | LOW–MED | Hydration's idle wait polls every 250 ms through long playback (45 s windows + 15 s backoff, repeating) | verified |
| E16 | LOW–MED | Lyrics autoscroll is a 50 ms JS `setInterval` + `scrollTo`, not paused off screen | verified |
| E17 | LOW | Smaller items (L1–L12 below) | mixed |

---

## HIGH

### E1 — iOS: the screen never auto-locks while recording (HIGH, verified)

`src/hooks/useRecording.ts:525`
```ts
      keepAwake: true,
```
`node_modules/@siteed/audio-studio/ios/AudioStreamManager.swift:491-500, 1093`
```swift
    private func enableWakeLock() {
        guard let settings = recordingSettings,
              settings.keepAwake, ...
            UIApplication.shared.isIdleTimerDisabled = true
...
        do {
            enableWakeLock()
```
- **Scenario:** a 1-hour rehearsal recorded with the phone face-up on a music stand. On iOS the
  screen stays lit for the full hour with the recorder rendering (live tape frame callback every
  vsync, about 8 React commits/s). Android maps the same flag to a `PARTIAL_WAKE_LOCK`, which
  keeps the CPU awake but lets the screen turn off. That is the correct behaviour.
- **Impact:** on an iPhone the screen plus GPU is the largest battery draw. An hour of screen-on
  recording costs several times what a screen-off take costs. No doc in `docs/` asks for the
  screen to stay on (Voice Memos lets it lock).
- **Why it's not a one-line flip:** the same `keepAwake` flag also decides whether @siteed iOS
  *pauses* the take when the app backgrounds (`AudioStreamManager.swift:396-404`: "keepAwake is
  false … pausing recording"). Setting it to false would stop takes on lock, which would be a
  data-loss bug.
- **Fix:** patch @siteed iOS so `enableWakeLock()` is a separate option (or a no-op), and keep the
  "continue in background" behaviour tied to `keepAwake`. Decide with the founder whether the
  recorder should hold the screen on only while the recorder page is in front.

### E2 — Whole-shard JSON per library write (HIGH at 1k+ clips, verified)

`src/state/persistSharding.ts:111-119`
```ts
        if (lastWorkspaceRefs.get(workspace.id) !== workspace) {
            dirtyWorkspaceRows.push({
                key: workspaceRowKey(storeName, workspace.id),
                value: JSON.stringify(workspace),
```
`src/state/useStore.ts:313,317`: `PERSIST_WRITE_DEBOUNCE_MS = 800`, `PERSIST_WRITE_MAX_WAIT_MS = 4_000`.
`src/types.ts:472,529`: `waveformPeaks?: number[]` still lives inside every clip.
- Sharding is per workspace, and most people keep one workspace. Any edit (pin, rename, stage, tag,
  a hydration flush, a take save) re-serializes that whole workspace. At 2,000 clips that is
  about 5.5 MB, and more than half of it is peak arrays (per `project_large_library_perf`). The
  meta row is rewritten on every write too, and it carries notes, ladders, sparks, playlists,
  songbooks and setlists (`persistSharding.ts:61 "always written"`).
- **Impact:** the repo measured 163 ms for 893 KB (dev, Mac). Linear extrapolation puts 5.5 MB at
  roughly 0.2–1 s of blocked JS per write on a mid Android release build. Edits during playback
  or right after a take land as visible hitches. `save.flush` (`useRecording.ts:1153`) awaits one
  of these during every take save. Memory: the 5.5 MB string, plus the native copy for SQLite,
  plus the object graph.
- **Fix (already on the deferred list as "E2 peaks into own rows"):** move peaks out of the
  workspace JSON into their own table (1 byte per peak, written once per clip), or shard per idea
  (row per idea, re-written by identity). Either one cuts the per-edit cost to one idea's size.

### E3 — Waveform backfill turns a big import into hundreds of full writes (HIGH for imports, verified)

`src/services/backgroundWaveformHydration.ts:88-89`
```ts
const HYDRATION_WRITE_FLUSH_SIZE = 4;
const HYDRATION_WRITE_FLUSH_DELAY_MS = 1500;
```
- Each flush calls `appActions.hydrateClipsAudioMetadata(batch)`, which is a library write. That
  write (a) re-runs every mounted `workspaces` subscriber, (b) forces a new
  `getIdeaIndex` (`librarySelectors.ts:41`, a full Map rebuild per `workspaces` identity), and
  (c) schedules E2. The size was cut from 48 to 4 on 2026-10-03 so waveforms appear sooner.
- **Scenario:** importing 2,000 voice memos. The backfill decodes one clip about every 0.5–1.5 s
  (decode plus the 250 ms yield), so a flush lands every 2–6 s for about 30–60 minutes. Each one
  produces a 5.5 MB stringify and SQLite write, plus a manifest write every 15–45 s (E5). The
  collection screen's filter/sort runs over all ideas each time (about 41 ms at 337 ideas in dev,
  so about 250 ms at 2,000; still deferred per `ui_lag_audit`). Cost: sustained CPU, write
  amplification on flash, and a warm phone during the first session after a big import.
- **Fix:** keep the fast visual (rows can read freshly computed peaks from a small in-memory
  overlay map keyed by clipId), but commit to the store/persist in larger batches (e.g. 48 or
  every 20 s), and flush on drain. Or land E2's peaks table, and a hydration write then touches
  only the peaks rows.

---

## MEDIUM

### E4 — The first write of every session rewrites all shards (verified)

`src/state/shardedPersistStorage.ts:68` `let lastWorkspaceRefs = new Map<string, Workspace>();`
and `:193` "Don't seed lastWorkspaceRefs — post-hydrate sanitize creates" new identities.
`useStore.ts:502` `merge` → `sanitizePersistedState` → `normalizeWorkspaces` (new objects for all).
- The first persisted change after launch serializes every workspace, archived ones included, plus
  the activity row. At 2,000 clips that is the full library (about 5.5 MB or more) once per
  launch, usually at the first tap that edits anything.
- **Fix (deferred "E4 seed shard refs after hydrate"):** after hydration, seed `lastWorkspaceRefs`
  with the sanitized workspaces whose serialized form equals the row read. A cheap version: seed
  with the post-sanitize refs and accept that sanitize's no-op normalizations aren't re-written.

### E5 — Shadow manifest re-serializes the whole library (verified)

`src/services/manifestSync.ts:179` `const json = JSON.stringify(manifest);` (all workspaces,
activity events and settings), then `:191` `copyAsync` of the previous manifest to a backup,
`deleteAsync`, `moveAsync`, `deleteAsync`. Cadence `DEBOUNCE_MS = 15_000`, `MAX_WAIT_MS = 45_000`
(`:226,230`), and `:295` an immediate (not interaction-gated) write on every
`nextState !== "active"` (this includes iOS "inactive" from Control Center or the app switcher).
- **Impact:** about 6 MB of JS stringify plus about 12 MB of file I/O every 15–45 s while editing, and
  on every trip to the background. It is change-gated (good), so playback alone does not trigger
  it.
- **Fix:** write the manifest only on `background` (not `inactive`), and on a longer timer (e.g.
  5 min), or make it per-workspace files keyed like the shards so only dirty workspaces are
  rewritten. Replace copy+delete+move with a rename-swap (`move` old → `.backup`, `move` tmp →
  manifest), which avoids copying 6 MB.

### E6 — @siteed's JS hook copies the full take analysis every 75 ms (verified)

`node_modules/@siteed/audio-studio/src/useAudioRecorder.tsx:235-264` (not covered by our patch,
which only removed the React dispatch):
```ts
            const fullCombinedDataPoints = [
                ...(fullAnalysisRef.current?.dataPoints ?? []),
                ...analysis.dataPoints,
            ]
            ...
            fullAnalysisRef.current = { ...fullAnalysisRef.current, dataPoints: fullCombinedDataPoints }
```
With `intervalAnalysis: 75` / `segmentDurationMs: 75` (`useRecording.ts:518-519`), a 1-hour take
holds about 48,000 data-point objects, and every event copies the whole array.
- **Impact:** about Σk ≈ 1.15 × 10⁹ element copies over an hour. Near the end of the hour that is a
  384 KB array allocated 13 times a second (about 5 MB/s of large-object garbage), which drives
  repeated full GCs over a heap that also holds the library. Expect periodic JS stalls during
  long takes (in background too), with retained memory of about 15–25 MB for the points.
- **Fix:** patch the hook to `push` into a mutable array (`fullAnalysisRef.current.dataPoints.push(...analysis.dataPoints)`),
  or keep only the `{amplitude, rms/dB}` the save actually reads (`useRecording.ts:1068-1072`
  maps `dataPoints` → levels) in a preallocated `Float32Array`.

### E7 — Reel frame callbacks run while the reel is hidden or idle (verified loop; battery plausible)

`src/components/visualizers/PlaybackTapeVisualizer.tsx:1207-1211`
```ts
    useForegroundFrameCallback((frameInfo) => {
        "worklet";
        if (stageVisible && !stageVisible.value) {
            stageWasHidden.value = true;
            return;
        }
```
and `:1739-1741` (the second callback, same early return). `useAppForeground.ts:49` only toggles
`setActive` on AppState.
- The docked PlayerScreen stays mounted for the whole session (founder rule, so keep that). The
  callbacks return early but stay active, so the UI thread is woken every vsync (60–120 Hz)
  whenever a clip is loaded in the dock in the foreground, even when it is paused and the reel is
  out of sight. `LiveTapeVisualizer.tsx:135` does the same on the recorder screen between takes
  ("parked" early return at `:186`).
- **Fix:** drive `frameCallback.setActive()` from `stageVisible && (playing || gesture || settle)`
  (a `useAnimatedReaction` that `runOnJS`es the toggle, or expose `setActive` through the reel
  stage context). Keep the "gap re-sync on the first frame back" logic as it is.

### E8 — Metronome poll at 125 Hz on both platforms (verified)

iOS `modules/songnook-metronome/ios/SongNookMetronomeEngine.swift:77`
`private let pollIntervalMs: Double = 0.008` (seconds, so 8 ms) and `:703-711`
`timer.schedule(deadline: .now(), repeating: pollIntervalMs)` (no leeway).
Android `SongNookMetronomeEngine.kt:128` `private val pollIntervalMs = 8L`, `:198-207`
`postDelayed(this, pollIntervalMs)`; the map writer also runs at 8 ms (`:174-186`).
- **Scenario:** a 1-hour practice with the metronome page open, or a long take with click. That is
  125 wakeups/s for the whole session, screen on or locked, which stops the CPU from reaching deep
  idle. Each tick reads `lastRenderTime`/`playbackHeadPosition` and usually finds nothing to emit.
- **Fix:** the next pulse's time is known. Schedule a one-shot timer for (next pulse − ~4 ms) and
  poll at 8 ms only in that small window, or keep 8 ms and add `leeway: .milliseconds(2)` on iOS.
  The beat is sample-scheduled in audio, so only the UI/haptic emit depends on this.

### E9 — iOS playback status at 20 Hz into JS with the screen locked (verified)

`node_modules/expo-audio/ios/AudioPlayer.swift:302-313`: `addPeriodicTimeObserver(forInterval:
interval, queue: nil)` → `updateStatus` → `emit` per tick. The 2026-10-02 patch added
`backgroundUpdateInterval` on **Android only**; `useFullPlayer.ts:239-240`
`setBackgroundUpdateInterval?.(...)` is a no-op on iOS.
- **Impact:** during a 2-hour locked playlist on iOS, the main thread builds the status dictionary
  and crosses into JS 20 times a second. JS throws the ticks away (`backgroundPosition.ts`), but
  the wakeups still happen. The sim measured about 3% here, which is small but continuous.
- **Fix:** mirror the Android patch. On `UIApplication.didEnterBackground`, swap the periodic
  observer to 1 s (or 0 when `holdBackgroundPosition` is active, the same rule as Android), and
  restore on foreground.

### E10 — `recordTrace` rAF loop leaks on a failed start (verified)

`src/services/recordTrace.ts:24-31` runs a `requestAnimationFrame` loop while a trace is open.
`useRecordingScreenModel.ts:2128` `beginRecordTrace("rec", …)` runs before
`:2201-2203` `if (!prepared) { return; }`, `:2228-2230` `if (!started) { … return; }`, and the
same at `:2338-2347`, `:2395-2410`. The only close is the `recording.isRecording` effect (`:1421-1423`).
`discard` is closed only inside `.then` (`:1514-1516`), so a rejected `cancelRecording` leaks too.
- **Scenario:** a first-time user taps record and denies the mic, or the mic is held by a call.
  The JS thread then wakes 60–120 times a second for the rest of the session until the next record
  tap supersedes the trace. Every `timedStep` meanwhile appends to `trace.parts` (unbounded). If
  audio keeps the app alive in the background on iOS, the memo notes that rAF spins back to back
  (about 1 core).
- **Fix:** the memo calls this TEMPORARY, and the phone data it was for came in (round 4).
  Remove `recordTrace`. If it stays, wrap the start in `try/finally { endRecordTrace("rec", outcome) }`
  and use `scheduleFrameOrBackgroundTick`.

### E11 — iOS Send seal/open and zip SHA allocate outside an autorelease pool (plausible; crash risk)

`modules/songnook-file-io/ios/SongNookSeal.swift:146` / `:176` read each 64 KiB record with
`input.read(upToCount:)` inside a `for` loop with **no** `autoreleasepool`. The zip writer in the
same module wraps the identical call (`SongNookFileIOModule.swift:255, 357`), so the author knew
about this pattern. In the zip path, `Base64Sha256.update` (`:73` `buffer = carry + data`, `:78`
`buffer.prefix(whole).base64EncodedData()`) runs *outside* that pool and allocates a 1.33 MB
base64 `Data` per 1 MB chunk. It also copies the 1 MB chunk on 2 of every 3 calls, because 1 MiB
mod 3 ≠ 0.
- **Why it matters:** each AsyncFunction is one GCD block, so the pool drains only when the block
  ends. On iOS versions where these Foundation calls return autoreleased NSData, sealing a 300 MB
  take for Send, or hashing it into a backup, holds up to about the file size (or 1.33× for the
  SHA) in memory until it finishes. Jetsam kills the app and the backup or Send fails. Restore's
  `extractRangeAsync` with `computeSha256` has the same SHA pattern. That one is a data-safety
  path: a restore killed mid-way relies on `cleanupInterruptedDisasterRecoveryRestores`.
- **Fix:** wrap each loop iteration (read + crc + sha + write) in `autoreleasepool {}`. Make
  `Base64Sha256` keep a 0–2 byte carry and hash `carry + data.prefix(k)` without copying the whole
  chunk (e.g. feed the carry bytes plus the first 1–2 bytes as a separate tiny update).

### E12 — The recorder save copies the take instead of moving it (verified; disk + time)

`src/services/audioStorage.ts:651-657`: move only when `ownsSource` (picker cache or converted
temp). Otherwise it copies:
```ts
            if (ownsSource) { await FileSystem.moveAsync(...) } else { await FileSystem.copyAsync(...) }
```
`importRecordedAudioAsset` (`:744-758`) never sets `discardSourceAfterImport`, so every take is copied.
With a head trim (`useRecording.ts:1027-1035`, `trimAudioRanges`) a 1-hour 44.1 kHz mono WAV
(~318 MB) exists 3 times at once: recorder temp, trimmed temp, managed copy.
- **Impact:** several seconds of I/O on the save path, under the 30 s `save.importAsset` timeout
  (`useRecording.ts:1090`). On a nearly full phone the copy fails with ENOSPC and the save
  fails. The take is still recoverable from the recorder temp file plus the pending marker (good),
  but the user sees a failed save. Battery and flash wear on every long take.
- **Fix:** move the *trimmed* temp into managed storage (the app owns it). Keep copying the
  untrimmed recorder file only while the recovery marker needs it, or move it too and repoint the
  marker before deleting.

### E13 — iOS lock-screen command handlers accumulate (verified code; device effect plausible)

`node_modules/expo-audio/ios/MediaController.swift:25-36` `setActivePlayer(player)` →
`enableRemoteCommands` → `:173-249` eight `addTarget { … }` closures, every call.
`:300-307` `disableRemoteCommands` does `remoteCommandCenter.playCommand.removeTarget(self)`. A
closure target is identified by the token `addTarget` returns, so `removeTarget(self)` removes
nothing. `useFullPlayer.ts:422-545` activates on every session start, inline hand-back, recording
end and return to foreground.
- **Impact:** the target list grows for the whole process. Each headset or lock-screen press runs
  every stacked closure, so `togglePlayPauseCommand` can toggle N times (an even N does nothing),
  and `nextTrack` emits N `lockScreenCommand` events to JS.
- **Fix (patch expo-audio):** keep the returned tokens and `removeTarget(token)`, or call
  `removeTarget(nil)` on each command before adding. Device-check AirPods double-tap after a few
  player opens and closes.

---

## LOW–MEDIUM

### E14 — Position ticks still go through the main persisted store (verified)
`useFullPlayer.ts:322-349` publishes `setPlayerPlaybackState` at ≥150 ms or 250 ms of movement;
`useInlinePlayer.ts:286-292` on every throttled tick. Each `set()` runs every mounted `useStore`
selector, `partialize` (`useStore.ts:501`, a 60-field object), `persistedSnapshotChanged`, and the
manifest subscriber's change detector. All are cheap individually, but they run at about 6 Hz for
the whole of any playback. Some selectors that run per tick are linear, e.g. the dock's
`findIdeaInLibrary([workspace], …)` (`GlobalMediaDock.tsx:246-249`, O(ideas)). **Fix:** move
position and duration to a tiny non-persisted store or shared values (`docs/performance-audit.md` §A,
still open).

### E15 — Busy-wait polling during long playback (verified)
`src/services/audioForegroundActivity.ts:84-98` `waitForForegroundAudioIdle` loops
`setTimeout(…, 250)` for up to 45 s, then the job reports busy, then a 15 s backoff, then it repeats.
While any backfill is pending, a long listen keeps a 4 Hz JS timer alive (paused on Android in
background, not on iOS with audio). **Fix:** await an `onForegroundAudioIdle` event, since the
module already has listener plumbing (`onRecordingActivityChange`).

### E16 — Lyrics autoscroll ticks 20×/s from JS, also off screen (verified)
`src/components/PlayerScreen/PlayerLyricsPanel.tsx:189` `setInterval(…, 50)` + `scrollTo`. It is
gated on `isExpanded && canAutoscroll && isScrolling` but not on AppState, so it keeps running with
the screen locked during practice. **Fix:** Reanimated `scrollTo` from a
`useForegroundFrameCallback`, or pause the interval on `background`.

---

## LOW

- **L1 Lyric Pad list not virtualized.** `NotepadScreenContent.tsx:586-640` maps every note, ladder
  and spark in a `ScrollView`. `selectedNoteIds.includes(...)` per row is O(n²) in selection mode.
  Fine at tens of notes; switch to `SectionList` if counts reach the hundreds.
- **L2 Select-all is O(n²).** `CollectionFilterSection.tsx:18`
  `selectableListIdeaIds.every((id) => selectedListIdeaIds.includes(id))`. That is about 4 M
  comparisons per render at 2,000. Use `getIdSet` (already exists in `librarySelectors.ts`).
  Move/copy actions in `actions.ts:2641-2946` do `clipboard.clipIds.includes` inside filters over a
  workspace, so they are O(N×M) too.
- **L3 Pushed-page headers subscribe to the whole library.** `src/hooks/useOriginLabel.ts:43`
  `useStore((s) => s.workspaces)` re-runs `resolveOriginLabel` on every library write for every
  mounted pushed page. Select only the label inputs (title by id) shallowly.
- **L4 Root stack is not frozen.** Only drawer screens have `freezeOnBlur` (`App.tsx:188`), so the
  focused collection list under a pushed sketch or player re-derives on every write (E3 magnifies
  this). Already deferred; listed so it is not lost.
- **L5 Fonts.** `App.tsx:861-893` registers about 29 font names from 14 files at every launch (the
  same TTFs under alias names). Embed them at build time with the `expo-font` config plugin to
  take this off the startup path.
- **L6 All five locales are eager.** `src/i18n/instance.ts:3` imports `resources` (de/es/pt ≈ 3.7k
  lines each). That is roughly 1–2 MB of heap for languages not in use. Lazy-load the inactive
  ones.
- **L7 Base64 hashing reads the whole file into JS.** `src/services/fileHashing.ts:23,43-48` reads
  files up to 64 MB as a base64 string (~85 MB), then passes it to `digestStringAsync` (another
  native copy). Used now only by the backup probe (the smallest file, `disasterRecoveryBackup.ts:540`)
  and the restore fallback (`disasterRecoveryRestore.ts:401,464`). On an old build without the
  native module, that fallback hashes every file this way, a 150–250 MB transient on a low-end
  Android **during a restore**. Lower the cap to about 8 MB and use the streaming path above it.
- **L8 Practice-engine state tick.** 10 Hz to JS while playing (`SongNookPitchShiftPracticeEngine.kt:34,65`,
  iOS `Timer` `:536`), including when backgrounded. Throttle to 1 Hz off screen, as the Android
  expo-audio patch does.
- **L9 Metronome per-beat JS work.** Each beat triggers a re-render of the owner via `setBeatCount`
  (`useMetronome.ts:529`), a `setTimeout` per visual pulse, and a native `getGridAnchor` per bar
  (`:200-262`), screen locked or not. Skip the visual scheduler and `beatCount` renders in
  `background`.
- **L10 Non-full players keep their foreground cadence in the background on Android.** The inline
  player is at 100 ms (`useInlinePlayer.ts:57`), the editor at 33 ms (`EditorScreen/index.tsx:150`).
  Only `useFullPlayer` sets `setBackgroundUpdateInterval`.
- **L11 iOS recorder prewarm holds an active PlayAndRecord session** (with `notifyOthersOnDeactivation`)
  the whole time the recorder sits idle. The mic stays closed (`audioEngine.prepare()`, not
  started) and it is released on `background`. The power cost is small. The side effect is that it
  ducks or stops other apps' audio when the recorder opens.
- **L12 Small leftovers.** `Spinner.tsx:36` `withRepeat` isn't foreground-gated (fine now that the
  worklets lifecycle patch pauses Android). `SoundChainAudioProcessor.isActive() = true` processes
  every buffer even at neutral/0 dB (`SoundChainAudioProcessor.kt:96`; amortized O(1) per frame,
  negligible). Android `SongNookSeal.cipher()` builds a new `Cipher` per 64 KiB record (CPU only).
  `audioSession.ts` never deactivates the session after last-owner release (it re-applies a role
  instead).

---

## Crash or OOM risk during save, record, backup or restore (data-safety cross-reference)

| Where | Risk | Ref |
|---|---|---|
| Take save on a full phone | Up to 3 full copies of a long take (E12). ENOSPC fails the save; the take survives in the recorder temp file plus the marker. Recoverable, but alarming. | `audioStorage.ts:651-657`, `useRecording.ts:1027-1095` |
| iOS backup/restore of large files | Autorelease growth in the zip SHA path, and restore `extractRangeAsync` (E11). A jetsam kill mid-restore leans on the interrupted-restore cleanup. | `SongNookFileIOModule.swift:73-86, 255, 357` |
| iOS Send of a long take | Seal loop without a pool (E11). Send fails; no library data at risk. | `SongNookSeal.swift:130-180` |
| Restore fallback (old build or hash mismatch) | 64 MB files read as base64 into JS (L7). | `fileHashing.ts:43-48` |
| Long takes (1 h+) | Quadratic JS analysis copies plus GC churn (E6). Stalls, not a crash, at realistic lengths. 3-hour takes triple it. | `useAudioRecorder.tsx:235-264` |
| Save at 2,000 clips | `save.flush` stringifies about 5.5 MB synchronously (E2). It is a stall, not an OOM. | `useRecording.ts:1153`, `persistSharding.ts:117` |

No path found that loads a whole audio file into JS on record or save. The onset envelope is
capped at 600 k bins (`onsetEnvelope.ts:41`), the live tape keeps a 12 s window
(`recordingTakeSession.ts`), and native recording buffers are reset per emission
(`AudioRecorderManager.kt:1604,1651`).

---

## Startup and resume inventory

Launch (after hydrate, `App.tsx:1280-1432`):
1. Hydrate: read the meta row, the activity row and every workspace row, `JSON.parse` them, then
   `sanitizePersistedState` normalizes the whole library (`useStore.ts:502`, O(N) allocations) and
   rebases media URIs.
2. ~29 font registrations (L5), all locales (L6), persist-log read (40 KB).
3. Sweeps, all bounded: share temp, DR temp, interrupted restores, trash restore
   (O(trash), `managedMedia.ts:217-262`), purge expired trash, archive resume, picker cache.
4. `enqueueMissingMetadataBackfill`: one O(clips) scan. Clips over 30 minutes never get real peaks,
   so they re-enqueue on every launch and retry 3 times each (cheap, since the duration is known
   and there is no decode). Paced 1.5 s start plus 250 ms per job.
5. `recoverStrandedDrafts`, `recoverPendingRecordingSession` (copies a pending take, E12),
   manifest freshness (mtime-gated before parsing, good), billing init.
6. The first persisted change rewrites every shard (E4).

Resume and background: `useStore.ts:444` passive flush, `manifestSync.ts:295` immediate full
manifest (E5), persist-log flush, iOS recorder prewarm release or re-prepare, lock-screen re-claim
(E13 adds targets).

---

## Fixes from earlier passes, re-checked and still holding

- Worklets lifecycle patch (`patches/react-native-worklets+0.5.1.patch`), and
  `useForegroundFrameCallback` on both tapes (`useAppForeground.ts:48-57`).
- NowPlayingIndicator on one Skia canvas, foreground-gated (`NowPlayingIndicator.tsx:35-56`).
- iOS `updateNowPlayingInfoIfChanged` with cached artwork (expo-audio patch, MediaController).
- Android expo-audio: status loop `while (playing)`, background cadence, media FGS left on pause,
  idle end, teardown symmetry (patch lines 61-156, 174-604).
- `scheduleFrameOrBackgroundTick` in the take clock and the reader follow.
- Persist skip on transient-only sets (`useStore.ts:420-428`), passive scheduler ordering, sharded
  writes, activity in its own row, debounced drafts (`useDraftText`).
- Recording pre-empts decodes and holds hydration flushes (`backgroundWaveformHydration.ts:111-131`),
  native decode on its own queue (`SongNookPitchShiftModule.kt:124-125`), one decode per clip,
  epoch cancel.
- Tuner stops listening on blur and on background (`useTunerScreenModel.ts:365-385`).
- Metronome page stops the engine on blur. Keep-awake is held only while beating, on music-stand
  pages while focused, and during backup or seal, and is always released.
- Send upload is an upload task (streamed, cancellable, 15 min ceiling). Download has a 30 s stall
  watch. Sealing on Android streams.
- The collection list uses `getItemLayout`, `initialNumToRender 6`, `windowSize 7`
  (1 while scrubbing), id-keyed rows, and meta cached by identity. The queue panel uses a fixed
  row height and `getItemLayout`.

## Solid (checked, nothing to do)

- Native waveform decode streams on both platforms: two `numberOfPoints` arrays, no PCM
  accumulation (`SongNookPitchShiftRenderer.swift:594-666`, `.kt:876-927`).
- Offline renders (pitch, mix, trim) stream through 4096-frame buffers (`SongNookPitchShiftRenderer.swift:60-110`).
- Native zip writer and extractor: 1 MB chunks, the read in `autoreleasepool`, raw writes, progress
  every 4 MB, cancellable (both platforms).
- Android seal/open: one reused 64 KiB buffer, buffered streams, `use {}` closes everything.
- Sidecars: 8-bit JSON of about 5 KB, LRU 24 in memory, read rather than decoded when present.
- Solo mixes: LRU of 4 renders, deleted on eviction and on player exit.
- Tempo and layer-alignment decodes are bounded (30 s at 8 kHz, 20 s span).
- `getIdeaIndex` / `getIdSet` WeakMap indexes, `selectIdeaById` O(1) per row.
- Search caps at 30 per group, activity range results at 60, activity events at 2,000.
- `persistLog` is a 400-entry ring with a 2 s trailing flush.
- No `JSON.parse(JSON.stringify)` clones on hot paths (one, in `workspaceArchive.ts:69`, is on the
  archive path only). No polling `fetch` loops. Word tools and Magpie fetch on demand, with a
  lookup cache.
- Dev monitors (`jsStallMonitor`, `commitProfiler`) are `__DEV__`-only. Release builds strip
  `console.log` (`babel.config.js`).
- Recording on Android: `PARTIAL_WAKE_LOCK` plus a microphone FGS, separate from the media
  session. The notification refreshes at 1 Hz with no waveform.

## Suggested order

1. **E1** (patch @siteed iOS idle timer; founder call on screen-on), **E10** (delete
   `recordTrace`), **E13** (expo-audio token removal). These are small and native or JS-only.
2. **E3** (batch hydration commits with an in-memory overlay), **E5** (manifest on background
   plus longer timer, rename-swap), **E4** (seed refs). JS-only, OTA-able.
3. **E2** (peaks out of the workspace JSON). This is the structural fix that makes 2,000+ clips
   cheap. It is a data-safety core change: copy → verify → remove, plus backup/restore coverage.
4. **E6, E11, E12** (patches and native), then **E7, E8, E9**, then the LOW list.
