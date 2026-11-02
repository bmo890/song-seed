import { useRef, useState } from "react";
import { useStore } from "../../../state/useStore";
import { locateIdea } from "../../../domain/itemLocator";
import { changedFields, editorDraftKey } from "../../../domain/editorDrafts";
import { saveClipTextEdits } from "../../../state/clipTextEdits";
import type { SongIdea } from "../../../types";
import { i18n } from "../../../i18n/instance";

type EditTarget = { ideaId: string; clipId: string };

/**
 * The collection list's clip Edit sheet (name + notes). Tied to the clip it opened
 * on, wherever that clip lives now; pre-filled from the clip's own notes (the
 * player writes those); saves only what was changed here (12c C-H1).
 */
export function useCollectionEditModal(_ideas: SongIdea[]) {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [target, setTarget] = useState<EditTarget | null>(null);
  const [editClipDraft, setEditClipDraft] = useState("");
  const [editClipNotesDraft, setEditClipNotesDraft] = useState("");
  // What the sheet showed as it opened: the save writes only what moved from this.
  const openedRef = useRef<{ title: string; notes: string }>({ title: "", notes: "" });

  // Found wherever it lives now (a move or a visit must not make the sheet vanish
  // mid-edit with the words in it, 12c C-L9).
  const editTargetIdea = useStore((state) =>
    target ? locateIdea(state.workspaces, target.ideaId)?.idea ?? null : null
  );
  const editTargetClip =
    editTargetIdea?.kind === "clip" && target
      ? editTargetIdea.clips.find((clip) => clip.id === target.clipId) ?? null
      : null;

  const quickEditIdea = (idea: SongIdea) => {
    if (idea.kind === "project") {
      return false;
    }
    const clip = idea.clips[0];
    if (!clip) return false;

    // The clip's notes are the living copy; the idea's are an older mirror.
    const notes = clip.notes || idea.notes || "";
    openedRef.current = { title: idea.title, notes };
    setTarget({ ideaId: idea.id, clipId: clip.id });
    setEditClipDraft(idea.title);
    setEditClipNotesDraft(notes);
    setEditModalOpen(true);
    return true;
  };

  const saveStandaloneClipEdit = () => {
    if (!target) return;
    const opened = openedRef.current;
    const patch = changedFields(
      { title: opened.title.trim() || i18n.t("defaults.untitledClip"), notes: opened.notes.trim() },
      { title: editClipDraft.trim() || i18n.t("defaults.untitledClip"), notes: editClipNotesDraft.trim() }
    );
    saveClipTextEdits(
      target.ideaId,
      target.clipId,
      patch,
      patch.title !== undefined ? { title: patch.title } : undefined
    );

    setEditModalOpen(false);
    setTarget(null);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setTarget(null);
  };

  return {
    editModalOpen,
    editClipId: target?.ideaId ?? null,
    editClipDraft,
    editClipNotesDraft,
    editTargetIdea,
    editTargetClip,
    /** The sheet's unsaved words survive a kill under this key. */
    editDraftKey: target ? editorDraftKey("clipText", target.ideaId, target.clipId) : null,
    setEditClipDraft,
    setEditClipNotesDraft,
    quickEditIdea,
    saveStandaloneClipEdit,
    closeEditModal,
  };
}
