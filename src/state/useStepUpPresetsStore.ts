import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { genId } from "../utils";
import { normalizeStepUpSequence, type StepUpStage } from "../domain/stepUpLoop";

/**
 * App-wide saved Step up sequences. A custom drill isn't per-clip knowledge — the
 * same "2 slow, 2 medium, 3 fast" plan serves any hard passage — so a musician saves
 * it once by name and every practice loop can reach it. Satellite store, mirroring
 * the magpie-prefs pattern: small, AsyncStorage-persisted, outside the hardened
 * library persistence.
 */

export type StepUpUserPreset = {
  id: string;
  name: string;
  stages: StepUpStage[];
};

type StepUpPresetsStore = {
  userPresets: StepUpUserPreset[];
  /** Trimmed name; an existing preset with the same name (case-insensitive) is replaced. */
  saveUserPreset: (name: string, stages: StepUpStage[]) => void;
  removeUserPreset: (id: string) => void;
};

const STORE_NAME = "songnook-stepup-presets";
const STORE_VERSION = 1;
const MAX_USER_PRESETS = 12;
const MAX_NAME_LENGTH = 40;

/** Rebuild hydrated presets from scratch — junk rows and junk stages never land. */
function sanitizeUserPresets(value: unknown): StepUpUserPreset[] {
  const list = Array.isArray(value) ? value : [];
  const kept: StepUpUserPreset[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const { id, name, stages } = entry as Partial<StepUpUserPreset>;
    if (typeof id !== "string" || typeof name !== "string" || !Array.isArray(stages)) continue;
    const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
    if (!trimmed) continue;
    kept.push({ id, name: trimmed, stages: normalizeStepUpSequence(stages) });
    if (kept.length >= MAX_USER_PRESETS) break;
  }
  return kept;
}

export const useStepUpPresetsStore = create<StepUpPresetsStore>()(
  persist(
    (set) => ({
      userPresets: [],

      saveUserPreset: (name, stages) =>
        set((state) => {
          const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
          if (!trimmed) return state;
          const normalized = normalizeStepUpSequence(stages);
          const withoutSameName = state.userPresets.filter(
            (preset) => preset.name.toLowerCase() !== trimmed.toLowerCase()
          );
          return {
            userPresets: [
              { id: genId("stepup"), name: trimmed, stages: normalized },
              ...withoutSameName,
            ].slice(0, MAX_USER_PRESETS),
          };
        }),

      removeUserPreset: (id) =>
        set((state) => ({
          userPresets: state.userPresets.filter((preset) => preset.id !== id),
        })),
    }),
    {
      name: STORE_NAME,
      version: STORE_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ userPresets: state.userPresets }),
      merge: (persisted, current) => ({
        ...current,
        userPresets: sanitizeUserPresets(
          (persisted as { userPresets?: unknown } | undefined)?.userPresets
        ),
      }),
    }
  )
);
