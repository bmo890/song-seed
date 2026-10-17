import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * The sparks' one text size, remembered (founder picked A, 2026-10-17): it
 * used to reset every time a spark opened, and per step in Borrowed Words.
 */
export const SPARK_ZOOM_MIN = 0.5;
export const SPARK_ZOOM_MAX = 1.6;

type SparkPrefs = {
  zoom: number;
  setZoom: (zoom: number) => void;
};

function clampZoom(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 1;
  return Math.max(SPARK_ZOOM_MIN, Math.min(SPARK_ZOOM_MAX, n));
}

export const useSparkPrefsStore = create<SparkPrefs>()(
  persist(
    (set) => ({
      zoom: 1,
      setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
    }),
    {
      name: "songnook-spark-prefs",
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ zoom: state.zoom }),
      merge: (persisted, current) => ({
        ...current,
        zoom: clampZoom((persisted as Partial<SparkPrefs> | undefined)?.zoom),
      }),
    }
  )
);
