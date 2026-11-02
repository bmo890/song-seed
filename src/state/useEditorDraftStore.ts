import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { pruneEditorDrafts, sanitizeEditorDrafts, type EditorDraft } from "../domain/editorDrafts";

/**
 * Unsaved editor words, per item (domain/editorDrafts). A satellite store: it is
 * not library content, never travels in a backup, and only exists so a kill or a
 * reload in the middle of writing gives the words back.
 */
type EditorDraftState = {
  drafts: Record<string, EditorDraft>;
  putDraft: (draft: Omit<EditorDraft, "savedAt">, now?: number) => void;
  clearDraft: (key: string) => void;
};

const STORE_NAME = "songnook-editor-drafts";

export const useEditorDraftStore = create<EditorDraftState>()(
  persist(
    (set) => ({
      drafts: {},
      putDraft: (draft, now = Date.now()) =>
        set((state) => ({
          drafts: pruneEditorDrafts({ ...state.drafts, [draft.key]: { ...draft, savedAt: now } }, now),
        })),
      clearDraft: (key) =>
        set((state) => {
          if (!state.drafts[key]) return state;
          const next = { ...state.drafts };
          delete next[key];
          return { drafts: next };
        }),
    }),
    {
      name: STORE_NAME,
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ drafts: state.drafts }),
      merge: (persisted, current) => ({
        ...current,
        drafts: sanitizeEditorDrafts((persisted as { drafts?: unknown } | undefined)?.drafts, Date.now()),
      }),
    }
  )
);

/** The draft kept for this key, if any (read at the moment, not subscribed). */
export function readEditorDraft(key: string | null | undefined): EditorDraft | null {
  if (!key) return null;
  return useEditorDraftStore.getState().drafts[key] ?? null;
}

export function clearEditorDraft(key: string | null | undefined) {
  if (key) useEditorDraftStore.getState().clearDraft(key);
}
