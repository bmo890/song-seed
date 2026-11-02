# 03 — Media lifecycle: mic-open to permanent deletion

Audit date 2026-11-02, read-only, against `main` @ 13ed9ddd. Scope: recording, layers, edits,
import, storage locations, deletion/cleanup, integrity. Every finding cites code; confidence is
"verified" only where the failing path was traced end to end in source (not on a device).

## Summary table

| # | Severity | Finding | Confidence |
|---|----------|---------|------------|
| 1 | **CRITICAL** | iOS: a take killed mid-capture is lost if the app is updated before it is reopened (marker stores an absolute container path that is never rebased) | verified in code; relies on iOS changing the container UUID on update, which the codebase itself assumes |
| 2 | **HIGH** | One pending-take marker can be overwritten or cleared while it still guards an unrecovered take; the orphaned WAV sits where no scan looks | verified |
| 3 | **HIGH** | Launch take-recovery can run against a take that is *live*, and deletes the file the recorder is writing | plausible (race) |
| 4 | **HIGH** | "Make sketch" → Discard (or kill mid-edit) silently drops every older version of the clip | verified |
| 5 | **HIGH** | Unarchive failure hard-deletes live files another workspace still uses | verified path; trigger plausible (disk full / bad entry) |
| 6 | MEDIUM | Save/recovery copies the whole take (needs 2x space); a long take on a full phone can never be saved, and feeds #2 | verified |
| 7 | MEDIUM | Archiving trashes the live audio without reading the package back | verified |
| 8 | MEDIUM | Post-restore launch cleanup hard-deletes restored media when hydration came up degraded | plausible, rare |
| 9 | MEDIUM | Discard / Redo hard-delete a take (no trash), however long it was | verified (by design) |
| 10 | MEDIUM | Trash has no way back for the user: a mistaken delete is unrecoverable from the UI even though the audio sits on disk for 14 days | verified |
| 11 | LOW | Head trim permanently cuts captured audio on a measured, heuristic downbeat | verified (by design) |
| 12 | LOW | Mix-clear path trashes a rendered mix without the shared-reference check; Branch shares mix/stem files | verified, regenerable |
| 13 | LOW | Duplicate check on `sourceCreatedAt` alone can flag a different file as a duplicate | plausible, user sees a review |
| 14 | LOW | Assorted: offload never frees space, shared-archive cache leak, latent `clearAudioStorage`, erase leaves recorder temps, trash purge trusts the clock | verified |

---

## CRITICAL

### 1. iOS update between a killed take and the next launch loses the take

`src/services/recordingRecovery.ts:75-85` persists the in-flight marker with the recorder's absolute URI:

```ts
JSON.stringify({ fileUri, startedAt, updatedAt: Date.now(), ideaId: ... })
```

The recorder writes to the bare Documents root (`node_modules/@siteed/audio-studio/ios/AudioStreamManager.swift:527-532`: `baseDirectory = documentDirectory`), so the path is
`file:///var/mobile/Containers/Data/Application/<UUID>/Documents/<name>.wav`. Recovery reads it raw and never rebases it (`recordingRecovery.ts:61-73`, `:299-304`):

```ts
const info = await FileSystem.getInfoAsync(session.fileUri);
if (!info.exists || (typeof info.size === "number" && info.size <= 0)) {
    removeLeftoverPlaceholder(shellIdeaId);
    await clearPendingRecordingSession();
    return { status: "missing" };
}
```

`rebaseManagedUri` (`storagePaths.ts:119`) can't fix this one either: it only anchors on `/songnook/`, and the recorder temp lives outside that tree. The attached-journal branch (`:281-285`) has the same problem for its managed `audioUri`.

**Scenario:** the OS kills SongNook mid-take, or the phone dies. iOS auto-updates the app overnight (frequent during TestFlight and launch). The container UUID changes, the next launch reports "missing", and the marker is cleared. The WAV is still in the new container's Documents root, but nothing will ever point at it again (see #2: no scan looks there). The take is gone, and nobody is told.

**Fix:** store the marker path relative to `documentDirectory` and resolve it at read time. Better still, pass `outputDirectory: <documentDirectory>/songnook/recording/` to the recorder, so the existing rebase, backup and orphan machinery all cover in-flight takes.

## HIGH

### 2. The single pending-take marker is overwritten or cleared while it still guards an unrecovered take

There is one AsyncStorage key, `PENDING_RECORDING_KEY` (`recordingRecovery.ts:14`). Before a new take may overwrite it, the only guard is a module flag that lives for one session (`useRecording.ts:134-145`):

```ts
let unrecoveredTakeThisSession = false;
async function recoverKeptTakeBeforeNewOne() {
  if (!unrecoveredTakeThisSession) return;
  unrecoveredTakeThisSession = false;
  const result = await recoverPendingRecordingSession({ lightweight: true });
  if (result.status === "failed") persistLog(...);   // and then the new take overwrites the marker
```

Each of these orphans a take whose audio is still on disk:

- **(a) Launch recovery skipped.** `App.tsx` only reaches `recoverPendingRecordingSession()` at line 1433. Before that it `return`s early in three places: the empty-library restore prompt (`:1377`), degraded workspaces (`:1394`) and the newer-manifest prompt (`:1429`). These are the boots that follow a crashy session, which is exactly when a killed take is likely. The flag is `false` in the new session, so the first take recorded overwrites the old marker (`useRecording.ts:814-818`, `:883-888`).
- **(b) In-session recovery failed.** The flag is reset *before* the attempt, and a `failed` result only logs, so the next take overwrites the marker. Disk-full recovery (see #6) fails like this.
- **(c) Marker cleared without checking who owns it.** `rollbackFailedRecordingStart` clears the marker whenever a native start was attempted (`useRecording.ts:497-500`), and `discardRecording` clears it every time (`:1248`). `cancelPreparedRecording` (`:906-933`) shows the correct pattern (clear only if `wroteSessionMarker`), but these two paths don't follow it.

The orphan stays where the recorder put it: the iOS Documents root or the Android `filesDir` root. `findOrphanedAudioFiles` scans only `SONG_NOOK_AUDIO_DIR` (`audioRecovery.ts:252-255`), and so does the integrity scanner (`integrityScanner.ts:149-158`). So even "Recover orphaned audio" in Settings can't find it.

**Fix:** keep one marker per take (a list keyed by fileUri), and never overwrite or clear a marker the current take didn't write. Run take recovery first after hydration, before any prompt or early return. Have the orphan scan also cover the recorder's output directory (best: make that directory `songnook/recording/`, per #1).

### 3. Launch recovery can delete the file the recorder is still writing

`Recording` is a restorable root route (`App.tsx:373`), so a relaunch after a kill can land straight on the recorder. Launch recovery runs only after a chain of awaits (`App.tsx:1284-1433`): share and backup temp sweeps, the restore-journal cleanup, the trash restore and purge, the archive-op resume, the picker sweep, manifest reads and `detectNewerManifest`. That is seconds on a big library.

If the musician taps record in that window:

1. The new take overwrites the marker (#2).
2. `recoverTake` (`recordingRecovery.ts:267`) runs with no "is a take live?" guard. It patches the live file's header (`:310`), imports a partial copy into the recorder's shell idea (`:322-338`), then calls `settleRecoveredTake(..., session.fileUri)`, which deletes the live file (`:124-126`):

```ts
if (tempUri && tempUri !== journal.audioUri) {
    await FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {});
}
```

At stop, the recorder's path no longer exists. The save copy fails ("kept for recovery"), but the marker was already cleared. Everything recorded after the launch-recovery moment is lost, and the old killed take is orphaned too.

**Fix:** at the top of `recoverTake`, skip any marker whose `fileUri` belongs to the live take (`getActiveRecordingTakeSession()` / `recordingStartedAt`). Also do #2's "recover first", and block record until launch recovery has settled.

### 4. "Make sketch" → Discard drops every older version of the clip

`convertClipIdeaToProject` carries all of a clip idea's clips (its version stack) into the draft (`actions.ts:2384-2398`). Discarding the draft, or `recoverStrandedDrafts` at launch after a kill mid-edit (`App.tsx:1307`), runs `revertDraftToClipIdea` (`domain/draftRecovery.ts:8-18`):

```ts
const clip = idea.clips[0];
return { ..., kind: "clip", clips: clip ? [{ ...clip, isPrimary: true, parentClipId: undefined }] : [], ... };
```

Every clip after index 0 leaves the library. No `trashFilesOfDroppedClips` is called, so their files stay in `songnook/audio` as orphans, reachable only through the manual orphan scan, and without their names, notes or lineage. Anything recorded into the draft while it was open is dropped the same way. The tests (`state/__tests__/makeSketchDraft.test.ts:34-44`) only use one-clip fixtures.

The CLAUDE.md data law ("never drop versions … a person didn't choose to drop") is broken here, and the "Discard" button reads as harmless.

**Fix:** revert by keeping every clip (restore the original `isPrimary` and `parentClipId`, which you can snapshot into the draft at conversion), and add a multi-version test.

### 5. Unarchive failure hard-deletes files another workspace still uses

Copying ideas between workspaces shares files rather than duplicating them: `cloneClipForCopy` spreads the clip (`actions.ts:490-515`), and archiving knows this ("a copied idea elsewhere shares its audio files", `actions.ts:3083`). So a shared file stays live after its workspace is archived.

On unarchive, `restoreWorkspaceFromDevice` (`workspaceArchive.ts:352-385`) extracts every package entry onto its original live path, even when a live file is already there. The native extractor truncates an existing destination and deletes it on any error (`modules/songnook-file-io/ios/SongNookFileIOModule.swift:338-375`, the Android twin is at `SongNookFileIOModule.kt:357`):

```swift
try output.truncate(atOffset: 0)
...
} catch {
  try? FileManager.default.removeItem(at: destination)
```

After that, a CRC mismatch also deletes the target (`storedZipArchive.ts:347-349`). The JS rollback then hard-deletes every file written so far (`workspaceArchive.ts:372-379`), shared files included, with no trash.

**Scenario:** an idea is copied from workspace A to B, A is archived, then A is unarchived on a nearly full phone, or with one bad entry in the package. B's clip loses its audio for good.

`audioRecovery.restoreWorkspaceFromArchive` already does the right thing: it skips a target that exists with the right size (`audioRecovery.ts:205-216`).

**Fix:** apply that same skip in `restoreWorkspaceFromDevice`, extract to a temp path and rename, and roll back only files that did not exist before the restore.

## MEDIUM

### 6. A long take on a full phone can't be saved, and the retry path feeds #2

The only space check runs once, at start, against 64 MB (`useRecording.ts:858-866`). Nothing watches space mid-take. At save, `importAudioAsset` copies the take rather than moving it (`audioStorage.ts:650-658`), because a recorder file is not "owned" under the `discardSourceAfterImport && isInAppCache` rule. So a 2-hour take (about 630 MB of 44.1 kHz mono WAV) needs the same amount free again. Every attempt (save, in-session recovery, launch recovery) fails the same way, shows "kept for recovery" or "recovery failed", and an in-session failure clears the guard flag (#2b).

**Fix:** move the recorder's file into `songnook/audio` (same volume, so it's an atomic rename) and re-point the marker at it as a journal. Add a low-space warning mid-take.

### 7. Archiving trashes live audio without verifying the package

`archiveWorkspaceToDevice` writes the zip and only `getInfoAsync`s it (`workspaceArchive.ts:285-288`). `verifyArchiveFile` is called only at restore time (`:346`). `archiveWorkspace` then trashes the live files (`actions.ts:3084-3086`). After 14 days the package is the only copy, and nobody has ever read it back.

**Fix:** run `verifyArchiveFile(archiveUri, id, mediaFiles)`, including a CRC read-back of each entry, before calling `deleteManagedAudioUris`.

### 8. Post-restore cleanup can hard-delete restored media

A committed restore journal is deliberately kept until the next launch (`disasterRecoveryRestore.ts:551-554`). Then `cleanupInterruptedDisasterRecoveryRestores(hydratedState.workspaces)` (`App.tsx:1288`) treats any restored destination the hydrated library doesn't reference as garbage. It hard-deletes those files (`disasterRecoveryTemp.ts:142-154`, `:231-234`) and can remove the whole `restored-<token>/` directory (`:131-139`).

**Scenario:** the first launch after a restore hydrates with a workspace set aside (`getHydrationDegradedWorkspaceIds`). That workspace's restored audio is deleted outright, without going through the trash. The backup file is the only way back.

**Fix:** skip this cleanup while any workspace is degraded or the read isn't authoritative, and route the removals through `quarantineManagedPaths` (the trash) instead of `deleteAsync`.

### 9. Discard and Redo hard-delete the take

Both go through `discardRecording` → `FileSystem.deleteAsync(fileUri)` (`useRecording.ts:1240-1246`), behind one dialog (`useRecordingScreenModel.ts:1488-1522`). Redo and Discard sit side by side in that dialog, and neither is undoable. A mis-tap after an hour-long improvisation is permanent; this is the only user-facing media delete that skips the 14-day trash.

**Fix:** trash any take longer than a few seconds (`deleteManagedAudioUris` needs the file inside `songnook/`, which #1's `outputDirectory` change gives you).

### 10. The trash has no user-facing way back

`SONG_NOOK_TRASH_DIR` is only touched by `managedMedia.ts`. Restore from it happens only for files the library still references (`restoreReferencedFilesFromTrash`). A clip deleted after its 5 s undo (`useSongUndo.ts:51-54`, or the collection undo) has its audio on disk for 14 days, but there is no screen, scan or recovery path that offers it back. `findOrphanedAudioFiles` doesn't read the trash either.

**Fix:** a quiet "Recently deleted" row in Settings › Storage that lists the trash and moves an item back as a recovered clip (audio only). At minimum, include the trash in the orphan scan.

## LOW

### 11. Head trim discards captured audio for good

For count-in takes, the saved clip is the trimmed file, and the raw take is deleted after the attach (`useRecording.ts:1026-1052`, `:1174-1182`). The cut point can come from the recorded clicks (`planDownbeatHeadTrim`, `clickGridAlignment.ts:398-415`) with no visible bound against the prediction. A pickup sung into the count-in, or a mis-measured downbeat, is unrecoverable.

**Fix:** keep the raw file as `sourceAudioUri` (the editor already uses this model), or clamp the measured cut to within a beat of the prediction.

### 12. A mix can be trashed while another clip still references it

`publishClipOverdubMixRerender`'s `!nextMix` branch trashes `currentMixUri` without the `filterUnreferencedManagedAudioUris` check that the other branch has (`actions.ts:310-322` vs `:333-344`). Branch (`SelectionBars.tsx:180-205`) copies only `audioUri` and shares the overdub (mix and stems) via `...clip`. Muting the original's layers down to one can trash the branch's mix. The player self-heals a missing mix (`useFullPlayer.ts:68-90`), so nothing irreplaceable is lost.

**Fix:** apply the same filter.

### 13. The duplicate check can flag a different file

`checkImportDuplicates` treats an asset as a duplicate when its `sourceCreatedAt` (the picker's `lastModified`) equals any existing clip's (`importDuplicates.ts:64-80`). Files exported in one batch often share a timestamp at one-second resolution. The user does see a review sheet, so this is not silent, but "Skip duplicates" would drop a real file from this import (the original stays in Files).

**Fix:** also require the size or the name to match.

### 14. Assorted

- **Offload never frees space.** `collectReferencedManagedUris` counts an offloaded workspace's `archiveUri` (`managedMedia.ts:202-208`), so every launch moves the "deleted" package back out of the trash. It's a functional bug, but it fails safe.
- **Shared-archive cache leak.** The Android share-import zip copied to `cacheDirectory` is never deleted (`useShareImportScreenModel.ts:123-126`). It's a leak, not a loss.
- **Latent native wipers.** @siteed `clearAudioStorage()` (Android) deletes every file in `filesDir` (`AudioFileHandler.kt:94-97`), which is Expo's `documentDirectory`. iOS `clearAudioFiles` does the same for audio files in the Documents root. Neither is called today; never wire them up.
- **Erase leaves recorder temps.** `eraseAllData` doesn't remove the recorder's leftover WAVs in the Documents or `filesDir` root (`eraseAllData.ts:49-58`). This is a privacy point, not a loss.
- **Purge trusts the clock.** `purgeExpiredTrash` compares the trash timestamp in each name with `Date.now()` (`managedMedia.ts:281-283`), so a clock set forward purges early.

---

## Where media lives

| Location | What | Purgeable by OS? | Verdict |
|---|---|---|---|
| `Documents/songnook/audio/` (iOS) / `filesDir/songnook/audio/` | takes, sources, stems, imports | no | correct |
| `…/songnook/preview-audio/` | rendered layer mixes | no | correct (regenerable) |
| `…/songnook/workspace-archives/` | archive packages (only copy) | no | correct |
| `…/songnook/trash/` | 14-day quarantine | no | correct |
| **Documents root / `filesDir` root** | **live recorder output, kept-for-recovery takes** | no | persistent, but outside rebase, backup and orphan scans (#1, #2) |
| `NSTemporaryDirectory` / Android `cacheDir` | native renders (trim, mix, extract, solo) | yes | transient, copied into managed storage right away; fine |
| `Caches/DocumentPicker`, `Caches/ImagePicker` | picker copies | yes | transient; originals stay outside the app; launch sweep only touches these two folders |
| `cacheDirectory/songnook-receive`, `songnook-seal` | Send downloads and seals | yes | transient; re-fetchable while the link lives |

No user media is persisted in Caches or tmp. That is good.

---

## Every delete / move site, with verdict

**JS `deleteAsync` / `moveAsync`**

| Site | Deletes | Verdict |
|---|---|---|
| `state/actions.ts:277` | mix render temp after copy to preview-audio | OK |
| `state/actions.ts:1600` | merge render temp | OK |
| `state/db/database.ts:137,160,162` | DB files (erase or migration snapshot) | OK, not media |
| `components/EditorScreen/hooks/useEditorExportFlow.ts:54` | trim output after import | OK (guarded `!== audioUri`) |
| `components/IdeaDetailScreen/components/SelectionBars.tsx:224` | branch's copied file on undo | OK, but see #12 for the shared overdub |
| `hooks/useRecording.ts:931` | cancelled count-in capture | OK |
| `hooks/useRecording.ts:1178` | recorder temp after managed copy | OK when durable. When the flush failed it relies on the journal, and if `findClipByAudioUri` misses or the journal write fails, the marker dangles (edge case) |
| `hooks/useRecording.ts:1181,1201` | head-trim temp | OK |
| `hooks/useRecording.ts:1227,1245` | discarded take | **#9** (hard delete) |
| `services/libraryImport.ts:507` | files written by a failed archive import | OK (fresh unique paths) |
| `services/linkAudioEncoder.ts:75` | Send encode temps | OK |
| `services/dawExport.ts:73-74` | DAW export folder and decoded temp | OK |
| `services/disasterRecoveryRestore.ts:120` | token-scoped restore output on failure | OK (`overwrite:false` at `:369`) |
| `services/managedMedia.ts:126` | share temps and waveform sidecars | OK (derived) |
| `services/managedMedia.ts:158` | move to trash | OK |
| `services/managedMedia.ts:249` | move back out of trash | OK (never overwrites) |
| `services/managedMedia.ts:296` | trash purge > 14 d | OK; clock caveat (#14) |
| `services/sendSeal.ts:98` | seal temps | OK |
| `services/soloMix.ts:32,61` | solo scratch renders | OK (never library media) |
| `services/recordingRecovery.ts:125` | recovered temp after durable import | **#3** (can hit a live take) |
| `services/recordingRecovery.ts:311` | header-only WAV ("empty") | OK (no data bytes) |
| `services/recordingRecovery.ts:357` | redundant managed copy when the shell changed | OK |
| `services/disasterRecoveryTemp.ts:123,185,209` | restore journals | OK |
| `services/disasterRecoveryTemp.ts:138,151` | restored destinations and token dirs | **#8** (hard delete, reference set may be partial) |
| `services/disasterRecoveryTemp.ts:239` | stale backup temps | OK |
| `services/manifestSync.ts:195,199,205` | manifest swap | OK, not media |
| `services/zipArchive.ts:296` | incomplete zip being written | OK |
| `services/storedZipArchive.ts:348` | extracted entry with a bad CRC | **#5** when the target was a pre-existing live file |
| `services/pickedCopies.ts:29,42` | picker copies inside the app cache | OK (in-cache guard) |
| `services/waveformSidecar.ts:107` | sidecar | OK (derived) |
| `services/disasterRecoveryBackup.ts:645` | stale DR temps by mtime | OK |
| `services/audioStorage.ts:655` | move of owned temp or picker copy into managed | OK |
| `services/audioStorage.ts:661,683` | converted temps | OK |
| `services/audioStorage.ts:680` | managed destination of a failed import | OK. After a *move*, the source is gone too, but it was only our temp or the picker copy; the original survives outside the app |
| `services/receiveTransfer.ts:371,377` | sealed download and receive cache | OK |
| `services/workspaceArchiveRecovery.ts:61` | ops journal file | OK |
| `services/workspaceArchive.ts:376` | unarchive rollback | **#5** |
| `services/eraseAllData.ts:120` | everything (user-confirmed erase) | OK; leaves recorder temps (#14) |

**Trash calls (move, not delete)**

All go flush-then-trash with a reference filter:

- `dataSlice.ts:2069,2772-2773,3407`
- `actions.ts:319,341` (#12), `:1557`, `:1655`, `:1698`, `:2248`, `:2326`, `:3067`, `:3084`, `:3158`, `:3217`
- `mediaCleanup.ts:29`
- `CollectionFloatingActions.tsx:339` (only after the undo window)
- `workspaceArchiveRecovery.ts:102,118,131,159`. `:118`'s `!workspace` test would also trash a package whose workspace merely came up degraded (edge case).

**Native**

| Site | Deletes | Verdict |
|---|---|---|
| `SongNookFileIOModule.swift:130,319,327`, `.kt:205,301,311` | zip being written | OK |
| `SongNookFileIOModule.swift:375`, `.kt:357` | extract destination on error | **#5** |
| `SongNookFileIOModule.kt:372` | the SAF file this save just created | OK |
| `SongNookSeal.swift:170`, `.kt:157` | unfinished seal output | OK |
| `SongNookPitchShiftRenderer.swift:256,326,479,525,529,566`, `.kt:77,100,388-389,623,732,803` | renderer outputs in tmp/cache | OK |
| @siteed `AudioStreamManager.swift:1167-1171` | prepared but never started file | OK |
| @siteed `clearAudioStorage` / `clearAudioFiles` | everything in `filesDir` / Documents root | unused; latent hazard (#14) |

---

## What's solid

- **Capture is on disk from the first buffer.** The recorder streams to Documents or `filesDir`, never Caches. The marker is written at start, with a stream-event fallback (`useRecording.ts:599-603`).
- **Background recording is configured.** `UIBackgroundModes` has `audio` and `processing`. Android has `FOREGROUND_SERVICE_MICROPHONE` and `foregroundServiceType="microphone"`. Swipe-away stops and finalizes the take (`AudioRecordingService.kt:100-125`), and the marker recovers it.
- **Killed takes are repaired, not shown as 0:00.** `repairUnfinalizedWav` rewrites only the size fields from the bytes on disk, and only calls a file "empty" when there are no data bytes at all (`domain/wavHeader.ts:57-98`). 44.1 kHz mono reaches the 4 GB limit only after about 12 h.
- **The save is ordered correctly.** The raw temp and the marker survive every failure until the attach is durable. A failed flush writes an attached journal. A project deleted mid-take keeps the take for the Inbox.
- **Flush-then-trash is everywhere**, with `filterUnreferencedManagedAudioUris` protecting shared files, a 14-day trash, and launch untrashing of still-referenced files before the purge.
- **Edits never touch the original.** Every edit renders a new file. "Replace" keeps the original as `sourceAudioUri`, so the trash filter keeps it. Overdubbed clips must be flattened before editing, and stems survive a failed mix bake (the stem attaches first, the render runs behind).
- **Imports are safe.** They copy into managed storage before use. Only picker copies inside the app's own cache are ever deleted. Video extraction moves its own temp in.
- **Disaster-recovery restore is safe.** Writes are token-scoped with `overwrite:false`, displaced files are quarantined only after every restored destination is present, and the journal is committed before cleanup.
- **A missing file never removes a clip.** The integrity scanner is read-only, a missing mix self-heals from its stems, and waveform failures only set a flag.
- **The recorder's memory is bounded on long takes.** The live tape keeps a 12 s window, and the onset envelope caps at 10 min (`onsetEnvelope.ts:41`).
