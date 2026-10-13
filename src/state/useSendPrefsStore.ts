/**
 * What the sender told SongNook Send about themselves — just a display name
 * for now, remembered after the first parcel so the From field is filled the
 * next time (the desktop sender page remembers it the same way). v1 trust
 * level: like an email From line. Accounts (R3) replace it with a verified
 * identity; this store then becomes a cache of that, no migration.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type PersistedSendPrefs = {
  senderName: string;
};

export type SendPrefsStore = PersistedSendPrefs & {
  setSenderName: (name: string) => void;
};

const STORE_NAME = "songnook-send-prefs";
const STORE_VERSION = 1;
export const SENDER_NAME_MAX = 80;

export const useSendPrefsStore = create<SendPrefsStore>()(
  persist(
    (set) => ({
      senderName: "",
      setSenderName: (name) => set({ senderName: name.trim().slice(0, SENDER_NAME_MAX) }),
    }),
    {
      name: STORE_NAME,
      version: STORE_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state): PersistedSendPrefs => ({ senderName: state.senderName }),
      merge: (persisted, current): SendPrefsStore => {
        const raw = (persisted as Partial<PersistedSendPrefs> | undefined)?.senderName;
        return { ...current, senderName: typeof raw === "string" ? raw.slice(0, SENDER_NAME_MAX) : "" };
      },
    }
  )
);
