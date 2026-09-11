import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { AppAlert } from "../../common/AppAlert";
import { useStore } from "../../../state/useStore";
import { appActions } from "../../../state/actions";
import { addIdeasToLibraryCollector } from "../../../state/libraryCollectorActions";
import { shareAudioClips } from "../../../services/audioStorage";
import { SelectionActionSheet } from "../../common/SelectionActionSheet";
import { SelectionDock, type SelectionAction } from "../../common/SelectionDock";
import { DockAddBadgeIcon } from "../../common/dockIcons";
import { getHierarchyIconName } from "../../../domain/hierarchy";
import type { SongIdea } from "../../../types";
import { buildPlayableQueueFromIdeas, getPlayableClipForIdea } from "../../../domain/clipPresentation";
import { buildDefaultSongbookItemsForIdea } from "../../../domain/songbookGrouping";
import { haptic } from "../../../design/haptics";
import { useShelfStore } from "../../../state/useShelfStore";
import { openShelf } from "../../../navigation";
import { toast } from "../../common/toastStore";

type IdeaSelectionBarProps = {
  selectableIdeaIds: string[];
  disabledIdeaIds?: string[];
  onPlaySelected: () => void;
  onAddToQueue: () => void;
  onToggleHideSelected: () => void;
  hideActionLabel: string;
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
  onAddToQueue,
  onToggleHideSelected,
  hideActionLabel,
  hideActionDisabled,
  onDeleteSelected,
  onEditSelected,
  onCreateProjectFromSelection,
  selectedClipIdeasCount,
  onDockLayout,
}: IdeaSelectionBarProps) {
  const { t } = useTranslation();
  const [isSharing, setIsSharing] = useState(false);
  const [moreVisible, setMoreVisible] = useState(false);
  // Second-level "Copy or move" sheet under More (More closes itself before
  // handing off, so the next sheet opens cleanly).
  const [copyMoveVisible, setCopyMoveVisible] = useState(false);
  const navigation = useNavigation<any>();

  const selectedListIdeaIds = useStore((s) => s.selectedListIdeaIds);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const workspaces = useStore((s) => s.workspaces);
  const replaceListSelection = useStore((s) => s.replaceListSelection);
  const libraryCollectorActive = useStore((s) => !!s.libraryCollector);
  // A running session turns the dock's primary action from "Play" into
  // "Add to queue" — the way to grow the queue you already have going.
  const sessionActive = useStore((s) => s.playerQueue.length > 0);
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
    () => buildPlayableQueueFromIdeas(interactiveSelectedIdeas),
    [interactiveSelectedIdeas]
  );

  const shareableClips = useMemo(
    () =>
      interactiveSelectedIdeas
        .map((idea) => {
          const clip = getPlayableClipForIdea(idea);
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
  // Turning clip(s) into a song is a primary intent — surface it on the dock,
  // not buried in the overflow.
  const canMakeSong =
    !selectedHiddenOnly &&
    selectedClipIdeasCount > 0 &&
    selectedProjects.length === 0 &&
    !!onCreateProjectFromSelection;
  const makeSongAction: SelectionAction = {
    key: "make-song",
    // "Sketch" (verb + noun) — gather the selected takes into a sketch. The count
    // lives in the top bar ("N selected"), so the button label stays a clean word.
    label: t("brand.sketch"),
    // Standard disc glyph (matches how a sketch/song reads everywhere else),
    // replacing the bespoke merge-box icon.
    icon: getHierarchyIconName("song"),
    onPress: () => onCreateProjectFromSelection?.(),
  };

  // Primary transport action — promoted from the overflow onto the dock. With a
  // session already running it appends to that queue instead of starting anew.
  const playOrQueueAction: SelectionAction = {
    key: "play",
    // Idle → "Play"; a session already running → "Queue" (add to what's playing).
    // The Queue glyph is the play triangle carrying a "+", so the two read as one
    // family — Play, then Play-plus.
    label: sessionActive ? t("selection.queue") : t("common.play"),
    icon: sessionActive ? "add-circle-outline" : "play",
    renderIcon: sessionActive
      ? ({ color, size, disabled }) => (
          <DockAddBadgeIcon base="play" color={color} size={size} disabled={disabled} />
        )
      : undefined,
    onPress: sessionActive ? onAddToQueue : onPlaySelected,
    disabled: playbackQueue.length === 0,
  };

  // Editing a single item moved off the dock into the overflow to make room for
  // the transport action.
  const editAction: SelectionAction | null =
    canEditSelection && onEditSelected
      ? { key: "edit", label: t("selection.edit"), icon: "create-outline", onPress: onEditSelected }
      : null;

  // While a library-collecting session is active (playlist / songbook /
  // setlist), adding the selection to that target is THE primary intent — it
  // leads the dock. Playlists: songs as song items, clips pin their clip.
  // Songbooks: each song's default charts. Setlists: a default-packed entry
  // per idea (primary clip + latest lyrics + chord chart).
  const addSelectionToCollector = () => {
    const state = useStore.getState();
    if (!state.libraryCollector || !activeWorkspace || interactiveSelectedIdeas.length === 0) return;
    const result = addIdeasToLibraryCollector(interactiveSelectedIdeas.map((idea) => idea.id));
    if (result.noCharts) {
      AppAlert.info(t("selection.noCharts"), t("selection.noChartsBody"));
      return;
    }
    state.cancelListSelection();
    haptic.success();
  };
  const collectorKind = useStore((s) => s.libraryCollector?.kind ?? null);
  // The verb, not the destination: the banner above already says "Adding to <title>",
  // and the kind glyph on the key says what it is (2026-09-11).
  const collectorNoun = t("selection.add");
  const collectorIcon: SelectionAction["icon"] =
    collectorKind === "songbook"
      ? "book-outline"
      : collectorKind === "setlist"
        ? "albums-outline"
        : "musical-notes-outline";
  const collectorAction: SelectionAction = {
    key: "add-to-collector",
    label: collectorNoun,
    icon: collectorIcon,
    renderIcon: ({ color, size, disabled }) => (
      <DockAddBadgeIcon base={collectorIcon} color={color} size={size} disabled={disabled} />
    ),
    onPress: addSelectionToCollector,
    disabled: interactiveSelectedIdeas.length === 0,
  };

  async function handleShareSelected() {
    if (shareableClips.length === 0 || isSharing) return;

    try {
      setIsSharing(true);
      await shareAudioClips(
        shareableClips,
        activeWorkspace?.title ? t("selection.workspaceSelection", { title: activeWorkspace.title }) : t("selection.defaultSelection")
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : t("selection.shareFailedBody");
      AppAlert.info(t("selection.shareFailed"), message);
    } finally {
      setIsSharing(false);
    }
  }

  function handleClipboardAction(mode: "copy" | "move") {
    appActions.startClipboardFromList(mode);
    AppAlert.info(
      mode === "copy" ? t("common.copyReady", { count: selectedIdeas.length }) : t("common.moveReady", { count: selectedIdeas.length }),
      mode === "copy"
        ? t("selection.copyReadyBody")
        : t("selection.moveReadyBody")
    );
  }

  // Bookmark moved off the card (approved capability move 2026-07-23): the
  // selection flow is now the one place to toggle it. Set semantics — any
  // unbookmarked item in the selection → bookmark everything; all bookmarked
  // → remove from everything.
  const allSelectedBookmarked =
    interactiveSelectedIdeas.length > 0 &&
    interactiveSelectedIdeas.every((idea) => idea.isBookmarked);
  function handleToggleBookmarks() {
    if (interactiveSelectedIdeas.length === 0) return;
    // haptics vocabulary: `light` — "small state flips that should land: favorite".
    haptic.light();
    const state = useStore.getState();
    for (const idea of interactiveSelectedIdeas) {
      if (allSelectedBookmarked ? idea.isBookmarked : !idea.isBookmarked) {
        state.toggleIdeaBookmark(idea.id);
      }
    }
  }

  // One tap, no prompt — the shelf holds pointers, so nothing moves in the
  // library; already-shelved items just get a fresh 7-day stay.
  function handleSetAsideSelection() {
    if (interactiveSelectedIdeas.length === 0) return;
    useShelfStore
      .getState()
      .setAside(interactiveSelectedIdeas.map((idea) => ({ kind: "idea" as const, id: idea.id })));
    toast(
      interactiveSelectedIdeas.length > 1
        ? t("selection.shelfCount", { count: interactiveSelectedIdeas.length })
        : t("selection.shelfOne"),
      "file-tray-outline",
      { action: { label: t("selection.viewShelf"), onPress: () => openShelf(navigation) } }
    );
    haptic.success();
    setMoreVisible(false);
    useStore.getState().cancelListSelection();
  }

  function confirmDeleteSelection() {
    const projectNames = selectedProjects.map((project) => project.title).slice(0, 4);
    const projectList =
      projectNames.length > 0
        ? `\n\n${t("selection.songs")}: ${projectNames.join(", ")}${selectedProjects.length > 4 ? "…" : ""}`
        : "";
    const message =
      selectedProjects.length > 0
        ? `${t("selection.deleteSongs", { count: selectedProjects.length })} ${t("selection.deleteClips", { count: selectedClipIdeas.length })}.${projectList}`
        : t("selection.deleteSelectedClips", { count: selectedClipIdeas.length });

    AppAlert.destructive(t("selection.deleteSelected"), message, onDeleteSelected, { confirmLabel: t("common.delete") });
  }

  const dockActions: SelectionAction[] = useMemo(() => {
    // Collecting mode: the dock is about one thing — adding to the playlist.
    // Everything else stays reachable through More.
    if (libraryCollectorActive && !selectedHiddenOnly) {
      return [
        collectorAction,
        {
          key: "more",
          label: t("common.more"),
          icon: "ellipsis-horizontal",
          onPress: () => setMoreVisible(true),
        },
      ];
    }

    if (selectedHiddenOnly) {
      return [
        {
          key: "unhide",
          label: hideActionLabel,
          icon: selectedHiddenOnly ? "eye-outline" : "eye-off-outline",
          onPress: onToggleHideSelected,
          disabled: hideActionDisabled,
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
          label: t("common.more"),
          icon: "ellipsis-horizontal",
          onPress: () => setMoreVisible(true),
        },
      ];
    }

    // Transport (Play / Add to queue) leads the dock; Edit lives in More now.
    return [
      ...(canMakeSong ? [makeSongAction] : []),
      playOrQueueAction,
      {
        key: "hide",
        label: hideActionLabel,
        icon: selectedHiddenOnly ? "eye-outline" : "eye-off-outline",
        onPress: onToggleHideSelected,
        disabled: hideActionDisabled,
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
        label: t("common.more"),
        icon: "ellipsis-horizontal",
        onPress: () => setMoreVisible(true),
      },
    ];
  }, [
    canMakeSong,
    collectorAction,
    makeSongAction,
    playOrQueueAction,
    confirmDeleteSelection,
    hideActionDisabled,
    hideActionLabel,
    onToggleHideSelected,
    libraryCollectorActive,
    selectedHiddenOnly,
  ]);

  const sheetActions: SelectionAction[] = useMemo(() => {
    const actions: SelectionAction[] = [];

    // Edit a single item — moved off the dock to make room for the transport action.
    if (editAction) {
      actions.push(editAction);
    }

    if (!selectedHiddenOnly && shareableClips.length > 0) {
      actions.push({
        key: "share",
        label: isSharing ? t("selection.sharing") : t("selection.shareCount", { count: shareableClips.length }),
        icon: "share-social-outline",
        onPress: () => {
          void handleShareSelected();
        },
        disabled: isSharing,
      });
    }

    if (!selectedHiddenOnly) {
      actions.push({
        key: "bookmark",
        label: allSelectedBookmarked ? t("selection.removeBookmark") : t("selection.bookmark"),
        icon: allSelectedBookmarked ? "bookmark" : "bookmark-outline",
        onPress: handleToggleBookmarks,
        disabled: interactiveSelectedIdeas.length === 0,
      });
      // Bookmark and Shelf sit together — both are "keep this for later".
      actions.push({
        key: "set-aside",
        label:
          interactiveSelectedIdeas.length > 1
            ? t("selection.setAsideCount", { count: interactiveSelectedIdeas.length })
            : t("selection.setAside"),
        // Timer glyph — shelving is about a 7-day stay, not a container.
        icon: "timer-outline",
        onPress: handleSetAsideSelection,
        disabled: interactiveSelectedIdeas.length === 0,
      });
      actions.push({
        key: "copy-or-move",
        label: t("selection.copyOrMove"),
        icon: "copy-outline",
        onPress: () => setCopyMoveVisible(true),
      });
    }

    // "Make song" lives on the dock now (see makeSongAction).

    return actions;
  }, [
    allSelectedBookmarked,
    canDeselectAll,
    editAction,
    handleShareSelected,
    interactiveSelectedIdeas,
    isSharing,
    onCreateProjectFromSelection,
    replaceListSelection,
    selectableIdeaIds,
    selectedClipIdeasCount,
    selectedHiddenOnly,
    selectedProjects.length,
    shareableClips.length,
  ]);

  const copyMoveActions: SelectionAction[] = [
    {
      key: "copy",
      label: t("common.copy"),
      icon: "copy-outline",
      onPress: () => handleClipboardAction("copy"),
    },
    {
      key: "move",
      label: t("common.move"),
      icon: "arrow-forward-outline",
      onPress: () => handleClipboardAction("move"),
    },
  ];

  // Choosing an action is terminal: selection mode ends the moment it's tapped,
  // for EVERY action (play, add-to-queue, hide, delete, edit, share, copy, move,
  // make-song…). The exceptions are "More" and "Copy or move…", which only open
  // a sheet and must keep the selection alive for the actions inside it.
  // Wrapping here guarantees consistency no matter what each handler does
  // internally.
  const OPENS_SHEET = new Set(["more", "copy-or-move"]);
  const endsSelection = (action: SelectionAction): SelectionAction =>
    OPENS_SHEET.has(action.key)
      ? action
      : {
          ...action,
          onPress: () => {
            action.onPress();
            useStore.getState().cancelListSelection();
          },
        };

  return (
    <>
      <SelectionDock
        actions={dockActions.map(endsSelection)}
        onLayout={onDockLayout}
      />

      <SelectionActionSheet
        visible={moreVisible}
        title={t("selection.collectionActions")}
        actions={sheetActions.map(endsSelection)}
        onClose={() => setMoreVisible(false)}
      />

      <SelectionActionSheet
        visible={copyMoveVisible}
        title={t("selection.copyOrMoveTitle")}
        actions={copyMoveActions.map(endsSelection)}
        onClose={() => setCopyMoveVisible(false)}
      />
    </>
  );
}
