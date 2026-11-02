# 12f · Sweep: Lyric Pad, word tools, share import, import/progress banners, modals

Read-only sweep, 2026-11-02, letter F. Nothing in `src/` was changed. Two throwaway Jest probes
ran against the real store and `appActions` from `src/__audit_scratch_F__/` and were deleted
afterwards. Nothing was run on a device or in the simulator.

**Scope.**
- Screens: Lyric Pad (`NotepadScreen/**`, which also renders the Lyric Spark page), Word Ladder,
  Cut-Up, Borrowed Words (`MagpieScreen/**`), and the welcome/first-run flow (`welcome/**`,
  `common/WelcomeFlow.tsx`, `domain/firstRun.ts`).
- Share import: `ShareImportScreen/**`.
- Root overlays: `DuplicateReviewSheet`, `ImportProgressBanner`, `LibraryProcessHost`,
  `ClipboardBanner`, `MiniProgress`, `PersistFailureBanner`.
- Shared modals: `modals/**`.
- App.tsx: share-intent, deep-link and document-open handling.
- Each action was followed into `state/actions.ts`, `dataSlice.ts`, `selectionSlice.ts`, the
  import services and the word-tool domain files.

**Earlier reports referenced, not repeated:**
- 04-L1: a failed new-collection import deletes the collection
- 06-1: Android share intake path traversal
- 06-3: share copies are never deleted
- 06-6: a parcel's notes land in the Lyric Pad
- 03-13: duplicate check by `sourceCreatedAt`
- 05-L1: Lyric Pad list isn't virtualized
- 09-7: import failures go unexplained
- 10-M2: archived workspaces accept writes
- 12c-C-M2: Search can make an archived workspace active

## Summary

| ID | Sev | Finding | Confidence |
|---|---|---|---|
| F-H1 | HIGH | Share import offers **archived workspaces and received parcels** as destinations. A clip imported into an archived workspace disappears on Unarchive. One imported into a parcel goes when the parcel is deleted. | **verified by scratch test** |
| F-H2 | HIGH (silent; CRITICAL if concurrent use counts as realistic) | `importLibraryArchiveIntoLibrary` commits a store snapshot taken *before* its long `await`. Every Lyric Pad page, clip, setlist, playlist or edit written during that window is wiped. Affects share-sheet archives, Settings import and Send receives. | **verified by scratch test** |
| F-H3 | HIGH | Backing out of any unfinished spark asks every time. Its red **Discard** deletes the whole spark, even one saved days ago, with no second confirm and no undo. | verified by reading |
| F-H4 | HIGH | Cut-Up **Remix** replaces a hand-written draft without asking once the draft editor has remounted (any step change, or reopening the spark). There is no undo. | verified by reading |
| F-M1 | MEDIUM | Spark → Lyric Pad **"Update page"** replaces the page's whole body. Anything written on that Pad page since the first send is lost, and the dialog never says "replace". | verified by reading |
| F-M2 | MEDIUM | Cut-Up: **From Lyric Pad** before the first cut silently replaces source text the user typed or pasted. | verified by reading |
| F-M3 | MEDIUM | Cut-Up: any seam change on the Cut step re-deals the whole table on **Arrange**. The arrangement and scrap edits are gone, and the board's undo history is cleared. | verified by reading |
| F-M4 | MEDIUM | Finishing or closing share import runs `popTo("Home")` through whatever sits below it. A lyrics editor or draft sketch then pops "Discard changes?" in the middle of the share flow, and one tap loses the work. | verified by reading; device unverified |
| F-M5 | MEDIUM | Share import raises the root duplicate-review sheet while its own name dialog (a `Modal`) is still open or is closing. iOS can refuse that presentation (the repo's own note at `QuickNameModal.tsx:51-53`), leaving the import stuck. | plausible |
| F-M6 | MEDIUM | iOS registers `.songnook` as an owned document type, but no code handles the `file://` URL that "Open in SongNook" delivers. Tapping a shared file opens the app and silently does nothing. | verified by reading (config + linking) |
| F-L1…L12 | LOW | Double-tap duplicates, stale toast undos, scrap edits lost on split/merge, undo eaten mid-typing, and others (below) | mixed |

---

## HIGH

### F-H1. Share import lists archived workspaces and received parcels as destinations, and Unarchive then erases what was imported

**Confidence:** verified by scratch test (`useShareImportDestinations` → `importClipToCollection` →
`unarchiveWorkspace`).

**Where:**
- `src/components/ShareImportScreen/hooks/useShareImportDestinations.ts:42-52`. Every collection
  of every workspace is offered, with no `writableWorkspaces` filter:
  ```ts
  return workspaces
    .flatMap((workspace) =>
      workspace.collections.map((collection) => ({ workspaceId: workspace.id, ...
  ```
  `currentCollection` (`:20-27`) is resolved from `fallbackCollectionId` (App.tsx
  `lastCollectionContextId`), which can be a visited parcel's collection. `targetWorkspace`
  (`:29-34`), where **New collection** lands, follows it.
- `useShareImportScreenModel.ts:183-190`, `finishToCollection`: `setActiveWorkspaceId(workspaceId)`
  makes the archived stub or the parcel the **active workspace**. Every other path forbids this:
  04-H2 for received, 12c-C-M2 for archived.
- `actions.ts:914-930` and `:1003-1022`: the import actions find the collection in *any*
  workspace and write the idea into it.
- `actions.ts:3146`: `item.id === workspaceId ? result.restoredWorkspace : item`. The restored
  workspace is the package snapshot (`workspaceArchive.ts:187-195`), so ideas added to the stub
  since archiving are dropped.

**Every other picker excludes these workspaces:**
- `buildSaveDestinations(writableWorkspaces(...))` (`useRecordingScreenModel.ts:241`)
- the move destinations (`useCollectionManagement.ts:59`, `useWorkspaceCollectionSelection.ts:113`)

**Steps (archived):**
1. Archive "Old Songs".
2. In Voice Memos, share a memo to SongNook. "Other collections" lists "Old Songs · Demos"
   beside your live ones.
3. Pick it. The clip is copied in, "Old Songs" becomes active, and the browse opens on a stub
   whose other clips have no audio.
4. Weeks later, Unarchive "Old Songs". The memo is gone from the library, and its audio sits
   unreferenced in `songnook/audio`, which breaks the CLAUDE.md Data law.

**Probe output:** `after unarchive: [ 'old-1' ] imported idea present anywhere: false`.

**Steps (received):**
1. Visit a parcel's collection, then share a memo in. "Import into current collection" now
   points at the parcel, and it's the primary row.
2. Choose it. The memo lives inside the parcel.
3. **Delete parcel** ("its items will be removed") deletes the memo with it. 04-H1, 04-M4 and
   06-6 cover the other parcel paths.

**Relation to 10-M2:** 10-M2 shows that an archived stub accepts writes when an import races an
archive. This finding is a *menu that offers the archived workspace as an ordinary choice*. That
makes the loss a plausible slip rather than a race, which is why it is rated HIGH.

**Fix:** build both lists from `writableWorkspaces(workspaces)`, and ignore a
`fallbackCollectionId` that resolves into one. Also make the store actions refuse an archived or
received target (the 10-M2 fix).

### F-H2. Archive import overwrites everything written while it was copying files

**Confidence:** verified by scratch test. The test held `materializeSongNookArchiveMerge` open,
added a Lyric Pad page and imported a clip, then released it: `note survived: false clip
survived: false parcel present: true`.

**Where:** `src/state/actions.ts:3474-3544`.
```ts
const store = useStore.getState();                           // :3474, read first
const merge = await materializeSongNookArchiveMerge(...);    // copies every audio file
...
const nextWorkspaces = normalizeWorkspaces([...store.workspaces, ...importedWorkspaces]); // :3514
const nextNotes = [...merge.importedNotes, ...store.notes];
useStore.setState({ workspaces: nextWorkspaces, notes: nextNotes,
  songbooks: [...importedSongbooks, ...store.songbooks], setlists: [...], playlists: [...],
  bluetoothMonitoringCalibrations: ..., primaryCollectionIdByWorkspace: ... });
```
The whole library is replaced with its pre-import state plus the parcel.

**Callers:**
- `ShareImportScreen/hooks/useShareImportScreenModel.ts:131`. The screen stays live: back and
  **Not now** stay enabled during "Importing…".
- `SettingsScreen/hooks/useLibraryImportFlow.ts:77`. An in-screen spinner; the user can leave.
- `TransferReceiveScreen/index.tsx:239`.

**Writers that can land inside the window (seconds for a parcel with audio):**
- the user, after leaving the screen
- a share import already running in the background (its `clipImportBatcher` chunks)
- background waveform hydration
- a dock recording being saved
- Lyric Pad and spark autosave (`useDraftText`)

**Effect:** those writes vanish with no message. Clips that were committed and then dropped
leave their audio unreferenced. The import banner still says "Done 40 of 40".

**Distinct from:** 10-L3 (merge restore) and 10-H2 (replace restore), which are different code.

**Fix:** after the `await`, rebuild from `useStore.getState()` inside a functional
`setState((live) => …)`. Append the imported workspaces, notes, compilations and calibrations to
the *live* arrays.

### F-H3. A spark's Back → "Discard" deletes the whole spark, including sparks saved long ago

**Confidence:** verified by reading.

**Where** (the same code in all three tools):
- `WordLadderScreen/hooks/useWordLadderScreenModel.ts:356-389`
- `CutUpScreen/hooks/useCutUpScreenModel.ts:522-555`
- `MagpieScreen/hooks/useMagpieScreenModel.ts:364-392`

```ts
AppAlert.custom(t("wordSparks.saveUnfinishedTitle"), t("wordSparks.saveUnfinishedBody"), [
  { label: t("wordSparks.discard"), style: "destructive", ...
    onPress: () => { if (exerciseId) deleteWordLadder(exerciseId); navigation.navigate("SparkHome"); } },
  { label: t("wordSparks.saveUnfinished"), ... }, { label: t("wordSparks.keepWorking"), style: "cancel" } ]);
```
The copy reads "Save as unfinished?" / "Keep this exercise to come back to, or discard it." /
**Discard** · Save draft · Keep working.

**Why it's a trap:**
- The prompt fires on *every* Back or Android back from any spark that isn't finished and hasn't
  been sent. That includes one saved as a draft last week and reopened today.
- Edits autosave as you type, so "Discard" cannot mean "discard today's changes". It deletes
  the record: all the words, pairings, cuts, the table, the collected words and the draft.
- It sits first, in red. There is no second confirm and no undo. The header **Delete** honestly
  says "gone for good"; this button doesn't.

**Steps:**
1. Reopen a Cut-Up you saved as a draft yesterday.
2. Change one scrap and tap Back.
3. Tap Discard, expecting to throw away the change. The whole Cut-Up is gone.

**Fix:** ask only for a spark created in this session (track `createdAt` against when the screen
opened). For an older spark, Back just leaves; everything is already saved. If it must stay,
relabel it "Delete spark" and confirm.

### F-H4. Cut-Up "Remix" replaces a hand-edited draft without asking after the editor remounts

**Confidence:** verified by reading.

**Where:** `CutUpScreen/components/CutUpDraftEditor.tsx:45-62`.
```ts
const editedRef = useRef(false);            // fresh on every mount
const dirty = model.draftField.draft.trim().length > 0 && editedRef.current;
if (dirty) AppAlert.destructive(... rebuildBody "replaces your edits here" ...) else runRemix(option);
```

**How it happens:**
- The editor mounts only on the Draft step (`CutUpScreenContent.tsx:85`). Going Back to Arrange
  and returning, or reopening the spark from Lyric Spark, resets `editedRef` to `false`.
- Any of the four Remix rows then calls `rebuildDraftFromBoard` or `composeDraft`. That writes
  `assembledDraftText` directly (`useCutUpScreenModel.ts:457-469`). There is no confirmation
  and no undo. The menu doesn't say it replaces anything; `remixSubtitle` exists in `en.ts` but
  is unused.

**Steps:**
1. Write the final draft.
2. Tap Back to look at the table, then Draft.
3. Tap Remix → Mixed. The written draft is replaced.

**Fix:** compute "edited" from data, not the mount: the draft differs from every generated
output (keep the last generated text on the spark). Or always confirm when the draft is
non-empty, and give the draft one undo step.

---

## MEDIUM

### F-M1. "Update page" overwrites the Lyric Pad page with the spark's text
**Where:** `components/common/sparkSend.ts:85-109`. In the second-send case, `updateNote(existing.id,
{ body: text })` (`:102`) replaces the body wholesale.

**Copy:** "Already in your Lyric Pad · Update that page, or add a new one?" offering New page /
Update page / Cancel. Nothing says the page's current words are replaced.

**Steps:**
1. Send a Word Ladder to the Pad.
2. Keep writing on that Pad page.
3. Later, revise the spark and send again. Choose Update page. The Pad edits are gone, with no
   undo.

**Fix:** if the page changed since the send (store the sent text or `updatedAt` on the spark),
default to a new page or show "Replace …?". Otherwise label it "Replace page".

### F-M2. Cut-Up "From Lyric Pad" replaces typed source text without asking
**Where:** `CutUpScreen/components/CutUpSourceStep.tsx:38-47`. Before the first cut
(`hasCut` false) the picker opens with no confirm. `pickSourceNote`
(`useCutUpScreenModel.ts:207-220`) flushes the typed source, then overwrites `sourceText`.
**Steps:**
1. Paste a verse.
2. Tap From Lyric Pad, pick a page, Use lines. The pasted verse is gone.

**Fix:** confirm whenever `sourceField.draft.trim()` is non-empty, not only after a cut.

### F-M3. One seam tap on the Cut step re-deals the table and drops scrap edits
**Where:** `useCutUpScreenModel.ts:163-185`. When the regenerated chunks differ from the stored
ones, `buildBoardItems` + `packSourceLines` replace `boardItems`, and `clearBoardHistory()` runs
(`:183`).

**Steps:**
1. Arrange the table and edit three scraps.
2. Go Back to Cut. A stray tap on a divider cuts a scrap.
3. Tap Arrange. The table is rebuilt in source order and the scrap edits are gone. Board undo is
   empty. Undoing the seam on the Cut step can't help, because the chunk ids changed.

**Fix:** confirm on Arrange when the cut changed and the table has edits or moves. Better,
reconcile: keep items whose text survives, and keep their `textOverride` and position.

### F-M4. Closing or finishing share import pops through an editor and raises its "Discard?" prompt
**Where:**
- `App.tsx:1121-1128`: `onResetShareIntent` dispatches `StackActions.popTo("Home")` whenever the
  current route is ShareImport.
- `useShareImportScreenModel.ts:174-190`: `closeScreen` and `finishToCollection` both call
  `resetShareIntent()` first. `finishToCollection` then calls `openCollectionAsBrowseRoot` →
  `returnHome` (`navigation.ts:162-166`), another popTo.

**What's below:** a share arrives as a push over the current root route. If that is
LyricsVersion with unsaved text, or a sketch in edit/draft mode, its `beforeRemove` guard runs:
- `useLyricsVersionScreenModel.tsx:135-145`: "Discard changes? Unsaved edits will be lost."
- `useSongEditFlow.ts:153-160`: "Discard this sketch?" (12b)

**Steps:**
1. Mid-lyric, switch to Voice Memos and share a memo.
2. Pick a collection. A "Discard changes?" dialog appears over the import (twice: once per
   popTo).
3. Tapping Discard, reading it as "discard this share screen", loses the lyrics.

**Fix:** when finishing, pop only ShareImport (`goBack`), then `push`/visit the collection. Drop
the popTo in `onResetShareIntent`, or only pop when ShareImport is still on top.

### F-M5. The duplicate review is presented over (or while dismissing) another Modal
**Where:**
- `useShareImportScreenModel.ts:560-569`: `showDuplicateReview` runs while the "New collection"
  `QuickNameModal` (a `WarmModal`, i.e. an RN `Modal`) is still open. It only closes inside
  `doImport`.
- `ShareImportModals.tsx:99-108`: the project-title modal closes and calls
  `importIntoExistingCollection` in the same tick, so the review presents while the dialog is
  dismissing.
- The review is `DuplicateReviewSheet`, a root `BottomSheet` → `Modal` (`App.tsx:1205`,
  `BottomSheet.tsx:250`).
- The repo's own note: "iOS will not present a second Modal over this one, and the refused sheet
  left the recorder deaf to touches" (`QuickNameModal.tsx:51-53`).

**Likely effect on iOS:** Create does nothing visible. `useDuplicateReviewStore.visible` stays
`true`, so later reviews never change the prop and also never present until a restart. The same
pattern is in `useWorkspaceCollectionImportFlow.ts:184` and `useCollectionImportFlow.ts:190`
(other sweeps).

**Fix:** close the name modal first and show the review after it has dismissed
(`InteractionManager` or `onDismiss`), or host the review inside the open modal (the
`children` slot QuickNameModal already offers).

### F-M6. "Open in SongNook" for a `.songnook` file is ignored on iOS
**Where:**
- `app.json:36-62`: `UTExportedTypeDeclarations` and `CFBundleDocumentTypes` claim `.songnook`
  with `LSHandlerRank: Owner`, and `LSSupportsOpeningDocumentsInPlace: false`.
- `App.tsx:971-1050`: linking `prefixes` are `songnook://`, the package scheme and
  `https://send.songnook.app`. Nothing in `src/` or `App.tsx` handles a `file://` URL (grep for
  Inbox, `.songnook` and `openURL`).

**Steps:**
1. Tap a `.songnook` attachment in Mail or Files. SongNook (the default handler) opens.
2. iOS has copied the file to `Documents/Inbox`. React Navigation drops the URL because no prefix
   matches.
3. Nothing imports and nothing is said. The file stays in Inbox (the 06-3 leak).

Only the share sheet ("SongNook Import") works.

**Fix:** handle `file://…\.songnook` in `subscribe`/`getInitialURL` by routing to ShareImport's
archive flow with that URI. Or stop claiming the document type.

---

## LOW

- **F-L1 Import failure accounting** (adds to 09-7).
  - `audioStorage.ts:718-726`: an exception from `onImported` (the batcher's commit throws "Target
    collection not found" if the collection was deleted mid-import) is caught by the same `try`.
  - That asset counts as *both* imported (`importedSlots[index]` already set) and failed, and is
    reported as "unsupported" through `reportUnsupportedImports`.
  - The other 24 clips in that chunk are lost from the buffer (`clipImportBatcher.ts:47-50`
    empties it before the call).
  - Fix: set the slot after `onImported` succeeds, and re-queue the chunk on throw.
- **F-L2 Scrap edits lost on split or merge.**
  - Cut-Up `StripSheet` → "Cut this scrap" opens the split sheet with the stale `sheetItem`
    snapshot (`CutUpBoard.tsx:374-381`, `openSheetFor` at `:149-159`), so text typed in the
    sheet is replaced by pieces of the *old* text.
  - Borrowed Words `ScrapMenu` → Split or Merge with an edit still pending
    (`MagpieBuildStep.tsx:340-352`). On Merge the pending edit then lands on the merged fragment
    and overwrites it, so the next word is lost; fragment undo can recover it.
  - Cut-Up lock toggles aren't in the board history, and the sheet's lock label is stale.
  - Fix: flush the field and read the fresh item before splitting or merging.
- **F-L3 Stale toast Undo.**
  - Word Ladder's "Removed X · Undo" (`useWordLadderScreenModel.ts:225-235`) and Borrowed Words'
    (`useMagpieScreenModel.ts:194-205`) restore a snapshot of the whole column/fragment array.
  - Words added between the removal and the Undo tap are wiped.
  - Fix: re-insert just the removed item.
- **F-L4 Typed-but-unadded words.**
  - The Word Ladder add row is uncontrolled (`WordLadderColumnEditor.tsx:64-105`). A word typed
    but not submitted is dropped on Next, Back or a drawer switch, and isn't counted by
    `hasContent`. A brand-new spark holding only that word is deleted on blur.
  - Borrowed Words: "New page" / "New book" drops picked-but-uncollected words without a word
    (`MagpiePageStep.tsx:146-148`).
- **F-L5 Double-taps create duplicates.** `Press`, `Button` and `SelectionActionSheet` have no
  re-entry guard.
  - Lyric Pad **+** (`NotepadScreenContent.tsx:521-531`): two blank pages; the first is never
    cleaned up (`handleCloseNote` only checks the active one).
  - Spark chooser rows (`NotepadScreenContent.tsx:665-679`): two sparks and two free tries spent;
    the orphan stays as an empty "Untitled" spark.
  - WorkspaceModal **Save** (`WorkspaceModal.tsx:140-143` → `saveWorkspace`): two workspaces.
  - Share import **Create** (`ShareImportModals.tsx:77`): two collections and a double import.
  - Archive **Import** (`ShareImportScreenContent.tsx:40-46`): state-based guard only, so two
    received parcels.
- **F-L6 Lyric Pad undo is unreliable** (`NoteEditor.tsx:62-72`, `useEditHistory.ts:46-58`).
  - The snapshot object is rebuilt every render, so the `===` dedupe never matches. History fills
    with identical entries and Undo sometimes does nothing.
  - Undo tapped within 500 ms of typing is overwritten by the pending draft commit (`seed` is
    ignored while pending).
  - Nothing is lost; undo just doesn't do what it says. Fix: compare by value, and flush drafts
    before undo/redo.
- **F-L7 NoteEditor isn't keyed by note id** (`NotepadScreenContent.tsx:369-378`). Opening
  another page through a deep link (`openToken`) reuses the instance. The new page shows the
  previous page's text for one frame (a first-frame rule case). Writes stay correct because
  `useDraftText` runs the commit captured at typing time. Fix: `key={activeNote.id}`.
- **F-L8 Lyric Pad Duplicate drops the text-direction override.**
  `useNotepadScreenModel.ts:451-462` copies only title and body, so an RTL-forced Hebrew page
  comes back as `auto`.
- **F-L9 Cancelling a library process has no confirm.** `LibraryProcessHost.tsx:294-301`: one
  mis-tap ends a long backup or export. Restore can't be cancelled once it is committing
  (`useLibraryBackupFlow.ts:360`).
- **F-L10 Welcome import.**
  - `WelcomeFlow.tsx:244-259` has `try/finally` with no `catch`, so a picker failure is an
    unhandled rejection: no message, no `error` haptic.
  - Duplicates are skipped silently by `sourceCreatedAt` (`welcomeImport.ts:91-96`). That is
    03-13, made invisible here.
  - The skipped files' picker copies are never discarded.
- **F-L11 Share archive keeps going after "Not now".** `ShareImportScreenContent.tsx:47`. The
  import continues, then `returnHome` later jumps the user to Library or Received from wherever
  they are. `setIsImportingArchive` runs after unmount. It also widens F-H2's window.
- **F-L12 Android re-share with the same file name** (speculative, rides on 06-1). The intake
  writes `cacheDir/<name>`. A second share of another "New Recording.m4a" while the first is
  still copying can swap the bytes under it. The originals stay in the source app.

---

## Interaction inventory

Verdict key: OK, a finding ID, or a reference to an earlier report.

### Lyric Pad: list (`NotepadHome`)

| # | Element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 1 | Header **+** | `addNote()` → opens editor | n/a | F-L5 (double-tap) |
| 2 | Empty state "Write something" | same as 1 | n/a | F-L5 |
| 3 | Search field | local filter only | — | OK |
| 4 | Page row tap | opens editor, or toggles in selection | — | OK |
| 5 | Page row long-press | begins selection / toggles | — | OK |
| 6 | Page row bookmark glyph | `updateNote({isPinned})`; doesn't bump `updatedAt` | — | OK |
| 7 | Selection › Select all | selects visible (filtered) pages only | — | OK |
| 8 | Selection › Cancel | clears selection | — | OK |
| 9 | Dock › Sketch (Add to song) | `startSongTargetPicking(ids)` → Workspaces → song card confirm → `completeSongTargetPicking`, one new lyric version per page (`actions.ts:2108`); pages kept | confirm dialog; empty pages skipped | OK. A parcel's song is accepted (lands in the parcel; 04-H2 family) |
| 10 | Dock › Pin/Unpin | `updateNote` per page | — | OK |
| 11 | Dock › Delete | confirm "Delete N items? This can't be undone." → `deleteNote` etc. | honest copy, no undo | OK |
| 12 | Dock › More | opens sheet | — | OK |
| 13 | More › Duplicate | `addNote` + `updateNote` per page; info alert | — | F-L8 |
| 14 | More › Share | `Share.share(text)` | void promise | OK |
| 15 | More sheet dismiss / scrim / back | closes | — | OK |
| 16 | Song-target banner Cancel (Workspaces) | `cancelSongTargetPicking` | — | OK |
| 17 | Song card confirm › Cancel | nothing | — | OK |
| 18 | Drawer / Android back while selecting | selection persists in the mounted screen; nothing written | — | OK |

### Lyric Spark page (`SparkHome`, same component)

| # | Element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 19 | Header **+** / empty-state "New spark" | opens chooser | — | OK |
| 20 | Chooser › Word Ladder / Cut-Up / Borrowed Words | `spendSparkTry` (free) + `add*` + navigate; Pro upsell when out of tries | — | F-L5 |
| 21 | Chooser dismiss | none | — | OK |
| 22 | Spark row tap / long-press | open / select (`grab`) | — | OK |
| 23 | Search | filter | — | OK |
| 24 | Dock (one spark) › To Lyric Pad | `sendSparkToPad`: new page, or the New page / Update page / Cancel dialog | "Write a few lines first" when empty | F-M1 |
| 25 | Dock › Delete | confirm → delete sparks; the Pad page stays | no undo, honest | OK |

### Lyric Pad: page editor (`NoteEditor`)

| # | Element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 26 | Back chevron | flushes drafts → `handleCloseNote` reads the *live* store, deletes the page only if empty | — | OK |
| 27 | Android back (focus-gated) | same as 26 | — | OK |
| 28 | Drawer swipe away | blur flushes; a blank new page stays in the list | — | OK (cosmetic) |
| 29 | Undo / Redo | `useEditHistory` → `onUpdate(snapshot)` | — | F-L6 |
| 30 | Word finder (Pro) → pick | `applyPickedWord` on the draft, then flush | `ensurePro` gate | OK |
| 31 | Word finder dismiss | none | — | OK |
| 32 | "…" › Text direction → Auto/LTR/RTL | `updateNote({textDirection})` | — | OK |
| 33 | "…" › Pin | `updateNote({isPinned})` | — | OK |
| 34 | "…" › Delete | confirm → `deleteNote`; the late draft flush hits a missing id (no-op) | honest | OK |
| 35 | Title field | `useDraftText`: commits 500 ms after typing stops, on blur, on background and on unmount | — | OK |
| 36 | Title return | focuses body | — | OK |
| 37 | Body field (10k chars, RTL) | same as 35; whole `notes` array rewritten per commit (05-L1) | — | OK |
| 38 | Text selection | refocus for keyboard; feeds word finder | — | OK |
| 39 | Deep link `noteId` + `openToken` | `setActiveNoteId` (only if the page exists) | — | F-L7 |
| 40 | App goes to background | drafts flush | — | OK |

### Word Ladder

| # | Element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 41 | Back | finished or sent: leave. Empty: delete. Otherwise Discard / Save draft / Keep working | — | **F-H3** |
| 42 | Android back | same as 41 | — | F-H3 |
| 43 | Drawer switch (blur) | deletes the spark if empty and unsent | — | F-L4 |
| 44 | "…" › Text size | spark prefs | — | OK |
| 45 | "…" › Help | `markHelpSeen` + sheet | — | OK |
| 46 | "…" › Send to Lyric Pad | flush → `sendSparkToPad` | empty → info | F-M1 |
| 47 | "…" › Delete | confirm "gone for good" → delete + navigate | — | OK |
| 48 | Job seed field | per-keystroke `apply({roleSeed,title})` (drafts flushed first) | — | OK |
| 49 | Job dice | replaces the seed with a random one | — | OK |
| 50 | Verb add row (+ / Return) | `addWord` (trimmed; empty ignored) | — | F-L4 |
| 51 | Verb Suggest | adds up to 4 words | no-op without a seed | OK |
| 52 | Verb row tap → inline edit | `updateWordText` per keystroke (empty allowed) | — | OK |
| 53 | Verb row ✕ | removes the word and its pairs; toast Undo | — | F-L3 |
| 54 | Verb grip drag | reorder | — | OK |
| 55 | Empty slot rows | focus add row | — | OK |
| 56 | Footer Next (Nouns) | `step` | gated | OK |
| 57–62 | Place seed / dice / noun add / Suggest / edit / ✕ / drag / Back / Next | as 48–56 | — | as above (F-L3, F-L4) |
| 63 | Pair › tap word (arm/pair) | `createPairing`, recorded in history | — | OK |
| 64 | Pair › lock | `toggleLock` + history | — | OK |
| 65 | Pair › remove | `removePairing` + history | — | OK |
| 66 | Pair › Shuffle | re-pairs unlocked words (orphans `usedSparkIds`) + history | — | OK |
| 67 | Pair › Undo / Redo | restores pairings | — | OK |
| 68 | Pair footer Back / Next | step | gated | OK |
| 69 | Draft › pair token tap | toggles "used" | — | OK |
| 70 | Draft field | `useDraftText` | — | OK |
| 71 | Draft footer Back / Revise | step | gated | OK |
| 72 | Revise › Copy draft | clipboard (committed draft) | catch | OK |
| 73 | Revise field | `useDraftText` | — | OK |
| 74 | Finish | flush → `finishedAt` → Lyric Spark | — | OK |
| 75 | Send to Lyric Pad / In Lyric Pad link | send / open the page | — | F-M1 |
| 76 | Help sheet dismiss | none | — | OK |
| 77 | "Spark gone" screen › Back | `goBack` (delete of a missing id is a no-op) | — | OK |

### Cut-Up

| # | Element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 78 | Back / Android back / blur | same as 41–43 | — | **F-H3** |
| 79 | "…" › Text size / Help / Send / Delete | as 44–47 | — | F-M1 for Send |
| 80 | Source field (before the cut, or unlocked) | `commitSource`: clears seams and the source link | — | OK |
| 81 | From Lyric Pad (no cut yet) | NotePicker → LineSelect → `pickSourceNote` replaces the source | none | **F-M2** |
| 82 | From Lyric Pad (after a cut) | confirm "Replace the source?" → same | confirm | OK |
| 83 | Edit source link | confirm "Your cuts and table start over" → unlock | confirm | OK |
| 84 | NotePicker row / dismiss | select / close | — | OK |
| 85 | LineSelect: line tap, long-press (verse), verse label, Select all/Clear, Use lines, dismiss | local selection → `onConfirm` | Use disabled at 0 | OK |
| 86 | Source footer Cut | `goToStep("chunk")`; seams seeded once | gated | OK |
| 87 | Cut › divider tap (cut) / gap tap (join) | `toggleSeamAt` + cut history | — | OK |
| 88 | Cut › Recut | reseeds seams + history | — | OK |
| 89 | Cut › Undo / Redo | restores seams | — | OK |
| 90 | Cut footer Back / Arrange | Arrange re-deals the board if chunks changed | none | **F-M3** |
| 91 | Board › scrap drag | `moveScrap` + board history | — | OK |
| 92 | Board › scrap tap | opens StripSheet | — | OK |
| 93 | StripSheet text | `editStripText` reads a fresh spark; later board undo can revert it | — | OK / F-L2 |
| 94 | StripSheet › Cut this scrap → split sheet (seams, Cut, dismiss) | `splitStrip` with stale text | — | F-L2 |
| 95 | StripSheet › Lock/Unlock | `toggleStripLock`, not in history | — | F-L2 (minor) |
| 96 | StripSheet › Duplicate | dup + history (a pending text edit isn't copied) | — | OK |
| 97 | StripSheet › Set aside | `removeStrip` (reversible) + close | — | OK |
| 98 | StripSheet dismiss / swipe | the field flushes on unmount | — | OK |
| 99 | Board › Shuffle / As written / Pool all | `applyBoard` + history | — | OK |
| 100 | Board › Undo / Redo | restores board items | — | OK |
| 101 | Set-aside tray › tap scrap / Return all | restore + history | — | OK |
| 102 | Board footer Back / Draft | Draft assembles only if empty | gated | OK |
| 103 | Draft field | `useDraftText` | — | OK |
| 104 | Remix › As arranged / Short / Mixed / Long | replaces the draft; confirm only if edited since mount | — | **F-H4** |
| 105 | Finish / Send / In Lyric Pad | as 74–75 | — | OK / F-M1 |

### Borrowed Words (Magpie)

| # | Element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 106 | Back / Android back / blur | as 41–43 | — | **F-H3** |
| 107 | "…" items | as 44–47 | — | F-M1 for Send |
| 108 | Auto page load on open | `drawPage` → `apply({book,pageText})`; superseded requests ignored | error state with Retry | OK |
| 109 | Book line → source sheet: language, whole library / curated, genres, New book, open source URL | `apply`, a new draw; prefs | `openURL` catch | OK |
| 110 | Error › Try again / New book | redraw | — | OK |
| 111 | Word tap | local selection | — | OK |
| 112 | Word long-press → pull-apart sheet (seams, Collect) | `pocketPhrases` + history | — | OK |
| 113 | Footer Collect | `pocketPhrases` + history | — | OK |
| 114 | New page / New book | replaces the page; drops picked words | — | F-L4 |
| 115 | Collected strip ✕ | `removeFragment` + toast Undo | — | F-L3 |
| 116 | Footer Build | assembles the draft if blank | gated | OK |
| 117 | Draft field | `useDraftText` | — | OK |
| 118 | Palette scrap tap | inserts at the caret, flushes, marks used | — | OK |
| 119 | Palette long-press → ScrapMenu: text, Split, Merge, Mark used, Remove | as named | — | F-L2 (split/merge), F-L3 (remove) |
| 120 | Palette Undo / Redo | restores fragments | — | OK |
| 121 | Add all (only when the draft is blank) | pours all words | — | OK |
| 122 | See all → expanded palette | same actions | — | OK |
| 123 | Footer Page / Finish / Send / In Lyric Pad | as 74–75 | — | OK / F-M1 |

### Share import (`ShareImport` root route)

| # | Element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 124 | Archive › Import | `detectPickedArchiveKind` → copy to cache (Android `content://`) → `readSongNookArchive` → `importLibraryArchiveIntoLibrary({origin:"received"})` | `AppAlert.error` (error haptic); the copy says "archive" for every failure (09) | **F-H2**, F-L5 |
| 125 | Archive › full backup detected | info: use Restore | — | OK |
| 126 | Archive › Not now / header back | `closeScreen` (reset + popTo/goBack); the import keeps running | — | F-L11, F-M4 |
| 127 | Audio › header back | `closeScreen` | — | F-M4 |
| 128 | Audio › Import into current collection | `promptForCollectionImport` | — | **F-H1** (can be a parcel) |
| 129 | Audio › Other collections toggle | UI | — | OK |
| 130 | Audio › other collection row | `promptForCollectionImport` | — | **F-H1** (archived/received listed) |
| 131 | Chooser › Individual clips / Sketch / Cancel | date prompt → import / project-name modal / nothing | — | OK |
| 132 | Date-preference prompt (choice / dismiss) | dismiss returns null → abort | — | OK |
| 133 | New collection → date prompt → QuickNameModal (name, sparkles, clear, Create, Cancel, Android back) | `addCollection` + background import | — | F-M5, F-L5; failure deletes the collection (04-L1) |
| 134 | Project-name modal › Import / Cancel / back | `importProjectToCollection` once all copies finish | — | F-M5 |
| 135 | Background single-clip import | `importAudioAsset` → `importClipToCollection` | banner "failed" for 2.5 s | 09-7 |
| 136 | Background multi-clip import | `importAudioAssets` → batcher chunks of 25 | banner | 09-7, F-L1; kill mid-way leaves partial (10-M3) |
| 137 | `finishToCollection` | sets the active workspace (can be archived or parcel) → `resetShareIntent` → browse root | — | F-H1, F-M4 |

### Duplicate review sheet (root)

| # | Element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 138 | File row tick | local flips (derived in render, first-frame safe) | — | OK |
| 139 | Import N | discards unticked *picker* copies (shared files are untagged, so untouched) → `onImportSubset` → dismiss | disabled at 0 | OK |
| 140 | Cancel / scrim / swipe / Android back | discards picker copies, then dismiss; nothing imports | — | OK |
| 141 | Import copy / Import all (non-subset flows) | `onImportAll` | — | OK |
| 142 | Skip / Skip duplicates | discards duplicate copies → `onSkip` | — | OK |
| 143 | Presentation over another Modal | — | — | F-M5 |

### Banners, process host, small controls

| # | Element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 144 | ImportProgressBanner | display only (`pointerEvents="none"`); hidden while a menu is open | error shows 2.5 s, no haptic | 09-7 |
| 145 | PersistFailureBanner | display; fires `haptic.error` on appear; hidden while a menu is open; sits under native Modals | — | OK (01 owns the semantics) |
| 146 | Process takeover › Minimize | `setMinimized(true)` | — | OK |
| 147 | Process takeover › Cancel | `requestCancel` → abort (not offered while committing) | no confirm | F-L9 |
| 148 | Process takeover › Done / auto-dismiss after 4 s | `dismiss` (the error also shows as an AppAlert) | — | OK |
| 149 | Process pill tap | expand | — | OK |
| 150 | ClipboardBanner › action | defined by each caller (collection / song / workspace screens; other sweeps) | — | ref 12a/12c |
| 151 | ClipboardBanner › Cancel | `cancelClipboard`; nothing was moved yet | — | OK |
| 152 | MiniProgress drag / tap seek | playback position only; a failed seek resets the drag | catch | OK |

### Welcome / first run

| # | Element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 153 | Skip | `setHasSeenWelcome(true)`; a running import continues | — | OK |
| 154 | Get started / Next / Start | pane / done | — | OK |
| 155 | Swipe pager, page dots | pane | — | OK |
| 156 | Cover › language select | app language (reload behaviour: 10-L1) | — | OK |
| 157 | Import recordings | `runWelcomeImport`: picker → "Imported" collection (found or created) → batcher | catch inside the service; none around the picker | F-L10 |
| 158 | Scenes (cards, reel, chips) | all `noop` | — | OK |
| 159 | `shouldRequestReview` (`firstRun.ts`) | pure gate | — | OK |
| 160 | Boot: suppress welcome when a recovery prompt shows (`App.tsx:1340`) | `setHasSeenWelcome(true)` | — | OK |

### Shared modals (`modals/**`)

| # | Element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 161 | ClipNotesSheet › title / notes | caller drafts | — | OK |
| 162 | ClipNotesSheet › Save | caller `onSave` | — | OK |
| 163 | ClipNotesSheet › Cancel | discards (flagged), then closes | — | OK |
| 164 | ClipNotesSheet › swipe / scrim / Android back | saves if edited (render-time baseline) | — | OK |
| 165 | WorkspaceModal › name, sparkles, clear, description, avatar refresh, hue slider | local | — | OK; first frame stale on reopen (cosmetic) |
| 166 | WorkspaceModal › Save | `addWorkspace` / `updateWorkspace` (blocked while busy) | — | F-L5 |
| 167 | WorkspaceModal › Cancel / back | close (blocked while busy) | — | OK |
| 168 | CollectionMoveModal › row / Move / Cancel / back | caller (destinations already `writableWorkspaces`) | Move disabled with no target | OK |
| 169 | CollectionActionsModal › Rename / Copy / Move / Delete / dismiss | caller handlers (Delete confirms in caller) | — | ref 12c |
| 170 | NotePickerSheet › row / dismiss | select | — | OK |
| 171 | SaveDestinationPickerSheet › row / dismiss | select (writable destinations only) | — | OK |
| 172 | QuickNameModal › name, suggestions, description, pin labels, destination row, make primary, Save (locked while saving), Cancel, Android back → Cancel | caller | — | OK (callers own the save) |

### App.tsx: share intent, deep links, document open

| # | Element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 173 | Cold launch with a pending share | `getInitialURL` → `share-import`; startup nav state skipped | — | OK (picker-sweep race: 10-L5) |
| 174 | Warm share (`onStateChange` pending / `onChange`) | ShareImport pushed over the current route | — | F-M4 |
| 175 | `onResetShareIntent` | `popTo("Home")` if ShareImport is on top | — | F-M4 |
| 176 | Manual `songnook://share-import` | "Nothing waiting" | — | OK |
| 177 | Send link `t/:id#k=` | key → param → TransferReceive (12h) | — | F-H2 applies to its archive save |
| 178 | iOS "Open in SongNook" `.songnook` | ignored | none | **F-M6** |
| 179 | Android second share, same file name | overwrites the cache file mid-import | — | F-L12 (speculative) |

---

## Files read

**Screens and components:**
- `src/components/NotepadScreen/index.tsx`, `components/NotepadScreenContent.tsx`,
  `components/NoteEditor.tsx`, `components/LyricsSparkSheet.tsx`,
  `hooks/useNotepadScreenModel.ts`
- `src/components/CutUpScreen/index.tsx`, `components/CutUpScreenContent.tsx`,
  `CutUpSourceStep.tsx`, `CutUpChunkEditor.tsx`, `CutUpBoard.tsx`, `CutUpDraftEditor.tsx`,
  `CutUpLineSelectSheet.tsx`, `CutUpHelpSheet.tsx`, `hooks/useCutUpScreenModel.ts`
- `src/components/WordLadderScreen/index.tsx`, `components/WordLadderScreenContent.tsx`,
  `WordLadderScreenContent.styles.ts`, `WordLadderColumnEditor.tsx`,
  `WordLadderPairingBoard.tsx`, `WordLadderHelpSheet.tsx`, `hooks/useWordLadderScreenModel.ts`
- `src/components/MagpieScreen/index.tsx`, `components/MagpieScreenContent.tsx`,
  `MagpiePageStep.tsx`, `MagpieBuildStep.tsx`, `MagpieHelpSheet.tsx`,
  `hooks/useMagpieScreenModel.ts`
- `src/components/welcome/WelcomeScenes.tsx`, `src/components/common/WelcomeFlow.tsx`
- `src/components/ShareImportScreen/index.tsx`, `types.ts`, `styles.ts`,
  `components/ShareImportScreenContent.tsx`, `ShareImportModals.tsx`,
  `ShareImportDestinationSection.tsx`, `ShareImportIncomingSection.tsx`,
  `hooks/useShareImportScreenModel.ts`, `useResolvedShareAssets.ts`,
  `useShareImportDestinations.ts`
- `src/components/DuplicateReviewSheet.tsx`, `ImportProgressBanner.tsx`,
  `LibraryProcessHost.tsx`, `ClipboardBanner.tsx`, `MiniProgress.tsx`,
  `PersistFailureBanner.tsx`
- `src/components/modals/ClipNotesSheet.tsx`, `WorkspaceModal.tsx`,
  `CollectionMoveModal.tsx`, `CollectionActionsModal.tsx`, `NotePickerSheet.tsx`,
  `SaveDestinationPickerSheet.tsx`, `QuickNameModal.tsx`
- Common helpers: `src/components/common/sparkSend.ts`, `useUndoHistory.tsx`,
  `SparkFrame.tsx` (menu and footer), `BottomSheet.tsx` (close semantics), `WarmModal.tsx`
  (Modal), `AppAlert.ts` (error haptic)

**Domain, hooks, state:**
- `src/domain/firstRun.ts`, `notepad.ts`, `wordLadder.ts`, `cutUp.ts` (board helpers),
  `magpie.ts` (fragment ops), `draftCommitter.ts`, `collectionManagement.ts`,
  `workspaceVisibility.ts`
- `src/hooks/useDraftText.ts`, `useEditHistory.ts`
- `src/state/dataSlice.ts` (notes and spark CRUD), `selectionSlice.ts` (song target,
  clipboard), `useImportStore.ts`, `useDuplicateReviewStore.ts`, `useProcessStore.ts`
- `src/state/actions.ts`: `importClipToCollection`, `importClipsToCollection`,
  `importProjectToCollection`, `completeSongTargetPicking`, `saveProjectLyricsAsNewVersion`,
  `archiveWorkspace`, `unarchiveWorkspace`, `importLibraryArchiveIntoLibrary`,
  `persistBeforeFileMoves`, `buildWorkspaceArchivalState`

**Services:**
- `src/services/shareImport.ts`, `clipImportBatcher.ts`, `pickedCopies.ts`,
  `importDuplicates.ts`, `sparkTries.ts`, `welcomeImport.ts`
- `audioStorage.ts` (`importAudioAssets`), `libraryImport.ts`
  (`materializeSongNookArchiveMerge`), `workspaceArchive.ts` (strip/merge)

**Navigation and config:**
- `App.tsx` (linking, share-intent provider, overlay mounts, WelcomeGate, first-run boot)
- `src/navigation.ts` (`returnHome`, `openCollectionAsBrowseRoot`)
- `useLyricsVersionScreenModel.tsx` and `useSongEditFlow.ts` (their `beforeRemove` guards)
- `app.json` (document types, intent filters)
- `node_modules/expo-share-intent` (`useShareIntent.js`, iOS and Android `clearShareIntent`)
