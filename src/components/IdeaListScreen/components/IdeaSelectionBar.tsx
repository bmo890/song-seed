import { useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { AppAlert } from "../../common/AppAlert";
import { useStore } from "../../../state/useStore";
import { appActions } from "../../../state/actions";
import { shareAudioClips } from "../../../services/audioStorage";
import { SelectionActionSheet } from "../../common/SelectionActionSheet";
import { SelectionDock, type SelectionAction } from "../../common/SelectionDock";
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
  const [isSharing, setIsSharing] = useState(false);
  const [moreVisible, setMoreVisible] = useState(false);
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
    label: selectedClipIdeasCount > 1 ? `Make song (${selectedClipIdeasCount})` : "Make song",
    icon: "albums-outline",
    onPress: () => onCreateProjectFromSelection?.(),
  };

  // Primary transport action — promoted from the overflow onto the dock. With a
  // session already running it appends to that queue instead of starting anew.
  const playOrQueueAction: SelectionAction = {
    key: "play",
    label: sessionActive
      ? `Add to queue (${playbackQueue.length})`
      : `Play (${playbackQueue.length})`,
    icon: sessionActive ? "add-circle-outline" : "play",
    onPress: sessionActive ? onAddToQueue : onPlaySelected,
    disabled: playbackQueue.length === 0,
  };

  // Editing a single item moved off the dock into the overflow to make room for
  // the transport action.
  const editAction: SelectionAction | null =
    canEditSelection && onEditSelected
      ? { key: "edit", label: "Edit", icon: "create-outline", onPress: onEditSelected }
      : null;

  // While a library-collecting session is active (playlist / songbook /
  // setlist), adding the selection to that target is THE primary intent — it
  // leads the dock. Playlists: songs as song items, clips pin their clip.
  // Songbooks: each song's default charts. Setlists: a default-packed entry
  // per idea (primary clip + latest lyrics + chord chart).
  const addSelectionToCollector = () => {
    const state = useStore.getState();
    const collector = state.libraryCollector;
    if (!collector || !activeWorkspace || interactiveSelectedIdeas.length === 0) return;

    let added = 0;
    if (collector.kind === "playlist") {
      state.addItemsToPlaylist(
        collector.targetId,
        interactiveSelectedIdeas.map((idea) => ({
          kind: idea.kind === "project" ? ("song" as const) : ("clip" as const),
          workspaceId: activeWorkspace.id,
          collectionId: idea.collectionId,
          ideaId: idea.id,
          clipId: idea.kind === "project" ? null : getPlayableClipForIdea(idea)?.id ?? null,
        }))
      );
      added = interactiveSelectedIdeas.length;
    } else if (collector.kind === "songbook") {
      for (const idea of interactiveSelectedIdeas) {
        const defaults = buildDefaultSongbookItemsForIdea(idea);
        if (defaults.length === 0) continue;
        state.addItemsToSongbook(
          collector.targetId,
          defaults.map((choice) => ({
            kind: choice.kind,
            workspaceId: activeWorkspace.id,
            ideaId: idea.id,
            versionId: choice.versionId,
          }))
        );
        added += 1;
      }
      if (added === 0) {
        AppAlert.info(
          "No charts to add",
          "None of the selected songs have lyrics or a chord chart yet."
        );
        return;
      }
    } else {
      for (const idea of interactiveSelectedIdeas) {
        const primary = getPlayableClipForIdea(idea);
        const latestVersion = idea.lyrics?.versions[idea.lyrics.versions.length - 1];
        state.addSetlistEntry(collector.targetId, {
          workspaceId: activeWorkspace.id,
          ideaId: idea.id,
          clipIds: primary ? [primary.id] : [],
          lyricVersionIds: latestVersion ? [latestVersion.id] : [],
          includeChordSheet: !!idea.chordSheet && idea.chordSheet.sections.length > 0,
          includeSongNotes: false,
        });
        added += 1;
      }
    }

    state.noteLibraryCollectorAdded(added);
    state.cancelListSelection();
    haptic.success();
  };
  const collectorKind = useStore((s) => s.libraryCollector?.kind ?? null);
  const collectorNoun =
    collectorKind === "songbook" ? "book" : collectorKind === "setlist" ? "set" : "playlist";
  const collectorAction: SelectionAction = {
    key: "add-to-collector",
    label:
      interactiveSelectedIdeas.length > 1
        ? `Add ${interactiveSelectedIdeas.length} to ${collectorNoun}`
        : `Add to ${collectorNoun}`,
    icon:
      collectorKind === "songbook"
        ? "book-outline"
        : collectorKind === "setlist"
          ? "albums-outline"
          : "musical-notes-outline",
    onPress: addSelectionToCollector,
    disabled: interactiveSelectedIdeas.length === 0,
  };

  async function handleShareSelected() {
    if (shareableClips.length === 0 || isSharing) return;

    try {
      setIsSharing(true);
      await shareAudioClips(
        shareableClips,
        activeWorkspace?.title ? `${activeWorkspace.title} Selection` : "SongNook Selection"
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not share the selected items.";
      AppAlert.info("Share failed", message);
    } finally {
      setIsSharing(false);
    }
  }

  function handleClipboardAction(mode: "copy" | "move") {
    appActions.startClipboardFromList(mode);
    AppAlert.info(
      mode === "copy" ? "Copy ready" : "Move ready",
      mode === "copy"
        ? "Tap \"Paste items here\" in this or another collection to finish copying these items."
        : "Open the destination collection and tap \"Paste items here\" to finish moving these items."
    );
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
        ? `${interactiveSelectedIdeas.length} items on the shelf for 7 days`
        : "On the shelf for 7 days",
      "file-tray-outline",
      { action: { label: "View shelf", onPress: () => openShelf(navigation) } }
    );
    haptic.success();
    setMoreVisible(false);
    useStore.getState().cancelListSelection();
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

    AppAlert.destructive("Delete selected items?", message, onDeleteSelected, { confirmLabel: "Delete" });
  }

  const dockActions: SelectionAction[] = useMemo(() => {
    // Collecting mode: the dock is about one thing — adding to the playlist.
    // Everything else stays reachable through More.
    if (libraryCollectorActive && !selectedHiddenOnly) {
      return [
        collectorAction,
        {
          key: "more",
          label: "More",
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

    // Transport (Play / Add to queue) leads the dock; Edit lives in More now.
    return [
      ...(canMakeSong ? [makeSongAction] : []),
      playOrQueueAction,
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
      actions.push({
        key: "set-aside",
        label:
          interactiveSelectedIdeas.length > 1
            ? `Set aside (${interactiveSelectedIdeas.length})`
            : "Set aside",
        icon: "file-tray-outline",
        onPress: handleSetAsideSelection,
        disabled: interactiveSelectedIdeas.length === 0,
      });
    }

    // "Make song" lives on the dock now (see makeSongAction).

    return actions;
  }, [
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

  // Choosing an action is terminal: selection mode ends the moment it's tapped,
  // for EVERY action (play, add-to-queue, hide, delete, edit, share, copy, move,
  // make-song…). The one exception is "More", which just opens the overflow sheet
  // and must keep the selection alive for the actions inside it. Wrapping here
  // guarantees consistency no matter what each handler does internally.
  const endsSelection = (action: SelectionAction): SelectionAction =>
    action.key === "more"
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
        title="Collection actions"
        actions={sheetActions.map(endsSelection)}
        onClose={() => setMoreVisible(false)}
      />
    </>
  );
}
