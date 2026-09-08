/**
 * 2026-09-07 field report: a session whose SQLite writes stopped landing lost a take, its
 * title, and its sketch — the AsyncStorage fallback took the rows, reported success, and
 * the next boot's SQLite read (which succeeded) never looked at them. These tests pin the
 * fix: fallback rows are recorded, reported as degraded, replayed into SQLite, and a hung
 * native call is treated as a failure instead of wedging every later write.
 */
const mockRunAsync = jest.fn();
const mockWithTransactionAsync = jest.fn();
const mockAsyncStore = new Map<string, string>();

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

import {
    FALLBACK_MARKER_KEY,
    commitShardedWrite,
    replayPendingFallbackWrites,
    resetFallbackMarkerCache,
    SQLITE_CALL_TIMEOUT_MS,
} from "../db/storage";
import { getPersistHealth, reportPersistWriteSuccess } from "../persistRuntime";

// A transaction mock that runs the task against mockRunAsync like the real one would.
const runTransaction = async (task: () => Promise<void>) => {
    await task();
};

beforeEach(() => {
    mockRunAsync.mockReset();
    mockWithTransactionAsync.mockReset();
    mockAsyncStore.clear();
    resetFallbackMarkerCache();
    reportPersistWriteSuccess();
});

describe("fallback rows are recorded and replayed", () => {
    it("records the keys that only reached AsyncStorage and reports degraded, not success", async () => {
        mockWithTransactionAsync.mockRejectedValue(new Error("database is locked"));

        for (let i = 0; i < 3; i += 1) {
            await commitShardedWrite([{ key: `store::ws::w${i}`, value: `v${i}` }], ["store::ws::gone"]);
        }

        const marker = JSON.parse(mockAsyncStore.get(FALLBACK_MARKER_KEY)!);
        expect(marker.keys.sort()).toEqual(["store::ws::w0", "store::ws::w1", "store::ws::w2"]);
        expect(marker.deletedKeys).toEqual(["store::ws::gone"]);
        expect(mockAsyncStore.get("store::ws::w1")).toBe("v1");
        expect(getPersistHealth()).toBe("degraded");
    });

    it("replays parked rows into SQLite, clears the marker, and recovers health", async () => {
        mockWithTransactionAsync.mockRejectedValueOnce(new Error("database is locked"));
        await commitShardedWrite([{ key: "store::ws::w1", value: "newer" }], []);
        expect(mockAsyncStore.has(FALLBACK_MARKER_KEY)).toBe(true);

        mockWithTransactionAsync.mockImplementation(runTransaction);
        mockRunAsync.mockResolvedValue(undefined);
        const result = await replayPendingFallbackWrites();

        expect(result).toEqual({ status: "replayed", keys: 1, deletedKeys: 0 });
        expect(mockRunAsync).toHaveBeenCalledWith(
            expect.stringContaining("INSERT OR REPLACE"),
            "store::ws::w1",
            "newer",
            expect.any(Number)
        );
        expect(mockAsyncStore.has(FALLBACK_MARKER_KEY)).toBe(false);
        // The mirror copy is dropped so a later read-side fallback can't resurrect it.
        expect(mockAsyncStore.has("store::ws::w1")).toBe(false);
        expect(getPersistHealth()).toBe("ok");
    });

    it("hands hydration an overlay when SQLite still refuses the replay", async () => {
        mockWithTransactionAsync.mockRejectedValue(new Error("database is locked"));
        await commitShardedWrite([{ key: "store", value: "meta-new" }], ["store::ws::old"]);

        const result = await replayPendingFallbackWrites();
        expect(result.status).toBe("overlay");
        if (result.status === "overlay") {
            expect(result.rows.get("store")).toBe("meta-new");
            expect(result.deletedKeys.has("store::ws::old")).toBe(true);
        }
        // Still pending for the next attempt.
        expect(mockAsyncStore.has(FALLBACK_MARKER_KEY)).toBe(true);
    });

    it("replays automatically after the next healthy commit", async () => {
        mockWithTransactionAsync.mockRejectedValueOnce(new Error("database is locked"));
        await commitShardedWrite([{ key: "store::ws::w1", value: "parked" }], []);

        mockWithTransactionAsync.mockImplementation(runTransaction);
        mockRunAsync.mockResolvedValue(undefined);
        await commitShardedWrite([{ key: "store::ws::w2", value: "fresh" }], []);

        expect(mockAsyncStore.has(FALLBACK_MARKER_KEY)).toBe(false);
        const writtenKeys = mockRunAsync.mock.calls.map((call) => call[1]);
        expect(writtenKeys).toEqual(expect.arrayContaining(["store::ws::w1", "store::ws::w2"]));
    });

    it("reports nothing to do when no marker exists", async () => {
        expect(await replayPendingFallbackWrites()).toEqual({ status: "none" });
    });
});

describe("a hung native call cannot wedge the write queue", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    it("times out the stuck transaction, falls back, and lets the next write through", async () => {
        // First transaction never settles; the second behaves.
        mockWithTransactionAsync
            .mockImplementationOnce(() => new Promise<void>(() => {}))
            .mockImplementation(runTransaction);
        mockRunAsync.mockResolvedValue(undefined);

        const stuck = commitShardedWrite([{ key: "store::ws::a", value: "1" }], []);
        const next = commitShardedWrite([{ key: "store::ws::b", value: "2" }], []);

        await jest.advanceTimersByTimeAsync(SQLITE_CALL_TIMEOUT_MS + 1);
        await stuck;
        await next;

        // The stuck write was parked in the fallback, the next one landed in SQLite, and
        // that healthy commit replayed the parked row — nothing left behind.
        const writtenKeys = mockRunAsync.mock.calls.map((call) => call[1]);
        expect(writtenKeys).toEqual(expect.arrayContaining(["store::ws::a", "store::ws::b"]));
        expect(mockAsyncStore.has(FALLBACK_MARKER_KEY)).toBe(false);
    });
});
