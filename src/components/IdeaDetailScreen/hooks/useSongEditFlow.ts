import { useCallback, useEffect } from "react";
import { Alert } from "react-native";
import { useStore } from "../../../state/useStore";
import { appActions } from "../../../state/actions";
import { buildDefaultIdeaTitle, ensureUniqueIdeaTitle } from "../../../utils";
import type { IdeaStatus, SongIdea, Workspace } from "../../../types";

type UseSongEditFlowParams = {
  navigation: any;
  selectedIdea: SongIdea | null | undefined;
  selectedIdeaId: string | null;
  activeWorkspaceId: string | null;
  workspaces: Workspace[];
  isEditMode: boolean;
  setIsEditMode: (value: boolean) => void;
  draftTitle: string;
  draftStatus: IdeaStatus;
  draftCompletion: number;
};

export function useSongEditFlow({
  navigation,
  selectedIdea,
  selectedIdeaId,
  activeWorkspaceId,
  workspaces,
  isEditMode,
  setIsEditMode,
  draftTitle,
  draftStatus,
  draftCompletion,
}: UseSongEditFlowParams) {
  const hasChanges = useCallback(() => {
    if (!selectedIdea) return false;
    return (
      draftTitle.trim() !== selectedIdea.title ||
      draftStatus !== selectedIdea.status ||
      draftCompletion !== selectedIdea.completionPct
    );
  }, [draftCompletion, draftStatus, draftTitle, selectedIdea]);

  const handleSave = useCallback(() => {
    if (!selectedIdeaId || !selectedIdea) return;
    const state = useStore.getState();
    const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
    const fallbackTitle = ensureUniqueIdeaTitle(
      buildDefaultIdeaTitle(),
      activeWorkspace?.ideas.filter((idea) => idea.id !== selectedIdeaId).map((idea) => idea.title) ?? []
    );
    const finalTitle = draftTitle.trim() || fallbackTitle;
    const titleChanged = finalTitle !== selectedIdea.title;
    const statusChanged = draftStatus !== selectedIdea.status;
    const completionChanged = draftCompletion !== selectedIdea.completionPct;
    const meaningfulSongChange = statusChanged || completionChanged;

    if (titleChanged && !meaningfulSongChange && !selectedIdea.isDraft) {
      state.renameIdeaPreservingActivity(selectedIdeaId, finalTitle);
    } else {
      state.updateIdeas((ideas) =>
        ideas.map((idea) =>
          idea.id === selectedIdeaId
            ? {
                ...idea,
                title: finalTitle,
                status: draftStatus,
                completionPct: draftCompletion,
                isDraft: false,
              }
            : idea
        )
      );
    }

    if (selectedIdea.kind === "project") {
      if (selectedIdea.isDraft) {
        state.logIdeaActivity(selectedIdeaId, "created", "song-save");
      } else if (meaningfulSongChange) {
        state.logIdeaActivity(selectedIdeaId, "updated", "song-save");
      }
    }

    setIsEditMode(false);
  }, [
    activeWorkspaceId,
    draftCompletion,
    draftStatus,
    draftTitle,
    selectedIdea,
    selectedIdeaId,
    setIsEditMode,
    workspaces,
  ]);

  const handleCancel = useCallback((onDiscardAction?: () => void) => {
    const isDraft = selectedIdea?.isDraft;
    if (!hasChanges() && !isDraft) {
      setIsEditMode(false);
      onDiscardAction?.();
      return;
    }

    Alert.alert(
      isDraft ? "Remove song without saving?" : "Discard changes?",
      isDraft ? "You haven't saved this new song. Remove it entirely?" : "You have unsaved edits. Discard them?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isDraft ? "Yes, remove" : "Yes, discard",
          style: "destructive",
          onPress: () => {
            setIsEditMode(false);
            if (isDraft) {
              appActions.deleteSelectedIdea(true);
            }
            onDiscardAction?.();
          },
        },
      ]
    );
  }, [hasChanges, selectedIdea?.isDraft, setIsEditMode]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event: any) => {
      if (!isEditMode && !selectedIdea?.isDraft) return;
      event.preventDefault();
      handleCancel(() => navigation.dispatch(event.data.action));
    });
    return unsubscribe;
  }, [handleCancel, isEditMode, navigation, selectedIdea?.isDraft]);

  return {
    hasChanges,
    handleSave,
    handleCancel,
  };
}
