import type { PersistStorage, StorageValue } from "zustand/middleware";
import type { Workspace } from "../types";
import type { PersistedAppStore } from "./storeTypes";
import {
    commitShardedWrite,
    deleteKv,
    listKvKeysWithPrefix,
    readManyKv,
    sqliteStringStorage,
} from "./db/storage";
import {
    assembleShardedSnapshot,
    parseMetaRow,
    planShardedWrite,
    shardedWorkspaceRowKeys,
    workspaceRowKey,
    type PersistStorageValue,
} from "./persistSharding";

/**
 * zustand persist storage that shards the library across per-workspace SQLite rows so an
 * edit rewrites only the workspaces it touched, not the whole library (see
 * docs/incremental-persistence-plan.md). Transparent to backup/restore/manifest, which keep
 * reading and writing the whole snapshot at STORE_NAME — a monolithic blob is recognized as
 * "legacy format" on read and re-sharded on the next write.
 */

const SLOW_WRITE_WARN_MS = 120;

/** One-boot safety net: the pre-sharding blob is copied here before the first shard write,
 *  and retired after the next successful sharded read. */
function legacyBackupKey(storeName: string): string {
    return `${storeName}::legacy-blob`;
}

export function createShardedPersistStorage(): PersistStorage<PersistedAppStore> {
    // Last-written workspace object references, for reference-based dirty detection. Empty at
    // launch, so the first write after hydration shards every workspace once (their identities
    // are freshly created by sanitize/merge anyway); subsequent edits are incremental.
    let lastWorkspaceRefs = new Map<string, Workspace>();
    // Whether we've already stashed the pre-sharding monolithic blob this session.
    let legacyBackedUp = false;
    // Whether we've swept orphaned workspace rows (left by a restore or the legacy→sharded
    // transition) — once per session, on the first write.
    let orphansSwept = false;

    return {
        getItem: async (name): Promise<StorageValue<PersistedAppStore> | null> => {
            const startedAt = Date.now();
            const metaRaw = await sqliteStringStorage.getItem(name);
            const meta = parseMetaRow(metaRaw);

            if (meta.format === "empty") return null;

            if (meta.format === "corrupt") {
                console.warn(`[PersistTelemetry] meta row for "${name}" is unparseable — starting empty`);
                return null;
            }

            if (meta.format === "legacy") {
                // Monolithic blob (pre-sharding install, or a restore). Read inline; the next
                // write re-shards. Don't seed lastWorkspaceRefs — post-hydrate sanitize creates
                // new workspace identities, so the first write shards them all regardless.
                const kb = Math.round((metaRaw?.length ?? 0) / 1024);
                console.log(`[PersistTelemetry] hydrated "${name}" (monolithic): ${kb}KB in ${Date.now() - startedAt}ms`);
                return meta.value as StorageValue<PersistedAppStore>;
            }

            // Sharded: read the referenced workspace rows and reassemble.
            const workspaceKeys = shardedWorkspaceRowKeys(name, meta.workspaceIds);
            const workspaceValues = await readManyKv(workspaceKeys);
            const assembled = assembleShardedSnapshot(name, meta, workspaceValues);

            let bytes = metaRaw?.length ?? 0;
            for (const value of workspaceValues.values()) bytes += value.length;
            console.log(
                `[PersistTelemetry] hydrated "${name}" (sharded, ${meta.workspaceIds.length} workspaces): ` +
                    `${Math.round(bytes / 1024)}KB in ${Date.now() - startedAt}ms`
            );

            // We successfully read the sharded format — the one-boot legacy backup has done its
            // job. Retire it (best-effort) and mark it handled for this session.
            legacyBackedUp = true;
            void deleteKv(legacyBackupKey(name));

            return assembled as StorageValue<PersistedAppStore>;
        },

        setItem: async (name, value): Promise<void> => {
            // Preserve the pre-sharding monolithic blob ONCE, before the first shard write
            // overwrites the meta row — a crash mid-transition can then still recover fully.
            if (!legacyBackedUp) {
                legacyBackedUp = true;
                const existing = await sqliteStringStorage.getItem(name);
                const existingMeta = parseMetaRow(existing);
                if (existing != null && existingMeta.format === "legacy") {
                    await commitShardedWrite([{ key: legacyBackupKey(name), value: existing }], []);
                }
            }

            const startedAt = Date.now();
            const plan = planShardedWrite(name, value as PersistStorageValue, lastWorkspaceRefs);

            // First write of the session: sweep any workspace rows on disk that this snapshot
            // no longer references — orphans from a restore or the legacy→sharded transition,
            // which lastWorkspaceRefs (empty at launch) can't otherwise know to delete.
            let extraDeletes = plan.deleteKeys;
            if (!orphansSwept) {
                orphansSwept = true;
                const existing = await listKvKeysWithPrefix(`${name}::ws::`);
                const keep = new Set(
                    Array.from(plan.nextWorkspaceRefs.keys()).map((id) => workspaceRowKey(name, id))
                );
                const orphans = existing.filter((key) => !keep.has(key));
                if (orphans.length > 0) extraDeletes = [...plan.deleteKeys, ...orphans];
            }

            await commitShardedWrite([plan.metaRow, ...plan.dirtyWorkspaceRows], extraDeletes);
            // Adopt the new reference set only after a successful commit.
            lastWorkspaceRefs = plan.nextWorkspaceRefs;

            const ms = Date.now() - startedAt;
            if (ms >= SLOW_WRITE_WARN_MS) {
                let bytes = plan.metaRow.value.length;
                for (const row of plan.dirtyWorkspaceRows) bytes += row.value.length;
                console.warn(
                    `[PersistTelemetry] slow library write: ${plan.dirtyWorkspaceRows.length} workspace(s), ` +
                        `${Math.round(bytes / 1024)}KB in ${ms}ms — approaching the persist ceiling ` +
                        `(docs/incremental-persistence-plan.md)`
                );
            }
        },

        removeItem: async (name): Promise<void> => {
            // Drop the meta row, the legacy backup, and EVERY workspace row on disk (swept by
            // prefix, not just this session's known refs) so nothing is left orphaned.
            const workspaceRows = await listKvKeysWithPrefix(`${name}::ws::`);
            await commitShardedWrite([], [name, legacyBackupKey(name), ...workspaceRows]);
            lastWorkspaceRefs = new Map();
            legacyBackedUp = false;
            orphansSwept = false;
        },
    };
}
