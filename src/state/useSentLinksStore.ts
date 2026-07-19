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
  sanitizeSentLinks,
  upsertSentLink,
  type SentLink,
} from "../domain/sentLinks";

type PersistedSentLinksState = {
  /** Newest first, deduped by transferId. */
  links: SentLink[];
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
};

const STORE_NAME = "songstead-sent-links-store";
const STORE_VERSION = 1;

export const useSentLinksStore = create<SentLinksStore>()(
  persist(
    (set, get) => ({
      links: [],

      recordLink: (link) =>
        set((state) => ({ links: upsertSentLink(state.links, link) })),

      forgetLink: (transferId) =>
        set((state) => ({ links: state.links.filter((l) => l.transferId !== transferId) })),

      prune: (now = Date.now()) =>
        set((state) => {
          const next = pruneExpiredSentLinks(state.links, now);
          return next.length === state.links.length ? state : { links: next };
        }),

      linkForEntity: (entityId, now = Date.now()) =>
        get().links.find((l) => l.entityId === entityId && l.expiresAt > now),
    }),
    {
      name: STORE_NAME,
      version: STORE_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state): PersistedSentLinksState => ({ links: state.links }),
      merge: (persisted, current): SentLinksStore => ({
        ...current,
        links: sanitizeSentLinks((persisted as PersistedSentLinksState | undefined)?.links),
      }),
    }
  )
);
