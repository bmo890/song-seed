// Repro + regression for the corrupt-shard silent-loss path (2026-08-26 audit F1):
// a referenced workspace row that fails to parse used to be skipped with a warning,
// hydration reported clean "data", and the first write's orphan sweep then deleted
// the corrupt-but-recoverable row — every recovery layer converging on the loss.
// The fix quarantines the raw bytes under a sweep-proof key and reports the
// degradation so the app can tell the user instead of silently shrinking.
const mockKv = new Map<string, string>();

jest.mock("../db/storage", () => ({
    sqliteStringStorage: {
        getItem: jest.fn(async (name: string) => mockKv.get(name) ?? null),
    },
    readManyKv: jest.fn(async (keys: string[]) => {
        const out = new Map<string, string>();
        for (const key of keys) {
            const value = mockKv.get(key);
            if (value != null) out.set(key, value);
        }
        return out;
    }),
    commitShardedWrite: jest.fn(async (writes: { key: string; value: string }[], deletes: string[]) => {
        for (const row of writes) mockKv.set(row.key, row.value);
        for (const key of deletes) mockKv.delete(key);
    }),
    deleteKv: jest.fn(async (key: string) => {
        mockKv.delete(key);
    }),
    listKvKeysWithPrefix: jest.fn(async (prefix: string) =>
        Array.from(mockKv.keys()).filter((key) => key.startsWith(prefix))
    ),
    listKvKeysWithPrefixOrThrow: jest.fn(async (prefix: string) =>
        Array.from(mockKv.keys()).filter((key) => key.startsWith(prefix))
    ),
}));

import type { Workspace } from "../../types";
import { createShardedPersistStorage, quarantinedWorkspaceRowKey } from "../shardedPersistStorage";
import { SHARD_MARKER, workspaceRowKey } from "../persistSharding";
import {
    getHydrationDegradedWorkspaceIds,
    setHydrationDegradedWorkspaceIds,
} from "../persistRuntime";

const STORE = "songnook-store";
const ws = (id: string, label = id): Workspace => ({ id, label } as unknown as Workspace);
const value = (workspaces: Workspace[]) => ({
    state: { workspaces, activeWorkspaceId: workspaces[0]?.id ?? null } as any,
    version: 11,
});

/** Seed a sharded library on disk: meta referencing the given ids, one row each. */
function seedSharded(rows: Record<string, string>) {
    mockKv.set(
        STORE,
        JSON.stringify({
            [SHARD_MARKER]: true,
            version: 11,
            workspaceIds: Object.keys(rows),
            state: { activeWorkspaceId: Object.keys(rows)[0] ?? null },
        })
    );
    for (const [id, raw] of Object.entries(rows)) {
        mockKv.set(workspaceRowKey(STORE, id), raw);
    }
}

beforeEach(() => {
    mockKv.clear();
    jest.clearAllMocks();
    setHydrationDegradedWorkspaceIds([]);
});

describe("corrupt workspace shard", () => {
    it("quarantines the corrupt row's bytes so the first-write sweep cannot destroy them", async () => {
        const corruptRaw = '{"id":"wBad","label":"half-writ'; // truncated JSON
        seedSharded({ wGood: JSON.stringify(ws("wGood")), wBad: corruptRaw });

        const storage = createShardedPersistStorage();
        const read = await storage.getItem(STORE);

        // The healthy remainder still hydrates.
        expect(read?.state.workspaces.map((w: Workspace) => w.id)).toEqual(["wGood"]);
        // The unparseable bytes were copied to a quarantine key before returning.
        expect(mockKv.get(quarantinedWorkspaceRowKey(STORE, "wBad"))).toBe(corruptRaw);

        // First write of the session: the sweep may drop the dead ::ws:: row, but the
        // quarantined copy must survive it.
        await storage.setItem(STORE, value([ws("wGood")]) as any);
        expect(mockKv.has(workspaceRowKey(STORE, "wBad"))).toBe(false);
        expect(mockKv.get(quarantinedWorkspaceRowKey(STORE, "wBad"))).toBe(corruptRaw);
    });

    it("reports degraded workspace ids (corrupt and missing) for the app to surface", async () => {
        seedSharded({ wGood: JSON.stringify(ws("wGood")), wBad: "not json at all" });
        // A referenced-but-absent row is also a degradation, with nothing to quarantine.
        mockKv.set(
            STORE,
            JSON.stringify({
                [SHARD_MARKER]: true,
                version: 11,
                workspaceIds: ["wGood", "wBad", "wGone"],
                state: { activeWorkspaceId: "wGood" },
            })
        );

        const storage = createShardedPersistStorage();
        await storage.getItem(STORE);

        expect(getHydrationDegradedWorkspaceIds()).toEqual(["wBad", "wGone"]);
    });

    it("reports nothing on a clean hydrate", async () => {
        seedSharded({ wGood: JSON.stringify(ws("wGood")) });
        const storage = createShardedPersistStorage();
        await storage.getItem(STORE);
        expect(getHydrationDegradedWorkspaceIds()).toEqual([]);
    });

    it("a deliberate wipe clears quarantined rows too", async () => {
        seedSharded({ wGood: JSON.stringify(ws("wGood")), wBad: "not json" });
        const storage = createShardedPersistStorage();
        await storage.getItem(STORE);
        expect(mockKv.has(quarantinedWorkspaceRowKey(STORE, "wBad"))).toBe(true);

        await storage.removeItem(STORE);
        expect(mockKv.has(quarantinedWorkspaceRowKey(STORE, "wBad"))).toBe(false);
    });
});
