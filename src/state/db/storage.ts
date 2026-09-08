import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDb } from "./database";
import {
    reportPersistWriteFailure,
    reportPersistWriteFallback,
    reportPersistWriteSuccess,
} from "../persistRuntime";
import { describeError, persistLog } from "../../services/persistLog";

/**
 * A string key/value `StateStorage` backed by SQLite, used as the base for zustand's
 * persisted store (wrapped by `createJSONStorage` + the corruption guard in useStore.ts).
 *
 * Safety properties:
 * - SQLite is authoritative. Writes are a single atomic statement, run asynchronously so the
 *   JS thread is never blocked (zustand fires a write on every state change — including
 *   high-frequency playback-position updates — even when the persisted slice is unchanged).
 * - Redundant writes are skipped: if the serialized snapshot matches what was last written,
 *   the DB is not touched at all, so playback ticks don't churn storage.
 * - On first read, a legacy AsyncStorage blob is imported into SQLite once (seamless
 *   migration) and the legacy blob is left in place as an emergency fallback.
 * - If SQLite is ever unavailable, every operation falls back to AsyncStorage, so a SQLite
 *   failure degrades gracefully instead of losing access to the library. Fallback rows are
 *   RECORDED (see `FALLBACK_MARKER_KEY`) and replayed into SQLite on the next boot or the
 *   next healthy write — a fallback write used to be invisible to the next launch, whose
 *   SQLite read succeeded and never looked at AsyncStorage (2026-09-07 field report).
 * - No native call may wedge the write queue: every SQLite statement races a deadline, and
 *   a timed-out statement is treated as a failed one (fallback + log), so a hung native
 *   promise can no longer silently swallow every later write of the session.
 */

/**
 * Thrown when the authoritative store could not be read AND the AsyncStorage fallback
 * holds no substitute. Callers must treat this as "unknown disk state" — never as an
 * empty library. Hydration surfaces it and retries instead of booting empty (the
 * 2026-07-28 empty-boot incident: a transient read failure degraded to null, the store
 * hydrated fresh, and the first write's orphan sweep would erase the real library).
 */
export class KvReadFailedError extends Error {
    constructor(message: string, cause?: unknown) {
        super(message);
        this.name = "KvReadFailedError";
        (this as { cause?: unknown }).cause = cause;
    }
}

export class PersistWriteTimeoutError extends Error {
    constructor(label: string, ms: number) {
        super(`${label} did not complete within ${ms}ms`);
        this.name = "PersistWriteTimeoutError";
    }
}

/** Ceiling for one SQLite statement/transaction before it is treated as failed. */
export const SQLITE_CALL_TIMEOUT_MS = 10_000;
/** Ceiling for one whole queued operation (SQLite attempt + fallback) — unwedges the queue. */
const QUEUE_OPERATION_TIMEOUT_MS = 20_000;

/**
 * AsyncStorage key recording which kv rows were written to the fallback because SQLite
 * refused them. Present ⇒ AsyncStorage holds rows NEWER than SQLite for those keys.
 */
export const FALLBACK_MARKER_KEY = "songnook-kv-fallback-pending";

type FallbackMarker = { keys: string[]; deletedKeys: string[]; at: number };

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new PersistWriteTimeoutError(label, ms)), ms);
    });
    return Promise.race([promise, deadline]).finally(() => {
        if (timer) clearTimeout(timer);
    }) as Promise<T>;
}

/** Run one SQLite call against the deadline. */
function sqliteCall<T>(label: string, run: () => Promise<T>): Promise<T> {
    return withTimeout(run(), SQLITE_CALL_TIMEOUT_MS, label);
}

function logWriteFailure(error: unknown, label: string) {
    persistLog(
        error instanceof PersistWriteTimeoutError ? "write.timeout" : "write.fallback",
        `${label}: ${describeError(error)}`
    );
}

// Last value successfully written per key, so unchanged snapshots skip the DB entirely.
const lastWritten = new Map<string, string>();
let writeQueue: Promise<void> = Promise.resolve();

function enqueueWrite(operation: () => Promise<void>) {
    // The queue itself is also bounded: a fallback that never settles must not become
    // the new head-of-line blocker.
    const run = () => withTimeout(operation(), QUEUE_OPERATION_TIMEOUT_MS, "queued write");
    const result = writeQueue.then(run, run);
    // Keep the queue usable after a failed write while still returning the failure to its caller.
    writeQueue = result.catch(() => undefined);
    return result;
}

/** Resolves once every write queued so far has settled. A deliberate wipe must wait for
 *  this before closing the database — a statement reaching a closed connection is a
 *  native crash, not an error (seen 2026-09-07 in the simulator). */
export function waitForWriteQueueIdle(): Promise<void> {
    return writeQueue.then(() => undefined, () => undefined);
}

/* ── Fallback bookkeeping ────────────────────────────────────────────────────── */

// null = not yet checked this session; false = known clear; object = pending.
let fallbackMarkerCache: FallbackMarker | false | null = null;

async function readFallbackMarker(): Promise<FallbackMarker | null> {
    if (fallbackMarkerCache === false) return null;
    if (fallbackMarkerCache) return fallbackMarkerCache;
    try {
        const raw = await AsyncStorage.getItem(FALLBACK_MARKER_KEY);
        if (!raw) {
            fallbackMarkerCache = false;
            return null;
        }
        const parsed = JSON.parse(raw) as Partial<FallbackMarker>;
        const marker: FallbackMarker = {
            keys: Array.isArray(parsed.keys) ? parsed.keys.filter((k): k is string => typeof k === "string") : [],
            deletedKeys: Array.isArray(parsed.deletedKeys)
                ? parsed.deletedKeys.filter((k): k is string => typeof k === "string")
                : [],
            at: typeof parsed.at === "number" ? parsed.at : 0,
        };
        fallbackMarkerCache = marker;
        return marker;
    } catch {
        // Unreadable marker: assume nothing pending (the rows, if any, still sit in
        // AsyncStorage and the read-side fallback can still find them).
        fallbackMarkerCache = false;
        return null;
    }
}

async function recordFallbackWrite(writtenKeys: string[], deletedKeys: string[]): Promise<void> {
    const existing = (await readFallbackMarker()) ?? { keys: [], deletedKeys: [], at: 0 };
    const keys = new Set(existing.keys);
    const deleted = new Set(existing.deletedKeys);
    for (const key of writtenKeys) {
        keys.add(key);
        deleted.delete(key);
    }
    for (const key of deletedKeys) {
        deleted.add(key);
        keys.delete(key);
    }
    const marker: FallbackMarker = { keys: [...keys], deletedKeys: [...deleted], at: Date.now() };
    fallbackMarkerCache = marker;
    try {
        await AsyncStorage.setItem(FALLBACK_MARKER_KEY, JSON.stringify(marker));
    } catch {
        // The rows themselves landed; a missing marker only costs the boot replay.
    }
}

/** Test hook — forget the session's marker cache so suites don't leak into each other. */
export function resetFallbackMarkerCache() {
    fallbackMarkerCache = null;
}

async function clearFallbackMarker(): Promise<void> {
    fallbackMarkerCache = false;
    try {
        await AsyncStorage.removeItem(FALLBACK_MARKER_KEY);
    } catch {
        // ignore
    }
}

export type FallbackReplayResult =
    | { status: "none" }
    | { status: "replayed"; keys: number; deletedKeys: number }
    /** SQLite still refuses: hydrate through this overlay (newer than the SQLite rows). */
    | { status: "overlay"; rows: Map<string, string>; deletedKeys: Set<string> };

/**
 * Move rows that only reached the AsyncStorage fallback into SQLite. Called before the
 * boot read and after any healthy SQLite commit. Returns an overlay for hydration when
 * SQLite still refuses to take them.
 */
export async function replayPendingFallbackWrites(): Promise<FallbackReplayResult> {
    const marker = await readFallbackMarker();
    if (!marker || (marker.keys.length === 0 && marker.deletedKeys.length === 0)) {
        return { status: "none" };
    }

    const rows = new Map<string, string>();
    for (const key of marker.keys) {
        try {
            const value = await AsyncStorage.getItem(key);
            if (value != null) rows.set(key, value);
        } catch {
            // Skip an unreadable row; the marker keeps it for the next attempt.
        }
    }
    const deletedKeys = new Set(marker.deletedKeys);

    try {
        await enqueueWrite(async () => {
            const db = getDb();
            const now = Date.now();
            await sqliteCall("replay fallback rows", () =>
                db.withTransactionAsync(async () => {
                    for (const [key, value] of rows) {
                        await db.runAsync(
                            "INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, ?)",
                            key,
                            value,
                            now
                        );
                    }
                    for (const key of deletedKeys) {
                        await db.runAsync("DELETE FROM kv WHERE key = ?", key);
                    }
                })
            );
        });
    } catch (err) {
        persistLog("write.failed", `fallback replay: ${describeError(err)}`);
        return { status: "overlay", rows, deletedKeys };
    }

    for (const [key, value] of rows) lastWritten.set(key, value);
    for (const key of deletedKeys) lastWritten.delete(key);
    await clearFallbackMarker();
    // The mirror copies are stale from here on; drop them so a later read-side
    // fallback can never resurrect an older library.
    for (const key of rows.keys()) {
        await AsyncStorage.removeItem(key).catch(() => {});
    }
    persistLog("fallback.replayed", `${rows.size} rows, ${deletedKeys.size} deletes`);
    reportPersistWriteSuccess();
    return { status: "replayed", keys: rows.size, deletedKeys: deletedKeys.size };
}

/* ── kv access ───────────────────────────────────────────────────────────────── */

export const sqliteStringStorage = {
    getItem: async (name: string): Promise<string | null> => {
        try {
            const db = getDb();
            const row = await db.getFirstAsync<{ value: string }>(
                "SELECT value FROM kv WHERE key = ?",
                name
            );
            if (row?.value != null) {
                lastWritten.set(name, row.value);
                return row.value;
            }

            // One-time migration: adopt the legacy AsyncStorage blob into SQLite.
            const legacy = await AsyncStorage.getItem(name);
            if (legacy != null) {
                try {
                    await db.runAsync(
                        "INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, ?)",
                        name,
                        legacy,
                        Date.now()
                    );
                    lastWritten.set(name, legacy);
                } catch {
                    // Import is best-effort; returning the legacy value is what matters.
                }
            }
            return legacy;
        } catch (err) {
            console.warn("[sqliteStorage] getItem fell back to AsyncStorage:", err);
            // The fallback may legitimately hold data (legacy install, or rows written
            // while SQLite was down). But a null fallback proves nothing about the
            // authoritative store — surface the failure rather than report "empty".
            let fallback: string | null = null;
            try {
                fallback = await AsyncStorage.getItem(name);
            } catch (fallbackErr) {
                throw new KvReadFailedError(`both stores unreadable for "${name}"`, fallbackErr);
            }
            if (fallback == null) {
                throw new KvReadFailedError(`SQLite unreadable for "${name}" and no fallback copy`, err);
            }
            return fallback;
        }
    },

    setItem: (name: string, value: string): Promise<void> =>
        enqueueWrite(async () => {
            if (lastWritten.get(name) === value) return; // unchanged — skip the write
            const startedAt = Date.now();
            try {
                await sqliteCall("setItem", () =>
                    getDb().runAsync(
                        "INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, ?)",
                        name,
                        value,
                        Date.now()
                    )
                );
                lastWritten.set(name, value);
                persistLog("write.sqlite", { ms: Date.now() - startedAt, detail: name });
                reportPersistWriteSuccess();
            } catch (err) {
                // Last-resort durability: keep the write in AsyncStorage if SQLite failed. Do NOT
                // update lastWritten, so the next attempt retries the SQLite write.
                console.warn("[sqliteStorage] setItem fell back to AsyncStorage:", err);
                logWriteFailure(err, "setItem");
                try {
                    await AsyncStorage.setItem(name, value);
                    await recordFallbackWrite([name], []);
                    // Degraded but durable — the library still landed somewhere.
                    reportPersistWriteFallback();
                } catch (fallbackErr) {
                    // Both stores failed — the in-memory store is intact, but nothing is
                    // landing on disk. Count it so a sustained outage surfaces a banner.
                    persistLog("write.failed", `setItem: ${describeError(fallbackErr)}`);
                    reportPersistWriteFailure();
                }
            }
        }),

    removeItem: (name: string): Promise<void> =>
        enqueueWrite(async () => {
            lastWritten.delete(name);
            try {
                await sqliteCall("removeItem", () => getDb().runAsync("DELETE FROM kv WHERE key = ?", name));
            } catch (err) {
                console.warn("[sqliteStorage] removeItem fell back to AsyncStorage:", err);
                await AsyncStorage.removeItem(name);
                await recordFallbackWrite([], [name]);
            }
        }),
};

/**
 * Batch-read several kv rows in a single query (for the sharded persist snapshot: meta +
 * per-workspace rows). Falls back to per-key AsyncStorage reads if SQLite is unavailable.
 * Populates the last-written cache so an immediately-following write can skip unchanged rows.
 */
export async function readManyKv(keys: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (keys.length === 0) return out;

    try {
        const placeholders = keys.map(() => "?").join(",");
        const rows = await getDb().getAllAsync<{ key: string; value: string }>(
            `SELECT key, value FROM kv WHERE key IN (${placeholders})`,
            ...keys
        );
        for (const row of rows) {
            if (row?.key != null && row.value != null) {
                out.set(row.key, row.value);
                lastWritten.set(row.key, row.value);
            }
        }
        return out;
    } catch (err) {
        console.warn("[sqliteStorage] readManyKv fell back to AsyncStorage:", err);
        // Every requested key is a workspace row the meta row references. A partial
        // fallback would hydrate a silently smaller library, and the next write's
        // orphan sweep would make the loss permanent — all-or-nothing instead.
        for (const key of keys) {
            let value: string | null = null;
            try {
                value = await AsyncStorage.getItem(key);
            } catch (fallbackErr) {
                throw new KvReadFailedError(`workspace row unreadable in both stores: ${key}`, fallbackErr);
            }
            if (value == null) {
                throw new KvReadFailedError(`SQLite unreadable and no fallback copy for row: ${key}`, err);
            }
            out.set(key, value);
        }
        return out;
    }
}

/**
 * Newest `updated_at` across the given exact keys and prefixes — the moment SQLite last
 * accepted any part of the library. Used to compare against the shadow manifest's own
 * timestamp at boot. Null when nothing matches or the query fails.
 */
export async function getKvNewestUpdatedAt(exactKeys: string[], prefixes: string[]): Promise<number | null> {
    try {
        const clauses = [
            ...exactKeys.map(() => "key = ?"),
            ...prefixes.map(() => "key LIKE ?"),
        ];
        if (clauses.length === 0) return null;
        const row = await getDb().getFirstAsync<{ newest: number | null }>(
            `SELECT MAX(updated_at) AS newest FROM kv WHERE ${clauses.join(" OR ")}`,
            ...exactKeys,
            ...prefixes.map((prefix) => `${prefix}%`)
        );
        return typeof row?.newest === "number" && Number.isFinite(row.newest) ? row.newest : null;
    } catch {
        return null;
    }
}

/**
 * Commit a sharded snapshot write atomically: all row writes + deletions in ONE SQLite
 * transaction, so a crash can never leave the meta row's workspaceIds pointing at a
 * workspace row that was never written. Rows whose value is byte-identical to the last
 * write are skipped. On SQLite failure, degrades to best-effort per-key AsyncStorage
 * (weaker atomicity, same fallback contract as the rest of this module) and records the
 * rows for replay.
 */
export async function commitShardedWrite(
    writes: { key: string; value: string }[],
    deletes: string[]
): Promise<void> {
    const pendingWrites = writes.filter((row) => lastWritten.get(row.key) !== row.value);
    // DELETE is idempotent, so no need to dedupe deletes against the cache.
    const pendingDeletes = deletes;
    if (pendingWrites.length === 0 && pendingDeletes.length === 0) return;

    let landedInSqlite = false;
    try {
        await enqueueWrite(async () => {
        const startedAt = Date.now();
        try {
            const db = getDb();
            const now = Date.now();
            await sqliteCall("commitShardedWrite", () =>
                db.withTransactionAsync(async () => {
                    for (const row of pendingWrites) {
                        await db.runAsync(
                            "INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, ?)",
                            row.key,
                            row.value,
                            now
                        );
                    }
                    for (const key of pendingDeletes) {
                        await db.runAsync("DELETE FROM kv WHERE key = ?", key);
                    }
                })
            );
            for (const row of pendingWrites) lastWritten.set(row.key, row.value);
            for (const key of pendingDeletes) lastWritten.delete(key);
            persistLog("write.sqlite", {
                ms: Date.now() - startedAt,
                detail: `${pendingWrites.length} rows, ${pendingDeletes.length} deletes`,
            });
            landedInSqlite = true;
            reportPersistWriteSuccess();
        } catch (err) {
            // Do NOT update lastWritten on failure, so the next write retries SQLite.
            console.warn("[sqliteStorage] commitShardedWrite fell back to AsyncStorage:", err);
            logWriteFailure(err, "commitShardedWrite");
            let anyRowLost = false;
            const landed: string[] = [];
            for (const row of pendingWrites) {
                try {
                    await AsyncStorage.setItem(row.key, row.value);
                    landed.push(row.key);
                } catch {
                    // Both stores failed for this row — the in-memory store is still intact.
                    anyRowLost = true;
                }
            }
            const removed: string[] = [];
            for (const key of pendingDeletes) {
                try {
                    await AsyncStorage.removeItem(key);
                    removed.push(key);
                } catch {
                    // ignore
                }
            }
            if (landed.length > 0 || removed.length > 0) {
                await recordFallbackWrite(landed, removed);
            }
            if (anyRowLost) {
                persistLog("write.failed", `commitShardedWrite: ${pendingWrites.length - landed.length} rows lost`);
                reportPersistWriteFailure();
            } else {
                reportPersistWriteFallback();
            }
        }
        });
    } catch (err) {
        // Only the queue-level deadline lands here (the op's own failures are handled
        // above): both stores hung. Nothing landed; say so.
        persistLog("write.failed", `commitShardedWrite queue: ${describeError(err)}`);
        reportPersistWriteFailure();
        return;
    }

    // SQLite took this write: anything still parked in the fallback can come home now.
    if (landedInSqlite && fallbackMarkerCache) {
        await replayPendingFallbackWrites().catch(() => undefined);
    }
}

/**
 * List every kv key sharing a prefix (the per-workspace rows of the sharded snapshot).
 * Used once per session to sweep orphaned workspace rows left by a restore or the
 * legacy→sharded transition. Best-effort — a missed sweep only leaves unread rows.
 */
export async function listKvKeysWithPrefix(prefix: string): Promise<string[]> {
    try {
        return await listKvKeysWithPrefixOrThrow(prefix);
    } catch (err) {
        console.warn("[sqliteStorage] listKvKeysWithPrefix failed:", err);
        return [];
    }
}

/**
 * Strict variant for callers whose decision depends on the listing being TRUE, not
 * merely available — hydration's "is this really a fresh install?" stray-row check
 * must treat a failed listing as unknown disk state, never as "no rows".
 */
export async function listKvKeysWithPrefixOrThrow(prefix: string): Promise<string[]> {
    // Store name is a fixed constant with no LIKE metacharacters, so a plain wildcard
    // is safe here.
    const rows = await getDb().getAllAsync<{ key: string }>(
        "SELECT key FROM kv WHERE key LIKE ?",
        `${prefix}%`
    );
    return rows.map((row) => row.key).filter((key): key is string => key != null);
}

/** Delete a single kv row (used to retire the one-boot legacy-blob backup). Best-effort. */
export async function deleteKv(key: string): Promise<void> {
    await enqueueWrite(async () => {
        lastWritten.delete(key);
        try {
            await sqliteCall("deleteKv", () => getDb().runAsync("DELETE FROM kv WHERE key = ?", key));
        } catch {
            try {
                await AsyncStorage.removeItem(key);
            } catch {
                // ignore
            }
        }
    });
}

/**
 * Write a raw persisted snapshot string directly to the authoritative store, bypassing the
 * zustand pipeline. Used by disaster-recovery restore to commit a verified snapshot to the
 * exact location hydration reads from on next launch.
 */
export async function persistRawSnapshot(name: string, value: string): Promise<void> {
    await enqueueWrite(async () => {
        const startedAt = Date.now();
        try {
            await sqliteCall("persistRawSnapshot", () =>
                getDb().runAsync(
                    "INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, ?)",
                    name,
                    value,
                    Date.now()
                )
            );
            lastWritten.set(name, value);
            persistLog("flush.ok", { ms: Date.now() - startedAt });
            reportPersistWriteSuccess();
        } catch (error) {
            // A fallback copy is still useful for manual recovery, but it is not authoritative
            // while a readable SQLite row exists. Surface the failure so callers never delete
            // media or report a restore as successful without committing SQLite first.
            persistLog("flush.failed", describeError(error));
            try {
                await AsyncStorage.setItem(name, value);
                await recordFallbackWrite([name], []);
            } catch {
                // Preserve the authoritative SQLite error below.
            }
            throw error;
        }
    });
}
