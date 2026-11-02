# 12E — Screen sweep: Settings, Library (Compilations), Reader, Setlist song, Shelf, Revisit, Activity, Received, Send receive

Sweep E, 2026-11-02, main @ 845f3bb8. Read-only. Every file in the assigned folders was read, and every
action was followed into `src/state` and `src/services`. Two scratch Jest probes ran against the real
`useStore` + `appActions` (`src/__audit_scratch_E__/`, deleted before finishing). Nothing was run on a device.

Earlier reports are cited by number (for example 02-G3 or 04-H1) and not repeated. Where a finding
here adds evidence to one of them, the row says so.

**Counts:** 0 CRITICAL · 2 HIGH · 4 MEDIUM · 13 LOW (new). The inventory has 196 rows.

**Already reported elsewhere (re-confirmed here, no new id):**
- **10-H2** (Replace restore says "Minimize to keep working", then discards that work). One addition:
  `RestoreRestartGate.tsx:49-53` restarts *automatically* the moment the commit lands. So a lyric
  draft that is open but unsaved (04-H3) is cut off without a prompt, too.
- **10-L1** (the language change reloads without a flush or a recorder/process check).
- **12b-B-M1** (setlist song › Lyrics shows "no longer available" for songs outside the active
  workspace; `SetlistSongScreen/index.tsx:157`).
- **10-M2 / 12c-M2** (writes into an archived workspace are dropped at unarchive). E-M3 below adds two
  more ways in: Activity and Shelf.

---

## (a) Findings by severity

### HIGH

#### E-H1. A `.songnook` import writes back a stale copy of the library and erases everything done while it ran
**Confidence: verified by scratch test.**

`src/state/actions.ts:3474-3479` and `:3535-3544`:

```ts
const store = useStore.getState();                       // snapshot taken here
const merge = await materializeSongNookArchiveMerge(...); // extracts every audio file: seconds to minutes
...
useStore.setState({
    workspaces: nextWorkspaces,               // normalizeWorkspaces([...store.workspaces, ...imported])
    notes: nextNotes,                         // [...merge.importedNotes, ...store.notes]
    songbooks: [...importedSongbooks, ...store.songbooks],
    setlists: [...importedSetlists, ...store.setlists],
    playlists: [...importedPlaylists, ...store.playlists],
    ...
```

- **What goes wrong:** every field above is rebuilt from the snapshot taken *before* the long
  extraction `await`. Anything written to those five lists while the import runs is reverted.
- **Who calls it:**
  - Settings › Import (`useLibraryImportFlow.ts:77`)
  - Send receive (`TransferReceiveScreen/index.tsx:239`)
  - The share intake (`useShareImportScreenModel.ts:131`)
- **Steps:**
  1. Settings › Import a large archive.
  2. While "Importing…" shows, swipe the drawer open (only the header back is blocked) and do any of:
     - record a take, or stop a minimized take from the media dock;
     - write in a sketch or on a Lyric Pad page;
     - delete an idea;
     - add to a setlist.
- **Effect:**
  - The new take's idea vanishes from the library. Its file is orphaned and comes back only through
    Recover audio, as "Recovered —".
  - Text edits revert.
  - A deleted idea comes back, but its audio is already in Trash, so it shows as missing.
  - Two imports running at once (Settings plus a Send link, or two Send links, see E-M4) overwrite each
    other: one package disappears and its files are orphaned.
- **Probe:** an edit to `notes` and a new take were made while `materialize` was pending. Output:
  `IMPORT_PROBE {"mineIdeas":["old"],"workspaces":["mine","imported-ws"],"noteBody":"first"}`.
  The take `new-take` and the text "first + new lines" were both lost.
- **Fix:** keep the `await` outside, and do the merge inside a functional `useStore.setState((s) => ({ workspaces: normalizeWorkspaces([...s.workspaces, ...imported]), notes: [...importedNotes, ...s.notes], … }))`.
  Pass `materialize` only the titles it needs to dedupe.

#### E-H2. "Delete book" and "Delete set" delete immediately, with no confirm and no undo
**Confidence: verified by reading.**

- **Where:**
  - `SongbookDetailView.tsx:304-309` → `onDelete` → `useSongbookModel.ts:234-238`
  - `SetlistDetailView.tsx:308-313` → `useSetlistModel.ts:273-277`

```ts
deleteActiveSetlist: () => { if (!activeSetlist) return; deleteSetlist(activeSetlist.id); setSelectedSetlistId(null); },
```

- **The menu has no confirm step:** `SelectionActionSheet` runs the row's `onPress` straight after closing (`SelectionActionSheet.tsx:72-75`), with no confirm for `tone: "danger"`. The playlist delete (`useLibraryScreenModel.ts:152-163`) and "remove song from book" (`useSongbookModel.ts:122-132`) both confirm.
- **What is lost:** the running order, which takes and lyric versions each song was packed with, the set's description, and the chart-version choices. There is no trash or undo for compilations.
- **Worst case:** for a *received* set or book (a bandmate's arrangement), the only way back is the sender's link, and links expire.
- **Steps:**
  1. Open a setlist.
  2. Tap "…".
  3. Tap "Delete set", the bottom row, directly under Share. It is gone.
- **Fix:** route both through `AppAlert.destructive` (named, with the song count), or give compilations the same 5 s undo toast that idea deletes have.

### MEDIUM

#### E-M1. "Recover audio files" silently replaces the whole library from the shadow manifest when there are 0 ideas
**Confidence: verified by scratch test (the replacement); the trigger is plausible.**

- **Where:** `actions.ts:3249-3263`. If the current idea count is 0 and a manifest with ideas exists, it runs `useStore.setState(restoredState)` and a durable raw commit.
- **What's missing:**
  - There is no dialog and no date, and the button is labelled "Recover audio files".
  - Everything that isn't an idea is overwritten: Lyric Pad pages, setlists, chart books, playlists, sparks and settings.
- **Who reaches it:**
  - A person whose library is empty after a damaged boot who then wrote on the Lyric Pad.
  - Anyone with a stale data-bearing manifest. The manifest guard refuses to write an empty library over it unless a fresh grant exists (`manifestSync.ts:128-148`), so a manifest can stay stale.
- **Probe:** current state was 0 ideas, note `n-new` and setlist `Friday gig`. After Recover: `RECOVER_PROBE {"ideas":["deleted-last-month"],"notes":["n-old"],"setlists":[]}`.
- **Fix:** show "Restore the library saved on {date} ({n} ideas)? What you've added since is replaced" with Restore / Cancel. Better, merge (`mergeRestoredLibrary`) instead of replacing.

#### E-M2. "Recover audio files" silently unarchives every archived workspace
**Confidence: verified by reading.**

- **Which archives get restored:** `actions.ts:3283-3330`. Archives are skipped only for workspaces that are `!isArchived && ideas.length > 0`, so every archived stub qualifies.
- **What happens to each:** `restoreWorkspaceFromArchive` sets `isArchived = false` (`audioRecovery.ts:186`), re-extracts all its audio, and replaces the stub.
- **What is left behind:** the package itself is never deleted, and `archiveState` is cleared, so a full-size package sits orphaned on disk next to the extracted audio.
- **Steps:** a phone archived "Old demos" to free 3 GB. Tapping Recover audio re-extracts the 3 GB.
- **Effect:**
  - The archive decision is undone without being asked.
  - Storage roughly doubles. On a nearly full phone the extraction fails partway (warnings only), and the next recording can hit ENOSPC.
- **Fix:** skip workspaces whose stub is archived with a live `archiveState`. Restore only packages whose workspace is missing, and delete or re-reference the package afterwards.

#### E-M3. Activity and Shelf open ideas inside archived workspaces and make that workspace active; whatever is changed there is dropped at unarchive
**Confidence: the drop is verified by reading; the edit path is plausible.** Same root as 10-M2 / 12c-M2 (12c found Search). These are two more ways in, so the rating stays MEDIUM to match.

- **Why archived items show up at all:**
  - Activity filters received workspaces only (`personalWorkspaces`), not archived ones (`useActivityScreenModel.ts:63`).
  - Archived stubs keep their ideas (04, "Solid"), so their events appear in the heatmap results. Activity's own filter sheet hides archived workspaces, so they can't be excluded there (`:176`).
  - Shelf resolves entries against every workspace (`useShelfScreenModel.ts:81-87`).
- **What opening does:**
  - Activity: `openIdea` / `viewItemInCollection` (`useActivityScreenModel.ts:312-318, 343-353`).
  - Shelf: `openRow` / `viewRowInCollection` (`:133-154, 174-188`).
  - Both call `setActiveWorkspaceId(workspaceId)`, which has no guard (`dataSlice.ts:1522`).
- **Why edits then land on the stub:** every active-workspace write now targets the archived stub:
  - lyrics (`useLyricsVersionScreenModel.tsx:60-63`)
  - rename and notes (04-H2 table)
  - and the recorder's attach, which uses `state.activeWorkspaceId` (`useRecordingScreenModel.ts:437-443`).
- **What unarchive keeps:** only the stub's title and description (`services/workspaceArchive.ts:187-195`):

```ts
function mergeRestoredWorkspace(currentWorkspace, snapshotWorkspace) {
    return { ...snapshotWorkspace, title: currentWorkspace.title, description: currentWorkspace.description, isArchived: false, archiveState: undefined };
}
```

  `workspaceVisibility.ts:25-28` already states the rule: "anything saved or moved into it would sit
  outside that archive and be lost on the next unarchive." Activity and Shelf bypass it.
- **Steps:**
  1. Archive "2024 songs".
  2. Activity › last March › open a sketch.
  3. Write new lyrics, or record a take onto it.
  4. Later, unarchive.
- **Effect:**
  - The lyrics are gone.
  - The take's file is orphaned.
  - The active workspace stays the archived one, so later recordings keep landing in it.
- **Fix:** filter archived workspaces out of Activity and Shelf rows (or show them read-only with "Unarchive to open"), and refuse `setActiveWorkspaceId` for an archived workspace.

#### E-M4. Send receive: "Stop" is not honored during the last item's import, and a second link can start a parallel save
**Confidence: plausible (code-traced).**

- **Stop:**
  - The abort flag is checked only after each *download* (`TransferReceiveScreen/index.tsx:235`).
  - If the person confirms "Stop" while `importLibraryArchiveIntoLibrary` runs for the last item, the screen pops, but the loop finishes.
  - The parcel is saved anyway, a success toast shows, and `returnHome(navigation, …)` (`:366`) runs from the unmounted screen. It pops whatever the person has opened since, including a sketch with an open notes editor that has no guard (04-H4).
- **A second link:**
  - Opening a second Send link while saving resets `startedRef`/`abortRef` for the new parcel (`:147-149`). The first save keeps running and keeps writing `setPhase` for the old parcel, and Save is enabled again.
  - Two saves then run at once: two imports overwrite each other (E-H1).
  - `cleanupReceiveCache()` deletes the shared `songnook-receive` folder while the other save is still reading from it.
- **Fix:**
  - Check `abortRef` after the import and before every store write. If it is set, roll back as the `catch` does and skip navigation.
  - Ignore or queue a new `transferId` while a save is in flight.
  - Give each save its own cache subfolder.

### LOW

| ID | Where | What | Fix |
|---|---|---|---|
| E-L1 | `useLibraryExportFlow.ts:196-227`, `:308-329` | The archived-workspace guard runs only when a workspace is selected. Settings stays mounted as a drawer page, so a selection survives. If you archive that workspace later, Export packs its songs with no audio and no missing-file warning (the comment at `:200-203` describes exactly that result). | Re-check `isArchived` in `handleExport` and drop or flag such workspaces. |
| E-L2 | `SettingsScreen/helpers.ts:48-72, 112-123` | Counts include only *direct* children of a selected collection. The export itself uses the full tree (`libraryExport.ts:1042`). A collection whose ideas sit two levels down reads "0 items", and Export is disabled (`SettingsExportView.tsx:147`). | Use `getCollectionScopeIds` in both helpers. |
| E-L3 | `LibraryScreenContent.tsx:167, 282, 390`; list views | When the persisted filter ("Mine"/"Received") or a search hides every compilation, the page shows "Nothing to listen to yet" / "No setlists yet" plus a Create action. It reads like the user's sets are gone. This is the same pattern as 08-R6, on a different screen. | Use a "No matches · Clear filter" empty state when the unfiltered list is non-empty. |
| E-L4 | `useLibraryScreenModel.ts:213-221`, `useSongbookModel.ts:191-199`, `useSetlistModel.ts:278-286` | On Android, backing out of the folder picker throws `BACKUP_SAVE_CANCELLED_MESSAGE` (`archiveSave.ts:51`). The user then sees "Couldn't build the playlist file. Try again." with the error haptic. Saves never confirm either. | Treat cancel as silent, as Settings export does (`useLibraryExportFlow.ts:358-364`). Toast on `saveConfirmed`. |
| E-L5 | `useLibraryScreenModel.ts:142-150`; Shelf (above) | Playlist "view in collection" sets a *received* package as the active and last-used workspace. Activity and Revisit filter received; these two paths don't. With "Open to: Last used", the next launch opens inside the parcel (`libraryNavigation.ts:351-371`), and 04-H2's write targeting flips to the package. | Skip `setActiveWorkspaceId` for received/archived packages, as `WorkspaceBrowseScreenContent.tsx:65` already does. |
| E-L6 | `SetlistDetailView.tsx:197`, `PlaylistDetailView.tsx:235`, `useSetlistModel.ts:139-145` | In edit mode, (−) removes a set entry or playlist item in one tap, with no confirm and no undo. The entry carries its packing choices. Removing a song from a book *does* confirm. Back from the repack builder also discards its choices silently. | Use one rule for all three: confirm, or an undo toast. |
| E-L7 | `ReceivedScreen/index.tsx:125-140`; `en.ts` `received.deleteBody` | Delete package says "…will be removed. Audio moves to Trash." It doesn't say the parcel's setlist, chart book or playlist stays behind as an empty shell (`buildRuntimeCleanupPatch` prunes entries by workspace; root cause 04-H1). 04-H6 covers the Trash claim. | Delete the parcel's own compilations too (`received.transferId`), or name them in the confirm. |
| E-L8 | `useLibraryBackupFlow.ts:248-265` | An incomplete backup is saved, then reported with `AppAlert.info`, so no `error` haptic fires (CLAUDE.md: failures must fire `error`). | Use `AppAlert.error`. |
| E-L9 | `useLibraryImportFlow.ts:70-75`, `useStorageDiagnostics.ts:46-48`, QuickNameModal saves | These guards read React state from the closure. A fast double tap can run Import twice (two packages), Recover twice (duplicate "Recovered" ideas), or Create twice (two playlists). | Use a ref guard. |
| E-L10 | `SettingsSharingView.tsx:77-94` | Delete link on a transfer the server already dropped (before `isSentLinkExpired` marks it) is reported as "Couldn't delete", and the row stays. *Plausible.* | Treat 404 as deleted. |
| E-L11 | `useEraseAllData.ts:62-79` | Erase doesn't refuse while a backup/restore/import or a minimized take is running. A restore commit can race the wipe. The take's WAV in the Documents root survives the erase (03-#14, 06-#3). | Refuse while `useProcessStore` is running or the recorder is capturing. |
| E-L12 | `useSongbookReaderModel.ts:102-106`; `useRevisitScreenModel.ts:29` | The reader overwrites the user's saved metronome BPM on every page turn, as a mount effect. Revisit's `now` is frozen at first mount on a drawer page that stays mounted, so the date line, snooze expiry and vault rotation go stale until restart. | Keep the per-song tempo local to the reader. Recompute `now` on focus. |
| E-L13 | `useLibraryScreenModel.ts:152-163` | Playlist delete uses `AppAlert.confirm` (default tier, no `warning` haptic). It should use `destructive`. | Use `AppAlert.destructive`. |

---

## (b) Interaction inventory

Verdict key: **OK** = checked and holds; an ID = finding; "ref" = an earlier report covers it.

### Settings › shell and overview
| # | Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 1 | Settings › header hamburger | opens drawer | — | OK |
| 2 | Settings › header back (any subview) | `setView(backView)`; a no-op while importing or measuring storage | — | OK |
| 3 | Settings › Android hardware back on a subview | delegates to the drawer → hub; the subview state stays mounted (an import keeps running) | — | OK (see E-L1: the state persists) |
| 4 | Settings › deep link `initialView`/`openToken` (backup reminder, Received "Links you sent") | `setView`; replaces the current subview, and a running import continues in the hook | — | OK |
| 5 | Overview › Plan row (paywall live) | opens the Pro sheet | — | OK |
| 6 | Overview › Preferences | view switch | — | OK |
| 7 | Overview › Data & storage (with backup/restore progress meta) | view switch | — | OK |
| 8 | Overview › Help & about | view switch | — | OK |

### Settings › Preferences
| # | Element | Data effect | Failure | Verdict |
|---|---|---|---|---|
| 9 | App language ValueRow (popover radio) | opens the restart confirm | — | OK |
| 10 | Restart confirm › Restart | `AsyncStorage.setItem(lang)`, `changeLanguage`, `reloadAsync` with no flush | `AppAlert.error` if the reload throws | 10-L1 |
| 11 | Restart confirm › Cancel / scrim / back | none | — | OK |
| 12 | Name language ValueRow | `setNameLanguage` | — | OK |
| 13 | Word tools language ValueRow | `setWordLanguage` | — | OK |
| 14 | Open to (primary / last used) | `setWorkspaceStartupPreference` | — | OK (see E-L5) |
| 15 | Interface haptics toggle (row + Switch) | `setHapticsEnabled`; both call one handler | — | OK |
| 16 | Name each clip toggle | `setPromptForClipName` | — | OK |
| 17 | Bluetooth calibration row | navigates to `BluetoothCalibration` | — | OK (out of scope) |

### Settings › Data & storage
| # | Element | Data effect | Failure | Verdict |
|---|---|---|---|---|
| 18 | Back up row | estimate (read-only) → confirm dialog; process-slot guard | estimate errors ignored | OK |
| 19 | Back up row double tap | two estimates; the second dialog replaces the first; `runBackup` re-checks the slot | — | OK |
| 20 | Backup confirm › Not now / scrim | none (a scrim tap leaves an unused promise pending) | — | OK |
| 21 | Backup confirm › Back up | `buildExactLibraryBackup` from a snapshot of `getState()` → save | error → `setStatus(error)` + `AppAlert.error`; ENOSPC copy | OK; ref 02-G1/G2 |
| 22 | Android folder picker back-out | "Save or discard" dialog | each way out settles | OK |
| 23 | Save-or-discard › Discard | deletes the built temp archive | — | OK |
| 24 | Save-or-discard › Choose location | re-opens the picker after the overlay closes | loops | OK |
| 25 | Save-or-discard scrim / back | none (no cancel button, so the dialog can't be dismissed) | — | OK |
| 26 | Incomplete backup result | saved, then info alert listing missing songs; no stamp | info only | **E-L8**; ref 02 (solid) |
| 27 | iOS "Did you save it?" › Not saved / I saved it | stamps `lastSuccessfulBackupAt` only on yes | — | OK; ref 02-G6 |
| 28 | Success alert › Copy name / Done | clipboard | — | OK |
| 29 | Process host › Cancel (backup) | aborts; temp deleted | — | OK |
| 30 | Process host › Minimize (backup/export) | pill | — | OK |
| 31 | Restore row | guards (process slot, recorder) → picker (copy to cache) | picker error → `AppAlert.error` | OK; ref 02-G12 |
| 32 | Restore picker cancel | none | — | OK |
| 33 | Restore: a share archive was picked | info "use Import" | — | OK |
| 34 | Restore choice › Cancel / scrim / back | none | — | OK |
| 35 | Restore choice › Keep newer (merge) | `restoreFromDisasterRecoveryBackup(merge)`; live snapshot read at commit | `describeDrRestoreError` + error | ref 02-G8, 02-G4 |
| 36 | Restore choice › Replace everything | replaces the library; displaced audio goes to trash | same | ref 02-G3/G4, 10-H2 |
| 37 | Incomplete restore › Cancel / Restore anyway | salvage restore | — | OK |
| 38 | Restore process › Minimize ("keep working") | the user keeps editing and recording | — | ref 10-H2 |
| 39 | Restore process › Cancel (disabled at commit) | abort; staged files cleaned | — | OK |
| 40 | Restore restart gate (automatic) | `clearRecordingContext` + `reloadAppAsync` | reload-failed state | ref 10-H2 (no wait for a dirty editor) |
| 41 | Reminder ValueRow | `setBackupReminderFrequency` | — | OK |
| 42 | Copy last backup file name glyph | clipboard + toast | — | OK |
| 43 | Export archive row | view | — | OK |
| 44 | Import archive row | view | — | OK |
| 45 | Links you sent row | view | — | OK |
| 46 | Send from a computer row | view | — | OK |
| 47 | Storage & repair row | view; collapses the details fold | — | OK |

### Settings › Export
| # | Element | Data effect | Failure | Verdict |
|---|---|---|---|---|
| 48 | Format ValueRow (archive / zip) | local state | — | OK |
| 49 | Include › notes / lyrics / history / full detail / hidden (archive) | local options (default all on) | — | OK |
| 50 | Include › notes .txt / lyrics .txt / hidden (zip) | local options | — | OK |
| 51 | Workspace row › select | adds to the scope; archived → info and refused | — | **E-L1** (stale selection) |
| 52 | Workspace row › expand | local | — | OK |
| 53 | Collection tree row toggle (nested, excludes under a selected workspace) | local scope | — | **E-L2** (counts) |
| 54 | Estimates (debounced effects) | read-only file stats | caught | OK |
| 55 | Export button | `exportLibrary` → save; process slot | cancel silent; error `AppAlert.error`; warnings info | ref 02-G9 (playlists omitted) |
| 56 | Export button double tap | process-slot guard | info "one at a time" | OK |

### Settings › Import
| # | Element | Data effect | Failure | Verdict |
|---|---|---|---|---|
| 57 | Choose file | picker → kind check (a backup is redirected to Restore) → `readSongNookArchive` → preview | `AppAlert.error` | OK |
| 58 | Import | `importLibraryArchiveIntoLibrary` (fresh ids) → flush → manifest | `AppAlert.error`; temp files removed (`libraryImport.ts:503-508`) | **E-H1** |
| 59 | Import double tap | state-closure guard | — | E-L9 |
| 60 | Choose another / Clear | local | — | OK |
| 61 | Drawer swipe / Android back during import | leaves; the import continues | — | E-H1 (enables concurrent edits) |

### Settings › Storage & repair
| # | Element | Data effect | Failure | Verdict |
|---|---|---|---|---|
| 62 | Page open (effect) | `getStorageDetailsReport` (read-only) | inline "unavailable" | OK |
| 63 | Check library | `scanLibraryIntegrity` (read-only) | `AppAlert.error` | OK |
| 64 | Recover audio files › phase 0 (0 ideas) | replaces the whole store from the manifest | warnings | **E-M1** |
| 65 | Recover audio files › phase 1 (archives) | unarchives every archived stub; the package stays on disk | warnings | **E-M2** |
| 66 | Recover audio files › phase 2 (orphans) | re-attaches takes to empty ideas, else adds "Recovered" ideas | `AppAlert.error` | OK; ref 03-#2/#10 (trash and Documents root not scanned) |
| 67 | Recover double tap | state guard | — | E-L9 |
| 68 | Support details fold | local | — | OK |
| 69 | Erase everything | first destructive confirm | — | OK |
| 70 | Erase › Cancel / scrim (each dialog) | none | — | OK |
| 71 | Erase › second confirm | device auth | — | OK |
| 72 | Device auth refused / cancelled | error haptic + toast | — | OK |
| 73 | Erase run | freeze → stores → AsyncStorage → DB → files → reload | partial-failure alert | E-L11; ref 06-#3, 03-#14 |

### Settings › Links you sent
| # | Element | Data effect | Failure | Verdict |
|---|---|---|---|---|
| 74 | Page open | `prune()` of expired entries past grace | — | OK |
| 75 | Copy glyph | clipboard + toast | — | OK |
| 76 | "…" menu › Forget | confirm → `forgetLink` (the link keeps working) | — | OK |
| 77 | "…" menu › Delete link | destructive confirm → `deleteTransfer` → forget, dismiss the send pill | `AppAlert.error` | E-L10 |
| 78 | "…" scrim | none | — | OK |
| 79 | Help glyph / sheet | — | — | OK |

### Settings › Send from a computer
| # | Element | Data effect | Failure | Verdict |
|---|---|---|---|---|
| 80 | Page open | `listPairedBrowsers` | quiet "couldn't load" | OK |
| 81 | Code input (normalized, 6 chars) | local | — | OK |
| 82 | Pair button / keyboard Go | `claimBrowserPairing` | 404 / offline errors with haptic | OK |
| 83 | Remove (×) on a paired browser | `removePairedBrowser`, no confirm (re-pair restores it) | error alert | OK |

### Settings › Help & about
| # | Element | Data effect | Failure | Verdict |
|---|---|---|---|---|
| 84 | Send feedback | mailto | silent if no mail app | OK |
| 85 | Share diagnostics (iOS) | builds the bundle → share sheet | `AppAlert.error` | OK |
| 86 | Share diagnostics (Android) › Save to phone / Share file / Cancel | SAF write / share | `AppAlert.error` | OK |
| 87 | Replay intro | `setHasSeenWelcome(false)`; the Welcome import only adds | — | OK |
| 88 | Privacy / Terms / Open data rows | open the URL | toast on failure | OK |

### Library (Compilations) hub
| # | Element | Data effect | Failure | Verdict |
|---|---|---|---|---|
| 89 | Hamburger / back (detail) / Android back | closes the detail sub-state, then the drawer | — | OK |
| 90 | Help (?) + sheet | — | — | OK |
| 91 | Tabs (Playlists / Chart books / Setlists) | remounts the section | — | OK |
| 92 | Search field (shared across tabs) | filter | — | E-L3 |
| 93 | Filter popover (All / Mine / Received; persisted) | filter | — | E-L3 |
| 94 | Sort popover | `setCompilationSort` | — | OK |
| 95 | List row tap (each kind) | opens the detail | — | OK |
| 96 | Create FAB (each kind; chart book and setlist are Pro-gated) | opens QuickNameModal | — | OK |
| 97 | QuickNameModal › Create / keyboard submit | `addPlaylist` / `addSongbook` / `addSetlist` (blank → default title) | — | E-L9 (double) |
| 98 | QuickNameModal › Cancel / Android back | discards the draft title | — | OK |
| 99 | Empty-state action | create | — | OK |
| 100 | Deep link `openCollectionKind/Id/openToken` | selects the tab and opens; params cleared | — | OK |

### Library › Playlist detail
| # | Element | Data effect | Failure | Verdict |
|---|---|---|---|---|
| 101 | Play / pause | `setPlayerQueue` / toggle | info if nothing plays | OK |
| 102 | Shuffle | queue shuffle | — | OK |
| 103 | Add (+) | collecting session → Browse | — | OK |
| 104 | Edit toggle | local; reset on switch | — | OK |
| 105 | "…" › Rename | modal → `renamePlaylist` (blank = no-op) | — | OK |
| 106 | "…" › Share › File | `sharePlaylist` → `exportLibrary` | error alert, also on cancel | E-L4 |
| 107 | "…" › Share › SongNook Send | send sheet with a `workspaces` snapshot | sheet handles | OK |
| 108 | "…" › Share sheet back | returns to the menu | — | OK |
| 109 | "…" › Delete playlist | confirm → `deletePlaylist` (references only) | — | E-L13 |
| 110 | Row tap | play from the row | — | OK |
| 111 | View-in-collection glyph | `setActiveWorkspaceId(track ws)` + visit | — | E-L5 |
| 112 | Edit › (−) remove item | `removePlaylistItem` | — | E-L6 |
| 113 | Edit › drag handle (long-press) | `reorderPlaylistItems` (unlisted items kept) | — | OK |

### Library › Chart book detail
| # | Element | Data effect | Failure | Verdict |
|---|---|---|---|---|
| 114 | Open book (big) | reader (Pro, or received) | — | OK |
| 115 | Add songs (+) | collecting session | — | OK |
| 116 | Edit toggle | local | — | OK |
| 117 | "…" › Rename book | modal → `renameSongbook` (blank keeps the title) | — | OK |
| 118 | "…" › Share › File | `shareSongbookFile` | error also on cancel | E-L4 |
| 119 | "…" › Share › SongNook Send | send sheet | — | OK |
| 120 | "…" › Share › Share as text | text share | info if empty | OK |
| 121 | "…" › Delete book | `deleteSongbook` immediately | — | **E-H2** |
| 122 | Row ▶ | dock queue / toggle | — | OK |
| 123 | Row tap | reader at that song | — | OK |
| 124 | Edit › (−) remove song | destructive confirm → removes all its chart items | — | OK |
| 125 | Edit › drag | `reorderSongbookItems(flattenGroupedOrder)` | — | OK |

### Library › Setlist detail and repack builder
| # | Element | Data effect | Failure | Verdict |
|---|---|---|---|---|
| 126 | Play the set | queue | — | OK |
| 127 | Add a song (+) | collecting session | — | OK |
| 128 | Edit toggle | local | — | OK |
| 129 | "…" › Set details | modal (title + description) → `renameSetlist` | — | OK |
| 130 | "…" › Share › File | `shareSetlist` | error also on cancel | E-L4 |
| 131 | "…" › Share › SongNook Send | send sheet | — | OK |
| 132 | "…" › Delete set | `deleteSetlist` immediately | — | **E-H2** |
| 133 | Row lead (number / play) | `buildSetlistQueue` | — | OK |
| 134 | Row tap | pushes the SetlistSong page | — | OK |
| 135 | Edit › row tap | opens the repack builder with a copy of the entry | — | OK |
| 136 | Edit › (−) remove entry | `removeSetlistEntry` | — | E-L6 |
| 137 | Edit › drag | `reorderSetlistEntries` | — | OK |
| 138 | Builder › Everything | local selection | — | OK |
| 139 | Builder › take / lyric version / chart / notes rows | local toggles | — | OK |
| 140 | Builder › Save | `updateSetlistEntry` (an empty selection falls back to the playable take) | entry gone → no-op | OK |
| 141 | Builder › back / Android back | discards choices without asking | — | E-L6 |

### Chart book reader
| # | Element | Data effect | Failure | Verdict |
|---|---|---|---|---|
| 142 | Back; stale guard (`goBack` when the book empties or vanishes) | — | — | OK |
| 143 | Lyrics / Chart tabs | local | — | OK |
| 144 | Aa sheet (zoom, chords, key, capo) | chart-prefs satellite per idea | — | OK |
| 145 | Transpose bar | chart prefs | — | OK |
| 146 | Swipe / previous / next | local page by idea id | — | OK |
| 147 | Play song | dock queue | — | OK |
| 148 | Click toggle | metronome; per-song BPM effect | — | E-L12 |
| 149 | Leave (focus effect) | stops the click | — | OK |

### Setlist song page
| # | Element | Data effect | Failure | Verdict |
|---|---|---|---|---|
| 150 | Back; "missing" state | — | — | OK |
| 151 | Play (big) / part rows | `setPlayerQueueForScreen` | — | OK |
| 152 | Lyrics key | pushes `LyricsVersion` (active workspace only) | "no longer available" | ref 12b-B-M1, 04-H2 |
| 153 | Chart key | pushes `ChordSheet` (saves cross-workspace) | — | OK |
| 154 | Previous / next / swipe | `setParams(entryId)` | — | OK |

### Shelf
| # | Element | Data effect | Failure | Verdict |
|---|---|---|---|---|
| 155 | Focus sweep effect | moves expired entries to departed (satellite) | — | ref 04-L2 |
| 156 | Card tap (open) | `setActiveWorkspaceId(any ws)`; clip → player, song → IdeaDetail | — | **E-M3**, E-L5 |
| 157 | Card play / stop / scrub | inline player | — | OK |
| 158 | View-in-collection glyph | `setActiveWorkspaceId` + visit | — | **E-M3**, E-L5 |
| 159 | "…" › Keep 7 more days | `keepLonger` | — | OK |
| 160 | "…" › View in collection | same as 158 | — | E-M3 |
| 161 | "…" › Leave shelf | `leaveShelf` → departed (cap 5) | — | OK; ref 04-L2 |
| 162 | Decision card › Keep / Leave | same as 159 / 161 | — | OK |
| 163 | Departed › Put back | `reshelve` | — | OK |
| 164 | Empty › Browse ideas | visit the primary collection | — | OK |
| 165 | Help (?) | — | — | OK |

### Revisit
| # | Element | Data effect | Failure | Verdict |
|---|---|---|---|---|
| 166 | Mount effects (`clearExpiredSnoozes`, `markVaultExposure`) | revisit satellite | — | OK; E-L12 (`now`) |
| 167 | Customize › tag switches / daily refresh | revisit prefs | — | OK |
| 168 | Customize › workspace / collection include toggles, Reset | revisit prefs | — | OK |
| 169 | Customize › Restore hidden | `restoreHiddenCandidates` | — | OK |
| 170 | Candidate card open / play / scrub / view | `setActiveWorkspaceId` (personal, non-archived only) | — | OK |
| 171 | "…" › Set aside | shelf `setAside` + toast with View | — | OK |
| 172 | "…" › Hide from Revisit | confirm → `hideCandidate` (reversible, 169) | — | OK |
| 173 | Around-this-time › open / back / Android back / Open Activity | navigation | — | OK |

### Activity
| # | Element | Data effect | Failure | Verdict |
|---|---|---|---|---|
| 174 | Customize › Reset / workspace and collection toggles | activity prefs (archived not listed) | — | OK |
| 175 | Year previous / next, Today, month, day range | local | — | OK |
| 176 | Result card open | `setActiveWorkspaceId` (can be **archived**) → IdeaDetail / player | info if nothing plays | **E-M3** |
| 177 | Result card play / scrub | inline player | — | OK |
| 178 | View in collection | `setActiveWorkspaceId` (archived too) + visit | — | **E-M3** |
| 179 | "…" › Set aside | shelf | — | OK |
| 180 | Route prefill (Revisit, collection-scoped) | local | — | OK |

### Received
| # | Element | Data effect | Failure | Verdict |
|---|---|---|---|---|
| 181 | Package row tap | `markReceivedPackageOpened` + parcel sheet | — | OK; ref 04-H1 (Keep in the sheet) |
| 182 | Collection sub-row tap | marks opened; renames a lone "Files" collection to the parcel title (a write on open); visit | — | OK; ref 04-H2 (edits inside) |
| 183 | Long-press → select; Select all; Cancel; Android back clears | local (the selection persists across drawer visits) | — | OK |
| 184 | Dock › Move | `ReceivedPackageMoveModal` | — | ref 04-H1 |
| 185 | Dock › Delete | destructive confirm → `deleteWorkspace` for each | — | E-L7; ref 04-H6, 04-M3 |
| 186 | Links you sent | Settings › sharing | — | OK |
| 187 | Deep link `packageId` | marks opened + parcel sheet; params cleared | — | OK |

### Send receive (TransferReceive)
| # | Element | Data effect | Failure | Verdict |
|---|---|---|---|---|
| 188 | Open (effect) | `alreadyReceived` (workspaces only) → `fetchTransfer` | gone / error states | ref 04-M4 (dedupe) |
| 189 | Try again | refetch; resets `startedRef` | — | OK |
| 190 | Item ▶ preview | streams; disabled while saving | — | OK |
| 191 | Save / Save all (> 150 MB asks first; Cancel = none) | download → archive import / loose-audio package → setlist/playlist | `catch`: deletes partial packages and same-transfer compilations | **E-H1**; ref 04-M4 |
| 192 | Save double tap | `startedRef` guard | — | OK |
| 193 | Back while saving › Stop | abort the download, then leave | — | **E-M4** |
| 194 | Back while saving › Cancel / scrim | stays | — | OK |
| 195 | A second link while saving | resets the guards; parallel save possible | — | **E-M4** |
| 196 | Already saved › Open Received | `returnHome` | — | OK |

---

## (c) Files read

**Assigned (all read in full):**
- `src/components/SettingsScreen/`: `index.tsx`, `types.ts`, `helpers.ts`, `styles.ts`, `hooks/useSettingsScreenModel.ts`, `hooks/useEraseAllData.ts`, `hooks/useLibraryImportFlow.ts`, `hooks/useStorageDiagnostics.ts`, `hooks/useLibraryExportFlow.ts`, `hooks/useLibraryBackupFlow.ts`, `components/SettingsScreenContent.tsx`, `components/SettingsShared.tsx`, `views/SettingsOverviewView.tsx`, `views/SettingsGeneralView.tsx`, `views/SettingsLibraryView.tsx`, `views/SettingsExportView.tsx`, `views/SettingsImportView.tsx`, `views/SettingsStorageView.tsx`, `views/SettingsSharingView.tsx`, `views/SettingsComputerView.tsx`, `views/SettingsAboutView.tsx`
- `src/components/LibraryScreen/`: `index.tsx`, `styles.ts`, `components/LibraryScreenContent.tsx`, `components/CreateFab.tsx`, `components/CompilationListControls.tsx`, `hooks/useLibraryScreenModel.ts`, `hooks/useSongbookModel.ts`, `hooks/useSetlistModel.ts`, `views/PlaylistListView.tsx`, `views/PlaylistDetailView.tsx`, `views/SongbookListView.tsx`, `views/SongbookDetailView.tsx`, `views/SetlistListView.tsx`, `views/SetlistDetailView.tsx`, `views/SetlistEntryBuilderView.tsx`
- `src/components/SongbookReaderScreen/`: `index.tsx`, `useSongbookReaderModel.ts`
- `src/components/SetlistSongScreen/index.tsx`
- `src/components/ShelfScreen/`: `index.tsx`, `styles.ts`, `hooks/useShelfScreenModel.ts`, `components/ShelfItemCard.tsx`, `components/ShelfDecisionCard.tsx`, `components/ShelfDepartedRow.tsx`
- `src/components/RevisitScreen/`: `index.tsx`, `styles.ts`, `formatRevisitReason.ts`, `hooks/useRevisitScreenModel.ts`, `components/RevisitCandidateCard.tsx`, `components/RevisitSectionBlock.tsx`, `components/RevisitAroundSnapshotView.tsx`, `components/RevisitCustomizeSheet.tsx`
- `src/components/ActivityScreen/`: `index.tsx`, `styles.ts`, `helpers.ts`, `ActivityHeatmapGrid.tsx`, `ActivityRangeResults.tsx`, `hooks/useActivityScreenModel.ts`, `components/ActivityScreenContent.tsx`, `components/ActivityResultCard.tsx`, `components/ActivityCustomizeSheet.tsx`
- `src/components/ReceivedScreen/index.tsx`
- `src/components/TransferReceiveScreen/index.tsx`

**Followed into:**
- `src/state/`:
  - `actions.ts`: `importLibraryArchiveIntoLibrary`, `recoverOrphanedAudio`, `unarchiveWorkspace`, `restoreLibraryFromNewerManifest`, `saveProjectLyrics*`, `setSongChordSheet`
  - `dataSlice.ts`: playlist, songbook and setlist actions, `deleteIdea`, `setActiveWorkspaceId`, `updateIdeas`, `adoptReceived*`, `markReceivedPackageOpened`, `reorderByIds`
  - `useProcessStore.ts`, `useShelfStore.ts`, `useStore.ts` (persist guard, flush, debounce)
- `src/services/`:
  - `eraseAllData.ts`, `libraryBackup.ts`, `libraryImport.ts` (materialize), `libraryExport.ts` (`exportLibrary`, scope), `archiveSave.ts`, `archiveKind.ts`
  - `disasterRecoveryRestore.ts` (commit block), `audioRecovery.ts`, `manifestSync.ts` (guard), `stateIntegrity.ts`, `workspaceArchive.ts` (`restoreWorkspaceFromDevice`, `mergeRestoredWorkspace`)
  - `setlistShare.ts`, `songbookShare.ts`, `playlistShare.ts`, `receiveTransfer.ts`, `sendTransfer.ts` (delete, pairing)
  - `storageDetails.ts`, `integrityScanner.ts` (both read-only)
- Other code followed:
  - `src/components/`: `common/AppAlert.ts`, `common/dialogStore.ts`, `common/AppDialog.tsx`, `common/SelectionActionSheet.tsx`, `common/RestoreRestartGate.tsx`, `common/Button.tsx`, `common/WelcomeFlow.tsx`, `LibraryProcessHost.tsx`, `GlobalMediaDock.tsx`, `LyricsVersionScreen/hooks/useLyricsVersionScreenModel.tsx`, `LyricsVersionScreen/components/LyricsVersionScreenContent.tsx`, `ChordSheetScreen/useChordSheetModel.ts`, `RecordingScreen/hooks/useRecordingScreenModel.ts` (attach)
  - `src/domain/`: `workspaceVisibility.ts`, `libraryNavigation.ts` (`resolveStartupWorkspaceId`), `receivedParcel.ts`, `setlistPlayback.ts`
  - `src/hooks/useBrowseRootBackHandler.ts`, `src/i18n/locale.tsx`, `App.tsx` (drawer routes)
- `docs/audits/data-safety-2026-11-02/`: reports 01–06.
