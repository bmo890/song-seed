# 12b — Sweep B: the sketch page, lyric versions, chord charts

Read-only sweep, 2026-11-02. Scope:
- `src/components/IdeaDetailScreen/**`: the sketch and clip page. This covers the takes list, the version stacks, the header menu, the edit sheet, tabs, notes, tags, groups, selection mode, parent picking, Make sketch, import, paste and the share sheet.
- `src/components/LyricsScreen/**`, `src/components/LyricsVersionScreen/**` and `src/components/ChordSheetScreen/**`.

Every action was followed into `state/actions.ts`, `state/dataSlice.ts` and the domain files: `lyrics.ts`, `chordSheet.ts`, `clipGraph.ts`, `clipLineageTitles.ts`, `clipLineageRenamePrompt.ts`, `sketchTakeRenames.ts` and `draftRecovery.ts`.

**How it was checked.** I read every file in the four folders. Three findings were also run against the real store and domain code in a throwaway Jest suite, `src/__audit_scratch_B__/__tests__/sweepB.test.ts` (deleted when I finished). Those findings are marked *verified by scratch test*; the probe output is quoted under each. Nothing was checked on a device or simulator.

**Already reported elsewhere, and not repeated here:**
- 04-H2: edits to an idea outside the active workspace are no-ops.
- 04-H3: the lyric editor has no autosave.
- 04-H4: sketch notes Cancel and back discard silently.
- 04-H5: the player's last-take delete.
- 04-H6: the take-delete copy and the missing trash UI.
- 04-M1: "Keep takes" drops lyrics and leaves ghost rows.
- 04-M2: the player writer.
- 03-#4: Make-sketch Discard drops older versions.
- 03-#12: a shared mix can be trashed.
- 08 reference map: stale group keys are dropped.
- 09-#4: unguarded `pickImportAssets`.

The inventory refers to these by number.

---

## Summary

| Id | Severity | One line |
|---|---|---|
| B-H1 | **HIGH** | "Make sketch" outside the active workspace can't be saved, and Discard (or plain back) **deletes** the clip, or every clip gathered into it |
| B-H2 | **HIGH** | Adding or removing a lyric line moves every chord below it onto the wrong line, and drops the last line's chords; the edit saves in place |
| B-M1 | MEDIUM | The lyric version page only looks in the active workspace, so lyrics of received songs and of other workspaces' setlist songs show "no longer available" |
| B-M2 | MEDIUM | Chart: a pending note or text-block draft writes the whole chart from its keystroke-time snapshot, reverting a bar add, move or clear made in the last ½ s |
| B-M3 | MEDIUM | "All" in sketch selection selects takes hidden by the active filter and by folded groups; Delete then removes them, and the confirm gives no count |
| B-M4 | MEDIUM | Re-threading or deleting a grouped thread's root silently drops the thread from its group; the Undo toast brings back the threads but not the group |
| B-M5 | MEDIUM | "Primary" in clip edit mode is shown as chosen but never saved |
| B-L1 … B-L11 | LOW | Blank version pre-filled, Branch failing silently, import duplicates and leaks, no undo in the lyric chord editor, picker reset, and others (below) |

**Inventory:** 152 rows (numbered 1–132, plus N1–N5, L1–L14 and C1).

---

## HIGH

### B-H1. "Make sketch" outside the active workspace: Save does nothing, and Discard deletes the clip and its versions (or every clip gathered into the draft)
**Confidence: verified by scratch test (store level). The UI path is from reading the code.**

**Where:**
- `state/actions.ts:2150–2169` (`deleteSelectedIdea`) only looks the draft up in the **active** workspace. When it isn't there, it falls through to `deleteIdea`, which deletes across workspaces (`dataSlice.ts:3351`):

```ts
const activeWs = state.workspaces.find(w => w.id === state.activeWorkspaceId);
const selectedIdea = activeWs?.ideas.find(i => i.id === state.selectedIdeaId);
if (selectedIdea?.isDraft && selectedIdea.draftFromClipIdea) { …revertDraftToClipIdea… }
else if (selectedIdea?.isDraft && selectedIdea.clips.length > 0) { appActions.dissolveSketch(…) }
else { state.deleteIdea(state.selectedIdeaId); }   // ← a draft in another workspace lands here
```

- Drafts are deliberately created outside the active workspace:
  - `convertClipIdeaToProject` patches the idea's home workspace (`actions.ts:2408–2422`, "the door may grow an idea that isn't in the active one").
  - The collection's Make sketch builds the draft in "the page's workspace" (`CollectionFloatingActions.tsx:376–377`). On a visited received package, that is the package, never the active workspace.
- Save cannot finish the draft. `useSongEditFlow.ts:64` calls `updateIdeas(...)` with no `workspaceId`, which is a no-op for that idea (04-H2), so `isDraft` stays `true`. The sheet still closes (`setIsEditMode(false)`, line 105).
- After that, the page's `beforeRemove` guard (`useSongEditFlow.ts:153–160`) stops every back press while `isDraft`. It then shows "Discard this sketch? Nothing has been saved yet." Its Yes runs the same `deleteSelectedIdea(true)`.

**Steps (any of the three entry points):**
1. Received → open a parcel → open a clip with two versions → ⋯ → **Make sketch**. Or: select three clips in the parcel's collection → **Make sketch**. Or: the full player auto-advances to a clip from another workspace → the Sketch door.
2. Type a name → **Save**. The sheet closes; the page stays a draft (no Lyrics or Chart tabs, cards can't play).
3. Press back. The prompt asks "Discard this sketch?" → **Yes, remove**, or tap **Discard** in step 2 instead.

**What's lost:** the clip idea and all its versions, or every gathered clip. Their audio is trashed once the delete is durable. There is no undo. If the person taps "Keep" on the prompt, back never works on that page.

**Probe output:**
```
B1   {"draftKind":"project","draftIsDraft":true,"afterSaveIsDraft":true,"afterSaveTitle":"porch","afterDiscard":"IDEA GONE"}
B1c  {"pkgIdeas":[]}                       ← two-clip gathered draft in a received package, after Discard
B1c-control {"mineIdeas":["x:clip","y:clip"]}   ← same draft in the active workspace: clips released
B1b  {"kind":"clip","clips":["c1-v2"]}   ← active-workspace control also confirms 03-#4 (v1 dropped)
```

**Fix:**
- Look the draft up with `ideaWorkspaceId(...)`, not the active workspace, in `deleteSelectedIdea`, and pass that `workspaceId` to the Save `updateIdeas` in `useSongEditFlow`.
- Never fall back to `deleteIdea` for an idea that has `isDraft`.

### B-H2. Editing lyric text re-anchors chords by line index: one inserted or deleted line shifts every chord below it, and drops the last line's
**Confidence: verified by scratch test (domain).**

**Where:** `domain/lyrics.ts:26–45`. Each new line inherits the chords of the *previous document's line at the same index*. When the text differs, each anchor is clamped to the new line's length:

```ts
const lines = rawLines.map((lineText, index) => {
  const previousLine = previousLines[index];
  const preserveChords = previousLine?.text === lineText ? previousChords
    : previousChords.map((chord) => { const graphemeAt = Math.min(chordGraphemeAnchor(chord, previousLine?.text ?? ""), graphemeCount(lineText)); … });
```

Every lyric save goes through this function:
- `saveProjectLyrics` (in place on the latest version, `actions.ts:1917`), from the lyric version editor's Save.
- `saveProjectLyricsAsNewVersion` (`:1960`), from Save as new and from forking an older version.
- The player writer's 700 ms autosave (outside this sweep; it makes the effect worse).

**Probe** (four charted lines; the writer adds a blank line between the couplets, or deletes line 2, then saves):
```
inserted:  "Down by the river" <- G@0,D@12 | "where the water runs" <- Em@6 | "" <- C@0 | "I left my heart" <- G@15 | "and it never came home" <- -
removed:   "Down by the river" <- G@0,D@12 | "I left my heart" <- Em@6 | "and it never came home" <- C@2      (G gone)
Enter then Backspace (two autosaves):  "where the water runs" <- Em@0 (was @6) | "I left my heart" <- C@2 | "and it never came home" <- G@15 (was @17)
```

**Steps:**
1. Chart chords onto a verse in the lyric version page.
2. Later, edit the words: add a blank line between verse and chorus, or cut a line. Tap **Save**.

**What happens:**
- Every chord after the edit point sits over the wrong words.
- Anchors clamped to a shorter line keep their clamped value, so even undoing the edit can't restore them.
- The final line's chords are deleted.

This is a silent edit to the living version, made in place, with no version kept and no undo. The words look right, so the person only notices at rehearsal.

**Fix:** match old to new lines by text before falling back to the index: diff the two line arrays (LCS), keep exact matches, and re-anchor only the lines that really changed. Add a test with an inserted line and a deleted line.

---

## MEDIUM

### B-M1. The lyric version page only finds sketches in the active workspace
**Confidence: verified by reading.**

- **Where:** `LyricsVersionScreen/hooks/useLyricsVersionScreenModel.tsx:56–63` resolves `projectIdea` only from `activeWorkspace.ideas`. A miss renders `LyricsVersionUnavailableState`: "This lyrics version is no longer available."
- The sketch page and the chord chart page both resolve across workspaces (`selectIdeaById`). The lyric page doesn't.

**Steps:**
1. Received → a parcel's sketch → Lyrics tab → tap the lyric card, Start writing, or + Version.
2. Or: a setlist that holds a song from another workspace → the song → **Lyrics** (`SetlistSongScreen/index.tsx:157`). Its **Chart** key next to it works.

**Effect:**
- The words are unreachable (they can't be read full-page, edited, charted or exported), and the copy says they are gone.
- Nothing is lost, but it says the person's lyrics no longer exist.

**Fix:** resolve with `selectIdeaById(workspaces, ideaId, activeWorkspaceId)`, as `useChordSheetModel` does. The save actions already target `ideaWorkspaceId`.

### B-M2. Chart: a pending note or text-block draft commits a stale whole-chart snapshot
**Confidence: verified by reading. Timing-dependent but plausible.**

**Where:**
- `ChordSheetSection.tsx:56` and `ChordSheetBody.tsx:427` use `useDraftText(value, commit)`. The commit "captured at typing time is the one that runs" (`useDraftText.ts:19–21`, `draftCommitter.ts:42–47`).
- That commit is `(t) => model.setBlockText(section.id, t)` / `onNotes`, which calls `mutateSection` → `commit({ ...sheet, sections: sheet.sections.map(…) })` (`useChordSheetModel.ts:105–111, 134–139`).
- `sheet` is the whole chart **as rendered at that keystroke**. The flush fires 500 ms after the last key, on blur, or on unmount.
- The editor scroll views use `keyboardShouldPersistTaps="handled"`, so tapping a key leaves the field focused (no blur flush).

**Steps:**
1. In chart edit mode, type a section note ("half time").
2. Within half a second, tap the section's ghost **+** bar, or the dock's Before / After / Clear / Delete, or ⋯ → Move up, or Undo.
3. The note's timer fires and writes the old chart plus the note.

**Effect:**
- The bar just added disappears; cleared chords or deleted bars come back; a move or undo is reverted.
- A history entry built from the stale snapshot is also pushed.
- Small and visible, but it is a dropped edit with no message.

**Fix:** make the commit functional. `setBlockText`/`setSectionNotes` should read the current `chordSheet` from the store at commit time and patch only that section's field. Or flush pending drafts before every other `commit`.

### B-M3. "All" in sketch selection selects takes the person cannot see
**Confidence: verified by reading.**

**Where:**
- `songClipToolbar/SongClipListToolbar.tsx:22, 40`: `selectableClipIds = selectedIdea.clips.map(c => c.id)`, then `replaceClipSelection(selectableClipIds)`.
- The tag, group and Bookmarked filters stay on in selection mode. Folded groups and folded "N older" versions are not on screen.
- The delete confirm is "Delete clips? / Remove these takes from the sketch?" with no number (`en.ts:1210–1213`). The only count is "20 selected" in the toolbar row.

**Steps:**
1. Filter the takes to Chorus (3 of 20 showing).
2. Long-press one → **All** → **Delete** → confirm.

**What's lost:** all 20 takes. `deleteSelectedClips` has no undo, and the audio is trashed once the delete is durable.

**Compare:** the collection's select-all covers visible rows only (04 "Solid").

**Fix:**
- Select the visible clip ids (the filtered lineages, unfolded rows).
- Put the count in the confirm title ("Delete 3 takes?").

### B-M4. Group membership is dropped by re-threading or root deletion, and the Undo toast doesn't restore it
**Confidence: verified by scratch test.**

**Where:**
- Groups are keyed by lineage **root** id. `normalizeClipGroupAssignments` (`dataSlice.ts:987–1005`) runs on every `updateIdeas` of the idea and drops any key that is no longer a root.
- These actions turn a grouped root into a child:
  - Set parent: `useSongParentPicking.ts:145`.
  - Combine into thread: `:212`.
  - Deleting a thread's root: `actions.ts:2178`, where `repairDanglingClipParents` makes the children roots.
- The undo callbacks restore `parentClipId` only (`:146–152`, `:213`). The assignment is already gone.

**Probe:**
```
B3 {"before":{"a":"g1"},"afterCombine":null,"afterUndo":null,"groupsLeft":["Verses"]}
```

**Steps:**
1. Group a take into "Verses".
2. Select it and an older take → Versions → **Combine into thread** → **Undo**.

**Effect:**
- The take is out of "Verses" for good, and "Verses" lingers empty.
- Grouping is a capability named in CLAUDE.md's guardrail.
- 08 noted the key drop as harmless to visibility; the loss of the grouping and the incomplete undo were not reported.

**Fix:**
- When a root gets a parent, move its assignment to the new root if that one has none.
- When a root is deleted, move the assignment to the promoted child.
- Snapshot `clipGroupAssignments` into each undo.

### B-M5. "Primary" in clip edit mode is shown as chosen but never saved
**Confidence: verified by reading.**

**Where:**
- In clip edit mode, `ClipCardPrimaryIndicator.tsx:42–46` offers **Primary** on non-primary versions. It calls `handleSetPrimary` → `setPendingPrimaryClipId(clip.id)` (`ClipCard.tsx:271–273`).
- `useSongClipListData.ts:104` displays the pending id as the primary.
- Nothing commits it. `useSongEditFlow.handleSave` writes the title, stage and draft flags only, and `pendingPrimaryClipId` has no other consumer (grep).

**Steps:**
1. Open a clip with versions → ⋯ → **Edit clip** → tap **Primary** on an older version.
2. Tap **Save**. The page shows that version as primary.
3. Leave and return. The old version is primary again.

The player, collection card, setlists and exports use the old one throughout.

**Fix:** commit with `markBestClip` (or its cross-workspace equivalent) in `handleSave` and clear the pending id; or apply it immediately on tap.

---

## LOW

- **B-L1. "Blank version" opens pre-filled with the latest version.**
  - `LyricsVersionsPanel.tsx:187` opens with no `versionId`. `useLyricsVersionScreenModel.tsx:66–69` then resolves `resolvedVersion = latestVersion`, so the draft is the latest text.
  - Saving it carries the latest version's chords forward (`saveProjectLyricsAsNewVersion(…, resolvedVersion.document)`).
  - The result is a duplicate version unless the person clears it. Back is "cancel edit", not leave.
  - Fix: when `createDraft`, seed `""` with no base document.
- **B-L2. Branch fails silently, and its undo restores a stale snapshot.**
  - `SelectionBars.tsx:179–228`: if `FileSystem.copyAsync` fails (full disk, missing source), the take is still created with `audioUri: undefined`. The toast says "Copied out …"; there is no error haptic or message.
  - The extension comes from `split(".").pop()`, so a URI without one builds a nonsense path.
  - Undo writes `clips: previousClips`, which was captured when the sheet opened. Any change to that sketch's takes within the 5 s window is reverted.
  - Fix: abort with `AppAlert.error` and `haptic.error()` on copy failure, and undo by removing the branched id only.
- **B-L3. The import name sheet can import twice, and leaks the picked copy.**
  - `useSongImportFlow.ts:55–113`: Save reads `importAsset` from the render, so a fast double tap runs `proceedWithImport` twice, giving two copies and two takes. The duplicate check runs before either lands.
  - Duplicate review **Skip** (`:107`, `() => {}`) never calls `discardPickedCopies`.
  - If the sketch is deleted while the copy runs, `importClipToProject` no-ops, yet the job reports `done` and the copied file stays orphaned in `songnook/audio`.
  - Picker rejections: see 09-#4.
- **B-L4. The lyric chord editor has no undo.**
  - With a palette chord armed, one stray tap drops a chord immediately (`useChordEditing.ts:63–66`).
  - The picker's trash removes a chord with no confirm. A drag commits a move.
  - None of this can be undone. The block chart has undo; this editor doesn't.
- **B-L5. Chart chord picker: in-progress choices reset whenever the page re-renders (edit mode only).**
  - `pickerInitial` is a fresh object on every render (`useChordSheetModel.ts:267`). The picker re-seeds on `[visible, initial]` (`ChordPickerSheet.tsx:47–50`).
  - Focusing the custom-suffix field raises the keyboard. The chart host's `setKeyboardHeight` then re-renders the page and wipes the root and quality just chosen.
  - Fix: memoize `pickerInitial` on the target and the chord string.
- **B-L6. Tag picker toggles compute from the props snapshot.**
  - `ClipTagPicker.tsx:102–117` builds each next array from `clip.tags` of the last render. Two toggles on the same take before a re-render make the second write overwrite the first.
  - Speculative at human tap speed.
- **B-L7. Renaming a clip idea renames `clips[0]`, which may not be its primary** (`dataSlice.ts:2557`). New versions are prepended (`useRecordingScreenModel.ts:496`), so the newest non-primary version gets the idea's name.
- **B-L8. Clip edit mode drops unsaved inline card edits.**
  - The inline title and notes form (`ClipCardEditForm`) is discarded with no prompt on header Save, on header Cancel and on back.
  - `hasChanges` (`useSongEditFlow.ts:36–43`) compares only the idea's title and stage.
- **B-L9. Clip ideas: delete copy and an emptied idea.**
  - The header's **Delete clip** confirm is "Delete "X"?". It removes every version, with no count and no undo (see 04-H6).
  - In a clip idea's page, selecting every version by long-press → Delete leaves a 0-clip "clip" idea in the collection.
  - In a received or other workspace, the dock Delete is a silent no-op (`deleteSelectedClips` is active-workspace only; 04-H2 class).
- **B-L10. A page whose idea was deleted elsewhere can show another idea.**
  - `useSongScreenModel.ts:37–41` falls back to the global `selectedIdeaId` when the route's idea is gone.
  - Steps: sketch A beneath B, A deleted from the player (04-H5), then a swipe-back from B (which skips `backToIdeas`). A's page now shows B.
  - Its title says B, so actions hit what's shown. It is confusing, but it isn't a wrong-item write.
- **B-L11. Smaller notes:**
  - The Lyric Pad import (`importFromLyricsPad`) and the lyric editor's Save can both double-fire on a fast double tap, making a duplicate version.
  - `pasteClipboardToProject` returns `[]` silently when the source is gone. For a received sketch it always is, because `startClipboardFromProject` records the active workspace as the source (`actions.ts:3030–3045`). The banner stays with no message.
  - `SongNotesEditor` re-seeds the draft if `initialNotes` changes while it is open (`SongNotesEditor.tsx:34–36`).

---

## Interaction inventory

Verdict key:
- **OK**: checked and safe.
- **B-xx**: finding above.
- **ref NN-xx**: an earlier report covers it.

### Sketch / clip page: header and edit flows

| # | Screen › element | What it does to data (followed into) | Failure handling | Verdict |
|---|---|---|---|---|
| 1 | Sketch › back chevron | `handleBackToIdeas`: `cancelClipSelection`, clears parent-pick, `backToIdeas` (clears selection, pending primary, moving clip, `selectedIdeaId`), `goBack`; `beforeRemove` guard while editing or draft | Guard prompts | OK (draft path: B-H1) |
| 2 | Sketch › Android back / iOS swipe-back | Inline preview open: BackHandler stops the preview first (focus-gated). Otherwise `beforeRemove` → `handleCancel` | Prompt | OK; B-H1 for drafts outside the active workspace; B-L10 |
| 3 | Sketch › SideMenuButton | Navigation only | n/a | OK |
| 4 | Sketch › ⋯ toggle | `setHeaderMenuOpen` | n/a | OK |
| 5 | Clip page › edit mode › Cancel / Discard | `handleCancel`: confirm if the title changed; a draft → `deleteSelectedIdea(true)` | Confirm | B-H1 (non-active), ref 03-#4 |
| 6 | Clip page › edit mode › Save | `handleSave` → `renameIdea` (active workspace only, renames `clips[0]`) | None if no-op | ref 04-H2; B-L7; B-M5 |
| 7 | Clip page › edit mode › inline title input | Local draft | Guard compares title only | B-L8 |
| 8 | ⋯ menu › backdrop tap | Close | n/a | OK |
| 9 | ⋯ menu › Play all | `setPlayerQueueForScreen` (playable takes) | Info alert if none | OK |
| 10 | ⋯ menu › Edit sketch / Edit clip | `setIsEditMode(true)` → draft seeded on open, not on later writes (`useSongScreenModel.ts:117–124`) | n/a | OK |
| 11 | ⋯ menu › Make sketch (clip) | `convertSelectedClipIdeaToProject` → draft in the idea's home workspace; edit sheet opens | n/a | B-H1; ref 03-#4 |
| 12 | ⋯ menu › Import | `openImportAudioFlow` (rows 101–106) | Picker rejection unhandled | ref 09-#4 |
| 13 | ⋯ menu › View in collection | `openIdeaInCollection` (navigation) | n/a | OK |
| 14 | ⋯ menu › Share… | Opens share sheet; disabled while busy | n/a | OK |
| 15 | ⋯ menu › Delete sketch (has takes) › Cancel | Nothing | n/a | OK |
| 16 | ⋯ › Delete sketch › Keep takes | `dissolveSketch` (cross-workspace) → `goBack` | No undo | ref 04-M1 |
| 17 | ⋯ › Delete sketch › Delete all | `deleteSelectedIdea` → `deleteIdea` (cross-workspace), flush, then trash | No undo | ref 04-H6 |
| 18 | ⋯ › Delete sketch (0 takes) | Confirm "Delete X and all its takes?" → `deleteIdea` | Lyrics and chart not named; no undo | ref 04-M1/H6 |
| 19 | ⋯ › Delete clip (clip idea) | Confirm → `deleteIdea` (all versions) | No count, no undo | B-L9 / ref 04-H6 |
| 20 | ⋯ › Delete while takes are selected | Row disabled | n/a | OK |
| 21 | Share sheet › Export (file) | `shareSketchFile` (read-only), busy guard | Info if empty; error alert on throw | OK |
| 22 | Share sheet › SongNook Send | `openSendSheet` (read-only) | Sheet's own | OK |
| 23 | Share sheet › dismiss | Nothing | n/a | OK |
| 24 | Edit sheet › title input (generator, clear) | Local draft | n/a | OK |
| 25 | Edit sheet › stage ink ×4 | Draft status and completion | n/a | OK |
| 26 | Edit sheet › Cancel (saved sketch) | Confirm "Discard changes?" if changed | Confirm | OK |
| 27 | Edit sheet › Discard (draft) | "Discard this sketch?" → `deleteSelectedIdea(true)` → revert / dissolve / delete | Confirm | B-H1; ref 03-#4 |
| 28 | Edit sheet › Save | `renameIdea` or `updateIdeas` (active workspace default) + activity + take-rename prompt | None on no-op | B-H1 (draft stays draft); ref 04-H2 |
| 29 | Edit sheet › swipe / scrim / Android back | `dismissible={false}` snaps back | n/a | OK |
| 30 | Take-rename prompt › Rename N / Keep | `updateIdeas` (active workspace default) renames matched takes only | n/a | OK (ref 04-H2 class) |
| 31 | Tabs (Takes / Lyrics / Chart / Notes) | View state. Leaving Chart ends editing; drafts flush on unmount | n/a | OK |
| 32 | Edit mode or selection forces the Takes tab | View state | n/a | OK |
| 33 | Primary line › play | `playProjectQueue([id])` | Info if unplayable | OK |
| 34 | Primary line › name | Locate in list, or switch to Takes | n/a | OK |
| 35 | Record FAB | `startRecording(null)`: stops preview and player, arms recorder for this idea | Recorder handles attach failure (04-H2 note) | OK |

### Takes list

| # | Screen › element | What it does to data (followed into) | Failure handling | Verdict |
|---|---|---|---|---|
| 36 | Takes toolbar › Evolution / Timeline switch | View state | n/a | OK |
| 37 | Takes toolbar › sort direction | View state | n/a | OK |
| 38 | Filter › tag options / Untagged | View state (reset per idea) | Count label shows "Takes n" | OK; feeds B-M3 |
| 39 | Filter › Bookmarked only | View state | n/a | OK; feeds B-M3 |
| 40 | Filter › group options | View state | n/a | OK; feeds B-M3 |
| 41 | Filter › All takes / Main takes only (timeline) | View state | n/a | OK |
| 42 | Filter › Clear filters / backdrop | View state | n/a | OK |
| 43 | Takes "?" help | `markHintSeen` (prefs) + help sheet | n/a | OK |
| 44 | Collapse-all pill | Folds threads (view) | n/a | OK |
| 45 | Selection row › All | `replaceClipSelection(all clips of idea)` | Count shown in toolbar only | **B-M3** |
| 46 | Selection row › Cancel | `cancelClipSelection` | n/a | OK |
| 47 | Card tap | Player, or toggle selection, or pick parent, or begin inline edit | n/a | OK |
| 48 | Card long-press | Start or toggle selection (`grab`) | n/a | OK |
| 49 | Card lead play glyph | Inline or full player toggle | n/a | OK |
| 50 | Card waveform scrub | Inline preview position only | n/a | OK |
| 51 | Card "+ Version" | Recorder with `recordingParentClipId` | Recorder's | OK |
| 52 | Card locate glyph (timeline) | Switches to Evolution, unfolds; may `setClipGroupCollapsed(false)` (persisted) | n/a | OK |
| 53 | Card "N older" fold key | View state | n/a | OK |
| 54 | Card tags / "Tag" | Opens tag picker for one take (rows 92–96) | n/a | OK |
| 55 | Card tag suggestion chip | `setClipTags` (cross-workspace via `updateIdeaInState`) | n/a | OK |
| 56 | Card note line | Opens clip notes sheet (rows 88–91) | n/a | OK |
| 57 | Card "Primary" (clip edit mode) | `setPendingPrimaryClipId` only | Never committed | **B-M5** |
| 58 | Card inline edit › title / notes inputs | Local drafts | Dropped on page Save, Cancel or back | B-L8 |
| 59 | Card inline edit › Save | `commitClipTitleSave` → `buildLineageTitlePlan` (v-suffix rule) → `updateIdeas` (active workspace) + thread rename prompt | Silent no-op in another workspace | ref 04-H2 |
| 60 | Card inline edit › Cancel | Discard draft | n/a | OK |
| 61 | Thread row (older version) tap | Player for that version, or toggle selection | n/a | OK |
| 62 | Thread row long-press | Selection | n/a | OK |
| 63 | Thread row play / ✕ | Inline preview only | n/a | OK |
| 64 | "Older takes" more row | View state | n/a | OK |
| 65 | Group header tap | `setClipGroupCollapsed` (persisted, cross-workspace) | n/a | OK |
| 66 | Group header long-press › rename modal Save | `renameClipGroup` (empty ignored) | n/a | OK |
| 67 | Group rename › Cancel / Android back | Discard draft | n/a | OK |
| 68 | Keys on lists | Evolution and timeline rows keyed by clip or group id; timeline adds index to an id-stable key | n/a | OK |

### Selection dock, version threads, paste

| # | Screen › element | What it does to data (followed into) | Failure handling | Verdict |
|---|---|---|---|---|
| 69 | Dock › Play | Queue of selected playable takes | Info if none | OK |
| 70 | Dock › Edit (one take) | Clip notes sheet → `saveEditedClip` → `updateIdeas` (active workspace), thread rename prompt | Silent no-op in another workspace | ref 04-H2 |
| 71 | Dock › Edit › swipe-dismiss | Saves if edited (`ClipNotesSheet`) | n/a | OK |
| 72 | Dock › Versions (several) | Opens thread sheet | n/a | OK |
| 73 | Dock › Group › pick group | `assignLineageToClipGroup` per selected root | n/a | OK (B-M4 later) |
| 74 | Dock › Group › Create group | `createClipGroup` + assign roots | n/a | OK |
| 75 | Dock › Group › Remove from group | Assign `null`; empty group pruned | n/a | OK |
| 76 | Dock › Delete | Confirm "Remove these takes from the sketch?" → `deleteSelectedClips` (active workspace only; flush, then trash; repairs parents and primary) | No count, no undo; no-op in another workspace | **B-M3**; ref 04-H6; B-L9 |
| 77 | Dock › More | Overflow sheet | n/a | OK |
| 78 | More › Make primary | Confirm → `markBestClip` (cross-workspace) | n/a | OK |
| 79 | More › Versions… (one take) | Thread sheet | n/a | OK |
| 80 | More › Tags… | Tag picker, several takes | n/a | OK |
| 81 | More › Add to playlist | `PlaylistChooserSheet` adds references only | Sheet's own | OK |
| 82 | More › Copy or move › Copy / Move | `startClipboardFromProject` (records active workspace as source) + info alert | Received source: later paste silently fails | B-L11 |
| 83 | More › Share › Share audio | `shareAudioClips`, `isSharing` guard | Error alert | OK |
| 84 | More › Share › Export for DAW | `exportClipForDaw` (read-only) | Error alert | OK |
| 85 | More › Share › SongNook Send | `openSendSheet` (read-only) | Sheet's own | OK |
| 86 | Sub-sheet back chevrons / dismiss | View | n/a | OK |
| 87 | Thread › Set parent… | Enters parent pick: clears filters, Evolution view | Info if no valid parent | OK |
| 88 | Thread › Combine into thread | `threadClipsOldestToNewest` → parent updates (no cycle possible) + undo | Undo is parents only | **B-M4** |
| 89 | Thread › Stand alone (one) › Split | `handleMakeRoot` (children re-attach to grandparent) + undo | n/a | OK |
| 90 | Thread › Stand alone (one) › Branch | Copy audio file → new take + undo (deletes the copy) | Copy failure silent | **B-L2**; ref 03-#12 (shared mix) |
| 91 | Thread › Stand alone (several) | `handleMakeRoot` + undo | n/a | OK |
| 92 | Parent pick › tap a valid target | Confirm "X becomes the newest version of Y" → `applyParentChange` + undo | Invalid targets ignored (`isInvalidParentTarget`) | OK; B-M4 if the source was a grouped root |
| 93 | Parent pick › confirm › Cancel | Stays in pick mode | n/a | OK |
| 94 | Parent pick › hint row Cancel | Ends pick mode | n/a | OK |
| 95 | Undo banner › Undo | Runs the action's undo: narrow for parents, whole snapshot for Branch | n/a | B-L2, B-M4 |
| 96 | Clipboard banner › Paste here | Confirm (move into the source sketch is blocked) → `pasteClipboardToProject` (copy: new ids; move: relocates activity and playlists) | Returns `[]` silently on a missing source | B-L11; moved takes leave setlist and songbook entries behind (ref 04-H1 general) |
| 97 | Clipboard banner › Cancel | `cancelClipboard` | n/a | OK |

### Tag picker and clip notes sheet

| # | Screen › element | What it does to data (followed into) | Failure handling | Verdict |
|---|---|---|---|---|
| 98 | Tag picker › Bookmarked switch | `toggleClipBookmark` per take (only the ones that differ) | n/a | OK |
| 99 | Tag picker › tag ink (tri-state) | `setClipTags` per take | Snapshot-based | B-L6 |
| 100 | Tag picker › new tag label, colour, Add | `addProjectCustomTag` + apply (a key that already exists is applied, not duplicated) | n/a | OK |
| 101 | Tag picker › dismiss | Nothing | n/a | OK |
| 102 | Clip notes sheet › title and notes, Save | `commitClipTitleSave` (active workspace) + thread prompt | Silent no-op in another workspace | ref 04-H2 |
| 103 | Clip notes sheet › Cancel / swipe | Cancel discards; swipe saves if edited | n/a | OK |
| 104 | Thread rename prompt › Update N / Keep existing | `updateIdeas` titles (active workspace) | n/a | OK |

### Import from the sketch page

| # | Screen › element | What it does to data (followed into) | Failure handling | Verdict |
|---|---|---|---|---|
| 105 | Import › file picker / cancel | `pickImportAssets` (copy to cache) | Rejection unhandled | ref 09-#4 |
| 106 | Import › date preference prompt / cancel | Cancel → `discardPickedCopies` (copy only) | n/a | OK |
| 107 | Import › name modal Save | `saveImportedAudio` → duplicate check → `importAudioAsset` → `importClipToProject` (cross-workspace) | Double tap gives two takes; deleted sketch still reports "done" | **B-L3** |
| 108 | Import › name modal Primary switch | Draft flag | n/a | OK |
| 109 | Import › name modal Cancel / Android back | `discardPickedCopies` | n/a | OK |
| 110 | Import › duplicate review › Skip / Import anyway | Skip does nothing (copy leaks); Import proceeds | n/a | B-L3 |

### Lyrics tab

| # | Screen › element | What it does to data (followed into) | Failure handling | Verdict |
|---|---|---|---|---|
| 111 | Lyrics › "Write with the tape" | Player writer intent + queue | n/a | ref 04-M2 |
| 112 | Lyrics › + Version › New from current | Opens editor on latest, forced "save as new" | n/a | OK |
| 113 | Lyrics › + Version › Blank version | Opens editor with the latest text | n/a | **B-L1** |
| 114 | Lyrics › + Version › From Lyric Pad → note | `saveProjectLyricsAsNewVersion` (cross-workspace) | Info if the page is empty | OK (double-tap: B-L11) |
| 115 | Lyrics › empty state › Start writing / From Lyric Pad | Editor (blank) / as above | n/a | OK; B-M1 outside the active workspace |
| 116 | Lyrics › current card tap / long-press | Open version / selection | n/a | OK (B-M1 outside the active workspace) |
| 117 | Lyrics › "N older" / older row tap / long-press | Fold / open / selection | n/a | OK |
| 118 | Lyrics selection › Edit (one) | Editor; an older source saves as a new version (fork) | n/a | OK |
| 119 | Lyrics selection › ⋯ › New draft from this | Editor, forced new | n/a | OK |
| 120 | Lyrics selection › ⋯ › Delete | Confirm names the latest-becomes-current rule and the counts of takes, charts and setlists → `deleteProjectLyricsVersions` | No undo (honest confirm) | OK |
| 121 | Lyrics selection › Done / note-picker dismiss | View | n/a | OK |

### Chart tab and the standalone chart page

| # | Screen › element | What it does to data (followed into) | Failure handling | Verdict |
|---|---|---|---|---|
| 122 | Chart › transpose chip nudge / reset | `useChartPrefsStore` display offset (non-destructive) | n/a | OK |
| 123 | Chart › full view: open, zoom, reset, ✕, Android back | Read-only | n/a | OK |
| 124 | Chart › export sheet › PDF / Text / dismiss | Pro gate; `shareChordSheetPdf` / `Share` | Error alert | OK |
| 125 | Chart › pencil / Done | `setIsEditing`; leaving edit clears undo history and selection; drafts flush on unmount | n/a | OK |
| 126 | Chart › Undo / Redo | `applySheet(snapshot)` (whole-sheet replace) | n/a | OK; B-M2 can overwrite it |
| 127 | Chart › Add section sheet (presets, custom, text block) / empty state / Build from lyrics | `commit` / `buildChordSheetFromLyrics` (replace is confirmed) | Info if no chords | OK |
| 128 | Chart › section note input, text-block input | `useDraftText` → `setSectionNotes` / `setBlockText` (stale snapshot) | n/a | **B-M2** |
| 129 | Chart › section / text ⋯ › Rename (with suggestions), Move up/down, Delete (confirm) | `renameSection` / `moveSection` / `removeSection` (undo until Done) | n/a | OK |
| 130 | Chart › ghost "+" bar; bar tap → bar editor (chord tap, Add chord up to 7, Done, back) | `addMeasure` / opens picker | n/a | OK (victim of B-M2) |
| 131 | Chart › chord picker (palette keys save at once; root, accidental, quality, bass, suffix; Delete; Add/Update; dismiss) | `saveChord` + `recordSongChord` / `removeChordAt` (undo available) | Choice resets on re-render | B-L5 |
| 132 | Chart › bar long-press selection; dock Before / After / Clear / Delete; More → Copy / Cut / Paste / Split / Deselect | Bar ops via `commit` (undo available; no confirm needed) | n/a | OK (B-M2 interplay) |

### Notes tab

| # | Screen › element | What it does to data (followed into) | Failure handling | Verdict |
|---|---|---|---|---|
| N1 | Notes tab › page tap → editor | `SongNotesEditor` (full-screen modal) | n/a | OK |
| N2 | Notes editor › Save | `setIdeaNotes` (global selection, active workspace) | Silent no-op in another workspace | ref 04-H2 |
| N3 | Notes editor › Cancel / Android back | Discards draft | n/a | ref 04-H4 |
| N4 | Notes editor › re-seed while open | `useEffect([visible, initialNotes])` | n/a | B-L11 |
| N5 | Clip idea › notes card (`SongClipListSummary`) | Same editor and actions | n/a | ref 04-H2/H4 |

### Lyric version page (`LyricsVersionScreen`)

| # | Screen › element | What it does to data (followed into) | Failure handling | Verdict |
|---|---|---|---|---|
| L1 | Header back | Chord edit → read; edit mode → `cancelEdit` (confirm with Keep editing); read → `goBack` | Confirm | OK |
| L2 | Android back / swipe | `beforeRemove` guard while unsaved | Prompt; app kill loses the draft | ref 04-H3 |
| L3 | Export › Add to songbook / PDF / Text / Copy | `SongbookChooserSheet` / read-only exports | Error alert / toast | OK |
| L4 | Preview › Lyrics/Chords toggle, pencil, transpose chip, zoom | View; pencil → `beginEdit` or the chord editor | n/a | OK |
| L5 | Editor › text input, Undo / Redo | Local draft + `useEditHistory` | n/a | OK |
| L6 | Editor › Save | `saveProjectLyrics` in place (latest) or as new (older / forced) → `lyricsTextToDocument` | No error path; double tap duplicates | **B-H2**; B-L11 |
| L7 | Editor › Save as new | `saveProjectLyricsAsNewVersion(…, resolvedVersion.document)` | n/a | **B-H2** |
| L8 | Editor › Word Finder → pick word | Pro gate; `applyPickedWord` into the draft | n/a | OK |
| L9 | Editor › ⋯ text direction (radio menu) | Draft direction (counts as a change) | n/a | OK |
| L10 | Editor › re-seed effect | Resets the draft when `sourceText` or the version changes | n/a | ref 04-H3 (LOW note) |
| L11 | Chord editor › palette arm / disarm; tap lyric (armed drops at once) | `upsertChordPlacement` (+ palette) | No undo | B-L4 |
| L12 | Chord editor › chord tap → picker Update / Delete; drag to move; help; zoom | `upsertChordPlacement` / `removeChordPlacement` / `moveChordPlacement` | No undo, no confirm | B-L4 |
| L13 | Unavailable state (idea not in the active workspace) | n/a | Says the version is gone | **B-M1** |
| L14 | Setlist song › Lyrics (cross-screen entry) | Navigates to L13 for an idea in another workspace | n/a | **B-M1** |

### Standalone chord chart page (`ChordSheetScreen`)

| # | Screen › element | What it does to data (followed into) | Failure handling | Verdict |
|---|---|---|---|---|
| C1 | Back / Undo / Redo / Full view / Export (+ Add to songbook) / Edit / Done / transpose chip | As rows 122–132; resolves the idea across workspaces | Missing idea → "unavailable" | OK; B-M2 applies |

152 rows in all: 1–132, N1–N5, L1–L14 and C1.

---

## Files read

- **IdeaDetailScreen (all 62 files):**
  - `index.tsx`, `headerCollapse.ts`, `styles.ts`, `songClipControls.ts`
  - `provider/SongScreenProvider.tsx`
  - `sections/`: `SongNotesSection`, `SongLyricsSection`, `SongHeaderSection`, `SongTakesSection`, `SongChartSection`
  - `components/`: `SongEditSheet`, `EvolutionThread`, `SongClipCard`, `SongClipListSummary`, `IdeaNotes`, `SongClipListShell`, `SongNotesEditor`, `TimelineList`, `PrimaryTakeLine`, `ClipTagPicker`, `SongImportModal`, `SongUndoBanner`, `TakesHelpSheet`, `SongClipListContent`, `SelectionBars`, `ClipList`, `EvolutionList`, `IdeaHeader`, `SongCollapsibleHeader`, `SongClipboardBanner`, `SongScreenContent`, `ClipCard`, `SongClipListModals`, `SongHeaderMenu`, `CollapsingTabStage`
  - `components/clipCard/*` (4 files)
  - `components/songClipToolbar/*` (10 files)
  - `hooks/`: `useSongEditFlow`, `useSongClipHighlights`, `useSongImportFlow`, `useSongClipListEffects`, `useSongScreenEffects`, `useSongClipEditing`, `useSongClipListData`, `useSongUndo`, `useSongScreenModel`, `useSongParentPicking`
- **LyricsVersionScreen (all 19):**
  - `index.tsx`, `styles.ts`
  - `components/`: `LyricsVersionUnavailableState`, `LyricsVersionEditor`, `LyricsVersionScreenContent`, `LyricsVersionPreview`
  - `hooks/useLyricsVersionScreenModel.tsx`
  - `components/chords/`: `ChordChart`, `useChordEditing`, `ChordZoomBar`, `ChordToken`, `ChordChartEditor`, `ChordLine`, `useChordExport`, `ChordPickerSheet`, `ChordExportSheet`, `SerifChordChart`, `ChordPaletteBar`, `chordChartStyle`
- **LyricsScreen:** `LyricsVersionsPanel.tsx`
- **ChordSheetScreen (all 9):** `index.tsx`, `useChordSheetModel.ts`, `ChordSheetSection.tsx`, `components/ChordSheetBody.tsx`, `BarEditorSheet.tsx`, `ChordSheetScreenContent.tsx`, `ChartSelectionDock.tsx`, `chartScroll.ts`
- **Followed into:**
  - `state/actions.ts`: lines 82–103, 829–877, 1180–1229, 1541–1575, 1842–2520, 2815–3045
  - `state/dataSlice.ts`: lines 960–1070, 2095–2290, 2536–2600, 2955–3010, 3351–3411
  - `state/selectionSlice.ts` (setters)
  - `domain/`: `lyrics.ts`, `chordSheet.ts`, `clipGraph.ts` (exports), `clipLineageTitles.ts`, `clipLineageRenamePrompt.ts`, `sketchTakeRenames.ts`, `draftRecovery.ts`, `draftCommitter.ts`
  - `hooks/useDraftText.ts`
  - `components/common/BottomSheet.tsx` (dismiss path)
  - `components/modals/ClipNotesSheet.tsx` (close path), `QuickNameModal.tsx` (close path)
  - `PlayerScreen/hooks/usePlayerScreenLifecycle.ts:440–470`
  - `IdeaListScreen/sections/CollectionFloatingActions.tsx:355–470`
  - `SetlistSongScreen/index.tsx:60–180`
  - `RecordingScreen/hooks/useRecordingScreenModel.ts:470–500`
  - `QueuePanel.tsx:255–290`
  - `EditorScreen/hooks/useEditorExportFlow.ts:236–256`
  - `i18n/locales/en.ts` (the delete, discard and lyrics keys)
