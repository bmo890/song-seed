import { useMemo, useState } from "react";
import { Alert } from "react-native";
import { useStore } from "../../state/useStore";
import { appActions } from "../../state/actions";
import { shareAudioClips } from "../../services/audioStorage";
import { SelectionActionSheet } from "../common/SelectionActionSheet";
import { SelectionDock, type SelectionAction } from "../common/SelectionDock";
import type { SongIdea } from "../../types";

type IdeaSelectionBarProps = {
  selectableIdeaIds: string[];
  disabledIdeaIds?: string[];
  onPlaySelected: () => void;
  onToggleHideSelected: () => void;
  hideActionLabel: "Hide" | "Unhide";
  hideActionDisabled?: boolean;
  onDeleteSelected: () => void;
  onEditSelected?: () => void;
  onCreateProjectFromSelection?: () => void;
  selectedClipIdeasCount: number;
  onDockLayout?: (height: number) => void;
};

export function IdeaSelectionBar({
  selectableIdeaIds,
  disabledIdeaIds = [],
  onPlaySelected,
  onToggleHideSelected,
  hideActionLabel,
  hideActionDisabled,
  onDeleteSelected,
  onEditSelected,
  onCreateProjectFromSelection,
  selectedClipIdeasCount,
  onDockLayout,
}: IdeaSelectionBarProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [moreVisible, setMoreVisible] = useState(false);

  const selectedListIdeaIds = useStore((s) => s.selectedListIdeaIds);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const workspaces = useStore((s) => s.workspaces);
  const replaceListSelection = useStore((s) => s.replaceListSelection);
  const disabledIdeaIdSet = useMemo(() => new Set(disabledIdeaIds), [disabledIdeaIds]);

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
  const selectedIdeas = useMemo(
    () => (activeWorkspace?.ideas ?? []).filter((idea) => selectedListIdeaIds.includes(idea.id)),
    [activeWorkspace?.ideas, selectedListIdeaIds]
  );
  const interactiveSelectedIdeas = useMemo(
    () => selectedIdeas.filter((idea) => !disabledIdeaIdSet.has(idea.id)),
    [disabledIdeaIdSet, selectedIdeas]
  );
  const selectedClipIdeas = useMemo(
    () => selectedIdeas.filter((idea) => idea.kind === "clip"),
    [selectedIdeas]
  );
  const selectedProjects = useMemo(
    () => selectedIdeas.filter((idea) => idea.kind === "project"),
    [selectedIdeas]
  );

  const playbackQueue = useMemo(
    () =>
      interactiveSelectedIdeas
        .map((idea) => {
          if (idea.kind === "clip") {
            return idea.clips.find((clip) => !!clip.audioUri) ?? null;
          }
          return (
            idea.clips.find((clip) => clip.isPrimary && !!clip.audioUri) ??
            idea.clips.find((clip) => !!clip.audioUri) ??
            null
          );
        })
        .filter(Boolean),
    [interactiveSelectedIdeas]
  );

  const shareableClips = useMemo(
    () =>
      interactiveSelectedIdeas
        .map((idea) => {
          const clip =
            idea.kind === "clip"
              ? idea.clips.find((candidate) => !!candidate.audioUri) ?? null
              : idea.clips.find((candidate) => candidate.isPrimary && !!candidate.audioUri) ??
                idea.clips.find((candidate) => !!candidate.audioUri) ??
                null;
          if (!clip?.audioUri) return null;
          return {
            title: clip.title || idea.title,
            audioUri: clip.audioUri,
          };
        })
        .filter((clip): clip is { title: string; audioUri: string } => !!clip),
    [interactiveSelectedIdeas]
  );

  const allSelectableSelected =
    selectableIdeaIds.length > 0 && selectableIdeaIds.every((id) => selectedListIdeaIds.includes(id));
  const canDeselectAll = allSelectableSelected || (selectableIdeaIds.length === 0 && selectedListIdeaIds.length > 0);
  const exactlyOneInteractive = interactiveSelectedIdeas.length === 1;
  const selectedHiddenOnly = selectedIdeas.length > 0 && interactiveSelectedIdeas.length === 0;
  const canEditSelection = exactlyOneInteractive && !selectedHiddenOnly && !!onEditSelected;

  async function handleShareSelected() {
    if (shareableClips.length === 0 || isSharing) return;

    try {
      setIsSharing(true);
      await shareAudioClips(
        shareableClips,
        activeWorkspace?.title ? `${activeWorkspace.title} Selection` : "SongSeed Selection"
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not share the selected items.";
      Alert.alert("Share failed", message);
    } finally {
      setIsSharing(false);
    }
  }

  function handleClipboardAction(mode: "copy" | "move") {
    appActions.startClipboardFromList(mode);
    Alert.alert(
      mode === "copy" ? "Copy ready" : "Move ready",
      mode === "copy"
        ? "Tap \"Paste items here\" in this or another collection to finish copying these items."
        : "Open the destination collection and tap \"Paste items here\" to finish moving these items."
    );
  }

  function confirmDeleteSelection() {
    const projectNames = selectedProjects.map((project) => project.title).slice(0, 4);
    const projectList =
      projectNames.length > 0
        ? `\n\nSongs: ${projectNames.join(", ")}${selectedProjects.length > 4 ? "…" : ""}`
        : "";
    const message =
      selectedProjects.length > 0
        ? `This will delete ${selectedProjects.length} song${selectedProjects.length === 1 ? "" : "s"} and all contained clips, plus ${selectedClipIdeas.length} standalone clip${selectedClipIdeas.length === 1 ? "" : "s"}.${projectList}`
        : `Are you sure you want to delete ${selectedClipIdeas.length} selected clip${selectedClipIdeas.length === 1 ? "" : "s"}?`;

    Alert.alert("Delete selected items?", message, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: onDeleteSelected },
    ]);
  }

  const dockActions: SelectionAction[] = useMemo(() => {
    if (selectedHiddenOnly) {
      return [
        {
          key: "unhide",
          label: hideActionLabel,
          icon: hideActionLabel === "Unhide" ? "eye-outline" : "eye-off-outline",
          onPress: onToggleHideSelected,
          disabled: hideActionDisabled,
        },
        {
          key: "delete",
          label: "Delete",
          icon: "trash-outline",
          tone: "danger",
          onPress: confirmDeleteSelection,
        },
        {
          key: "more",
          label: "More",
          icon: "ellipsis-horizontal",
          onPress: () => setMoreVisible(true),
        },
      ];
    }

    if (canEditSelection) {
      return [
        {
          key: "edit",
          label: "Edit",
          icon: "create-outline",
          onPress: onEditSelected!,
        },
        {
          key: "hide",
          label: hideActionLabel,
          icon: hideActionLabel === "Unhide" ? "eye-outline" : "eye-off-outline",
          onPress: onToggleHideSelected,
          disabled: hideActionDisabled,
        },
        {
          key: "delete",
          label: "Delete",
          icon: "trash-outline",
          tone: "danger",
          onPress: confirmDeleteSelection,
        },
        {
          key: "more",
          label: "More",
          icon: "ellipsis-horizontal",
          onPress: () => setMoreVisible(true),
        },
      ];
    }

    return [
      {
        key: "hide",
        label: hideActionLabel,
        icon: hideActionLabel === "Unhide" ? "eye-outline" : "eye-off-outline",
        onPress: onToggleHideSelected,
        disabled: hideActionDisabled,
      },
      {
        key: "delete",
        label: "Delete",
        icon: "trash-outline",
        tone: "danger",
        onPress: confirmDeleteSelection,
      },
      {
        key: "more",
        label: "More",
        icon: "ellipsis-horizontal",
        onPress: () => setMoreVisible(true),
      },
    ];
  }, [
    canEditSelection,
    confirmDeleteSelection,
    hideActionDisabled,
    hideActionLabel,
    onEditSelected,
    onToggleHideSelected,
    selectedHiddenOnly,
  ]);

  const sheetActions: SelectionAction[] = useMemo(() => {
    const actions: SelectionAction[] = [];

    if (!selectedHiddenOnly) {
      actions.push({
        key: "play",
        label: `Play selected (${playbackQueue.length})`,
        icon: "play-outline",
        onPress: onPlaySelected,
        disabled: playbackQueue.length === 0,
      });
    }

    if (!selectedHiddenOnly && shareableClips.length > 0) {
      actions.push({
        key: "share",
        label: isSharing ? "Sharing..." : `Share (${shareableClips.length})`,
        icon: "share-social-outline",
        onPress: () => {
          void handleShareSelected();
        },
        disabled: isSharing,
      });
    }

    if (!selectedHiddenOnly) {
      actions.push({
        key: "copy",
        label: "Copy",
        icon: "copy-outline",
        onPress: () => handleClipboardAction("copy"),
      });
      actions.push({
        key: "move",
        label: "Move",
        icon: "arrow-forward-outline",
        onPress: () => handleClipboardAction("move"),
      });
    }

    if (!selectedHiddenOnly && selectedClipIdeasCount > 0 && selectedProjects.length === 0 && onCreateProjectFromSelection) {
      actions.push({
        key: "create-song",
        label: `Create song (${selectedClipIdeasCount})`,
        icon: "albums-outline",
        onPress: onCreateProjectFromSelection,
      });
    }

    actions.push({
      key: "select-all",
      label: canDeselectAll ? "Deselect all" : "Select all",
      icon: canDeselectAll ? "remove-circle-outline" : "checkmark-circle-outline",
      onPress: () => replaceListSelection(canDeselectAll ? [] : selectableIdeaIds),
      disabled: !canDeselectAll && selectableIdeaIds.length === 0,
    });

    return actions;
  }, [
    canDeselectAll,
    handleShareSelected,
    isSharing,
    onCreateProjectFromSelection,
    onPlaySelected,
    playbackQueue.length,
    replaceListSelection,
    selectableIdeaIds,
    selectedClipIdeasCount,
    selectedHiddenOnly,
    selectedProjects.length,
    shareableClips.length,
  ]);

  return (
    <>
      <SelectionDock
        count={selectedListIdeaIds.length}
        actions={dockActions}
        onDone={() => useStore.getState().cancelListSelection()}
        onLayout={onDockLayout}
      />

      <SelectionActionSheet
        visible={moreVisible}
        title="Collection actions"
        actions={sheetActions}
        onClose={() => setMoreVisible(false)}
      />
    </>
  );
}
