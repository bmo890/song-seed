import { AppState } from "react-native";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DataSlice, createDataSlice } from "./dataSlice";
import { SelectionSlice, createSelectionSlice } from "./selectionSlice";
import { RecordingSlice, createRecordingSlice } from "./recordingSlice";
import { PlayerSlice, createPlayerSlice } from "./playerSlice";
import {
    createInitialWorkspace,
    normalizeActivityEvents,
    normalizePlaylists,
    normalizeSongbooks,
    normalizeSetlists,
    normalizeWorkspaces,
    resolvePrimaryCollectionIdByWorkspace,
    resolvePrimaryWorkspaceId,
} from "./dataSlice";
import type { ActivityEvent } from "../types";
import { isIdeaSort } from "../ideaSort";
import {
    DEFAULT_BACKUP_REMINDER_FREQUENCY,
    isBackupReminderFrequency,
} from "../backupPreferences";
import {
    DEFAULT_WORKSPACE_LIST_ORDER,
    DEFAULT_WORKSPACE_STARTUP_PREFERENCE,
    isWorkspaceListOrder,
    isWorkspaceStartupPreference,
} from "../libraryNavigation";
import { startManifestSync } from "../services/manifestSync";
import { rebaseWorkspacesManagedMedia } from "./rebaseManagedMedia";
import { createShardedPersistStorage } from "./shardedPersistStorage";
import { consumeIntentionalEmptyStateWrite } from "../services/stateIntegrity";
import {
    clampMetronomeBpm,
    clampMetronomeCountInBars,
    clampMetronomeLevel,
    DEFAULT_METRONOME_BEEP_LEVEL,
    DEFAULT_METRONOME_BPM,
    DEFAULT_METRONOME_COUNT_IN_BARS,
    DEFAULT_METRONOME_HAPTIC_LEVEL,
    DEFAULT_METRONOME_METER_ID,
    DEFAULT_METRONOME_OUTPUTS,
    isMetronomeMeterId,
} from "../metronome";
import { normalizeBluetoothMonitoringCalibrations } from "../bluetoothMonitoring";
import { sanitizeWordLadders } from "../wordLadder";
import { sanitizeCutUpSparks } from "../cutUp";
import { sanitizeMagpieSparks } from "../magpie";
import {
    getLastPersistedIdeaCount,
    isHydrationComplete,
    isPersistBlocked,
    setHydrationComplete,
    setLastPersistedIdeaCount,
    setPersistBlocked,
} from "./persistRuntime";
import { persistedSnapshotChanged } from "./persistChangeDetection";
import {
    buildPersistedAppStoreSnapshot,
    persistAppStoreSnapshot,
    STORE_NAME,
    STORE_VERSION,
} from "./persistedSnapshot";
import type { AppStore, PersistedAppStore } from "./storeTypes";
import { setHapticsEnabled } from "../design/haptics";

export { buildPersistedAppStoreSnapshot, STORE_NAME, STORE_VERSION } from "./persistedSnapshot";
export type { AppStore, PersistedAppStore } from "./storeTypes";

// Corruption guard thresholds: an unauthorized idea-count drop is treated as
// suspected data loss only when it is BOTH large in absolute terms and a large
// fraction of the library, so ordinary edits and small-library deletes never
// trip the persist lock.
const GUARD_MIN_ABS_DROP = 10;
const GUARD_MIN_DROP_FRACTION = 0.4;

function sanitizeTimestampMap(value: unknown, validIds: Set<string>) {
    if (!value || typeof value !== "object") return {};

    const next: Record<string, number> = {};
    Object.entries(value as Record<string, unknown>).forEach(([id, timestamp]) => {
        if (!validIds.has(id) || !Number.isFinite(timestamp)) return;
        next[id] = timestamp as number;
    });
    return next;
}

export function sanitizePersistedState(state?: Partial<PersistedAppStore>): PersistedAppStore {
    const fallbackWorkspace = createInitialWorkspace();
    const normalizedWorkspaces = Array.isArray(state?.workspaces) && state.workspaces.length > 0
        ? normalizeWorkspaces(state.workspaces)
        : [fallbackWorkspace];
    const baseWorkspaces = normalizedWorkspaces.some((workspace) => !workspace.isArchived)
        ? normalizedWorkspaces
        : [fallbackWorkspace, ...normalizedWorkspaces];
    // Heal managed audio URIs against the live document directory so absolute paths
    // that embedded a stale container prefix (notably iOS after reinstall/restore)
    // keep resolving. No-op on Android and after normal updates.
    const workspaces = rebaseWorkspacesManagedMedia(baseWorkspaces);
    const workspaceIds = new Set(workspaces.map((workspace) => workspace.id));
    const activeWorkspaceIds = new Set(
        workspaces.filter((workspace) => !workspace.isArchived).map((workspace) => workspace.id)
    );
    const collectionIds = new Set(
        workspaces.flatMap((workspace) => workspace.collections.map((collection) => collection.id))
    );
    const topLevelCollectionIdsByWorkspace = new Map(
        workspaces.map((workspace) => [
            workspace.id,
            new Set(
                workspace.collections
                    .filter((collection) => !collection.parentCollectionId)
                    .map((collection) => collection.id)
            ),
        ])
    );

    const activeWorkspaceId =
        state?.activeWorkspaceId &&
        workspaces.some((workspace) => workspace.id === state.activeWorkspaceId && !workspace.isArchived)
            ? state.activeWorkspaceId
            : workspaces.find((workspace) => !workspace.isArchived)?.id ?? null;

    return {
        workspaces,
        activityEvents: normalizeActivityEvents(state?.activityEvents as ActivityEvent[] | undefined),
        activeWorkspaceId,
        primaryWorkspaceId: resolvePrimaryWorkspaceId(
            workspaces,
            typeof state?.primaryWorkspaceId === "string" && activeWorkspaceIds.has(state.primaryWorkspaceId)
                ? state.primaryWorkspaceId
                : null
        ),
        primaryCollectionIdByWorkspace: resolvePrimaryCollectionIdByWorkspace(
            workspaces,
            state?.primaryCollectionIdByWorkspace && typeof state.primaryCollectionIdByWorkspace === "object"
                ? Object.fromEntries(
                    Object.entries(state.primaryCollectionIdByWorkspace).filter(([workspaceId, collectionId]) => {
                        if (typeof collectionId !== "string") return false;
                        return topLevelCollectionIdsByWorkspace.get(workspaceId)?.has(collectionId) ?? false;
                    })
                )
                : {}
        ),
        lastUsedWorkspaceId:
            typeof state?.lastUsedWorkspaceId === "string" && workspaceIds.has(state.lastUsedWorkspaceId)
                ? state.lastUsedWorkspaceId
                : null,
        workspaceStartupPreference: isWorkspaceStartupPreference(state?.workspaceStartupPreference)
            ? state.workspaceStartupPreference
            : DEFAULT_WORKSPACE_STARTUP_PREFERENCE,
        workspaceListOrder: isWorkspaceListOrder(state?.workspaceListOrder)
            ? state.workspaceListOrder
            : DEFAULT_WORKSPACE_LIST_ORDER,
        workspaceLastOpenedAt: sanitizeTimestampMap(state?.workspaceLastOpenedAt, workspaceIds),
        collectionLastOpenedAt: sanitizeTimestampMap(state?.collectionLastOpenedAt, collectionIds),
        playlists: normalizePlaylists(state?.playlists),
        songbooks: normalizeSongbooks(state?.songbooks),
        setlists: normalizeSetlists(state?.setlists),
        preferredRecordingInputId:
            typeof state?.preferredRecordingInputId === "string" ? state.preferredRecordingInputId : null,
        bluetoothMonitoringCalibrations: normalizeBluetoothMonitoringCalibrations(
            state?.bluetoothMonitoringCalibrations
        ),
        metronomeBpm:
            typeof state?.metronomeBpm === "number" && Number.isFinite(state.metronomeBpm)
                ? clampMetronomeBpm(state.metronomeBpm)
                : DEFAULT_METRONOME_BPM,
        metronomeMeterId: isMetronomeMeterId(state?.metronomeMeterId)
            ? state.metronomeMeterId
            : DEFAULT_METRONOME_METER_ID,
        metronomeOutputs:
            state?.metronomeOutputs && typeof state.metronomeOutputs === "object"
                ? {
                    beep:
                        typeof state.metronomeOutputs.beep === "boolean"
                            ? state.metronomeOutputs.beep
                            : DEFAULT_METRONOME_OUTPUTS.beep,
                    visual:
                        typeof state.metronomeOutputs.visual === "boolean"
                            ? state.metronomeOutputs.visual
                            : DEFAULT_METRONOME_OUTPUTS.visual,
                    haptic:
                        typeof state.metronomeOutputs.haptic === "boolean"
                            ? state.metronomeOutputs.haptic
                            : DEFAULT_METRONOME_OUTPUTS.haptic,
                }
                : DEFAULT_METRONOME_OUTPUTS,
        metronomeBeepLevel:
            typeof state?.metronomeBeepLevel === "number" && Number.isFinite(state.metronomeBeepLevel)
                ? clampMetronomeLevel(state.metronomeBeepLevel)
                : DEFAULT_METRONOME_BEEP_LEVEL,
        metronomeHapticLevel:
            typeof state?.metronomeHapticLevel === "number" && Number.isFinite(state.metronomeHapticLevel)
                ? clampMetronomeLevel(state.metronomeHapticLevel)
                : DEFAULT_METRONOME_HAPTIC_LEVEL,
        metronomeCountInBars:
            typeof state?.metronomeCountInBars === "number" && Number.isFinite(state.metronomeCountInBars)
                ? clampMetronomeCountInBars(state.metronomeCountInBars)
                : DEFAULT_METRONOME_COUNT_IN_BARS,
        globalCustomClipTags: Array.isArray(state?.globalCustomClipTags) ? state.globalCustomClipTags : [],
        notes: Array.isArray(state?.notes) ? state.notes : [],
        wordLadders: sanitizeWordLadders(state?.wordLadders),
        cutUpSparks: sanitizeCutUpSparks(state?.cutUpSparks),
        magpieSparks: sanitizeMagpieSparks(state?.magpieSparks),
        backupReminderFrequency: isBackupReminderFrequency(state?.backupReminderFrequency)
            ? state.backupReminderFrequency
            : DEFAULT_BACKUP_REMINDER_FREQUENCY,
        hapticsEnabled: state?.hapticsEnabled !== false,
        promptForClipName: state?.promptForClipName !== false,
        // Default true for existing users (data present at hydration) so an upgrade never
        // re-shows the intro; a genuinely fresh install (no persisted workspaces) → false.
        hasSeenWelcome:
            typeof state?.hasSeenWelcome === "boolean"
                ? state.hasSeenWelcome
                : (state?.workspaces?.length ?? 0) > 0,
        firstLaunchAt:
            typeof state?.firstLaunchAt === "number" && Number.isFinite(state.firstLaunchAt)
                ? state.firstLaunchAt
                : null,
        reviewPromptShownAt:
            typeof state?.reviewPromptShownAt === "number" && Number.isFinite(state.reviewPromptShownAt)
                ? state.reviewPromptShownAt
                : null,
        lastSuccessfulBackupAt:
            typeof state?.lastSuccessfulBackupAt === "number" && Number.isFinite(state.lastSuccessfulBackupAt)
                ? state.lastSuccessfulBackupAt
                : null,
        lastSuccessfulBackupFileName:
            typeof state?.lastSuccessfulBackupFileName === "string" &&
            state.lastSuccessfulBackupFileName.trim().length > 0
                ? state.lastSuccessfulBackupFileName
                : null,
        ideasFilter: state?.ideasFilter ?? "all",
        ideasSort: isIdeaSort(state?.ideasSort) ? state.ideasSort : "newest",
        primaryFilter: state?.primaryFilter ?? "all",
        primarySort: isIdeaSort(state?.primarySort) ? state.primarySort : "newest",
    };
}

/**
 * Guarded AsyncStorage adapter that ACTUALLY blocks writes when data
 * loss is detected. This is the real safety net — `partialize` alone
 * can't skip writes because zustand always calls setItem with the result.
 */
// Passive persist writes are DEBOUNCED: zustand's persist middleware calls setItem on
// every set(), and each write serializes the whole library (waveform peak arrays and
// all) on the JS thread — with a real library that per-keystroke cost was the app-wide
// "tap → stutter" lag. Coalescing to a trailing write keeps the durability story (SQLite
// is the safety net; the crash window is under a second, and explicit flushes before
// destructive operations still write through immediately via flushPersistedSnapshot,
// which discards any pending passive write it supersedes).
const PERSIST_WRITE_DEBOUNCE_MS = 800;
// A continuous stream of writes (e.g. playback position ticking into the store every
// ~100ms) would reset a pure trailing debounce forever — cap how long a pending write
// can be postponed so passive persistence can't starve during playback.
const PERSIST_WRITE_MAX_WAIT_MS = 4_000;

let pendingPersistWrite: (() => unknown) | null = null;
let pendingPersistWriteTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPersistWriteFirstScheduledAt: number | null = null;

function schedulePendingPersistWrite(run: () => unknown) {
    pendingPersistWrite = run;
    const now = Date.now();
    if (pendingPersistWriteFirstScheduledAt == null) {
        pendingPersistWriteFirstScheduledAt = now;
    }
    if (pendingPersistWriteTimer) {
        clearTimeout(pendingPersistWriteTimer);
    }
    const maxWaitRemainingMs = Math.max(
        0,
        pendingPersistWriteFirstScheduledAt + PERSIST_WRITE_MAX_WAIT_MS - now
    );
    pendingPersistWriteTimer = setTimeout(() => {
        pendingPersistWriteTimer = null;
        pendingPersistWriteFirstScheduledAt = null;
        const write = pendingPersistWrite;
        pendingPersistWrite = null;
        write?.();
    }, Math.min(PERSIST_WRITE_DEBOUNCE_MS, maxWaitRemainingMs));
}

/** Run any coalesced passive write NOW (app going to background — don't sit on data). */
function flushPendingPersistWrite() {
    if (pendingPersistWriteTimer) {
        clearTimeout(pendingPersistWriteTimer);
        pendingPersistWriteTimer = null;
    }
    pendingPersistWriteFirstScheduledAt = null;
    const write = pendingPersistWrite;
    pendingPersistWrite = null;
    write?.();
}

/** Drop the coalesced passive write — a direct full-state flush supersedes it. */
function discardPendingPersistWrite() {
    if (pendingPersistWriteTimer) {
        clearTimeout(pendingPersistWriteTimer);
        pendingPersistWriteTimer = null;
    }
    pendingPersistWriteFirstScheduledAt = null;
    pendingPersistWrite = null;
}

function createGuardedStorage() {
    // Sharded storage: the library persists as a small meta row + one row per workspace, so
    // an edit rewrites only the workspaces it touched. It's the authoritative SQLite store
    // (imports a legacy AsyncStorage/monolithic blob on first read, falls back to
    // AsyncStorage on SQLite failure), and carries the persist timing telemetry.
    const baseStorage = createShardedPersistStorage();

    // Guard + serialize + write. Runs when the debounced write fires (with the LATEST
    // value), so the corruption checks always inspect exactly what hits disk.
    const runGuardedWrite = (name: string, value: any) => {
        if (isPersistBlocked()) {
            console.warn(
                `[PersistGuard] BLOCKED write to "${name}" — persist is locked due to suspected data corruption.`
            );
            return; // Silently skip the write
        }

        // Inspect the idea count before writing
        if (isHydrationComplete() && getLastPersistedIdeaCount() > 0) {
            try {
                const parsed = typeof value === "string" ? JSON.parse(value) : value;
                const state = (parsed as { state?: PersistedAppStore })?.state;
                if (state?.workspaces) {
                    const lastCount = getLastPersistedIdeaCount();
                    const newIdeaCount = state.workspaces.reduce(
                        (sum: number, ws) => sum + (ws.ideas?.length ?? 0), 0
                    );
                    if (newIdeaCount === 0) {
                        // A deliberate last-item delete is the only valid reason to
                        // transition the persisted library from >0 ideas to 0 ideas.
                        if (!consumeIntentionalEmptyStateWrite()) {
                            setPersistBlocked(true);
                            console.warn(
                                `[PersistGuard] BLOCKED and LOCKED: attempted to write 0 ideas when last known count was ${lastCount}. ` +
                                `All future writes blocked until app restart.`
                            );
                            return; // Block the write
                        }
                    } else {
                        // Catastrophic partial loss: a large, proportionally significant
                        // drop that wasn't authorized by a deliberate bulk delete. Thresholds
                        // are conservative (both absolute and fractional) so ordinary editing
                        // and small-library deletes never trip the lock.
                        const lost = lastCount - newIdeaCount;
                        if (
                            lost >= GUARD_MIN_ABS_DROP &&
                            lost / lastCount >= GUARD_MIN_DROP_FRACTION &&
                            !consumeIntentionalEmptyStateWrite()
                        ) {
                            setPersistBlocked(true);
                            console.warn(
                                `[PersistGuard] BLOCKED and LOCKED: idea count dropped from ${lastCount} to ${newIdeaCount} (−${lost}) ` +
                                `without an authorized bulk delete. All future writes blocked until app restart.`
                            );
                            return; // Block the write
                        }
                    }

                    setLastPersistedIdeaCount(newIdeaCount);
                }
            } catch {
                // If we can't parse it, let it through — better than blocking valid writes
            }
        }

        return baseStorage.setItem(name, value as any);
    };

    return {
        getItem: baseStorage.getItem.bind(baseStorage),
        removeItem: baseStorage.removeItem.bind(baseStorage),
        setItem: (name: string, value: any) => {
            // Transient-only updates (playback position, selection…) leave every
            // persisted field reference-identical — skip them entirely so playback
            // never touches the serializer or SQLite.
            if (!persistedSnapshotChanged(value)) return;
            schedulePendingPersistWrite(() => runGuardedWrite(name, value));
        },
    };
}

// Don't sit on a coalesced write while the app leaves the foreground — flush it so a
// backgrounded/killed app keeps everything up to the last edit.
AppState.addEventListener("change", (nextState) => {
    if (nextState !== "active") {
        flushPendingPersistWrite();
    }
});

export const useStore = create<AppStore>()(
    persist(
        (...a) => ({
            ...createDataSlice(...a),
            ...createSelectionSlice(...a),
            ...createRecordingSlice(...a),
            ...createPlayerSlice(...a),
        }),
        {
            name: STORE_NAME,
            version: STORE_VERSION,
            storage: createGuardedStorage(),
            migrate: (persistedState) =>
                sanitizePersistedState(persistedState as Partial<PersistedAppStore> | undefined),
            partialize: (state) => {
                const snapshot = buildPersistedAppStoreSnapshot(state);

                // Track the idea count for the guarded storage adapter
                if (isHydrationComplete()) {
                    const count = snapshot.workspaces.reduce(
                        (sum, ws) => sum + ws.ideas.length, 0
                    );
                    if (count > 0) {
                        setLastPersistedIdeaCount(count);
                    }
                }

                return snapshot;
            },
            merge: (persistedState, currentState) => ({
                ...currentState,
                ...sanitizePersistedState(persistedState as Partial<PersistedAppStore> | undefined),
            }),
            onRehydrateStorage: () => {
                return (state) => {
                    setHydrationComplete(true);

                    if (state) {
                        // Initialize the last known idea count from the hydrated state
                        setLastPersistedIdeaCount(state.workspaces.reduce(
                            (sum, ws) => sum + ws.ideas.length, 0
                        ));

                        // Start the manifest sync now that hydration is complete
                        startManifestSync(
                            useStore,
                            (s) => buildPersistedAppStoreSnapshot(s as AppStore)
                        );
                    }
                };
            },
        }
    )
);

// Keep the fire-and-forget haptics module (src/design/haptics.ts) in step with the
// persisted preference — on boot, after rehydration, and whenever the toggle changes.
setHapticsEnabled(useStore.getState().hapticsEnabled);
useStore.subscribe((state) => setHapticsEnabled(state.hapticsEnabled));

/**
 * Durably flush the current persisted snapshot to the authoritative store immediately,
 * rather than waiting for zustand's asynchronous persist. Used before media deletions so
 * the metadata change (the audio reference removed) is committed *before* the file is moved
 * to trash — closing the crash window between an in-memory delete and its file removal.
 */
export async function flushPersistedSnapshot(): Promise<void> {
    // The direct write below is built from the CURRENT state, so it supersedes any
    // coalesced passive write still waiting on the debounce — drop it so a stale
    // snapshot can't land after (and overwrite) this newer one.
    discardPendingPersistWrite();
    await persistAppStoreSnapshot(useStore.getState());
}
