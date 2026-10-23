# Audit — LIBRARY, BROWSE & NAVIGATION

Scope: App.tsx (navigation only), src/navigation.ts, SideNav, WorkspaceList/Browse, IdeaListScreen, IdeaDetailScreen (page shell), Search, Shelf, Revisit, Activity, LibraryScreen (Compilations), SongbookReader, SetlistSong, ChordSheet, LyricsVersion, LyricsScreen, modals/sheets, common list/menu components, the listed domain/state/hook modules.
Method: read-only code tracing from real callers; `npx tsc` / `jest` were green at start (not re-run). Nothing was run on a device — every finding is from code, confidence stated per item.

Counts: P0 0 · P1 2 · P2 5 · P3 16.

---

## P1

### 1. Bulk actions inside a visited collection that is not the active workspace act on the wrong workspace (received packages)
- Severity P1 · confidence high (traced; not run on device)
- Path: Received → open a package → `visitCollection(navigation, { collectionId, workspaceId: pkg.id })` (src/components/ReceivedScreen/index.tsx:105, src/components/common/ReceivedParcelSheet.tsx:174). A received package never becomes the active workspace (WorkspaceBrowseScreenContent.tsx:65, WorkspaceList.tsx:50-54, by design). The visited page derives its ideas from the route workspace (src/components/IdeaListScreen/hooks/useCollectionScreenModel.ts:57-66), and nothing stops selection mode there (IdeaListItem.tsx `beginSelection`, no received guard).
- What happens:
  - **Delete**: `deleteSelectedIdeasWithUndo` reads `state.activeWorkspaceId` (src/components/IdeaListScreen/sections/CollectionFloatingActions.tsx:255-262) → `removedIdeas` is empty → returns after the destructive confirm. Nothing is deleted, no feedback.
  - **New sketch** (dock primary; `canMakeSong` is true because the count comes from `screen.ideas`): `createProjectFromClipIdeas` (CollectionFloatingActions.tsx:355-441) writes `mergedProject` with `collectionId: screen.collectionId` (the package's collection) into the **active** workspace, where that collection does not exist → an orphan sketch invisible in every collection, holding copies of clip objects that still also live in the package; then it navigates to it. The package's clips are not removed (the filter runs on the active workspace).
  - **Copy / Move**: `appActions.startClipboardFromList` (src/state/actions.ts:3070-3076) filters the active workspace → clipboard with `clipIds` but `sourceWorkspaceId` = active → paste finds no source ideas and silently returns `[]`.
  - The selection bar itself reads `activeWorkspace` (src/components/IdeaListScreen/components/IdeaSelectionBar.tsx:98-103) so its title reads "0 ideas" and Play is disabled, while Delete / New sketch / More stay enabled.
- Same class of bug for any future visit path that does not call `setActiveWorkspaceId` first (today Search/Activity/Shelf/Revisit/Queue all do; only Received does not).
- Minimal fix: resolve the workspace from the page (`screen.activeWorkspaceId`, already the route workspace) in `deleteSelectedIdeasWithUndo`, `createProjectFromClipIdeas`, and pass it into `startClipboardFromList`/`IdeaSelectionBar`; or, if packages should be read-only, block `startListSelection` when `isReceivedWorkspace` (one guard in IdeaListItem's two long-press handlers via a prop from the list model). The guard variant is ≤15 lines but removes a capability on packages, so it needs the founder's yes.

### 2. Seven "go to the hub" navigations push a duplicate `Browse` over an open collection
- Severity P1 · confidence high (RN 7.5.3 `StackRouter` NAVIGATE reuses a route only if it is the *current* one or `pop: true` is set — node_modules/@react-navigation/routers/src/StackRouter.tsx; nested `{screen, params, pop}` is forwarded by `useNavigationBuilder` lines 650-655).
- Call sites missing `pop: true` (the helper `openWorkspaceBrowseRoot` in src/navigation.ts:213-221 has it):
  - src/components/WorkspaceListScreen/components/WorkspaceList.tsx:57-60 (tap a workspace card)
  - App.tsx:651-655 (side menu "Collections · n" row, both the drawer and the overlay host)
  - src/components/SearchScreen/hooks/useSearchScreenModel.ts:116 (a workspace result)
  - src/components/LibraryScreen/hooks/useLibraryScreenModel.ts:135-138, useSetlistModel.ts:204, useSongbookModel.ts:177-180 (start collecting into a compilation)
  - src/components/IdeaDetailScreen/components/SongScreenContent.tsx:41-43
- What happens: with `Browse(A) › CollectionDetail(X)` open, tapping workspace B's card sets the active workspace to B and pushes `Browse(B)` → stack is `Browse(A), Collection(X), Browse(B)`. Hardware/edge back from B's hub lands on collection X of workspace A while the recorder, side menu and header all say B. Repeat and the stack grows "Collection, Browse, Collection, Browse…" — exactly what navigation.ts's law comment forbids. Every stale page stays mounted (only drawer pages have `freezeOnBlur`).
- Fix [SMALL-WIN]: add `pop: true` to each nested params object, or replace with `openWorkspaceBrowseRoot(navigation, workspaceId)`.

---

## P2

### 3. Duplicate-paste warning is hardcoded English, ~35 words, says "item"
- P2 · high · useCollectionScreenModel.ts:470-481 → shown by IdeaListHeaderSection.tsx:73 as an `AppAlert.confirm` body.
- Hebrew users get an English paragraph; alert body budget is ≤ 20 words; "item(s)" violates the terminology law. Fix: `t("collection.duplicateBody", { count })` with a one-line body; drop the name list.

### 4. "Copy here / Move here" confirm shows an empty body
- P2 · high · src/components/IdeaListScreen/components/IdeaListHeaderSection.tsx:76 passes `""` as the message of `AppAlert.confirm`. A dialog with a title and a blank line. Fix [SMALL-WIN]: a one-line `t()` body.

### 5. Android back on a Compilations detail view leaves the page instead of closing the detail
- P2 · med (no device run; no handler exists in code) · src/components/LibraryScreen/components/LibraryScreenContent.tsx:54 `useBrowseRootBackHandler()` with no `onBack`, while playlist/songbook/setlist detail and the setlist builder are internal view state (`model.activePlaylist` etc., lines 163-224). Hardware back from a playlist detail delegates to the drawer's `backBehavior="initialRoute"` → jumps to the workspace hub, abandoning the detail. Every other root page with sub-state (Browse selection, Revisit snapshot) passes `onBack`. Fix: `useBrowseRootBackHandler(hasDetail ? { onBack: closeDetail } : true)`.

### 6. Unfinished / duplicate store surface for the list clipboard and bulk delete
- P2 · high (dead code that can drift from the live path)
- src/state/selectionSlice.ts:144-157: `startClipboardFromList`, `startClipboardFromProject`, `pasteClipboardToProject`, `pasteClipboardToCollection`, `pasteClipboardToWorkspace` are literal stubs ("Stub to be implemented", return `[]`) on the store; every UI path calls the `appActions` versions instead (IdeaSelectionBar.tsx:265, SelectionBars.tsx:147, CollectionHeaderSection.tsx:321, SongClipboardBanner.tsx:64-81). `pasteClipboardToWorkspace` has no caller anywhere.
- src/state/actions.ts:3004 `deleteSelectedIdeasFromList` has no callers; it is a second copy of `deleteSelectedIdeasWithUndo` (CollectionFloatingActions.tsx:249-322) minus the undo and minus the trash-after-flush ordering used there.
- Fix [SMALL-WIN]: delete the stubs and the orphan action (store type + implementation).

### 7. Hardcoded user-facing strings (not through `t()`)
- P2 · high · all [SMALL-WIN]
  - src/domain/songbookGrouping.ts:69 `"Unavailable song"` (rendered as a songbook row title after the song is deleted).
  - src/components/LibraryScreen/views/PlaylistDetailView.tsx:265 accessibilityLabel `` `Play from ${track.title}` `` / `` `${track.title} (unavailable)` `` (VoiceOver reads English in Hebrew).
  - src/components/WorkspaceBrowseScreen/hooks/useWorkspaceCollectionImportFlow.ts:66 dialog title `"New collection from import"`.
  - src/domain/chordSheet.ts:112 `` `Section ${n}` ``, :156 `"Section"`, :210 `"(no bars yet)"` — section labels written into user data / the shared text export.
  - useCollectionScreenModel.ts:470-481 (finding 3).
  - (Dev-only strings in useCollectionImportFlow.ts:200-300 are behind `__DEV__` — fine.)

---

## P3

### 8. Hex / radius / motion literals in scope components (CLAUDE.md: tokens only; no cold literals)
- P3 · high · design debt, no behaviour impact.
  - App.tsx:1128,1131,1520,1521,1549,1565 `#FDFBF7` / `#B87D6B` on the three boot spinners; App.tsx:179 `borderTopRightRadius: 16`.
  - IdeaListItem.tsx:266,273,329,562 `#84736f`; CollectionHeaderSection.tsx:419-444 (`#1C1C19`, `#FDFBF7`, `#84736f`, `#524440`); IdeaListNestedCollectionsSection.tsx:75,114,148; IdeaListContent.tsx:161 `paddingHorizontal: 14, paddingBottom: 12`.
  - IdeaListHeaderSection.tsx:40,50 `#475569` / `#64748b` — cold slate on the activity-range banner (the one literal class the rule names explicitly).
  - SideNav.tsx:398,443,613; ShelfScreen/styles.ts:5-9; RevisitScreen/styles.ts:5-24; WorkspaceBrowseScreenContent.tsx:544-611; IdeaDetailScreen/songClipControls.ts:7-31 (tag palette); LyricsVersionScreen/components/chords/ChordChartEditor.tsx:93 `#fff`.
  - src/components/common/SelectionDock.tsx:58-59 `SlideInDown.duration(220)` / `SlideOutDown.duration(180)` — numeric motion literals and a full-height slide (motion vocabulary: fade or ≤ 6 px).

### 9. Debug logging that survives release
- P3 · high · [SMALL-WIN] · src/components/IdeaDetailScreen/hooks/useSongClipEditing.ts:52 and components/SelectionBars.tsx:295 `console.warn("[renameThread] …")` with object payloads (babel strips only log/debug); plus 12 `console.log("[renameThread] …")` lines in useSongClipEditing.ts:62-170 that are stripped but are leftover trace scaffolding.

### 10. Dead exports (definition is the only occurrence in src, excluding tests)
- P3 · high · [SMALL-WIN]
  - src/domain/hierarchy.ts `getHierarchyIconColor`; src/domain/compilationListing.ts `COMPILATION_FILTERS`, `COMPILATION_SORTS`; src/domain/lyrics.ts `getLyricsPreview`; src/domain/chords.ts `ACCIDENTAL_OPTIONS`; `pasteClipboardToWorkspace` (finding 6).
  - Exported but only used inside their own file (drop the `export`, not dead): activity.ts `startOfActivityWeek`/`endOfActivityWeek`/`filterOrphanedActivityEvents`/`buildSyntheticActivityEvents`, ideaSort.ts `getIdeaDurationMs`, workspaceTheme.ts `hslToHex`/`hexToHsl`/`computeWorkspaceTheme`, ActivityScreen/helpers.ts `CELL_GAP`/`formatActivityCardMatch`/`formatActivityTimeLabel`, IdeaListScreen/ideaListItemMeta.ts `buildIdeaListItemMeta`, libraryNavigation.ts `getWorkspaceLastWorkedAt`, chords.ts `buildChordRowLine`/`paletteItemFromChord`.
  - Test-only exports (fine to keep): transpose.ts `parseChordSymbol`/`transposeChordSymbol`, useChartPrefsStore `readingChordShift`/`sanitizeCapos`, shelf.ts `shelfNeedsDecision`, useBrowseRootBackHandler `resolveBrowseRootBackAction`, listGeometry `rowKindOf`.

### 11. Navigation-state sanitiser is dead weight
- P3 · med · App.tsx:265-480 (`createHomeRoute`, `normalizeWorkspaceStackRoute`, `isValidRestorableRootRoute`, `normalizeHomeDrawerRoute`, `sanitizeNavigationState`). Navigation state is never persisted or restored: the only input is `buildStartupNavigationState` (App.tsx:804-841), a freshly built single-`Home` state. The legacy `Tuner`/`Metronome` rewrites, the "trailing root routes" filter and `isValidRestorableRootRoute` (which also silently omits `ChordSheet`, `ShareImport`, `TransferReceive`) can never fire. ~200 lines; keep only if a persisted-state restore is planned.

### 12. Whole-library subscriptions on always-mounted chrome
- P3 · high
  - src/hooks/useOriginLabel.ts:41 subscribes every `ScreenHeader` with a back chevron (and the sketch page's IdeaHeader) to `s.workspaces` → one re-render of each mounted header per library write. [SMALL-WIN]: select only the one title the label needs by id.
  - App.tsx SideNavHost:581 subscribes both drawer hosts to `s.workspaces`; `getRecentCollectionsForWorkspace` reruns per write. Same narrow-selector pattern applies.
  - src/components/IdeaListScreen/index.tsx:7 derives the theme hue from the **active** workspace, so a visited collection in another workspace (received package) wears the wrong hue. [SMALL-WIN]: resolve from the route's `workspaceId`.

### 13. Collection page derivations rerun per library write; the context value is a fresh object every render
- P3 · high · src/components/IdeaListScreen/provider/CollectionScreenProvider.tsx:89 builds `value={{…}}` inline and useCollectionScreenModel returns a fresh object with fresh closures (`upLink`, `collectionRouteParams`, `breadcrumbs`, `onBack`, `openDrawer`, lines 434-595), while subscribing to the entire `workspaces` array (:56). Every write anywhere re-renders every context consumer (header, filter row, floating dock, scrubber host). The rows are insulated (`IdeaListItem` memo'd with per-row selectors; `listEntries` fingerprinted) so the list itself is fine — hence P3. A `CollectionVisit` on the root stack is not `freezeOnBlur`'d, so a visited collection under a sketch page keeps re-deriving `filteredIdeas` → `searchMetaByIdeaId` → `listEntries` on each write.
- `computeIdeaSearchMeta` runs twice per idea: once for the whole collection in the model (:166-170) and again per mounted row (IdeaListItem.tsx:124-127). [SMALL-WIN]: drop one.

### 14. Activity page rebuilds synthetic history on every library write
- P3 · high · src/components/ActivityScreen/hooks/useActivityScreenModel.ts:115-118 `getActivityEventsWithHistory` walks every idea in every personal workspace and sorts all events on each write while mounted. The drawer copy is frozen on blur; the root-pushed `Activity` (collection scope, Revisit's "around this time") is not. Results list is capped at 60 unmemoized cards (ActivityRangeResults.tsx:52) — acceptable.

### 15. Revisit's clock is frozen at mount
- P3 · med · src/components/RevisitScreen/hooks/useRevisitScreenModel.ts:29 `const now = useMemo(() => Date.now(), [])`. The drawer page never unmounts, so the daily rotation key, "around this time" window, snooze expiry and `markVaultExposure`'s `sessionKey` (:103-108) stay on the day the app was first opened until a cold start. Fix: refresh `now` on focus.

### 16. Timeline day labels are memoised on data, not on the clock
- P3 · low · useCollectionScreenModel.ts:225-284 bucket labels ("Today", "Yesterday") come from `getDateBucket(Date.now())` inside a memo keyed on the ideas; a collection left open across midnight keeps yesterday's grouping until any write.

### 17. Deleting ideas/collections prunes playlists only; songbooks and setlists keep dangling ids forever
- P3 · high · dataSlice `deleteCollection` and `deleteSelectedIdeasWithUndo` rewrite `playlists`; src/state/runtimeCleanup.ts touches only `playlists` (:47). Songbook rows render as "Unavailable song" (songbookGrouping.ts:56-71), setlist entries are skipped (useSetlistModel.ts:227). Not a crash, but a deleted song is a permanent ghost row in every songbook that held it, and the export skips it silently.

### 18. Bulk collection delete persists N snapshots
- P3 · med · src/components/WorkspaceBrowseScreen/hooks/useWorkspaceCollectionSelection.ts:211-213 loops `deleteCollection(id)`; each call runs its own `set` + `persistAppStoreSnapshot` + media trash (dataSlice deleteCollection tail). Ten selected collections = ten full-library serialisations back to back. Fix: a single `deleteCollections(ids)` action.

### 19. Search's collection result opens inside Home, not as a visit
- P3 · med · useSearchScreenModel.ts:118-125 `navigate("WorkspaceStack", { screen: "CollectionDetail" })`: back from that collection follows the drawer's initial-route rule (hub) and never returns to the results, unlike idea results which `visitCollection`. Consistency with the law; not a bug.

### 20. Sketch page is opened by raw `navigate` on the drawer, not `openSketchPage`
- P3 · high · IdeaListItem.tsx:106-109 + 378, CollectionFloatingActions.tsx:441, useActivityScreenModel.ts:316. Works (the action bubbles to the root stack and pushes because `IdeaDetail` is never the current route there) but bypasses the helper that guards the "same sketch already in front" case and the registered-root fallback. [SMALL-WIN].

### 21. Playback-pitch capo reminder names the offset, not the fret, when the song already has a capo
- P3 · low · src/components/common/SongReading.tsx:131-147 shows `t("reading.capoShort", { fret: pitchSemitones })` beside `readingKeyLabel(t, readingShift.capo)` (PlayerScreen/index.tsx:321). A song read with capo 3, played +2 with "keep shapes" on, shows "Capo 3" on one line and "+2 · capo 2" on the next; the fret a guitarist needs is 5. Chord math itself is right (`readingChordShift` wraps −12 correctly; `totalReadingShift` modulo is sign-safe; pitch is clamped ±12 so a capo > 11 cannot occur).

### 22. CollectionMoveModal is a raw `Modal` on the deprecated card shell
- P3 · high · src/components/modals/CollectionMoveModal.tsx:49-116 uses RN `Modal` + `styles.modalBackdrop/modalCard` instead of `WarmModal`/`BottomSheet` (every sibling modal in scope does). Visual canon drift only.

### 23. Bare `Math.max(...spread)` over all ideas in search
- P3 · low · src/domain/search.ts:306-310 argument-spread over the whole workspace per workspace match; safe below ~100k ideas, O(n) per (debounced) keystroke. Not a bug.

---

## Verified OK (no finding)
- No `navigate("Home")` anywhere; `returnHome`/`popTo` used for every landing; origin labels are derived from the route beneath (`useOriginLabel`), never passed as params (`activityLabel` is a filter-banner label, not a chevron label).
- Deep links: `getStateFromPath` override routes share-intent URLs to `ShareImport`; cold-start deep link skips the startup state; `onResetShareIntent` pops only when ShareImport is current. Params are ids only — no injection surface.
- Android back: side-menu overlay handler (App.tsx:906-914), drawer close, selection unwind on Browse/Revisit, inline-preview stop on the sketch page (focus-gated). Back can never exit the app (`resolveBrowseRootBackAction` is unit-tested).
- List: Reanimated `FlatList`, `getItemLayout` from exact measured geometry, stable `idea:<id>` keys, `initialNumToRender 6`, `windowSize 7` (1 while scrubbing), `removeClippedSubviews`; rows memoised; each row reads its idea through a WeakMap index keyed on the `workspaces` array (O(1), src/state/librarySelectors.ts); one Skia canvas per mounted card with a hairline fallback while scrubbing; inline-player state subscribed only by the active row. At 500 ideas / 2000 clips the per-write cost is O(collection) in the model (finding 13), not O(library).
- Selection after deletion: runtimeCleanup.ts:141 prunes `selectedListIdeaIds`; the bar hides and `cancelListSelection` fires on blur.
- Cross-workspace Copy/Move via the clipboard (actions.ts `pasteClipboardToCollection`) relocates ideas, activity events and playlist items correctly when the source workspace is right (finding 1 is the one wrong case).
- PDF/HTML export: `escapeHtml` (chords.ts:263-268, chordSheet.ts:216-218) escapes `& < >` and every user string lands in element content only (title, subtitle, lyric lines, section labels, notes, text blocks); no attribute or script context; `dir="auto"` is static. Safe.
- Transpose: spelling family preserved, idiomatic defaults, "C6/9" keeps its tail, lowercase roots rejected, non-chord text passes through; capo = shapes `transpose − capo` wrapped at −12; persisted offsets sanitised.
- Modals: `QuickNameModal` disables Save while `saving`; `WarmModal` wraps a `KeyboardAvoidingView`; `BottomSheet` tracks the keyboard; `ClipNotesSheet` saves on dismiss when edited; `ActionMenuHost` defers `onDismiss` with `queueMicrotask` so a chosen row wins over the close.
- Export builders (setlist/songbook/playlist) strip lineage, remap ids, fall back to the primary take — mutually consistent.
- Dev surfaces (`SyncProbe`, dev-sample imports, `REVISIT_PREVIEW_ALL`) are behind `__DEV__`.

---

## FEATURE INVENTORY (what a user can do in this scope)

**Side menu (drawer / overlay)** → Search · Workspace card (name, Collections · n, two Recent collections) · Compilations · Received (unopened badge) · Lyric Pad · Shelf (decision badge) · Revisit · Activity · tool tray (Lyric Spark, Tuner, Metronome) · Settings.

**Workspaces page** → sort (last worked / least recent / A–Z / Z–A) · tap = open hub (received packages open on Received) · card ⋯ = edit (name, description, hue, avatar), share as file, SongNook Send link, archive/unarchive, move a package, delete permanently · create workspace.

**Workspace hub (Browse)** → collection cards (long-press = selection) · selection dock: move/copy to another workspace or parent, share, delete (with nested scope) · create collection · import audio into a new collection · picker footer while a compilation is collecting (Add / ✕ returns to the compilation).

**Collection page** → collapsing identity (title, idea count, last edited, description, Send-link chip, "Keep this package…" on received) · up-link to parent/hub · search (title/lyrics/notes snippets) · filter (all/clips/sketches/bookmarked, stage, lyrics with/without, clip tags) · sort (created/updated/title/length/progress, direction) with day dividers, day collapse, one-off hide, "show all hidden" · compact/comfortable density · fast-scroll scrubber with day/letter readout · nested collections (expand, open, rename/copy/move/delete) · ⋯: play all, new sketch, import, compact view, view activity, share, delete package (received) · record FAB · card: play lead (inline preview with scrub strip), open (clip → player, sketch → sketch page), long-press = selection · selection dock: New sketch, Play/Queue, Hide/Unhide, Delete (undo toast), More → Edit, Bookmark, Set aside (Shelf), Tag clips, Copy / Move / Add to playlist, Share → audio / export whole / SongNook Send (whole or audio) · paste banner (copy/move here, duplicate guard) · activity-range banner (clear) · "view in collection" landing flashes the card.

**Sketch page (IdeaDetail)** → tabs Takes / Lyrics / Chart / Notes · header ⋯: play all, make song, import, view in collection, share, delete (keep takes / delete all) · takes list (timeline / evolution threads), take selection bar (play, share, copy/move, thread: set parent, combine, make root, rename thread, tag, delete) · lyrics versions panel (open, new page, edit latest as new version, delete versions) · chord chart · notes.

**Lyrics version page** → read/edit, save as new version, discard guard, chord editor (palette, picker, zoom), export → PDF (Pro), text/ChordPro share, copy, add to songbook.

**Chord sheet page** → sections (presets / custom / text block), bars (add, split, up/down, rename), chord picker, undo/redo, transpose chip, export PDF/text (Pro).

**Search** → global query over workspaces, collections, ideas (title/lyrics/notes), Lyric Pad notes · match-source filters · per-kind groups (capped) · result → hub, collection, idea's collection (visit, card flash), note.

**Shelf** → set-aside ideas with 7-day stay, 48-h decision window (keep longer / leave), departed list (reshelve), play, open, view in collection.

**Revisit** → daily sections (Pick up, Forgotten, Vault, Around this time snapshot) · reasons · hide / snooze / set aside · customise (tags, daily refresh, source workspaces & collections) · open / view in collection / view activity around a date.

**Activity** → year heatmap, day/range selection, month markers, Today · scope: global with source filters or a collection (pushed) · range results (capped 60): play, open, view in collection, ⋯ set aside / view shelf.

**Compilations** → Playlists (create, rename, delete, reorder, remove, play/shuffle, collect from the library, share file / SongNook Send, view in collection per track) · Songbooks (create, add charts via collector, reader with lyrics/chord views, zoom, chords on/off, transpose & capo per song, metronome at the song's tempo, charts-only export) · Setlists (create, builder per entry: takes/lyrics/chart/notes, setlist song page with lyrics/chart doors, export).

**Received** → packages → visit a package collection, move package into a workspace, delete package.
