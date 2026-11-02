/**
 * Audit 2026-11-02, 01-M1 / 01-M2: saves must land in the order they were asked for, and
 * a write the fallback can only half-take must never park a meta row that names a
 * workspace row which didn't land.
 */
const mockRunAsync = jest.fn();
const mockWithTransactionAsync = jest.fn();
const mockAsyncStore = new Map<string, string>();
const mockAsyncSetFailures = new Set<string>();

jest.mock("../db/database", () => ({
    getDb: () => ({
        runAsync: (...args: unknown[]) => mockRunAsync(...args),
        withTransactionAsync: (task: () => Promise<void>) => mockWithTransactionAsync(task),
    }),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(async (key: string) => mockAsyncStore.get(key) ?? null),
        setItem: jest.fn(async (key: string, value: string) => {
            if (mockAsyncSetFailures.has(key)) throw new Error("disk full");
            mockAsyncStore.set(key, value);
        }),
        removeItem: jest.fn(async (key: string) => {
            mockAsyncStore.delete(key);
        }),
    },
}));

jest.mock("../../services/persistLog", () => ({
    persistLog: jest.fn(),
    describeError: (e: unknown) => String(e),
}));

import { FALLBACK_MARKER_KEY, commitShardedWrite, resetFallbackMarkerCache } from "../db/storage";
import { runInPersistOrder } from "../persistOrder";
import { reportPersistWriteSuccess } from "../persistRuntime";

const sqlite = new Map<string, string>();

beforeEach(() => {
    mockRunAsync.mockReset();
    mockWithTransactionAsync.mockReset();
    mockAsyncStore.clear();
    mockAsyncSetFailures.clear();
    sqlite.clear();
    resetFallbackMarkerCache();
    reportPersistWriteSuccess();
    mockRunAsync.mockImplementation(async (sql: string, key: string, value?: string) => {
        if (sql.startsWith("INSERT")) sqlite.set(key, value!);
        if (sql.startsWith("DELETE")) sqlite.delete(key);
    });
});

it("dedupes a row when the write runs, not when it is queued (01-M1)", async () => {
    // v0 on disk.
    mockWithTransactionAsync.mockImplementation(async (task: () => Promise<void>) => task());
    await commitShardedWrite([{ key: "ws", value: "v0" }], []);

    // A (an idea deleted: v1) is held in the queue; B (Undo: back to v0) is asked for meanwhile.
    let releaseA!: () => void;
    const held = new Promise<void>((resolve) => (releaseA = resolve));
    mockWithTransactionAsync.mockImplementationOnce(async (task: () => Promise<void>) => {
        await held;
        await task();
    });
    const a = commitShardedWrite([{ key: "ws", value: "v1" }], []);
    const b = commitShardedWrite([{ key: "ws", value: "v0" }], []);
    releaseA();
    await Promise.all([a, b]);

    expect(sqlite.get("ws")).toBe("v0");
});

it("a write asked for first commits first, even when it plans slowly (01-M1)", async () => {
    mockWithTransactionAsync.mockImplementation(async (task: () => Promise<void>) => task());
    let releasePlan!: () => void;
    const slowPlan = new Promise<void>((resolve) => (releasePlan = resolve));

    const first = runInPersistOrder(async () => {
        await slowPlan; // the session's first write awaiting its disk checks
        await commitShardedWrite([{ key: "meta", value: "older" }], []);
    });
    const second = runInPersistOrder(() => commitShardedWrite([{ key: "meta", value: "newer" }], []));
    await Promise.resolve();
    releasePlan();
    await Promise.all([first, second]);

    expect(sqlite.get("meta")).toBe("newer");
});

it("never parks a meta row when a workspace row before it was lost (01-M2)", async () => {
    mockWithTransactionAsync.mockRejectedValue(new Error("SQLITE_FULL"));
    mockAsyncSetFailures.add("store::ws::big");

    await commitShardedWrite(
        [
            { key: "store::ws::big", value: "big workspace" },
            { key: "store", value: "meta naming big" },
        ],
        ["store::ws::gone"]
    );

    expect(mockAsyncStore.has("store")).toBe(false);
    const marker = mockAsyncStore.get(FALLBACK_MARKER_KEY);
    expect(marker ? JSON.parse(marker).keys : []).not.toContain("store");
    expect(marker ? JSON.parse(marker).deletedKeys : []).not.toContain("store::ws::gone");
});
