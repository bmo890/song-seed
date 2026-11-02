# 01 — Persistence core (library store → SQLite → back on launch)

Audit date 2026-11-02, read-only, against `main` @ 13ed9ddd. Scope: `src/state/useStore.ts`,
`persistedSnapshot.ts`, `passivePersistScheduler.ts`, `persistChangeDetection.ts`,
`shardedPersistStorage.ts`, `persistSharding.ts`, `persistRuntime.ts`, `db/storage.ts`,
`db/database.ts`, every `use*Store.ts`, `services/manifestSync.ts`, `stateIntegrity.ts`,
`PersistFailureBanner.tsx`, the App.tsx boot effect, `eraseAllData.ts`, and zustand 5.0.11's
persist middleware (`node_modules/zustand/esm/middleware.mjs:328-472`).

Severity key: CRITICAL = realistic path to silent loss · HIGH = loss in a plausible edge case,
or loss behind a warning · MEDIUM = inconsistency / recoverable / heavy cost · LOW.

I found no CRITICAL path. The 2026-07 and 2026-09 hardening holds where it was aimed. The
weak spots are the **recovery paths themselves**: three boots where the shadow manifest, the
one on-device metadata copy, is skipped or let go.

---

## How the write path works (reference for the findings)

- Every `set()` → zustand calls `storage.setItem` (middleware.mjs:356-372, even before
  hydration). `useStore.ts:422-428` drops it when no persisted field changed by reference,
  or else schedules it.
- Passive write = trailing debounce **800 ms**, max wait **4 s** (`useStore.ts:313,317`). Then
  `runAfterInteractionsWithDeadline` defers it up to **2 s** more while UI is busy
  (`passivePersistScheduler.ts:52-58`, `interactionGate.ts:43`). Worst case in the
  foreground ≈ 6 s plus the SQLite queue.
- When the app leaves `active` (`useStore.ts:444-448`), `passivePersist.flushNow()` starts the
  pending write right away, bypassing the gate. It is not awaited, and nothing asks iOS for
  background execution time.
- The durable flush `flushPersistedSnapshot` (`useStore.ts:563-579`) is used by take save,
  deletes, archive and restore. It is strict: it rejects unless SQLite took the write.
- Storage: one meta row + one row per workspace + an activity row, committed in **one SQLite
  transaction** (`db/storage.ts:447-554`, WAL mode `database.ts:36`). If SQLite fails, the
  rows go to AsyncStorage one key at a time, recorded under a marker, and are replayed on the
  next boot or after the next healthy commit.

---

## HIGH

### H1. A corrupt meta row boots an empty, unsaveable library, with no restore prompt and a manifest that the next edit overwrites
- `shardedPersistStorage.ts:180-189`: an unparseable meta row returns `null` with
  `readOutcome = "failed"`. The comment there says this is done "to let the disaster-recovery
  prompt offer the manifest".
- `App.tsx:1324`: `if (!isHydrationReadAuthoritative()) return;` "failed" is not
  authoritative, so the restore prompt (and the newer-manifest check and recording recovery
  below it) never runs. The comment's intent is dead code.
- `useStore.ts:264-265`: `hasSeenWelcome: ... : state != null`. The state is `undefined`, so
  the welcome intro runs for a returning user, on top of the starter library.
- Every write is refused: `verifyWriteAuthority` returns false for a corrupt meta, forever
  (`shardedPersistStorage.ts:97`). The banner says "Saving is paused · Back up now, then
  restart SongNook". Restarting changes nothing; every session is the same.
- Manifest: `reportPersistBlocked("authority")` sets only the health signal, not the
  `persistBlocked` flag (`persistRuntime.ts:129-132`), so `writeManifestToDisk` is not stopped
  (`manifestSync.ts:112`). The user creates one idea. `runGuardedWrite` advances
  `lastPersistedIdeaCount` to 1 before the refused store write (`useStore.ts:408,416`). The
  manifest's partial-loss guard compares 1 with 1 (`manifestSync.ts:156-163`) and **writes a
  1-idea manifest over the full one**, then deletes `manifest.backup.json` (`:205`).
- Steps → loss: meta row damaged → launch → welcome intro → user records → about 15 s later
  the manifest is gone. The workspace rows are still in SQLite, but no code reads them without
  a meta row. A user who reinstalls loses everything, audio included.
- Confidence: verified by reading. The trigger (meta row damage) is rare, since SQLite writes
  are atomic. There is no App-level test of this path.
- Fix: treat corrupt meta like an empty-with-manifest boot: freeze persist and the manifest
  (`setPersistBlocked(true)`), and offer manifest restore. Better still, rebuild the meta from
  the `::ws::` rows found by a prefix listing. Also make an authority refusal block the
  manifest.

### H2. "Not now", or an accidental dismiss, on "Restore your library?" deletes the recovery copy within about 15 s
- `App.tsx:1347-1353`: `continueWithEmptyLibrary` calls `authorizeIntentionalEmptyStateWrite()`
  (4 steps / 60 s) and then `markFirstLaunch()`. That set() reaches the manifest subscriber.
  `writeManifestToDisk` uses one authorization step and writes an **empty manifest** over the
  one holding N ideas (`manifestSync.ts:128-150`), then deletes the backup copy (`:205`).
- `App.tsx:1375`: `{ onDismiss: continueWithEmptyLibrary }`. An Android back press or a
  scrim tap does the same thing.
- The button reads "Not now", which promises a later chance. Settings → Recover files tries the
  manifest only while the library is still empty (`actions.ts:3245-3249`), and by then the
  manifest is empty anyway.
- Steps → loss: empty boot (the disaster this exists for) → tap outside the dialog → every
  title, lyric, chart, note, collection and setlist is gone. Audio can come back only as
  untitled orphan clips.
- Confidence: verified by reading.
- Fix: never authorize the empty manifest write from this dialog. Before any empty write, copy
  the manifest to `manifest.recovery-<ts>.json`, and keep a "Restore on-phone copy" row in
  Settings while one exists. If a real "Start fresh" is wanted, make it a separate destructive
  choice.

### H3. A degraded boot (missing or corrupt workspace row) never offers the manifest, then overwrites it without that workspace
- `App.tsx:1387-1395`: shows "Part of your library didn't load … A backup can restore it",
  then `return`s before `detectNewerManifest`. The manifest still holds that workspace. No code
  offers it, and quarantined rows (`::quarantine::`) have no in-app recovery at all (no reader
  anywhere in `src`).
- `useStore.ts:521-523` seeds `lastPersistedIdeaCount` from the already-smaller hydrated
  library, so the manifest guard sees no drop. The next edit rewrites the manifest without the
  workspace (15-45 s, `manifestSync.ts:226,230`).
- Realistic trigger: M2 below, a disk-full fallback that parks the meta row but not the
  workspace row. A missing row means the manifest is the **only** copy.
- Confidence: verified by reading.
- Fix: on a degraded boot, freeze the manifest. Restore the degraded workspace ids from the
  manifest (per workspace, merge-style), or at least offer it before the first manifest write.

---

## MEDIUM

### M1. Write ordering is not serialized end to end, so a stale snapshot can land after a newer one
1. **The first write of each session awaits before it plans.** `writeSnapshot` awaits
   `listKvKeysWithPrefix` for the orphan sweep (`shardedPersistStorage.ts:354-363`). On a fresh
   install it also awaits `verifyWriteAuthority` (`:319-321`), and after a monolithic or restored
   blob it awaits the legacy read (`:339-346`). The flags flip synchronously before those awaits,
   so a concurrent `flushNow` (take save) or a later passive write skips them. It plans and
   **commits first**, and the older first write commits after it and overwrites the newer
   workspace rows and meta. The next write heals it, because the refs adopted last are the old
   ones. A kill before then loses the newer state, and the take save already reported success
   and cleared its journal. The same hole lets an in-flight first write land after DR restore's
   `persistRawSnapshot` (`disasterRecoveryRestore.ts:495-510`, comment: "The serialized SQLite
   queue guarantees this snapshot wins").
2. **Dedupe is computed when a write is enqueued, not when it runs.**
   `db/storage.ts:457`:
   `const pendingWrites = writes.filter((row) => lastWritten.get(row.key) !== row.value);`
   runs before `enqueueWrite`. Suppose write A (workspace W = v1, an idea deleted) is still
   queued, and B (W = v0 again after Undo) is planned. B sees `lastWritten = v0` and **drops
   W's row**. A lands v1. Disk holds the deletion, memory holds the idea, and
   `lastWorkspaceRefs` treats W as clean until it changes again. A backlogged queue was seen in
   the field ("630KB in up to 68000ms", playback-stability memory 2026-07-13).
- Confidence: verified by reading. Not reproduced; both need overlapping writes.
- Fix: run plan → filter → commit under one JS mutex (a promise chain around
  `writeSnapshot`), and move the `lastWritten` filter inside the enqueued operation.

### M2. The AsyncStorage fallback writes the meta row first and records it even when workspace rows failed
- `shardedPersistStorage.ts:365-366` orders rows as `[plan.metaRow, activity, ...dirtyWorkspaceRows]`.
  The fallback loop writes them in that order (`db/storage.ts:506-514`), and
  `recordFallbackWrite(landed, removed)` records the meta even when `anyRowLost`
  (`:524-529`). On disk full, the small meta lands and the large workspace row doesn't. Boot
  replay then writes that meta over SQLite's (`:236-253`):
  - a new workspace hydrates as "missing", which leads into H3;
  - an existing workspace loads its old row, so its edits are lost with no message at boot.
  
  The only warning is the "can't save" banner, which appears only after 3 consecutive failures
  (`persistRuntime.ts:76`). One or two failures, then a kill, leave no sign.
- Confidence: verified by reading.
- Fix: write workspace rows first and the meta last. Record the meta in the marker only when
  every referenced row landed.

### M3. The Android fallback can't hold a real library, and replay forgets the rows it can't read
- `@react-native-async-storage/async-storage` 2.2.0 legacy storage. The repo never sets
  `AsyncStorage_db_size_in_MB` (git history `-S` finds nothing; `android/` is generated and
  gitignored), so the whole store is capped at **6 MB** (`config.gradle:89-95`). The project
  memory says it was raised to 50 MB; the code says otherwise.
  Android also cannot read back a row over ~2 MB (CursorWindow). One workspace at about
  3 KB/clip passes 2 MB around 700 clips.
- `db/storage.ts:225-232` skips an unreadable row ("the marker keeps it for the next
  attempt"), but `:262` calls `clearFallbackMarker()` unconditionally. The parked newer row is
  forgotten, and its mirror stays in AsyncStorage as a stale orphan. Since `"fallback"` adopted
  its refs (`shardedPersistStorage.ts:373-378`), that workspace is not rewritten until it next
  changes.
- Effect: "Saving in backup mode" promises durability that, on Android, holds only for small
  libraries.
- Confidence: library limits are known behavior, not reproduced here. The marker bug is
  verified by reading.
- Fix: keep unread keys in the marker. Set `AsyncStorage_db_size_in_MB` through a config
  plugin. Long term, use a file-based fallback (`documentDirectory`, temp file + rename) instead
  of AsyncStorage.

### M4. A deterministic hydration failure leaves a Retry-only screen, and the only way out wipes everything
- `App.tsx:1545-1556`: three automatic retries, then `EmptyState` with Retry and nothing else.
  If SQLite is permanently unreadable (malformed DB file, a failing migration in
  `database.ts:83-121`), or a normalizer throws on one bad record (`dataSlice.ts:1010`
  `idea.clips.map(...)`, `:1385` `workspace.ideas.length`, both unguarded), every launch lands
  here. The user's only exit is to reinstall, which deletes the audio and the manifest that are
  still intact on disk.
- A latent amplifier in the same path: `getItem` sets `readOutcome = "data"` **before** zustand
  runs migrate and merge (`shardedPersistStorage.ts:197,263`). If merge throws,
  `hydrationComplete` stays false, so the idea-count guard is off (`useStore.ts:359`), while
  authority says "data". Any `set()` in that state would write the starter library, and the
  first-write orphan sweep would delete every real workspace row. Today nothing calls `set()`
  behind the boot gate. The invariant is one call away from destroying the library.
- Fix: offer "Restore from on-phone copy" (manifest) and "Save a copy of my files" (zip the
  `songnook/` dir + `SQLite/`) on the failure screen. Set the adapter's authority only after
  merge succeeds (e.g. from `onRehydrateStorage`).

### M5. The guard counts ideas only, and the manifest copies every bad state
- `useStore.ts:359-409` and `manifestSync.ts:125-171` compare total idea counts only. They miss
  a bug that empties `clips`, `lyrics.versions`, a chart or Lyric Pad notes, a workspace
  holding < 40 % of ideas, or any drop of fewer than 10 ideas. The manifest is a single mirror
  (backup copy deleted after each write) that follows the store within 15-45 s, so it adopts
  the damage too. The 2026-09-07 incident shape (idea reverted to `clips: []`) would pass both
  guards.
- Fix: keep a small rotating history on device, e.g. daily `manifest-YYYYMMDD.json` × 7, as a
  last-resort rollback. Add clip and lyric-version counts per workspace to the guard telemetry.

### M6. Cost grows with library size, which widens every window above
- Sharding is per workspace (`persistSharding.ts:111-120`); most users have one, so every
  bookmark or rename re-stringifies the whole workspace. At about 3 KB/clip
  (`MANAGED_WAVEFORM_PEAK_COUNT = 256`), 1000 clips ≈ 3 MB per edit and 3000 clips ≈ 9 MB.
- The meta row is rewritten on every write and holds Lyric Pad `notes`, word sparks,
  playlists, songbooks and setlists (`persistSharding.ts:92-101`).
- The manifest stringifies the whole library every 15-45 s (`manifestSync.ts:179`).
- The first write each session serializes every workspace (refs empty at launch); SQLite skips
  rows that are byte-identical.
- Effect: a longer queue makes M1 likelier and lengthens the kill window. A transaction over
  10 s is declared failed (`db/storage.ts:55`) while it may still commit natively.
- Fix: shard by collection, or by idea for large workspaces. Move waveform peaks out of the
  persisted tree (sidecars already exist).

---

## LOW

- **L1. Kill windows.** In the foreground, up to ~6 s of edits are lost on a crash or OOM;
  the fatal JS handler (`crashLog.ts:97-101`) does not call `passivePersist.flushNow()`. On
  backgrounding, `useStore`'s AppState listener is registered first (module init), so
  `useDraftText`'s flush on background (`useDraftText.ts:51-53`) commits **after** the store
  flush. That commit then waits on a fresh 800 ms timer, on iOS without background-task time.
  Text typed in an unbroken run before Home can be lost on a kill.
  Fix: flush on the next tick in the AppState handler; hold a background task while the queue
  drains.
- **L2. The read fallback returns an AsyncStorage value of unknown age.**
  `db/storage.ts:304-318`: on a SQLite read error, any AsyncStorage copy of the key is returned
  as current, even an orphaned mirror (M3, or a failed marker write at `:156-160`). A stale meta
  with fresh workspace rows → readOutcome "data" → the orphan sweep deletes newer workspaces.
  Fix: only use the fallback copy when the marker lists that key.
- **L3. Older bundles strip newer fields.** `sanitizePersistedState` (`useStore.ts:103-299`)
  rebuilds the top-level state from a whitelist; whitelisting normalizers include
  `normalizePracticeMarkers`, `normalizeEditRegions`, `normalizeClipGroups`,
  `normalizeRecordingGrid` and `normalizeWorkspaceArchiveState`. An OTA rollback to an older
  bundle would permanently drop fields it doesn't know. Also, an `archiveState` that fails
  validation becomes `undefined` (`dataSlice.ts:1162-1175`). Unarchive then takes the "hidden-only
  flag" path, which forgets the package and leaves clips without audio.
  Fix: pass unknown keys through at the top level; never drop `archiveState` without its URI.
- **L4. Satellite stores** (Shelf, Revisit, Activity, ChartPrefs, StepUp presets, SentLinks,
  Magpie/Spark/Practice/Layer/Send prefs) use `createJSONStorage(AsyncStorage)` with no
  hydration guard and no health signal. A failed or corrupt read hydrates defaults, and the next
  `set()` overwrites disk. Five have no `migrate` (Shelf v1, Revisit v3, Activity v1,
  SentLinks v1, StepUp v2), so a future version bump silently resets them
  (middleware.mjs:390-403). Their content is pointers and prefs only; the exceptions are
  user-made StepUp presets and SentLinks `uploadToken`, without which "Delete link" can't
  revoke a sent link.
- **L5.** "Newer copy found → Keep this" (`App.tsx:1413-1416`) loses the newer copy at the next
  manifest write; the copy doesn't say so.
- **L6.** An authority refusal raises the sticky "blocked" banner even when a later retry
  hydrates fine. A false alarm, not a loss.

---

## Checked and SOLID

- **Atomic commits.** Meta + workspace rows + deletes in one transaction
  (`db/storage.ts:472-486`); WAL. A crash can't leave the meta pointing at an unwritten row
  through SQLite (only the fallback path, M2).
- **Empty-boot class (2026-07-28) holds.** Read errors throw `KvReadFailedError`, never null
  (`db/storage.ts:304-318`, `:392-410` all-or-nothing). The fresh-install stray check fails
  closed (`shardedPersistStorage.ts:154-171`). The write-authority gate covers the sharded
  path and the raw side door (`persistedSnapshot.ts:99-106`). One hydration per boot
  (`useStore.ts:474-480`; the App mount rehydrate was removed). The App shell is gated on
  hydration. The restore prompt freezes persist and re-checks live counts.
- **Persist lock and health.** Guard lock, authority refusal, both-stores failure and
  fallback-only all reach `persistLog` and the banner; the banner fires `haptic.error()`
  (`PersistFailureBanner.tsx:51`). Strict flushes reject on refusal (`PersistSkippedError`), so
  media is never trashed behind an unsaved delete.
- **Scheduler ordering** (one pending write, `take()` on flush, re-schedule on flush failure)
  is correct in steady state. Steady-state writes enqueue synchronously, so commit order =
  call order (M1 covers the exceptions).
- **Immutability invariant.** Spot-greps found no in-place mutation of persisted arrays or
  entities in state or components. `applyClipMetadataBatch` keeps identity correctly.
- **Normalizers keep unknown fields** at the idea/clip/stem/chord level (spread), so current
  fields survive hydration.
- **Intentional-empty authorization** is step-budgeted (`stateIntegrity.ts`) and called at
  collection delete, workspace delete, last-idea delete, multi-delete and gather-into-sketch.
  Archive keeps ideas (no false guard lock).
- **Fallback replay** forgets superseded rows after a healthy commit (`db/storage.ts:184-205`;
  the 2026-10-20 rewind fix holds). The queue and statements have deadlines.
- **Manifest writes** go to a temp file, keep a backup copy, then rename. Its empty and partial
  guards require an authoritative read.
- **Corrupt workspace rows** are quarantined outside the sweep prefix before the first write.
- **Nothing at boot deletes unreferenced media automatically.** Trash rescue runs before the
  purge (`App.tsx:1290-1293`).
- **Erase everything**: two destructive confirms + device auth, awaits the row sweep and an
  idle queue before deleting the DB (`eraseAllData.ts:97-116`). No other reset path exists
  outside `__DEV__`.
- **Satellite stores hold no library content.** Received parcels, Lyric Pad, sparks,
  playlists, setlists and songbooks are all in the main store.
- **Android Auto Backup** (`allowBackup="true"`, no rules) skips apps over 25 MB, so it can't
  restore a half-library for most users. Small libraries restore as a consistent files/ + DB set.
