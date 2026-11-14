import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { AppAlert } from "../../common/AppAlert";
import { useStore } from "../../../state/useStore";
import { useIsReadOnlyWorkspace } from "../../../hooks/useReadOnly";
import { appActions } from "../../../state/actions";
import { shareAudioClips, type ShareableAudioClip } from "../../../services/audioStorage";
import { SelectionActionSheet } from "../../common/SelectionActionSheet";
import { SelectionDock, type SelectionAction } from "../../common/SelectionDock";
import { DockAddBadgeIcon } from "../../common/dockIcons";
import { getHierarchyIconName } from "../../../domain/hierarchy";
import { buildPlayableQueueFromIdeas, getPlayableClipForIdea } from "../../../domain/clipPresentation";
import { haptic } from "../../../design/haptics";
import { useShelfStore } from "../../../state/useShelfStore";
import { openShelf } from "../../../navigation";
import { toast } from "../../common/toastStore";
import { BottomSheet } from "../../common/BottomSheet";
import { ClipTagEditorFields, type ClipTagTarget } from "../../IdeaDetailScreen/components/ClipTagPicker";
import { PlaylistChooserSheet } from "../../common/PlaylistChooserSheet";
import { openSendSheet } from "../../../state/useSendSheetStore";
import { createCardsShareLink } from "../../../services/parcelShare";
import { ideaParts } from "../../../domain/parcelContents";
import { dawExportTargetForClip, exportClipForDaw } from "../../../services/dawExport";
import { ideasShareKind, shareIdeasFile } from "../../../services/ideasShare";
import { isSendServiceConfigured } from "../../../config/sendService";
import { styles } from "../../../styles";
import { View } from "react-native";
import { userFacingMessage } from "../../../i18n/userFacingError";
import { ensurePro } from "../../common/proUpsell";

type IdeaSelectionBarProps = {
  /** The page's workspace; falls back to the active one. A visited received
   *  package is never made active, so its selection must read the route's. */
  workspaceId?: string;
  selectableIdeaIds: string[];
  /** Every idea in the order the page shows it (its sort, its day groups). Each action
   *  here acts in this order, as Play does: a playlist made from a selection plays
   *  down the list as shown, not in storage order. */
  orderedIdeaIds?: string[];
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
  workspaceId: pageWorkspaceId,
  selectableIdeaIds,
  orderedIdeaIds,
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
  // Share… is the same two-step door as everywhere else: the row opens the
  // exits first (founder, 2026-10-13: how, then what). Share audio is always
  // the primary takes and Export always the whole sketch, so only SongNook
  // Send — which can carry either — asks, last, saying what the sketch holds.
  //   exits → (SongNook Send, with a sketch) sendScope
  const [shareSheet, setShareSheet] = useState<null | "exits">(null);
  const [tagsVisible, setTagsVisible] = useState(false);
  const [playlistVisible, setPlaylistVisible] = useState(false);
  const globalCustomTags = useStore((s) => s.globalCustomClipTags);
  const navigation = useNavigation<any>();

  const selectedListIdeaIds = useStore((s) => s.selectedListIdeaIds);
  const storeActiveWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const activeWorkspaceId = pageWorkspaceId ?? storeActiveWorkspaceId;
  const readOnly = useIsReadOnlyWorkspace(activeWorkspaceId);
  const replaceListSelection = useStore((s) => s.replaceListSelection);
  // A running session turns the dock's primary action from "Play" into
  // "Add to queue" — the way to grow the queue you already have going.
  const sessionActive = useStore((s) => s.playerQueue.length > 0);
  const disabledIdeaIdSet = useMemo(() => new Set(disabledIdeaIds), [disabledIdeaIds]);

  // One workspace, not the library: `find` returns the same object while the
  // workspace is untouched, so writes elsewhere don't re-render the bar.
  const activeWorkspace = useStore((s) => s.workspaces.find((workspace) => workspace.id === activeWorkspaceId));
  const selectedIdeas = useMemo(() => {
    const picked = (activeWorkspace?.ideas ?? []).filter((idea) => selectedListIdeaIds.includes(idea.id));
    if (!orderedIdeaIds || orderedIdeaIds.length === 0) return picked;
    // On-screen order; anything not on screen (a collapsed day) keeps storage order, last.
    const position = new Map(orderedIdeaIds.map((id, index) => [id, index]));
    const rank = (id: string) => position.get(id) ?? Number.MAX_SAFE_INTEGER;
    return picked
      .map((idea, storageIndex) => ({ idea, storageIndex }))
      .sort((a, b) => rank(a.idea.id) - rank(b.idea.id) || a.storageIndex - b.storageIndex)
      .map(({ idea }) => idea);
  }, [activeWorkspace?.ideas, orderedIdeaIds, selectedListIdeaIds]);
  const interactiveSelectedIdeas = useMemo(
    () => selectedIdeas.filter((idea) => !disabledIdeaIdSet.has(idea.id)),
    [disabledIdeaIdSet, selectedIdeas]
  );
  const selectedClipIdeas = useMemo(
    () => selectedIdeas.filter((idea) => idea.kind === "clip"),
    [selectedIdeas]
  );
  // Tags live on clips (founder, 2026-10-03): the sheet tags every clip of
  // the selected clip ideas, read live so the chips follow each toggle.
  const tagTargets = useMemo<ClipTagTarget[]>(
    () =>
      selectedClipIdeas
        .filter((idea) => !disabledIdeaIdSet.has(idea.id))
        .flatMap((idea) => idea.clips.map((clip) => ({ ideaId: idea.id, clip }))),
    [disabledIdeaIdSet, selectedClipIdeas]
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
          const shareable: ShareableAudioClip = {
            title: clip.title || idea.title,
            audioUri: clip.audioUri,
          };
          return shareable;
        })
        .filter((clip): clip is ShareableAudioClip => !!clip),
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
    // "New sketch": this makes something. The count lives in the top bar
    // ("N selected"), so the label stays two words.
    label: t("selection.newSketch"),
    // The sketch disc wearing the "+" badge — same family as Play → Queue, so
    // "creates a new one" reads at a glance (founder, 2026-10-03).
    icon: getHierarchyIconName("song"),
    renderIcon: ({ color, size, disabled }) => (
      <DockAddBadgeIcon base={getHierarchyIconName("song")} color={color} size={size} disabled={disabled} />
    ),
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

  const selectionLabel = activeWorkspace?.title
    ? t("selection.workspaceSelection", { title: activeWorkspace.title })
    : t("selection.defaultSelection");
  const linkAvailable = __DEV__ || isSendServiceConfigured();
  // Export for DAW (2026-11-01): one card whose take was recorded to the click.
  const dawTarget = useMemo(
    () =>
      interactiveSelectedIdeas.length === 1
        ? dawExportTargetForClip(getPlayableClipForIdea(interactiveSelectedIdeas[0]), interactiveSelectedIdeas[0].title)
        : null,
    [interactiveSelectedIdeas]
  );
  const selectedSketchCount = interactiveSelectedIdeas.filter((idea) => idea.kind === "project").length;

  /** SongNook Send: every card, in the order the sender sets, each with what
   *  travels beside its audio (notes, marks, layers, takes, lyrics, chart)
   *  in or out. Plain memos still go as plain audio (services/parcelShare). */
  function handleSend() {
    // Keyed by position: two cards may share a title, and a key must never drop one.
    const entries = interactiveSelectedIdeas.map((idea, index) => ({ key: String(index), idea }));
    if (entries.length === 0) return;
    const label = entries.length === 1 ? entries[0].idea.title : selectionLabel;
    openSendSheet({
      title: label,
      kind: entries.every((entry) => entry.idea.kind === "clip") ? "clips" : ideasShareKind(interactiveSelectedIdeas),
      emptyMessage: t("selection.nothingWholeBody"),
      items: entries.map(({ key, idea }) => ({ key, title: idea.title, parts: ideaParts(idea) })),
      create: (parcel) => createCardsShareLink(entries, label, parcel),
    });
  }

  /** The whole selection as one package: every take, words, charts, notes, marks. */
  const wholeTitle = interactiveSelectedIdeas.length === 1 ? interactiveSelectedIdeas[0].title : selectionLabel;
  async function handleExportWhole() {
    const ideas = interactiveSelectedIdeas;
    try {
      const shared = await shareIdeasFile(ideas, wholeTitle);
      if (!shared) AppAlert.info(t("collection.nothingShare"), t("selection.nothingWholeBody"));
    } catch (error) {
      console.warn("Selection export error", error);
      AppAlert.error(t("selection.shareFailed"), t("selection.shareFailedBody"));
    }
  }
  async function handleShareSelected() {
    if (shareableClips.length === 0 || isSharing) return;

    try {
      setIsSharing(true);
      await shareAudioClips(
        shareableClips,
        activeWorkspace?.title ? t("selection.workspaceSelection", { title: activeWorkspace.title }) : t("selection.defaultSelection")
      );
    } catch (error) {
      const message = userFacingMessage(error, t("selection.shareFailedBody"));
      AppAlert.error(t("selection.shareFailed"), message);
    } finally {
      setIsSharing(false);
    }
  }

  async function handleExportForDaw() {
    if (!dawTarget) return;
    // Export for DAW is a Pro tool (domain/proCatalog.ts); sharing the take's own audio stays free.
    if (!ensurePro("daw-export")) return;
    try {
      await exportClipForDaw(dawTarget.audioUri, dawTarget.title, dawTarget.grid);
    } catch (error) {
      console.warn("Export for DAW error", error);
      AppAlert.error(t("player.shareFailed"), userFacingMessage(error, t("player.shareAudioFailed")));
    }
  }

  function handleClipboardAction(mode: "copy" | "move") {
    appActions.startClipboardFromList(mode, activeWorkspaceId ?? undefined);
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
        ? `\n\n${t("selection.sketchesLabel")}: ${projectNames.join(", ")}${selectedProjects.length > 4 ? "…" : ""}`
        : "";
    // "Also N clips." only when there are clips (it read "Also 0 clips.." before).
    const alsoClips =
      selectedClipIdeas.length > 0 ? ` ${t("selection.deleteClips", { count: selectedClipIdeas.length })}` : "";
    const message =
      selectedProjects.length > 0
        ? `${t("selection.deleteSongs", { count: selectedProjects.length })}${alsoClips} ${t("recentlyDeleted.confirmLine")}${projectList}`
        : `${t("selection.deleteSelectedClips", { count: selectedClipIdeas.length })} ${t("recentlyDeleted.confirmLine")}`;

    AppAlert.destructive(t("selection.deleteSelected"), message, onDeleteSelected, { confirmLabel: t("common.delete") });
  }

  // Collecting no longer lives here: while a compilation is collecting, the
  // collection page is a picker with its own footer (PickerFooter, 2026-09-11)
  // and this dock never mounts.
  const dockActions: SelectionAction[] = useMemo(() => {
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
    makeSongAction,
    playOrQueueAction,
    confirmDeleteSelection,
    hideActionDisabled,
    hideActionLabel,
    onToggleHideSelected,
    selectedHiddenOnly,
  ]);

  const shareAudioAction: SelectionAction = {
    key: "share",
    label: isSharing ? t("selection.sharing") : t("player.shareAudio"),
    icon: "share-social-outline",
    onPress: () => {
      void handleShareSelected();
    },
    disabled: isSharing || shareableClips.length === 0,
  };
  const sendRow = (onPress: () => void): SelectionAction[] =>
    linkAvailable
      ? [{ key: "songnook-send", label: t("collection.getLink"), icon: "paper-plane-outline", exit: "send", onPress }]
      : [];
  // The sheet orders the exits and says what each carries (shareExits.ts).
  // With a sketch among the cards, Share audio and the file say which of the
  // sketch they carry instead.
  const hasSketch = selectedSketchCount > 0;
  const shareExitActions: SelectionAction[] = hasSketch
    ? [
        { ...shareAudioAction, exit: "audio", hint: t("selection.shareAudioHint", { count: selectedSketchCount }) },
        {
          key: "export",
          label: t("shareExit.fileLabel"),
          icon: "folder-open-outline",
          exit: "export",
          hint: t("selection.exportWholeHint", { count: selectedSketchCount }),
          onPress: () => void handleExportWhole(),
        },
        ...sendRow(handleSend),
      ]
    : [
        { ...shareAudioAction, exit: "audio" },
        ...(dawTarget
          ? [
              {
                key: "export-daw",
                label: t("player.exportForDaw"),
                icon: "desktop-outline" as const,
                exit: "daw" as const,
                onPress: () => void handleExportForDaw(),
              },
            ]
          : []),
        ...sendRow(handleSend),
      ];

  const sheetActions: SelectionAction[] = useMemo(() => {
    const actions: SelectionAction[] = [];

    // Edit a single item — moved off the dock to make room for the transport action.
    if (editAction) {
      actions.push(editAction);
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
        // The Shelf wears one glyph everywhere: the side menu's.
          icon: "file-tray-outline",
        onPress: handleSetAsideSelection,
        disabled: interactiveSelectedIdeas.length === 0,
      });
      if (tagTargets.length > 0) {
        actions.push({
          key: "tag-clips",
          label: t("selection.tagClips"),
          icon: "pricetag-outline",
          onPress: () => {
            setMoreVisible(false);
            setTagsVisible(true);
          },
          opens: true,
        });
      }
      // Somewhere else: another collection (copy, move) or a playlist, behind
      // one row (2026-10-21: the sheet ran to seven rows; the cap is six).
      actions.push({
        key: "copy-or-move",
        label: t("selection.copyMovePlaylist"),
        icon: "copy-outline",
        onPress: () => setCopyMoveVisible(true),
        opens: true,
      });
    }

    // Order rule: sending out comes last. One Share row that opens the chooser, as on every other door. With no
    // link service and no sketch there is nothing to choose between, so the
    // row shares the audio directly instead of opening a one-row sheet.
    if (!selectedHiddenOnly && (shareableClips.length > 0 || selectedSketchCount > 0)) {
      if (linkAvailable || selectedSketchCount > 0 || dawTarget) {
        actions.push({
          key: "share-menu",
          label: t("selection.shareMenu"),
          icon: "share-social-outline",
          onPress: () => setShareSheet("exits"),
          opens: true,
        });
      } else {
        actions.push(shareAudioAction);
      }
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
    tagTargets.length,
    linkAvailable,
    selectedSketchCount,
    dawTarget,
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
    // Keep these for listening: into a playlist, existing or new.
    {
      key: "playlist",
      label: t("selection.addToPlaylist"),
      icon: "musical-notes-outline",
      onPress: () => {
        setCopyMoveVisible(false);
        setPlaylistVisible(true);
      },
      opens: true,
      disabled: interactiveSelectedIdeas.length === 0,
    },
  ];

  // Read-only page (a parcel before Keep, an archive — decision B): the selection
  // plays, sets aside, copies out, collects into a playlist and sends. Nothing
  // here edits, hides, moves or deletes.
  const visibleDockActions: SelectionAction[] = readOnly
    ? [playOrQueueAction, { key: "more", label: t("common.more"), icon: "ellipsis-horizontal", onPress: () => setMoreVisible(true) }]
    : dockActions;
  const READ_ONLY_SHEET_KEYS = new Set(["set-aside", "copy-or-move", "share-menu", "share"]);
  const visibleSheetActions: SelectionAction[] = readOnly
    ? sheetActions.filter((action) => READ_ONLY_SHEET_KEYS.has(action.key))
    : sheetActions;
  const visibleCopyMoveActions: SelectionAction[] = readOnly
    ? copyMoveActions.filter((action) => action.key !== "move")
    : copyMoveActions;

  // Choosing an action is terminal: selection mode ends the moment it's tapped,
  // for EVERY action (play, add-to-queue, hide, delete, edit, share, copy, move,
  // make-song…). The exceptions are "More" and "Copy or move…", which only open
  // a sheet and must keep the selection alive for the actions inside it.
  // Wrapping here guarantees consistency no matter what each handler does
  // internally.
  // "playlist" was missing here (2026-10-13): the chooser opened with the
  // selection already cleared and quietly filed nothing.
  const OPENS_SHEET = new Set([
    "more",
    "copy-or-move",
    "tag-clips",
    "playlist",
    "share-menu",
    "songnook-send-scope",
  ]);
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
        actions={visibleDockActions.map(endsSelection)}
        onLayout={onDockLayout}
      />

      <SelectionActionSheet
        visible={moreVisible}
        // Named like every sheet: what it acts on ("1 idea · logic-bounce").
        title={t("common.ideaCount", { count: selectedIdeas.length })}
        titleContext={selectedIdeas.length === 1 ? selectedIdeas[0]!.title : undefined}
        actions={visibleSheetActions.map(endsSelection)}
        onClose={() => setMoreVisible(false)}
      />

      <SelectionActionSheet
        visible={copyMoveVisible}
        onBack={() => setMoreVisible(true)}
        title={t("selection.copyMovePlaylist")}
        actions={visibleCopyMoveActions.map(endsSelection)}
        onClose={() => setCopyMoveVisible(false)}
      />

      {/* Share…: the exits. Its back key returns to More, so drilling in is never one-way. */}
      <SelectionActionSheet
        visible={shareSheet === "exits"}
        onBack={() => setMoreVisible(true)}
        title={t("selection.shareSheetTitle")}
        actions={shareExitActions.map(endsSelection)}
        onClose={() => setShareSheet(null)}
      />

      <PlaylistChooserSheet
        visible={playlistVisible}
        onClose={() => setPlaylistVisible(false)}
        items={interactiveSelectedIdeas.map((idea) => ({ ideaId: idea.id }))}
        label={
          interactiveSelectedIdeas.length === 1
            ? interactiveSelectedIdeas[0]!.title
            : t("playlistChooser.items", { count: interactiveSelectedIdeas.length })
        }
      />

      {/* The sketch's tag picker, pointed at the selected clips. Closing keeps
          the selection, like the other sheets. */}
      <BottomSheet visible={tagsVisible} onClose={() => setTagsVisible(false)} dismissDistance={420} keyboardAvoiding>
        <View style={styles.tagPickerContent}>
          <ClipTagEditorFields targets={tagTargets} globalCustomTags={globalCustomTags} />
        </View>
      </BottomSheet>
    </>
  );
}
