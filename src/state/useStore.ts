import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DataSlice, createDataSlice } from "./dataSlice";
import { SelectionSlice, createSelectionSlice } from "./selectionSlice";
import { RecordingSlice, createRecordingSlice } from "./recordingSlice";
import { PlayerSlice, createPlayerSlice } from "./playerSlice";
import {
    createInitialWorkspace,
    normalizeActivityEvents,
    normalizePlaylists,
    normalizeWorkspaces,
} from "./dataSlice";
import type { ActivityEvent } from "../types";
import { isIdeaSort } from "../ideaSort";
import {
    DEFAULT_WORKSPACE_LIST_ORDER,
    DEFAULT_WORKSPACE_STARTUP_PREFERENCE,
    isWorkspaceListOrder,
    isWorkspaceStartupPreference,
} from "../libraryNavigation";
import { startManifestSync } from "../services/manifestSync";
import { consumeIntentionalEmptyStateWrite } from "../services/stateIntegrity";

export type AppStore = DataSlice & SelectionSlice & RecordingSlice & PlayerSlice;
export type PersistedAppStore = Pick<
    AppStore,
    | "workspaces"
    | "activityEvents"
    | "activeWorkspaceId"
    | "primaryWorkspaceId"
    | "lastUsedWorkspaceId"
    | "workspaceStartupPreference"
    | "workspaceListOrder"
    | "workspaceLastOpenedAt"
    | "collectionLastOpenedAt"
    | "playlists"
    | "preferredRecordingInputId"
    | "globalCustomClipTags"
    | "ideasFilter"
    | "ideasSort"
    | "primaryFilter"
    | "primarySort"
>;

export const STORE_NAME = "song-seed-store";
export const STORE_VERSION = 8;

function sanitizeTimestampMap(value: unknown, validIds: Set<string>) {
    if (!value || typeof value !== "object") return {};

    const next: Record<string, number> = {};
    Object.entries(value as Record<string, unknown>).forEach(([id, timestamp]) => {
        if (!validIds.has(id) || !Number.isFinite(timestamp)) return;
        next[id] = timestamp as number;
    });
    return next;
}

function sanitizePersistedState(state?: Partial<PersistedAppStore>): PersistedAppStore {
    const fallbackWorkspace = createInitialWorkspace();
    const workspaces = Array.isArray(state?.workspaces) && state.workspaces.length > 0
        ? normalizeWorkspaces(state.workspaces)
        : [fallbackWorkspace];
    const workspaceIds = new Set(workspaces.map((workspace) => workspace.id));
    const activeWorkspaceIds = new Set(
        workspaces.filter((workspace) => !workspace.isArchived).map((workspace) => workspace.id)
    );
    const collectionIds = new Set(
        workspaces.flatMap((workspace) => workspace.collections.map((collection) => collection.id))
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
        primaryWorkspaceId:
            typeof state?.primaryWorkspaceId === "string" && activeWorkspaceIds.has(state.primaryWorkspaceId)
                ? state.primaryWorkspaceId
                : null,
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
        preferredRecordingInputId:
            typeof state?.preferredRecordingInputId === "string" ? state.preferredRecordingInputId : null,
        globalCustomClipTags: Array.isArray(state?.globalCustomClipTags) ? state.globalCustomClipTags : [],
        ideasFilter: state?.ideasFilter ?? "all",
        ideasSort: isIdeaSort(state?.ideasSort) ? state.ideasSort : "newest",
        primaryFilter: state?.primaryFilter ?? "all",
        primarySort: isIdeaSort(state?.primarySort) ? state.primarySort : "newest",
    };
}

export function buildPersistedAppStoreSnapshot(state: AppStore): PersistedAppStore {
    return {
        workspaces: state.workspaces,
        activityEvents: state.activityEvents,
        activeWorkspaceId: state.activeWorkspaceId,
        primaryWorkspaceId: state.primaryWorkspaceId,
        lastUsedWorkspaceId: state.lastUsedWorkspaceId,
        workspaceStartupPreference: state.workspaceStartupPreference,
        workspaceListOrder: state.workspaceListOrder,
        workspaceLastOpenedAt: state.workspaceLastOpenedAt,
        collectionLastOpenedAt: state.collectionLastOpenedAt,
        playlists: state.playlists,
        preferredRecordingInputId: state.preferredRecordingInputId,
        globalCustomClipTags: state.globalCustomClipTags,
        ideasFilter: state.ideasFilter,
        ideasSort: state.ideasSort,
        primaryFilter: state.primaryFilter,
        primarySort: state.primarySort,
    };
}

/**
 * Tracks whether zustand's persist middleware has finished hydrating
 * from AsyncStorage. The manifest writer must NOT start until this
 * is true — otherwise it could write the empty default state to disk.
 */
let _hydrationComplete = false;
export function isHydrationComplete() {
    return _hydrationComplete;
}

/**
 * Tracks the last known idea count that was successfully persisted.
 * Used by the persist guard to detect state corruption (sudden drop to 0).
 */
let _lastPersistedIdeaCount = -1; // -1 = not yet initialized
export function getLastPersistedIdeaCount() {
    return _lastPersistedIdeaCount;
}

/**
 * Whether the persist guard has blocked a write. Once blocked,
 * ALL subsequent writes are blocked until the app restarts.
 * This prevents a corrupted state from eventually sneaking through.
 */
let _persistBlocked = false;
export function isPersistBlocked() {
    return _persistBlocked;
}

/**
 * Guarded AsyncStorage adapter that ACTUALLY blocks writes when data
 * loss is detected. This is the real safety net — `partialize` alone
 * can't skip writes because zustand always calls setItem with the result.
 */
function createGuardedStorage() {
    const baseStorage = createJSONStorage(() => AsyncStorage)!;

    return {
        getItem: baseStorage.getItem.bind(baseStorage),
        removeItem: baseStorage.removeItem.bind(baseStorage),
        setItem: (name: string, value: any) => {
            if (_persistBlocked) {
                console.warn(
                    `[PersistGuard] BLOCKED write to "${name}" — persist is locked due to suspected data corruption.`
                );
                return; // Silently skip the write
            }

            // Parse the value to check idea count before writing
            if (_hydrationComplete && _lastPersistedIdeaCount > 0) {
                try {
                    const parsed = typeof value === "string" ? JSON.parse(value) : value;
                    const state = (parsed as { state?: PersistedAppStore })?.state;
                    if (state?.workspaces) {
                        const newIdeaCount = state.workspaces.reduce(
                            (sum: number, ws) => sum + (ws.ideas?.length ?? 0), 0
                        );
                        if (newIdeaCount === 0) {
                            // A deliberate last-item delete is the only valid reason to
                            // transition the persisted library from >0 ideas to 0 ideas.
                            if (!consumeIntentionalEmptyStateWrite()) {
                                _persistBlocked = true;
                                console.warn(
                                    `[PersistGuard] BLOCKED and LOCKED: attempted to write 0 ideas when last known count was ${_lastPersistedIdeaCount}. ` +
                                    `All future writes blocked until app restart.`
                                );
                                return; // Block the write
                            }
                        }

                        _lastPersistedIdeaCount = newIdeaCount;
                    }
                } catch {
                    // If we can't parse it, let it through — better than blocking valid writes
                }
            }

            return baseStorage.setItem(name, value as any);
        },
    };
}

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
                if (_hydrationComplete) {
                    const count = snapshot.workspaces.reduce(
                        (sum, ws) => sum + ws.ideas.length, 0
                    );
                    if (count > 0) {
                        _lastPersistedIdeaCount = count;
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
                    _hydrationComplete = true;

                    if (state) {
                        // Initialize the last known idea count from the hydrated state
                        _lastPersistedIdeaCount = state.workspaces.reduce(
                            (sum, ws) => sum + ws.ideas.length, 0
                        );

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
