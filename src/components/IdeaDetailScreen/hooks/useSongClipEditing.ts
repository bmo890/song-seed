import { useMemo, useState } from "react";
import { useStore } from "../../../state/useStore";
import { type ClipVersion, type SongIdea } from "../../../types";

export function useSongClipEditing(selectedIdea: SongIdea | null) {
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [editingClipDraft, setEditingClipDraft] = useState("");
  const [editingClipNotesDraft, setEditingClipNotesDraft] = useState("");
  const [notesSheetClipId, setNotesSheetClipId] = useState<string | null>(null);

  const currentIdeaId = selectedIdea?.id ?? null;

  const notesSheetClip = useMemo(
    () =>
      notesSheetClipId && selectedIdea
        ? selectedIdea.clips.find((clip) => clip.id === notesSheetClipId) ?? null
        : null,
    [notesSheetClipId, selectedIdea]
  );

  function openNotesSheet(clip: ClipVersion) {
    setEditingClipDraft(clip.title);
    setEditingClipNotesDraft(clip.notes || "");
    setNotesSheetClipId(clip.id);
  }

  function updateClipDetails(targetClipId: string) {
    if (!currentIdeaId) return;

    useStore.getState().updateIdeas((ideas) =>
      ideas.map((idea) =>
        idea.id !== currentIdeaId
          ? idea
          : {
              ...idea,
              clips: idea.clips.map((clip) =>
                clip.id === targetClipId
                  ? {
                      ...clip,
                      title: editingClipDraft.trim() || "Untitled Clip",
                      notes: editingClipNotesDraft.trim(),
                    }
                  : clip
              ),
            }
      )
    );
  }

  function saveNotesSheet() {
    if (!notesSheetClipId) return;
    updateClipDetails(notesSheetClipId);
    setNotesSheetClipId(null);
  }

  function beginEditingClip(clip: ClipVersion) {
    setEditingClipId(clip.id);
    setEditingClipDraft(clip.title);
    setEditingClipNotesDraft(clip.notes || "");
  }

  function saveEditingClip(clipId: string) {
    updateClipDetails(clipId);
    setEditingClipId(null);
  }

  function cancelEditing() {
    setEditingClipId(null);
  }

  function closeNotesSheet() {
    setNotesSheetClipId(null);
  }

  return {
    editingClipId,
    editingClipDraft,
    setEditingClipDraft,
    editingClipNotesDraft,
    setEditingClipNotesDraft,
    notesSheetClip,
    openNotesSheet,
    saveNotesSheet,
    beginEditingClip,
    saveEditingClip,
    cancelEditing,
    closeNotesSheet,
  };
}
