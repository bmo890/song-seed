import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { draftDiffers, type EditorDraft } from "../domain/editorDrafts";
import { readEditorDraft, useEditorDraftStore } from "../state/useEditorDraftStore";
import { toast } from "../components/common/toastStore";
import { i18n } from "../i18n/instance";

const DEFAULT_IDLE_MS = 400;

type Options = {
  /** The item's draft key (domain/editorDrafts editorDraftKey). Null while the
   *  editor is closed or the item is read-only: nothing is kept or offered. */
  key: string | null;
  /** What the editor shows now. */
  fields: Record<string, string>;
  /** The fields differ from what the item holds: there is something to lose. */
  dirty: boolean;
  /** Opaque note of what the editing started from (see EditorDraft.base). */
  base?: string;
  workspaceId?: string | null;
  /** A kept draft for this item was found as the editor opened: put it back
   *  (return false to leave it where it is, untouched). */
  onRestore: (draft: EditorDraft) => boolean | void;
  idleMs?: number;
};

/**
 * Keeps an editor's unsaved fields on disk while it is open (a pause in typing, the
 * app leaving the foreground, the editor unmounting without a save), and offers
 * them back — "Unsaved changes restored" — the next time the same item's editor
 * opens. `clear` after a save or an explicit Discard.
 */
export function useEditorDraft({
  key,
  fields,
  dirty,
  base,
  workspaceId,
  onRestore,
  idleMs = DEFAULT_IDLE_MS,
}: Options): { clear: () => void; flush: () => void } {
  const fieldsJson = JSON.stringify(fields);
  const latestRef = useRef({ key, fields, dirty, base, workspaceId });
  latestRef.current = { key, fields, dirty, base, workspaceId };
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // This open wrote a draft (so going back to clean removes it).
  const wroteRef = useRef(false);
  // Cleared by a save or a discard: nothing is written again until the fields change.
  const settledJsonRef = useRef<string | null>(null);

  const write = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const latest = latestRef.current;
    if (!latest.key) return;
    const json = JSON.stringify(latest.fields);
    if (settledJsonRef.current !== null && settledJsonRef.current === json) return;
    const store = useEditorDraftStore.getState();
    if (latest.dirty) {
      store.putDraft({ key: latest.key, fields: latest.fields, base: latest.base, workspaceId: latest.workspaceId });
      wroteRef.current = true;
    } else if (wroteRef.current) {
      store.clearDraft(latest.key);
      wroteRef.current = false;
    }
  }, []);

  // Offer a kept draft back once per opening of this item's editor — after the
  // draft store has read the disk (a cold start after a kill).
  const restoredForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!key) {
      restoredForRef.current = null;
      return;
    }
    if (restoredForRef.current === key) return;
    const tryRestore = () => {
      if (restoredForRef.current === key) return;
      restoredForRef.current = key;
      const kept = readEditorDraft(key);
      if (!kept) return;
      if (draftDiffers(kept, latestRef.current.fields)) {
        // An editor may decline (it opened on something the draft wasn't written
        // against); the draft then stays for the editor it belongs to.
        if (onRestoreRef.current(kept) === false) return;
        wroteRef.current = true;
        toast(i18n.t("common.unsavedRestored"), "document-text-outline");
      } else {
        useEditorDraftStore.getState().clearDraft(key);
      }
    };
    const persistApi = (useEditorDraftStore as unknown as {
      persist?: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void };
    }).persist;
    if (!persistApi || persistApi.hasHydrated()) {
      tryRestore();
      return;
    }
    return persistApi.onFinishHydration(tryRestore);
  }, [key]);

  // A change of fields: schedule the write (a pause in typing).
  useEffect(() => {
    if (!key) return;
    if (settledJsonRef.current !== null && settledJsonRef.current !== fieldsJson) settledJsonRef.current = null;
    if (!dirty && !wroteRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(write, idleMs);
  }, [dirty, fieldsJson, idleMs, key, write]);

  // Leaving the foreground or unmounting writes at once: a kill gets no warning.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") write();
    });
    return () => {
      sub.remove();
      write();
    };
  }, [write]);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const latest = latestRef.current;
    settledJsonRef.current = JSON.stringify(latest.fields);
    wroteRef.current = false;
    if (latest.key) useEditorDraftStore.getState().clearDraft(latest.key);
  }, []);

  return { clear, flush: write };
}
