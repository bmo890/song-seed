import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * How a take's layers are shown, remembered (founder, 2026-10-17/18):
 * - `lanesCollapsed`: the whole stack under the player's reel folded away.
 * - `collapsedLayerIds`: single layers shown as their name only, no waveform.
 *   One set for the lanes and the bench, so a layer folded in one place is
 *   folded in the other. "Collapse all" / "Expand all" write the whole take.
 */
const MAX_REMEMBERED_COLLAPSED = 400;

type LayerPrefs = {
  lanesCollapsed: boolean;
  setLanesCollapsed: (collapsed: boolean) => void;
  collapsedLayerIds: string[];
  toggleLayerCollapsed: (layerId: string) => void;
  setLayersCollapsed: (layerIds: string[], collapsed: boolean) => void;
};

function withCapped(ids: string[]): string[] {
  return ids.length > MAX_REMEMBERED_COLLAPSED ? ids.slice(ids.length - MAX_REMEMBERED_COLLAPSED) : ids;
}

export const useLayerPrefsStore = create<LayerPrefs>()(
  persist(
    (set) => ({
      lanesCollapsed: false,
      setLanesCollapsed: (lanesCollapsed) => set({ lanesCollapsed }),
      collapsedLayerIds: [],
      toggleLayerCollapsed: (layerId) =>
        set((state) => ({
          collapsedLayerIds: state.collapsedLayerIds.includes(layerId)
            ? state.collapsedLayerIds.filter((id) => id !== layerId)
            : withCapped([...state.collapsedLayerIds, layerId]),
        })),
      setLayersCollapsed: (layerIds, collapsed) =>
        set((state) => {
          const rest = state.collapsedLayerIds.filter((id) => !layerIds.includes(id));
          return { collapsedLayerIds: collapsed ? withCapped([...rest, ...layerIds]) : rest };
        }),
    }),
    {
      name: "songnook-layer-prefs",
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        lanesCollapsed: state.lanesCollapsed,
        collapsedLayerIds: state.collapsedLayerIds,
      }),
      migrate: (persisted) => persisted as Partial<LayerPrefs>,
      merge: (persisted, current) => {
        const saved = persisted as Partial<LayerPrefs> | undefined;
        return {
          ...current,
          lanesCollapsed: saved?.lanesCollapsed === true,
          collapsedLayerIds: Array.isArray(saved?.collapsedLayerIds)
            ? saved!.collapsedLayerIds.filter((id): id is string => typeof id === "string")
            : [],
        };
      },
    }
  )
);
