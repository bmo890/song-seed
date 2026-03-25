import { useState } from "react";
import { useStore } from "../../../state/useStore";
import type { SongIdea } from "../../../types";

export function useCollectionEditModal(ideas: SongIdea[]) {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editClipId, setEditClipId] = useState<string | null>(null);
  const [editClipDraft, setEditClipDraft] = useState("");
  const [editClipNotesDraft, setEditClipNotesDraft] = useState("");

  const editTargetIdea = editClipId ? ideas.find((idea) => idea.id === editClipId) ?? null : null;
  const editTargetClip = editTargetIdea?.kind === "clip" ? editTargetIdea.clips[0] ?? null : null;

  const quickEditIdea = (idea: SongIdea) => {
    if (idea.kind === "project") {
      return false;
    }

    setEditClipId(idea.id);
    setEditClipDraft(idea.title);
    setEditClipNotesDraft(idea.notes || idea.clips[0]?.notes || "");
    setEditModalOpen(true);
    return true;
  };

  const saveStandaloneClipEdit = () => {
    if (!editTargetIdea || editTargetIdea.kind !== "clip" || !editTargetClip) return;

    const nextTitle = editClipDraft.trim() || "Untitled Clip";
    const nextNotes = editClipNotesDraft.trim();

    useStore.getState().updateIdeas((nextIdeas) =>
      nextIdeas.map((idea) =>
        idea.id !== editTargetIdea.id
          ? idea
          : {
              ...idea,
              title: nextTitle,
              notes: nextNotes,
              clips: idea.clips.map((clip) =>
                clip.id === editTargetClip.id
                  ? {
                      ...clip,
                      title: nextTitle,
                      notes: nextNotes,
                    }
                  : clip
              ),
            }
      )
    );

    setEditModalOpen(false);
    setEditClipId(null);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditClipId(null);
  };

  return {
    editModalOpen,
    editClipId,
    editClipDraft,
    editClipNotesDraft,
    editTargetIdea,
    editTargetClip,
    setEditClipDraft,
    setEditClipNotesDraft,
    quickEditIdea,
    saveStandaloneClipEdit,
    closeEditModal,
  };
}
