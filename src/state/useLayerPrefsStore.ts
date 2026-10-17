import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Whether the layer lanes under the player's reel are folded away (founder,
 * 2026-10-17: "an option to collapse them"). One choice for every take,
 * remembered.
 */
type LayerPrefs = {
  lanesCollapsed: boolean;
  setLanesCollapsed: (collapsed: boolean) => void;
};

export const useLayerPrefsStore = create<LayerPrefs>()(
  persist(
    (set) => ({
      lanesCollapsed: false,
      setLanesCollapsed: (lanesCollapsed) => set({ lanesCollapsed }),
    }),
    {
      name: "songnook-layer-prefs",
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ lanesCollapsed: state.lanesCollapsed }),
      merge: (persisted, current) => ({
        ...current,
        lanesCollapsed: (persisted as Partial<LayerPrefs> | undefined)?.lanesCollapsed === true,
      }),
    }
  )
);
