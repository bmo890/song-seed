import React, { useMemo, useState } from "react";
import { Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useStore } from "../../state/useStore";
import { appActions } from "../../state/actions";
import { shareAudioClips } from "../../services/audioStorage";
import type { SongIdea } from "../../types";
import { SelectionActionSheet } from "../common/SelectionActionSheet";
import { SelectionDock, type SelectionAction } from "../common/SelectionDock";
import { ClipNotesSheet } from "../modals/ClipNotesSheet";
import { fmtDuration, formatDate } from "../../utils";
import { getLineageRootId } from "../../clipGraph";

const EMPTY_IDEAS: SongIdea[] = [];

type SelectionBarsProps = {
  onStartSetParent: (clipIds: string[]) => void;
  onMakeRoot: (clipIds: string[]) => void;
  onViewLineageHistory?: (rootClipId: string) => void;
  onDockLayout?: (height: number) => void;
};

export function SelectionBars({
  onStartSetParent,
  onMakeRoot,
  onViewLineageHistory,
  onDockLayout,
}: SelectionBarsProps) {
  const navigation = useNavigation();
  const clipSelectionMode = useStore((s) => s.clipSelectionMode);
  const selectedClipIds = useStore((s) => s.selectedClipIds);
  const replaceClipSelection = useStore((s) => s.replaceClipSelection);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const selectedIdeaId = useStore((s) => s.selectedIdeaId);
  const workspaces = useStore((s) => s.workspaces);
  const globalCustomTags = useStore((s) => s.globalCustomClipTags);
  const [isSharing, setIsSharing] = useState(false);
  const [moreVisible, setMoreVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editTitleDraft, setEditTitleDraft] = useState("");
  const [editNotesDraft, setEditNotesDraft] = useState("");

  const ideas = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId)?.ideas ?? EMPTY_IDEAS,
    [workspaces, activeWorkspaceId]
  );
  const selectedIdea = useMemo(
    () => ideas.find((i) => i.id === selectedIdeaId),
    [ideas, selectedIdeaId]
  );

  const selectedClips = useMemo(
    () => (selectedIdea?.clips ?? []).filter((clip) => selectedClipIds.includes(clip.id)),
    [selectedClipIds, selectedIdea?.clips]
  );
  const shareableClips = selectedClips
    .filter((clip) => !!clip.audioUri)
    .map((clip) => ({
      title: clip.title,
      audioUri: clip.audioUri!,
    }));
  const selectableClipIds = (selectedIdea?.clips ?? []).map((clip) => clip.id);
  const allSelectableSelected =
    selectableClipIds.length > 0 && selectableClipIds.every((id) => selectedClipIds.includes(id));
  const canDeselectAll =
    allSelectableSelected || (selectableClipIds.length === 0 && selectedClipIds.length > 0);

  const playableSelectedCount = selectedClips.filter((clip) => !!clip.audioUri).length;
  const singleSelectedClip = selectedClips.length === 1 ? selectedClips[0] ?? null : null;

  function handlePlaySelected() {
    if (!selectedIdea) return;
    const queue = selectedIdea.clips
      .filter((clip) => selectedClipIds.includes(clip.id) && !!clip.audioUri)
      .map((clip) => ({
        ideaId: selectedIdea.id,
        clipId: clip.id,
      }));
    if (queue.length === 0) {
      Alert.alert("Nothing to play", "None of the selected clips have playable audio yet.");
      return;
    }
    useStore.getState().setPlayerQueue(queue, 0, true);
    navigation.navigate("Player" as never);
  }

  async function handleShareSelected() {
    if (shareableClips.length === 0 || isSharing) return;

    try {
      setIsSharing(true);
      await shareAudioClips(
        shareableClips,
        selectedIdea ? `${selectedIdea.title} Clips` : "SongSeed Clips"
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not share the selected clips.";
      Alert.alert("Share failed", message);
    } finally {
      setIsSharing(false);
    }
  }

  function handleClipboardAction(mode: "copy" | "move") {
    appActions.startClipboardFromProject(mode);
    Alert.alert(
      mode === "copy" ? "Copy ready" : "Move ready",
      mode === "copy"
        ? "Tap \"Paste clips here\" in this song to duplicate them, or open another song and paste there."
        : "Open the destination song and tap \"Paste clips here\" to finish moving these clips."
    );
  }

  function handleEditSingleClip() {
    if (!singleSelectedClip) return;
    setEditTitleDraft(singleSelectedClip.title);
    setEditNotesDraft(singleSelectedClip.notes || "");
    setEditVisible(true);
  }

  function saveEditedClip() {
    if (!selectedIdea || !singleSelectedClip) return;
    useStore.getState().updateIdeas((ideas) =>
      ideas.map((idea) =>
        idea.id !== selectedIdea.id
          ? idea
          : {
              ...idea,
              clips: idea.clips.map((clip) =>
                clip.id === singleSelectedClip.id
                  ? {
                      ...clip,
                      title: editTitleDraft.trim() || "Untitled Clip",
                      notes: editNotesDraft.trim(),
                    }
                  : clip
              ),
            }
      )
    );
    setEditVisible(false);
  }

  const confirmDeleteSelection = () => {
    Alert.alert(
      selectedClips.length === 1 ? "Delete clip?" : "Delete clips?",
      selectedClips.length === 1
        ? "Are you sure you want to remove this clip from the song?"
        : "Are you sure you want to remove these clips from the song?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: appActions.deleteSelectedClips },
      ]
    );
  };

  const dockActions: SelectionAction[] =
    selectedClips.length === 1
      ? [
          {
            key: "edit",
            label: "Edit",
            icon: "create-outline",
            onPress: handleEditSingleClip,
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
        ]
      : [
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

  const sheetActions: SelectionAction[] = [
    {
      key: "copy",
      label: "Copy",
      icon: "copy-outline",
      onPress: () => handleClipboardAction("copy"),
    },
    {
      key: "move",
      label: "Move",
      icon: "arrow-forward-outline",
      onPress: () => handleClipboardAction("move"),
    },
    {
      key: "play",
      label: `Play selected (${playableSelectedCount})`,
      icon: "play-outline",
      onPress: handlePlaySelected,
      disabled: playableSelectedCount === 0,
    },
    {
      key: "share",
      label: isSharing ? "Sharing..." : `Share (${shareableClips.length})`,
      icon: "share-social-outline",
      onPress: () => {
        void handleShareSelected();
      },
      disabled: isSharing || shareableClips.length === 0,
    },
    {
      key: "set-parent",
      label: "Set parent",
      icon: "git-merge-outline",
      onPress: () => onStartSetParent(selectedClipIds),
    },
    ...(selectedClips.length === 1
      ? [
          {
            key: "record-variation",
            label: "Record variation",
            icon: "mic-outline" as const,
            onPress: () => {
              if (!selectedIdea || !singleSelectedClip) return;
              void (async () => {
                useStore.getState().setRecordingParentClipId(singleSelectedClip.id);
                useStore.getState().setRecordingIdeaId(selectedIdea.id);
                navigation.navigate("Recording" as never);
              })();
            },
          },
        ]
      : []),
    ...(selectedClips.length === 1
      ? [
          {
            key: "make-root",
            label: "Make root",
            icon: "radio-button-on-outline" as const,
            onPress: () => onMakeRoot(selectedClipIds),
          },
        ]
      : []),
    ...(selectedClips.length === 1 && onViewLineageHistory && selectedIdea && singleSelectedClip
      ? [
          {
            key: "view-history",
            label: "View history",
            icon: "git-branch-outline" as const,
            onPress: () => {
              const rootId = getLineageRootId(selectedIdea.clips, singleSelectedClip.id);
              if (rootId) onViewLineageHistory(rootId);
            },
          },
        ]
      : []),
    {
      key: "select-all",
      label: canDeselectAll ? "Deselect all" : "Select all",
      icon: canDeselectAll ? "remove-circle-outline" : "checkmark-circle-outline",
      onPress: () => replaceClipSelection(canDeselectAll ? [] : selectableClipIds),
      disabled: !canDeselectAll && selectableClipIds.length === 0,
    },
  ];

  return (
    <>
      {clipSelectionMode ? (
        <>
          <SelectionDock
            count={selectedClipIds.length}
            actions={dockActions}
            onDone={() => useStore.getState().cancelClipSelection()}
            onLayout={onDockLayout}
          />

          <SelectionActionSheet
            visible={moreVisible}
            title="Song actions"
            actions={sheetActions}
            onClose={() => setMoreVisible(false)}
          />

          <ClipNotesSheet
            visible={editVisible}
            clipSubtitle={
              singleSelectedClip
                ? `${singleSelectedClip.durationMs ? fmtDuration(singleSelectedClip.durationMs) : "0:00"} • ${formatDate(singleSelectedClip.createdAt)}`
                : ""
            }
            clip={singleSelectedClip}
            idea={selectedIdea ?? null}
            globalCustomTags={globalCustomTags}
            titleDraft={editTitleDraft}
            notesDraft={editNotesDraft}
            onChangeTitle={setEditTitleDraft}
            onChangeNotes={setEditNotesDraft}
            onSave={saveEditedClip}
            onCancel={() => setEditVisible(false)}
          />
        </>
      ) : null}
    </>
  );
}
