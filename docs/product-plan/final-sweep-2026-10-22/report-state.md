# STATE & PERSISTENCE audit — SongNook (main @ b4a7268)

Scope: `src/state/**`, `src/state/db/**`, `services/{manifestSync,manifestFreshness,managedMedia,stateIntegrity,integrityScanner,persistLog,satelliteSnapshot}.ts`, `src/types.ts`, `App.tsx` startup/hydration. Read-only; every claim below was traced from the file, and selector claims come from a full-AST-free scan (`scratchpad/selscan.py`, brace-balanced extraction of all 415 `useStore(` selectors in `src/` + `App.tsx`).

Counts: **P0 0 · P1 0 · P2 3 · P3 9**. Nothing in this scope blocks submission. The persistence stack (sharded SQLite + guarded storage + manifest shadow + trash + un-trash sweep) is in good shape; the real findings are one safety net that is silently inert, one perf-audit item that never landed, and one launch sweep that scales with the library.

---

## Findings

### P2-1 · The "catastrophic partial loss" persist guard is dead code — `high`
`src/state/useStore.ts:494-506` (`partialize`), `:386-401` (guard), `src/services/manifestSync.ts:155-168` (mirror).
zustand's persist middleware calls `partialize({...get()})` synchronously inside every `set()` and only then hands the value to `storage.setItem` (`node_modules/zustand/esm/middleware.mjs:356-366`). `partialize` (useStore.ts:497-505) writes the **new** in-memory idea count into `setLastPersistedIdeaCount` whenever it is > 0. When the debounced `runGuardedWrite` fires, `lastCount` (:380) is already the new count, so `lost = lastCount - newIdeaCount` (:388) is always 0 and the `lost >= GUARD_MIN_ABS_DROP` branch (:390) can never fire. The manifest guard (manifestSync.ts:156-160) reads the same counter and is dead for the same reason. Only the `newIdeaCount === 0` branch (:368) is live.
Concrete: a logic bug that drops 200 of 300 ideas in one `set()` persists unchallenged (and reaches the manifest within ≤45 s). `docs/data-loss-hardening-verification.md` ("Corruption guard") says this drop "should be blocked"; no test exercises it (`grep` of `__tests__` for the guard: none).
Fix: delete the counter update in `partialize` (:497-505) — the counter is seeded on hydrate (:528) and advanced at :406 after the guard passes; add a unit test for the 40 %/10-idea drop. Not tagged SMALL-WIN on purpose: it arms a gate that has never run on a device (a false lock shows the "saving paused" banner for the session), so give it one device pass.

### P2-2 · Perf-audit rec. A ("move playback position out of the main store") did not land; half its cost is gone, the other half remains — `high`
`src/state/playerSlice.ts:98-112, 315-329`; writers `src/hooks/useFullPlayer.ts:316-351`, `src/hooks/useInlinePlayer.ts:287-293`, `src/components/PlayerScreen/hooks/usePlayerPracticePitchTransport.ts:166`.
Cadence today: the full player publishes when ≥150 ms elapsed or the position moved ≥250 ms (≤ ~6.7 Hz); the inline preview commits once per displayed second (`useThrottledAudioPlayerStatus.ts:74-81`), so "10 Hz" from the audit is now ~7 Hz + 1 Hz.
What the persist middleware does per write today: spread the whole store (`{...get()}`), `buildPersistedAppStoreSnapshot` (50 field picks, `persistedSnapshot.ts:14`), then the reference change detector (`persistChangeDetection.ts`) returns `false` at `useStore.ts:424` **before** anything is scheduled — serializer, debounce and SQLite are untouched. The manifest subscriber does the same (`manifestSync.ts:343-347`). So the audit's "reschedules the persist debounce / runs the manifest snapshot" is fixed. What remains: every tick is a full store notification, i.e. every mounted `useStore` selector runs (415 call sites; a collection list runs ~12 selectors per visible row, `IdeaListItem.tsx:90-169`), plus 6 module-level `subscribe` listeners. Only `GlobalMediaDock.tsx:80` reads `playerPositionMs`; three card components read `inlinePositionMs` gated by `inlineActive`.
Fix (medium, post-launch): a separate non-persisted `usePlaybackClockStore` for `positionMs/durationMs` (inline + full); keep `isPlaying`/target in the main store. Nothing to do before submission.

### P2-3 · Launch trash sweep stats every referenced file, one awaited native call at a time, for 14 days after any delete — `med-high` [SMALL-WIN]
`src/services/managedMedia.ts:218-233`; awaited at `App.tsx:1276` ahead of purge, archive resume, picker sweep, metadata backfill, draft recovery, the degraded/newer-manifest prompts and the recording-recovery prompt (`:1418`).
`restoreReferencedFilesFromTrash` returns early only when the trash dir is empty. After any delete (purge runs *after* it at `:1278`, retention 14 days) it loops `for (const uri of collectReferencedManagedUris(workspaces)) await getInfoAsync(uri)` — one bridge round-trip per take, source, mix and layer in the library. At ~1 000 files that is ~1 000 sequential native calls on every launch for two weeks (seconds on Android; not measured on device). `planTrashRestores` (`domain/trashRestore.ts:34-54`) matches by **basename**, so only referenced files whose basename is in the trash listing can ever be restored.
Fix (~10 lines): read `trashNames`, build the basename set, and stat only referenced URIs whose basename is in it (O(trash) stats instead of O(library)); or at least `Promise.all` in chunks of ~32.

### P3-4 · `consumeIntentionalEmptyStateWrite` does not consume — `high` [SMALL-WIN]
`src/services/stateIntegrity.ts:9-21`. `authorizeIntentionalEmptyStateWrite(_steps)` opens a 60 s window; `consume…` returns true for every call inside it without clearing, and `_steps` is ignored at all 7 call sites (`authorize…(6)`). Impact is low today (P2-1 makes the drop guard moot; the 0-ideas case is the legitimate one), but the name promises one-shot semantics. Make it a counter decremented per consume, or rename.

### P3-5 · `classicReel` is a dead persisted field with three dead reader branches — `high`
`useStore.ts:254` forces `classicReel: false` on every hydrate; `dataSlice.ts:1782 setClassicReel` has no caller; `persistedSnapshot.ts:46` / `storeTypes.ts:41` still persist it in the meta row on every write; readers `AudioReel.tsx:509`, `EditorScreen/index.tsx:303`, `PlayerTimeline.tsx:405` are constant-false, so their "classic" branches are unreachable (size of those branches not measured — outside scope). Remove field, setter, persisted key and reader branches. No `STORE_VERSION` bump needed: `sanitizePersistedState` ignores unknown keys.

### P3-6 · Dead exports / unused table — `high` [SMALL-WIN]
- `src/state/db/database.ts:50-55` creates `media_inventory` on every boot; nothing reads or writes it (grep: 0 refs). The file's docstring (:6) promises it to the integrity scanner, which lists the filesystem instead (`integrityScanner.ts:150`). Drop the DDL + comment. (`migration_journal` is written by the empty migration runner; keep.)
- `persistRuntime.ts`: `isPersistFailing`, `onPersistFailingChange` (only `persistFailureSignal.test.ts`), `getHydrationReadOutcome` (0 refs).
- `persistLog.ts: getPersistLogPath` (0 refs); `managedMedia.ts: MAX_IN_MEMORY_ARCHIVE_BYTES` (0 refs).
- `storage.ts` / `storage.ts` docstring (:10-18) still describes `createJSONStorage` + "redundant writes skipped by serialized compare" — the adapter is the sharded one now; stale comment.

### P3-7 · Word-lookup cache writes on the shared SQLite connection outside the persist queue — `med`
`src/services/wordLookupCache.ts:41-66` runs `runAsync` directly on `getDb()`. expo-sqlite's `withTransactionAsync` (used at `storage.ts:240, :473`) folds statements issued concurrently on the same connection into the open transaction. A Datamuse response landing during a library commit (a) is rolled back with a failed commit (harmless) and (b) its eviction `DELETE … NOT IN (SELECT … LIMIT 5000)` (every 100 inserts) runs inside the library transaction, lengthening it toward the 10 s `SQLITE_CALL_TIMEOUT_MS` (`storage.ts:53`). Fix: route the cache through `enqueueWrite`, or switch the library commit to `withExclusiveTransactionAsync`.

### P3-8 · Timed-out transaction can poison the next `BEGIN` — `low`, unverified on device
`storage.ts:46-56, :473`. If a transaction passes the 10 s deadline but is still running natively, the queue moves on and the next `withTransactionAsync` fails ("cannot start a transaction within a transaction") → fallback path until the native call completes. Only on a wedged disk; the fallback + marker replay keeps the data. Note only.

### P3-9 · Selector audit D (per-row `.includes`) still open — `high` [SMALL-WIN]
`IdeaListItem.tsx:169` (`selectedListIdeaIds.includes(ideaId)` / `picks.some`), `ClipCard.tsx:142`, `EvolutionThread.tsx:60` (`selectedClipIds.includes(clip.id)`): O(selection) per row per store notification; 200 rows selected × 200 mounted rows = 40 k compares per `set()`, including the playback ticks of P2-2. Same family: `selectAnySketch` (`PlayerArtifactDoors.tsx:406-410`, used at `PlayerScreen/index.tsx:381`) walks every idea in the library on every notification while the player is open — including its own ~7 Hz position ticks; cache per `workspaces` identity in the same `WeakMap`. Fix: a `WeakMap<string[], Set<string>>` keyed by the array, like `getIdeaIndex` (`librarySelectors.ts:43`).

### P3-10 · 23 screen-model hooks + the drawer subscribe to the whole `workspaces` array (audit B) — `med`
List from `grep "useStore((s) => s.workspaces)"`: `useCollectionScreenModel.ts:55`, `useLibraryScreenModel.ts`, `useActivityScreenModel.ts`, `useRevisitScreenModel.ts`, `useSearchScreenModel.ts`, `EditorScreen/index.tsx`, … and `App.tsx:577-581` (drawer content, which also runs `countReceivedPackages(s.workspaces)` per `set()`; O(workspaces), cheap). Each mounted one re-derives on every library write. Fine for one screen; adds up on a deep stack. Post-launch.

### P3-11 · Double sanitize on the one boot after a `STORE_VERSION` bump — `high`
`useStore.ts:490-516`: zustand runs `migrate` (→ `sanitizePersistedState`) and then `merge` (→ `sanitizePersistedState` again), each doing `normalizeWorkspaces` + `rebaseWorkspacesManagedMedia` over the library; then the middleware writes the migrated state straight back (before `hydrationComplete`, so the guard is skipped — correct, and the write-authority gate has already seen the read). One-time cost, correct behaviour. Could make `merge` reuse the migrated result; not worth doing now.

### P3-12 · `PersistFailureBanner` uses font/size literals instead of tokens — `med`
`src/components/PersistFailureBanner.tsx:88-100` (`fontFamily: "PlusJakartaSans_600SemiBold"`, sizes 13/11). CLAUDE.md: tokens only. Repo-wide there are 319 such literals, so this is general debt, not a banner bug.

---

## Answers to the brief's questions

### 1. Data-loss risk in store write paths
**No path found that drops clips/takes/layers, or trashes a file a clip still uses, without a user choice.** Every media-trashing path follows the same three-part discipline: (a) the metadata write is made durable with a *strict* flush that rejects when it did not land in SQLite (`persistedSnapshot.ts:78-115` → `shardedPersistStorage.ts:372-404` → `commitShardedWrite({strict})`, `storage.ts:520-545`), (b) the file list is filtered against the **post-write** library (`filterUnreferencedManagedAudioUris`, `managedMedia.ts:112-120`) so a copied clip sharing a file keeps it, (c) deletion is a move to the 14-day trash, and boot un-trashes anything the library still points at (`restoreReferencedFilesFromTrash`) before purging.

Callers traced:
- `mediaCleanup.trashFilesOfDroppedClips` ← `actions.ts:1698` (Combine → replace), `useEditorExportFlow.ts:300, 360` (Editor → replace). `trashFilesNoLongerUsed` ← `CollectionFloatingActions.tsx:322` (multi-delete; fires on undo expiry *or* unmount, `useCollectionSelection.ts:15-23`, so an app kill inside the 5 s undo window leaves orphans, not loss).
- Direct `deleteManagedAudioUris` after a durable flush: `dataSlice.ts:2052` (collection delete), `:2755` (workspace delete), `:3390` (idea delete), `actions.ts:2248` (selected clips), `:2326` (one clip), `:3064` (selected ideas), `:1557` (remove layer), `:1655` (merge layers), `:319/:341` (overdub mix re-render, after a grace timer), `:3147` (archive: `persistBeforeFileMoves` + a pending-op journal replayed at boot, `workspaceArchiveRecovery.ts:95-110`).
- `useRecording.ts:1015, 1054, 1115` delete only the redundant managed copy of a take that is kept as recorder temp + pending-session marker (recoverable next launch).
- `deleteSelectedClips` / `deleteClipFromIdea` repair dangling parents and reassign primary; neither drops versions the user did not pick (`actions.ts:2170-2200`).
- `recoverStrandedDrafts` (`domain/draftRecovery.ts:36-60`) removes only drafts with **zero** clips.
Two cosmetic inconsistencies: `dataSlice` uses `persistAppStoreSnapshot(get())` while `actions` use `flushPersistedSnapshot()` — the latter also removes/re-arms the pending passive write. No ordering hazard either way: the scheduler always holds the *latest* snapshot (`passivePersistScheduler.ts:48-62`), so a stale write cannot overwrite a newer one. The soft spot is P2-1: a non-user-chosen drop is not caught by the guard that claims to catch it.

### 2. Perf-audit 10 Hz position writes
See P2-2. Persist/SQLite/manifest are fully insulated by the change detector; the remaining cost is selector fan-out on every tick (~7 Hz full player, ~1 Hz inline).

### 3. Zustand selector hygiene
**Clean.** The scan found **0** selectors returning a fresh array/object without `useShallow`. Two `useShallow` sites (`GlobalMediaDock.tsx:242`, `SideMenuButton.tsx:24`) return objects correctly; `SideNav.tsx:121` and `IdeaListScreen/index.tsx:7` return primitives (joined string / colour); `selectAnySketch` (`PlayerArtifactDoors.tsx:406`) returns a boolean; `GlobalMediaDock.tsx:122` returns the idea object by identity (stable across unrelated writes, `librarySelectors.ts:9-13`); `PlayerScreen/index.tsx` has 6 selectors, all primitives/actions. Hot-path row selectors go through the per-library `WeakMap` index (`selectIdeaById`). Remaining debt is O(n)-in-selector work (P3-9) and whole-array subscriptions (P3-10), not identity churn.

### 4. Startup cost
Synchronous before first paint: module import → `create(persist(...))` starts auto-hydrate → first `getDb()` = `openDatabaseSync` + DDL `execSync` (sync native, once) → `replayPendingFallbackWrites` (one AsyncStorage read) → meta row → `readManyKv` (one `SELECT … IN`) → `JSON.parse` per shard (sync, O(bytes)) → `merge` → `sanitizePersistedState` (`normalizeWorkspaces` copies every idea/clip, `rebaseWorkspacesManagedMedia` is allocation-free when nothing moves; `normalizeActivityEvents` ≤ 2 000) → `set` → `startManifestSync` (snapshot + one stat + one `MAX(updated_at)`; no stringify unless stale). The splash is held until fonts + hydration + nav restore (`App.tsx:162-166, 920-925`), and `AppContent` is not mounted until `hasHydrated` (`:1549-1566`). The parse + sanitize of the whole library is inherent to the monolithic in-memory model; `persistLog("hydrate.ok", {ms})` records it per boot.
After first paint, one effect (`App.tsx:1265-1430`) runs sequential awaits: share-temp sweep, DR temp cleanup, **trash un-restore (P2-3, O(files) when trash non-empty)**, purge, archive resume, picker sweep, `enqueueMissingMetadataBackfill` (sync O(clips), cheap), `recoverStrandedDrafts` (O(ideas), no-op copy-free), empty-library check (`readManifest` only when empty), degraded-workspace prompt, `detectNewerManifest` (stat + SQL; parses the manifest only when ≥60 s newer), recording recovery. No other O(library) work on every launch.

### 5. Persistence failure handling, SQLite transactions, migrations
- **Banner**: `PersistFailureBanner` subscribes via `useSyncExternalStore` to a 4-state health signal (`persistRuntime.ts:96-170`): 3 consecutive dual-store failures → "can't save"; 3 consecutive fallback-only writes → "backup mode"; any gate refusal (guard lock, write authority) → sticky "saving paused" until restore/wipe. Fires `haptic.error()` once per appearance. Correct.
- **Hydration failure**: `onRehydrateStorage` reports the error through `onHydrationResult` (replayed to late subscribers); `App` retries ×3 with backoff then shows a retry `EmptyState`; writes stay gated (`readOutcome !== "data"` → `verifyWriteAuthority`) so an unread disk is never overwritten. Degraded shards are quarantined outside the sweep prefix and the user is told.
- **Transactions**: `commitShardedWrite` writes meta + activity + dirty workspace rows and deletes in one `withTransactionAsync`; strict mode rethrows on SQLite failure; the AsyncStorage fallback is non-atomic by design but journaled in `FALLBACK_MARKER_KEY`, replayed before the boot read and after the next healthy commit, and superseded rows are forgotten (`forgetSupersededFallbackRows`) so a stale parked row can no longer rewind a newer write. The write queue serializes all library writes; reads are unqueued (fine) and one foreign writer exists (P3-7).
- **Migrations**: schema v1, `MIGRATIONS` empty; the runner snapshots via `VACUUM INTO`, runs each migration in its own transaction, and a throw leaves `db` null so callers fall back to AsyncStorage. Store-level `STORE_VERSION = 12` with `migrate = sanitize` (tolerant of any older shape; see P3-11 for the double pass). Satellite stores all persist via `createJSONStorage(AsyncStorage)` with `merge` sanitizers (`useChartPrefsStore`, `useLayerPrefsStore`, `useReceivedPrefsStore` also have `migrate`). `persistRestoredAppStoreSnapshot` writes a legacy blob which the next write re-shards; the first-write orphan sweep is protected by the write-authority gate. Sound.

---

## Feature inventory (user-visible, this scope)
- Boot → "Restore your library?" (store empty, shadow manifest has ideas) → Not now / Restore (`App.tsx:1296-1361`)
- Boot → "A workspace was set aside" notice when a shard row is corrupt/missing (quarantined, not deleted)
- Boot → "Newer copy found" (manifest ≥60 s newer with work the store lacks) → Keep / Restore
- Boot → "Take recovered" / "Take was empty" / "Recovery failed" notices for an interrupted recording
- Boot → silent un-trash of any file the library still references, then 14-day trash purge
- Anywhere → persistence health bar above the dock: can't save / backup mode / saving paused
- Delete clip / idea / collection / workspace, replace via Editor or Combine, remove or merge layers → files go to a 14-day trash, only after the library write is durable
- Collection multi-delete → 5 s Undo toast (files trashed on expiry)
- Settings → Storage → integrity check (duplicate ids, broken lineage, missing/orphan files)
- Settings → About → share the on-device persist log
- Backup reminder prompt by chosen frequency; exact backup includes the satellite stores (Shelf, chart transposition, Revisit/Activity filters, sent links, Step-Up presets, Magpie prefs) and UI language
- Disaster-recovery restore → restart gate screen
- Background: library mirrored to a shadow manifest (15 s debounce / 45 s cap, immediate on background)
