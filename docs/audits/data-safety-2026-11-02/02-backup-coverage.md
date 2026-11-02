# 02 — Backup, restore, export and OS-backup coverage

Audit date 2026-11-02, main @ 13ed9ddd. Read-only. Scope: exact backup
(`disasterRecoveryBackup.ts` + `satelliteSnapshot.ts`), Replace restore
(`disasterRecoveryRestore.ts` + `disasterRecoveryValidation.ts` + `disasterRecoveryTemp.ts`),
Merge restore (`libraryMergeRestore.ts`), library export/import + share flows
(`libraryExport.ts`, `libraryImport.ts`, `*Share.ts`), and OS backups.

**Short answer to the founder:** yes for content. The exact backup is a wholesale copy of the
persisted library (`buildPersistedAppStoreSnapshot`, `persistedSnapshot.ts:13-67`). Every
workspace → collection → idea → take field rides along without anyone having to list it:
lyrics and all their versions, inline chords, chord charts, clip and sketch notes, layers,
pins, sections, `keptPractice`, grids, received parcels, sent links, Shelf, Revisit. So every
field added since September (layers, lyric versioning, chart prefs, kept practice, clip notes,
Send) is covered. The gaps are not about which fields travel. They are about **whether a
backup can be made at all** (4 GB cap, free space equal to the library), **what Replace
throws away**, one **failed-commit edge case**, and **OS backups that look like protection
but aren't**.

Legend: ✅ carried · ⚠️ carried with a caveat · ❌ not carried · n/a.
"Restore" = Replace Everything. "Merge" = Keep Newer Items. "Export" = Settings → Export
Library with its default full fidelity. Every share flow (sketch/place/ideas/setlist/songbook/
playlist/Send) uses the same `exportLibrary` builder with `preserveAllMetadata: true`
(`sketchShare.ts:20`, `placeShare.ts:38`, `setlistShare.ts:58`, `songbookShare.ts:37`,
`playlistShare.ts:37`, `ideasShare.ts:25`), trimmed to what the person chose to send.

## Coverage table

| Item (where it lives) | Backup | Restore | Merge | Export / share |
|---|---|---|---|---|
| Workspaces: title, color, avatar, description, origin/received (`workspaces`, SQLite shard per ws) | ✅ `persistedSnapshot.ts:15` | ✅ IDs kept, `disasterRecoveryValidation.ts:390-428` | ✅ union by id, current wins own fields `libraryMergeRestore.ts:137-163` | ✅ full `libraryExport.ts:491-505`; import `libraryImport.ts:795-801` |
| Archived workspace (package in `songnook/workspace-archives/` + stub) | ✅ package is critical `disasterRecoveryBackup.ts:183-191` | ✅ archiveUri rebased `disasterRecoveryValidation.ts:392-401` | ✅ current wins | ❌ blocked in UI until unarchived `useLibraryExportFlow.ts:204-210` (by design) |
| Offloaded workspace package (user's Files/Drive) | ❌ by design `disasterRecoveryBackup.ts:183` | ✅ stub kept `disasterRecoveryValidation.ts:372` | ✅ | ❌ |
| Collections, nested (`parentCollectionId`), description | ✅ | ✅ | ✅ union `libraryMergeRestore.ts:142-148` | ✅ `libraryExport.ts:518-532` |
| Hidden ideas/days (`ideasListState` on ws + collection) | ✅ | ✅ | ⚠️ current wins: a backup-only idea that was hidden comes back visible | ✅ full; `includeHiddenItems` defaults true; ids remapped `libraryImport.ts:780,795` |
| Idea/sketch fields: status, completion, bookmark, draft, customTags, auto-title | ✅ | ✅ | ⚠️ current wins per field | ✅ full `libraryExport.ts:743-754` |
| Takes (all), lineage `parentClipId`, primary flag | ✅ | ✅ | ✅ backup-only takes return, primary de-duped `libraryMergeRestore.ts:182-202` | ✅ with full history (`libraryExport.ts:822`, clip ideas `:912`) |
| Take master audio (`songnook/audio/*.wav/.m4a`) | ✅ critical `disasterRecoveryBackup.ts:195` | ✅ required `disasterRecoveryValidation.ts:305` | ✅ backup-only takes only | ✅ `libraryExport.ts:787-794` |
| Pre-edit source audio (`sourceAudioUri`) | ⚠️ non-critical, so a missing one does not mark the backup incomplete `disasterRecoveryBackup.ts:197` | ✅ optional `:306` | ✅ | ✅ full, deduped `libraryExport.ts:718-741` |
| Edit regions | ✅ | ✅ | ⚠️ current wins | ✅ every fidelity (`ArchiveClipManifest.editRegions`) |
| Clip notes (`ClipVersion.notes`, the Notes page) | ✅ | ✅ | ⚠️ current wins; erased text is not recoverable by Merge | ✅ `libraryExport.ts:781-786` |
| Sketch notes (`idea.notes`) | ✅ | ✅ | ⚠️ same | ✅ `libraryExport.ts:842, 900` |
| Lyrics + every version + inline chords (`idea.lyrics.versions[].document`) | ✅ | ✅ | ⚠️ deleted versions return in date order `libraryMergeRestore.ts:222-241`; a version edited in place stays current | ✅ full + includeLyrics `libraryExport.ts:853-854`; standard export = latest text only |
| Take↔lyric stamp (`lyricsVersionId`) | ✅ | ✅ | ✅ | ✅ `libraryExport.ts:710` |
| Chord chart (`chordSheet`) + palette | ✅ | ✅ | ⚠️ current wins: a chart deleted since the backup does not return | ✅ full `libraryExport.ts:753-754`; import `libraryImport.ts:690-691` |
| Transpose / capo / reading zoom / chords hidden (`songnook-chart-prefs`, AsyncStorage) | ✅ satellite `satelliteSnapshot.ts:37` | ✅ `satelliteSnapshot.ts:212-237` | ✅ union per idea `:156-161` | ❌ (keyed by ideaId; export re-IDs) |
| Layers (stem metadata + audio, `recordedOffsetMs`, color, grid) | ✅ stems critical `disasterRecoveryBackup.ts:198-203` | ✅ required `disasterRecoveryValidation.ts:281-284` | ✅ deleted layers return MUTED `libraryMergeRestore.ts:205-219` | ✅ `libraryExport.ts:1192`; import `libraryImport.ts:387-388` |
| Rendered mix (`songnook/preview-audio/`) | ⚠️ non-critical `disasterRecoveryBackup.ts:199` | ✅ optional; mix fields cleared if absent `disasterRecoveryValidation.ts:278-292` | ✅ | ✅ `renderedMixPath` |
| Solo mix | n/a (ephemeral, `PlayerScreen/index.tsx:504`) | | | |
| Take grid (`recordingGrid`) + sketch plan (`songGrid`) | ✅ | ✅ | ⚠️ current wins | ✅ every fidelity `libraryExport.ts:833` |
| Pins, sections, tags, analysis, bookmark, sort order | ✅ | ✅ | ⚠️ current wins | ✅ full `libraryExport.ts:695-711` |
| Kept practice (`keptPractice`) | ✅ | ✅ | ⚠️ current wins | ✅ full `libraryExport.ts:707`; import `libraryImport.ts:169` |
| Waveform peaks (in snapshot) | ✅ | ✅ | ✅ | ✅ full |
| Waveform detail sidecars (`<audio>.waveform`) | ✅ optional `disasterRecoveryBackup.ts:161-173` | ❌ restored, then **deleted** at the next launch (G7) | ❌ same | ❌ (regenerated) |
| Clip groups + assignments | ✅ | ✅ | ⚠️ not merged: backup-only takes come back ungrouped | ✅ full |
| Global custom tags (`globalCustomClipTags`) | ✅ `persistedSnapshot.ts:43` | ✅ | ⚠️ current wins | ❌ (only per-idea `customTags`) |
| Lyric Pad pages (`notes`) | ✅ `persistedSnapshot.ts:57` | ✅ | ✅ union `libraryMergeRestore.ts:56` | ✅ `libraryExport.ts:454-471` |
| Word Ladder / Cut-Up / Borrowed Words sparks | ✅ `persistedSnapshot.ts:58-60` | ✅ | ✅ union `libraryMergeRestore.ts:57-59` | ❌ not in `ArchiveManifest` (G9) |
| Playlists | ✅ | ✅ | ✅ union (items inside not merged) `:53` | ❌ Library export omits them `useLibraryExportFlow.ts:310-316` (G9); ✅ playlistShare |
| Setlists, Songbooks (Compilations) | ✅ | ✅ | ✅ union `:54-55` | ✅ `libraryExport.ts:446-447`, remapped `libraryImport.ts:811-840` |
| Received parcels (ws `origin:"received"` + `received` meta; received songbooks/setlists/playlists) | ✅ | ✅ | ✅ | ✅ full `libraryExport.ts:502-503`, `libraryImport.ts:818,840,869` |
| Shelf (`songnook-shelf…`, entries + departed) | ✅ satellite | ✅ | ✅ union by key `satelliteSnapshot.ts:146-155` | ❌ |
| Revisit (exclusions, snoozes, exposure) | ✅ satellite | ✅ | ✅ union `:162-173` | ❌ |
| Activity history (`activityEvents`) + Activity filters | ✅ snapshot + satellite | ✅ | ✅ union `:52`, `:174-179` | ❌ |
| Sent links outbox (incl. `uploadToken`) | ✅ satellite | ✅ Delete link still works (token-only `sendTransfer.ts:230-232`) | ✅ union by transferId `:180-186` | ❌ |
| Step-Up plans, Magpie prefs, UI language | ✅ satellite | ✅ | ✅ | ❌ |
| Main-store settings (metronome, haptics, reminder, name/word language, startup prefs, BT calibrations, seen hints) | ✅ | ✅ | ⚠️ current wins (scalars) | ⚠️ partial: primary ws + BT calibrations |
| Practice prefs (`songnook-practice-prefs`: speedUnit), layer lane collapse, Compilations filter/sort (`songnook-received-prefs`), sender name (`songnook-send-prefs`), spark zoom | ❌ not in `SATELLITE_STORES` (`satelliteSnapshot.ts:35-43`) (G11) | ❌ | ❌ | ❌ |
| Secure store: send key, free-month clock, founding flag (`freeMonthClock.ts`) | ❌ device identity (Keychain survives an iOS reinstall) | | | |
| Trash (14-day deleted media) | ❌ by design | | | |
| Pending-recording journal, playback queue | n/a (transient) | | | |

## Gaps (severity in each heading)

### G1. HIGH: a library over 4 GB cannot be backed up at all
`disasterRecoveryBackup.ts:345-347`, `:237-243`, plus the native writer: no Zip64 (`SongNookFileIOModule.swift:99-110` writes 32-bit sizes and offsets).
```ts
if (readableRefs.length + 2 >= 0xffff || totalMediaBytes > 0xffffffff) {
    throw new UserFacingError(i18n.t("backupOperation.tooLarge"));
```
Takes are recorded as **32-bit float mono WAV** (`recordingTakeSession.ts:59`, `bitDepth: 32`, 44.1 kHz), about 10.6 MB per minute. 4 GB is roughly **6.4 hours of takes plus layers**, which an active writer reaches within months. The founder's own library was 1.7 GB in October. Past that point the only message is "Your library is over 4 GB, too large for one backup." It gives no fallback, and the reminder keeps nagging about a backup that cannot run. This is not silent, but it is total. *Verified (code).*
**Fix:** add Zip64 to the native writer and to `storedZipArchive`'s reader (the native code already uses UInt64 sizes internally). Or split into several archives with a shared manifest, or back up one workspace per file.

### G2. HIGH: a backup needs free space equal to the whole library
`disasterRecoveryBackup.ts:349, 550`. `ensureBackupDiskSpace(projectedArchiveBytes)` plus a 10% reserve (`backupOperation.ts:76-97`). The archive is built in full inside `documentDirectory/songnook/backup-tmp` before it is saved anywhere. A phone holding a 6 GB library with 4 GB free cannot back up. That is exactly the full-phone user who is most at risk. *Verified.*
**Fix:** on Android, stream the zip straight into the SAF content URI (`copyLocalFileToContentUri` already proves the provider path). On iOS, write to a `UIDocumentPicker`-chosen destination instead of share-sheeting a finished temp file.

### G3. HIGH: Replace drops newer metadata permanently, without showing the backup's date or size of library
`useLibraryBackupFlow.ts:460-483`. The Merge/Replace choice is asked **before** the manifest is read. Its copy is `restoreBody: "How should this backup be restored? …{{size}}"` and `replaceDesc: "…Removed clips wait in trash 14 days."` After commit, everything not in the backup loses its **metadata** outright: titles, lyrics, chord charts, notes, layers' settings. Only the displaced *audio files* go to trash (`disasterRecoveryTemp.ts:222-226`), with nothing pointing at them. There is no pre-Replace safety snapshot. Merge is refused for any backup from another `STORE_VERSION` (`disasterRecoveryRestore.ts:214-219`), so for older backups Replace is the only door. The refusal is needlessly strict: hydration's `migrate` is the version-agnostic `sanitizePersistedState` (`useStore.ts:493-494`), so the restored snapshot could be sanitized first and then merged. *Verified.*
**Fix:** read the manifest first and show "Backup from 3 Mar · 120 ideas (you have 340)". Before a Replace commit, write the current snapshot JSON beside the trashed audio, which makes Replace undoable within 14 days. Sanitize older snapshots and allow Merge.

### G4. HIGH: a failed restore commit can resurrect the restored snapshot after its files were deleted
`state/db/storage.ts:606-634` + `disasterRecoveryRestore.ts:507-523`. When the restore's SQLite `INSERT` fails, `persistRawSnapshot` parks the restored snapshot in the AsyncStorage fallback and records it for replay, then throws:
```ts
await AsyncStorage.setItem(name, value);
await recordFallbackWrite([name], []);
...
throw error;
```
The restore's `catch` then deletes every restored media file (`cleanupWrittenRestoreFiles`) and reports failure. On the next boot, `replayPendingFallbackWrites` (`storage.ts:218-268`) treats parked rows as *newer* and writes the restored meta row over the live library. The person then boots into the backup's library with every take missing. Their real library's metadata is replaced, and its audio is orphaned on disk. A later successful sharded write in the same session would supersede the parked row, but the passive persist skips unchanged state. The trigger is SQLite failing while AsyncStorage still works (locked or corrupt DB, not a full disk). *Plausible (code-traced, not reproduced).*
**Fix:** give restore commits a no-fallback write. Or, in the restore `catch`, drop the parked `STORE_NAME` row and its marker before cleaning up files.

### G5. MEDIUM: Android Auto Backup is on, unscoped and silently useless
The generated manifest has `android:allowBackup="true"` and no `fullBackupContent` / `dataExtractionRules` (`android/app/src/main/AndroidManifest.xml:29`; nothing in `app.json` or `plugins/`; this is the Expo default). Auto Backup is all-or-nothing at **25 MB**, and that includes `files/songnook/audio`, `files/SQLite`, and the trash and backup-tmp folders. After about 2 minutes of WAV, cloud backups stop. Google keeps the *last one that fit*, which is from the first days of use. A new phone or a reinstall then silently brings back a tiny stale library. It is consistent with itself (the DB matches its audio), but the person may believe Google has them covered. Device-to-device transfer (Android 12+) has no cap and does carry everything. `expo-secure-store` is installed without its backup-rules plugin, so restored encrypted prefs fail to decrypt. The code tolerates that (`freeMonthClock.ts:63-79` falls back to AsyncStorage). *Plausible (docs + config; not run).*
**Fix:** add `dataExtractionRules` with `<cloud-backup>` excluding everything (or `allowBackup=false` plus a `fullBackupContent` excluding all) and `<device-transfer>` including all. Then say in Settings that the SongNook backup is the only cloud copy.

### G6. MEDIUM: the only path back from a lost phone is manual, and nothing checks the file left the device
There is no automatic backup (`proCatalog.ts:113-116`: "Reserved for automatic backup. Nothing reads it today"). There is only a boot-time reminder, monthly by default (`backupPreferences.ts:4`). On iOS the share sheet cannot confirm where the file went (`archiveSave.ts:96-104`, `saveConfirmed: false`). The person can pick "On My iPhone", which is lost with the phone, and still tap "I saved it" (`useLibraryBackupFlow.ts:292-307`). Android's SAF picker allows local Downloads too. Restore exists only in Settings → Library, not on the welcome screen of a fresh install. On iOS, an iCloud device backup does cover everything (Documents and Application Support are included, and container moves heal through `rebaseManagedMedia` / `toRelativeManagedPath`, `storagePaths.ts:54-77`), but only if iCloud has room for a multi-GB library. Expected loss window: up to a reminder interval, or everything if no backup ever left the phone. *Verified.*
**Fix:** offer "Restore from a backup" on first launch with an empty library. On iOS, prefer an iCloud Drive document picker over the share sheet. Longer term, add the reserved automatic backup.

### G7. LOW: restored waveform sidecars are deleted at the next launch
The backup packs `<audio>.waveform` (`disasterRecoveryBackup.ts:161-173`), and restore writes it correctly next to `restored-<token>/<audio>`. But finalization (`disasterRecoveryTemp.ts:234-237`) runs `removeUnreferencedRestoreDestinations(journal.destinationPaths, referencedPaths)`. `referencedPaths` comes from `collectClipAudioUris` (`managedMedia.ts:24-33`), which never lists sidecars, so every restored sidecar is deleted and the whole library re-analyzes on the new phone. This is derived data, but it is the slow, battery-heavy part of a migration. The October note's "orphaned at old names" is outdated; this is the current form of the bug. *Verified (code).*
**Fix:** count `waveformSidecarUri(path)` of every referenced audio file as referenced in that filter.

### G8. MEDIUM: Merge cannot recover content lost *inside* an item that still exists
"Current wins" on every collision (`libraryMergeRestore.ts:31-60`). Merge recurses only into takes, layers and lyric versions. An emptied lyric page, a wiped chord chart, cleared notes, deleted pins or sections, or a reset grid all stay as they are now. That matches the Android "field loss after swipe-away" class in memory (`project_persist_hardening_2026_09_07`). Recovering it means Replace (G3), which costs everything newer. *Verified.*
**Fix:** a per-item "Restore this sketch from a backup" that brings the backup's copy back beside the current one, or a Merge option that keeps both copies when the contents differ.

### G9. MEDIUM (export only): Library export is not a full archive despite "full fidelity"
`ArchiveManifest` (`libraryArchiveManifest.ts:238-273`) has no field for Word Ladder, Cut-Up or Borrowed Words sparks, activity history, Shelf, Revisit, transpose/capo or global tags. `useLibraryExportFlow.ts:310-316` passes `songbooks, setlists` but **not `playlists`**, even though the format and the importer support them (`libraryExport.ts:448`, `libraryImport.ts:863`). Anyone using Export as a "second backup", or to move between phones, loses these silently. The header comment promises "a true archive can be reconstructed without metadata loss" (`libraryArchiveManifest.ts:33-35`). *Verified.*
**Fix:** pass `playlists` and add the three spark arrays to the manifest and importer. Or label Export as "for sharing — use Back Up to move phones".

### G10. MEDIUM: a backup made while a workspace is set aside reports "complete"
When a workspace shard fails to parse, its bytes go to `::quarantine::<id>` (`shardedPersistStorage.ts:240-260`) and the person is told (`App.tsx:1387-1391`). A backup in that session builds from memory, which leaves out that workspace and its audio, and still returns `status: "complete"`. The quarantined bytes never reach any backup. If the phone is then lost, the workspace is gone. *Plausible.*
**Fix:** while `getHydrationDegradedWorkspaceIds()` is non-empty, mark the backup incomplete (naming the workspace) and pack the quarantined rows and their referenced files.

### G11. LOW: five small preference stores are not in the backup
`satelliteSnapshot.ts:35-43` lists 7 stores. Missing: `usePracticePrefsStore` (speed unit), `useLayerPrefsStore` (collapsed lanes), `useReceivedPrefsStore` (Compilations filter/sort), `useSendPrefsStore` (sender name), `useSparkPrefsStore` (spark zoom). None of these is content. *Verified.* **Fix:** add them to `SATELLITE_STORES`. Their merges are already sanitizers.

### G12. LOW: smaller failure-mode notes
- Restore needs room for the picked copy (`copyToCacheDirectory: true`, `useLibraryBackupFlow.ts:433`), the extracted media, and the old library sitting in trash for 14 days: about 3× the library during that window. The picker copy is swept at the next launch (`App.tsx:1299`). *Verified.*
- A Replace restore snapshots `displacedWorkspaces` at the start (`useLibraryBackupFlow.ts:363`). A take saved while the restore runs is neither kept nor trashed; it is orphaned. The full-screen process takeover makes this unlikely. *Speculative.*
- `cleanupRestoreTokenDirectories` (`disasterRecoveryTemp.ts:131-141`) skips `preview-audio/restored-<token>`. Only empty folders are left behind. *Verified.*
- The backup file holds live Send `uploadToken`s and share URLs (sent-links satellite). Anyone holding the file can open or delete those links. *Verified.*
- iOS backs up `songnook/trash` and any stale `backup-tmp` archive (up to 4 GB for 24 h) to iCloud. Neither is excluded (no `NSURLIsExcludedFromBackupKey` anywhere). *Verified.*
- Bluetooth latency calibrations travel to a different phone, keyed by route, so the same headphones would carry the old phone's offset. *Speculative.*
- Cross-platform: an iOS-only import format (`.caf`, ALAC `.m4a`) would restore on Android and might not play. AIFF is already converted (`audioStorage.ts:633-639`). *Speculative.*

## What is solid (verified)

- **Wholesale snapshot.** The backup is `buildPersistedAppStoreSnapshot` (`persistedSnapshot.ts:13-67`) with media paths made relative (`disasterRecoveryBackup.ts:293-297`). New entity fields need no backup work. Hydration's `normalizeClip`/`normalizeIdea` spread unknown fields through (`dataSlice.ts:942-958, 1025-1036`).
- **Every file-backed field is collected:** master, source, mix, stems, archive package (`disasterRecoveryBackup.ts:177-208`). This matches `collectClipAudioUris` (`managedMedia.ts:24-33`) and the restore's safe prefixes (`disasterRecoveryValidation.ts:13-19`) and journal prefixes (`disasterRecoveryTemp.ts:40-44`), so there is no writer/reader prefix mismatch today.
- **Honest incompleteness.** A missing master or layer marks the backup `incomplete`, and the alert names the songs (`useLibraryBackupFlow.ts:248-265`). `lastSuccessfulBackupAt` is not stamped for it. The validator cross-checks that status against the missing list (`disasterRecoveryValidation.ts:160-163`). Salvage restore drops only the affected items and promotes a new primary (`:405-425`).
- **Integrity.** SHA-256 per file and of the snapshot, CRC-32 per entry, entry count and sizes checked against the manifest, and unsafe paths rejected (`disasterRecoveryRestore.ts:236-307`, `disasterRecoveryValidation.ts:56-68`). The native pass self-checks against the proven JS hash (`disasterRecoveryBackup.ts:586-592`), and a native mismatch is re-checked in JS before a good backup is refused (`disasterRecoveryRestore.ts:396-406`). A failed entry is truncated back on both platforms (`SongNookFileIOModule.swift:280`, `.kt:263`).
- **A restore failure leaves the live library untouched.** Files are staged under `restored-<token>/`, never overwriting (`disasterRecoveryRestore.ts:357-368`). Metadata commits last as one SQLite row (`:507-510`). A journal cleans up after a killed restore. Displaced media is quarantined only after every restored file is confirmed present (`disasterRecoveryTemp.ts:215-232`). Writes are blocked until restart (`:495`, `requireRestoreRestart`). The exception is G4.
- **Versioning.** The format must equal 1. A newer format or store version is refused with "update the app" (`disasterRecoveryValidation.ts:122-137`). Older store versions hydrate through `sanitizePersistedState`.
- **Cross-device paths.** Snapshots store `songnook/...` relative paths, and hydration rebases them. The anchor `/songnook/` avoids the package-name trap (`storagePaths.ts:54-77`). iOS container moves and iOS↔Android both resolve.
- **Disk space.** Checked before hashing and before restore writes (`disasterRecoveryBackup.ts:349`, `disasterRecoveryRestore.ts:308`), and ENOSPC gets friendly copy (`useLibraryBackupFlow.ts:322-325`). (The requirement itself is G2.)
- **Big libraries.** The native single pass reads each file once and streams it. The snapshot is the only thing held in memory. Readers index and stream rather than loading whole archives (`storedZipArchive`).
- **Merge semantics** are careful about ids: moved items don't duplicate (`indexIds`, `libraryMergeRestore.ts:92-135`), deleted layers return muted, deleted lyric versions never become the latest, and current media is never displaced.
- **Satellites** are written under each store's own key and current version, so each store's own `merge` sanitizer validates the shape at boot. A renamed key is skipped, not written blindly (`satelliteSnapshot.ts:212-237`). None of the seven stores has a transforming `migrate`, so stamping the current version is safe.
- **Export round-trip (full)** carries every creative take/sketch field, including `keptPractice`, `lyricsVersions`, `chordSheet`, `songGrid`, layers and source audio. Archived workspaces are blocked in the UI rather than exported without audio. Received provenance survives.
