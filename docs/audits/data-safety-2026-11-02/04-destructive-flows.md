# 04 · Destructive flows & unsaved edits

Read-only audit, 2026-11-02. Scope: every screen and action that changes, moves, merges, replaces or deletes user content, plus every editor that can lose typing. Nothing in `src/` was edited.

**How it was checked.** I read the code. Where it says *verified*, I also ran a throwaway Jest probe against the real `createDataSlice`. The probe lives outside the repo, at `/private/tmp/claude-501/-Users-benmogerman-Projects-song-seed/78f3701c-c818-4d26-8cd1-71473983a764/scratchpad/__tests__/probe.test.ts`. I did not walk any finding on a device or in the simulator.

Severity scale:
- **CRITICAL**: realistic silent loss of user content
- **HIGH**: loss after a plausible slip, or loss behind a misleading confirmation
- **MEDIUM** and **LOW** as usual

No finding is rated CRITICAL. The most serious ones are silent, but each needs a specific path (a received parcel, an app kill mid-edit, or a cross-workspace move followed by a delete).

---

## HIGH

### H1. "Keep" on a received parcel empties its setlists and chart books
**Confidence: verified (store probe).**

- **Where:**
  - `src/state/dataSlice.ts:2649–2682` (`adoptReceivedPackageInto`)
  - `src/state/dataSlice.ts:1883–1999` (`moveCollection`)
  - `src/state/runtimeCleanup.ts` (`pruneCompilationEntries`)
- **How it happens:**
  - Setlist entries and songbook items store a `workspaceId`. On import, `libraryImport.ts:821/843` sets it to the package workspace.
  - "Keep → into a workspace" calls `moveCollection` for each collection. That move relocates `activityEvents` and `playlists`, but **never songbooks or setlists**.
  - It then calls `get().deleteWorkspace(packageId)`.
  - `deleteWorkspace` → `buildRuntimeCleanupPatch` drops every compilation entry whose `workspaceId` is the removed package:

```ts
// runtimeCleanup.ts
songbooks: pruneCompilationEntries(store.songbooks, "items", removedWorkspaceIdSet, removedIdeaIdSet),
setlists: pruneCompilationEntries(store.setlists, "entries", removedWorkspaceIdSet, removedIdeaIdSet),
```

- **Steps:**
  1. A bandmate sends a setlist parcel.
  2. Received → Keep → into "My songs" (`ReceivedParcelSheet.tsx:155` or `ReceivedPackageMoveModal.tsx:110`).
- **What's lost:**
  - The songs move fine.
  - The received setlist and chart book in Compilations are left with **0 entries**: the order, the chosen takes and the charts are gone.
  - Probe output: `{"ok":true,"ideasInMine":["s1","s2"],"setlistEntries":0,"songbookItems":0}`.
- **Same root cause, more general (verified):**
  - Any move across workspaces leaves compilation entries pointing at the old `workspaceId`. This covers `moveCollection` and the clipboard list move in `actions.ts:2660–2706`.
  - Reading still works, because entries resolve by `ideaId`.
  - But deleting the *old* workspace later silently removes those moved songs from every setlist and chart book. Probe: `{"setlistEntries":0}`.
- **Fix:**
  - Add `relocateSongbooks`/`relocateSetlists` next to `relocatePlaylists` in every cross-workspace move: `moveCollection`, paste-move, `relocateIdeaToCollection` and `dissolveSketch`.
  - Or prune compilation entries only by ideas that were actually removed, never by `workspaceId`.

### H2. Edits inside a received parcel (or any non-active workspace) are silently thrown away
**Confidence: verified at store level; the UI path is from reading the code.**

- **Where:**
  - `WorkspaceBrowseScreenContent.tsx:65` never makes a received package active: `if (picked?.origin !== "received") setActiveWorkspaceId(...)`.
  - The sketch page shows ideas from *any* workspace (`useSongScreenModel.ts:37`, `selectIdeaById` falls back across workspaces), and nothing on that page is gated for received content.
  - But these writes only touch the **active** workspace:

| Action | File:line | Effect when the idea is elsewhere |
|---|---|---|
| Rename sketch/clip | `dataSlice.ts:2536` `renameIdea` (`if (workspace.id !== state.activeWorkspaceId) return workspace`) | no-op |
| Sketch title/stage sheet | `useSongEditFlow.ts:64` `updateIdeas(...)` with no `workspaceId` | no-op |
| Sketch notes | `actions.ts:1894` `setIdeaNotes` looks up the idea in the active workspace, otherwise `return` | typed notes vanish |
| Stage / completion | `actions.ts:1867, 1880` | no-op |
| Clip title + notes sheet | `useSongClipEditing.ts:10–14, 60` (`getCurrentStoreIdea` = active only) | typed clip notes vanish |
| Clip edit sheet | `SelectionBars.tsx:287–295` | no-op |
| Branch a take | `SelectionBars.tsx:208` copies the audio file, then the `updateIdeas` no-ops | orphan file, no take |
| Parent picking | `useSongParentPicking.ts:68` | no-op |
| Rename from collection list | `useCollectionEditModal.ts:33` | no-op |
| Hide ideas / days | `dataSlice.ts:2817, 2851` | no-op |
| Audio editor | `EditorScreen/index.tsx:124` resolves `targetIdea` from the active workspace only; `commitExportedClips` returns `[]` | the trim/edit is rendered, then dropped; no toast, the editor pops |

- **Probe:** `renameIdea("s1", "My new name")` and a default `updateIdeas` on a package idea → `{"s1":"s1","s2notes":""}`.
- **Steps:**
  1. Received → open a parcel → a sketch.
  2. Tap the Notes tab → type a paragraph → Save.
  3. Leave and come back. The notes are empty.
- **Fix:** make `updateIdeas` default to `ideaWorkspaceId(...)` of the touched idea, or require the option. Route `renameIdea`, `setIdeaNotes`, `setIdeaStatus`/`Completion` and the editor's lookup through the idea's own workspace. The alternative is to make received sketches visibly read-only.
- **Already handled:** the recorder hits the same mismatch (`useRecordingScreenModel.ts:161, 437–445`) but correctly returns `attached === false`. The take is kept for launch recovery with a dialog (`useRecording.ts:1130`).

### H3. Lyrics editor: an app kill or reload loses the whole writing session
**Confidence: verified by code; plausible in use.**

- **Where:** `src/components/LyricsVersionScreen/hooks/useLyricsVersionScreenModel.tsx:86` holds the draft in `useState(sourceText)`.
  - Nothing is written until the user taps Save (`saveDraft`, line 156).
  - There is no `AppState` flush, no draft store and no autosave.
  - The `beforeRemove` guard (line 132) covers navigation only.
- **Steps:**
  1. Write a verse for 15 minutes in the lyric version editor.
  2. Take a phone call or open the camera; iOS evicts the backgrounded app (or an OTA reload happens).
- **What's lost:** everything typed since the last Save. This is the app's most valuable text.
- **Compare:** Notepad, the chord chart, Cut-Up, Word Ladder and Magpie all use `useDraftText`, which flushes on pause, unmount and background. The player writer autosaves every 700 ms.
- **Fix:** keep a persisted per-idea draft (a satellite store) written on pause and on background. Offer it on reopen ("Unsaved words from 4:12 PM: Restore / Discard"). Explicit Save keeps controlling *which version* the draft lands in.
- **Related, LOW:** the reseed effect (lines 113–121) overwrites `draftText` whenever `sourceText` changes mid-edit, for example after a merge restore or a hydration replay.

### H4. Sketch Notes editor: Cancel and Android back discard typing without asking
**Confidence: verified by code.**

- **Where:** `src/components/IdeaDetailScreen/components/SongNotesEditor.tsx:39`:

```tsx
<Modal visible={visible} animationType="slide" onRequestClose={onClose}>
```

  - `onClose` (`IdeaNotes.tsx:45`) only hides the editor. The Cancel key does the same.
  - The draft is local state, so an app kill loses it too.
- **Steps (Android):**
  1. Type notes.
  2. Press back once to drop the keyboard, then press back again.
- **What's lost:** the typed notes, silently.
- **Fix:** follow the ClipNotesSheet rule (dismiss saves if edited; only an explicit Cancel discards), or confirm when the draft differs.

### H5. Player "Delete clip" on a sketch's only take deletes the whole sketch, lyrics included
**Confidence: verified by code.**

- **Where:** `src/components/PlayerScreen/hooks/usePlayerScreenLifecycle.ts:711–744`. With `emptiesIdea` (`clips.length <= 1`) it calls `useStore.getState().deleteIdea(playerIdea.id)`.
- **The copy** (`en.ts` `deleteOnlySongBody`) reads:

  > This is the only take in "{{title}}", so the whole sketch goes. Its audio moves to Trash.

  It mentions audio, which sounds recoverable. It never says that every lyric version, the chord chart and the notes go with it.
- **Missing safeguards:** there is no undo, and no "keep the sketch" option. Yet sketches can be empty: the header menu's draft path and `deleteSelectedClips` both leave a 0-take sketch.
- **Fix:** deleting the last take should keep the sketch, or offer the same choice as `SongHeaderMenu` (delete the take / delete everything).

### H6. "Moves to Trash" promises a Trash the person can't open; nothing restores deleted entities
**Confidence: verified by code.**

- **Where the promise is made:**
  - `en.ts:680, 683, 778`: "Audio moves to Trash" / "Its audio moves to Trash".
  - Settings: "Removed clips wait in trash 14 days".
- **Why it doesn't hold:**
  - No screen lists `SONG_NOOK_TRASH_DIR`; only `services/managedMedia.ts` touches it.
  - `recoverOrphanedAudio` (`actions.ts:3236`; `services/audioRecovery.ts`) does not scan the trash.
  - `restoreReferencedFilesFromTrash` only brings back files the library still references.
  - So once a delete is durable, its audio cannot be reached through the app.
  - The *metadata* (lyrics, chord charts, notes, titles, marks, layers' placement, tags) has no trash at all.
- **Misleading wording:** the sketch page's take delete says "Remove this take from the sketch?" / "Remove these takes from the sketch?" (`en.ts:1212–1213`, `SelectionBars.tsx:322`). That reads like a move out of the sketch (as "Keep takes" does), but the takes are deleted.
- **Fix:** either build an entity-level "Recently deleted" (deleted ideas, collections and workspaces kept as snapshots for 14 days, beside their trashed files), or change the copy to "This can't be undone" and say "Delete" for takes.

---

## MEDIUM

### M1. "Keep takes" on sketch delete quietly drops every lyric version, the chart and the notes, and leaves ghost rows
**Confidence: verified by code.**

- **Where:** `actions.ts:2344–2380` (`dissolveSketch`), offered by `SongHeaderMenu.tsx:155–176` as the safe choice: "Keep its takes as clips, or delete everything?"
- **What happens:**
  - The sketch's `lyrics.versions`, `chordSheet` and `notes` are discarded, with no undo.
  - The function skips `buildRuntimeCleanupPatch`, so songbook items and setlist entries for the sketch are neither relocated nor pruned. They become the ghost rows that `runtimeCleanup.ts` says must not exist.
- **Fix:**
  - Either name the cost ("Lyrics and chart are deleted"), or move each lyric version to a Lyric Pad page.
  - Prune or relocate compilation entries.

### M2. Player writer can save one sketch's words over another sketch's latest version
**Confidence: plausible (timing).**

- **Where:**
  - `PlayerLyricsWriter.tsx:30–60` is keyed on `writingSession`, not on `ideaId` (`PlayerScreen/index.tsx:1978`).
  - `latestRef.current = { ideaId, text, textDirection }` updates on every render.
  - Reading is closed in an effect *after* the render where `ideaId` has already changed (`index.tsx:911–918`).
- **Steps:**
  1. Write in sketch A from the player.
  2. Within 700 ms of the last keystroke, tap Next (or the queue auto-advances) onto sketch B.
- **What happens:** the debounce or unmount flush runs `saveProjectLyrics(B, <A's text>)`. B's living version is replaced in place, with no new version and no undo. A also loses its last keystrokes.
- **Fix:** flush synchronously when `ideaId` changes (`useLayoutEffect` keyed on `ideaId`, or capture `ideaId` at the keystroke as `useDraftText` does). Also key the writer on `${writingSession}-${ideaId}`.

### M3. Deleting a collection or workspace has no undo; deleting ideas does
**Confidence: verified by code.**

- **Where:**
  - `useCollectionManagement.ts:116–133`
  - `useWorkspaceCollectionSelection.ts:184–216`
  - `useWorkspaceArchiveActions.ts:279–353`
  - These call `deleteCollection`/`deleteWorkspace` (`dataSlice.ts:2001, 2711`) straight after one confirm.
- **Compare:** idea multi-delete gets a 5 s undo with deferred trashing (`CollectionFloatingActions.tsx:277–340`). The largest cascades (child collections, every sketch's lyrics, setlist entries) are the least recoverable.
- **The confirms are honest:**
  - "{{title}} will be removed with {{children}} and {{items}}."
  - "permanently delete N ideas. This cannot be undone."
- **Fix:** reuse the snapshot, deferred-trash and narrow-restore pattern of multi-delete, or rely on the H6 "Recently deleted".

### M4. A failed re-receive deletes the person's earlier kept setlists, chart books and playlists
**Confidence: verified by code.**

- **Where:** `TransferReceiveScreen/index.tsx:393–398`, in the catch block:

```ts
state.setlists.filter(fromThisParcel).forEach((setlist) => state.deleteSetlist(setlist.id));
state.songbooks.filter(fromThisParcel).forEach((songbook) => state.deleteSongbook(songbook.id));
state.playlists.filter(fromThisParcel).forEach((playlist) => state.deletePlaylist(playlist.id));
```

  - `alreadyReceived` (line 140) checks only *workspaces* for the `transferId`.
  - After "Keep" (the package is deleted, H1), the link can be opened again.
- **What happens:** if that second save fails (network, storage), the cleanup deletes the *first* receive's setlist, chart book and playlist. They still carry `received.transferId`, and the person may have reordered or annotated them.
- **Fix:** delete only the ids this attempt created (from the import result), and count compilations in `alreadyReceived`.

### M5. Editor "Replace" on a lone clip turns it into a new idea
**Confidence: verified by code.**

- **Where:** `EditorScreen/hooks/useEditorExportFlow.ts:270–307`. When `keepStack` is false, it builds `createdIdeas` with a new `id`, `createdAt: now + index`, and no `isBookmarked`/tags/hidden state. It then does `prev.filter((idea) => idea.id !== ideaId)`.
- **What's lost:**
  - The bookmark.
  - The original date: the clip jumps to "Today" in day grouping.
  - Its Shelf entry, playlist items, setlist/songbook entries and activity now point at a dead id, all silently.
  - The combine-replace path (`actions.ts:1706`) correctly reuses `match.idea.id`.
- **Fix:** with a single result, reuse the source idea id and its idea-level fields (the "replace in place" branch already exists for stacks).

### M6. Make-sketch undo puts the whole workspace snapshot back
**Confidence: plausible.**

- **Where:** `CollectionFloatingActions.tsx:90–104, 463–465`. `restoreCollectionUndoSnapshot` replaces the workspace's `collections` and `ideas` wholesale with what was there before.
- **What happens:**
  - Anything written to that workspace during the 5 s window is reverted, and its new files are orphaned. Examples: an import batcher landing clips, or the sketch page the user was just pushed onto.
  - The toast sits on the collection page *under* the pushed sketch page, so the person rarely sees it.
- **Fix:** use the narrow restore shape that multi-delete has (`restoreDeletedIdeas`): remove the made sketch, put back the folded clip ideas, keep everything else.

---

## LOW

- **L1. A failed import into a new collection deletes the whole collection.** Sites: `useShareImportScreenModel.ts:539, 552`; `useWorkspaceCollectionImportFlow.ts:161, 174`; similar code in `useCollectionImportFlow.ts`.
  - On a throw, `batcher.flush()` is followed by `deleteCollection(collectionId)`.
  - This removes clips already imported, *and* anything the person recorded or moved into that collection while the import ran.
  - The source files still exist outside the app. Fix: delete only the imported ideas, or delete only when the collection is empty.
- **L2. Shelf and the clock.** Setting the date forward sweeps every entry; the "Recently left" list caps at 5, so membership beyond five is gone. The library is untouched (`useShelfStore.ts`, test `shelfLeavesLibraryAlone`).
  - Trash purge (`managedMedia.ts:269`) is time-based too. A clock jump empties the safety net, but it runs after `restoreReferencedFilesFromTrash`.
- **L3. Player delete copy.** For a *clip* idea with older versions it says "Remove this take from the sketch?" (`usePlayerScreenLifecycle.ts:721–724`).
- **L4. Combine-replace on a lone clip re-titles the idea and resets its date.** It sets `title: buildCombinedClipTitle(...)` and `createdAt: now` (`actions.ts:1706–1720`), so a typed idea title is replaced.
- **L5. Make-sketch from the list drops the clip ideas' idea-level fields** (bookmark, hidden state; `CollectionFloatingActions.tsx:396–426`). Their songbook/setlist entries also dangle, because no cleanup runs.

---

## Solid (checked, holds up)

- **Shelf expiry never touches content.** It only moves an entry to "Recently left" (`useShelfStore.ts`; `shelfLeavesLibraryAlone.test.ts`). Revisit only snoozes. Neither screen calls any delete.
- **Import never overwrites existing content.** Every imported workspace, collection, idea, clip, lyric version, setlist entry and songbook item gets a fresh id (`libraryImport.ts:119, 622, 707, 813–848`). Send receives are deduped by `transferId`.
- **Deletes make metadata durable first, then trash files.** Only unreferenced files are trashed (`filterUnreferencedManagedAudioUris`), so copies that share audio are safe. Deleted files wait 14 days, and on launch any file the library still points at is un-trashed before the purge (`App.tsx:1293`, `managedMedia.ts:213`).
- **Multi-delete undo restores narrowly.** It brings back the deleted ideas, their activity, playlist order, songbook and setlist entries, and hidden state, and keeps writes made since (`restoreDeletedIdeas`). Files are trashed only when the undo expires.
- **Confirms name what gets deleted** for collections (including children and item counts), workspaces, received packages and multi-select sketches. Erase-all asks twice.
- **Sketch delete offers "Keep takes".** A discarded draft gathered from clips gives the clips back (`dissolveSketch`). A discarded "Make sketch" draft goes back to the same clip idea (`revertDraftToClipIdea`). Drafts stranded by a kill are recovered on launch.
- **Combine-replace and editor-replace keep older versions** stacked under a clip (f4a72e54), and every replace trashes the dropped take through `mediaCleanup.ts`.
- **A recording that can't attach is kept** for recovery with a dialog (`useRecording.ts:1130`), never orphaned silently.
- **`useDraftText` editors flush on pause, unmount and background:** Notepad title and body, the chord chart, Cut-Up, Word Ladder and Magpie. Leaving a spark with content asks Discard / Save unfinished / Keep working; sending again to the Pad asks before updating the linked page.
- **The clip notes sheet saves on swipe-away when edited**; only Cancel discards. The sketch edit sheet and the lyric editor guard back and swipe with a discard prompt.
- **Deleting a lyric version warns** with the count of takes, charts and setlists that reference it. A stale reference falls back to latest with a toast.
- **Archive packs before stripping** and re-packs if the workspace changed meanwhile. Archived stubs keep their ideas, so delete counts are true. Offload deletes the local package only after an explicit "it's saved" confirm, with the marker persisted first.
- **Selection is cleared on blur** (`CollectionListSection.tsx:45–49`). Select-all covers visible rows only. Hidden items stay reachable through "Show all (n)" / "Restore hidden".
