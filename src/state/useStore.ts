import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DataSlice, createDataSlice } from "./dataSlice";
import { SelectionSlice, createSelectionSlice } from "./selectionSlice";
import { RecordingSlice, createRecordingSlice } from "./recordingSlice";
import { PlayerSlice, createPlayerSlice } from "./playerSlice";
import { createInitialWorkspace, normalizeActivityEvents, normalizeWorkspaces } from "./dataSlice";
import type { ActivityEvent } from "../types";
import { isIdeaSort } from "../ideaSort";

export type AppStore = DataSlice & SelectionSlice & RecordingSlice & PlayerSlice;
type PersistedAppStore = Pick<
    AppStore,
    | "workspaces"
    | "activityEvents"
    | "activeWorkspaceId"
    | "preferredRecordingInputId"
    | "ideasFilter"
    | "ideasSort"
    | "primaryFilter"
    | "primarySort"
>;

const STORE_NAME = "song-seed-store";
const STORE_VERSION = 8;

function sanitizePersistedState(state?: Partial<PersistedAppStore>): PersistedAppStore {
    const fallbackWorkspace = createInitialWorkspace();
    const workspaces = Array.isArray(state?.workspaces) && state.workspaces.length > 0
        ? normalizeWorkspaces(state.workspaces)
        : [fallbackWorkspace];

    const activeWorkspaceId =
        state?.activeWorkspaceId &&
        workspaces.some((workspace) => workspace.id === state.activeWorkspaceId && !workspace.isArchived)
            ? state.activeWorkspaceId
            : workspaces.find((workspace) => !workspace.isArchived)?.id ?? null;

    return {
        workspaces,
        activityEvents: normalizeActivityEvents(state?.activityEvents as ActivityEvent[] | undefined),
        activeWorkspaceId,
        preferredRecordingInputId:
            typeof state?.preferredRecordingInputId === "string" ? state.preferredRecordingInputId : null,
        ideasFilter: state?.ideasFilter ?? "all",
        ideasSort: isIdeaSort(state?.ideasSort) ? state.ideasSort : "newest",
        primaryFilter: state?.primaryFilter ?? "all",
        primarySort: isIdeaSort(state?.primarySort) ? state.primarySort : "newest",
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
            partialize: (state) => ({
                workspaces: state.workspaces,
                activityEvents: state.activityEvents,
                activeWorkspaceId: state.activeWorkspaceId,
                preferredRecordingInputId: state.preferredRecordingInputId,
                ideasFilter: state.ideasFilter,
                ideasSort: state.ideasSort,
                primaryFilter: state.primaryFilter,
                primarySort: state.primarySort,
            }),
            merge: (persistedState, currentState) => ({
                ...currentState,
                ...sanitizePersistedState(persistedState as Partial<PersistedAppStore> | undefined),
            }),
        }
    )
);
