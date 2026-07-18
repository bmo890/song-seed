import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { clampTransposeOffset } from "../domain/transpose";

/**
 * Per-song chart display preferences — currently the non-destructive transpose
 * offset. Display-level only: chart data itself is never mutated. Satellite
 * store (revisit/shelf pattern), persisted so a transposed book stays
 * transposed across launches.
 */

type PersistedChartPrefsState = {
  /** ideaId -> semitone offset (-11..11, never 0 — 0 entries are removed). */
  transposeByIdeaId: Record<string, number>;
};

export type ChartPrefsStore = PersistedChartPrefsState & {
  setTranspose: (ideaId: string, offset: number) => void;
  nudgeTranspose: (ideaId: string, delta: number) => void;
  resetTranspose: (ideaId: string) => void;
};

const STORE_NAME = "songstead-chart-prefs";
const STORE_VERSION = 1;

function sanitizeOffsets(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const entries = Object.entries(value).filter(
    (entry): entry is [string, number] =>
      typeof entry[0] === "string" &&
      typeof entry[1] === "number" &&
      Number.isInteger(entry[1]) &&
      entry[1] !== 0 &&
      Math.abs(entry[1]) <= 11
  );
  return Object.fromEntries(entries);
}

function withOffset(
  map: Record<string, number>,
  ideaId: string,
  offset: number
): Record<string, number> {
  const next = { ...map };
  if (offset === 0) {
    delete next[ideaId];
  } else {
    next[ideaId] = offset;
  }
  return next;
}

export const useChartPrefsStore = create<ChartPrefsStore>()(
  persist(
    (set) => ({
      transposeByIdeaId: {},

      setTranspose: (ideaId, offset) =>
        set((state) => ({
          transposeByIdeaId: withOffset(
            state.transposeByIdeaId,
            ideaId,
            clampTransposeOffset(offset)
          ),
        })),

      nudgeTranspose: (ideaId, delta) =>
        set((state) => ({
          transposeByIdeaId: withOffset(
            state.transposeByIdeaId,
            ideaId,
            clampTransposeOffset((state.transposeByIdeaId[ideaId] ?? 0) + delta)
          ),
        })),

      resetTranspose: (ideaId) =>
        set((state) => ({
          transposeByIdeaId: withOffset(state.transposeByIdeaId, ideaId, 0),
        })),
    }),
    {
      name: STORE_NAME,
      version: STORE_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ transposeByIdeaId: state.transposeByIdeaId }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        transposeByIdeaId: sanitizeOffsets(
          (persistedState as Partial<PersistedChartPrefsState> | undefined)?.transposeByIdeaId
        ),
      }),
    }
  )
);
