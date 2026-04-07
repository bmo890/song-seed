import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type PersistedRevisitState = {
  excludedWorkspaceIds: string[];
  excludedCollectionIds: string[];
  hiddenCandidateIds: string[];
  snoozedUntilById: Record<string, number>;
  vaultExposureCountById: Record<string, number>;
  vaultLastSeenAtById: Record<string, number>;
  vaultLastSessionKeyById: Record<string, string>;
};

export type RevisitStore = PersistedRevisitState & {
  setWorkspaceIncluded: (workspaceId: string, included: boolean) => void;
  setCollectionIncluded: (collectionId: string, included: boolean) => void;
  resetSourceFilters: () => void;
  hideCandidate: (candidateKey: string) => void;
  restoreHiddenCandidates: () => void;
  snoozeCandidate: (candidateKey: string, durationMs: number) => void;
  clearExpiredSnoozes: (now?: number) => void;
  markVaultExposure: (candidateKeys: string[], sessionKey: string, seenAt?: number) => void;
};

const STORE_NAME = "song-seed-revisit-store";
const STORE_VERSION = 3;

function sanitizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is string => typeof item === "string")));
}

function sanitizeNumericRecord(value: unknown) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] =>
        typeof entry[0] === "string" && Number.isFinite(entry[1])
    )
  );
}

function sanitizeStringRecord(value: unknown) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === "string" && typeof entry[1] === "string"
    )
  );
}

function sanitizePersistedState(state?: Partial<PersistedRevisitState>): PersistedRevisitState {
  return {
    excludedWorkspaceIds: sanitizeStringArray(state?.excludedWorkspaceIds),
    excludedCollectionIds: sanitizeStringArray(state?.excludedCollectionIds),
    hiddenCandidateIds: sanitizeStringArray(state?.hiddenCandidateIds),
    snoozedUntilById: sanitizeNumericRecord(state?.snoozedUntilById),
    vaultExposureCountById: sanitizeNumericRecord(state?.vaultExposureCountById),
    vaultLastSeenAtById: sanitizeNumericRecord(state?.vaultLastSeenAtById),
    vaultLastSessionKeyById: sanitizeStringRecord(state?.vaultLastSessionKeyById),
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

export const useRevisitStore = create<RevisitStore>()(
  persist(
    (set) => ({
      excludedWorkspaceIds: [],
      excludedCollectionIds: [],
      hiddenCandidateIds: [],
      snoozedUntilById: {},
      vaultExposureCountById: {},
      vaultLastSeenAtById: {},
      vaultLastSessionKeyById: {},

      setWorkspaceIncluded: (workspaceId: string, included: boolean) =>
        set((state: RevisitStore) => ({
          excludedWorkspaceIds: setSourceIncluded(
            state.excludedWorkspaceIds,
            workspaceId,
            included
          ),
        })),

      setCollectionIncluded: (collectionId: string, included: boolean) =>
        set((state: RevisitStore) => ({
          excludedCollectionIds: setSourceIncluded(
            state.excludedCollectionIds,
            collectionId,
            included
          ),
        })),

      resetSourceFilters: () =>
        set({
          excludedWorkspaceIds: [],
          excludedCollectionIds: [],
        }),

      hideCandidate: (candidateKey: string) =>
        set((state: RevisitStore) => ({
          hiddenCandidateIds: Array.from(
            new Set([...state.hiddenCandidateIds, candidateKey])
          ),
        })),

      restoreHiddenCandidates: () =>
        set({
          hiddenCandidateIds: [],
        }),

      snoozeCandidate: (candidateKey: string, durationMs: number) =>
        set((state: RevisitStore) => ({
          snoozedUntilById: {
            ...state.snoozedUntilById,
            [candidateKey]: Date.now() + Math.max(durationMs, 0),
          },
        })),

      clearExpiredSnoozes: (now = Date.now()) =>
        set((state: RevisitStore) => {
          const nextSnoozedUntilById = Object.fromEntries(
            Object.entries(state.snoozedUntilById).filter(
              (entry): entry is [string, number] => entry[1] > now
            )
          );

          if (
            Object.keys(nextSnoozedUntilById).length ===
            Object.keys(state.snoozedUntilById).length
          ) {
            return state;
          }

          return {
            snoozedUntilById: nextSnoozedUntilById,
          };
        }),

      markVaultExposure: (
        candidateKeys: string[],
        sessionKey: string,
        seenAt = Date.now()
      ) =>
        set((state: RevisitStore) => {
          if (candidateKeys.length === 0) return state;

          const nextExposureCountById = { ...state.vaultExposureCountById };
          const nextLastSeenAtById = { ...state.vaultLastSeenAtById };
          const nextLastSessionKeyById = { ...state.vaultLastSessionKeyById };
          let changed = false;

          for (const candidateKey of candidateKeys) {
            if (!candidateKey) continue;
            if (nextLastSessionKeyById[candidateKey] === sessionKey) continue;
            nextExposureCountById[candidateKey] =
              (nextExposureCountById[candidateKey] ?? 0) + 1;
            nextLastSeenAtById[candidateKey] = seenAt;
            nextLastSessionKeyById[candidateKey] = sessionKey;
            changed = true;
          }

          if (!changed) return state;

          return {
            vaultExposureCountById: nextExposureCountById,
            vaultLastSeenAtById: nextLastSeenAtById,
            vaultLastSessionKeyById: nextLastSessionKeyById,
          };
        }),
    }),
    {
      name: STORE_NAME,
      version: STORE_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        excludedWorkspaceIds: state.excludedWorkspaceIds,
        excludedCollectionIds: state.excludedCollectionIds,
        hiddenCandidateIds: state.hiddenCandidateIds,
        snoozedUntilById: state.snoozedUntilById,
        vaultExposureCountById: state.vaultExposureCountById,
        vaultLastSeenAtById: state.vaultLastSeenAtById,
        vaultLastSessionKeyById: state.vaultLastSessionKeyById,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...sanitizePersistedState(
          persistedState as Partial<PersistedRevisitState> | undefined
        ),
      }),
    }
  )
);
