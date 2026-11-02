# 10 — App lifecycle, interruptions and overlapping operations (second pass, 2026-11-02)

Read-only audit. Severity key as in 01: **CRITICAL** = realistic silent loss · **HIGH** = loss in a
plausible edge case · **MEDIUM** = inconsistency / recoverable / narrow · **LOW**.
Confidence: **verified** (read in code, including RN / native module source), **plausible**
(each link read in code, chain not reproduced on a device), **speculative** (depends on platform
behaviour I could not confirm). First-pass findings are not repeated; where this pass changes
their weight, see "Evidence that moves earlier findings".

## Summary

| # | Sev | Finding | Confidence |
|---|---|---|---|
| H1 | **HIGH** | Android: an activity recreation (unfold, font/display size, language, some split-screen, "Don't keep activities") remounts the React tree inside the live JS session. The whole launch sequence reruns: it "recovers" the live take and deletes the file the recorder is writing, wipes an in-flight restore's files, sweeps picker copies under an import, resumes archive ops concurrently. The take loses its UI; the next record tap stops it and clears its marker | plausible (every link read in code) |
| H2 | **HIGH** | A **Replace** restore says "Minimize to keep working", then discards everything done meanwhile (words, notes, edits, imports) with no notice | verified |
| M1 | MEDIUM | A full disk mid-take truncates the take silently (iOS swallows write errors; Android's capture thread dies while JS still shows "recording"). Backup, archive and export all need library-sized temp space and are not gated against recording | verified (code); trigger plausible |
| M2 | MEDIUM | An archived workspace still accepts writes (import chunks, layer saves). Unarchive rebuilds from the package snapshot and drops them, so the clips disappear and their audio is orphaned | verified (code); trigger rare |
| M3 | MEDIUM | iOS: no background execution time for any long operation (no `beginBackgroundTask` anywhere). Most operations are journaled. Import is not: a kill mid-import leaves a silent partial batch and orphaned copies | verified |
| M4 | MEDIUM | iOS: capture can stall with no observer (no `AVAudioEngineConfigurationChange` or media-services-reset handling; after an interruption JS drops the recording session owner while native auto-resumes). The clock is wall-time, so the screen keeps "recording" | speculative, needs device test |
| L1 | LOW | Changing the app language reloads JS (`Updates.reloadAsync`) without stopping the recorder, flushing persistence or checking a running library process | verified |
| L2 | LOW | Interruption during a layer punch: JS stops the guide, but native auto-resumes (iOS) or never pauses (Android: phone state blocked, no audio focus). The layer keeps recording off the song | verified (code) |
| L3 | LOW | Merge restore: imports that land after the commit snapshot are dropped (persistence blocked until reload), and their audio is orphaned | verified |
| L4 | LOW | A backup marks a file CRITICAL missing when an edit or delete moves it to the trash mid-backup, although the trash still holds it. Archive and delete aren't gated against a running backup | verified |
| L5 | LOW | The launch picker-cache sweep can race an early pick (share-intent cold launch, restore picked right away) | verified |
| L6 | LOW | No memory-warning handler: nothing flushes the pending write when iOS warns before jetsam | verified |

---

## HIGH

### H1. Android activity recreation reruns the launch sequence inside a live session

**Why it remounts.** The activity handles only
`keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode`
(`android/app/src/main/AndroidManifest.xml:34`, the Expo prebuild default; EAS regenerates it,
and no config plugin changes it). Changes to `smallestScreenSize`, `density`, `fontScale`,
`locale` or `layoutDirection` therefore **recreate the activity**. That covers folding or
unfolding a Fold/Pixel Fold, the system font or display size, the system or per-app language, DeX,
some split-screen resizes, and every return to the app when "Don't keep activities" is on.
Recreation does not restart JS. `ReactDelegate.onHostDestroy` → `unloadApp()` → `reactSurface?.stop()`
(`node_modules/react-native/ReactAndroid/.../ReactDelegate.kt:155-156, 324-325`), and the new
activity starts a new surface. **`App` remounts while every module-level store is still live.**

**What reruns.** `App` seeds `hasHydrated` from the live store (`App.tsx:1235`
`useState(() => useStore.persist.hasHydrated())` → `true`), so the launch effect
(`App.tsx:1280-1433`, deps `[hasHydrated]`) runs again at once, in the middle of whatever was
happening:

1. **The live take is "recovered" and deleted.** `recoverPendingRecordingSession()` (`App.tsx:1433`)
   reads the live take's marker. `recoverTake` has no "is a take live?" guard
   (`recordingRecovery.ts:267-345`). It finalizes the header of the file being written, imports a
   partial copy into the take's own empty shell idea, then `settleRecoveredTake` deletes the
   recorder file and clears the marker:
   ```ts
   if (tempUri && tempUri !== journal.audioUri) {
       await FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {});
   }
   ```
   (`recordingRecovery.ts:124-126`). The musician sees "Clip recovered" mid-performance. On Android,
   the native writer keeps appending to an unlinked file. **Everything played after the remount is
   lost.** 03 #3 describes the same race at launch; here it needs no user timing at all.
2. **The recorder loses its UI and its state.** `AudioRecorderProvider` (`App.tsx:1529`) remounts
   with `isRecording: false` (`@siteed/audio-studio/build/esm/useAudioRecorder.js:89-90`). Status
   sync only runs while that flag is already true (`:431-445`
   `if (state.isRecording || state.isPaused) { checkStatus(); … }`), so it never learns that native
   is still recording. Navigation is rebuilt from the startup state (Home), and the dock needs
   `recorder.isRecording` (`GlobalMediaDock.tsx:123-124`), so no surface shows the take.
3. **The next record tap kills what is left.** The cold start path skips its pre-stop because
   `recorder.isRecording` is stale-false (`useRecording.ts:790-797`). Native rejects with
   `ALREADY_RECORDING` (`AudioRecorderManager.kt:546-547`). `rollbackFailedRecordingStart` then
   **stops the running take and clears the marker** (`useRecording.ts:487-500`):
   ```ts
   if (nativeStartAttempted || recorder.isRecording || recorder.isPaused) { … await recorder.stopRecording(); }
   if (nativeStartAttempted) { await clearPendingRecordingSession() … }
   ```
   The finalized file stays in `filesDir` root, where no scan looks (03 #2). If step 1 didn't run
   (no marker yet), this step alone loses the whole take silently.
4. **An in-flight restore loses its files.** `cleanupInterruptedDisasterRecoveryRestores`
   (`App.tsx:1288`, `disasterRecoveryTemp.ts:174-209`) has no "restore running" guard. The token
   isn't referenced yet and the journal says `writing`, so it deletes every destination written so
   far, removes the `restored-<token>/` directories and deletes the journal. The restore keeps
   going (the native path verified each file when it wrote it; nothing re-checks before commit) and
   commits a snapshot that points at the deleted files. The result is a restored library with dead
   clips. Under Replace, the originals are never quarantined, because the journal is gone. They
   linger as orphans.
5. `sweepPickerCache()` (`:1299`) deletes `Caches/DocumentPicker` under a running import (later
   files fail as "unsupported") or a running restore. `resumePendingWorkspaceArchiveOperations()`
   (`:1294`) runs a second unarchive extraction to the same target files while the live one writes,
   and either one's failure rollback deletes the other's output (compounds 03 #5).

Also lost on remount: the lyric-version editor's `useState` draft (04 H3, with no kill needed), the
editor's unsaved edit ranges, and a pending import's duplicate review. `useDraftText` editors are
safe, because they flush on unmount.

**Confidence:** plausible. The remount (RN source), the effect rerun, the provider state and the
rollback are all verified by reading. Not reproduced on a device. The trigger is common on
foldables and for anyone changing font or display size while a take runs in the background.

**Fix:** (a) Add `smallestScreenSize|density|fontScale|locale|layoutDirection` to `configChanges`
through a config plugin (RN re-renders on these). (b) Run the launch sequence once per JS session
(a module-level flag), not once per `App` mount. (c) Have the provider call `status()` on mount to
adopt a running take. (d) `recoverTake` skips the live take's marker. (e) On `ALREADY_RECORDING`,
adopt the running take rather than stopping it and clearing its marker.

### H2. Replace restore invites work, then silently discards it

The restore takeover says `"Minimize to keep working. It waits at the bottom."`
(`locales/en.ts:1336`, shown at `LibraryProcessHost.tsx:277-293` for every process kind). Only
recording is blocked during a restore (`useRecording.ts:766-771`). Replace commits the backup's
snapshot alone (`disasterRecoveryRestore.ts:501-506`, `snapshotToCommit = … : prepared.snapshot`),
and the journal's displaced list is frozen at start
(`useLibraryBackupFlow.ts:362 displacedWorkspaces: useStore.getState().workspaces`).

**Scenario:** a 3 GB Replace restore takes several minutes. The person minimizes it and writes a
verse, renames ideas, imports two clips. At commit all of it is gone. The app restarts into the
backup's library. The shadow manifest is older than the commit, so no "newer copy" prompt appears
(`manifestFreshness.ts:76`). The imported audio sits unreferenced in `songnook/audio` (it is not in
the displaced list). Nothing tells the person.

**Fix:** for Replace, drop "keep working" (keep the takeover, or say plainly that changes made now
will be replaced). Better: diff the library against the start-time snapshot at commit and offer to
keep the newer items, as Merge does.

---

## MEDIUM

### M1. A full disk mid-take truncates silently, and nothing keeps space-hungry operations apart

- iOS writes each buffer in a `do/catch` that only logs (`@siteed/audio-studio/ios/AudioStreamManager.swift:1552-1560`
  `catch { Logger.debug("BG Write Error: …") }`). Audio is dropped while the live tape (fed from
  memory) keeps moving. If space frees, the file gets a silent splice.
- Android: an `fos.write` IOException (`AudioRecorderManager.kt:1578`) ends the capture thread
  with a log line only (`:1674-1679`). `_isRecording` stays true, so JS shows "recording".
- The duration is wall-clock (`AudioStreamManager.swift:336-350`), so the clock keeps counting.
- Record start checks 64 MB free (`useRecording.ts:832-840`); nothing checks during the take.
  Backup (a library-sized temp zip, 02 G2), archive and export all start while a take runs, and
  record starts while they run (the only gate is restore, `useRecording.ts:766`).

**Scenario:** a near-full phone (common). The person starts a backup, minimizes it, and records a
20-minute take. The backup's temp archive fills the disk at minute 6. The saved take is 6 minutes
long, and the performance after that is gone without a word.
**Fix:** check free space during the take; under ~100 MB, stop and save cleanly with a notice. Turn
a native write failure into an interruption event. Refuse to start backup, archive or export while
recording (and the reverse), or reserve the take's projected size.

### M2. Writes into an archived workspace are dropped at unarchive

Unarchive rebuilds the workspace from the package (`workspaceArchive.ts:187-195`, `...snapshotWorkspace`;
only the title and description come from the live stub). The repack check in `archiveWorkspace`
(`actions.ts:3061-3075`) covers only the packing window. After `setState` the stub keeps its
collections and accepts writes:
`importClipsToCollection` finds the collection in any workspace (`actions.ts:1016-1022`), and a
layer save attaches by idea id (`useRecordingScreenModel.ts:395`, `attachRecordedOverdubStem`).
Archive isn't gated against an import or a recording that targets the workspace.
**Scenario:** a 150-clip import into workspace W is running, and the person archives W. Later
chunks land in the archived stub. On unarchive they vanish; the audio stays in `songnook/audio`,
unreferenced.
**Fix:** refuse writes into an archived workspace (route them to the inbox), block archive while an
import or take targets it, and on unarchive keep stub ideas and clips the package lacks.

### M3. iOS gives no long operation background time; import is the one that isn't journaled

A grep of `src/`, `modules/` and `patches/` finds no `beginBackgroundTask`, `expo-task-manager` or
BGTask use. `UIBackgroundModes` is `audio` and `processing`, and the latter has no BGTaskScheduler
registration. Leaving the app suspends JS and native work within seconds unless audio is active.
Per operation:

| Operation | Killed while suspended | Verdict |
|---|---|---|
| Backup | temp zip swept by age at next launch; "last backup" unchanged | safe |
| Restore | journal → cleanup or finalize (`disasterRecoveryTemp.ts:174-240`, including kill between commit and mark) | safe |
| Archive / unarchive | op journal + `resumePendingWorkspaceArchiveOperations` | safe (03 #5 aside) |
| Send upload | background URLSession (`sendTransfer.ts:173`) | continues |
| Receive download | foreground, 30 s stall watch; link reusable | safe |
| Take save | recovery marker | safe (03 #1/#2 aside) |
| **Import** | up to 24 copied files buffered, plus any un-persisted chunk (≤ ~6 s passive window) orphaned in `songnook/audio`; no journal, no notice | **silent partial batch** |

The person believes 200 clips arrived; 150 did. The originals are still in Files/Photos, but nothing
says which ones are missing (`clipImportBatcher.ts`, `useCollectionImportFlow.ts:139-185`).
**Fix:** wrap import, backup, restore, archive and take save in a background task (a small native
helper). Give import a journal (its target list) and report "import stopped at 150 of 200" at next
launch.

### M4. iOS capture can stall unobserved (speculative)

The patched recorder observes interruptions and route-change disconnects only. There is no
`AVAudioEngineConfigurationChange` or `mediaServicesWereReset` observer (grep of
`node_modules/@siteed/audio-studio/ios`). On any interruption, JS releases the recording owner
(`useRecording.ts:617-619`), which applies the next session role through expo-audio. Native then
re-asserts `.playAndRecord` with mode `.default` and resumes 2 s after the interruption ends
(`AudioStreamManager.swift:215-235`). If the engine stops on a configuration change (AirPods
connecting mid-take, a later JS session change while no recording owner is registered), nothing
reports it, and the wall clock keeps the UI "recording".
**Fix / test:** on a device, connect AirPods and trigger Siri mid-take and compare the saved length
with the elapsed time. Add a JS watchdog: no audio-stream event for more than 2 s while recording
means show "stalled", fire `haptic.error()` and offer Save. Observe the two notifications natively.

---

## LOW

- **L1. Language change reload** (`i18n/locale.tsx:116-121` → `reloadApplication` → `Updates.reloadAsync()`,
  `:50-63`; confirm at `SettingsGeneralView.tsx:49-60`). It doesn't check the recorder (a minimized
  take continues while you are in Settings) or `useProcessStore`, and it doesn't await
  `flushPersistedSnapshot()`. The take is cut and recovered at relaunch, subject to 03 #2a. A
  running backup or import aborts (see M3). **Fix:** refuse while recording or while a library
  process runs, and flush before reloading.
- **L2. Interruption during a layer.** The screen stops the guide and metronome on any interruption
  (`useRecordingScreenModel.ts:2083-2103`). iOS natively auto-resumes the take
  (`autoResumeAfterInterruption: true`, `useRecording.ts:523`). On Android `READ_PHONE_STATE` is
  blocked (`app.json:88`) and focus strategy `"background"` requests no focus
  (`AudioRecorderManager.kt:1970-1974`), so the take never pauses for a call. The layer keeps
  recording against silence, and everything after the gap is off the song. Solo takes just record
  the call's silence. **Fix:** for overdubs, treat any interruption as stop-and-save (no
  auto-resume).
- **L3. Merge restore and late writes.** `currentSnapshot()` runs at commit
  (`disasterRecoveryRestore.ts:500`). Import chunks or recovery writes after it hit a blocked
  persist and vanish at the reload; their audio is orphaned. **Fix:** block import starts while a
  restore runs (record already is).
- **L4. Backup vs. trash.** The snapshot is taken at start (`disasterRecoveryBackup.ts:291`). An
  editor Replace or a delete during the backup moves the file to the trash, and the backup records
  it as CRITICAL missing (`:330-335`, native `:595-600`), marking itself incomplete although the
  bytes are on disk. Archive and delete are not gated against a running backup. **Fix:** fall back
  to the trash path when reading, or gate trash-moving operations while a backup runs.
- **L5. Picker sweep race.** `sweepPickerCache()` runs after the launch chain (`App.tsx:1299`),
  seconds into a big-library boot. A restore or import picked in that window loses its cache copy
  mid-operation. The failure is loud and the originals survive. **Fix:** skip the sweep while an
  import job or library process exists, or sweep only files older than the session start.
- **L6. No memory-warning flush.** Nothing listens for `AppState` `memoryWarning`
  (grep finds no handler). On iOS it often precedes jetsam in the foreground. **Fix:** call
  `passivePersist.flushNow()` and the manifest flush there.

---

## Evidence that moves earlier findings

- **03 #3 (launch recovery deletes the live take).** Navigation state is **never persisted**:
  `initialState` is always the generated startup state (`App.tsx:1064`), and
  `sanitizeNavigationState` / `isValidRestorableRootRoute` only filter that state (`:830`, `:367`).
  So "a relaunch can land straight on the recorder" does not hold; the launch race needs a quick
  manual tap. But H1 gives the same deletion a **deterministic** Android trigger with no tap at
  all. Keep it HIGH, and fix it with H1(d).
- **03 #1 / #2 (killed take lost).** Interruptions are the usual road into "killed mid-take". iOS
  pauses the take on interruption (`AudioStreamManager.swift:181-188`), so a backgrounded app with
  no active audio is suspended for the whole call and becomes a jetsam candidate. That makes the
  marker path more realistic than "phone died".
- **04 H3 (lyric draft).** Add the Android remount (H1) as a no-kill trigger.
- **01 L1 (no background time).** Confirmed repo-wide (M3). `processing` is declared without a
  BGTaskScheduler registration, which is also an App Review flag.
- **01 L3 (older bundle strips newer fields).** expo-updates' launch-failure rollback (a crash soon
  after an OTA launches → the previous bundle on next launch) makes "an older bundle hydrates data a
  newer one wrote" an expected event after a bad OTA. E4 shows the new bundle rewrites every shard
  on its first write. Consider MEDIUM.

## Solid (checked)

- **OTA never reloads mid-session.** No `checkForUpdateAsync`, `fetchUpdateAsync` or update-driven
  `reloadAsync` exists. The default applies the update at the next cold launch, with launch wait
  0 (`AndroidManifest.xml:31-32`). The only `reloadAsync`/`reloadAppAsync` calls are language (L1),
  the restore restart and erase.
- **No stale navigation params after a kill or restore**: navigation isn't persisted, and the
  startup collection is checked for existence (`App.tsx:800-810`).
- **No stuck "processing" state**: `useProcessStore` and `useImportStore` are in-memory only. One
  slot serves backup, export and restore. Restore and recording are gated both ways
  (`useRecording.ts:766`; `useLibraryBackupFlow.ts:337, 344, 417-426`).
- **Restore journal** survives a kill at any point, including between commit and
  `markCommitted` (a referenced token counts as committed, `disasterRecoveryTemp.ts:196-201`), and
  it never quarantines while a restored file is missing.
- **Archive** repacks if the workspace changed during packing, flushes strictly before moving files
  (`actions.ts:751-754`), and journals and resumes its cleanup.
- **Backup consistency:** one snapshot, and files that vanish or change mid-read are recorded as
  missing rather than skipped (`disasterRecoveryBackup.ts:595-600`). A native fingerprint is
  checked against JS.
- **Waveform backfill** applies only while the clip's `audioUri` still matches
  (`backgroundWaveformHydration.ts:146, 177, 215, 329`). Concurrent imports are safe (random-suffixed
  names). Mix re-render re-checks the clip and flushes before deleting the old mix.
- **Manifest** refuses writes while persistence is blocked (`manifestSync.ts:112`). The
  newer-manifest check is mtime-gated, so a restore doesn't trigger a false prompt.
- **Temp sweeps** (share, backup) are age-gated. `useDraftText` flushes on background and on
  unmount.
- **Android swipe-away mid-take:** the service's `onTaskRemoved` stops and finalizes the file, and
  the marker survives (`AudioRecordingService.kt:100-125`).
- **A take whose target vanished** mid-recording (deleted, or the workspace switched) is kept for
  recovery, not dropped (`useRecording.ts:1130-1141`).
- **Send** upload runs in a background session, and links are reusable, so an interrupted receive
  can be reopened.
