import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  MAGPIE_HE_DEFAULT_GENRES,
  MAGPIE_HE_GENRES,
  type MagpieHeGenre,
} from "../config/magpieService";

/**
 * App-wide Magpie preferences. Currently just which Hebrew (Ben-Yehuda) genres to
 * draw from — remembered across Magpies so the writer sets it once (via the page's
 * settings sheet) and every new Magpie inherits it. Satellite store, mirroring the
 * chart-prefs pattern. At least one genre is always selected.
 */

type PersistedMagpiePrefsState = {
  heGenres: MagpieHeGenre[];
};

export type MagpiePrefsStore = PersistedMagpiePrefsState & {
  setHeGenres: (genres: MagpieHeGenre[]) => void;
  toggleHeGenre: (genre: MagpieHeGenre) => void;
};

const STORE_NAME = "songnook-magpie-prefs";
const STORE_VERSION = 1;
const GENRE_SET = new Set<MagpieHeGenre>(MAGPIE_HE_GENRES);

/** Keep only valid genres, in canonical order, never empty. */
function sanitizeGenres(value: unknown): MagpieHeGenre[] {
  const list = Array.isArray(value) ? value : [];
  const kept = MAGPIE_HE_GENRES.filter((g) => list.includes(g));
  return kept.length ? kept : [...MAGPIE_HE_DEFAULT_GENRES];
}

export const useMagpiePrefsStore = create<MagpiePrefsStore>()(
  persist(
    (set) => ({
      heGenres: [...MAGPIE_HE_DEFAULT_GENRES],

      setHeGenres: (genres) => set({ heGenres: sanitizeGenres(genres) }),

      // Toggle one genre on/off, but never allow the last one to be removed.
      toggleHeGenre: (genre) =>
        set((state) => {
          if (!GENRE_SET.has(genre)) return state;
          const has = state.heGenres.includes(genre);
          if (has && state.heGenres.length === 1) return state; // keep at least one
          const next = has
            ? state.heGenres.filter((g) => g !== genre)
            : [...state.heGenres, genre];
          return { heGenres: sanitizeGenres(next) };
        }),
    }),
    {
      name: STORE_NAME,
      version: STORE_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ heGenres: state.heGenres }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        heGenres: sanitizeGenres(
          (persistedState as Partial<PersistedMagpiePrefsState> | undefined)?.heGenres
        ),
      }),
    }
  )
);
