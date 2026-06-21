import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDb } from "./database";

/**
 * A string key/value `StateStorage` backed by SQLite, used as the base for zustand's
 * persisted store (wrapped by `createJSONStorage` + the corruption guard in useStore.ts).
 *
 * Safety properties:
 * - SQLite is authoritative. Writes are a single atomic statement.
 * - On first read, a legacy AsyncStorage blob is imported into SQLite once (seamless
 *   migration) and the legacy blob is left in place as an emergency fallback.
 * - If SQLite is ever unavailable, every operation falls back to AsyncStorage, so a
 *   SQLite failure degrades gracefully instead of losing access to the library.
 */
export const sqliteStringStorage = {
    getItem: async (name: string): Promise<string | null> => {
        try {
            const db = getDb();
            const row = db.getFirstSync<{ value: string }>(
                "SELECT value FROM kv WHERE key = ?",
                name
            );
            if (row?.value != null) return row.value;

            // One-time migration: adopt the legacy AsyncStorage blob into SQLite.
            const legacy = await AsyncStorage.getItem(name);
            if (legacy != null) {
                try {
                    db.runSync(
                        "INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, ?)",
                        name,
                        legacy,
                        Date.now()
                    );
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

    setItem: async (name: string, value: string): Promise<void> => {
        try {
            getDb().runSync(
                "INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, ?)",
                name,
                value,
                Date.now()
            );
        } catch (err) {
            // Last-resort durability: keep the write in AsyncStorage if SQLite failed.
            console.warn("[sqliteStorage] setItem fell back to AsyncStorage:", err);
            await AsyncStorage.setItem(name, value);
        }
    },

    removeItem: async (name: string): Promise<void> => {
        try {
            getDb().runSync("DELETE FROM kv WHERE key = ?", name);
        } catch (err) {
            console.warn("[sqliteStorage] removeItem fell back to AsyncStorage:", err);
            await AsyncStorage.removeItem(name);
        }
    },
};

/**
 * Write a raw persisted snapshot string directly to the authoritative store, bypassing the
 * zustand pipeline. Used by disaster-recovery restore to commit a verified snapshot to the
 * exact location hydration reads from on next launch.
 */
export async function persistRawSnapshot(name: string, value: string): Promise<void> {
    await sqliteStringStorage.setItem(name, value);
}
