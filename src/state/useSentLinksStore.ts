/**
 * Persisted outbox of transfer links created on this device. Zustand + AsyncStorage,
 * same pattern as useShelfStore. Local-only in v1; becomes the cache of the
 * server's "my transfers" once accounts exist (keyed by transferId already).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  pruneExpiredSentLinks,
  recentSendStamps,
  sanitizeSentLinks,
  upsertSentLink,
  type SentLink,
} from "../domain/sentLinks";

type PersistedSentLinksState = {
  /** Newest first, deduped by transferId. */
  links: SentLink[];
  /** When each link was made, last 30 days only: a free user's Send allowance. */
  sentAt: number[];
};

export type SentLinksStore = PersistedSentLinksState & {
  /** Record a freshly-created link (replaces any existing record for the same transfer). */
  recordLink: (link: SentLink) => void;
  /** Forget a link locally (does not revoke server-side; revoke arrives with accounts). */
  forgetLink: (transferId: string) => void;
  /** Drop entries past their prune grace window. Idempotent. */
  prune: (now?: number) => void;
  /** The active link for an entity, if any (for on-entity "Link active" chips). */
  linkForEntity: (entityId: string, now?: number) => SentLink | undefined;
  /** Links made in the allowance window (domain/proCatalog.ts "send"). */
  recentSendCount: (now?: number) => number;
};

const STORE_NAME = "songnook-sent-links-store";
const STORE_VERSION = 1;

export const useSentLinksStore = create<SentLinksStore>()(
  persist(
    (set, get) => ({
      links: [],
      sentAt: [],

      recordLink: (link) =>
        set((state) => {
          const isNew = !state.links.some((existing) => existing.transferId === link.transferId);
          const now = Date.now();
          return {
            links: upsertSentLink(state.links, link),
            sentAt: isNew ? [...recentSendStamps(state.sentAt, now), now] : state.sentAt,
          };
        }),

      forgetLink: (transferId) =>
        set((state) => ({ links: state.links.filter((l) => l.transferId !== transferId) })),

      prune: (now = Date.now()) =>
        set((state) => {
          const next = pruneExpiredSentLinks(state.links, now);
          return next.length === state.links.length ? state : { links: next };
        }),

      linkForEntity: (entityId, now = Date.now()) =>
        get().links.find((l) => l.entityId === entityId && l.expiresAt > now),

      recentSendCount: (now = Date.now()) => recentSendStamps(get().sentAt, now).length,
    }),
    {
      name: STORE_NAME,
      version: STORE_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state): PersistedSentLinksState => ({ links: state.links, sentAt: state.sentAt }),
      merge: (persisted, current): SentLinksStore => {
        const saved = persisted as Partial<PersistedSentLinksState> | undefined;
        return {
          ...current,
          links: sanitizeSentLinks(saved?.links),
          sentAt: Array.isArray(saved?.sentAt) ? recentSendStamps(saved.sentAt, Date.now()) : [],
        };
      },
    }
  )
);
