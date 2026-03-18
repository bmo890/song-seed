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
            storage: createJSONStorage(() => AsyncStorage),
            migrate: (persistedState) =>
                sanitizePersistedState(persistedState as Partial<PersistedAppStore> | undefined),
            partialize: (state) => buildPersistedAppStoreSnapshot(state),
            merge: (persistedState, currentState) => ({
                ...currentState,
                ...sanitizePersistedState(persistedState as Partial<PersistedAppStore> | undefined),
            }),
        }
    )
);
