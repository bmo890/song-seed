import React, { useMemo, useState } from "react";
import { AppAlert } from "../../common/AppAlert";
import { actionIcons } from "../../common/actionIcons";
import * as FileSystem from "expo-file-system/legacy";
import { useStore } from "../../../state/useStore";
import { appActions } from "../../../state/actions";
import { shareAudioClips, buildTimestampSlug } from "../../../services/audioStorage";
import { createClipsShareLink } from "../../../services/clipShareLink";
import { presentShareLink } from "../../../services/shareLinkFlow";
import { isSendServiceConfigured } from "../../../config/sendService";
import { SONG_SEED_AUDIO_DIR } from "../../../services/storagePaths";
import { SelectionActionSheet } from "../../common/SelectionActionSheet";
import { SelectionDock, type SelectionAction } from "../../common/SelectionDock";
import { ClipNotesSheet } from "../../modals/ClipNotesSheet";
import { ClipTagPicker } from "./ClipTagPicker";
import { fmtDuration, formatDate } from "../../../utils";
import { getLineageRootId } from "../../../domain/clipGraph";
import {
  buildLineageTitlePlan,
} from "../../../domain/clipLineageTitles";
import { showLineageRenamePrompt } from "../../../domain/clipLineageRenamePrompt";
import { useSongScreen } from "../provider/SongScreenProvider";

export function SelectionBars() {
  const { screen, parentPicking, undo, actions } = useSongScreen();
  const clipSelectionMode = useStore((s) => s.clipSelectionMode);
  const selectedClipIds = useStore((s) => s.selectedClipIds);
  const replaceClipSelection = useStore((s) => s.replaceClipSelection);
  const [isSharing, setIsSharing] = useState(false);
  const [moreVisible, setMoreVisible] = useState(false);
  const [tagSheetVisible, setTagSheetVisible] = useState(false);
  const [groupSheetVisible, setGroupSheetVisible] = useState(false);
  const globalCustomClipTags = useStore((s) => s.globalCustomClipTags);
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
  // Groups are assigned per lineage ROOT, not per clip — collect the distinct roots of
  // every selected clip so group assignment works for a multi-selection too (clips in
  // the same thread collapse to one root).
  const selectedLineageRootIds = useMemo(() => {
    if (!selectedIdea) return [] as string[];
    const roots = new Set<string>();
    for (const clip of selectedClips) {
      const rootId = getLineageRootId(selectedIdea.clips, clip.id);
      if (rootId) roots.add(rootId);
    }
    return [...roots];
  }, [selectedClips, selectedIdea]);
  // A group is "checked" only when EVERY selected root already belongs to it.
  const commonAssignedGroupId = useMemo(() => {
    const assignments = selectedIdea?.clipGroupAssignments;
    if (!assignments || selectedLineageRootIds.length === 0) return null;
    const first = assignments[selectedLineageRootIds[0]] ?? null;
    return first && selectedLineageRootIds.every((rootId) => (assignments[rootId] ?? null) === first)
      ? first
      : null;
  }, [selectedIdea?.clipGroupAssignments, selectedLineageRootIds]);
  const anySelectedAssignedToGroup = useMemo(
    () => selectedLineageRootIds.some((rootId) => !!selectedIdea?.clipGroupAssignments?.[rootId]),
    [selectedIdea?.clipGroupAssignments, selectedLineageRootIds]
  );

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
    useStore.getState().requestInlineStop();
    useStore.getState().setPlayerQueueForScreen(queue, 0, true);
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

  async function handleGetLinkSelected() {
    if (shareableClips.length === 0 || isSharing) return;
    setIsSharing(true);
    try {
      const label = selectedIdea ? `${selectedIdea.title} Clips` : "Songstead Clips";
      await presentShareLink(() => createClipsShareLink(shareableClips, label), {
        emptyMessage: "Select at least one clip with audio first.",
      });
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
    if (!selectedIdea || selectedLineageRootIds.length === 0) return;
    const store = useStore.getState();
    const groupId = store.createClipGroup(selectedIdea.id);
    if (groupId) {
      selectedLineageRootIds.forEach((rootId) =>
        store.assignLineageToClipGroup(selectedIdea.id, rootId, groupId)
      );
    }
    setGroupSheetVisible(false);
    setMoreVisible(false);
  }

  function handleAssignGroup(groupId: string | null) {
    if (!selectedIdea || selectedLineageRootIds.length === 0) return;
    const store = useStore.getState();
    selectedLineageRootIds.forEach((rootId) =>
      store.assignLineageToClipGroup(selectedIdea.id, rootId, groupId)
    );
    setGroupSheetVisible(false);
    setMoreVisible(false);
  }

  function handleMakePrimary() {
    if (!selectedIdea || !singleSelectedClip || singleSelectedClip.isPrimary) return;
    const clipId = singleSelectedClip.id;
    setMoreVisible(false);
    AppAlert.confirm(
      "Make this the primary take?",
      "The primary take is this song's best or most representative version — it's the one that plays and represents the song across your collection. Only one take can be primary.",
      () => {
        appActions.markBestClip(clipId);
        useStore.getState().cancelClipSelection();
      },
      { confirmLabel: "Make primary", icon: "star-outline" }
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
          // Tags live on the clip card itself for a single clip, so the dock offers
          // Primary here instead (disabled when this take is already primary).
          {
            key: "primary",
            label: "Primary",
            icon: "star-outline",
            onPress: handleMakePrimary,
            disabled: !!singleSelectedClip?.isPrimary,
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
            key: "tags",
            label: "Tags",
            icon: "pricetag-outline",
            onPress: () => setTagSheetVisible(true),
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
    ...(__DEV__ || isSendServiceConfigured()
      ? [
          {
            key: "get-link",
            label: "Get link",
            icon: "link-outline" as const,
            onPress: () => { void handleGetLinkSelected(); },
            disabled: isSharing || shareableClips.length === 0,
          },
        ]
      : []),
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
    ...(selectedIdea && selectedLineageRootIds.length > 0
      ? [
          {
            key: "assign-group",
            label:
              selectedLineageRootIds.length === 1 ? "Assign group" : "Assign group to selected",
            icon: "folder-open-outline" as const,
            onPress: () => setGroupSheetVisible(true),
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
        actions={dockActions}
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
        title={
          selectedLineageRootIds.length > 1
            ? `Assign group (${selectedLineageRootIds.length} threads)`
            : "Assign lineage group"
        }
        actions={[
          ...(selectedIdea?.clipGroups ?? []).map((group) => ({
            key: group.id,
            label: `${commonAssignedGroupId === group.id ? "✓ " : ""}${group.name}`,
            icon: "folder-outline" as const,
            onPress: () => handleAssignGroup(group.id),
          })),
          {
            key: "new-group",
            label: "Create new group",
            icon: "add-circle-outline" as const,
            onPress: handleCreateGroupAndAssign,
          },
          ...(anySelectedAssignedToGroup
            ? [
                {
                  key: "remove-group",
                  label:
                    selectedLineageRootIds.length > 1
                      ? "Remove selected from group"
                      : "Remove from group",
                  icon: "close-circle-outline" as const,
                  onPress: () => handleAssignGroup(null),
                },
              ]
            : []),
        ]}
        onClose={() => setGroupSheetVisible(false)}
      />

      {selectedIdea ? (
        <ClipTagPicker
          visible={tagSheetVisible}
          clips={selectedClips}
          idea={selectedIdea}
          globalCustomTags={globalCustomClipTags}
          onClose={() => setTagSheetVisible(false)}
        />
      ) : null}

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
