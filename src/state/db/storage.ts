import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDb } from "./database";

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
 *   failure degrades gracefully instead of losing access to the library.
 */

// Last value successfully written per key, so unchanged snapshots skip the DB entirely.
const lastWritten = new Map<string, string>();
let writeQueue: Promise<void> = Promise.resolve();

function enqueueWrite(operation: () => Promise<void>) {
    const result = writeQueue.then(operation, operation);
    // Keep the queue usable after a failed write while still returning the failure to its caller.
    writeQueue = result.catch(() => undefined);
    return result;
}

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
            return AsyncStorage.getItem(name);
        }
    },

    setItem: (name: string, value: string): Promise<void> =>
        enqueueWrite(async () => {
            if (lastWritten.get(name) === value) return; // unchanged — skip the write
            try {
                await getDb().runAsync(
                    "INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, ?)",
                    name,
                    value,
                    Date.now()
                );
                lastWritten.set(name, value);
            } catch (err) {
                // Last-resort durability: keep the write in AsyncStorage if SQLite failed. Do NOT
                // update lastWritten, so the next attempt retries the SQLite write.
                console.warn("[sqliteStorage] setItem fell back to AsyncStorage:", err);
                try {
                    await AsyncStorage.setItem(name, value);
                } catch {
                    // Both stores failed — surface nothing; the in-memory store is still intact.
                }
            }
        }),

    removeItem: (name: string): Promise<void> =>
        enqueueWrite(async () => {
            lastWritten.delete(name);
            try {
                await getDb().runAsync("DELETE FROM kv WHERE key = ?", name);
            } catch (err) {
                console.warn("[sqliteStorage] removeItem fell back to AsyncStorage:", err);
                await AsyncStorage.removeItem(name);
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
        for (const key of keys) {
            try {
                const value = await AsyncStorage.getItem(key);
                if (value != null) out.set(key, value);
            } catch {
                // Skip unreadable keys; a partial map still hydrates what it can.
            }
        }
        return out;
    }
}

/**
 * Commit a sharded snapshot write atomically: all row writes + deletions in ONE SQLite
 * transaction, so a crash can never leave the meta row's workspaceIds pointing at a
 * workspace row that was never written. Rows whose value is byte-identical to the last
 * write are skipped. On SQLite failure, degrades to best-effort per-key AsyncStorage
 * (weaker atomicity, same fallback contract as the rest of this module).
 */
export async function commitShardedWrite(
    writes: { key: string; value: string }[],
    deletes: string[]
): Promise<void> {
    const pendingWrites = writes.filter((row) => lastWritten.get(row.key) !== row.value);
    // DELETE is idempotent, so no need to dedupe deletes against the cache.
    const pendingDeletes = deletes;
    if (pendingWrites.length === 0 && pendingDeletes.length === 0) return;

    await enqueueWrite(async () => {
        try {
            const db = getDb();
            const now = Date.now();
            await db.withTransactionAsync(async () => {
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
            });
            for (const row of pendingWrites) lastWritten.set(row.key, row.value);
            for (const key of pendingDeletes) lastWritten.delete(key);
        } catch (err) {
            // Do NOT update lastWritten on failure, so the next write retries SQLite.
            console.warn("[sqliteStorage] commitShardedWrite fell back to AsyncStorage:", err);
            for (const row of pendingWrites) {
                try {
                    await AsyncStorage.setItem(row.key, row.value);
                } catch {
                    // Both stores failed for this row — the in-memory store is still intact.
                }
            }
            for (const key of pendingDeletes) {
                try {
                    await AsyncStorage.removeItem(key);
                } catch {
                    // ignore
                }
            }
        }
    });
}

/**
 * List every kv key sharing a prefix (the per-workspace rows of the sharded snapshot).
 * Used once per session to sweep orphaned workspace rows left by a restore or the
 * legacy→sharded transition. Best-effort — a missed sweep only leaves unread rows.
 */
export async function listKvKeysWithPrefix(prefix: string): Promise<string[]> {
    try {
        // Store name is a fixed constant with no LIKE metacharacters, so a plain wildcard
        // is safe here.
        const rows = await getDb().getAllAsync<{ key: string }>(
            "SELECT key FROM kv WHERE key LIKE ?",
            `${prefix}%`
        );
        return rows.map((row) => row.key).filter((key): key is string => key != null);
    } catch (err) {
        console.warn("[sqliteStorage] listKvKeysWithPrefix failed:", err);
        return [];
    }
}

/** Delete a single kv row (used to retire the one-boot legacy-blob backup). Best-effort. */
export async function deleteKv(key: string): Promise<void> {
    await enqueueWrite(async () => {
        lastWritten.delete(key);
        try {
            await getDb().runAsync("DELETE FROM kv WHERE key = ?", key);
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
        try {
            await getDb().runAsync(
                "INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, ?)",
                name,
                value,
                Date.now()
            );
            lastWritten.set(name, value);
        } catch (error) {
            // A fallback copy is still useful for manual recovery, but it is not authoritative
            // while a readable SQLite row exists. Surface the failure so callers never delete
            // media or report a restore as successful without committing SQLite first.
            try {
                await AsyncStorage.setItem(name, value);
            } catch {
                // Preserve the authoritative SQLite error below.
            }
            throw error;
        }
    });
}
