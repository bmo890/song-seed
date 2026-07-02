import { getDb } from "../state/db/database";
import { setWordLookupPersistentStore } from "../wordTools";

/**
 * Durable Word Finder cache: every Datamuse response (suggestions and
 * definitions) is kept in SQLite so a word a writer has looked up once is
 * free forever on this device — across app restarts and offline.
 *
 * Size guardrails: rows are capped at MAX_ROWS (oldest-written evicted in
 * batches), and a full cache is only ~4–5 MB on disk — trivial next to the
 * audio library. Entries never expire by age because the data never changes.
 */

const MAX_ROWS = 2000;
/** Evict in batches so we don't pay a DELETE scan on every insert. */
const EVICTION_CHECK_EVERY = 100;

let tableReady = false;
let insertsSinceCheck = 0;

function ensureTable() {
  if (tableReady) return;
  getDb().execSync(`
    CREATE TABLE IF NOT EXISTS word_lookup_cache (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  tableReady = true;
}

/** Call once at startup; failures leave the feature on network-only. */
export function installWordLookupCache() {
  setWordLookupPersistentStore({
    async get(key) {
      try {
        ensureTable();
        const row = await getDb().getFirstAsync<{ value: string }>(
          "SELECT value FROM word_lookup_cache WHERE key = ?",
          key
        );
        return row?.value ?? null;
      } catch {
        return null;
      }
    },
    async set(key, value) {
      try {
        ensureTable();
        await getDb().runAsync(
          "INSERT OR REPLACE INTO word_lookup_cache (key, value, updated_at) VALUES (?, ?, ?)",
          key,
          value,
          Date.now()
        );
        insertsSinceCheck += 1;
        if (insertsSinceCheck >= EVICTION_CHECK_EVERY) {
          insertsSinceCheck = 0;
          await getDb().runAsync(
            `DELETE FROM word_lookup_cache WHERE key NOT IN (
              SELECT key FROM word_lookup_cache ORDER BY updated_at DESC LIMIT ?
            )`,
            MAX_ROWS
          );
        }
      } catch {
        // Best-effort: the in-memory cache and network path still work.
      }
    },
  });
}
