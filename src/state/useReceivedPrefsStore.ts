/**
 * Small persisted preference for how the Compilations hub lists things: which
 * compilations show (all / mine / received from other people) and in what
 * order. Zustand + AsyncStorage, the useShelfStore pattern. The Received page
 * itself always shows everything.
 *
 * v1 held a single "include from others" switch; v2 (2026-10-11) is the
 * collection-style filter + sort pair, migrated so a hidden "from others" stays
 * hidden ("mine").
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CompilationFilter, CompilationSort } from "../domain/compilationListing";

export type ReceivedPrefsStore = {
  compilationFilter: CompilationFilter;
  compilationSort: CompilationSort;
  setCompilationFilter: (value: CompilationFilter) => void;
  setCompilationSort: (value: CompilationSort) => void;
};

const STORE_NAME = "songnook-received-prefs";
const STORE_VERSION = 2;

export const useReceivedPrefsStore = create<ReceivedPrefsStore>()(
  persist(
    (set) => ({
      compilationFilter: "all",
      compilationSort: "updated",
      setCompilationFilter: (value) => set({ compilationFilter: value }),
      setCompilationSort: (value) => set({ compilationSort: value }),
    }),
    {
      name: STORE_NAME,
      version: STORE_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        compilationFilter: state.compilationFilter,
        compilationSort: state.compilationSort,
      }),
      migrate: (persisted: unknown, version) => {
        const prior = (persisted ?? {}) as { includeFromOthers?: boolean };
        if (version < 2) {
          return {
            compilationFilter: prior.includeFromOthers === false ? "mine" : "all",
            compilationSort: "updated",
          } as Partial<ReceivedPrefsStore>;
        }
        return persisted as Partial<ReceivedPrefsStore>;
      },
    }
  )
);
