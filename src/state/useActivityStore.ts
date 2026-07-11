import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type PersistedActivityState = {
  /** Workspaces/collections excluded from the global heatmap. Missing = included. */
  excludedWorkspaceIds: string[];
  excludedCollectionIds: string[];
};

export type ActivityStore = PersistedActivityState & {
  setWorkspaceIncluded: (workspaceId: string, included: boolean) => void;
  setCollectionIncluded: (collectionId: string, included: boolean) => void;
  resetSourceFilters: () => void;
};

const STORE_NAME = "songstead-activity-store";
const STORE_VERSION = 1;

function sanitizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is string => typeof item === "string")));
}

function sanitizePersistedState(state?: Partial<PersistedActivityState>): PersistedActivityState {
  return {
    excludedWorkspaceIds: sanitizeStringArray(state?.excludedWorkspaceIds),
    excludedCollectionIds: sanitizeStringArray(state?.excludedCollectionIds),
  };
}

function setSourceIncluded(ids: string[], targetId: string, included: boolean) {
  const next = new Set(ids);
  if (included) {
    next.delete(targetId);
  } else {
    next.add(targetId);
  }
  return Array.from(next);
}

export const useActivityStore = create<ActivityStore>()(
  persist(
    (set) => ({
      excludedWorkspaceIds: [],
      excludedCollectionIds: [],

      setWorkspaceIncluded: (workspaceId: string, included: boolean) =>
        set((state: ActivityStore) => ({
          excludedWorkspaceIds: setSourceIncluded(state.excludedWorkspaceIds, workspaceId, included),
        })),

      setCollectionIncluded: (collectionId: string, included: boolean) =>
        set((state: ActivityStore) => ({
          excludedCollectionIds: setSourceIncluded(state.excludedCollectionIds, collectionId, included),
        })),

      resetSourceFilters: () =>
        set({
          excludedWorkspaceIds: [],
          excludedCollectionIds: [],
        }),
    }),
    {
      name: STORE_NAME,
      version: STORE_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        excludedWorkspaceIds: state.excludedWorkspaceIds,
        excludedCollectionIds: state.excludedCollectionIds,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...sanitizePersistedState(persistedState as Partial<PersistedActivityState> | undefined),
      }),
    }
  )
);
