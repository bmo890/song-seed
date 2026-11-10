import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * The sparks' one text size, remembered (founder picked A, 2026-10-17): it
 * used to reset every time a spark opened, and per step in Borrowed Words.
 * Also the Lyric Spark list's filter and order (2026-11-10): which kinds of
 * spark it shows (none lit = every kind) and newest or oldest first.
 */
export const SPARK_ZOOM_MIN = 0.5;
export const SPARK_ZOOM_MAX = 1.6;

export type SparkKind = "ladder" | "cutup" | "magpie";
export const SPARK_KINDS: readonly SparkKind[] = ["ladder", "cutup", "magpie"];
export type SparkListOrder = "desc" | "asc";

type PersistedSparkPrefs = {
  zoom: number;
  kinds: SparkKind[];
  order: SparkListOrder;
};

type SparkPrefs = PersistedSparkPrefs & {
  setZoom: (zoom: number) => void;
  toggleKind: (kind: SparkKind) => void;
  clearKinds: () => void;
  setOrder: (order: SparkListOrder) => void;
};

function clampZoom(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 1;
  return Math.max(SPARK_ZOOM_MIN, Math.min(SPARK_ZOOM_MAX, n));
}

/** Only known kinds, in canonical order; all three lit means no filter. */
function sanitizeKinds(value: unknown): SparkKind[] {
  const list = Array.isArray(value) ? value : [];
  const kept = SPARK_KINDS.filter((kind) => list.includes(kind));
  return kept.length === SPARK_KINDS.length ? [] : kept;
}

function sanitizeOrder(value: unknown): SparkListOrder {
  return value === "asc" ? "asc" : "desc";
}

export const useSparkPrefsStore = create<SparkPrefs>()(
  persist(
    (set) => ({
      zoom: 1,
      kinds: [],
      order: "desc",
      setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
      toggleKind: (kind) =>
        set((state) => ({
          kinds: sanitizeKinds(
            state.kinds.includes(kind) ? state.kinds.filter((k) => k !== kind) : [...state.kinds, kind]
          ),
        })),
      clearKinds: () => set({ kinds: [] }),
      setOrder: (order) => set({ order: sanitizeOrder(order) }),
    }),
    {
      name: "songnook-spark-prefs",
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ zoom: state.zoom, kinds: state.kinds, order: state.order }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<PersistedSparkPrefs> | undefined;
        return {
          ...current,
          zoom: clampZoom(saved?.zoom),
          kinds: sanitizeKinds(saved?.kinds),
          order: sanitizeOrder(saved?.order),
        };
      },
    }
  )
);
