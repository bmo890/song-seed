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
import { KvReadFailedError } from "./db/storage";
import { setHydrationReadOutcome } from "./persistRuntime";

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
    // Write authority: "data" once this session has PROVEN it knows what is on disk
    // (successful read, or a pre-write disk check). Until then, a write that would
    // orphan on-disk workspaces is refused — a snapshot not derived from disk must
    // never overwrite the library (2026-07-28 empty-boot incident).
    let readOutcome: "none" | "data" | "empty" | "failed" = "none";

    /**
     * A session that never successfully read the disk may only write if the write
     * provably destroys nothing: disk is empty, or every workspace the on-disk
     * snapshot references is also present in the incoming snapshot.
     */
    async function verifyWriteAuthority(name: string, value: PersistStorageValue): Promise<boolean> {
        let existingRaw: string | null | undefined;
        try {
            existingRaw = await sqliteStringStorage.getItem(name);
        } catch {
            return false; // Disk state unknown — refuse.
        }
        const existing = parseMetaRow(existingRaw);
        if (existing.format === "empty") return true;
        if (existing.format === "corrupt") return false;

        const incomingIds = new Set(
            (Array.isArray(value.state.workspaces) ? value.state.workspaces : []).map((ws) => ws.id)
        );
        const diskIds =
            existing.format === "sharded"
                ? existing.workspaceIds
                : (existing.value.state?.workspaces ?? []).map((ws) => ws.id);
        return diskIds.every((id) => incomingIds.has(id));
    }

    return {
        getItem: async (name): Promise<StorageValue<PersistedAppStore> | null> => {
            const startedAt = Date.now();
            let metaRaw: string | null | undefined;
            try {
                metaRaw = await sqliteStringStorage.getItem(name);
            } catch (err) {
                // Unknown disk state: fail hydration so the app retries instead of
                // booting a writable empty library. Writes stay gated meanwhile.
                readOutcome = "failed";
                setHydrationReadOutcome("failed");
                throw err;
            }
            const meta = parseMetaRow(metaRaw);

            if (meta.format === "empty") {
                // Confirmed-fresh only if no stray workspace rows exist. Rows without a
                // meta row mean a damaged store, not a fresh install — don't boot empty
                // over them (a later write's sweep would delete them).
                const strays = await listKvKeysWithPrefix(`${name}::ws::`);
                if (strays.length > 0) {
                    readOutcome = "failed";
                    setHydrationReadOutcome("failed");
                    throw new KvReadFailedError(
                        `meta row missing but ${strays.length} workspace row(s) exist for "${name}"`
                    );
                }
                readOutcome = "empty";
                setHydrationReadOutcome("empty");
                return null;
            }

            if (meta.format === "corrupt") {
                // Deterministic damage — retrying won't help, so hydrate empty to let the
                // disaster-recovery prompt offer the manifest. The write gate keeps this
                // session from overwriting the damaged (possibly recoverable) rows.
                console.warn(`[PersistTelemetry] meta row for "${name}" is unparseable — starting empty`);
                readOutcome = "failed";
                setHydrationReadOutcome("failed");
                return null;
            }

            if (meta.format === "legacy") {
                // Monolithic blob (pre-sharding install, or a restore). Read inline; the next
                // write re-shards. Don't seed lastWorkspaceRefs — post-hydrate sanitize creates
                // new workspace identities, so the first write shards them all regardless.
                const kb = Math.round((metaRaw?.length ?? 0) / 1024);
                console.log(`[PersistTelemetry] hydrated "${name}" (monolithic): ${kb}KB in ${Date.now() - startedAt}ms`);
                readOutcome = "data";
                setHydrationReadOutcome("data");
                return meta.value as StorageValue<PersistedAppStore>;
            }

            // Sharded: read the referenced workspace rows and reassemble.
            const workspaceKeys = shardedWorkspaceRowKeys(name, meta.workspaceIds);
            let workspaceValues: Map<string, string>;
            try {
                workspaceValues = await readManyKv(workspaceKeys);
            } catch (err) {
                readOutcome = "failed";
                setHydrationReadOutcome("failed");
                throw err;
            }
            const assembled = assembleShardedSnapshot(name, meta, workspaceValues);
            readOutcome = "data";
            setHydrationReadOutcome("data");

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
            // Write-authority gate: a session that never successfully read the on-disk
            // library must not overwrite it. The meta rewrite + first-write orphan sweep
            // below would otherwise permanently erase every workspace row.
            if (readOutcome !== "data") {
                const allowed = await verifyWriteAuthority(name, value as PersistStorageValue);
                if (!allowed) {
                    console.error(
                        `[PersistAuthority] BLOCKED write to "${name}": this session never ` +
                            `read the on-disk library (readOutcome=${readOutcome}) and the write ` +
                            `would orphan on-disk workspaces. Keeping disk untouched.`
                    );
                    return;
                }
                readOutcome = "data";
                setHydrationReadOutcome("data");
            }

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
            // The wipe was deliberate (persist.clearStorage) — disk is now known-empty.
            readOutcome = "empty";
            setHydrationReadOutcome("empty");
        },
    };
}
