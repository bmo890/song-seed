import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  MAGPIE_HE_DEFAULT_GENRES,
  MAGPIE_HE_GENRES,
  type MagpieHeGenre,
} from "../config/magpieService";
import type { MagpieLanguage } from "../types";

/**
 * App-wide Magpie preferences, set once in the book sheet and inherited by every
 * new Borrowed Words: which Hebrew (Ben-Yehuda) genres to draw from (at least one
 * always selected), and the language of the books (null = follow Settings → word
 * tools). Satellite store, mirroring the chart-prefs pattern.
 */

type PersistedMagpiePrefsState = {
  heGenres: MagpieHeGenre[];
  bookLanguage: MagpieLanguage | null;
};

export type MagpiePrefsStore = PersistedMagpiePrefsState & {
  setHeGenres: (genres: MagpieHeGenre[]) => void;
  toggleHeGenre: (genre: MagpieHeGenre) => void;
  setBookLanguage: (language: MagpieLanguage) => void;
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

const BOOK_LANGUAGES: readonly MagpieLanguage[] = ["en", "es", "de", "pt", "he"];

function sanitizeBookLanguage(value: unknown): MagpieLanguage | null {
  return BOOK_LANGUAGES.includes(value as MagpieLanguage) ? (value as MagpieLanguage) : null;
}

export const useMagpiePrefsStore = create<MagpiePrefsStore>()(
  persist(
    (set) => ({
      heGenres: [...MAGPIE_HE_DEFAULT_GENRES],
      bookLanguage: null,

      setBookLanguage: (language) => set({ bookLanguage: sanitizeBookLanguage(language) }),

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
      partialize: (state) => ({ heGenres: state.heGenres, bookLanguage: state.bookLanguage }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<PersistedMagpiePrefsState> | undefined;
        return {
          ...currentState,
          heGenres: sanitizeGenres(persisted?.heGenres),
          bookLanguage: sanitizeBookLanguage(persisted?.bookLanguage),
        };
      },
    }
  )
);
