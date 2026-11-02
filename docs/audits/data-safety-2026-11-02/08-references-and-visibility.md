# 08 — References between records, and content that becomes invisible (second pass)

Second pass of the 2026-11-02 data-safety audit. It covers every cross-reference by id in the
library, the actions that can break one, and the ways a clip, sketch or collection can still
exist and yet be impossible to find. Findings already in 01–06 are not repeated. Where one of
them gains new evidence, that is said in a line.

**How it was checked.** I read the code. Where a finding says *verified by scratch test*, I also
ran the real store, normalizer and domain code under Jest in a throwaway
`src/__audit_scratch2__/`, which I deleted afterwards. Nothing was walked in the simulator.

Severity key: CRITICAL = realistic silent loss or app made unusable · HIGH = loss or vanishing
in a plausible path · MEDIUM = needs corrupt or hostile input, or a misleading surface · LOW.

**Summary.** No CRITICAL. Two HIGHs are ordinary-use paths:

- R1: a take recorded from a collection page lands in a different workspace and vanishes.
- R2: one move-out sequence gives a clip and a sketch the same id, and deleting the clip then
  deletes the sketch.

The rest need imported, restored or hostile data. Hydration never repairs a broken reference,
but it never deletes over one either.

---

## Reference map (what points at what, by id)

| Reference | Held on | Breaks when | Repaired by |
|---|---|---|---|
| `idea.collectionId` → Collection (same workspace) | SongIdea | R1, R4, R5 | nothing (only an empty string falls back, `dataSlice.ts:1395`) |
| `collection.parentCollectionId` → Collection | Collection | cycle via import (R3); a dangling parent via import is mapped to top level | import maps a missing parent to `null` (`libraryImport.ts:605-607`); hydration does nothing |
| `clip.parentClipId` → clip in same idea | ClipVersion | cycle via import (R3) | `buildClipGraph` treats a dangling parent as a root (`clipGraph.ts:103`); a cycle is not treated |
| `isPrimary` (exactly one) | ClipVersion | merge, moves | `ensurePrimaryClip`, merge strips extra primaries; hydration fixes the 1-clip case only (`dataSlice.ts:1054`) |
| `clipGroupAssignments` root → group | SongIdea | re-parenting | `normalizeClipGroupAssignments` drops stale keys (the take stays visible) |
| `lyricsVersionId`, songbook `versionId` | clip, SongbookItem | version delete | reader falls back to latest (04 solid) |
| setlist/songbook/playlist `{workspaceId, ideaId, clipId}` | compilations | cross-workspace move (04 H1), re-id (04 M5) | `pruneCompilationEntries` on delete; playlists relocated, setlists/songbooks not |
| Activity `{workspaceId, collectionId, ideaId, clipId}` | activityEvents (cap 2000) | moves | `relocateActivityEvents` on most moves |
| Shelf / Revisit / ChartPrefs / SentLinks → ideaId | satellite stores | re-id, delete | readers skip what doesn't resolve (pointers only) |
| `hiddenIdeaIds`, `hiddenDays` | Collection.ideasListState | membership change | normalized to existing ideas on every write |
| `recordingIdeaId`, player queue, inline target, clipboard, selection | runtime | delete | `buildRuntimeCleanupPatch` (`runtimeCleanup.ts:153`) |
| `activeWorkspaceId` / `primaryWorkspaceId` / `primaryCollectionIdByWorkspace` / last-opened maps | store | delete | sanitized at hydration (`useStore.ts:133-171`); startup collection re-checked (`App.tsx:805-811`) |
| Spark `savedLyricId`, Cut-Up `sourceSongId/sourceLyricVersionId` | sparks | note/song delete | informational only |

---

## HIGH

### R1. A take recorded (or a sketch started) from a collection page in one workspace is saved into another, and vanishes
**Confidence: verified by scratch test at store level. The UI path comes from reading the navigation code.**

- **Where:**
  - `dataSlice.ts:3060-3077` `quickRecordIdea` and `:3038-3057` `addIdea` call `get().updateIdeas(...)` without a `workspaceId`.
  - `updateIdeas` then writes to `options?.workspaceId ?? activeWorkspaceId` (`dataSlice.ts:2958`).
  - Callers pass the page's collection: `CollectionFloatingActions.tsx:530` (`appActions.quickRecordIdea(screen.collectionId!)`, the record FAB) and `CollectionHeaderMenu.tsx:82` (`appActions.addIdea(screen.collectionId!)`, New sketch).
- **Why the page and the store disagree:**
  - The collection page takes its workspace from the route or the collection (`useCollectionScreenModel.ts:57-69`), not from the store.
  - Search, Activity, Revisit, Shelf, Library and the player queue all call `setActiveWorkspaceId(other)` before they push (for example `QueuePanel.tsx:268-270` and `useSearchScreenModel.ts:110-111`).
  - When the person comes back, the Home stack's collection page is still showing the old workspace.
- **Steps:**
  1. In "Band" › Ideas, open Search (or the player queue) and open a result from "Solo".
  2. Go back to Band › Ideas.
  3. Tap Record and save the take.
- **What happens:**
  - The idea is written into **Solo** with `collectionId` = Band's Ideas, a collection Solo doesn't have.
  - The recorder's destination label resolves to null (`collectionManagement.ts:107-110`), and with no override nothing relocates it (`useRecordingScreenModel.ts:1697-1710`).
  - The take is in neither collection.
  - Probe: `[{"ws":"w1","ideas":[]},{"ws":"w2","ideas":["c1"]}]`, the same for `addIdea`. After `sanitizePersistedState` it is still `["c1","c1"]`: no repair.
  - The audio is referenced, so it is never trashed. But the take can only be found through Search or Activity, and opening it shows a header-less page that lists it.
- **Fix:**
  - Make `quickRecordIdea`/`addIdea` resolve the workspace from `collectionId` (`findWorkspaceWithCollection`) and pass it to `updateIdeas`.
  - Also add the hydration re-home in R5.

### R2. Move a take out, Make sketch, then move that take out again: two ideas share an id, and deleting the clip deletes the sketch
**Confidence: verified by scratch test.**

- **Where:**
  - `actions.ts:593`: `createStandaloneClipIdeaFromMove` gives the new idea the **clip's** id (`id: clip.id`).
  - `actions.ts:2391-2400`: `convertClipIdeaToProject` keeps the idea id *and* its clip, so the sketch's id equals the id of its first take.
- **Steps (each one ordinary):**
  1. In sketch S, move take A out to the collection. This makes idea `A` with clip `A`.
  2. Make sketch from it and save. This makes sketch `A` holding clip `A`.
  3. Record or move another take into sketch A.
  4. Move take A out of sketch A to a collection. This makes a second idea `A`.
- **Probe:** `["A:clip:A","A:project:B","S:project:"]`. Then `deleteIdea("A")` on the loose clip gives `["S:project"]`: **the sketch, its lyrics and its other takes are gone too**.
  - `deleteIdea` filters by id (`dataSlice.ts:3356`), and so does multi-delete.
  - One of the two ideas' files is then trashed. Multi-delete trashes both when its undo expires.
- **Before any delete:**
  - `getIdeaIndex` disagrees with itself: in `all` the first idea wins, in `byWorkspace` the last one wins (`librarySelectors.ts:55-56`).
  - The list renders two `idea:A` keys, and opening "A" reaches only one of the two. The other is effectively invisible (plausible).
  - Every by-id edit (`updateIdeaInState`, `findIndex`) lands on the first one only.
- **Fix:**
  - Give moved-out clips a fresh `buildIdeaId()` (relocate activity and playlists with it, as now).
  - In `normalizeWorkspaces`, re-id any duplicate idea, collection or clip id at hydration. The integrity scanner already detects these (`integrityScanner.ts:38-62`), but nothing acts on them.

---

## MEDIUM

### R3. Imported or received data can carry a collection-parent cycle or a take-lineage cycle: the app freezes or takes disappear
**Confidence: verified by scratch test (the walkers); the import path is verified by reading.**

- **Import keeps cycles as given:**
  - `libraryImport.ts:604-607` maps `parentCollectionId` through `collectionIdMap`, so A→B→A stays a cycle.
  - `libraryImport.ts:324` does the same for `parentClipId`.
  - Neither import validation nor `normalizeWorkspaces` checks for cycles.
  - SongNook's own moves are guarded (see Solid). This needs a corrupt or hostile `.songnook`, a Send parcel, or a corrupt backup. It extends 06 #4.
- **Collections:**
  - `getCollectionAncestors` (`utils.ts:495`) has no visited set: `while (current?.parentCollectionId) { … ancestors.unshift(parent); current = parent; }`.
  - Probe with a find-counter tripwire: `RUNAWAY: getCollectionAncestors never terminates` for both a 2-cycle and a self-parent.
  - It runs over **every** collection in `buildRevisitModel` (`revisit.ts:655-668`) and the Activity scope list (`useActivityScreenModel.ts:181-190`). It also runs per matching result in Search (`search.ts:138, 143`).
  - Opening Revisit or Activity therefore spins the JS thread forever, growing an array until the app is killed. This happens every time, until Erase.
  - Cyclic collections are never top level, so Browse never shows them, nor the ideas inside them.
- **Takes:**
  - `buildClipGraph` puts a cycle's members under each other, so they are never roots.
  - Probe: `C visible ["r"]`. Takes `x↔y` and `self` are missing from the sketch, and `normalizeClipGroupAssignments` drops their groups too.
- **Keep on such a parcel:**
  - `adoptReceivedPackageInto` moves only top-level collections, then calls `deleteWorkspace(pkg)` (`dataSlice.ts:2657-2679`).
  - Probe: `{"ok":true,"workspaces":[{"ws":"mine","ideas":["ok"]}]}`. The "trapped" idea (cyclic collection) and the "stray" idea (missing collection) are deleted, with their audio.
- **Fix:**
  - In `normalizeWorkspaces`, break collection cycles: walk with a visited set and cut at the repeat, set to `null`. Re-home ideas (R5). Break `parentClipId` cycles the same way.
  - Give `getCollectionAncestors` a visited guard, like `getCollectionDescendantIds` already has.
  - In `adoptReceivedPackageInto`, refuse (or re-home) when ideas would stay behind.

### R4. Merge restore can bring a lost idea back into a collection that has since moved workspace, where it stays invisible
**Confidence: verified by scratch test.**

- **Where:**
  - `libraryMergeRestore.ts:129-135` and `:138-162`.
  - Restored-only collections that exist anywhere now are filtered out (correctly, so there are no duplicates).
  - But a restored-only idea keeps its old `collectionId` and lands in its old workspace.
- **Steps (A):**
  1. Back up.
  2. Delete a clip.
  3. Move its collection to another workspace.
  4. Merge-restore to get the clip back.
- **Probe (A):** `{"ws":"w1","cols":["home"],"ideas":["lost@C"]}`. The idea is back, and invisible, which is exactly the thing the person restored for.
- **Steps (B), which needs nothing exotic:**
  1. Keep a received parcel into "mine".
  2. Delete one of its songs.
  3. Merge-restore a backup from before the Keep.
- **Probe (B):** `{"ws":"pkg","origin":"received","cols":["Inbox#col-"],"ideas":["song2@pc"]}`.
  - The package comes back with an empty Inbox. `normalizeWorkspaces` creates "Inbox" for a workspace with no collections (`:1377-1380`), but only re-homes ideas whose `collectionId` is empty (`:1395`).
  - Keeping that package again deletes song2 a second time (R3's Keep path).
- **Fix:** after the merge, put any idea whose collection isn't in its workspace into the collection's new home if it moved, or into a "Restored" collection. This is the same pass as R5.

### R5. Nothing anywhere repairs or reports an idea whose collection doesn't exist
**Confidence: verified by scratch test.**

- **Probe:** `sanitizePersistedState` keeps `i1@nowhere`, `i2@orph` (a collection whose parent is `gone`) and the cycle. It neither deletes nor re-homes them.
- **The good part:** hydration never deletes over a broken reference.
- **The bad part:** R1, R3 and R4 all end in content that is kept forever, backed up forever, and reachable only by searching.
- **The integrity scanner** (`integrityScanner.ts`) checks lineage, groups, primaries and playlists. It does not check `idea.collectionId`, collection parents, collection cycles, setlists or songbooks.
- **Fix:**
  - One hydration pass in `normalizeWorkspaces`:
    - Ideas with an unknown `collectionId` go to a visible "Recovered" collection (created on demand).
    - A collection with an unknown parent goes to top level.
    - Cycles are cut.
    - Duplicate ids get a new id.
  - Log each repair with `persistLog`.
  - Teach the scanner these checks.

### R6. A persisted filter makes a full collection say "Nothing here yet"
**Confidence: verified by reading.**

- **The filters are global and persisted:**
  - `ideasFilter` and `ideasTagFilter` (`useStore.ts:291-295`) apply to every collection and survive restarts.
  - Any tag filter hides **every sketch** (`ideaTags.ts:24`: `if (idea.kind !== "clip") return false`).
- **The wrong empty state:** when filters empty the list and there is no search text, the empty state is the brand-new-collection one: "Nothing here yet · Recorded clips land here." (`IdeaListContent.tsx:264-279`).
- **The cue is small:** the only signal is the filled funnel glyph.
- **Steps:**
  1. Tap Bookmarked in one collection.
  2. Days later, open another collection.
  3. It reads as empty.
- **Also:** "View in collection" peels back search, stage, lyrics and kind filters, but not the tag filter (`CollectionListSection.tsx:79-94`). A sketch opened from Search or Activity under a tag filter is silently not shown or highlighted.
- **Fix:** when `ideas.length > 0` but the list is empty, show "Filtered out · N ideas", with Clear filters as its one action. Also clear `ideasTagFilter` in the focus peel-back.

---

## LOW

- **L1. Search misses on Unicode form and accents.**
  - Every matcher is `toLowerCase().indexOf/includes`: `search.ts:62, 157`; `ideaSearchMeta.ts:22-32`; `compilationSearch.ts:21`.
  - There is no NFC normalization, so a title that arrived from a file name in NFD (common for macOS-made files) is not found even when typed exactly. Node check: `"Canción".toLowerCase().includes("canción") → false`.
  - There is no accent or niqqud folding (`corazon` ≠ `corazón`, Hebrew pointed lyrics vs unpointed query). Spanish, German and Portuguese ship today.
  - Lyrics match line by line, so a phrase across a line break never matches.
  - A collection's own search ignores take titles and sub-collections.
  - **Fix:** fold both sides once with `normalize("NFD").replace(/\p{M}/gu, "")` plus NFC, inside the existing `prepared()` cache.
- **L2. The undo snapshots that restore whole arrays can resurrect a moved item as a duplicate id:**
  - Branch undo (`SelectionBars.tsx:216-220`, `clips: previousClips`).
  - Make-sketch undo (04 M6).
  - Either one, run after a move inside the 5 s window, can do it. This adds the duplicate-id consequence to 04 M6.
- **L3. Non-random ids.** `idea-${Date.now()}` (`dataSlice.ts:3039, 3061`; the gather at `CollectionFloatingActions.tsx:380`) and `clip-${Date.now()}` (`dataSlice.ts:3098`, recorder `useRecordingScreenModel.ts:463`, branch `SelectionBars.tsx:181`) collide if two land in the same millisecond. Merge-restore treats a collision as "the same item". **Fix:** use `genId` everywhere.
- **L4. Old Activity history is evicted.** `MAX_ACTIVITY_EVENTS = 2000` (`dataSlice.ts:408, 2613`), and every imported clip logs one event. A 2,000-clip import evicts all real history, which empties the heatmap and the Revisit signals. `normalizeActivityEvents` also drops events whose `source` an older bundle doesn't know (01 L3 class).
- **L5. Stale workspace on the cross-workspace recorder move.** `relocateIdeaToCollection` across workspaces (`actions.ts:878-912`) relocates no Activity or playlist rows. It is only used before the activity is logged, so it is harmless today, but it is a trap for the next caller.
- **L6. Activity caps at 60 rows.** The list ends with "N more" (`ActivityRangeResults.tsx:52, 85-120`) and offers no way to see them except narrowing the range.

---

## SOLID (checked)

- **User actions can't build a cycle:**
  - `moveCollection` rejects moving into itself or a descendant, and nesting deeper than two levels (`dataSlice.ts:1897-1920`).
  - Lineage editing excludes the source and its descendants as targets (`useSongParentPicking.ts:52-58`), and its detach walk has a visited guard (`:108-115`).
  - Combine-into-thread only chains the selected clips.
- **Dangling clip parents never hide a take.** `buildClipGraph` roots them (`clipGraph.ts:103`), and every move calls `repairDanglingClipParents`.
- **Descendant walks are guarded:** `getCollectionDescendantIds` (`dataSlice.ts:1207`, `utils.ts:505`), `getCollectionScopeIds`, the save-destination tree (`collectionManagement.ts:76`), and the parcel nesting (`receivedParcel.ts:49`).
- **Merge restore never duplicates an id across workspaces.** It indexes all current ids (`libraryMergeRestore.ts:94-111`, the 2026-10-20 fix holds) and strips a competing primary flag.
- **Import and Send re-id everything,** so they can't overwrite or collide. A missing collection parent becomes top level.
- **Hydration never deletes library content over a broken reference.** It only drops malformed list entries, stale hidden ids and empty stranded drafts. Real drafts are recovered at launch.
- **Runtime references are cleared on every delete:** queue, player, inline, recorder, clipboard and selection (`runtimeCleanup.ts`). The stored primary workspace and collection are validated, and the startup collection is re-checked.
- **Hidden items are always one tap away.** One-off hides count toward "Show all (n)". Collapsed days are labelled markers. Collapsed clip groups keep their header. Older versions fold behind "N older".
- **Received packages are kept out of discovery** but reachable on Received. Global Search shows "N more" when a group is truncated. The Shelf and Revisit never hide items from their collection.
