# Incremental persistence plan (the ~1000-clip milestone)

> **Status: IMPLEMENTED** (branch `claude/incremental-persistence`, not yet device-verified).
> Pure sharding logic: `src/state/persistSharding.ts`. Storage adapter:
> `src/state/shardedPersistStorage.ts`. DB glue (`readManyKv`, `commitShardedWrite`,
> `listKvKeysWithPrefix`, `deleteKv`): `src/state/db/storage.ts`. Tests:
> `persistSharding.test.ts` (pure) + `shardedPersistStorage.test.ts` (adapter). The
> sections below are the design of record; a few names differ slightly in code.

## Why this exists

The library persists as ONE JSON blob: every real edit stringifies the entire
snapshot (debounced) into a single SQLite `kv` row, and boot parses all of it
before hydration completes. That design is simple and has strong safety
properties (the persist guard inspects exactly what hits disk), but its cost
scales linearly with library size. The 2026-07 scale passes removed every
*unnecessary* serialization (change-gating, peak quantization, activity cap);
what remains is the intrinsic floor: one edit = one full-library write.

`[PersistTelemetry]` logs (added 2026-07) are the tripwire:

- boot: `hydrated "song-seed-store": <KB> in <ms>` — logged every launch
- writes: warns when a library write exceeds 120ms

**Trigger for executing this plan: sustained write warnings during normal
editing, or boot hydration crossing ~400ms.** Until then, don't — this change
sits under the data-loss-hardening stack and must not be done casually.

## Target shape

Per-workspace rows instead of one blob:

```
kv:  song-seed-store          → { version, meta: everything EXCEPT workspaces,
                                  workspaceIds: [id…] }         (small, ~KBs)
kv:  song-seed-workspace:<id> → one workspace's full subtree     (medium)
```

- **Write path**: the change detector already knows which top-level fields
  changed by reference; extend it to diff `workspaces` per element (reference
  compare per workspace — same immutability contract) and write only the
  changed workspace rows + the meta row. One edit then costs one workspace's
  stringify, not the library's.
- **Read path**: hydrate meta + all workspace rows (parallel `getAllAsync`),
  reassemble before `onRehydrateStorage`. Boot parse work is the same total
  bytes but can be chunked/yielded between rows.
- **Guard**: the idea-count corruption guard moves to the reassembled snapshot
  (count across rows before commit). Writes for a multi-row update must be
  wrapped in ONE SQLite transaction so a crash can't persist half an edit.
- **Migration**: on first boot with the new STORE_VERSION, read the legacy
  blob, split it into rows inside a transaction, keep the legacy blob as
  `song-seed-store:legacy-backup` until the next successful boot.
- **Backup/restore + manifest**: `buildPersistedAppStoreSnapshot` stays the
  in-memory contract — archives, manifest, and restore are UNCHANGED (they
  operate on the assembled snapshot, not on storage layout).

## Non-goals

- No ORM / per-idea rows. Workspace granularity matches the edit patterns
  (edits cluster within one workspace) at a fraction of the complexity.
- No change to zustand shape, selectors, or any consumer.

## Prerequisites before starting

1. Current scale branch device-verified and stable in daily use.
2. A fresh manual backup, and `disaster-recovery-validation` suite green.
3. Telemetry baselines recorded (boot ms + typical write ms at current size).
