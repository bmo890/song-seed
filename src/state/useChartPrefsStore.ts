import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { clampCapoFret, clampTransposeOffset } from "../domain/transpose";

/**
 * Per-song chart display preferences, plus how charts are read. Display-level
 * only: chart data itself is never mutated. Satellite store (revisit/shelf
 * pattern), persisted so a transposed book stays transposed across launches.
 *
 * - `transposeByIdeaId`: the key you play it in, in semitones.
 * - `capoByIdeaId` (2026-10-18, founder: "what if someone's using a capo"):
 *   the fret a capo sits on. Reading surfaces show the SHAPES you finger, the
 *   sounding key minus the capo. Editors keep the written chords.
 * - `readingZoom` / `chordsHidden`: one text size and one chords on/off for
 *   every reading surface (player, songbook reader, setlist), so a size set on
 *   stage is the size the player opens with.
 * Both are optional and start off: nothing moves until the reader asks.
 */

type PersistedChartPrefsState = {
  /** ideaId -> semitone offset (-11..11, never 0 — 0 entries are removed). */
  transposeByIdeaId: Record<string, number>;
  /** ideaId -> capo fret (1..11, never 0 — 0 entries are removed). */
  capoByIdeaId: Record<string, number>;
  readingZoom: number;
  chordsHidden: boolean;
};

export type ChartPrefsStore = PersistedChartPrefsState & {
  setTranspose: (ideaId: string, offset: number) => void;
  nudgeTranspose: (ideaId: string, delta: number) => void;
  resetTranspose: (ideaId: string) => void;
  nudgeCapo: (ideaId: string, delta: number) => void;
  resetCapo: (ideaId: string) => void;
  setReadingZoom: (zoom: number) => void;
  setChordsHidden: (hidden: boolean) => void;
};

const STORE_NAME = "songnook-chart-prefs";
const STORE_VERSION = 2;

export const READING_ZOOM_MIN = 0.5;
export const READING_ZOOM_MAX = 1.6;

function sanitizeSteps(value: unknown, isValid: (step: number) => boolean): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const entries = Object.entries(value).filter(
    (entry): entry is [string, number] =>
      typeof entry[0] === "string" &&
      typeof entry[1] === "number" &&
      Number.isInteger(entry[1]) &&
      entry[1] !== 0 &&
      isValid(entry[1])
  );
  return Object.fromEntries(entries);
}

export function sanitizeOffsets(value: unknown): Record<string, number> {
  return sanitizeSteps(value, (step) => Math.abs(step) <= 11);
}

export function sanitizeCapos(value: unknown): Record<string, number> {
  return sanitizeSteps(value, (step) => step > 0 && step <= 11);
}

function clampZoom(zoom: unknown): number {
  if (typeof zoom !== "number" || !Number.isFinite(zoom)) return 1;
  return Math.max(READING_ZOOM_MIN, Math.min(READING_ZOOM_MAX, zoom));
}

function withStep(map: Record<string, number>, ideaId: string, step: number): Record<string, number> {
  const next = { ...map };
  if (step === 0) {
    delete next[ideaId];
  } else {
    next[ideaId] = step;
  }
  return next;
}

export const useChartPrefsStore = create<ChartPrefsStore>()(
  persist(
    (set) => ({
      transposeByIdeaId: {},
      capoByIdeaId: {},
      readingZoom: 1,
      chordsHidden: false,

      setTranspose: (ideaId, offset) =>
        set((state) => ({
          transposeByIdeaId: withStep(state.transposeByIdeaId, ideaId, clampTransposeOffset(offset)),
        })),

      nudgeTranspose: (ideaId, delta) =>
        set((state) => ({
          transposeByIdeaId: withStep(
            state.transposeByIdeaId,
            ideaId,
            clampTransposeOffset((state.transposeByIdeaId[ideaId] ?? 0) + delta)
          ),
        })),

      resetTranspose: (ideaId) =>
        set((state) => ({
          transposeByIdeaId: withStep(state.transposeByIdeaId, ideaId, 0),
        })),

      nudgeCapo: (ideaId, delta) =>
        set((state) => ({
          capoByIdeaId: withStep(state.capoByIdeaId, ideaId, clampCapoFret((state.capoByIdeaId[ideaId] ?? 0) + delta)),
        })),

      resetCapo: (ideaId) =>
        set((state) => ({
          capoByIdeaId: withStep(state.capoByIdeaId, ideaId, 0),
        })),

      setReadingZoom: (zoom) => set({ readingZoom: clampZoom(zoom) }),
      setChordsHidden: (chordsHidden) => set({ chordsHidden }),
    }),
    {
      name: STORE_NAME,
      version: STORE_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        transposeByIdeaId: state.transposeByIdeaId,
        capoByIdeaId: state.capoByIdeaId,
        readingZoom: state.readingZoom,
        chordsHidden: state.chordsHidden,
      }),
      // v1 held only transposeByIdeaId; the merge below fills the rest.
      migrate: (persisted) => persisted as Partial<PersistedChartPrefsState>,
      merge: (persistedState, currentState) => {
        const saved = persistedState as Partial<PersistedChartPrefsState> | undefined;
        return {
          ...currentState,
          transposeByIdeaId: sanitizeOffsets(saved?.transposeByIdeaId),
          capoByIdeaId: sanitizeCapos(saved?.capoByIdeaId),
          readingZoom: clampZoom(saved?.readingZoom),
          chordsHidden: saved?.chordsHidden === true,
        };
      },
    }
  )
);

/** The semitones a reading surface shifts chords by: the key you play it in,
 *  less the capo (you finger shapes a capo's frets lower than they sound). */
export function useReadingChordShift(ideaId: string | null | undefined): {
  transpose: number;
  capo: number;
  shift: number;
} {
  const transpose = useChartPrefsStore((s) => (ideaId ? s.transposeByIdeaId[ideaId] ?? 0 : 0));
  const capo = useChartPrefsStore((s) => (ideaId ? s.capoByIdeaId[ideaId] ?? 0 : 0));
  return { transpose, capo, shift: readingChordShift(transpose, capo) };
}

export function readingChordShift(transpose: number, capo: number): number {
  return clampTransposeOffset(transpose - capo);
}
