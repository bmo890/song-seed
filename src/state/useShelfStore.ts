import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  SHELF_DEPARTED_LIMIT,
  SHELF_STAY_MS,
  buildShelfEntry,
  shelfKeyFor,
  sweepExpiredEntries,
  type ShelfDeparture,
  type ShelfEntry,
  type ShelfRef,
} from "../domain/shelf";

type PersistedShelfState = {
  /** Active shelf, newest first. */
  entries: ShelfEntry[];
  /** "Recently left the shelf" — newest first, capped at SHELF_DEPARTED_LIMIT. */
  departed: ShelfDeparture[];
};

export type ShelfStore = PersistedShelfState & {
  /** Put items on the shelf. Already-shelved items get a fresh stay instead of
   *  a duplicate; items in the departed buffer are re-shelved. */
  setAside: (refs: ShelfRef[], now?: number) => void;
  /** Restart an entry's stay ("Keep 7 more days"). */
  keepLonger: (key: string, now?: number) => void;
  /** Take an entry off the shelf early — it joins the departed buffer. */
  leaveShelf: (key: string, now?: number) => void;
  /** Bring a departed item back with a fresh stay. */
  reshelve: (key: string, now?: number) => void;
  /** Move expired entries into the departed buffer. Idempotent. */
  sweep: (now?: number) => void;
};

const STORE_NAME = "songnook-shelf-store";
const STORE_VERSION = 1;

function isShelfRefKind(value: unknown): value is ShelfEntry["kind"] {
  return value === "idea";
}

function sanitizeEntries(value: unknown): ShelfEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const entries: ShelfEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Partial<ShelfEntry>;
    if (!isShelfRefKind(candidate.kind)) continue;
    if (typeof candidate.id !== "string" || !candidate.id) continue;
    if (!Number.isFinite(candidate.shelvedAt) || !Number.isFinite(candidate.expiresAt)) continue;
    const key = shelfKeyFor({ kind: candidate.kind, id: candidate.id });
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({
      key,
      kind: candidate.kind,
      id: candidate.id,
      shelvedAt: candidate.shelvedAt as number,
      expiresAt: candidate.expiresAt as number,
      keepCount: Number.isFinite(candidate.keepCount) ? (candidate.keepCount as number) : 0,
    });
  }
  return entries;
}

function sanitizeDeparted(value: unknown): ShelfDeparture[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const departed: ShelfDeparture[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Partial<ShelfDeparture>;
    if (!isShelfRefKind(candidate.kind)) continue;
    if (typeof candidate.id !== "string" || !candidate.id) continue;
    if (!Number.isFinite(candidate.leftAt)) continue;
    const key = shelfKeyFor({ kind: candidate.kind, id: candidate.id });
    if (seen.has(key)) continue;
    seen.add(key);
    departed.push({ key, kind: candidate.kind, id: candidate.id, leftAt: candidate.leftAt as number });
  }
  return departed.slice(0, SHELF_DEPARTED_LIMIT);
}

function sanitizePersistedState(state?: Partial<PersistedShelfState>): PersistedShelfState {
  return {
    entries: sanitizeEntries(state?.entries),
    departed: sanitizeDeparted(state?.departed),
  };
}

export const useShelfStore = create<ShelfStore>()(
  persist(
    (set) => ({
      entries: [],
      departed: [],

      setAside: (refs, now = Date.now()) =>
        set((state) => {
          if (refs.length === 0) return state;
          const incomingKeys = new Set(refs.map((ref) => shelfKeyFor(ref)));
          // Fresh stay for everything named, whether new, already shelved, or departed.
          const kept = state.entries.filter((entry) => !incomingKeys.has(entry.key));
          const added = refs.map((ref) => buildShelfEntry(ref, now));
          return {
            entries: [...added, ...kept],
            departed: state.departed.filter((item) => !incomingKeys.has(item.key)),
          };
        }),

      keepLonger: (key, now = Date.now()) =>
        set((state) => {
          const target = state.entries.find((entry) => entry.key === key);
          if (!target) return state;
          const renewed: ShelfEntry = {
            ...target,
            expiresAt: now + SHELF_STAY_MS,
            keepCount: target.keepCount + 1,
          };
          return {
            entries: state.entries.map((entry) => (entry.key === key ? renewed : entry)),
          };
        }),

      leaveShelf: (key, now = Date.now()) =>
        set((state) => {
          const target = state.entries.find((entry) => entry.key === key);
          if (!target) return state;
          const departure: ShelfDeparture = {
            key: target.key,
            kind: target.kind,
            id: target.id,
            leftAt: now,
          };
          return {
            entries: state.entries.filter((entry) => entry.key !== key),
            departed: [departure, ...state.departed.filter((item) => item.key !== key)].slice(
              0,
              SHELF_DEPARTED_LIMIT
            ),
          };
        }),

      reshelve: (key, now = Date.now()) =>
        set((state) => {
          const target = state.departed.find((item) => item.key === key);
          if (!target) return state;
          return {
            entries: [
              buildShelfEntry({ kind: target.kind, id: target.id }, now),
              ...state.entries.filter((entry) => entry.key !== key),
            ],
            departed: state.departed.filter((item) => item.key !== key),
          };
        }),

      sweep: (now = Date.now()) =>
        set((state) => {
          const result = sweepExpiredEntries(state.entries, state.departed, now);
          if (!result.changed) return state;
          return { entries: result.entries, departed: result.departed };
        }),
    }),
    {
      name: STORE_NAME,
      version: STORE_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        entries: state.entries,
        departed: state.departed,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...sanitizePersistedState(persistedState as Partial<PersistedShelfState> | undefined),
      }),
    }
  )
);
