import React, { useMemo, useState } from "react";
import { AppAlert } from "../../common/AppAlert";
import { actionIcons } from "../../common/actionIcons";
import * as FileSystem from "expo-file-system/legacy";
import { useStore } from "../../../state/useStore";
import { appActions } from "../../../state/actions";
import { shareAudioClips, buildTimestampSlug } from "../../../services/audioStorage";
import { SONG_SEED_AUDIO_DIR } from "../../../services/storagePaths";
import { SelectionActionSheet } from "../../common/SelectionActionSheet";
import { SelectionDock, type SelectionAction } from "../../common/SelectionDock";
import { ClipNotesSheet } from "../../modals/ClipNotesSheet";
import { fmtDuration, formatDate } from "../../../utils";
import { getLineageRootId } from "../../../clipGraph";
import {
  buildLineageTitlePlan,
} from "../../../clipLineageTitles";
import { showLineageRenamePrompt } from "../../../clipLineageRenamePrompt";
import { useSongScreen } from "../provider/SongScreenProvider";

export function SelectionBars() {
  const { screen, parentPicking, undo, actions } = useSongScreen();
  const clipSelectionMode = useStore((s) => s.clipSelectionMode);
  const selectedClipIds = useStore((s) => s.selectedClipIds);
  const replaceClipSelection = useStore((s) => s.replaceClipSelection);
  const [isSharing, setIsSharing] = useState(false);
  const [moreVisible, setMoreVisible] = useState(false);
  const [groupSheetVisible, setGroupSheetVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editTitleDraft, setEditTitleDraft] = useState("");
  const [editNotesDraft, setEditNotesDraft] = useState("");

  const selectedIdea = screen.selectedIdea;
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
  const singleSelectedLineageRootId =
    selectedIdea && singleSelectedClip ? getLineageRootId(selectedIdea.clips, singleSelectedClip.id) : null;
  const singleSelectedAssignedGroupId =
    singleSelectedLineageRootId && selectedIdea?.clipGroupAssignments
      ? selectedIdea.clipGroupAssignments[singleSelectedLineageRootId] ?? null
      : null;

  function handlePlaySelected() {
    if (!selectedIdea) return;
    const queue = selectedIdea.clips
      .filter((clip) => selectedClipIds.includes(clip.id) && !!clip.audioUri)
      .map((clip) => ({
        ideaId: selectedIdea.id,
        clipId: clip.id,
      }));
    if (queue.length === 0) {
      AppAlert.info("Nothing to play", "None of the selected clips have playable audio yet.");
      return;
    }
    useStore.getState().setPlayerQueue(queue, 0, true);
    screen.navigation.navigate("Player" as never);
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
      AppAlert.info("Share failed", message);
    } finally {
      setIsSharing(false);
    }
  }

  function handleClipboardAction(mode: "copy" | "move") {
    appActions.startClipboardFromProject(mode);
    AppAlert.info(
      mode === "copy" ? "Copy ready" : "Move ready",
      mode === "copy"
        ? "Tap \"Paste clips here\" in this song to duplicate them, or open another song and paste there."
        : "Open the destination song and tap \"Paste clips here\" to finish moving these clips."
    );
  }

  function handleStartNewThread() {
    if (!selectedIdea || !singleSelectedClip) return;
    const clip = singleSelectedClip;
    const ideaId = selectedIdea.id;
    setMoreVisible(false);

    AppAlert.custom(
      clip.title,
      undefined,
      [
        {
          label: "Branch",
          description: "Keep the original, copy it to a new thread",
          icon: actionIcons.branch,
          onPress: async () => {
            const previousClips = selectedIdea.clips;
            const newClipId = `clip-${Date.now()}`;
            let newAudioUri: string | undefined = undefined;

            // If the clip has audio, copy it to a new managed file.
            if (clip.audioUri) {
              try {
                const originalUri = clip.audioUri;
                const extension = originalUri.split(".").pop() || "m4a";
                newAudioUri = `${SONG_SEED_AUDIO_DIR}/${newClipId}.${extension}`;
                await FileSystem.copyAsync({ from: originalUri, to: newAudioUri });
              } catch (error) {
                console.error("[branch] audio copy failed:", error);
                // Proceed without audio if the copy fails
                newAudioUri = undefined;
              }
            }

            const branchedClip = {
              ...clip,
              id: newClipId,
              createdAt: Date.now(),
              audioUri: newAudioUri,
              parentClipId: undefined,
              isPrimary: false,
              isTitleAutoGenerated: false,
            };

            useStore.getState().updateIdeas((ideas) =>
              ideas.map((idea) =>
                idea.id !== ideaId
                  ? idea
                  : { ...idea, clips: [branchedClip, ...idea.clips] }
              )
            );
            useStore.getState().cancelClipSelection();
            undo.showUndo(`Branched "${clip.title}"`, () => {
              useStore.getState().updateIdeas((ideas) =>
                ideas.map((idea) =>
                  idea.id !== ideaId ? idea : { ...idea, clips: previousClips }
                )
              );
              // Clean up the copied audio file on undo
              if (newAudioUri) {
                void FileSystem.deleteAsync(newAudioUri, { idempotent: true }).catch(
                  () => {}
                );
              }
            });
          },
        },
        {
          label: "Split",
          description: "Move it out into its own new thread",
          icon: actionIcons.split,
          onPress: () =>
            parentPicking.handleMakeRoot(selectedClipIds, (nextUndo, message) => {
              undo.showUndo(message, nextUndo);
            }),
        },
        { label: "Cancel", style: "cancel" },
      ]
    );
  }

  function handleToggleBookmark() {
    if (!selectedIdea || !singleSelectedClip) return;
    useStore.getState().toggleClipBookmark(selectedIdea.id, singleSelectedClip.id);
    setMoreVisible(false);
  }

  function handleCreateGroupAndAssign() {
    if (!selectedIdea || !singleSelectedLineageRootId) return;
    const groupId = useStore.getState().createClipGroup(selectedIdea.id);
    if (groupId) {
      useStore.getState().assignLineageToClipGroup(
        selectedIdea.id,
        singleSelectedLineageRootId,
        groupId
      );
    }
    setGroupSheetVisible(false);
    setMoreVisible(false);
  }

  function handleAssignGroup(groupId: string | null) {
    if (!selectedIdea || !singleSelectedLineageRootId) return;
    useStore.getState().assignLineageToClipGroup(selectedIdea.id, singleSelectedLineageRootId, groupId);
    setGroupSheetVisible(false);
    setMoreVisible(false);
  }

  function handleEditSingleClip() {
    if (!singleSelectedClip) return;
    setEditTitleDraft(singleSelectedClip.title);
    setEditNotesDraft(singleSelectedClip.notes || "");
    setEditVisible(true);
  }

  function saveEditedClip() {
    if (!selectedIdea || !singleSelectedClip) return;
    const state = useStore.getState();
    const workspace = state.workspaces.find((candidate) => candidate.id === state.activeWorkspaceId);
    const currentIdea = workspace?.ideas.find((candidate) => candidate.id === selectedIdea.id) ?? null;
    const plan = currentIdea
      ? buildLineageTitlePlan(currentIdea.clips, singleSelectedClip.id, editTitleDraft)
      : null;

    if (!currentIdea || !plan) {
      console.warn("[renameThread] selection edit save skipped", {
        ideaId: selectedIdea.id,
        clipId: singleSelectedClip.id,
        hasIdea: !!currentIdea,
        hasPlan: !!plan,
      });
      return;
    }

    state.updateIdeas((ideas) =>
      ideas.map((idea) =>
        idea.id !== selectedIdea.id
          ? idea
          : {
              ...idea,
              clips: idea.clips.map((clip) =>
                clip.id === singleSelectedClip.id
                  ? {
                      ...clip,
                      title: plan.savedTitle,
                      notes: editNotesDraft.trim(),
                      isTitleAutoGenerated: false,
                    }
                  : clip
              ),
            }
      )
    );
    setEditVisible(false);
    state.cancelClipSelection();
    if (plan.lineage && plan.orderedClips.length > 1 && plan.renames.length > 0) {
      setTimeout(() => showLineageRenamePrompt({ ideaId: selectedIdea.id, renames: plan.renames }), 400);
    }
  }

  function confirmDeleteSelection() {
    AppAlert.destructive(
      selectedClips.length === 1 ? "Delete clip?" : "Delete clips?",
      selectedClips.length === 1
        ? "Are you sure you want to remove this clip from the song?"
        : "Are you sure you want to remove these clips from the song?",
      appActions.deleteSelectedClips,
      { confirmLabel: "Delete" }
    );
  }

  const dockActions: SelectionAction[] =
    selectedClips.length === 1
      ? [
          {
            key: "play",
            label: "Play",
            icon: "play-outline",
            onPress: handlePlaySelected,
            disabled: playableSelectedCount === 0,
          },
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
            key: "play",
            label: `Play (${playableSelectedCount})`,
            icon: "play-outline",
            onPress: handlePlaySelected,
            disabled: playableSelectedCount === 0,
          },
          {
            key: "delete",
            label: "Delete",
            icon: "trash-outline",
            tone: "danger",
            onPress: confirmDeleteSelection,
          },
          {
            key: "select-all",
            label: canDeselectAll ? "Deselect all" : "Select all",
            icon: canDeselectAll ? "remove-circle-outline" : "checkmark-circle-outline",
            onPress: () => replaceClipSelection(canDeselectAll ? [] : selectableClipIds),
            disabled: !canDeselectAll && selectableClipIds.length === 0,
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
      key: "share",
      label: isSharing ? "Sharing..." : `Share (${shareableClips.length})`,
      icon: "share-social-outline",
      onPress: () => { void handleShareSelected(); },
      disabled: isSharing || shareableClips.length === 0,
    },
    {
      key: "set-parent",
      label: "Set parent",
      icon: "git-merge-outline",
      onPress: () =>
        parentPicking.handleStartSetParent(selectedClipIds, () => {
          screen.setSongTab("takes");
          screen.setClipTagFilter([]);
          screen.setClipGroupFilter([]);
          screen.setClipBookmarkedOnly(false);
          screen.setClipViewMode("evolution");
        }),
    },
    ...(selectedClips.length === 1
      ? [
          {
            key: "make-root",
            label: "Start new thread",
            icon: "radio-button-on-outline" as const,
            onPress: handleStartNewThread,
          },
        ]
      : []),
    ...(selectedClips.length === 1 && selectedIdea && singleSelectedClip
      ? [
          {
            key: "bookmark",
            label: singleSelectedClip.isBookmarked ? "Remove bookmark" : "Bookmark clip",
            icon: (singleSelectedClip.isBookmarked
              ? "bookmark"
              : "bookmark-outline") as SelectionAction["icon"],
            onPress: handleToggleBookmark,
          },
        ]
      : []),
    ...(selectedClips.length === 1 && selectedIdea && singleSelectedLineageRootId
      ? [
          {
            key: "assign-group",
            label: "Assign group",
            icon: "folder-open-outline" as const,
            onPress: () => setGroupSheetVisible(true),
          },
        ]
      : []),
    // Select all available at the bottom of More for single-clip mode
    // (for multi-clip it lives in the dock directly).
    ...(selectedClips.length === 1
      ? [
          {
            key: "select-all",
            label: canDeselectAll ? "Deselect all" : "Select all",
            icon: (canDeselectAll
              ? "remove-circle-outline"
              : "checkmark-circle-outline") as SelectionAction["icon"],
            onPress: () => replaceClipSelection(canDeselectAll ? [] : selectableClipIds),
            disabled: !canDeselectAll && selectableClipIds.length === 0,
          },
        ]
      : []),
  ];

  if (!clipSelectionMode) {
    return null;
  }

  return (
    <>
      <SelectionDock
        count={selectedClipIds.length}
        actions={dockActions}
        onDone={() => useStore.getState().cancelClipSelection()}
        onLayout={(height) => {
          screen.setSelectionDockHeight((prev) => (Math.abs(prev - height) < 1 ? prev : height));
        }}
      />

      <SelectionActionSheet
        visible={moreVisible}
        title="Song actions"
        actions={sheetActions}
        onClose={() => setMoreVisible(false)}
      />

      <SelectionActionSheet
        visible={groupSheetVisible}
        title="Assign lineage group"
        actions={[
          ...(selectedIdea?.clipGroups ?? []).map((group) => ({
            key: group.id,
            label: `${singleSelectedAssignedGroupId === group.id ? "✓ " : ""}${group.name}`,
            icon: "folder-outline" as const,
            onPress: () => handleAssignGroup(group.id),
          })),
          {
            key: "new-group",
            label: "Create new group",
            icon: "add-circle-outline" as const,
            onPress: handleCreateGroupAndAssign,
          },
          ...(singleSelectedAssignedGroupId
            ? [
                {
                  key: "remove-group",
                  label: "Remove from group",
                  icon: "close-circle-outline" as const,
                  onPress: () => handleAssignGroup(null),
                },
              ]
            : []),
        ]}
        onClose={() => setGroupSheetVisible(false)}
      />

      <ClipNotesSheet
        visible={editVisible}
        clipSubtitle={
          singleSelectedClip
            ? `${singleSelectedClip.durationMs ? fmtDuration(singleSelectedClip.durationMs) : "0:00"} • ${formatDate(singleSelectedClip.createdAt)}`
            : ""
        }
        titleDraft={editTitleDraft}
        notesDraft={editNotesDraft}
        onChangeTitle={setEditTitleDraft}
        onChangeNotes={setEditNotesDraft}
        onSave={saveEditedClip}
        onCancel={() => setEditVisible(false)}
      />
    </>
  );
}
