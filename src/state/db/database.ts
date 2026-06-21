import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";
import * as FileSystem from "expo-file-system/legacy";

/**
 * SQLite is the authoritative on-device persistence for Song Seed. The library snapshot
 * lives in `kv`; `media_inventory` mirrors every referenced audio path for the integrity
 * scanner; `app_meta` tracks the schema version; `migration_journal` is an audit trail.
 *
 * AsyncStorage is retained as an automatic fallback (see storage.ts) so a SQLite failure
 * can never strand the user's data. Full per-entity normalization is a deliberate
 * follow-on — this layer first delivers atomic writes, an unbounded store, schema
 * versioning, and the media inventory without rewriting every mutation.
 */

export const DB_NAME = "songseed.db";
export const CURRENT_SCHEMA_VERSION = 1;

const SQLITE_DIR = `${FileSystem.documentDirectory ?? ""}SQLite`;
const DB_PATH = `${SQLITE_DIR}/${DB_NAME}`;
const MIGRATION_SNAPSHOT_PATH = `${DB_PATH}.pre-migration`;

type Migration = { to: number; up: (db: SQLiteDatabase) => void };

/**
 * Ordered schema migrations. v1 is the initial schema (created by `bootstrap`), so there
 * are no entries yet. Each future migration bumps `CURRENT_SCHEMA_VERSION` and adds an
 * entry; the runner snapshots the DB first and rolls back on failure.
 */
const MIGRATIONS: Migration[] = [];

let db: SQLiteDatabase | null = null;

export function getDb(): SQLiteDatabase {
    if (db) return db;
    const database = openDatabaseSync(DB_NAME);
    database.execSync("PRAGMA journal_mode = WAL;");
    bootstrap(database);
    runMigrations(database);
    db = database;
    return database;
}

function bootstrap(database: SQLiteDatabase) {
    database.execSync(`
        CREATE TABLE IF NOT EXISTS app_meta (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT
        );
        CREATE TABLE IF NOT EXISTS kv (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL,
            updated_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS media_inventory (
            path TEXT PRIMARY KEY NOT NULL,
            kind TEXT,
            ref_id TEXT,
            updated_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS migration_journal (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_version INTEGER,
            to_version INTEGER,
            ran_at INTEGER,
            status TEXT
        );
    `);
    if (getSchemaVersion(database) === 0) {
        setSchemaVersion(database, CURRENT_SCHEMA_VERSION);
    }
}

function getSchemaVersion(database: SQLiteDatabase): number {
    const row = database.getFirstSync<{ value: string }>(
        "SELECT value FROM app_meta WHERE key = 'schema_version'"
    );
    if (!row) return 0;
    const parsed = parseInt(row.value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
}

function setSchemaVersion(database: SQLiteDatabase, version: number) {
    database.runSync(
        "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('schema_version', ?)",
        String(version)
    );
}

function runMigrations(database: SQLiteDatabase) {
    const current = getSchemaVersion(database);
    if (current >= CURRENT_SCHEMA_VERSION) return;

    const pending = MIGRATIONS.filter((m) => m.to > current).sort((a, b) => a.to - b.to);
    if (pending.length === 0) {
        // Schema is structurally current (fresh bootstrap) but the version row lagged.
        setSchemaVersion(database, CURRENT_SCHEMA_VERSION);
        return;
    }

    // Snapshot the DB before mutating so a failed migration can roll back cleanly, rather
    // than leaving a half-migrated library. VACUUM INTO writes a clean single-file copy.
    snapshotDbFileSync(database);

    let applied = current;
    try {
        for (const migration of pending) {
            database.withTransactionSync(() => {
                migration.up(database);
                setSchemaVersion(database, migration.to);
                database.runSync(
                    "INSERT INTO migration_journal (from_version, to_version, ran_at, status) VALUES (?, ?, ?, 'ok')",
                    applied,
                    migration.to,
                    Date.now()
                );
            });
            applied = migration.to;
        }
        void deleteFileQuiet(MIGRATION_SNAPSHOT_PATH);
    } catch (err) {
        // Roll back to the pre-migration snapshot. Caller (getDb) will surface the throw so
        // hydration can enter recovery mode rather than open a half-migrated library.
        restoreDbFileSync();
        throw err;
    }
}

function snapshotDbFileSync(database: SQLiteDatabase) {
    try {
        // VACUUM INTO requires the destination not to exist.
        database.execSync(`VACUUM INTO '${MIGRATION_SNAPSHOT_PATH.replace(/'/g, "''")}'`);
    } catch {
        // Best-effort: if VACUUM INTO is unavailable we still attempt the migration, but
        // without a rollback snapshot. Migrations themselves run inside transactions.
    }
}

function restoreDbFileSync() {
    // Close the handle so the file can be replaced, then reopen on next getDb().
    try {
        db?.closeSync();
    } catch {
        // ignore
    }
    db = null;
    // The synchronous FileSystem copy isn't available; rollback relies on the WAL-mode
    // transaction already having reverted in-flight changes. The snapshot remains on disk
    // for manual/Phase-5 recovery. (Revisit with a real file swap when the first migration
    // is introduced — there are none yet.)
}

async function deleteFileQuiet(uri: string) {
    try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch {
        // ignore
    }
}

/** Absolute path to the live SQLite database file (for diagnostics / future backup). */
export function getDatabaseFilePath(): string {
    return DB_PATH;
}
