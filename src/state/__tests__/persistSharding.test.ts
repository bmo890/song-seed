import type { Workspace } from "../../types";
import {
    SHARD_MARKER,
    assembleShardedSnapshot,
    parseMetaRow,
    planShardedWrite,
    shardedWorkspaceRowKeys,
    workspaceRowKey,
    type PersistStorageValue,
} from "../persistSharding";

const STORE = "songnook-store";

// planShardedWrite/assemble only care about workspace identity + id; the rest of the
// snapshot is opaque passthrough, so minimal fixtures cast to the real types are fine.
const ws = (id: string, label = id): Workspace => ({ id, label } as unknown as Workspace);

function snapshot(workspaces: Workspace[], extra: Record<string, unknown> = {}): PersistStorageValue {
    return {
        state: { workspaces, activeWorkspaceId: workspaces[0]?.id ?? null, ...extra } as any,
        version: 11,
    };
}

/** Apply a write plan to an in-memory kv map (what SQLite would hold after the commit). */
function applyPlan(kv: Map<string, string>, plan: ReturnType<typeof planShardedWrite>) {
    kv.set(plan.metaRow.key, plan.metaRow.value);
    for (const row of plan.dirtyWorkspaceRows) kv.set(row.key, row.value);
    for (const key of plan.deleteKeys) kv.delete(key);
}

describe("planShardedWrite", () => {
    it("writes the meta row and every workspace on a first (empty-refs) write", () => {
        const value = snapshot([ws("w1"), ws("w2")]);
        const plan = planShardedWrite(STORE, value, new Map());

        expect(plan.metaRow.key).toBe(STORE);
        expect(plan.dirtyWorkspaceRows.map((r) => r.key)).toEqual([
            workspaceRowKey(STORE, "w1"),
            workspaceRowKey(STORE, "w2"),
        ]);
        expect(plan.deleteKeys).toEqual([]);

        const meta = JSON.parse(plan.metaRow.value);
        expect(meta[SHARD_MARKER]).toBe(true);
        expect(meta.workspaceIds).toEqual(["w1", "w2"]);
        expect(meta.version).toBe(11);
        // Workspaces must NOT be duplicated inside the meta row.
        expect(meta.state.workspaces).toBeUndefined();
        expect(meta.state.activeWorkspaceId).toBe("w1");
    });

    it("rewrites ONLY the workspace whose reference changed", () => {
        const w1 = ws("w1");
        const w2 = ws("w2");
        const first = planShardedWrite(STORE, snapshot([w1, w2]), new Map());

        // Edit w2 (new object), keep w1 (same reference).
        const w2edited = ws("w2", "edited");
        const second = planShardedWrite(STORE, snapshot([w1, w2edited]), first.nextWorkspaceRefs);

        expect(second.dirtyWorkspaceRows.map((r) => r.key)).toEqual([workspaceRowKey(STORE, "w2")]);
        expect(second.deleteKeys).toEqual([]);
    });

    it("writes nothing but the meta row when no workspace reference changed", () => {
        const w1 = ws("w1");
        const first = planShardedWrite(STORE, snapshot([w1]), new Map());
        const second = planShardedWrite(STORE, snapshot([w1]), first.nextWorkspaceRefs);
        expect(second.dirtyWorkspaceRows).toEqual([]);
        expect(second.deleteKeys).toEqual([]);
    });

    it("deletes the row for a removed workspace", () => {
        const w1 = ws("w1");
        const w2 = ws("w2");
        const first = planShardedWrite(STORE, snapshot([w1, w2]), new Map());
        const second = planShardedWrite(STORE, snapshot([w1]), first.nextWorkspaceRefs);
        expect(second.deleteKeys).toEqual([workspaceRowKey(STORE, "w2")]);
    });
});

describe("parseMetaRow", () => {
    it("classifies empty / corrupt inputs", () => {
        expect(parseMetaRow(null).format).toBe("empty");
        expect(parseMetaRow(undefined).format).toBe("empty");
        expect(parseMetaRow("{not json").format).toBe("corrupt");
        expect(parseMetaRow("42").format).toBe("corrupt");
    });

    it("classifies a legacy monolithic blob and exposes its inline state", () => {
        const legacy = JSON.stringify({ state: { workspaces: [ws("w1")], activeWorkspaceId: "w1" }, version: 11 });
        const parsed = parseMetaRow(legacy);
        expect(parsed.format).toBe("legacy");
        if (parsed.format !== "legacy") throw new Error("unreachable");
        expect(parsed.value.version).toBe(11);
        expect(parsed.value.state.workspaces).toHaveLength(1);
    });

    it("classifies a sharded meta row", () => {
        const plan = planShardedWrite(STORE, snapshot([ws("w1"), ws("w2")]), new Map());
        const parsed = parseMetaRow(plan.metaRow.value);
        expect(parsed.format).toBe("sharded");
        if (parsed.format !== "sharded") throw new Error("unreachable");
        expect(parsed.workspaceIds).toEqual(["w1", "w2"]);
    });
});

describe("round trip: plan → apply → assemble", () => {
    it("reassembles the exact snapshot, workspaces in stored order", () => {
        const value = snapshot([ws("w1", "one"), ws("w2", "two"), ws("w3", "three")], {
            activeWorkspaceId: "w2",
            metronomeBpm: 120,
        });
        const kv = new Map<string, string>();
        applyPlan(kv, planShardedWrite(STORE, value, new Map()));

        const meta = parseMetaRow(kv.get(STORE));
        if (meta.format !== "sharded") throw new Error("expected sharded");
        const wsValues = new Map<string, string>();
        for (const key of shardedWorkspaceRowKeys(STORE, meta.workspaceIds)) {
            wsValues.set(key, kv.get(key)!);
        }

        const assembled = assembleShardedSnapshot(STORE, meta, wsValues);
        expect(assembled).toEqual(value);
    });

    it("survives incremental edits (edit + add + remove) across writes", () => {
        const kv = new Map<string, string>();
        const w1 = ws("w1");
        const w2 = ws("w2");
        const plan1 = planShardedWrite(STORE, snapshot([w1, w2]), new Map());
        applyPlan(kv, plan1);

        // Edit w1, drop w2, add w3.
        const w1edited = ws("w1", "edited");
        const w3 = ws("w3");
        const value2 = snapshot([w1edited, w3], { activeWorkspaceId: "w3" });
        const plan2 = planShardedWrite(STORE, value2, plan1.nextWorkspaceRefs);
        applyPlan(kv, plan2);

        // w2's row must be gone; w1 rewritten; w3 added.
        expect(kv.has(workspaceRowKey(STORE, "w2"))).toBe(false);

        const meta = parseMetaRow(kv.get(STORE));
        if (meta.format !== "sharded") throw new Error("expected sharded");
        const wsValues = new Map<string, string>();
        for (const key of shardedWorkspaceRowKeys(STORE, meta.workspaceIds)) {
            const v = kv.get(key);
            if (v != null) wsValues.set(key, v);
        }
        expect(assembleShardedSnapshot(STORE, meta, wsValues)).toEqual(value2);
    });

    it("skips a missing workspace row instead of failing the whole hydrate", () => {
        const value = snapshot([ws("w1"), ws("w2")]);
        const kv = new Map<string, string>();
        applyPlan(kv, planShardedWrite(STORE, value, new Map()));
        // Simulate a lost row.
        kv.delete(workspaceRowKey(STORE, "w2"));

        const meta = parseMetaRow(kv.get(STORE));
        if (meta.format !== "sharded") throw new Error("expected sharded");
        const wsValues = new Map<string, string>();
        for (const key of shardedWorkspaceRowKeys(STORE, meta.workspaceIds)) {
            const v = kv.get(key);
            if (v != null) wsValues.set(key, v);
        }
        const assembled = assembleShardedSnapshot(STORE, meta, wsValues);
        expect(assembled.state.workspaces.map((w) => w.id)).toEqual(["w1"]);
    });
});
