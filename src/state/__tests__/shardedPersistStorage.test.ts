// In-memory fake of the SQLite kv layer so the adapter's read/write/reassembly and
// legacy-migration behavior can be exercised without a real database. The `mock` prefix
// is required — jest.mock factories may only close over mock-prefixed outer variables.
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
}));

import type { Workspace } from "../../types";
import { createShardedPersistStorage } from "../shardedPersistStorage";
import { SHARD_MARKER, workspaceRowKey } from "../persistSharding";
import { commitShardedWrite } from "../db/storage";

const STORE = "songnook-store";
const ws = (id: string, label = id): Workspace => ({ id, label } as unknown as Workspace);
const value = (workspaces: Workspace[], extra: Record<string, unknown> = {}) => ({
    state: { workspaces, activeWorkspaceId: workspaces[0]?.id ?? null, ...extra } as any,
    version: 11,
});

beforeEach(() => {
    mockKv.clear();
    jest.clearAllMocks();
});

describe("shardedPersistStorage", () => {
    it("returns null on a fresh install", async () => {
        const storage = createShardedPersistStorage();
        expect(await storage.getItem(STORE)).toBeNull();
    });

    it("round-trips a sharded write and read", async () => {
        const storage = createShardedPersistStorage();
        const original = value([ws("w1"), ws("w2")], { metronomeBpm: 128 });

        await storage.setItem(STORE, original as any);
        // Meta row is tagged sharded and workspaces live in their own rows.
        expect(JSON.parse(mockKv.get(STORE)!)[SHARD_MARKER]).toBe(true);
        expect(mockKv.has(workspaceRowKey(STORE, "w1"))).toBe(true);

        const readBack = await storage.getItem(STORE);
        expect(readBack).toEqual(original);
    });

    it("reads a legacy monolithic blob inline, then re-shards on next write", async () => {
        // Seed a pre-sharding blob.
        mockKv.set(STORE, JSON.stringify(value([ws("w1"), ws("w2")])));

        const storage = createShardedPersistStorage();
        const legacyRead = await storage.getItem(STORE);
        expect(legacyRead?.state.workspaces.map((w: Workspace) => w.id)).toEqual(["w1", "w2"]);

        // The next write backs up the legacy blob and converts to sharded.
        await storage.setItem(STORE, value([ws("w1"), ws("w2")]) as any);
        expect(mockKv.has(`${STORE}::legacy-blob`)).toBe(true);
        expect(JSON.parse(mockKv.get(STORE)!)[SHARD_MARKER]).toBe(true);

        const reread = await storage.getItem(STORE);
        expect(reread?.state.workspaces.map((w: Workspace) => w.id)).toEqual(["w1", "w2"]);
    });

    it("commits only the changed workspace on an incremental edit", async () => {
        const storage = createShardedPersistStorage();
        const w1 = ws("w1");
        const w2 = ws("w2");
        await storage.setItem(STORE, value([w1, w2]) as any);
        jest.clearAllMocks();

        // Edit only w2.
        await storage.setItem(STORE, value([w1, ws("w2", "edited")]) as any);

        const call = (commitShardedWrite as jest.Mock).mock.calls[0];
        const writtenKeys = (call[0] as { key: string }[]).map((r) => r.key);
        // Meta row + only the edited workspace row (w1 unchanged, not rewritten).
        expect(writtenKeys).toEqual([STORE, workspaceRowKey(STORE, "w2")]);
    });

    it("removeItem drops the meta, workspace rows, and legacy backup", async () => {
        const storage = createShardedPersistStorage();
        await storage.setItem(STORE, value([ws("w1"), ws("w2")]) as any);
        await storage.removeItem(STORE);

        expect(mockKv.has(STORE)).toBe(false);
        expect(mockKv.has(workspaceRowKey(STORE, "w1"))).toBe(false);
        expect(mockKv.has(workspaceRowKey(STORE, "w2"))).toBe(false);
    });

    it("sweeps orphaned workspace rows on the first write (e.g. after a restore)", async () => {
        // Simulate a restore: a monolithic blob at STORE with fewer workspaces than the
        // stale sharded rows still on disk from before.
        mockKv.set(workspaceRowKey(STORE, "old1"), JSON.stringify(ws("old1")));
        mockKv.set(workspaceRowKey(STORE, "old2"), JSON.stringify(ws("old2")));
        mockKv.set(STORE, JSON.stringify(value([ws("w1")])));

        const storage = createShardedPersistStorage();
        await storage.getItem(STORE); // legacy read of the restored blob
        await storage.setItem(STORE, value([ws("w1")]) as any);

        expect(mockKv.has(workspaceRowKey(STORE, "old1"))).toBe(false);
        expect(mockKv.has(workspaceRowKey(STORE, "old2"))).toBe(false);
        expect(mockKv.has(workspaceRowKey(STORE, "w1"))).toBe(true);
    });

    it("retires the legacy backup after a successful sharded read", async () => {
        mockKv.set(STORE, JSON.stringify(value([ws("w1")])));
        const storage = createShardedPersistStorage();
        await storage.getItem(STORE); // legacy read
        await storage.setItem(STORE, value([ws("w1")]) as any); // backs up + shards
        expect(mockKv.has(`${STORE}::legacy-blob`)).toBe(true);

        // A later boot reads sharded and clears the backup.
        const nextBoot = createShardedPersistStorage();
        await nextBoot.getItem(STORE);
        expect(mockKv.has(`${STORE}::legacy-blob`)).toBe(false);
    });
});
