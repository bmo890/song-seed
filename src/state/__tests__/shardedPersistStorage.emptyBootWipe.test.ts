// Regression tests for the empty-boot data-loss amplifier (2026-07-28 incident):
// a session whose first write is built from a snapshot NOT derived from the on-disk
// data (hydration read failed, or a stale pre-hydration snapshot) must never
// overwrite the library. The write-authority gate refuses the write instead of
// letting the meta rewrite + first-write orphan sweep erase every workspace row.
const mockKv = new Map<string, string>();
let mockSqliteDown = false;

jest.mock("../db/storage", () => ({
    // The adapter throws this on damaged stores; the class must live inside the
    // factory (jest.mock hoists above top-level declarations).
    KvReadFailedError: class KvReadFailedError extends Error {},
    sqliteStringStorage: {
        getItem: jest.fn(async (name: string) => {
            if (mockSqliteDown) throw new Error("sqlite unavailable");
            return mockKv.get(name) ?? null;
        }),
    },
    readManyKv: jest.fn(async (keys: string[]) => {
        if (mockSqliteDown) throw new Error("sqlite unavailable");
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
}));

import type { Workspace } from "../../types";
import { createShardedPersistStorage } from "../shardedPersistStorage";
import { workspaceRowKey, SHARD_MARKER } from "../persistSharding";
import { getHydrationReadOutcome, setHydrationReadOutcome } from "../persistRuntime";

const STORE = "songnook-store";
const ws = (id: string, ideas: unknown[] = []): Workspace =>
    ({ id, ideas } as unknown as Workspace);
const value = (workspaces: Workspace[]) => ({
    state: { workspaces, activeWorkspaceId: workspaces[0]?.id ?? null } as any,
    version: 12,
});

/** Seed disk with a healthy sharded library: meta + two real workspace rows. */
function seedHealthyLibrary() {
    mockKv.set(
        STORE,
        JSON.stringify({
            [SHARD_MARKER]: true,
            version: 12,
            workspaceIds: ["w-real-1", "w-real-2"],
            state: { activeWorkspaceId: "w-real-1" },
        })
    );
    mockKv.set(
        workspaceRowKey(STORE, "w-real-1"),
        JSON.stringify(ws("w-real-1", [{ id: "idea-1" }, { id: "idea-2" }]))
    );
    mockKv.set(workspaceRowKey(STORE, "w-real-2"), JSON.stringify(ws("w-real-2", [{ id: "idea-3" }])));
}

beforeEach(() => {
    mockKv.clear();
    mockSqliteDown = false;
    setHydrationReadOutcome("none");
    jest.clearAllMocks();
});

describe("write-authority gate", () => {
    it("blocks a first write from a session that never read the disk", async () => {
        seedHealthyLibrary();

        // Session boots but never successfully reads (e.g. transient SQLite failure
        // degraded hydration). Its first debounced write carries a fresh empty library:
        const storage = createShardedPersistStorage();
        await storage.setItem(STORE, value([ws("ws-fresh-boot")]) as any);

        // Disk untouched: meta still references the real workspaces, rows intact.
        expect(JSON.parse(mockKv.get(STORE)!).workspaceIds).toEqual(["w-real-1", "w-real-2"]);
        expect(mockKv.has(workspaceRowKey(STORE, "w-real-1"))).toBe(true);
        expect(mockKv.has(workspaceRowKey(STORE, "w-real-2"))).toBe(true);
    });

    it("hydration read failure rejects instead of reporting an empty library", async () => {
        seedHealthyLibrary();
        mockSqliteDown = true;

        const storage = createShardedPersistStorage();
        await expect(storage.getItem(STORE)).rejects.toThrow("sqlite unavailable");
        expect(getHydrationReadOutcome()).toBe("failed");

        // Disk recovers — a retry hydrates the real library and re-arms writes.
        mockSqliteDown = false;
        const readBack = await storage.getItem(STORE);
        expect(readBack?.state.workspaces.map((w: Workspace) => w.id)).toEqual(["w-real-1", "w-real-2"]);
        expect(getHydrationReadOutcome()).toBe("data");
    });

    it("allows writes after a successful read, including workspace deletion", async () => {
        seedHealthyLibrary();

        const storage = createShardedPersistStorage();
        const hydrated = await storage.getItem(STORE);
        expect(hydrated?.state.workspaces).toHaveLength(2);

        // A snapshot derived from the read may do anything — including delete w-real-2.
        await storage.setItem(STORE, value([ws("w-real-1", [{ id: "idea-1" }])]) as any);
        expect(JSON.parse(mockKv.get(STORE)!).workspaceIds).toEqual(["w-real-1"]);
        expect(mockKv.has(workspaceRowKey(STORE, "w-real-2"))).toBe(false);
    });

    it("allows a first write on a confirmed-fresh install", async () => {
        const storage = createShardedPersistStorage();
        expect(await storage.getItem(STORE)).toBeNull();

        await storage.setItem(STORE, value([ws("ws-first")]) as any);
        expect(JSON.parse(mockKv.get(STORE)!).workspaceIds).toEqual(["ws-first"]);
    });

    it("allows an unread session's write when it preserves every on-disk workspace", async () => {
        seedHealthyLibrary();

        // e.g. a restore/merge flow that carries the full library forward.
        const storage = createShardedPersistStorage();
        await storage.setItem(
            STORE,
            value([ws("w-real-1", [{ id: "idea-1" }, { id: "idea-2" }]), ws("w-real-2", [{ id: "idea-3" }]), ws("w-new")]) as any
        );
        expect(JSON.parse(mockKv.get(STORE)!).workspaceIds).toEqual(["w-real-1", "w-real-2", "w-new"]);
    });

    it("treats workspace rows without a meta row as damage, not a fresh install", async () => {
        mockKv.set(workspaceRowKey(STORE, "w-real-1"), JSON.stringify(ws("w-real-1", [{ id: "idea-1" }])));

        const storage = createShardedPersistStorage();
        await expect(storage.getItem(STORE)).rejects.toThrow(/workspace row/);
        expect(getHydrationReadOutcome()).toBe("failed");
    });
});
