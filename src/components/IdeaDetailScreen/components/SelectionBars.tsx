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
import { SONG_NOOK_AUDIO_DIR } from "../../../services/storagePaths";
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
import { useTranslation } from "react-i18next";

export function SelectionBars() {
  const { t } = useTranslation();
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
      AppAlert.info(t("songDetail.nothingToPlay"), t("songDetail.selectedNoAudio"));
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
        selectedIdea ? t("songDetail.clipsLabel", { title: selectedIdea.title }) : t("songDetail.appClipsLabel")
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : t("songDetail.shareFailedBody");
      AppAlert.info(t("songDetail.shareFailed"), message);
    } finally {
      setIsSharing(false);
    }
  }

  async function handleGetLinkSelected() {
    if (shareableClips.length === 0 || isSharing) return;
    setIsSharing(true);
    try {
      const label = selectedIdea ? t("songDetail.clipsLabel", { title: selectedIdea.title }) : t("songDetail.appClipsLabel");
      await presentShareLink(() => createClipsShareLink(shareableClips, label), {
        emptyMessage: t("songDetail.selectAudioFirst"),
      });
    } finally {
      setIsSharing(false);
    }
  }

  function handleClipboardAction(mode: "copy" | "move") {
    appActions.startClipboardFromProject(mode);
    AppAlert.info(
      mode === "copy" ? t("songDetail.copyReady") : t("songDetail.moveReady"),
      mode === "copy"
        ? t("songDetail.copyReadyBody")
        : t("songDetail.moveReadyBody")
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
          label: t("songDetail.branch"),
          description: t("songDetail.branchDesc"),
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
                newAudioUri = `${SONG_NOOK_AUDIO_DIR}/${newClipId}.${extension}`;
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
            undo.showUndo(t("songDetail.branched", { title: clip.title }), () => {
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
          label: t("songDetail.split"),
          description: t("songDetail.splitDesc"),
          icon: actionIcons.split,
          onPress: () =>
            parentPicking.handleMakeRoot(selectedClipIds, (nextUndo, message) => {
              undo.showUndo(message, nextUndo);
            }),
        },
        { label: t("common.cancel"), style: "cancel" },
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
      t("songDetail.makePrimaryTitle"),
      t("songDetail.makePrimaryBody"),
      () => {
        appActions.markBestClip(clipId);
        useStore.getState().cancelClipSelection();
      },
      { confirmLabel: t("songDetail.makePrimary"), icon: "star-outline" }
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
      t("songDetail.deleteClipsTitle", { count: selectedClips.length }),
      t("songDetail.deleteClipsBody", { count: selectedClips.length }),
      appActions.deleteSelectedClips,
      { confirmLabel: t("common.delete") }
    );
  }

  const dockActions: SelectionAction[] =
    selectedClips.length === 1
      ? [
          {
            key: "play",
            label: t("common.play"),
            icon: "play-outline",
            onPress: handlePlaySelected,
            disabled: playableSelectedCount === 0,
          },
          {
            key: "edit",
            label: t("songDetail.edit"),
            icon: "create-outline",
            onPress: handleEditSingleClip,
          },
          // Tags live on the clip card itself for a single clip, so the dock offers
          // Primary here instead (disabled when this take is already primary).
          {
            key: "primary",
            label: t("common.primary"),
            icon: "star-outline",
            onPress: handleMakePrimary,
            disabled: !!singleSelectedClip?.isPrimary,
          },
          {
            key: "delete",
            label: t("common.delete"),
            icon: "trash-outline",
            tone: "danger",
            onPress: confirmDeleteSelection,
          },
          {
            key: "more",
            label: t("chordChart.more"),
            icon: "ellipsis-horizontal",
            onPress: () => setMoreVisible(true),
          },
        ]
      : [
          {
            key: "play",
            label: t("common.play"),
            icon: "play-outline",
            onPress: handlePlaySelected,
            disabled: playableSelectedCount === 0,
          },
          {
            key: "tags",
            label: t("songDetail.tags"),
            icon: "pricetag-outline",
            onPress: () => setTagSheetVisible(true),
          },
          {
            key: "delete",
            label: t("common.delete"),
            icon: "trash-outline",
            tone: "danger",
            onPress: confirmDeleteSelection,
          },
          {
            key: "more",
            label: t("chordChart.more"),
            icon: "ellipsis-horizontal",
            onPress: () => setMoreVisible(true),
          },
        ];

  const sheetActions: SelectionAction[] = [
    {
      key: "copy",
      label: t("common.copy"),
      icon: "copy-outline",
      onPress: () => handleClipboardAction("copy"),
    },
    {
      key: "move",
      label: t("songDetail.move"),
      icon: "arrow-forward-outline",
      onPress: () => handleClipboardAction("move"),
    },
    {
      key: "share",
      label: isSharing ? t("songDetail.sharing") : t("songDetail.shareCount", { count: shareableClips.length }),
      icon: "share-social-outline",
      onPress: () => { void handleShareSelected(); },
      disabled: isSharing || shareableClips.length === 0,
    },
    ...(__DEV__ || isSendServiceConfigured()
      ? [
          {
            key: "get-link",
            label: t("songDetail.getLink"),
            icon: "link-outline" as const,
            onPress: () => { void handleGetLinkSelected(); },
            disabled: isSharing || shareableClips.length === 0,
          },
        ]
      : []),
    {
      key: "set-parent",
      label: t("songDetail.setParent"),
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
            label: t("songDetail.startThread"),
            icon: "radio-button-on-outline" as const,
            onPress: handleStartNewThread,
          },
        ]
      : []),
    ...(selectedClips.length === 1 && selectedIdea && singleSelectedClip
      ? [
          {
            key: "bookmark",
            label: singleSelectedClip.isBookmarked ? t("songDetail.removeBookmark") : t("songDetail.bookmarkClip"),
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
              selectedLineageRootIds.length === 1 ? t("songDetail.assignGroup") : t("songDetail.assignGroupSelected"),
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
        title={t("songDetail.songActions")}
        actions={sheetActions}
        onClose={() => setMoreVisible(false)}
      />

      <SelectionActionSheet
        visible={groupSheetVisible}
        title={
          selectedLineageRootIds.length > 1
            ? t("songDetail.assignGroupThreads", { count: selectedLineageRootIds.length })
            : t("songDetail.assignLineageGroup")
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
            label: t("songDetail.createGroup"),
            icon: "add-circle-outline" as const,
            onPress: handleCreateGroupAndAssign,
          },
          ...(anySelectedAssignedToGroup
            ? [
                {
                  key: "remove-group",
                  label:
                    selectedLineageRootIds.length > 1
                      ? t("songDetail.removeSelectedGroup")
                      : t("songDetail.removeGroup"),
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
