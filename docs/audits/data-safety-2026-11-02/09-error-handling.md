# 09 — Error handling, end to end (second pass, 2026-11-02)

Scope: crash containment, global handlers, swallowed errors, user feedback on failure, expected
external failures, retry semantics. Covers `src/**`, `App.tsx`, `modules/**`, `patches/**` and the
unpatched native code those patches sit on. Read-only. Findings in 01–06 are not repeated; where
this pass changes their severity, it says so.

Severity: CRITICAL = crash loop that locks users out of their data, or silent loss.
HIGH = success shown on failure, data not saved without saying so, or a crash on a plausible input.

## Summary

| # | Sev | Finding | Confidence |
|---|-----|---------|------------|
| 1 | **HIGH** (CRITICAL if a bad title reaches the startup page) | One root error boundary. Any render error replaces the whole app, and "Restart" re-renders the same data. A bad field in a workspace makes it crash on every launch with no way out: no backup, no export, no remove. Turns 06 #4 into a lockout | verified path; trigger plausible |
| 2 | **HIGH** | A full disk mid-take silently truncates the take (iOS and Android recorder). The timer keeps running and the save reports success | verified in library code; not reproduced |
| 3 | MEDIUM | Release builds lose almost every fatal JS crash record and every unhandled promise rejection. The on-device diagnostic log is blind to the failures that matter most | verified (RN source) / plausible (race) |
| 4 | MEDIUM | Async handlers with no try/catch fail silently in release. Example: every audio-import entry point when the picker throws (iCloud file offline, low storage, picker busy) | verified |
| 5 | MEDIUM | A 0-byte or corrupt audio file imports as a clip that can never play. Playback failures (missing or corrupt file) show nothing | verified |
| 6 | MEDIUM | Send: a finalize that succeeds on the server but times out on the client (8 s) leaves a live, counted link that is not in the outbox, so it can't be deleted. Retry builds a second link | verified (code); trigger plausible |
| 7 | MEDIUM | Import failures that aren't format problems (disk full, copy errors) have no message and no error haptic. The banner shows "8 of 10" in ink for 2.5 s. Receive: one bad file rolls back the whole parcel, and Retry fails the same way every time | verified |
| 8 | MEDIUM | Take save: when the flush fails and the journal write also fails (`.catch(() => {})`), the recorder temp file is deleted anyway, the marker dangles, and the user is told nothing | verified (01/03 touch it; the silence is new) |
| 9 | MEDIUM | "Recover files" says "Recovery complete · 1 warning" when a whole archive restore or the archive scan failed. The warning text is English and never shown | verified |
| 10 | LOW | Failure dialogs that skip the `error` haptic; English strings reaching the UI; "Copied" toast when the clipboard write failed; Retry offered where it can't help | verified |
| 11 | LOW | Native trap sites (Swift `fatalError`, `Int(Double)` on NaN, legacy `NSFileHandle` APIs in @siteed iOS). None is reachable from stored user data today | verified / speculative |

---

## 1. HIGH: one boundary, no way out, and a render crash from stored data repeats on every launch

**Where it sits.** `App.tsx:1524-1566`: `<AppErrorBoundary>` wraps the whole app inside
`LocaleProvider`/`GestureHandlerRootView`. Nothing below it has a boundary of its own
(`grep ErrorBoundary src` → only this one).

**What it offers.** `AppErrorBoundary.tsx:45` `handleRestart` bumps a key and remounts the
children. The copy promises:

> "Your clips and library are safe on this device — restarting brings everything back." (`:83`)

and the hint sends the user to "Settings → About" for the diagnostic log (`:116`). The screen has
no backup, export, safe mode or log share, and it can't reach Settings.

**Why Restart cannot help with a data-driven crash.** The zustand store is not reset, so the
remount renders the same data. Startup navigation is rebuilt from the last-used workspace
(`App.tsx:795-836`, `libraryNavigation.ts:370`, default `workspaceStartupPreference: "last-used"`,
`dataSlice.ts:1480`), and `setActiveWorkspaceId` makes any opened workspace the last-used one
(`dataSlice.ts:1528`). A cold relaunch does the same thing.

**A concrete trigger (raises 06 #4 from MEDIUM).**
- `libraryImport.ts:304` and `:751` copy `title: clipManifest.title` with no type check.
  `normalizeIdea`/`normalizeClip` (`dataSlice.ts:942-1060`) don't coerce titles.
- Every collection row calls `IdeaListItem.tsx:211` `isIdeaTitleAutoNamed` → `titleNaming.ts:44`
  `const trimmed = title.trim();`. A title of `null`, a number or an object throws
  `TypeError` in render.
- Steps: someone sends a `.songnook` (Send link or a shared file) whose manifest has
  `"title": null` (or an older or third-party writer leaves it out). The user taps Save, then
  opens the package (`ReceivedParcelSheet.tsx:137` → `setActiveWorkspaceId`). The boundary
  appears. Restart lands in the same workspace and throws again. Every cold launch does the same.
  Settings → Backup, Export, Erase and "Remove package" are all unreachable. The only way out is
  reinstalling, which deletes the library.
- Same class: `ClipCard.tsx:231`, `SongPagerStrip.tsx:82`, `SetlistDetailView.tsx:248`,
  `SongbookReaderScreen/index.tsx:38`. Also `localeCompare`/`toLowerCase` on titles in sorts and
  search (`useActivityScreenModel.ts:177`, `clipGraph.ts:77`, `ideaSearchMeta.ts:22`).

**Related.** A hydrate-time throw goes to the Retry-only screen instead (01 M4). Between them,
neither boot failure net offers a way to save the user's data.

**Recording.** A render error during a take unmounts `AudioRecorderProvider` (it sits inside the
boundary). The native recorder is left running with no UI. The take comes back only through the
pending-take marker on the next cold launch. *Speculative.*

**Fix.**
1. Sanitize at the import boundary (06 #4's strict schema). Also make `normalizeIdea`/
   `normalizeClip` coerce `title` to a string, so stored bad data heals at hydrate.
2. Give the boundary a way out. After a second catch in the same session, or a catch within
   10 s of launch, offer "Open on Workspaces" (clear `lastUsedWorkspaceId` and route to the
   workspace list), plus "Save a copy of my library" (the existing backup builder, which needs no
   screens) and "Share diagnostic log".
3. Add per-surface boundaries around the navigator's page content, so one bad card costs one
   page, not the app.

---

## 2. HIGH: a full disk mid-take truncates the take, and nobody says so

The recorder is `@siteed/audio-studio` (`useRecording.ts:4-10`). The patch changes only Android
files and two iOS timestamp hooks. The write paths below are upstream code, unpatched.

- **iOS** `node_modules/@siteed/audio-studio/ios/AudioStreamManager.swift:1547-1560`:
  ```swift
  DispatchQueue.global(qos: .utility).async { [weak self] in
      ...
      do {
          try handle.seekToEnd()
          try handle.write(contentsOf: dataToWrite)
          self.totalDataSize += Int64(dataToWrite.count)
          ...
      } catch {
           Logger.debug("BG Write Error: Failed to seek/write: \(error.localizedDescription)")
      }
  ```
  On ENOSPC every later buffer is dropped with a debug log. Capture, the live waveform and the
  elapsed clock carry on.
- **Android** `AudioRecorderManager.kt:1578` `fos.write(audioData, 0, bytesRead)`. The
  `IOException` leaves the loop. The outer `catch (e: Exception)` at `:1674-1679` only logs ("Error in
  recording process"). No event reaches JS, and the JS side still believes it is recording.
- **JS** `useRecording.ts:832-840`: the only guard is a 64 MB free-space check at start, which
  "fails OPEN". At 48 kHz mono 16-bit (~96 KB/s), 64 MB is about 11 minutes. A rehearsal take
  longer than that, or another app filling the disk mid-take, crosses it.
- **Effect:** Save succeeds with whatever was written (`importRecordedAudioAsset` → attach →
  flush). The card shows the shorter length. The musician finds out when they play it back,
  possibly days later. The audio after the disk filled was never written.
- **iOS, separate issue.** `DispatchQueue.global` is a concurrent queue. Under CPU or thermal load
  two write blocks can run at once on one `FileHandle`. Chunks can land out of order, and the
  non-atomic `totalDataSize +=` can lose updates, which leaves a WAV header shorter than the data,
  so players cut the tail. At stop, `fileHandle = nil` (`:2009`) drops any block still queued
  ("File handle is nil"). *Speculative; not observed.*
- Confidence: the code paths are verified by reading. Not reproduced on a device.
- **Fix:** patch both recorders. On write failure, stop the take and emit an error event.
  Write iOS buffers on a private serial queue. In JS, compare the saved file's duration with the
  measured elapsed time at save, and when it is short by more than ~1 s, keep the take, fire
  `error`, and say "Phone full · take ends at 11:02". Also poll free space during a take
  (e.g. every 30 s, warn under 64 MB).

---

## 3. MEDIUM: the crash log misses fatal crashes and all promise rejections

- `crashLog.ts:96-101`:
  ```ts
  errorUtils.setGlobalHandler((error, isFatal) => {
      if (isFatal) { void recordCrash("fatal", error); }
      previousHandler?.(error, isFatal);
  });
  ```
  `recordCrash` only queues a `.then` (`:63`) that awaits `getInfoAsync`, `readAsStringAsync`
  and `writeAsStringAsync`. The previous handler runs synchronously right after, and in a release
  build it reports the exception as fatal and native aborts the process. The file write
  almost never runs. A synchronous throw in any `onPress`, timer or native-event callback is
  fatal in release, and that is exactly the case that leaves no record. *Plausible (race); not
  measured.*
- Unhandled rejections: `node_modules/react-native/Libraries/Core/polyfillPromise.js` turns on
  Hermes' rejection tracker only `if (__DEV__)`. In release, a rejected promise nobody awaits
  disappears without a trace: not logged, not in `crashLog`, not in `persistLog`. *Verified.*
- Non-fatal `ErrorUtils` reports are not recorded either (`if (isFatal)`).
- **Fix:**
  - On a fatal, write synchronously: keep the last entry in memory, and have a tiny native
    helper (or a synchronous MMKV/SecureStore set) hold "last fatal", so the boundary or the next
    launch can file it.
  - Install `HermesInternal.enablePromiseRejectionTracker({ allRejections: true, onUnhandled })`
    in release too, so rejections land in `persistLog` as `"rejection"`.
  - Record non-fatal errors as well.

---

## 4. MEDIUM: async handlers without try/catch fail silently (release swallows the rejection)

Follows from #3: in release, an `async` press handler that throws does nothing visible.
Verified instances:

- `useCollectionImportFlow.ts:73`, `useWorkspaceCollectionImportFlow.ts:65` and
  `useSongImportFlow.ts:43` call `await pickImportAssets(...)` with no try. `pickAudioFiles`
  (`audioStorage.ts:442-448`, `copyToCacheDirectory: true`) rejects when an iCloud/Drive file
  can't be downloaded (offline), when the cache copy hits ENOSPC, or when a second picker is
  already open. `pickVideoFiles` (`:498`) rejects when Photos can't export an iCloud-only video.
  The callers start these with `void` (`SongHeaderMenu.tsx:111`, the collection FAB). The user
  picks a file and nothing happens: no message, no haptic.
- **Fix:** make a `runUserAction(fn, failureCopy)` helper (try → `AppAlert.error` with
  `userFacingMessage`). Lint `onPress={() => void x()}` where `x` is async and has no try. The
  rejection tracker from #3 then catches whatever is left.

---

## 5. MEDIUM: a broken file imports as an unplayable clip; playback failures are silent

- **Import accepts anything with an audio extension.** `importAudioAssetFromSource`
  (`audioStorage.ts:618-690`) refuses only AIFF on Android and videos without audio. There is
  no size check (`grep` finds no zero-byte guard in import) and no decode probe. Batch import
  is `lightweight: true` (`loadManagedAudioMetadata`, `:306-318`): a failed duration probe gives
  `durationMs: undefined` and a placeholder waveform, and the clip is created. A 0-byte voice
  memo, a truncated download or an iCloud stub becomes a 0:00 card that never plays. The
  background backfill later fails quietly.
- **Playback errors.**
  - `useInlinePlayer.ts:125-139` `callPlayerSafely` and `:427-433` only `console.warn`. The
    card's play button flips back with no word.
  - `useFullPlayer.ts:45-91` self-heals a missing *mix*. A missing or corrupt *base* file still
    goes to `player.replace`, and the player sits at 0:00 forever.
  - The editor's load failure (`EditorScreen/index.tsx:512`) uses `AppAlert.info`, so no error
    haptic.
- **Fix:**
  - At import, refuse a file that is 0 bytes or whose native duration probe returns ≤ 0 as
    "unsupported", so it gets the existing `reportUnsupportedImports` dialog.
  - On play, when `getInfoAsync` says the file is missing or the player fails to load within a
    few seconds, fire `error` and toast "Can't play this clip" (5 words), and point to
    Settings → Recover files.

---

## 6. MEDIUM: Send finalize timeout makes a ghost link and can spend the allowance twice

- The client bounds every JSON call at 8 s (`sendTransfer.ts:63-89`). Finalize then runs on
  the server per item: an R2 `head`, a ranged `get` for the SNS1 check, another ranged `get` for
  the zip magic, plus D1 writes (`server/.../routes/api.ts:253-305`), and then
  `recordSend` (`:304`) counts the link toward the 3-per-30-days allowance.
- On a slow uplink with a many-item parcel, the server can finalize after the client has
  aborted. The client throws `unreachable`. `shareLink.ts:196-211` never reaches
  `recordLink`, so the link is **live, counted, and missing from Settings → Shared links**. It
  can't be deleted from the app and stays live until it expires.
- The pill's Try again (`useSendJobStore.ts:147-161`) restarts from `createTransfer`: it
  re-packs, re-uploads, and once enforcement is on (`APP_SEND_ENFORCED`), counts a second link.
- The server already makes finalize idempotent (`api.ts:238-240` returns the share URL for
  `finalized`). The client never takes advantage of it.
- Smaller: `requestJson` clears its timer before `res.json()`/`res.text()` (`:87-97`), so a
  stalled body is unbounded.
- **Fix:**
  - Keep `{transferId, uploadToken}` on the job. When finalize fails with `unreachable`, retry
    finalize alone (it is idempotent), and Try again should resume at finalize.
  - Give finalize a longer timeout (30 s) and bound the body read.
  - Record the outbox entry (pending) before finalize, so a ghost link can always be deleted.

---

## 7. MEDIUM: import failures that aren't format problems go unexplained

- `useCollectionImportFlow.ts:170-181`: a dialog appears only for unsupported formats
  (`reportUnsupportedImports`, which does fire `error`). A disk-full or copy failure is counted
  in `failed`, and then:
  - `ImportProgressBanner.tsx:28-35` shows "8 of 10" in neutral ink (or "failed" for a single
    file) for 2.5 s (`setTimeout(removeJob, 2500)`).
  - There is no haptic, no reason, and no list of the two that didn't come in. The picker
    copies are discarded, so the user must find and re-pick the missing files themselves.
- Receive, loose audio (`TransferReceiveScreen/index.tsx:295-299`): any failed item throws.
  The catch (`:376-409`) rolls back the **whole** parcel, including the clips that imported
  fine. The thrown `new Error(t("transferReceive.importFailed", {count}))` is not a
  `UserFacingError`, so `userFacingMessage` replaces it with the generic "saveFailed". For a
  parcel with one unsupported file, Try again fails the same way every time.
- **Fix:**
  - Fire `error` and keep the banner (tappable) when `failed > 0`, with the failed names and
    the reason ("Phone full", "Can't read").
  - On receive, keep what imported and name what didn't, instead of rolling back the parcel.

---

## 8. MEDIUM: a save whose flush and journal both fail deletes the recovery copy and says nothing

- `useRecording.ts:1150-1186`:
  - When `save.flush` fails, the attach is journaled with `.catch(() => {})` (`:1170`). If
    `findClipByAudioUri` misses, the journal isn't written at all.
  - Either way the recorder temp file is then deleted (`:1178`), even though `durable` is
    false.
  - The function returns `true`. No message, nothing beyond the generic banner, which needs
    `PERSIST_FAILURE_THRESHOLD` failures in a row before it shows.
- When the flush fails because the disk is full, AsyncStorage usually fails too. The take then
  lives only in memory plus an orphaned managed file. The marker points at a deleted temp file
  (03's "edge case", now with no user signal).
- Same pattern in launch recovery: `recordingRecovery.ts:117-128` `settleRecoveredTake` deletes
  `tempUri` even when not durable and the journal write failed.
- **Fix:** delete the temp file only when `durable ||` the journal write resolved. When not
  durable, show "Take kept · not saved yet" with `warning`/`error`, so the user doesn't close the
  app on it.

---

## 9. MEDIUM: "Recovery complete" hides a failed recovery

- `actions.ts:3236-3400` `recoverOrphanedAudio` turns real failures into strings: "Manifest
  recovery failed: …" (`:3276`), "Failed to restore archive …" (`:3342`), "Archive scan
  failed: …" (`:3347`).
- `useStorageDiagnostics.ts:60-72` shows `AppAlert.info("Recovery complete", "… 1 warning.")`.
  That is an info dialog (no `error` haptic), and the warning text (English) is never shown.
- The user ran this because something was missing. They are told it completed when the step
  that would have brought their workspace back failed.
- Also: the progress phases passed to `onProgress` are English literals (`"Checking manifest
  backup..."`), and they appear as `recoveryProgress`.
- **Fix:** return typed failures. If any phase failed, use "Recovery incomplete" with
  `AppAlert.error` and name the item. Move phase labels to `t()`.

---

## 10. LOW: feedback-rule breaks and small lies

- **Failures shown with `AppAlert.info` (no `error` haptic):**
  - `useRecording.ts:1140`, `:1204` ("kept for recovery", which is a failed save)
  - `EditorScreen/index.tsx:512` (load failed)
  - `PlayerScreen/index.tsx:1311` (layer can't start)
  - `useWorkspaceArchiveActions.ts:231` (bulk archive/restore incomplete)
  - `useStorageDiagnostics.ts:71` (see #9)
- **English reaching the UI:**
  - `workspaceArchive.ts:385-389` ("N audio files were already missing…") is joined into the
    unarchive alert (`useWorkspaceArchiveActions.ts:84-89`).
  - The `actions.ts` recovery warnings and phases (#9).
- **"Copied" when it wasn't:** `useSendJobStore.ts:95-97` swallows a failed
  `Clipboard.setStringAsync` and then toasts `sendSheet.copied`.
- **Retry that can't help:**
  - `SendLinkSheet.tsx:391` offers Try again for `EmptyShareError`, `TooLargeShareError` and
    the 402 `limit` code.
  - The receive item failure in #7.
- **Purchase:**
  - `ProUpsellSheet.tsx:71-88` has no in-flight guard. A double tap starts a second
    `purchasePackage`, which RevenueCat rejects (operation already in progress), so "Purchase
    failed" shows while the first purchase is still on screen.
  - A pending payment (Ask to Buy / `PAYMENT_PENDING`) also reads as "failed". Map it to
    "Waiting for approval".
- **Share intake:** `useShareImportScreenModel.ts:167` reports every failure as "couldn't read
  the archive", including a full disk.

---

## 11. LOW: native trap sites

| Site | Trap | Reachable from user data? |
|---|---|---|
| `SongNookPitchShiftRenderer.swift:70, 195` | `fatalError` when `AVAudioPCMBuffer` alloc returns nil | No (format comes from the engine, capacity 4096) |
| `SongNookMetronomeEngine.swift:878, 888, 894, 266` | `Int(round(Double))` traps on NaN/±inf | Not from stored data (JSON can't hold NaN, and grid BPM is checked `isFinite`, `dataSlice.ts:720`). But `clampMetronomeBpm` (`domain/metronome.ts:141`) passes NaN straight through (`Math.round(NaN)`), so one in-memory NaN would crash iOS. Guard with `Number.isFinite`. *Speculative* |
| `SongNookFileIOModule.swift:335, 353` | `UInt64(length)`, `UInt64(offset)` trap on negative/NaN | No (values come from unsigned zip fields, `storedZipArchive.ts:194-227`) |
| `SongNookMetronomeEngine.swift:206, 469, 790` / `.kt:311-489, 837` | `mapSegments!` / `!!` | No (set only when non-empty, `:338` / `.kt:301`; Kotlin side under `lock`) |
| `SongNookPitchShiftPracticeEngine.swift:542` | `tickTimer!` | No (assigned the line before) |
| @siteed `AudioStreamManager.swift:902, 1437-1444, 707-709` | Legacy `FileHandle.write(_:)` / `seek(toFileOffset:)` / `readData` raise an uncatchable `NSException` on I/O error | `:902` (header at prepare) could crash on a full disk, but the 64 MB precheck gates it. `:1439/1444` rewrite bytes in place at stop. `:707` is on the compressed path, which SongNook doesn't enable |
| @siteed Android patch `record!!` (patch line 543) | NPE | No (local `val`, null-checked, inside `try`) |

Our own modules use the throwing `FileHandle.write(contentsOf:)` everywhere, check record sizes
in the seal parser (`SongNookSeal.swift:79-95`), and run Android renders on their own threads,
passing errors back through a latch.

---

## Triage: swallowed errors on data paths

| Site | Swallow | User believes | Reality | Verdict |
|---|---|---|---|---|
| `useRecording.ts:1170` | journal write `.catch(() => {})` after a failed flush | take saved | maybe nowhere durable; temp deleted at `:1178` | **#8** |
| `recordingRecovery.ts:122` | same in launch recovery | take recovered | same | **#8** |
| `useSendJobStore.ts:95` | clipboard `.catch(() => {})` | link copied | not copied | LOW (#10) |
| `useCollectionImportFlow.ts:177-181` | `catch` → job `"error"`, `console.warn` | (2.5 s red dot) | batch aborted mid-way; what was batched stays | #7 |
| `useInlinePlayer.ts:125-139, 427` | `console.warn` only | nothing happened | file missing/corrupt | #5 |
| `actions.ts:3276, 3342, 3347` | failure → warning string | recovery complete | the archive/manifest step failed | #9 |
| `useRecording.ts:1112` | sidecar write | — | derived data, rebuilt | OK |
| `actions.ts:320, 342`; `dataSlice.ts:2768-2777`; `mediaCleanup.ts:28-32` | trash after a flush fails | — | file kept (the safe side) | OK |
| `audioStorage.ts:661, 680, 683`; `libraryImport.ts:507`; `useEditorExportFlow.ts:54, 63`; `archiveSave.ts:82` | cleanup of temps/partials | — | leaves a temp file at worst | OK |
| `useRecording.ts:1248` | `clearPendingRecordingSession` after discard | discarded | marker may survive, so a discarded take can come back as "recovered" | LOW, safe direction |
| `state/db/storage.ts:192, 266, 551` | fallback-row cleanup / replay | — | covered by 01 M2/M3 | (01) |
| `disasterRecoveryRestore.ts:401` | JS re-hash `.catch(() => null)` | — | null ≠ sha → refused as bad, which is correct | OK |
| `recordingRecovery.ts:63-72` | corrupt/failed marker read → `null` | — | take not recovered this launch; marker kept | LOW (03 #2 covers overwrite) |
| `manifestFreshness.ts:77`, `storage.ts:431` | → `null` | — | a newer manifest isn't offered this launch | LOW |
| `freeMonthClock.ts`, `haptics.ts`, `BluetoothCalibrationScreen`, `useMetronome.ts`, `usePlaybackClick.ts` (≈45 sites) | device/feel calls | — | no data involved | OK |

---

## Expected external failures, traced

| Failure | Handling | Verdict |
|---|---|---|
| Mic permission denied / blocked | `useRecording.ts:380-397`: dialog, with Open Settings when blocked | Solid. The not-blocked case uses `info` (fine: a request, not a failure) |
| Audio session taken mid-take (call, Siri) | `onRecordingInterrupted` → `take.noteInterruption`, metronome stopped once per token (`useRecordingScreenModel.ts:2079-2103`) | Solid |
| Picker cancel vs error | Cancel → `[]`, everywhere. Error → unhandled (#4) | Cancel solid; error silent |
| Share sheet cancel (iOS backup) | asks "Did you save it?" before recording success (`useLibraryBackupFlow.ts:290-311`) | Solid, honest |
| ENOSPC: record start | 64 MB precheck, `error` + dialog | Solid |
| ENOSPC: mid-take | silent truncation | **#2** |
| ENOSPC: save | temp + marker kept, "kept for recovery" (no `error` haptic) | OK (#10) |
| ENOSPC: import | counted as failed, no reason | #7 |
| ENOSPC: backup | pre-flight `ensureBackupDiskSpace`; raw ENOSPC mapped to `settingsBackup.lowStorage` | Solid |
| ENOSPC: restore / Send download | restore → `describeDrRestoreError`; download → "save failed" + Try again | OK |
| Missing/corrupt audio: play | silent | #5 |
| Missing/corrupt audio: edit, export, PDF, archive | errors caught, `AppAlert.error` with `userFacingMessage` | Solid |
| 0-byte / unsupported import | AIFF/video/no-audio refused with a dialog; 0-byte/corrupt accepted | #5 |
| Send offline / 5xx | every call bounded: 8 s JSON, 15 min upload ceiling with cancel, 30 s download stall watchdog; codes translated | Solid except #6 |
| Word tools / Magpie offline | `AbortController` timeouts; Magpie has an ErrorState with Retry | Solid |
| RevenueCat | cancel told apart from error; restore "nothing" vs error | OK (#10) |
| OTA update | default ON_LOAD, non-blocking; expo-updates ErrorRecovery rolls back a crashing update | Solid (built in) |
| Older native build | all three modules load via `requireOptionalNativeModule`; later methods are typed optional (`renderTrim?`, `sealFileAsync?`, `zipCreateAsync?`…), so TS forces a feature check; `isNativeZipAvailable`, `isSongNookFileIOAvailable` | Solid |

---

## What is solid

- **One way to turn errors into words.** `userFacingMessage` (`i18n/userFacingError.ts:17`)
  shows only `UserFacingError` text and the translated fallback in release, and logs the raw
  error. Backup, restore, export, import, player, share and receive all use it. No raw
  `error.message` reached an alert in this sweep.
- **`AppAlert.error` fires `haptic.error` centrally** (`AppAlert.ts:61-64`), so the rule holds
  wherever it is used.
- **Recording save failures preserve the take** (`useRecording.ts:1188-1205`): the temp file and
  marker are kept, partial managed copies are removed, and an explicit message is shown.
  Discard waits for the native stop before cleanup.
- **Receive rollback** removes the partial packages *and* the compilations a parcel created
  (`TransferReceiveScreen/index.tsx:376-398`). Downloads are size-verified, and sealed items are
  opened and checked against the declared size (`receiveTransfer.ts:356-370`).
- **Android SAF save** checks the copied byte count natively and deletes the partial target on
  failure (`archiveSave.ts:63-88`, `SongNookFileIOModule.kt:182`).
- **Native zip/seal code** uses the throwing `FileHandle` APIs, truncates back to the entry start
  when an entry fails, removes partial outputs, and bounds record sizes in the seal parser.
- **Deletions trash files only after the metadata flush succeeds**, and keep the file when it
  doesn't (`mediaCleanup.ts`, `dataSlice.ts:2767-2777`, `actions.ts:313-344`).
- **The locale bootstrap** falls back to the default language when storage fails
  (`i18n/locale.tsx:96-100`). The boundary screen survives a broken i18n (`safeT`).
- **Workspace archive/unarchive/offload**, PDF export and erase all catch errors and alert with
  the `error` haptic. Erase reports a refused biometric gate (`useEraseAllData.ts:50-56`).
- **The Send server side**: finalize is idempotent, delete treats "already gone" as success, and
  the RevenueCat outage path keeps the last answer.

## Suggested order

1. #1: coerce titles at import and hydrate (one-line guards), and give the boundary a way out
   ("Open Workspaces", "Save a copy").
2. #2: patch both recorders to stop and report on write failure; add a duration check at save.
3. #3 + #4: a synchronous last-fatal record, a release rejection tracker, and a
   `runUserAction` wrapper for async handlers.
4. #6: Send resumes at finalize and records the outbox entry first.
5. #5, #7, #8, #9, then the LOW items.
