import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { genId } from "../utils";
import { normalizeStepUpSequence, type StepUpStage } from "../domain/stepUpLoop";

/**
 * The Step up plan, remembered app-wide. A drill isn't per-clip knowledge — the same
 * "2 slow, 2 medium, 3 fast" ladder serves any hard passage — so the plan you last
 * chose, and the Custom one you built, follow you from clip to clip.
 *
 * `activePlan` is what the sheet opens on. `customPlan` is the single Custom slot:
 * switching to a built-in drill and back returns YOUR ladder, not a fresh one.
 *
 * Satellite store, mirroring the magpie-prefs pattern: small, AsyncStorage-persisted,
 * outside the hardened library persistence. Null means "never set" — the caller
 * supplies the default rather than this store guessing one.
 */

/** PARKED (2026-08-01): saving drills under a name is built but not surfaced — one
 *  global Custom slot covers the need for now. Kept so it can be turned back on. */
export type StepUpUserPreset = {
  id: string;
  name: string;
  stages: StepUpStage[];
};

type StepUpPresetsStore = {
  /** The plan the sheet opens on, whichever it is. Null until first chosen. */
  activePlan: StepUpStage[] | null;
  /** The musician's own ladder, kept aside so built-ins never overwrite it. */
  customPlan: StepUpStage[] | null;
  /**
   * Record the plan now in use. `isCustom` also files it as THE Custom slot, so
   * editing a built-in adopts the result as your own rather than losing it.
   */
  setActivePlan: (stages: StepUpStage[], isCustom: boolean) => void;
  // ---- parked: named sequences ----
  userPresets: StepUpUserPreset[];
  /** Trimmed name; an existing preset with the same name (case-insensitive) is replaced. */
  saveUserPreset: (name: string, stages: StepUpStage[]) => void;
  removeUserPreset: (id: string) => void;
};

const STORE_NAME = "songnook-stepup-presets";
const STORE_VERSION = 2;
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

/** A stored plan is only trusted after the domain has had a look at it. */
function sanitizePlan(value: unknown): StepUpStage[] | null {
  return Array.isArray(value) && value.length > 0 ? normalizeStepUpSequence(value) : null;
}

export const useStepUpPresetsStore = create<StepUpPresetsStore>()(
  persist(
    (set) => ({
      activePlan: null,
      customPlan: null,

      setActivePlan: (stages, isCustom) =>
        set((state) => {
          const normalized = normalizeStepUpSequence(stages);
          return {
            activePlan: normalized,
            customPlan: isCustom ? normalized : state.customPlan,
          };
        }),

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
      partialize: (state) => ({
        activePlan: state.activePlan,
        customPlan: state.customPlan,
        userPresets: state.userPresets,
      }),
      merge: (persisted, current) => {
        const saved = persisted as
          | { activePlan?: unknown; customPlan?: unknown; userPresets?: unknown }
          | undefined;
        return {
          ...current,
          activePlan: sanitizePlan(saved?.activePlan),
          customPlan: sanitizePlan(saved?.customPlan),
          userPresets: sanitizeUserPresets(saved?.userPresets),
        };
      },
    }
  )
);
