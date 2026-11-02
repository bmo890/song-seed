# 12g · Sweep G: shared components and hooks

Read-only sweep, 2026-11-02. Scope: every file in `src/components/common/**` (113 files, including `clip/`, `metronome/`, `__tests__/`) and `src/hooks/**` (37 files, except `useRecording.ts`, which sweep D covers). These are the building blocks every screen uses, so each contract below was also checked at its call sites.

**Method.** Every file was read. Each callback was followed into the store action or service it calls (`state/actions.ts`, `dataSlice.ts`, `useSendJobStore`, `services/*`). Two behaviours were confirmed with throwaway Jest tests that mounted the real `useDraftText` through `react-test-renderer`, in `src/__audit_scratch_G__/`. That folder has since been deleted. Nothing in the repo was changed.

**Severity scale** (same as 04): CRITICAL = realistic silent loss; HIGH = loss after a plausible slip, or behind a misleading confirmation; MEDIUM; LOW.

**Already reported elsewhere (not repeated):**
- the language-change reload with no flush: 10-L1
- "Copied" shown when the clipboard write failed: 09-#10, 12h-L-11
- Send double tap aborting the first job: 12h row 11
- `ProUpsellSheet` with no in-flight guard: 09-#10
- sheet rows firing twice during the close animation: 12a-A-L8
- the record FAB landing in the wrong workspace: 08-R1, 12c
- the "Restore your library?" dismiss: 01-H2
- the boundary crash loop: 09-#1
- merge double-run: 12a-A-L3

---

## Summary

| ID | Severity | Finding | Confidence |
|---|---|---|---|
| G-H1 | **HIGH** | Spark "Send to Lyric Pad" → **Update page** replaces the Pad page's whole body with the spark's text. Anything written on that page since the first send is lost, with no undo, and the dialog never says "replace". | verified by reading |
| G-M1 | MEDIUM | `useDraftText` runs the commit captured at the last keystroke, and ignores outside writes while a draft is pending. The chord chart's commits rebuild the **whole chart** from that render's `sheet`. So an Undo, an added bar or a chord change made within 0.5 s of typing in a chart field is silently reverted when the draft lands. The Lyric Pad's Undo is also swallowed while typing. | verified by scratch test (hook) + reading (call sites) |
| G-M2 | MEDIUM | `BottomSheet` wedges when a parent's `onClose` doesn't hide it. The merge picker can be swiped away mid-merge; if the merge then fails, an invisible scrim swallows every touch and Android back until the app is killed. | verified by reading |
| G-M3 | MEDIUM | `dialogStore` holds one dialog with no queue. A second `show()` silently drops the first one's buttons and `onDismiss`. At worst this strands the boot "Restore your library?" persist freeze on for the session, with no banner. | mechanism verified; trigger speculative |
| G-M4 | MEDIUM | Action-sheet rows run synchronously while the sheet's Modal is still dismissing. Rows that open another native Modal (New playlist → name sheet, Text size, Rename…) do the thing this codebase has twice documented iOS refusing, with dead touches until restart. | plausible, needs a device check |
| G-L1 | LOW | `TitleInput` cuts any title to 80 characters and 2 lines on the first keystroke or on blur. Imported and received titles aren't capped, and the clip notes sheet then auto-saves the cut title on swipe-away. | verified by reading |
| G-L2 | LOW | Two promise-wrapped dialogs carry their answer on the Cancel button but pass no `onDismiss`. A scrim tap or Android back leaves the promise pending forever, and import picker copies are never discarded. | verified by reading |
| G-L3 | LOW | Toast "Undo" in Magpie and Word Ladder writes back a whole-array snapshot, which drops words collected in the 4 s window. Any newer toast replaces the Undo silently. | verified by reading |
| G-L4 | LOW | A record FAB double tap: `armed` is visual only, and `onRecord` isn't gated. The result is two placeholder ideas and possibly two recorder screens. | verified by reading |
| G-L5 | LOW | Multi-package Keep: a mid-loop failure says "Move failed" after earlier packages have already moved, and `onDone` never runs. | verified by reading |
| G-L6 | LOW | Android back while a dialog is drawn inside a sheet closes the **sheet** (runs its `onClose`) and leaves the dialog up. | verified by reading |
| G-L7 | LOW | "Added" success when nothing was added: the Songbook chooser after a dedupe (and it stores `workspaceId: ""` when the idea isn't found); the compilation picker's "Added 0". | verified by reading |
| G-L8 | LOW | Latent: switching the record under a mounted `useDraftText` inside the idle window keeps showing the old record's text, and the next keystroke writes it into the new record. No call site does this today. | verified by scratch test |

No CRITICAL finding. The core shared contracts hold:
- A scrim never confirms.
- A sheet's dismissal never runs a row.
- Destructive rows are separated and confirmed by their callers.
- Every native Modal in `src/` hosts a dialog layer (grep-verified).

---

## HIGH

### G-H1. "Update page" overwrites the Lyric Pad page with the spark's text

- **Where:** `src/components/common/sparkSend.ts:85-111`
  ```ts
  const existing = savedLyricId ? notes.find((note) => note.id === savedLyricId) : undefined;
  ...
  AppAlert.custom(t("wordSparks.sendAgainTitle"), t("wordSparks.sendAgainBody"), [
    { label: t("wordSparks.newPage"), ... onPress: sendNew },
    { label: t("wordSparks.updatePage"), ...
      onPress: () => {
        updateNote(existing.id, { body: text });
  ```
  The copy (`en.ts:1269-1271`) reads "Already in your Lyric Pad" / "Update that page, or add a new one?".
- **Steps:**
  1. In Cut-Up, Word Ladder or Borrowed Words, do "…" → Send to Lyric Pad. This creates page P and records `savedLyricId`.
  2. Keep writing the song on page P in the Lyric Pad. That is the Pad's purpose.
  3. Later, reopen the spark, tweak a line, and do Send to Lyric Pad → **Update page**.
- **Effect:** `updateNote` replaces P's body with the spark text. Everything written on P since step 1 is gone.
  - The Pad's undo history resets whenever a page opens (`NoteEditor.tsx:75-77`), so there is no way back.
  - "Update" reads as "bring my changes over", not "replace the page".
  - Nothing compares P's body with what was last sent, so the person isn't told P was edited since.
- **Relation to 04:** 04 lists "sending again to the Pad asks before updating the linked page" as solid. The new evidence is that the ask doesn't name the overwrite, and the target is a separate document the person may have kept developing.
- **Fix:**
  - Store the sent text (or a hash) on the spark.
  - If P's body differs from it, offer only **New page**, or say "Replace the page's words? Changes made in the Pad are lost" as a destructive button.
  - Alternatively, append the new text as a dated section instead of replacing.

---

## MEDIUM

### G-M1. Draft fields commit a stale closure; the chord chart's commit reverts other chart edits

- **The contract** (`src/hooks/useDraftText.ts:41-48`, `src/domain/draftCommitter.ts:42-56`):
  ```ts
  const onChangeText = useCallback((next: string) => {
    committerRef.current.change(next, commitRef.current);   // commit captured at this keystroke
  ...
  seed: (value) => { if (pending) return false; ...         // outside writes ignored mid-edit
  ```
  When the 500 ms timer fires, or on unmount or background, the commit from the **last keystroke's render** runs. Any write to the same value during the window is overwritten. That is safe only when the commit is a narrow patch, or reads fresh state.
- **The call site that misuses it:** `ChordSheetScreen/useChordSheetModel.ts:134-139, 145-154`
  ```ts
  const mutateSection = (sectionId, updater) => {
    commit({ ...sheet, sections: sheet.sections.map(...) });   // `sheet` = this render's chart
  };
  const setBlockText   = (sectionId, text)  => mutateSection(sectionId, (s) => ({ ...s, text }));
  const setSectionNotes = (sectionId, notes) => mutateSection(sectionId, (s) => ({ ...s, notes }));
  ```
  The fields are wired through `useDraftText` at `ChordSheetSection.tsx:56` and `ChordSheetBody.tsx:427`. They flush on blur only (`ChordSheetSection.tsx:78`, `ChordSheetBody.tsx:458`). Header Undo (`ChordSheetScreenContent.tsx:78`) and the staff's Pressables don't blur the field (`keyboardShouldPersistTaps="handled"`, `:159`).
- **Steps:**
  1. Type in a section's notes or a text block.
  2. Within half a second, tap Undo, the ghost "+ bar", or a bar's chord.
  3. Then the draft lands.
- **Effect:** the draft's commit writes the chart as it was at the keystroke, plus the text. The undo, the new bar or the chord change silently disappears. `commit` also pushes that stale chart onto the undo stack.
- **Scratch test:** a component modelled on `mutateSection` (commit `{...sheet, notes}` from the render closure) ran an add-bar 200 ms after typing. After the pause, `bars` was back to 4 and the notes were saved.
- **Second call site:** Lyric Pad Undo (`NoteEditor.tsx:62-72`) applies the previous snapshot through `onUpdate`, but doesn't flush `bodyDraft` first. Typing and then tapping Undo within 0.5 s:
  - the undo is overwritten by the pending draft
  - the history entry it stepped over is spliced away
  - a title change in that snapshot is reverted while the body isn't
  - Scratch test: "outside write while pending is overwritten" passes.
- **Checked and safe:**
  - Cut-Up, Magpie and Word Ladder commits read fresh store state (`freshSpark()`, `useStore.getState()`, `useCutUpScreenModel.ts:430-436`, `useMagpieScreenModel.ts:253-259`).
  - Those spark models flush before every other write (`apply` → `flushDraft()`).
  - The recorder's name sheet flushes before Save and Cancel.
- **Fix:**
  - In the chart, read the live chart inside `mutateSection` (`useStore.getState()`), and flush the fields' drafts in `commit`/`undo`/`redo`, as the spark models' `apply` does.
  - In `NoteEditor`, call `flushDrafts()` at the top of undo and redo.

### G-M2. A sheet whose `onClose` refuses to hide wedges the screen

- **The contract** (`src/components/common/BottomSheet.tsx:138-158`):
  ```ts
  const closeWithSlide = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    ...
    Animated.timing(translateY, { toValue: Math.max(dismissDistance, 700), ... }).start(({ finished }) => {
      ...
      onClose();
  ```
  `isClosingRef` resets only when `visible` changes (`:84-99`). If the parent's `onClose` doesn't set `visible=false`:
  - the card sits off-screen
  - the transparent Modal and its full-screen scrim stay up
  - every later scrim tap, drag and Android back returns at the guard
- **The call site that misuses it:** `PlayerScreen/components/PlayerLayersBench.tsx:448`
  ```tsx
  <BottomSheet visible={isPicking} onClose={() => (merging ? undefined : setMergePicks(null))}>
  ```
  `runMerge` (`:205-214`) clears `mergePicks` only on success.
- **Steps:**
  1. Merge layers → Save in the name sheet.
  2. While "Merging…" shows, swipe the picker down. It slides away and `onClose` is ignored.
  3. The merge fails, for example on a decode or disk error.
- **Effect:**
  - `mergePicks` stays set, so the sheet stays "visible" off-screen. The player is dimmed and won't take a touch.
  - Android back is swallowed.
  - The error dialog does draw (nested host) and its OK works, but the wedge remains until the app is killed.
  - Killing the app inside the persist debounce costs recent edits (01-L1).
  - 12a row 61 marks the picker dismiss as "blocked while merging". It isn't blocked: it slides away.
- **Fix:**
  - Pass `dismissible={!merging}` here.
  - In `BottomSheet`, when `onClose` returns and `visible` is still true on the next frame, `snapBack()` (reset `isClosingRef`) instead of staying parked.

### G-M3. One dialog slot: a second dialog silently drops the first one's handlers

- **The contract** (`src/components/common/dialogStore.ts:47-50`, `AppDialog.tsx:49-60`):
  ```ts
  show(config: DialogConfig) {
    _config = config;            // replaces whatever is showing; its onDismiss never runs
  ```
  `toastStore` documents the same "newest wins" (`toastStore.ts:9-10`), which is harmless for a toast. For a dialog, the replaced dialog's `onPress` and `onDismiss` never run. Several dialogs carry state in those handlers.
- **Worst call site:** `App.tsx:1336, 1354-1375`.
  - The boot "Restore your library?" sets `setPersistBlocked(true)` and relies on its buttons or `onDismiss` to lift it.
  - That freeze is the bare boolean, with no `reportPersistBlocked`, so no banner shows (`persistRuntime.ts:51-57, 128-131`).
  - If any other dialog is shown before the person answers, the prompt vanishes and the freeze stays on.
  - Every edit and recording for the rest of the session then stays in memory. A take's strict flush throws `PersistSkippedError`; passive writes return silently (`useStore.ts:346-352`).
- **Other holders of state in a dialog:**
  - the backup "Save backup?" promise (`useLibraryBackupFlow.ts:201-231`; it would never settle and the built archive stays in cache)
  - the recorder's `holdTakeWhileAsking` resume (`useRecordingScreenModel.ts:1473-1482`; the take stays paused, though no loss)
- **Trigger:** speculative. I found no automatic dialog that fires during the boot prompt: the remaining boot dialogs run sequentially in the same function, and share or receive dialogs are user-initiated behind the modal scrim. The structure leaves the guarantee to luck.
- **Fix:**
  - Queue dialogs (show the next one after the current one closes).
  - At least, when `show()` replaces a config, run the replaced config's `onDismiss`.
  - Raise the "blocked" banner while the restore prompt holds the freeze.

### G-M4. Rows run while their sheet is still sliding out; rows that open another native Modal risk the iOS refusal

- **The contract** (`src/components/common/SelectionActionSheet.tsx:72-76`):
  ```ts
  onPress={() => { haptic.tap(); onClose(); action.onPress(); }}
  ```
  `onClose` flips `visible` false and the BottomSheet's Modal begins dismissing. `action.onPress` runs in the same tick. The codebase documents twice that iOS refuses a Modal presented while another is "on screen, or still sliding out", and that the screen then "can stop taking touches":
  - `afterOverlayCloses.ts:4-9`
  - `RecordingScreen/index.tsx:85-100`, "overnight check 2026-10-20"
  - Share sheets and pickers already wait via `afterOverlayCloses`. Rows that open another React Native Modal don't.
- **Call sites where a row opens a separate Modal synchronously:**
  - `PlaylistChooserSheet.tsx:106-116` (New playlist… → `QuickNameModal`/`WarmModal`, rendered beside the sheet)
  - `SparkFrame.tsx:50-56` (menu → Text size → `SparkTextSizeSheet`)
  - `SongbookDetailView.tsx:294`, `SetlistDetailView.tsx:298`, `PlaylistDetailView.tsx:327` (Rename)
  - `IdeaSelectionBar.tsx:495` (Copy or move)
  - `SelectionBars.tsx:561, 569, 577` (tags, playlist, copy/move sub-sheets)
  - `ReceivedScreen/index.tsx:297` (Move)
  - The canonical row → `AppAlert.destructive` pattern takes the same path into the root host's Modal.
- **Confidence:** plausible. It wasn't walked on a device. If iOS tolerates present-during-dismiss for React Native Modals (the common pattern seems to work in practice), this is moot. The repo's own notes say otherwise for at least some pairs.
- **Fix:** for `opens: true` rows, run `action.onPress` after `afterOverlayCloses()`, or host the follow-on Modal inside the sheet, as `ReceivedParcelSheet.tsx:276-283` does. Device-check New playlist and Rename first.

---

## LOW

- **G-L1. `TitleInput` truncates on first touch.**
  - `TitleInput.tsx:33-38, 78-83, 89`: every change and every blur runs `sanitizeTitleValue(…).slice(0, maxLength)` with `maxLength = 80` and 2 lines.
  - `titleFromFileName` (`domain/fileTitle.ts:16-23`) and received or Send titles (up to 200) have no cap. So a long imported title loses its tail the moment the field is touched or left.
  - `ClipNotesSheet.tsx:63-69` treats any title difference as an edit and saves on swipe-away. Tapping into the title, then swiping the sheet away, stores the cut title.
  - Fix: don't truncate existing text; apply `maxLength` only to typing, and don't sanitize on blur unless the value changed.
- **G-L2. Answer-on-Cancel promises with no `onDismiss`.** AppDialog enables scrim and back whenever a `cancel`-style button exists, but then runs only `onDismiss` (`AppDialog.tsx:51-55, 72-73`).
  - `domain/importDates.ts:130-152`: Cancel resolves `null`, but a scrim tap leaves the promise pending. The single-file import flows (`useCollectionImportFlow.ts:73-80`, `useSongImportFlow.ts:43-46`, `useWorkspaceCollectionImportFlow.ts:65-68`) then never reach `discardPickedCopies`. The picked copies sit in cache until the launch sweep, and the flow ends silently.
  - `useLibraryBackupFlow.ts:143-160`: "Not now" resolves `false`; a scrim tap leaves `handleBackupNow` pending (harmless today).
  - `useCollectionImportFlow.ts:88-124` does it right (`onDismiss` discards).
  - Fix: pass `{ onDismiss: () => resolve(null) }`; better, make `AppAlert.custom` default `onDismiss` to the cancel button's `onPress`.
- **G-L3. Toast Undo snapshots.**
  - `useMagpieScreenModel.ts:191-207` and `useWordLadderScreenModel.ts:225-235` undo with `apply(before)`, where `before` is the entire `fragments` (or `columnA`/`columnB`/`pairings`) arrays from before the removal. Words collected, split or paired in the 4 s before Undo are erased.
  - `toastStore.show` replaces the toast (`toastStore.ts:36-39`). Removing a second word, or any other toast (a send, "Saved"), makes the first Undo vanish.
  - Fix: undo by re-inserting the removed item at its index into the live array.
- **G-L4. FAB double tap.**
  - `FloatingActionDock.tsx:49-60, 83-87`: `armed` only styles the key. `onRecord` → `appActions.quickRecordIdea` + `navigate("Recording")` (`CollectionFloatingActions.tsx:527-531`) can run twice.
  - The result is two empty placeholders (the first is swept only at the next launch, `recordingRecovery.ts:228-240`) and possibly two recorder screens.
  - Fix: `if (armed) return;`.
- **G-L5. Multi-package Keep partial failure.**
  - `ReceivedPackageMoveModal.tsx:107-116` loops `adoptReceivedPackageInto`. On a failure it alerts "Move failed" and returns, though earlier packages already moved, and `onDone` (selection reset, landing) never runs.
  - Fix: report "Moved 2 of 3" and call `onDone` with what moved.
- **G-L6. Android back with a dialog inside a sheet.**
  - `AppDialog.tsx:157-163`: `NestedFrame` ignores `onRequestClose`. The sheet's Modal gets back and runs `closeWithSlide` → its `onClose` (`BottomSheet.tsx:256`), while the dialog stays in the store and reappears at the root.
  - No call site found where that loses data. Layer bench "Remove layer?" still works after the sheet closes. A sheet whose `onClose` commits (clip notes) raises no dialog.
  - Fix: while a nested dialog is up, route the sheet's back to the dialog's `dismissWithoutChoice`.
- **G-L7. Success shown for nothing.**
  - `SongbookChooserSheet.tsx:33-57` toasts "Added to {book}" and fires `success` even when `addItemsToSongbook` deduped every item (`dataSlice.ts:3210-3225`).
  - It also falls back to `workspaceId: ""` when the idea isn't found in `workspaces`, storing an entry that can't resolve.
  - `useLibraryCollectorHandlers.ts:61-78` toasts "Added 0" when every pick vanished.
  - Fix: return a count from the store action and say "Already in {book}" / refuse with `error`.
- **G-L8. Latent record-switch bleed in `useDraftText`.**
  - `seed()` refuses while pending (`draftCommitter.ts:50-52`). After the pending commit lands on the old record, nothing re-seeds from the new record's value.
  - Scratch test: `rec A typed → switch to B within 500 ms → field shows "alpha typed" on B → next keystroke writes "alpha typed!" into B`.
  - All current call sites key their fields per record (`CutUpBoard.tsx:488`, `MagpieBuildStep.tsx:340`, `ChordSheetBody.tsx:184`) or switch only through navigation (`NoteEditor` via `openToken`). Nothing reaches it today.
  - Fix: re-run `seed(value)` after `flush()` lands, or reset the committer when the caller passes a record key.
- **Minor, no data effect:**
  - Every visible nested dialog host fires the destructive `warning` haptic, so a sheet plus a WarmModal gives two buzzes.
  - `useParcelPreview` swallows a sealed-preview failure with no `error` haptic (`useParcelPreview.ts:87-89`).
  - `FreeMonthNotices` launch toast can replace an earlier toast.

---

## Contract inventory: every shared surface and what it promises

| Surface | Interactive parts | Callback contract | Holds? |
|---|---|---|---|
| `AppAlert` (`AppAlert.ts`) | `menu`, `confirm`, `destructive`, `error`, `info`, `custom` | Button tap: dismiss, then `onPress`. Scrim and back: only if a `cancel` button exists, and then they run only `onDismiss`. `error` fires the `error` haptic. | Yes. Never confirms on scrim. Misuse: G-L2. Single slot: G-M3 |
| `AppDialogHost` / `ModalDialogLayer` (`AppDialog.tsx`) | buttons (compact, stacked, rich rows), scrim, Android back | The root host stands down while any sheet or modal layer is registered; nested hosts draw over their modal | Yes. Back inside a sheet: G-L6 |
| `dialogStore` | `show`, `dismiss`, `registerSheetHost` | Last `show` wins; there is no queue | G-M3 |
| `BottomSheet` | scrim, drag zone, Android back, `ref.close()`, expandable drag | Slides, then `onClose`. The parent must flip `visible`. `dismissible=false` snaps back | Yes, unless the parent refuses: G-M2 |
| `SelectionActionSheet` | rows, back chevron, scrim, drag, Android back | Row: `onClose()`, then `action.onPress()`. Dismissal: `onClose()`, then `onCancel()`. Danger rows sorted last | Yes for data. Double fire: 12a-A-L8. Modal hand-off: G-M4 |
| `ActionMenuHost` / `actionMenuStore` | as above | `onDismiss` runs in a microtask after any close, including after a chosen row, so promise callers take the first answer | Yes (`importSource` resolves once) |
| `SelectionDock` | dock keys | Tap: `haptic.tap` + `action.onPress`; no in-flight guard | Callers own idempotence |
| `PopoverMenuRow` / `PopoverRadioRow` / `PopoverMenuFootLink` | rows | `Press` → `onPress` | Yes |
| `ToastHost` / `toastStore` | action button, swipe away | Action: dismiss, then `onPress`. Newest toast wins | Undo-in-toast: G-L3 |
| `Press`, `Button`, `IconButton`, `CloseButton`, `InkKey`, `InkLink`, `InkOption`, `LitKey`, `Switch`, `ListRow`, `NavRow`, `SurfaceCard`, `HelpButton`, `ViewInCollectionButton`, `SideMenuButton` | tap / long press | Haptic plus callback; `disabled` honoured; **no debounce** | Toggles are idempotent (they compute from the render value) |
| `SegmentedControl`, `LyricsChordsToggle` | segments | `onChange(key)` | Yes |
| `Slider`, `Stepper`, `Knob`, `HueSlider`, `useHeldScrubGesture`, `ScrubBar` | drag, tap-jump, detents, long-press repeat | `onSlidingComplete`/`release`/`onCancel` always run on end **and** finalize | Yes |
| `TitleInput` | text, sparkle (random name), clear | Sanitizes on every change and on blur | G-L1 |
| `TimeEntryModal` | digit field, Set, Cancel, back | Untouched Set = close; otherwise clamp to `[min,max]`; a fresh field each opening; NaN impossible | Yes |
| `MarkInspector` / `SpanInspector` | edge chips (tap, long-press to type), stepper, slider, use-playhead, neighbour snap | Live `onSlide`, then one `onSlideCommit`; bounds latched during the drag | Yes |
| `TimeRangeSelector`, `LoopMoveHandle` | handle pans (long-press), region pan, seek | Commit on `onEnd` (also on a cancelled gesture) | Yes |
| `AudioReel` | scrub, tap-seek, zoom in/out/fit, marker drag/long-press (delegated), play | Seeks only. Marker writes are the caller's `onMarkerDragEnd` | Yes |
| `OverdubLayerLanes` | lane tap, Solo, Mute, fold all, Merge, Combine | Mute toggles a persisted flag (re-read from the store); Merge and Combine open choosers | Yes |
| `LevelToneStrip` | level slider, tone flags, reset tone | Commit on complete if changed. Reset toggles each lit flag; each toggle re-reads the store (`actions.ts:1447-1459, 1527-1539`) | Yes |
| `SpeedPitchDials`, `TransposeChip`, `ReadingSheet`, `SongReading` | speed taps/stepper/slider/presets, pitch stepper/reset, transpose, capo, chords, play-along switch | Prefs stores only | Yes |
| `useDraftText` | — | Commit captured at the keystroke; flush on pause, unmount, background; `seed` ignored while pending | G-M1, G-L8 |
| `useEditHistory` | — | Flushes its own pending push before undo; `reset` on a record change | Yes, but callers must flush their drafts: G-M1 |
| `useUndoHistory` / `UndoRedoButtons` | undo, redo | `record(prev)` before a change; `restore` outside the updater | Yes (callers clear on record switch) |
| `WorkspacePickSheet` | workspace rows | `onClose`, then `onPick(id)` unless current; by id | Yes |
| `SongbookChooserSheet` | book rows, New songbook | `addItemsToSongbook` by id, then a toast with "Open book" | G-L7 |
| `PlaylistChooserSheet` | playlist rows, New playlist → name sheet | Items snapshotted at open; resolves ids live; deletes an empty new playlist | Yes; G-M4 |
| `ReceivedPackageMoveModal` | destinations, Move, Cancel | Per package `adoptReceivedWorkspace` / `adoptReceivedPackageInto` | G-L5; Keep semantics 04-H1 |
| `ReceivedParcelSheet` | Report, Keep, Look first, Somewhere else, dismiss | Keep adopts, then the host unmounts (no double tap) | Yes; Keep contents 04-H1 |
| `SendLinkSheet` / `SendJobSheet` / `SendJobHost` | sort A–Z, nudge up/down, part toggles, title/from/note, Cancel, Seal, Copy, Share, Done, Dismiss, Try again, Cancel seal, Hide, pill | One job at a time | 12h (L-10, L-11, L-12, row 11) |
| `sparkSend` | New page, Update page, Cancel; toast Open | Copies spark text into a Pad note | G-H1 |
| `SparkFrame` | back, "…" (Text size, How it works, Send, Delete), footer back/next/link, missing-page back, example link | `AppAlert.menu`; the caller confirms Delete | Yes; G-M4 for Text size |
| `WordFinderSheet` | theme add/remove/edit, word tap (insert) / long press (preview), chip expand, Hebrew lookup, mode tabs, preview insert/drill/close, vocal choice, drill back, query, clear, tool list, "try near" | `onPickWord(word)`; the caller applies it to its draft and flushes | Yes (NoteEditor `handlePickWord` flushes) |
| `IdeaCard` / `InlineIdeaCard` / `ClipInlinePlayer` / `ClipNoteLine` / `ClipTagBadges` | lead (play), card, long press, pick circle, inline close, inline scrub, note open/more, tag tap, suggestion apply | Presentational; `onPress` may return a promise, which is voided | Yes |
| `FilterSortControls`, `SourceFilterRow`, `SearchField`, `SelectionTopBar`, `PickerFooter` | filter/sort toggles and clear, source switches, search and clear, select all, cancel, ✕ and Add N | Callers' state; Add disabled at 0 | Yes |
| `FloatingActionDock` | record FAB | `armed` is visual only | G-L4 |
| `RestoreRestartGate` | Restart (on failure) | Close players, clear queue/context, `reloadAppAsync`; back swallowed | Yes |
| `AppErrorBoundary` | Restart SongNook | Remounts the subtree (drafts flush on unmount) | 09-#1 |
| `WelcomeFlow` / `LanguageSelect` | Skip, Next, dots, swipe, Import (busy-guarded), language options | Language reloads at once in Welcome (no confirm) | 10-L1 |
| `ProUpsellSheet` | plans, Get Pro, Restore, Terms, Privacy, close | RevenueCat | 09-#10 |
| Hooks with library writes | `useInlinePlayer` (banks a missing duration), `useFullPlayer` (missing mix: clear the ref and re-render), `useLibraryCollectorHandlers` (Add/✕), `useMetronome` (prefs) | — | Yes, except G-L7 (collector) |

---

## Call sites that misuse a shared contract

| Contract | Call site | Misuse | Finding |
|---|---|---|---|
| `useDraftText` commit must read fresh state or be a narrow patch | `useChordSheetModel.ts:134-154` (`setBlockText`, `setSectionNotes`) via `ChordSheetSection.tsx:56`, `ChordSheetBody.tsx:427` | Rebuilds the whole chart from the render closure | G-M1 |
| Flush drafts before another write to the same record | `NoteEditor.tsx:62-72` undo and redo | No `flushDrafts()` | G-M1 |
| | `ChordSheetScreenContent.tsx:78` undo | No flush | G-M1 |
| `BottomSheet.onClose` must hide the sheet | `PlayerLayersBench.tsx:448` | Ignores the close while merging | G-M2 |
| A dialog's state must survive a replacing dialog | `App.tsx:1336-1375` restore prompt (persist freeze) | Relies on its own handlers only | G-M3 |
| | `useLibraryBackupFlow.ts:201-231` save promise | Same | G-M3 |
| Don't present a Modal while a sheet dismisses | `PlaylistChooserSheet.tsx:106-129`, `SparkFrame.tsx:50-56`, `SongbookDetailView.tsx:294`, `SetlistDetailView.tsx:298`, `PlaylistDetailView.tsx:327`, `IdeaSelectionBar.tsx:495`, `SelectionBars.tsx:561-577`, `ReceivedScreen/index.tsx:297` | Synchronous `setXVisible(true)` from a row | G-M4 |
| A Cancel that carries state needs `onDismiss` too | `domain/importDates.ts:130-152` | Promise hangs on scrim/back; picked copies leak | G-L2 |
| | `useLibraryBackupFlow.ts:143-160` | Promise hangs (harmless) | G-L2 |
| Toast Undo restores narrowly | `useMagpieScreenModel.ts:202-205`, `useWordLadderScreenModel.ts:233-235` | Whole-array snapshot | G-L3 |
| Gate double taps | `FloatingActionDock.tsx:83-87` (→ `CollectionFloatingActions.tsx:527-531`) | `armed` not checked | G-L4 |
| Say success only on success | `SongbookChooserSheet.tsx:42-43`, `useLibraryCollectorHandlers.ts:75-76` | Toast on a no-op | G-L7 |
| `TitleInput` max length | every edit sheet: `ClipNotesSheet.tsx:82`, `SongEditSheet.tsx:51`, `IdeaHeader.tsx:144`, `ClipCardEditForm.tsx:28`, `EditorSaveSheet.tsx:107` | Long existing titles truncated | G-L1 |

Checked and correct: every `AppAlert.custom` with a Cancel that does work and an `onDismiss` (`useCollectionImportFlow.ts:88-124`, `useRecordingScreenModel.ts:1451, 1496`, `App.tsx:1354`). The `CollectionActionsModal` no-op `onClose` paired with `onCancel`. Every `<Modal>` in `src/` has `ModalDialogLayer` or a host (grep: none missing). `DuplicateReviewSheet` and `ClipNotesSheet` close handlers always hide.

---

## Interaction inventory

Columns: # · Component › element · What it does to data (followed into the code) · Failure handling · Verdict.

### Dialogs, menus, toasts

| # | Component › element | Data effect | Failure handling | Verdict |
|---|---|---|---|---|
| 1 | AppDialog › any button | dismiss, then the caller's `onPress` | — | OK |
| 2 | AppDialog › scrim (with Cancel) | dismiss + `onDismiss`; never a confirm | — | OK |
| 3 | AppDialog › scrim (no Cancel) | inert | — | OK |
| 4 | AppDialog › Android back (root) | as scrim | — | OK |
| 5 | AppDialog › Android back (nested in a sheet) | closes the sheet, not the dialog | — | G-L6 |
| 6 | AppDialog › rich option row | as button | — | OK |
| 7 | AppDialog › destructive button | `warning` on show; red; needs an explicit tap | — | OK |
| 8 | dialogStore › show while one is up | first dialog's handlers dropped | none | G-M3 |
| 9 | AppAlert.error | `error` haptic + info dialog | — | OK |
| 10 | AppAlert.menu | ActionMenuHost sheet | — | OK |
| 11 | ActionMenuHost › row | `onClose` (store dismiss), then row `onPress`; `onDismiss` in a microtask after | — | OK; G-M4 for rows that open Modals |
| 12 | ActionMenuHost › scrim / drag / back | dismiss + `onDismiss` | — | OK |
| 13 | SelectionActionSheet › row | `onClose`, then `action.onPress` | — | OK; double fire 12a-A-L8; G-M4 |
| 14 | SelectionActionSheet › disabled row | not pressable | — | OK |
| 15 | SelectionActionSheet › back chevron | `onClose` + `onBack` (reopens the parent) | — | OK |
| 16 | SelectionActionSheet › dismiss | `onClose` + `onCancel`, never a row | — | OK |
| 17 | SelectionActionSheet › danger rows | sorted last behind a hairline | — | OK |
| 18 | SelectionDock › each key | `action.onPress`, no guard | — | callers |
| 19 | PopoverMenuRow | `onPress` | — | OK |
| 20 | PopoverRadioRow | `onPress` | — | OK |
| 21 | PopoverMenuFootLink | `onPress` (e.g. clear filters) | — | OK |
| 22 | ToastHost › action (Undo / Open / View) | dismiss + `onPress` | — | G-L3 for Undo |
| 23 | ToastHost › swipe away | dismiss; the action is lost | — | OK |
| 24 | ToastHost › auto-hide | clears the store | finished-guarded | OK |
| 25 | toastStore › show while one is up | replaces it, undo lost | — | G-L3 |
| 26 | importSource › Files / Videos / dismiss | resolves once; `afterOverlayCloses` before the picker | — | OK |
| 27 | importFeedback | one dialog + `error` | — | OK |

### Sheets and modals

| # | Component › element | Data effect | Failure handling | Verdict |
|---|---|---|---|---|
| 28 | BottomSheet › scrim | `closeWithSlide` → `onClose` | — | OK; G-M2 if the parent refuses |
| 29 | BottomSheet › drag down | as scrim (> 96 pt or fast) | snaps back | OK |
| 30 | BottomSheet › Android back | as scrim | — | OK; G-L6 |
| 31 | BottomSheet › expandable drag | resize only | — | OK |
| 32 | BottomSheet › `dismissible=false` | snaps back | — | OK |
| 33 | BottomSheet › keyboard avoid | layout only | — | OK |
| 34 | WarmModal › Android back | caller's `onRequestClose` | — | OK |
| 35 | ModalGestureRoot | gesture host | — | OK |
| 36 | TimeEntryModal › digit field | local `raw` | sanitized | OK |
| 37 | TimeEntryModal › keyboard Done / Set | `onConfirm(clamped)` or close if untouched | — | OK |
| 38 | TimeEntryModal › Cancel / back | close, nothing written | — | OK |
| 39 | HelpSheet / HelpButton | open/close only | — | OK |
| 40 | ReadingSheet › zoom slider | `setReadingZoom` (prefs) | — | OK |
| 41 | ReadingSheet › capo stepper / Capo off | prefs | — | OK |
| 42 | ReadingSheet › Chords switch | prefs | — | OK |
| 43 | WorkspacePickSheet › workspace row | `onClose`; `onPick(id)` if not current | — | OK |
| 44 | WorkspacePickSheet › received row | same | — | OK |
| 45 | SongbookChooserSheet › book row | `addItemsToSongbook` (deduped) + toast | — | G-L7 |
| 46 | SongbookChooserSheet › New songbook | `ensurePro`, `addSongbook`, add | — | OK |
| 47 | SongbookChooserSheet › toast Open book | `returnHome` → LibraryHome | — | OK |
| 48 | PlaylistChooserSheet › playlist row | `addItemsToPlaylist` (ids resolved live) | 0 → `error` + toast | OK |
| 49 | PlaylistChooserSheet › New playlist… | snapshot items → name sheet | — | G-M4 |
| 50 | PlaylistChooserSheet › name sheet Create | `addPlaylist` + add; an empty result deletes it | `error` | OK |
| 51 | PlaylistChooserSheet › name sheet Cancel | nothing | — | OK |
| 52 | PlaylistChooserSheet › toast Open | navigate | — | OK |
| 53 | ReceivedPackageMoveModal › destination row | selection state | — | OK |
| 54 | ReceivedPackageMoveModal › Move (own workspace) | `adoptReceivedWorkspace` per package | — | OK |
| 55 | ReceivedPackageMoveModal › Move (into) | `adoptReceivedPackageInto` per package | `AppAlert.error` | G-L5; 04-H1 |
| 56 | ReceivedPackageMoveModal › Cancel / back | reset | — | OK |
| 57 | ReceivedParcelSheet › mount | renames a lone "Files" collection to the parcel title | — | OK |
| 58 | ReceivedParcelSheet › Report | mailto draft | no mail app → `AppAlert.error` | OK |
| 59 | ReceivedParcelSheet › Keep | adopt or move; fold; land | `!ok` → `AppAlert.error` | OK; 04-H1 |
| 60 | ReceivedParcelSheet › Look first | `markReceivedPackageOpened` + visit | — | OK |
| 61 | ReceivedParcelSheet › Somewhere else… | hosted chooser | — | OK |
| 62 | ReceivedParcelSheet › dismiss | fold, package stays in Received | — | OK |
| 63 | SendLinkSheet › Sort A–Z | local order | — | OK |
| 64 | SendLinkSheet › nudge up/down | local order | — | OK |
| 65 | SendLinkSheet › part toggles | local leave-out | — | OK |
| 66 | SendLinkSheet › Title / From / Note | local; From remembered on Seal | maxLength | OK |
| 67 | SendLinkSheet › Seal | `startJob` | — | 12h row 11 |
| 68 | SendLinkSheet › Cancel / swipe | dismiss | — | 12h L-12 |
| 69 | SendJobSheet › Copy / Share | clipboard / share | — | 12h L-11 |
| 70 | SendJobSheet › Done / Dismiss | clear the job | — | OK |
| 71 | SendJobSheet › Try again | rerun the snapshot | — | 12h L-10 |
| 72 | SendJobSheet › Cancel (sealing) | abort | — | 12h L-1 |
| 73 | SendJobSheet › Hide / swipe | collapse to the pill | — | OK |
| 74 | SendJobHost › pill | expand | — | OK |
| 75 | SentLinkChip › Copy | clipboard + toast | — | 12h L-11 |
| 76 | ProUpsellSheet › plan options | local | — | OK |
| 77 | ProUpsellSheet › Get Pro | `purchasePro` | `error` + notice | 09-#10 |
| 78 | ProUpsellSheet › Restore | `restorePurchases` | notice | OK |
| 79 | ProUpsellSheet › Terms / Privacy | open URL | swallowed | OK |
| 80 | ProUpsellSheet › close | close | — | OK |
| 81 | RestoreRestartGate › auto restart | close players, clear queue/context, reload | `markRestoreReloadFailed` | OK |
| 82 | RestoreRestartGate › Restart (failed) | retry reload | same | OK |
| 83 | RestoreRestartGate › Android back | swallowed | — | OK |
| 84 | AppErrorBoundary › Restart | remount (drafts flush on unmount) | — | 09-#1 |
| 85 | FreeMonthNotices › toast See Pro | open upsell | — | OK |

### Text input and editing primitives

| # | Component › element | Data effect | Failure handling | Verdict |
|---|---|---|---|---|
| 86 | TitleInput › typing | sanitize (80 chars, 2 lines) → caller | — | G-L1 |
| 87 | TitleInput › blur | sanitize + trim → caller | — | G-L1 |
| 88 | TitleInput › sparkle | random name → caller | — | OK |
| 89 | TitleInput › clear | "" → caller (Save still required) | — | OK |
| 90 | SearchField › text / clear | caller query | — | OK |
| 91 | useDraftText › typing | draft; commit after 500 ms | — | G-M1, G-L8 |
| 92 | useDraftText › unmount | flush | — | OK |
| 93 | useDraftText › background | flush (after the store's own flush, 01-L1) | — | 01-L1 |
| 94 | useEditHistory › undo / redo | apply snapshot | — | callers G-M1 |
| 95 | useUndoHistory › undo / redo | restore snapshot | — | OK |
| 96 | UndoRedoButtons | as above | disabled when empty | OK |
| 97 | WordFinderSheet › theme chip ✕ | local theme list | — | OK |
| 98 | WordFinderSheet › theme field, submit, + | local | — | OK |
| 99 | WordFinderSheet › edit theme | local | — | OK |
| 100 | WordFinderSheet › suggestion tap | `onPickWord` → caller inserts + flushes | — | OK |
| 101 | WordFinderSheet › suggestion long press | preview | — | OK |
| 102 | WordFinderSheet › chip expand | local | — | OK |
| 103 | WordFinderSheet › Hebrew "Find" | network lookup | status states | OK |
| 104 | WordFinderSheet › mode tabs / tool list | local | — | OK |
| 105 | WordFinderSheet › preview Insert / Explore / close | `onPickWord` / drill | — | OK |
| 106 | WordFinderSheet › vocal choice | local | — | OK |
| 107 | WordFinderSheet › drill back | local | — | OK |
| 108 | WordFinderSheet › query + clear | local | — | OK |
| 109 | WordFinderSheet › Try near | local | — | OK |
| 110 | sparkSend › Send (no page yet) | `addNote` + `updateNote` + link + toast | empty → info | OK |
| 111 | sparkSend › New page | as above | — | OK |
| 112 | sparkSend › Update page | `updateNote(existing.id, { body })` | — | **G-H1** |
| 113 | sparkSend › Cancel / scrim | nothing | — | OK |
| 114 | sparkSend › toast Open | `navigate("NotepadHome", {noteId, openToken})` | — | OK |

### Spark chrome

| # | Component › element | Data effect | Failure handling | Verdict |
|---|---|---|---|---|
| 115 | SparkFrame › back | caller's `onBack` (models flush) | — | OK |
| 116 | SparkFrame › "…" Text size | opens the size sheet | — | G-M4 |
| 117 | SparkFrame › "…" How this works | help | — | OK |
| 118 | SparkFrame › "…" Send to Lyric Pad | caller `sendToPad` (flush, fresh state) | — | G-H1 |
| 119 | SparkFrame › "…" Delete spark | caller confirm | — | OK |
| 120 | SparkFooter › back / next / final | caller steps; final = `success` | — | OK |
| 121 | SparkFooter › link | caller | — | OK |
| 122 | SparkHint › See example | caller | — | OK |
| 123 | SparkMissing › back | navigate | — | OK |
| 124 | SparkTextSizeSheet › zoom | spark prefs | — | OK |

### Cards, rows, buttons

| # | Component › element | Data effect | Failure handling | Verdict |
|---|---|---|---|---|
| 125 | IdeaCard › lead (play) | caller `onPressLead` | disabled without audio | OK |
| 126 | IdeaCard › card | caller `onPress` (a promise is voided) | — | OK |
| 127 | IdeaCard › long press | caller (selection) | — | OK |
| 128 | IdeaCard › pick circle | caller | `disabled` honoured | OK |
| 129 | IdeaCard › inline close / scrub | playback | — | OK |
| 130 | InlineIdeaCard › play / open / "…" / long press | caller | — | OK |
| 131 | ClipInlinePlayer › ✕ | stop preview | — | OK |
| 132 | ClipNoteLine › tap / More / Less / long press | open the notes sheet / expand / caller | — | OK |
| 133 | ClipTagBadges › tag / suggestion | caller | — | OK |
| 134 | ListRow / NavRow / SurfaceCard › tap, long press | caller | — | OK |
| 135 | Button / IconButton / CloseButton / InkLink / HelpButton / ViewInCollectionButton | caller | no debounce | callers |
| 136 | InkKey / InkOption / LitKey / Switch | caller toggle (from the render value, so idempotent on a double tap) | — | OK |
| 137 | SegmentedControl / LyricsChordsToggle | `onChange(key)` | — | OK |
| 138 | EmptyState › action / link | caller | — | OK |
| 139 | ScreenHeader › left (back / hamburger / custom) | `goBack` / drawer / caller | — | OK |
| 140 | ScreenHeader › right slot | caller | — | OK |
| 141 | SideMenuButton | open the side menu | — | OK |
| 142 | SelectionTopBar › Select all / Cancel | caller | — | OK |
| 143 | PickerFooter › ✕ / Add N | `useLibraryCollectorHandlers` | Add disabled at 0 | OK; G-L7 |
| 144 | FilterSortControls › filter, clear, sort, backdrop | caller filter/sort state | — | OK |
| 145 | SourceFilterRow › workspace switch, expand, collection switch | caller (Activity/Revisit customise) | — | OK |
| 146 | FloatingActionDock › Record | `quickRecordIdea` + navigate | none | G-L4 |
| 147 | BackgroundPill › tap | expand | — | OK |
| 148 | LanguageSelect › trigger / option / backdrop | `setLanguage` → reload | swallowed (Welcome) | 10-L1 |
| 149 | WelcomeFlow › Skip / Next / dots / swipe | local, `onDone` | — | OK |
| 150 | WelcomeFlow › Import | `runWelcomeImport` (busy-guarded) | — | OK; 10-L1 |

### Transport, reel, inspectors

| # | Component › element | Data effect | Failure handling | Verdict |
|---|---|---|---|---|
| 151 | TransportBar › prev / play / next / close | playback | disabled states | OK |
| 152 | SongPagerStrip › prev / next / swipe | navigation | — | OK |
| 153 | ScrubBar › drag | seek | — | OK |
| 154 | AudioReel › scrub / tap-seek | seek | — | OK |
| 155 | AudioReel › zoom in / out / fit | view only | — | OK |
| 156 | AudioReel › marker drag / long press | caller `onMarkerDragEnd` / menu | — | OK (sweep A) |
| 157 | TimeRangeSelector › left / right handle | `onRegionChange` on end | — | OK |
| 158 | TimeRangeSelector › region pan / seek | same / seek | — | OK |
| 159 | LoopMoveHandle › pan | `onRangeChange` on end | — | OK |
| 160 | MarkInspector › edge chip tap / long press | pick edge / type time | — | OK |
| 161 | MarkInspector › stepper / slider / use playhead / neighbour | `onEdge` (clamped) | disabled when illegal | OK |
| 162 | SpanInspector | wraps MarkInspector, legal range | — | OK |
| 163 | OverdubLayerLanes › lane tap | open the layer sheet | — | OK |
| 164 | OverdubLayerLanes › Solo | session solo | — | OK |
| 165 | OverdubLayerLanes › Mute | persisted mute toggle | — | OK |
| 166 | OverdubLayerLanes › fold all | layer prefs | — | OK |
| 167 | LayerLanesFoot › Merge / Save as one clip | opens chooser / picker | — | OK; G-M2 |
| 168 | LevelToneStrip › level slider | `onCommitGain` if changed | — | OK |
| 169 | LevelToneStrip › tone flags / reset | toggles (fresh reads) | — | OK |
| 170 | SpeedPitchDials › all keys | playback rate/pitch (session or kept) | — | OK |
| 171 | TransposeChip › stepper / reset | chart prefs | — | OK |
| 172 | SongReading › capo play-along switch | chart prefs | — | OK |
| 173 | Knob / Slider / Stepper / HueSlider | caller values, completion guaranteed | — | OK |
| 174 | MetronomeBlocks › start/stop, tap tempo, meter, pulse taps (editing), outputs, haptic strength | metronome prefs via `useMetronome` | — | OK |

### Hooks with data or navigation effects

| # | Hook › trigger | Data effect | Failure handling | Verdict |
|---|---|---|---|---|
| 175 | useLibraryCollectorHandlers › Add | `addLibraryCollectorPicks`, end the session, toast, land | `noCharts` → `error` + info | G-L7 |
| 176 | useLibraryCollectorHandlers › ✕ | end the session, keep nothing | — | OK |
| 177 | useParcelPreview › toggle | stream or download to cache; no library write | silent stop | minor |
| 178 | useInlinePlayer › duration bank | `hydrateClipAudioMetadata` only when missing, once per target | — | OK |
| 179 | useFullPlayer › missing mix | `clearClipOverdubRenderedMix` + background re-render; plays the base | warn | OK |
| 180 | useFullPlayer / FullPlayerProvider › queue | transient queue | — | OK |
| 181 | useBrowseRootBackHandler › Android back | close drawer / unwind sub-state / delegate (never exits) | — | OK |
| 182 | usePersistedScrollView | scroll offset only | — | OK |
| 183 | useMetronome / usePlaybackClick / useNativePitchTransport | prefs + native engines | caught | OK |
| 184 | useOriginLabel / useWordLanguage / useAppForeground / useKeepAwakeWhileFocused / useKeyboardOverlap / useStableArray / useTransportClock / useTransportScrubbing / useRecordingDisplayElapsed / useThrottledAudioPlayerStatus / useClipWaveform / PlayerSheetPositionProvider / twinFollow / nativeStateCommit / engineIntent | read-only or transient | — | OK |

184 rows.

---

## What is solid

- **A scrim never confirms.**
  - AppDialog enables scrim and back only when a `cancel` button exists, and then runs only `onDismiss` (`AppDialog.tsx:51-55, 72-73`).
  - Destructive dialogs need an explicit tap on a red button.
  - A sheet's dismissal runs `onClose`/`onCancel` and never a row (`SelectionActionSheet.tsx:107-110`).
- **Menus that answer promises resolve once.** `ActionMenuHost` defers `onDismiss` to a microtask after a chosen row (`SelectionActionSheet.tsx:176-182`). `chooseImportSource` resolves on the row and ignores the later dismiss.
- **iOS Modal stacking is handled for dialogs.** Every native `<Modal>` under `src/` mounts `ModalDialogLayer`, `AppDialogHost nested` or a BottomSheet (grep: none missing), so a dialog raised inside a modal draws inside it.
- **Value controls always finish.**
  - `Slider`, `Knob` and `useHeldScrubGesture` call complete, release or cancel on both `onEnd` and `onFinalize`.
  - `MarkInspector` latches bounds during a drag.
  - `TimeEntryModal` can't produce NaN and opens fresh each time.
- **Toggles are double-tap safe.** `Switch`, `InkOption` and `LitKey` compute from the render value. Tone reset re-reads the store per flag.
- **Chooser sheets act by id** (`WorkspacePickSheet`, `SongbookChooserSheet`, `PlaylistChooserSheet`, `ReceivedPackageMoveModal`), so a list that re-sorts can't move the wrong thing. `PlaylistChooserSheet` snapshots its items before the selection can end, and deletes a new playlist that received nothing.
- **Spark send reads fresh state.** It reads after `flushDraft()`, so the last keystrokes travel (`useMagpieScreenModel.ts:327-342` and siblings).
- **Draft fields flush on unmount and background.** `useDraftText` editors key per record where records switch in place.
- **Keep on a parcel can't double-fire.** The host unmounts the sheet as soon as the package leaves Received.
- **The restart gate cannot be dismissed**, and closes players before reloading.

---

## Files read

`src/components/common/`:
- AnimatedCollapse.tsx, AppAlert.ts, AppDialog.tsx, AppErrorBoundary.tsx, AudioReel.styles.ts, AudioReel.tsx
- BackgroundPill.tsx, BottomSheet.tsx, Button.tsx
- ClipInlinePlayer.tsx, CloseButton.tsx, CollapsingHeaderOverlay.tsx
- EmptyState.tsx, EvolutionGlyph.tsx
- FilterSortControls.tsx, FloatingActionDock.tsx, FreeMonthNotices.tsx
- HelpButton.tsx, HelpSheet.tsx, HueSlider.tsx
- IconButton.tsx, IdeaCard.tsx, InkKey.tsx, InkLink.tsx, InkOption.tsx, InlineIdeaCard.tsx
- Knob.tsx
- LanguageSelect.tsx, Ledger.tsx, LevelToneStrip.tsx, ListRow.tsx, LitKey.tsx, LiveTimeReadout.tsx, LoopMoveHandle.tsx, LyricsChordsToggle.tsx
- MarkInspector.tsx, MetronomeIcon.tsx, ModalGestureRoot.tsx
- NavRow.tsx, NowPlayingIndicator.tsx
- OverdubLayerLanes.tsx
- PageIntro.tsx, PickerEyebrow.tsx, PickerFooter.tsx, PlaylistChooserSheet.tsx, PopoverMenu.tsx, Press.tsx, ProGate.tsx, ProUpsellSheet.tsx, ProvenanceChip.tsx
- ReadingSheet.tsx, ReceivedPackageMoveModal.tsx, ReceivedParcelSheet.tsx, RestoreRestartGate.tsx
- ScreenHeader.tsx, ScrubBar.tsx, SearchField.tsx, SegmentedControl.tsx, SelectionActionSheet.tsx, SelectionDock.tsx, SelectionTopBar.tsx, SendLinkSheet.tsx, SentLinkChip.tsx, SideMenuButton.tsx, Slider.tsx, SongPagerStrip.tsx, SongReading.tsx, SongbookChooserSheet.tsx, SourceFilterRow.tsx, SpanGlyph.tsx, SpanInspector.tsx, SparkFrame.tsx, SpeedPitchDials.tsx, Spinner.tsx, StageMark.tsx, Stepper.tsx, StickyInScroll.tsx, SurfaceCard.tsx, Switch.tsx
- TimeEntryModal.tsx, TimeRangeSelector.tsx, TitleInput.tsx, ToastHost.tsx, TransportBar.tsx, TransportLayout.tsx, TransposeChip.tsx
- ViewInCollectionButton.tsx
- WarmModal.tsx, WaveformStrip.tsx, WelcomeFlow.tsx, WordFinderSheet.styles.ts, WordFinderSheet.tsx, WorkspaceAvatar.tsx, WorkspacePickSheet.tsx
- actionIcons.ts, actionMenuStore.ts, afterOverlayCloses.ts, dialogStore.ts, dockIcons.tsx, floatingActionDockLayout.ts, helpContent.ts, importFeedback.ts, importSource.ts, proUpsell.ts, shareExits.ts, sideMenuStore.ts, sparkSend.ts, sparkTextScale.tsx, toastStore.ts, useHeldScrubGesture.ts, useUndoHistory.tsx
- clip/ClipNoteLine.tsx, clip/ClipTagBadges.tsx
- metronome/MetronomeBeatBar.tsx, metronome/MetronomeBlocks.tsx
- `__tests__/floatingActionDockLayout.test.ts`

`src/hooks/`:
- FullPlayerProvider.tsx, PlayerSheetPositionProvider.tsx
- engineIntent.ts, nativeStateCommit.ts, twinFollow.ts
- useAppForeground.ts, useBrowseRootBackHandler.ts, useClipWaveform.ts, useDraftText.ts, useEditHistory.ts, useFullPlayer.ts, useInlinePlayer.ts, useKeepAwakeWhileFocused.ts, useKeyboardOverlap.ts, useLibraryCollectorHandlers.ts, useMetronome.ts, useNativePitchTransport.ts, useOriginLabel.ts, useParcelPreview.ts, usePersistedScrollView.ts, usePlaybackClick.ts, useRecordingDisplayElapsed.ts, useStableArray.ts, useThrottledAudioPlayerStatus.ts, useTransportClock.ts, useTransportScrubbing.ts, useWordLanguage.ts
- `__tests__/`: clipWaveformSource, engineIntent, nativeStateCommit, twinFollow, useDraftText, useThrottledAudioPlayerStatus
- (useRecording.ts: sweep D)

Followed into, for the call sites:
- `domain/`: draftCommitter.ts, timeEntry.ts, fileTitle.ts, receivedParcel.ts, importDates.ts
- `state/`: actions.ts (quickRecordIdea, tone toggles, addItemsToSongbook), useSendJobStore.ts, useStore.ts (guarded write, flush), persistRuntime.ts, persistedSnapshot.ts
- `services/`: recordingRecovery.ts, billing.ts, welcomeImport.ts
- `i18n/locale.tsx`; `App.tsx:1320-1480`
- ChordSheetScreen (useChordSheetModel, ChordSheetSection, ChordSheetBody, ChordSheetScreenContent)
- NotepadScreen (NoteEditor, useNotepadScreenModel, NotepadScreenContent)
- spark models (Magpie, WordLadder, CutUp)
- PlayerLayersBench.tsx, ClipNotesSheet.tsx, CollectionActionsModal.tsx, QuickNameModal.tsx, CollectionMoveModal.tsx
- useCollectionImportFlow.ts, useWorkspaceCollectionImportFlow.ts, useSongImportFlow.ts, useLibraryBackupFlow.ts, useRecordingScreenModel.ts (dialogs), RecordingScreen/index.tsx, CollectionFloatingActions.tsx, useCollectionManagement.ts, SettingsGeneralView.tsx
