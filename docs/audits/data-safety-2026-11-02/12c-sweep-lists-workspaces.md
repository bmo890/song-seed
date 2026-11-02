# 12c · Sweep: collection page, workspace hub, workspace list, side menu, search, cards

Part of the screen-by-screen sweep (2026-11-02), letter C. This is a read-only audit; nothing in
`src/` was changed.

**Scope.** Every file in these places:
- `src/components/IdeaListScreen/**`
- `src/components/WorkspaceBrowseScreen/**`
- `src/components/WorkspaceListScreen/**`
- `src/components/SideNav.tsx`
- `src/components/SearchScreen/**`
- `src/components/cards/**`

Each action was followed into `src/state` (`actions.ts`, `dataSlice.ts`, `runtimeCleanup.ts`),
`src/services` (`workspaceArchive.ts`, `clipImportBatcher.ts`, `audioStorage.ts` import path), `src/domain`
(`collectionManagement.ts`, `workspaceVisibility.ts`, `search.ts`, `ideaTags.ts`,
`libraryNavigation.ts`) and `src/navigation.ts`.

**How it was checked.**
- Every file was read in full.
- Findings marked *verified by scratch test* were run against the real `createDataSlice`, `useStore` and
  `useCollectionEditModal` under Jest, in `src/__audit_scratch_C__/`. That folder has since been
  deleted.
- Nothing was walked in the simulator.

**Earlier reports.** Findings already in 01–08 are referenced by number, not repeated. Two of them sit squarely in this
area:
- **08-R1:** Record or New sketch on a collection page writes into the *active* workspace.
- **08-R6:** a persisted filter makes a full collection say "Nothing here yet".

New evidence for both is under "Additions to earlier findings".

---

## (a) Findings by severity

No CRITICAL. Two HIGH, three MEDIUM, nine LOW.

### HIGH

#### C-H1. The collection page's clip Edit sheet writes old notes over newer ones
**Confidence: verified by scratch test** (the real `useStore` and the real `useCollectionEditModal` hook,
with the player's write copied from the code).

Clip notes are written in two places, and they don't agree.

The collection list's Edit sheet writes **both** `idea.notes` and the clip's `notes`, but pre-fills from
`idea.notes` first.

`src/components/IdeaListScreen/hooks/useCollectionEditModal.ts:22`:
```ts
setEditClipNotesDraft(idea.notes || idea.clips[0]?.notes || "");
```
`src/components/IdeaListScreen/hooks/useCollectionEditModal.ts:33-50`:
```ts
title: nextTitle,
notes: nextNotes,
clips: idea.clips.map((clip) => clip.id === editTargetClip.id ? { ...clip, title: nextTitle, notes: nextNotes } : clip),
```

The full player's Notes page writes **only** the clip.

`src/components/PlayerScreen/index.tsx:371-385`:
```ts
{ ...idea, clips: idea.clips.map((clip) => (clip.id === notesClipId ? { ...clip, notes } : clip)) }
```

**Steps:**
1. Long-press a clip, then More › Edit. Type a note ("A") and tap Save.
2. Open the clip and write more on the player's Notes page ("A + the whole second verse").
3. Back on the list, long-press › Edit again.
4. The sheet shows "A". Change only the title and save, or swipe the sheet away: `ClipNotesSheet` saves on dismiss when anything was edited.

**Effect:** the clip's notes are replaced with the old "A". The newer writing is gone, with no message and no
undo.

Scratch output: `{"sheetShowed":"A","clipNotesAfter":"A","title":"Renamed"}`.

In-collection search also snippets the stale `idea.notes` (`ideaSearchMeta.ts:24, 49-50`).

**Fix:** pre-fill from the clip (`clips[0].notes`) and keep one source of truth. Either stop writing `idea.notes` for
clip ideas, or have the player write both. One migration should copy the newer of the two into the clip.

#### C-H2. "Edit collection" on the workspace hub drops the description you type, then closes as if saved
**Confidence: verified by scratch test** (real `createDataSlice`).

The hub's Edit sheet has a description field and passes it on.

`src/components/WorkspaceBrowseScreen/hooks/useWorkspaceCollectionSelection.ts:394-395`:
```ts
const nextDescription = collectionDescriptionDraft.trim() || undefined;
updateCollection(activeWorkspaceId, managedCollection.id, { title: nextTitle, description: nextDescription });
```

The store applies only the title.

`src/state/dataSlice.ts:1863-1878`:
```ts
updateCollection: (workspaceId, collectionId, updates) => {
    const nextTitle = updates.title?.trim();
    ...
    ? { ...collection, title: nextTitle, updatedAt: Date.now() }
```

**Steps:**
1. On the hub, long-press a collection and tap Edit.
2. Type or fix the description. Save.
3. The sheet closes. The header still shows the old description, and the next Edit pre-fills the old text.

Scratch output: `{"title":"Renamed","description":"old"}`.

Every description edit is lost the same way, while a title-only edit works. The content is small, but this is the
"told success on failure" class.

**Fix:** widen `updateCollection` to take `description` (empty clears it). Add a store test that round-trips both
fields.

### MEDIUM

#### C-M1. Deleting your active (or last) workspace hands the app to a received package
**Confidence: verified by scratch test** (real `deleteWorkspace`, `setPrimaryWorkspaceId`).

Received packages are inserted at the **front** of `workspaces` (`dataSlice.ts:2633-2644`). They also count as "not
archived". So every first-active fallback picks a package:
- `runtimeCleanup.ts:62` `getFirstActiveWorkspaceId` → `activeWorkspaceId` and `lastUsedWorkspaceId` (`:167, 202-213`)
- `resolvePrimaryWorkspaceId` (`dataSlice.ts:466-481`, called at `:2750`)
- `ensureAtLeastOneActiveWorkspace` (`dataSlice.ts:456-464`) sees a package as "an active workspace", so it seeds
  nothing.

**Scratch output:**
- Workspaces `[pkg, A(active, primary), B]`, delete A → `{"active":"pkg","lastUsed":"pkg","primary":"pkg"}`. A new idea
  then lands in the package: `[["pkg",2],["B",0]]`.
- Workspaces `[pkg, A]`, delete A → `{"active":"pkg","ids":[["pkg","received"]]}`. No personal workspace exists.
  - The confirm promised the opposite. `workspaceArchive.deleteFinalBody`: "Deletes {{count}} ideas for good. A fresh
    empty workspace takes their place."
  - The trigger is `useWorkspaceArchiveActions.ts:341`, which counts personal workspaces only.

The workspace list also offers **"Set as primary"** on a received package, because the row is gated only on `!isArchived`
(`useWorkspaceListScreenModel.ts:210-220`). `setPrimaryWorkspaceId("pkg")` is accepted (scratch: `{"primary":"pkg"}`). With
the "primary" startup preference, the app then opens inside someone else's package (`libraryNavigation.ts:366-367`).

**Why it matters:**
- The design rule is that a package is never "where you work" (`WorkspaceList.tsx:49-55`,
  `WorkspaceBrowseScreenContent.tsx:62-65`).
- Once it is active, edits made from visited pages of your own workspaces silently no-op (04-H2's mechanism, in reverse).
- Anything that writes to "the active workspace" writes into the package.
- Search, Activity and Revisit hide the package (`personalWorkspaces`), so new work there disappears from discovery.
- "Delete package" later deletes it with the package.

**Fix:**
- Make every fallback use `writableWorkspaces(...)` (personal and not archived): `getFirstActiveWorkspaceId`,
  `resolvePrimaryWorkspaceId`, `ensureAtLeastOneActiveWorkspace` and the hydration fallback (`useStore.ts:133-137`).
- Have `setActiveWorkspaceId` and `setPrimaryWorkspaceId` refuse received ids.
- Hide "Set as primary" for packages.

#### C-M2. An archived workspace can be made active from Search, and everything written there is erased on Unarchive
**Confidence: verified by scratch test (store and search parts); the unarchive overwrite is verified by reading.**

**Search includes archived workspaces.** `buildGlobalSearchResults` loops over `personalWorkspaces`, which removes only
received packages (`workspaceVisibility.ts:20-22`, `search.ts:289`). Archived stubs keep their ideas, titles, lyrics and
notes. Scratch output: `[["clip","Z","z1"]]` for an idea in archived workspace Z.

**Opening a result activates the stub.** `useSearchScreenModel.ts:110-112` calls `setActiveWorkspaceId(result.workspaceId)`.
`setActiveWorkspaceId` has no archived guard (`dataSlice.ts:1522-1533`); only hydration has one (`useStore.ts:133-137`).

From there, nothing on the collection page or the hub checks `isArchived`. All of these write into the stub:
- the record FAB
- ⋯ › New sketch and ⋯ › Import
- the paste banner
- New collection (hub FAB)
- renames
- the sketch page's lyric and notes writes (which go to `ideaWorkspaceId`)

Scratch output: `{"active":"Z","zIdeas":["idea-…","zz"]}`.

**Unarchive replaces the stub with the snapshot.** `services/workspaceArchive.ts:187-194`:
```ts
function mergeRestoredWorkspace(currentWorkspace, snapshotWorkspace) {
    return { ...snapshotWorkspace, title: currentWorkspace.title, description: currentWorkspace.description, isArchived: false, archiveState: undefined };
```
`actions.ts:3144-3149` swaps it in. Every idea, take, lyric or collection added after archiving is dropped. Their audio
files stay in `songnook/audio` with no reference, breaking the media law.

The comment on `writableWorkspaces` (`workspaceVisibility.ts:24-29`) names exactly this risk:
> anything saved or moved into it would sit outside that archive and be lost on the next unarchive

The stub's clips have no `audioUri` (`stripWorkspaceMedia`), so cards there can't play. People who find an old song
this way are likely to record over it or write to it.

**Severity:** HIGH impact. It is rated MEDIUM only because new archives are switched off in the UI (since 2026-08-04,
`useWorkspaceListScreenModel.ts:240-242`), so only legacy or restored archives are exposed.

**Fix:**
- Filter archived workspaces out of `buildGlobalSearchResults`, or show them read-only with "Unarchive to open".
- Guard `setActiveWorkspaceId` against archived ids.
- In `mergeRestoredWorkspace`, keep ideas and collections that exist only in the stub (or refuse to unarchive while the
  stub differs from the snapshot).

#### C-M3. Copying or moving several collections at once stops halfway; retrying makes duplicates
**Confidence: verified by reading.**

The destinations offered are computed from **one** "anchor" collection, the first selected in storage order
(`useWorkspaceCollectionSelection.ts:108-119`). They are then applied to every selected collection in a loop that
returns on the first error (`:158-176`):
```ts
for (const collectionId of collectionIds) {
  const result = collectionDestinationMode === "move" ? moveCollection(...) : appActions.copyCollection(...);
  if (!result.ok) { AppAlert.info(...); return; }
}
```

**Steps:**
1. Select collection A (no children) and P (has sub-collections).
2. More › Copy › choose "into X". This is offered because the anchor A has no children.
3. A is copied. P fails with "only top level" (`actions.ts:2562-2567`). The alert names no partial success.
4. The modal and selection stay up. Pick "Top level" and confirm.
5. A is copied **again** ("A Copy", "A Copy 2"), plus P.

Move behaves the same way. It can also leave A inside X while P stays put. A second retry then moves A out again.
Selecting [A, B] and choosing "into B" moves A into B, then fails on B ("into itself").

**Fix:**
- Compute destinations that are valid for **every** selected collection (drop "into …" targets when any selected one has
  children, or when the target is itself selected).
- Validate all of them before writing any.
- On a mid-loop failure, report what moved and clear those ids from the selection.

### LOW

- **C-L1. A paste into a received package is allowed.**
  - The clipboard banner shows on a package's collection page (`CollectionHeaderSection.tsx:301-325` always renders it),
    and `pasteClipboardToCollection` accepts any collection (`actions.ts:2635-2638`).
  - Moving your own ideas there is inconsistent with every other path: move pickers use `writableWorkspaces` and the
    record key is hidden. It also hides them from Search, Activity and Revisit.
  - "Delete package" then deletes them. The confirm counts them, but frames them as the sender's items.
  - **Fix:** hide or disable Paste when `isReceivedWorkspace`, or refuse in `pasteClipboardToCollection`.
- **C-L2. Deleting the target collection (or its workspace) during a multi-file import orphans files and reports "done".**
  - The batcher empties its buffer before committing (`clipImportBatcher.ts:47-50`). `importClipsToCollection` then throws
    "Target collection not found" (`actions.ts:1020-1022`) inside `onImported`.
  - `importAudioAssets` counts that one asset as *failed* ("unsupported" message) and the up-to-24 buffered ones as
    *imported* (`audioStorage.ts:718-728`). The job ends "done".
  - The copied files are not in the library and never trashed.
  - In `useCollectionImportFlow.ts:179-180`, the `catch` calls `batcher.flush()` again, which can throw out of the
    async IIFE.
  - **Fix:** commit inside a try that `trashFilesNoLongerUsed`'s the chunk's files on failure, and report the real
    count.
- **C-L3. A kill inside the 5-s multi-delete undo window leaves the deleted ideas' audio on disk for good.**
  - The delete is persisted at once. The trash runs only on undo expiry or unmount
    (`CollectionFloatingActions.tsx:337-339`, `useCollectionSelection.ts:15-23`).
  - After a kill, nothing references the files, and they are not in the 14-day trash either, so they are never purged.
  - **Fix:** journal the candidate URIs (or trash at once and un-trash on Undo, as `restoreReferencedFilesFromTrash`
    already allows).
- **C-L4. "View in collection" quietly changes what the person had set.**
  - The focus peel-back permanently un-hides a hidden idea, expands a collapsed day, and resets the global, persisted
    kind/bookmark filter (`CollectionListSection.tsx:92-110`).
  - Nothing is lost, but a deliberate hide is undone without a word. (The tag-filter gap is 08-R6.)
  - **Fix:** reveal the item temporarily (a session-only override), or say what was un-hidden.
- **C-L5. The selection dock ends the selection before the Delete confirm.**
  - `endsSelection` wraps Delete (`IdeaSelectionBar.tsx:583-592`), so tapping Cancel in "Delete N?" throws away a
    hand-built selection of many items.
  - The delete itself still uses the right ids (the closure holds them).
  - **Fix:** add `"delete"` to `OPENS_SHEET` and cancel the selection inside the confirm.
- **C-L6. The day-divider eye-off still works in selection mode.**
  - Selected ideas folded into a collapsed day stay selected.
  - Delete then removes them too. The count is honest, but they can't be seen when confirming.
  - **Fix:** hide the divider glyph while selecting, or drop folded ids from the selection.
- **C-L7. "Delete package" from a package page that wasn't opened as a visit leaves the person on "Collection missing".**
  - Only visits have `onBack` (`CollectionHeaderMenu.tsx:150-153`).
  - The comment at `CollectionScreenContent.tsx:76` says the model redirects to Browse; no such redirect exists.
- **C-L8. Editing an archived workspace's colour or icon is undone on Unarchive.**
  - `mergeRestoredWorkspace` keeps only the current title and description (`workspaceArchive.ts:187-194`).
- **C-L9. Small input-loss and robustness edges:**
  - **Name sheets drop typing on dismiss.** `QuickNameModal` (rename, new collection) and `WorkspaceModal` drop typed text on Android back or
    dismiss without asking. The text is short, but there is no prompt.
  - **The clip Edit sheet can vanish mid-edit.** If its target is deleted or moved while it is open (for example by an undo), the sheet disappears with its notes:
    `visible` turns false while `saveStandaloneClipEdit` returns early (`useCollectionEditModal.ts:28`).
  - **Copy and create can run twice.** Copy (`CollectionMoveModal`) and New collection (`QuickNameModal`) have no in-flight guard, so a double tap could
    create two (*speculative*: the modal usually closes first).
  - **The hub can show the wrong workspace.** Search's "workspace" result navigates to Browse without a `workspaceId` param (`useSearchScreenModel.ts:116`). If
    the hub's route still holds an older `workspaceId`, it shows that workspace while another is active (*speculative*;
    RN7 param semantics).

### Additions to earlier findings (no severity change)

- **08-R1 (Record / New sketch writes into the active workspace): more paths.**
  - Re-confirmed with `addIdea` on a foreign collection: `[["A",["b1"]],["B",[]]]`.
  - **Compilations and the player queue arrow:** `openIdeaInCollection` (`navigation.ts:275-300`, called from
    `useLibraryScreenModel.ts:149`, `PlayerScreen/index.tsx:1400` and `SongHeaderMenu.tsx:125`) **pushes a visit without
    changing the active workspace**. So a playlist or setlist song from workspace B, then "view in collection", then
    Record, lands the take in A.
  - **The visited page's own up-link and the side menu:** these open `Browse(B)` (`openWorkspaceBrowseRoot(…, B)`;
    `App.tsx:649-656`). The hub uses the route's workspace and never activates it
    (`useWorkspaceCollectionsModel.ts:22-27`), so every collection opened from there has the same mismatch.
  - The recorder's destination line resolves to null in this state (`useRecordingScreenModel.ts:244-246`). The person
    sees no warning.
- **08-R6 (persisted filter shows an empty collection):** the header meta also reads "0 ideas"
  (`useCollectionScreenModel.ts:461-468` counts the filtered list), which reinforces the "empty" reading. The "Show all
  (n)" pill doesn't count filtered-out ideas.
- **04-L1 (a failed import into a new collection deletes the collection):** the hub-side sites
  (`useWorkspaceCollectionImportFlow.ts:161, 174`) are **unreachable today**. `openCollectionImportFlow` is returned but
  never called (grep finds no caller). The risk lives only in the share-intake path.
- **04-H2 (edits in a non-active workspace are dropped):** the same no-ops apply to a visited collection in another
  *personal* workspace (the 08-R1 paths above), not only to received packages. Hide, Show all and the clip Edit sheet all
  do nothing there.

---

## (b) Interaction inventory

Verdict key: **OK** means checked with no data risk. A finding id means see above or the earlier report.

### Collection page (`IdeaListScreen`): header and identity

| # | Screen › element | What it does to data (followed to) | Failure handling | Verdict |
|---|---|---|---|---|
| 1 | Collection › hamburger | opens drawer | — | OK |
| 2 | Collection (picker) › back chevron | `upLink.onPress` → `openParentCollection` / `openWorkspaceBrowseRoot` | — | OK |
| 3 | Collection › up-link eyebrow (parent / workspace / Received) | `openParentCollection` pops or replaces; `openWorkspaceBrowseRoot(B)` opens hub on route ws without activating it | — | OK (feeds 08-R1, see additions) |
| 4 | Collection › "…" overflow toggle | opens/closes header menu, closes filter popover | — | OK |
| 5 | Visit › back (origin label) | `goBackFromParentStack`, else hub | — | OK |
| 6 | Visit › SideMenuButton (hidden in selection/picker) | app menu layer; menu "here" = route workspace | — | OK |
| 7 | Package › "Keep this…" ink link | `ReceivedPackageMoveModal` → `adoptReceivedPackageInto` | modal handles errors | 04-H1 |
| 8 | Package › Keep modal done | `visitCollection` to moved collection (old page left beneath) | — | OK (nav) |
| 9 | Identity › SentLinkChip Copy | clipboard only | swallowed | OK |
| 10 | Missing-collection fallback › back / "Go to your library" | nav | — | OK; see C-L7 |

### Collection page: search, banners, filter and sort

| # | Screen › element | What it does to data (followed to) | Failure handling | Verdict |
|---|---|---|---|---|
| 11 | Collection › search field | local filter, 160 ms debounce; model value wins over a stale timer | — | OK |
| 12 | Activity range banner ✕ | `setParams` clears range | — | OK |
| 13 | Clipboard banner › Paste (same collection) | move: info "can't move here"; copy: confirm → `pasteClipboardToCollection` (clones, shared audio) | confirm | OK |
| 14 | Clipboard banner › Paste (other collection) | confirm "Move/Copy here" → move relocates activity and playlists (not setlists, 04-H1) | confirm; stale ids filtered | OK; on a package page C-L1 |
| 15 | Clipboard banner › ✕ | `setClipClipboard(null)`; nothing was moved yet | — | OK |
| 16 | Paste confirm › Cancel / dismiss | none | — | OK |
| 17 | Filter › kind tabs (All/Clips/Sketches) | `setIdeasFilter` (global, persisted) | — | 08-R6 |
| 18 | Filter › Bookmarked only | same | — | 08-R6 |
| 19 | Filter › stage inks | local state | — | OK |
| 20 | Filter › tag inks / Untagged | `setIdeasTagFilter` (global, persisted; hides all sketches) | — | 08-R6 |
| 21 | Filter › Clear all; popover dismiss | resets | — | OK |
| 22 | Sort › field radio; order tabs | `setIdeasSort` (global, persisted); package forced oldest | — | OK |
| 23 | "Show all (n)" pill | `showAllHidden(collectionId)` (active workspace only) | silent no-op on visits | 04-H2 |
| 24 | Selection bar › All | `replaceListSelection(visible ids)` | — | OK |
| 25 | Selection bar › Cancel | `cancelListSelection` | — | OK |
| 26 | Picker bar › All / Clear | `setLibraryCollectorPicks` | — | OK |

### Collection page: list rows and gestures

| # | Screen › element | What it does to data (followed to) | Failure handling | Verdict |
|---|---|---|---|---|
| 27 | Nested collections toggle | local | — | OK |
| 28 | Nested row tap / chevron | `openCollectionInBrowse` (push, or visit at root) | — | OK |
| 29 | Nested row long-press | opens CollectionActionsModal (`managedCollection` from page ws) | — | OK |
| 30 | Nested › Rename › Save / keyboard submit | `updateCollection(page ws, id, {title})`; empty disabled | — | OK |
| 31 | Nested › Rename › Cancel / Android back | discards typed name | — | C-L9 |
| 32 | Nested › Copy › destination › Copy | `appActions.copyCollection` (new ids, shared audio, "X Copy") | `AppAlert.error` on `!ok` | OK (double-tap C-L9) |
| 33 | Nested › Move › destination › Move | `moveCollection` (descendants follow; activity and playlists relocated) | `AppAlert.error` | OK; cross-ws 04-H1 |
| 34 | Move/Copy modal › Cancel / back / no targets info | resets | info alert | OK |
| 35 | Nested › Delete › confirm | `deleteCollection` (children and items counted; flush then trash) | confirm states scope | OK; no undo 04-M3 |
| 36 | Nested actions sheet dismiss | forgets target | — | OK |
| 37 | Card tap (clip) | `setPlayerQueueForScreen` → full player; no playable clip = no-op | — | OK |
| 38 | Card tap (sketch) | reset inline → IdeaDetail | — | OK |
| 39 | Card tap / long-press (selection mode) | `toggleListSelection` | — | OK |
| 40 | Card tap (collector picker) | `toggleLibraryCollectorPick` (eligibility checked) | dimmed if ineligible | OK |
| 41 | Card tap (song-target picker) › confirm Add | `completeSongTargetPicking` → `saveProjectLyricsAsNewVersion` (idea's own ws, new version) | confirm | OK |
| 42 | Card long-press | `startListSelection` (grab) | — | OK |
| 43 | Lead play/pause | inline preview or drive the dock | — | OK |
| 44 | Lead long-press | selection | — | OK |
| 45 | Waveform scrub (begin/move/cancel), inline ✕ | inline seek only | — | OK |
| 46 | Day divider eye-off tap / long-press | `setTimelineDaysHidden(..., true)` (active ws only) | — | 07-H1, 04-H2; C-L6 in selection |
| 47 | Collapsed day row tap | expand | — | 07-H1 |
| 48 | List scroll / viewability | waveform hydration priority | — | OK |
| 49 | ListScrubber drag | scroll only (grab, light) | — | OK |
| 50 | Empty state | text only | — | 08-R6 |
| 51 | Focus jump from a visit (`focusIdeaId`) | clears search/stage/lyrics; `setIdeasFilter('all')`; un-hides idea; expands day | — | C-L4 |
| 52 | Blur | `cancelListSelection`, inline reset | — | OK |
| 53 | Mount | `markCollectionOpened` | — | OK |

### Collection page: record key, undo toast and selection dock

| # | Screen › element | What it does to data (followed to) | Failure handling | Verdict |
|---|---|---|---|---|
| 54 | Record FAB (hidden in a package) | stop players → `quickRecordIdea(collectionId)` (active ws) → Recording | — | 08-R1 (+paths); archived C-M2 |
| 55 | Undo toast › Undo (delete) | `restoreDeletedIdeas`: narrow restore of ideas, activity, playlist order, setlist/songbook entries, hidden state | — | OK |
| 56 | Undo toast › Undo (make sketch) | `restoreCollectionUndoSnapshot` (whole ws arrays) | — | 04-M6, 08-L2 |
| 57 | Undo expiry (5 s / unmount) | `trashFilesNoLongerUsed(candidates)` | — | C-L3 |
| 58 | Dock › New sketch | `createProjectFromClipIdeas` (draft sketch, clips as takes, relocations) → IdeaDetail | — | 04-M6, 04-L5 |
| 59 | Dock › Play / Queue | `setPlayerQueueForScreen` / `appendToPlayerQueue` (on-screen order) | — | OK |
| 60 | Dock › Hide / Unhide | `setIdeasHidden` (active ws only) | silent no-op on visits | 04-H2 |
| 61 | Dock › Delete › confirm | `deleteSelectedIdeasWithUndo` (page ws; runtime cleanup; authorize guard; undo) | count honest | OK; C-L5 |
| 62 | Dock › Delete › Cancel | selection already cleared | — | C-L5 |
| 63 | Dock › More | opens sheet | — | OK |

### Collection page: More sheet and its sub-sheets

| # | Screen › element | What it does to data (followed to) | Failure handling | Verdict |
|---|---|---|---|---|
| 64 | More › Edit (one clip) → ClipNotesSheet | pre-fill `idea.notes ‖ clip.notes` → `saveStandaloneClipEdit` writes both | — | **C-H1** |
| 65 | ClipNotesSheet › Save / swipe-away (saves if edited) / Cancel / Android back | as above; Cancel discards | — | C-H1; C-L9; 04-H2 on visits |
| 66 | More › Edit (one sketch) | IdeaDetail `startInEdit` | — | OK |
| 67 | More › Bookmark / Remove | `toggleIdeaBookmark` (`updateIdeaInState`, any ws) | — | OK |
| 68 | More › Set aside | Shelf pointer store only | — | OK |
| 69 | More › Tag clips → tag sheet toggles, new custom tag | `setClipTags` (any ws), `addGlobalCustomClipTag` | — | OK |
| 70 | More › Copy or move… › Copy / Move | `startClipboardFromList(mode, pageWs)` + info | — | OK |
| 71 | Copy or move… › Add to playlist | PlaylistChooserSheet (`{ideaId}` items) | — | OK |
| 72 | More › Share… › Share audio | `shareAudioClips` (read) | `AppAlert.error` | OK |
| 73 | Share… › Export file (with sketch) | `shareIdeasFile` (read) | error alert | OK |
| 74 | Share… › Export for DAW | `exportClipForDaw` (read, renders temp) | error alert | OK |
| 75 | Share… › SongNook Send | `openSendSheet(createCardsShareLink)` | sheet | OK |
| 76 | Sheet back / close (More, Copy-move, Share) | none; selection kept | — | OK |

### Collection page: header ⋯ menu and picker footer

| # | Screen › element | What it does to data (followed to) | Failure handling | Verdict |
|---|---|---|---|---|
| 77 | ⋯ › Play all | queue | — | OK |
| 78 | ⋯ › New sketch ("Song") | `addIdea(collectionId)` (active ws, draft) → IdeaDetail | — | 08-R1; archived C-M2 |
| 79 | ⋯ › Import → picker → date prompt (cancel discards picker copies) | — | — | OK |
| 80 | Import (many) › Individual / Song project / Cancel / dismiss | batcher → `importClipsToCollection` (collection's own ws) / name sheet | job toast; unsupported list | OK; C-L2 |
| 81 | Import name sheet › Import | `importClipToCollection` / `importProjectToCollection`; duplicate review (skip / all / per item) | catch → error job | OK |
| 82 | Import name sheet › Cancel / back | `discardPickedCopies` (app cache only) | — | OK |
| 83 | ⋯ › Compact view | local | — | OK |
| 84 | ⋯ › View activity | nav | — | OK |
| 85 | ⋯ › Share › file / Get link | `shareCollectionFile` / Send sheet (read) | error alert; busy guard | OK |
| 86 | ⋯ › Delete package (package only) › confirm | `deleteWorkspace(pkg)` + `onBack` | confirm with count | OK; C-L7 |
| 87 | ⋯ › dev rows (samples / song / receive / Pro preview) | `__DEV__` only | — | n/a |
| 88 | ⋯ backdrop | close | — | OK |
| 89 | Picker footer › Add N | `addLibraryCollectorPicks` → back to compilation | `haptic.error` + info if no charts | OK |
| 90 | Picker footer › Stop adding / Cancel | cancel collector / song picker | — | OK |

### Workspace hub (`WorkspaceBrowseScreen`)

| # | Screen › element | What it does to data (followed to) | Failure handling | Verdict |
|---|---|---|---|---|
| 91 | Hub › hamburger | drawer | — | OK |
| 92 | Hub (collector) › back chevron | `collectorHandlers.onCancel` | — | OK |
| 93 | Hub › search glyph open/close; search field | local filter (close clears) | — | OK |
| 94 | Hub (collector) › identity → WorkspacePickSheet › pick | `setActiveWorkspaceId` unless package; `setParams` | — | OK |
| 95 | Hub › collection row tap | `markCollectionOpened` + push CollectionDetail(route ws) | — | OK (feeds 08-R1) |
| 96 | Hub › row tap / long-press in selection | toggle / start selection (not in picker) | — | OK |
| 97 | Selection › All / Cancel | local | — | OK |
| 98 | Dock › Edit → QuickNameModal (title + description) › Save | `updateCollection(ws, id, {title, description})`; store ignores description | — | **C-H2** |
| 99 | Edit › Cancel / back | discards | — | C-L9 |
| 100 | Dock › Primary | `setPrimaryCollectionId` (refuses archived and nested) | — | OK |
| 101 | Dock › Delete › confirm | `deleteCollection` × collapsed ids (scope summed) | confirm honest | OK; 04-M3 |
| 102 | Dock › More › Copy / Move → CollectionMoveModal › confirm | loop `copyCollection` / `moveCollection`, stops on first error | info alert, partial | **C-M3**; 04-H1 |
| 103 | More › Share… › Export / Send (one collection) | read | error alert | OK |
| 104 | FAB › New collection → QuickNameModal › Create | `addCollection(route ws, title, null, description)` + push | — | OK; archived C-M2; double-tap C-L9 |
| 105 | New collection › Cancel / back | discards | — | OK |
| 106 | Import-to-new-collection modal | `openCollectionImportFlow` has no caller (dead) | — | n/a (04-L1 note) |
| 107 | Picker footer › ✕ / Add | collector cancel / add | — | OK |
| 108 | Android back (selection / collector) | clear selection / cancel | — | OK |
| 109 | Blur | clears selection and More | — | OK |

### Workspace list (`WorkspaceListScreen`)

| # | Screen › element | What it does to data (followed to) | Failure handling | Verdict |
|---|---|---|---|---|
| 110 | List › hamburger | drawer | — | OK |
| 111 | List › clipboard banner (action disabled → info) / ✕ | `setClipClipboard(null)` | — | OK |
| 112 | List › sort pill, sort options, backdrop | `setWorkspaceListOrder` | — | OK |
| 113 | Row tap (personal) | `setActiveWorkspaceId` + Browse(pop) | busy guard | OK |
| 114 | Row tap (package) | ReceivedHome(packageId) | — | OK |
| 115 | Row tap (archived) | opens actions | — | OK |
| 116 | Row "…" (hidden while busy) | action sheet | busy guard | OK |
| 117 | Actions › Edit → WorkspaceModal › Save | `updateWorkspace(title, description, color, avatarKey)` | — | OK; archived C-L8 |
| 118 | WorkspaceModal › Cancel / back (blocked while busy) | discards | — | C-L9 |
| 119 | Actions › Set as primary (personal) | `setPrimaryWorkspaceId` | — | OK |
| 120 | Actions › Set as primary (**package**) | accepted | — | **C-M1** |
| 121 | Actions › Share › file / Get link | `shareWorkspaceFile` / Send (busy guard) | error alert | OK |
| 122 | Actions › Unarchive › confirm | `unarchiveWorkspace` (journal; restore; delete local package) | error alert | 03-#5; **C-M2** (overwrite) |
| 123 | Unarchive (offloaded) › Pick file | DocumentPicker → verify id → restore | picker / restore error alerts | OK |
| 124 | Actions › Move package › Pro gate › confirm › save sheet | `offloadArchivedWorkspace` → "Free space" → `finalizeWorkspaceOffload` (marker persisted first) / "Not saved" keeps local | error alerts; local kept | OK |
| 125 | Actions › Delete permanently › confirm | `deleteWorkspace` (cleanup patch; flush then trash audio and package) | confirm with count | 04-M3; **C-M1** (active / last) |
| 126 | Action / share sheet dismiss, share-sheet back | none | — | OK |
| 127 | FAB › New workspace (Pro gate) → WorkspaceModal › Save | `addWorkspace` (not activated) | — | OK |
| 128 | Picker footer › Cancel (song target) | `cancelSongTargetPicking` | — | OK |

### Side menu (`SideNav`, host in `App.tsx`)

| # | Screen › element | What it does to data (followed to) | Failure handling | Verdict |
|---|---|---|---|---|
| 129 | Menu › search glyph | SearchHome | — | OK |
| 130 | Menu › workspace switch | Workspaces | — | OK |
| 131 | Menu › Collections | Browse(menu's "here" ws = route ws, not activated) | — | OK (feeds 08-R1) |
| 132 | Menu › Recent rows | CollectionDetail(route ws) | — | OK (feeds 08-R1) |
| 133 | Menu › Compilations, Received (badge), Lyric Pad, Shelf (badge), Revisit, Activity | nav only | — | OK |
| 134 | Menu › Sparks / Tuner / Metronome tray | nav only | — | OK |
| 135 | Menu › Settings | SettingsHome overview | — | OK |

### Search (`SearchScreen`)

| # | Screen › element | What it does to data (followed to) | Failure handling | Verdict |
|---|---|---|---|---|
| 136 | Search › field (140 ms debounce) | `buildGlobalSearchResults(personalWorkspaces)` (archived included) | — | C-M2 |
| 137 | Search › filter pills (All / per kind) | local; resets when the bucket vanishes | — | OK |
| 138 | Result › workspace | `setActiveWorkspaceId` (no archived guard) → Browse | — | **C-M2**; C-L9 |
| 139 | Result › collection | `setActiveWorkspaceId` → CollectionDetail | — | C-M2 |
| 140 | Result › sketch / clip | `setActiveWorkspaceId` → `visitCollection(focus)` | — | C-M2 |
| 141 | Result › Lyric Pad page | Notepad (openToken) | — | OK |
| 142 | "N more" note | text (cap 30 per group) | — | OK |

### Workspace row (`cards/WorkspaceCard`)

| # | Screen › element | What it does to data (followed to) | Failure handling | Verdict |
|---|---|---|---|---|
| 143 | WorkspaceCard › row press | see rows 113–115 | — | OK |
| 144 | WorkspaceCard › "…" | see row 116 | — | OK |

### Navigation helpers used by these screens

| # | Screen › element | What it does to data (followed to) | Failure handling | Verdict |
|---|---|---|---|---|
| 145 | `visitCollection` | push, or setParams on the same visit | — | OK |
| 146 | `openIdeaInCollection` | visit **without activating** the idea's workspace | — | 08-R1 (+path) |
| 147 | `openWorkspaceBrowseRoot` / `returnHome` | popTo Home | — | OK |
| 148 | `openParentCollection` | pop to parent or replace | — | OK |
| 149 | `openCollectionInBrowse` | push in stack, else visit | — | OK |

---

## (c) Files read

**Assigned (all read in full):**
- **IdeaListScreen:**
  - `index.tsx`, `types.ts`, `ideaListItemMeta.ts`, `ideaSearchMeta.ts`, `stickyDayStore.ts`, `listGeometry.ts`
  - `provider/CollectionScreenProvider.tsx`
  - `hooks/useCollectionScreenModel.ts`, `hooks/useCollectionManagement.ts`, `hooks/useCollectionSelection.ts`,
    `hooks/useCollectionEditModal.ts`, `hooks/useCollectionImportFlow.ts`
  - `sections/CollectionHeaderSection.tsx`, `sections/CollectionFilterSection.tsx`, `sections/CollectionListSection.tsx`,
    `sections/CollectionFloatingActions.tsx`
  - `components/CollectionScreenContent.tsx`, `components/CollectionModals.tsx`, `components/CollectionHeaderMenu.tsx`,
    `components/IdeaListHeaderSection.tsx`, `components/IdeaListFilterSection.tsx`, `components/FilterSortBar.tsx`,
    `components/IdeaListContent.tsx`, `components/IdeaListItem.tsx`, `components/IdeaListNestedCollectionsSection.tsx`,
    `components/IdeaListSelectionZone.tsx`, `components/IdeaSelectionBar.tsx`, `components/ActionButtons.tsx`,
    `components/ListScrubber.tsx`
  - `__tests__/ideaSearchMeta.test.ts`, `__tests__/listGeometry.test.ts`
- **WorkspaceBrowseScreen:**
  - `index.tsx`
  - `components/WorkspaceBrowseScreenContent.tsx`, `components/WorkspaceCollectionList.tsx`,
    `components/WorkspaceCollectionCard.tsx`
  - `hooks/useWorkspaceCollectionsModel.ts`, `hooks/useWorkspaceCollectionSelection.ts`,
    `hooks/useWorkspaceCollectionImportFlow.ts`
- **WorkspaceListScreen:**
  - `index.tsx`, `styles.ts`
  - `components/WorkspaceListScreenContent.tsx`, `components/WorkspaceList.tsx`
  - `hooks/useWorkspaceListScreenModel.ts`, `hooks/useWorkspaceArchiveActions.ts`
- **Other assigned files:**
  - `SideNav.tsx`
  - SearchScreen: `index.tsx`, `components/SearchScreenContent.tsx`, `hooks/useSearchScreenModel.ts`
  - `cards/WorkspaceCard.tsx`

**Followed into (the relevant functions):**
- **State:**
  - `src/state/actions.ts`: `addIdea`, `quickRecordIdea`, `importClipToCollection`, `importClipsToCollection`,
    `importProjectToCollection`, `copyCollection`, `pasteClipboardToCollection`, `pasteClipboardToWorkspace`,
    `startClipboardFromList`, `archiveWorkspace`, `unarchiveWorkspace`, `offloadArchivedWorkspace`,
    `finalizeWorkspaceOffload`, `completeSongTargetPicking`, `saveProjectLyricsAsNewVersion`
  - `src/state/dataSlice.ts`: `updateIdeas`, `updateIdeaInState`, `addIdea`, `quickRecordIdea`, `addCollection`,
    `updateCollection`, `moveCollection`, `deleteCollection`, `deleteWorkspace`, `archiveWorkspace`,
    `setActiveWorkspaceId`, `setPrimaryCollectionId`, `addReceivedFilesPackage`, `renameIdea`, `toggleIdeaBookmark`,
    `setClipTags`, `setIdeasHidden`, `ensureAtLeastOneActiveWorkspace`, `resolvePrimaryWorkspaceId`, `normalizeIdea`,
    `normalizeClip`
  - `src/state/runtimeCleanup.ts`; `src/state/useStore.ts` (`sanitizePersistedState`)
- **Services:**
  - `src/services/workspaceArchive.ts` (archive, verify, restore, `mergeRestoredWorkspace`)
  - `src/services/clipImportBatcher.ts`; `src/services/audioStorage.ts` (`importAudioAssets`)
- **Domain:**
  - `src/domain/collectionManagement.ts`, `src/domain/workspaceVisibility.ts`, `src/domain/ideaTags.ts`
  - `src/domain/search.ts` (`buildGlobalSearchResults`)
  - `src/domain/libraryNavigation.ts` (`resolveStartupWorkspaceId`, `buildWorkspaceBrowseEntries`)
  - `src/domain/clipPresentation.ts` (`getPlayableClipForIdea`)
- **Navigation:** `src/navigation.ts`; `App.tsx` (`SideNavHost`, `getActiveWorkspaceRouteContext`, startup workspace)
- **Hooks:** `src/hooks/useLibraryCollectorHandlers.ts`
- **Modals and common components:**
  - `src/components/modals/CollectionActionsModal.tsx`, `CollectionMoveModal.tsx` (confirm),
    `QuickNameModal.tsx` (save/cancel), `WorkspaceModal.tsx` (save/cancel), `ClipNotesSheet.tsx` (dismiss-saves)
  - `src/components/common/SentLinkChip.tsx`
- **Other screens:**
  - `src/components/IdeaDetailScreen/components/ClipTagPicker.tsx` (tag writes)
  - `src/components/PlayerScreen/index.tsx:365-385` (clip notes write)
  - `src/components/RecordingScreen/hooks/useRecordingScreenModel.ts:150-260, 425-460` (attach and destination)
  - `ShelfScreen` / `RevisitScreen` / `ActivityScreen` model "view in collection" functions (activation check)
