/**
 * Shadow manifest: writes a full copy of workspace metadata to disk
 * so that if AsyncStorage is ever wiped/corrupted, recovery can
 * restore the complete workspace hierarchy, titles, notes, lyrics,
 * clip associations, practice markers, and all other metadata.
 *
 * The manifest is a SHADOW — AsyncStorage remains the primary store.
 * The manifest is ONLY read during recovery.
 */

import * as FileSystem from "expo-file-system/legacy";
import {
    SONG_SEED_ROOT,
    SONG_SEED_MANIFEST_PATH,
    SONG_SEED_MANIFEST_TMP_PATH,
} from "./storagePaths";
import type { PersistedAppStore } from "../state/useStore";
import {
    getLastPersistedIdeaCount,
    isHydrationComplete,
    isPersistBlocked,
} from "../state/persistRuntime";
import { consumeIntentionalEmptyStateWrite } from "./stateIntegrity";

/* ── Schema ────────────────────────────────────────────────────── */

const MANIFEST_SCHEMA_VERSION = 1;

export type ManifestData = PersistedAppStore & {
    schemaVersion: number;
    lastWrittenAt: string;
};

/* ── Read ──────────────────────────────────────────────────────── */

/**
 * Read the manifest from disk. Returns null if it doesn't exist
 * or is corrupted/unparseable.
 */
export async function readManifest(): Promise<ManifestData | null> {
    // Try the primary manifest first, then fall back to the backup
    // (backup exists if the app crashed mid-write)
    const candidates = [
        SONG_SEED_MANIFEST_PATH,
        `${SONG_SEED_ROOT}/manifest.backup.json`,
    ];

    for (const path of candidates) {
        try {
            const info = await FileSystem.getInfoAsync(path);
            if (!info.exists) continue;

            const raw = await FileSystem.readAsStringAsync(path);
            const parsed = JSON.parse(raw) as ManifestData;

            // Basic validation
            if (
                typeof parsed.schemaVersion !== "number" ||
                !Array.isArray(parsed.workspaces)
            ) {
                console.warn(`[ManifestSync] Manifest at ${path} failed validation, skipping.`);
                continue;
            }

            return parsed;
        } catch (err) {
            console.warn(`[ManifestSync] Failed to read manifest at ${path}:`, err);
        }
    }

    return null;
}

/**
 * Count total ideas across all workspaces in a manifest or store state.
 */
function countTotalIdeas(workspaces: PersistedAppStore["workspaces"]): number {
    return workspaces.reduce((sum, ws) => sum + ws.ideas.length, 0);
}

/* ── Write ─────────────────────────────────────────────────────── */

/**
 * Write the manifest to disk atomically (tmp file → rename).
 * Includes a critical guard: refuses to write if the new state
 * appears to be empty/default but the existing manifest has real data.
 */
async function writeManifestToDisk(state: PersistedAppStore): Promise<void> {
    try {
        // Ensure root directory exists
        const rootInfo = await FileSystem.getInfoAsync(SONG_SEED_ROOT);
        if (!rootInfo.exists) {
            await FileSystem.makeDirectoryAsync(SONG_SEED_ROOT, { intermediates: true });
        }

        // ── CRITICAL GUARD ──
        // Prevent writing empty state over real data (the exact bug that caused data loss)
        const newIdeaCount = countTotalIdeas(state.workspaces);
        const newWorkspaceCount = state.workspaces.filter((ws) => !ws.isArchived).length;

        if (newIdeaCount === 0 || newWorkspaceCount === 0) {
            // Check if the existing manifest has data
            const existing = await readManifest();
            if (existing) {
                const existingIdeaCount = countTotalIdeas(existing.workspaces);
                if (existingIdeaCount > 0) {
                    // The manifest must accept an intentional last-item delete while
                    // still rejecting unexpected empty-state rewrites during corruption.
                    const hydratedEmptyStateIsAuthoritative =
                        isHydrationComplete() &&
                        !isPersistBlocked() &&
                        getLastPersistedIdeaCount() === 0;

                    if (!consumeIntentionalEmptyStateWrite() && !hydratedEmptyStateIsAuthoritative) {
                        console.warn(
                            `[ManifestSync] BLOCKED: refusing to write manifest with ${newIdeaCount} ideas ` +
                            `over existing manifest with ${existingIdeaCount} ideas. ` +
                            `This looks like a state corruption event.`
                        );
                        return;
                    }

                    if (hydratedEmptyStateIsAuthoritative) {
                        // If AsyncStorage already hydrated into a stable empty library, the
                        // shadow manifest is stale and must be allowed to catch up on restart.
                    }
                }
            }
        }

        const manifest: ManifestData = {
            schemaVersion: MANIFEST_SCHEMA_VERSION,
            lastWrittenAt: new Date().toISOString(),
            ...state,
        };

        const json = JSON.stringify(manifest);

        // Write strategy: write to tmp, then swap.
        // We keep a backup (manifest.backup.json) to survive crashes.
        const backupPath = `${SONG_SEED_ROOT}/manifest.backup.json`;

        await FileSystem.writeAsStringAsync(SONG_SEED_MANIFEST_TMP_PATH, json);

        // If a manifest already exists, back it up BEFORE deleting
        const existingInfo = await FileSystem.getInfoAsync(SONG_SEED_MANIFEST_PATH);
        if (existingInfo.exists) {
            // Copy current manifest to backup (survives crashes during the swap)
            await FileSystem.copyAsync({
                from: SONG_SEED_MANIFEST_PATH,
                to: backupPath,
            });
            await FileSystem.deleteAsync(SONG_SEED_MANIFEST_PATH, { idempotent: true });
        }

        // Move tmp to final location
        await FileSystem.moveAsync({
            from: SONG_SEED_MANIFEST_TMP_PATH,
            to: SONG_SEED_MANIFEST_PATH,
        });

        // Clean up backup after successful write
        await FileSystem.deleteAsync(backupPath, { idempotent: true });
    } catch (err) {
        // Never crash the app — manifest is a safety net, not critical path
        console.warn("[ManifestSync] Failed to write manifest:", err);
    }
}

/* ── Debounced subscription ───────────────────────────────────── */

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingState: PersistedAppStore | null = null;
let isWriting = false;
let unsubscribe: (() => void) | null = null;

const DEBOUNCE_MS = 5000;

function flushPendingWrite() {
    if (isWriting || !pendingState) return;

    const state = pendingState;
    pendingState = null;
    isWriting = true;

    writeManifestToDisk(state).finally(() => {
        isWriting = false;
        // If another change came in while we were writing, flush it
        if (pendingState) {
            flushPendingWrite();
        }
    });
}

function scheduleWrite(state: PersistedAppStore) {
    pendingState = state;

    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(flushPendingWrite, DEBOUNCE_MS);
}

/**
 * Start syncing the manifest to disk whenever the store changes.
 * Call this ONCE after hydration is complete.
 *
 * Pass `buildSnapshot` so we use the same partialize logic as
 * the zustand persist middleware.
 */
export function startManifestSync(
    store: {
        getState: () => unknown;
        subscribe: (listener: (state: unknown) => void) => () => void;
    },
    buildSnapshot: (state: unknown) => PersistedAppStore
): void {
    if (unsubscribe) {
        // Already started — don't double-subscribe
        return;
    }

    // Write initial manifest immediately (in case it doesn't exist yet)
    const initialSnapshot = buildSnapshot(store.getState());
    writeManifestToDisk(initialSnapshot);

    // Subscribe to future changes
    unsubscribe = store.subscribe((state) => {
        const snapshot = buildSnapshot(state);
        scheduleWrite(snapshot);
    });
}

/**
 * Force an immediate manifest write (e.g. after recovery or archive restore).
 */
export async function forceManifestWrite(state: PersistedAppStore): Promise<void> {
    // Clear any pending debounced write
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
    pendingState = null;
    await writeManifestToDisk(state);
}

/**
 * Stop the manifest sync subscription.
 */
export function stopManifestSync(): void {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
}
