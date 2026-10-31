import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { SpeedUnit } from "../domain/tempoSpeed";

/**
 * How the practice speed is counted, remembered app-wide (founder, 2026-10-31):
 * as a rate ("0.8×") or, on a take recorded with the metronome, as a tempo
 * ("80 bpm"). A take with no tempo always reads in rate; the choice waits for
 * the next take that has one.
 */
type PracticePrefs = {
  speedUnit: SpeedUnit;
  setSpeedUnit: (unit: SpeedUnit) => void;
};

export const usePracticePrefsStore = create<PracticePrefs>()(
  persist(
    (set) => ({
      speedUnit: "rate",
      setSpeedUnit: (speedUnit) => set({ speedUnit }),
    }),
    {
      name: "songnook-practice-prefs",
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ speedUnit: state.speedUnit }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<PracticePrefs> | undefined;
        return { ...current, speedUnit: saved?.speedUnit === "bpm" ? "bpm" : "rate" };
      },
    }
  )
);
