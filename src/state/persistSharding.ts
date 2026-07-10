import type { Workspace } from "../types";
import type { PersistedAppStore } from "./storeTypes";

/**
 * Pure logic for sharding the persisted library snapshot across per-workspace SQLite
 * rows (see docs/incremental-persistence-plan.md). No DB, no side effects — the DB glue
 * lives in db/storage.ts and the wiring in shardedPersistStorage.ts.
 *
 * The library used to persist as ONE blob: every edit re-stringified the whole snapshot
 * and rewrote it. Sharding writes ONLY the workspaces whose object reference changed
 * (immutable updates preserve unchanged workspace identities), so a typical edit touches
 * one workspace's row instead of the entire library.
 *
 * Storage layout, all in the existing `kv` table:
 *   key = STORE_NAME              → meta row: everything EXCEPT workspaces, + the ordered
 *                                    workspaceIds list, tagged with SHARD_MARKER.
 *   key = STORE_NAME::ws::<id>    → one workspace's full subtree.
 *
 * A monolithic blob at STORE_NAME (pre-sharding installs, or a disaster-recovery restore,
 * which writes the whole snapshot straight to STORE_NAME) has NO marker and carries its
 * workspaces inline — `assemble` returns it as-is, so both formats read transparently and
 * the next write re-shards.
 */

/** StorageValue is the object zustand's persist passes to/expects from a custom storage. */
export type PersistStorageValue = {
    state: PersistedAppStore;
    version?: number;
};

/** Marks a meta row as the sharded format (absent on legacy monolithic blobs). */
export const SHARD_MARKER = "__songseedShardedV1";

type ShardedMeta = {
    [SHARD_MARKER]: true;
    version?: number;
    workspaceIds: string[];
    /** Everything in PersistedAppStore except `workspaces`. */
    state: Omit<PersistedAppStore, "workspaces">;
};

export function workspaceRowKey(storeName: string, workspaceId: string): string {
    return `${storeName}::ws::${workspaceId}`;
}

export type ShardedWritePlan = {
    /** The meta row — always written (it carries the authoritative workspaceIds order). */
    metaRow: { key: string; value: string };
    /** Only the workspace rows whose object reference changed since the last write. */
    dirtyWorkspaceRows: { key: string; value: string }[];
    /** Rows for workspaces that no longer exist — deleted in the same transaction. */
    deleteKeys: string[];
    /** The new "last written" workspace-reference map, adopted after a successful commit. */
    nextWorkspaceRefs: Map<string, Workspace>;
};

/**
 * Diff the incoming snapshot against the last-written workspace references and produce a
 * minimal, transactional write plan. Reference equality is exact because every persisted
 * slice updates immutably — an untouched workspace keeps its identity across store writes.
 */
export function planShardedWrite(
    storeName: string,
    value: PersistStorageValue,
    lastWorkspaceRefs: Map<string, Workspace>
): ShardedWritePlan {
    const workspaces = Array.isArray(value.state.workspaces) ? value.state.workspaces : [];
    const workspaceIds = workspaces.map((workspace) => workspace.id);

    const metaState = { ...value.state } as Partial<PersistedAppStore>;
    delete metaState.workspaces;

    const meta: ShardedMeta = {
        [SHARD_MARKER]: true,
        version: value.version,
        workspaceIds,
        state: metaState as Omit<PersistedAppStore, "workspaces">,
    };

    const dirtyWorkspaceRows: { key: string; value: string }[] = [];
    const nextWorkspaceRefs = new Map<string, Workspace>();
    for (const workspace of workspaces) {
        nextWorkspaceRefs.set(workspace.id, workspace);
        // Only re-serialize + rewrite a workspace whose reference actually changed.
        if (lastWorkspaceRefs.get(workspace.id) !== workspace) {
            dirtyWorkspaceRows.push({
                key: workspaceRowKey(storeName, workspace.id),
                value: JSON.stringify(workspace),
            });
        }
    }

    const deleteKeys: string[] = [];
    for (const previousId of lastWorkspaceRefs.keys()) {
        if (!nextWorkspaceRefs.has(previousId)) {
            deleteKeys.push(workspaceRowKey(storeName, previousId));
        }
    }

    return {
        metaRow: { key: storeName, value: JSON.stringify(meta) },
        dirtyWorkspaceRows,
        deleteKeys,
        nextWorkspaceRefs,
    };
}

export type ParsedMeta =
    | { format: "empty" }
    | { format: "corrupt" }
    | { format: "legacy"; value: PersistStorageValue }
    | { format: "sharded"; version?: number; workspaceIds: string[]; metaState: Record<string, unknown> };

/** Classify a meta-row string: fresh install, sharded, or a legacy/restored monolithic blob. */
export function parseMetaRow(metaValue: string | null | undefined): ParsedMeta {
    if (metaValue == null) return { format: "empty" };

    let parsed: unknown;
    try {
        parsed = JSON.parse(metaValue);
    } catch {
        return { format: "corrupt" };
    }

    if (!parsed || typeof parsed !== "object") return { format: "corrupt" };
    const record = parsed as Record<string, unknown>;

    if (record[SHARD_MARKER] === true) {
        return {
            format: "sharded",
            version: typeof record.version === "number" ? record.version : undefined,
            workspaceIds: Array.isArray(record.workspaceIds) ? (record.workspaceIds as string[]) : [],
            metaState: (record.state as Record<string, unknown>) ?? {},
        };
    }

    // Legacy / restored monolithic blob: `{ state: {…workspaces inline…}, version }`.
    return {
        format: "legacy",
        value: {
            state: (record.state as PersistedAppStore) ?? (record as unknown as PersistedAppStore),
            version: typeof record.version === "number" ? record.version : undefined,
        },
    };
}

/** The workspace row keys a sharded meta references, in stored order. */
export function shardedWorkspaceRowKeys(storeName: string, workspaceIds: string[]): string[] {
    return workspaceIds.map((id) => workspaceRowKey(storeName, id));
}

/**
 * Reassemble a sharded snapshot from its meta + workspace rows, preserving workspace order.
 * A referenced-but-missing or corrupt workspace row is skipped with a warning rather than
 * failing the whole hydrate — losing one workspace beats losing the library.
 */
export function assembleShardedSnapshot(
    storeName: string,
    meta: Extract<ParsedMeta, { format: "sharded" }>,
    workspaceRowValues: Map<string, string>
): PersistStorageValue {
    const workspaces: Workspace[] = [];
    for (const id of meta.workspaceIds) {
        const raw = workspaceRowValues.get(workspaceRowKey(storeName, id));
        if (raw == null) {
            console.warn(`[persistSharding] workspace row missing for ${id} — skipping`);
            continue;
        }
        try {
            workspaces.push(JSON.parse(raw) as Workspace);
        } catch {
            console.warn(`[persistSharding] workspace row corrupt for ${id} — skipping`);
        }
    }

    return {
        state: { ...(meta.metaState as object), workspaces } as PersistedAppStore,
        version: meta.version,
    };
}
