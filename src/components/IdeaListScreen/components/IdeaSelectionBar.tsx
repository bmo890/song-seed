import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useNavigation } from "@react-navigation/native";
import { AppAlert } from "../../common/AppAlert";
import { useStore } from "../../../state/useStore";
import { appActions } from "../../../state/actions";
import { shareAudioClips } from "../../../services/audioStorage";
import { SelectionActionSheet } from "../../common/SelectionActionSheet";
import { SelectionDock, type SelectionAction } from "../../common/SelectionDock";
import { DockAddBadgeIcon } from "../../common/dockIcons";
import { getHierarchyIconName } from "../../../domain/hierarchy";
import type { SongIdea } from "../../../types";
import { buildPlayableQueueFromIdeas, getPlayableClipForIdea } from "../../../domain/clipPresentation";
import { haptic } from "../../../design/haptics";
import { useShelfStore } from "../../../state/useShelfStore";
import { openShelf } from "../../../navigation";
import { toast } from "../../common/toastStore";
import { BottomSheet } from "../../common/BottomSheet";
import { ClipTagEditorFields, type ClipTagTarget } from "../../IdeaDetailScreen/components/ClipTagPicker";
import { PlaylistChooserSheet } from "../../common/PlaylistChooserSheet";
import { openSendSheet } from "../../../state/useSendSheetStore";
import { createClipsShareLink } from "../../../services/clipShareLink";
import { createIdeasShareLink, ideasShareKind, shareIdeasFile } from "../../../services/ideasShare";
import { orderByKeys } from "../../../domain/parcelOrder";
import { isSendServiceConfigured } from "../../../config/sendService";
import { styles } from "../../../styles";
import { View } from "react-native";

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

/** "A sketch · 3 takes · lyrics · chords · notes" — what the whole-sketch
 *  choice would carry, so the question answers itself. */
function describeSketchContents(idea: SongIdea, t: TFunction): string {
  const lines = idea.lyrics?.versions.flatMap((version) => version.document.lines) ?? [];
  const parts = [t("selection.aSketch"), t("selection.takesCount", { count: idea.clips.length })];
  if (lines.some((line) => line.text.trim().length > 0)) parts.push(t("selection.partLyrics"));
  if ((idea.chordSheet?.sections.length ?? 0) > 0 || lines.some((line) => (line.chords?.length ?? 0) > 0)) {
    parts.push(t("selection.partChords"));
  }
  if (idea.notes.trim().length > 0) parts.push(t("selection.partNotes"));
  return parts.join(" · ");
}

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
  // Share… is the same two-step door as everywhere else: the row opens the
  // exits first (founder, 2026-10-13: how, then what). Share audio is always
  // the primary takes and Export always the whole sketch, so only SongNook
  // Send — which can carry either — asks, last, saying what the sketch holds.
  //   exits → (SongNook Send, with a sketch) sendScope
  const [shareSheet, setShareSheet] = useState<null | "exits" | "sendScope">(null);
  const [tagsVisible, setTagsVisible] = useState(false);
  const [playlistVisible, setPlaylistVisible] = useState(false);
  const globalCustomTags = useStore((s) => s.globalCustomClipTags);
  const navigation = useNavigation<any>();

  const selectedListIdeaIds = useStore((s) => s.selectedListIdeaIds);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const replaceListSelection = useStore((s) => s.replaceListSelection);
  // A running session turns the dock's primary action from "Play" into
  // "Add to queue" — the way to grow the queue you already have going.
  const sessionActive = useStore((s) => s.playerQueue.length > 0);
  const disabledIdeaIdSet = useMemo(() => new Set(disabledIdeaIds), [disabledIdeaIds]);

  // One workspace, not the library: `find` returns the same object while the
  // workspace is untouched, so writes elsewhere don't re-render the bar.
  const activeWorkspace = useStore((s) => s.workspaces.find((workspace) => workspace.id === activeWorkspaceId));
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
  const selectedSketchCount = interactiveSelectedIdeas.filter((idea) => idea.kind === "project").length;

  /** Loose audio by SongNook Send: each card's lead take, reorderable in the sheet. */
  function handleSendAudio() {
    if (shareableClips.length === 0) return;
    // Keyed by position: two takes may share a title, and a key must never drop one.
    const clips = shareableClips.map((clip, index) => ({ key: String(index), clip }));
    const label = clips.length === 1 ? clips[0].clip.title : selectionLabel;
    openSendSheet({
      title: label,
      kind: "clips",
      emptyMessage: t("songDetail.selectAudioFirst"),
      items: clips.map(({ key, clip }) => ({ key, title: clip.title })),
      create: (parcel) =>
        createClipsShareLink(
          orderByKeys(clips, parcel.order, (entry) => entry.key).map((entry) => entry.clip),
          label,
          parcel
        ),
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
      // Haptics: `error` — a failure must be felt.
      haptic.error();
      AppAlert.info(t("selection.shareFailed"), t("selection.shareFailedBody"));
    }
  }
  function handleSendWhole() {
    const ideas = interactiveSelectedIdeas;
    openSendSheet({
      title: wholeTitle,
      kind: ideasShareKind(ideas),
      emptyMessage: t("selection.nothingWholeBody"),
      create: (parcel) => createIdeasShareLink(ideas, wholeTitle, parcel),
    });
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
    label: isSharing ? t("selection.sharing") : t("selection.shareCount", { count: shareableClips.length }),
    icon: "share-social-outline",
    onPress: () => {
      void handleShareSelected();
    },
    disabled: isSharing || shareableClips.length === 0,
  };
  const sendRow = (onPress: () => void): SelectionAction[] =>
    linkAvailable
      ? [{ key: "songnook-send", label: t("collection.getLink"), icon: "paper-plane-outline", onPress }]
      : [];
  // Exits in one fixed order wherever they appear: Share, Export, SongNook Send.
  // With a sketch among the cards each exit says what it carries, because the
  // three carry different things.
  const hasSketch = selectedSketchCount > 0;
  const shareExitActions: SelectionAction[] = hasSketch
    ? [
        { ...shareAudioAction, hint: t("selection.shareAudioHint", { count: selectedSketchCount }) },
        {
          key: "export",
          label: t("selection.exportRow"),
          icon: "folder-open-outline",
          hint: t("selection.exportWholeHint", { count: selectedSketchCount }),
          onPress: () => void handleExportWhole(),
        },
        ...(linkAvailable
          ? [
              {
                key: "songnook-send-scope",
                label: t("collection.getLink"),
                icon: "paper-plane-outline" as const,
                hint: t("selection.sendScopeHint"),
                opens: true,
                onPress: () => setShareSheet("sendScope"),
              },
            ]
          : []),
      ]
    : [shareAudioAction, ...sendRow(handleSendAudio)];

  // The last step, SongNook Send only: the whole sketch, or just its audio.
  const loneIdea = interactiveSelectedIdeas.length === 1 ? interactiveSelectedIdeas[0] : null;
  const sendScopeTitle = loneIdea
    ? t("selection.sendScopeTitleOne", { title: loneIdea.title })
    : t("selection.sendScopeTitleMany", { count: interactiveSelectedIdeas.length });
  const sendScopeSubtitle =
    loneIdea && loneIdea.kind === "project"
      ? describeSketchContents(loneIdea, t)
      : t("selection.sendScopeIncludes", { count: selectedSketchCount });
  const sendScopeActions: SelectionAction[] = [
    {
      key: "send-whole",
      label: t("selection.sendWhole", { count: selectedSketchCount }),
      icon: getHierarchyIconName("song"),
      hint: t("selection.sendWholeHint"),
      onPress: handleSendWhole,
    },
    {
      key: "send-primary",
      label: t("selection.sendPrimary", { count: selectedSketchCount }),
      icon: "musical-note-outline",
      hint: t("selection.sendPrimaryHint"),
      onPress: handleSendAudio,
      disabled: shareableClips.length === 0,
    },
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
      // Keep these for listening: into a playlist, existing or new.
      actions.push({
        key: "playlist",
        label: t("selection.addToPlaylist"),
        icon: "musical-notes-outline",
        onPress: () => {
          setMoreVisible(false);
          setPlaylistVisible(true);
        },
        opens: true,
        disabled: interactiveSelectedIdeas.length === 0,
      });
      actions.push({
        key: "copy-or-move",
        label: t("selection.copyOrMove"),
        icon: "copy-outline",
        onPress: () => setCopyMoveVisible(true),
        opens: true,
      });
    }

    // Order rule: sending out comes last. One Share row that opens the chooser, as on every other door. With no
    // link service and no sketch there is nothing to choose between, so the
    // row shares the audio directly instead of opening a one-row sheet.
    if (!selectedHiddenOnly && (shareableClips.length > 0 || selectedSketchCount > 0)) {
      if (linkAvailable || selectedSketchCount > 0) {
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
        onBack={() => setMoreVisible(true)}
        title={t("selection.copyOrMoveTitle")}
        actions={copyMoveActions.map(endsSelection)}
        onClose={() => setCopyMoveVisible(false)}
      />

      {/* Share…: the exits → (SongNook Send with a sketch) whole or audio.
          Each level's back key returns one step, so drilling in is never one-way. */}
      <SelectionActionSheet
        visible={shareSheet === "exits"}
        onBack={() => setMoreVisible(true)}
        title={t("selection.shareSheetTitle")}
        actions={shareExitActions.map(endsSelection)}
        onClose={() => setShareSheet(null)}
      />
      <SelectionActionSheet
        visible={shareSheet === "sendScope"}
        onBack={() => setShareSheet("exits")}
        title={sendScopeTitle}
        subtitle={sendScopeSubtitle}
        actions={sendScopeActions.map(endsSelection)}
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
