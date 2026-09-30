/**
 * Small persisted preference for how received work shows up OUTSIDE the
 * Received page: whether Compilations lists mix in setlists and songbooks
 * that came from other people. Zustand + AsyncStorage, the useShelfStore
 * pattern. The Received page itself always shows everything.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ReceivedPrefsStore = {
  /** Show compilations from other people alongside your own. Default on. */
  includeFromOthers: boolean;
  setIncludeFromOthers: (value: boolean) => void;
};

const STORE_NAME = "songnook-received-prefs";
const STORE_VERSION = 1;

export const useReceivedPrefsStore = create<ReceivedPrefsStore>()(
  persist(
    (set) => ({
      includeFromOthers: true,
      setIncludeFromOthers: (value) => set({ includeFromOthers: value }),
    }),
    {
      name: STORE_NAME,
      version: STORE_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ includeFromOthers: state.includeFromOthers }),
    }
  )
);
