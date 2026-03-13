import React, { useEffect, useMemo, useRef, useState } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { RootStackParamList } from "../../../App";
import { Alert, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { styles } from "../../styles";
import { useStore } from "../../state/useStore";
import { appActions } from "../../state/actions";
import { IdeaStatus, type ClipVersion } from "../../types";
import type { SongTimelineSortDirection, SongTimelineSortMetric } from "../../clipGraph";

import { IdeaHeader } from "./IdeaHeader";
import { SelectionBars } from "./SelectionBars";
import { ClipList } from "./ClipList";
import { ClipboardBanner } from "../ClipboardBanner";
import { QuickNameModal } from "../modals/QuickNameModal";
import { FloatingActionDock } from "../common/FloatingActionDock";
import { Button } from "../common/Button";
import { IdeaStatusProgress } from "./IdeaStatusProgress";
import { IdeaNotes } from "./IdeaNotes";
import { LyricsVersionsPanel } from "../LyricsScreen/LyricsVersionsPanel";
import { buildImportedTitle, importAudioAsset, pickSingleAudioFile, type ImportedAudioAsset } from "../../services/audioStorage";
import { buildDefaultIdeaTitle, ensureUniqueIdeaTitle } from "../../utils";
import type { SongClipTagFilter } from "./songClipControls";

type IdeaDetailRoute = RouteProp<RootStackParamList, "IdeaDetail">;

type ParentPickState = {
  sourceClipIds: string[];
  appliedClipIds: string[];
};

function buildClipMap(clips: ClipVersion[]) {
  return new Map(clips.map((clip) => [clip.id, clip]));
}

function getTopLevelClipIds(clips: ClipVersion[], clipIds: string[]) {
  const clipMap = buildClipMap(clips);
  const selectedIdSet = new Set(clipIds);

  return clipIds.filter((clipId) => {
    const visitedIds = new Set<string>();
    let parentId = clipMap.get(clipId)?.parentClipId;

    while (parentId && !visitedIds.has(parentId)) {
      if (selectedIdSet.has(parentId)) {
        return false;
      }
      visitedIds.add(parentId);
      parentId = clipMap.get(parentId)?.parentClipId;
    }

    return true;
  });
}

function collectDescendantClipIds(clips: ClipVersion[], rootClipIds: string[]) {
  const childrenByParentId = new Map<string, string[]>();

  clips.forEach((clip) => {
    if (!clip.parentClipId) return;
    const currentChildren = childrenByParentId.get(clip.parentClipId) ?? [];
    currentChildren.push(clip.id);
    childrenByParentId.set(clip.parentClipId, currentChildren);
  });

  const descendants = new Set<string>();
  const stack = [...rootClipIds];

  while (stack.length > 0) {
    const nextParentId = stack.pop();
    if (!nextParentId) continue;

    (childrenByParentId.get(nextParentId) ?? []).forEach((childId) => {
      if (descendants.has(childId)) return;
      descendants.add(childId);
      stack.push(childId);
    });
  }

  return descendants;
}

export function IdeaDetailScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<IdeaDetailRoute>();
  const routeIdeaId = route.params?.ideaId;
  const startInEdit = !!route.params?.startInEdit;
  const selectedIdeaId = useStore((s) => s.selectedIdeaId);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const setSelectedIdeaId = useStore((s) => s.setSelectedIdeaId);

  const selectedIdea = useStore((s) => {
    const ws = s.workspaces.find((w) => w.id === activeWorkspaceId);
    return ws?.ideas.find((i) => i.id === selectedIdeaId);
  });

  const clipClipboard = useStore((s) => s.clipClipboard);
  const cancelClipboard = useStore((s) => s.cancelClipboard);
  const workspaces = useStore((s) => s.workspaces);
  const clipSelectionMode = useStore((s) => s.clipSelectionMode);
  const setRecordingIdeaId = useStore((s) => s.setRecordingIdeaId);
  const setRecordingParentClipId = useStore((s) => s.setRecordingParentClipId);

  const navigation = useNavigation();
  const floatingBaseBottom = 12 + Math.max(insets.bottom, 16);
  const bottomToolbarAllowance = Platform.OS === "android" ? 18 : 0;
  const clipListFooterSpacerHeight = Math.max(220, floatingBaseBottom + 174 + bottomToolbarAllowance);

  const [isEditMode, setIsEditMode] = useState(false);
  const [clipViewMode, setClipViewMode] = useState<"timeline" | "evolution">("evolution");
  const [timelineSortMetric, setTimelineSortMetric] = useState<SongTimelineSortMetric>("created");
  const [timelineSortDirection, setTimelineSortDirection] = useState<SongTimelineSortDirection>("desc");
  const [timelineMainTakesOnly, setTimelineMainTakesOnly] = useState(false);
  const [clipTagFilter, setClipTagFilter] = useState<SongClipTagFilter>("all");
  const [songTab, setSongTab] = useState<"takes" | "lyrics" | "notes">("takes");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftStatus, setDraftStatus] = useState<IdeaStatus>("seed");
  const [draftCompletion, setDraftCompletion] = useState(0);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importAsset, setImportAsset] = useState<ImportedAudioAsset | null>(null);
  const [importDraft, setImportDraft] = useState("");
  const [importAsPrimary, setImportAsPrimary] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isIdeasSticky, setIsIdeasSticky] = useState(false);
  const [parentPickState, setParentPickState] = useState<ParentPickState | null>(null);
  const [undoState, setUndoState] = useState<{
    id: string;
    message: string;
    undo: () => void;
  } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const songClips = selectedIdea?.kind === "project" ? selectedIdea.clips : [];
  const clipMap = useMemo(() => buildClipMap(songClips), [songClips]);
  const primaryClipId = useMemo(
    () => songClips.find((clip) => clip.isPrimary)?.id ?? null,
    [songClips]
  );
  const parentPickInvalidTargetIds = useMemo(() => {
    if (!parentPickState) return [];

    const invalidTargetIds = new Set(parentPickState.sourceClipIds);
    const descendantIds = collectDescendantClipIds(songClips, parentPickState.appliedClipIds);
    descendantIds.forEach((clipId) => invalidTargetIds.add(clipId));

    if (primaryClipId) {
      invalidTargetIds.add(primaryClipId);
    }

    return Array.from(invalidTargetIds);
  }, [parentPickState, primaryClipId, songClips]);
  const parentPickPrompt =
    parentPickState?.appliedClipIds.length === 1
      ? "Tap the clip this branches from."
      : parentPickState
        ? `Tap the clip these ${parentPickState.appliedClipIds.length} clips branch from.`
        : "";
  const parentPickMeta =
    parentPickState &&
    parentPickState.sourceClipIds.length !== parentPickState.appliedClipIds.length
      ? `${parentPickState.sourceClipIds.length} selected, ${parentPickState.appliedClipIds.length} top-level clips will move together.`
      : null;

  useEffect(() => {
    if (routeIdeaId && routeIdeaId !== selectedIdeaId) {
      setSelectedIdeaId(routeIdeaId);
    }
  }, [routeIdeaId, selectedIdeaId, setSelectedIdeaId]);

  useEffect(() => {
    if (selectedIdea?.isDraft || startInEdit) {
      setIsEditMode(true);
    } else {
      setIsEditMode(false);
    }
  }, [selectedIdea?.id, startInEdit]);

  // When we enter edit mode, take a local snapshot of the current idea
  useEffect(() => {
    if (isEditMode && selectedIdea) {
      setDraftTitle(selectedIdea.title);
      setDraftStatus(selectedIdea.status);
      setDraftCompletion(selectedIdea.completionPct);
    }
  }, [isEditMode, selectedIdea?.id]);

  useEffect(() => {
    setSongTab("takes");
    setClipTagFilter("all");
    setTimelineSortMetric("created");
    setTimelineSortDirection("desc");
    setTimelineMainTakesOnly(false);
    setParentPickState(null);
  }, [selectedIdea?.id]);

  useEffect(() => {
    if (isEditMode || clipSelectionMode) {
      setSongTab("takes");
    }
  }, [clipSelectionMode, isEditMode]);

  useEffect(() => {
    if (songTab !== "takes") {
      setIsIdeasSticky(false);
    }
  }, [songTab]);

  useEffect(() => {
    if (isEditMode || songTab !== "takes") {
      setParentPickState(null);
    }
  }, [isEditMode, songTab]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  const hasChanges = () => {
    if (!selectedIdea) return false;
    return (
      draftTitle.trim() !== selectedIdea.title ||
      draftStatus !== selectedIdea.status ||
      draftCompletion !== selectedIdea.completionPct
    );
  };

  const handleSave = () => {
    if (!selectedIdeaId || !selectedIdea) return;
    const state = useStore.getState();
    const activeWs = state.workspaces.find((workspace) => workspace.id === activeWorkspaceId);
    const fallbackTitle = ensureUniqueIdeaTitle(
      buildDefaultIdeaTitle(),
      activeWs?.ideas.filter((idea) => idea.id !== selectedIdeaId).map((idea) => idea.title) ?? []
    );
    const finalTitle = draftTitle.trim() || fallbackTitle;
    const titleChanged = finalTitle !== selectedIdea.title;
    const statusChanged = draftStatus !== selectedIdea.status;
    const completionChanged = draftCompletion !== selectedIdea.completionPct;
    const meaningfulSongChange = statusChanged || completionChanged;

    if (titleChanged && !meaningfulSongChange && !selectedIdea.isDraft) {
      state.renameIdeaPreservingActivity(selectedIdeaId, finalTitle);
    } else {
      state.updateIdeas((prev) =>
        prev.map((i) => i.id === selectedIdeaId ? {
          ...i,
          title: finalTitle,
          status: draftStatus,
          completionPct: draftCompletion,
          isDraft: false,
        } : i)
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
  };

  const handleCancel = (onDiscardAction?: () => void) => {
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
          }
        },
      ]
    );
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (!isEditMode && !selectedIdea?.isDraft) return;
      e.preventDefault();
      handleCancel(() => navigation.dispatch(e.data.action));
    });
    return unsubscribe;
  }, [navigation, isEditMode, selectedIdea?.isDraft, draftTitle, draftStatus, draftCompletion]);

  if (!selectedIdea) return null;

  const projectStatusStyle =
    selectedIdea.status === "song"
      ? [styles.badge, styles.statusSong, styles.statusSongText]
      : selectedIdea.status === "semi"
        ? [styles.badge, styles.statusSemi, styles.statusSemiText]
        : selectedIdea.status === "sprout"
          ? [styles.badge, styles.statusSprout, styles.statusSproutText]
          : [styles.badge, styles.statusSeed, styles.statusSeedText];

  const songProgressStrip =
    selectedIdea.kind === "project" ? (
      <View style={styles.songDetailProgressStrip}>
        <Text style={styles.songDetailProgressStripLabel}>Progress:</Text>
        <Text style={styles.songDetailProgressStripPercent}>
          {selectedIdea.completionPct}%
        </Text>
        <Text style={projectStatusStyle}>
          {selectedIdea.status === "song" ? "SONG" : selectedIdea.status.toUpperCase()}
        </Text>
      </View>
    ) : null;

  const songTabs =
    selectedIdea.kind === "project" && !isEditMode ? (
      <View style={styles.songDetailSongTabs}>
        {([
          { key: "takes", label: "Takes" },
          { key: "lyrics", label: "Lyrics" },
          { key: "notes", label: "Notes" },
        ] as const).map((tab) => {
          const active = songTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[
                styles.songDetailSongTab,
                active ? styles.songDetailSongTabActive : null,
              ]}
              onPress={() => setSongTab(tab.key)}
            >
              <Text
                style={[
                  styles.songDetailSongTabText,
                  active ? styles.songDetailSongTabTextActive : null,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    ) : null;

  const takesSummaryContent =
    selectedIdea.kind === "project" ? (
      isEditMode ? (
        <View style={styles.songDetailTopStack}>
          <IdeaStatusProgress
            isEditMode={isEditMode}
            draftStatus={draftStatus}
            setDraftStatus={setDraftStatus}
            draftCompletion={draftCompletion}
            setDraftCompletion={setDraftCompletion}
            kind={selectedIdea.kind}
            status={selectedIdea.status}
            completionPct={selectedIdea.completionPct}
          />
        </View>
      ) : (
        songProgressStrip
      )
    ) : (
      <View style={styles.songDetailTopStack}>
        <IdeaNotes isEditMode={isEditMode} notes={selectedIdea.notes} />
      </View>
    );

  const nonTakesTabContent =
    selectedIdea.kind === "project" && !isEditMode && songTab !== "takes" ? (
      <ScrollView
        style={styles.songDetailTabScroll}
        contentContainerStyle={[
          styles.songDetailTabScrollContent,
          { paddingBottom: clipListFooterSpacerHeight },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {songTab === "lyrics" ? (
          <LyricsVersionsPanel projectIdea={selectedIdea} />
        ) : (
          <View style={styles.songDetailTabPanelWrap}>
            <IdeaNotes
              isEditMode={false}
              notes={selectedIdea.notes}
              previewLines={12}
              cardStyle={styles.songDetailTabPanelCard}
            />
          </View>
        )}
      </ScrollView>
    ) : null;

  const duplicateWarningText = (() => {
    if (!clipClipboard || clipClipboard.sourceIdeaId !== selectedIdea.id) return "";
    let itemNames: string[] = [];
    const sourceWs = workspaces.find(w => w.id === clipClipboard.sourceWorkspaceId);
    if (!sourceWs) return "";

    if (clipClipboard.from === "list") {
      itemNames = sourceWs.ideas
        .filter(i => clipClipboard.clipIds.includes(i.id))
        .map(i => i.title);
    } else if (clipClipboard.from === "project" && clipClipboard.sourceIdeaId) {
      const sourceIdea = sourceWs.ideas.find((i) => i.id === clipClipboard.sourceIdeaId);
      itemNames = sourceIdea?.clips.filter((c) => clipClipboard.clipIds.includes(c.id)).map((c) => c.title) ?? [];
    }

    const displayNames = itemNames.slice(0, 5).map(n => `"${n}"`).join(", ");
    const remainder = itemNames.length > 5 ? ` and ${itemNames.length - 5} other${itemNames.length - 5 > 1 ? "s" : ""}` : "";
    return `You are copying ${itemNames.length} clip${itemNames.length !== 1 ? "s" : ""} (${displayNames}${remainder}) into the same song they already belong to. This will create duplicates. Continue?`;
  })();

  function showUndo(message: string, undo: () => void) {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setUndoState({ id, message, undo });
    undoTimerRef.current = setTimeout(() => {
      setUndoState((prev) => (prev?.id === id ? null : prev));
      undoTimerRef.current = null;
    }, 5000);
  }

  function updateClipParents(targetIdeaId: string, parentByClipId: Map<string, string | null>) {
    useStore.getState().updateIdeas((ideas) =>
      ideas.map((idea) => {
        if (idea.id !== targetIdeaId) return idea;

        return {
          ...idea,
          clips: idea.clips.map((clip) =>
            parentByClipId.has(clip.id)
              ? {
                  ...clip,
                  parentClipId: parentByClipId.get(clip.id) ?? undefined,
                }
              : clip
          ),
        };
      })
    );
  }

  function resolveParentEditingSource(rawClipIds: string[]) {
    if (!selectedIdea || selectedIdea.kind !== "project") return null;

    const uniqueClipIds = Array.from(new Set(rawClipIds)).filter((clipId) => clipMap.has(clipId));
    if (uniqueClipIds.length === 0) return null;

    if (primaryClipId && uniqueClipIds.includes(primaryClipId)) {
      Alert.alert(
        "Primary clip unavailable",
        "The primary clip stays outside the evolution tree for now. Deselect it and try again."
      );
      return null;
    }

    const topLevelClipIds = getTopLevelClipIds(songClips, uniqueClipIds);
    if (topLevelClipIds.length === 0) return null;

    return {
      sourceClipIds: uniqueClipIds,
      appliedClipIds: topLevelClipIds,
    };
  }

  function applyParentChange(
    sourceClipIds: string[],
    nextParentClipId: string | null,
    undoMessage: string
  ) {
    if (!selectedIdea || selectedIdea.kind !== "project") return false;

    const previousParentByClipId = new Map<string, string | null>();
    sourceClipIds.forEach((clipId) => {
      previousParentByClipId.set(clipId, clipMap.get(clipId)?.parentClipId ?? null);
    });

    const changedClipIds = sourceClipIds.filter(
      (clipId) => (clipMap.get(clipId)?.parentClipId ?? null) !== nextParentClipId
    );
    if (changedClipIds.length === 0) {
      return false;
    }

    const nextParentByClipId = new Map<string, string | null>();
    changedClipIds.forEach((clipId) => {
      nextParentByClipId.set(clipId, nextParentClipId);
    });

    updateClipParents(selectedIdea.id, nextParentByClipId);
    showUndo(undoMessage, () => {
      const restoredParentByClipId = new Map<string, string | null>();
      changedClipIds.forEach((clipId) => {
        restoredParentByClipId.set(clipId, previousParentByClipId.get(clipId) ?? null);
      });
      updateClipParents(selectedIdea.id, restoredParentByClipId);
    });

    return true;
  }

  function handleStartSetParent(rawClipIds: string[]) {
    const source = resolveParentEditingSource(rawClipIds);
    if (!source) return;

    const invalidTargetIds = new Set(source.sourceClipIds);
    const descendantIds = collectDescendantClipIds(songClips, source.appliedClipIds);
    descendantIds.forEach((clipId) => invalidTargetIds.add(clipId));
    if (primaryClipId) {
      invalidTargetIds.add(primaryClipId);
    }

    const hasValidTarget = songClips.some((clip) => !invalidTargetIds.has(clip.id));
    if (!hasValidTarget) {
      Alert.alert(
        "No valid parent clips",
        "There is no other clip in this song that can be used as a parent yet."
      );
      return;
    }

    setSongTab("takes");
    setClipTagFilter("all");
    setClipViewMode("evolution");
    setParentPickState(source);
  }

  function handleMakeRoot(rawClipIds: string[]) {
    const source = resolveParentEditingSource(rawClipIds);
    if (!source) return;

    const changed = applyParentChange(
      source.appliedClipIds,
      null,
      source.appliedClipIds.length === 1 ? "Clip moved to root" : "Clips moved to root"
    );

    if (!changed) {
      Alert.alert("Already root", "Those clips are already at the top level.");
      return;
    }

    setParentPickState(null);
  }

  function handlePickParentTarget(targetClipId: string) {
    if (!selectedIdea || selectedIdea.kind !== "project" || !parentPickState) return;

    const targetClip = clipMap.get(targetClipId);
    if (!targetClip) return;

    const hasActualChange = parentPickState.appliedClipIds.some(
      (clipId) => (clipMap.get(clipId)?.parentClipId ?? null) !== targetClipId
    );

    if (!hasActualChange) {
      setParentPickState(null);
      Alert.alert("Already attached", "Those clips already branch from that parent.");
      return;
    }

    const confirmationMessage =
      parentPickState.appliedClipIds.length === 1
        ? `Make "${clipMap.get(parentPickState.appliedClipIds[0])?.title ?? "this clip"}" a variation of "${targetClip.title}"?`
        : `Make ${parentPickState.appliedClipIds.length} clips variations of "${targetClip.title}"?`;

    Alert.alert("Set parent clip?", confirmationMessage, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: () => {
          applyParentChange(
            parentPickState.appliedClipIds,
            targetClipId,
            parentPickState.appliedClipIds.length === 1 ? "Parent updated" : "Parents updated"
          );
          setParentPickState(null);
        },
      },
    ]);
  }

  const songUndoBottom =
    selectedIdea?.kind === "project" &&
    !isEditMode &&
    !clipSelectionMode &&
    !parentPickState &&
    songTab === "takes"
      ? floatingBaseBottom + 72
      : floatingBaseBottom;

  function resetImportModal() {
    if (isImporting) return;
    setImportModalOpen(false);
    setImportAsset(null);
    setImportDraft("");
    setImportAsPrimary(false);
  }

  async function openImportAudioFlow() {
    if (!selectedIdea || selectedIdea.kind !== "project") return;
    const asset = await pickSingleAudioFile();
    if (!asset) return;

    setImportAsset(asset);
    setImportDraft("");
    setImportAsPrimary(false);
    setImportModalOpen(true);
  }

  async function saveImportedAudio() {
    if (!selectedIdea || selectedIdea.kind !== "project" || !importAsset || isImporting) return;

    try {
      setIsImporting(true);
      const importedAudio = await importAudioAsset(
        importAsset,
        `audio-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      );
      const finalTitle = importDraft.trim() || buildImportedTitle(importAsset.name);

      appActions.importClipToProject(selectedIdea.id, {
        title: finalTitle,
        audioUri: importedAudio.audioUri,
        durationMs: importedAudio.durationMs,
        waveformPeaks: importedAudio.waveformPeaks,
        isPrimary: importAsPrimary,
      });

      setImportModalOpen(false);
      setImportAsset(null);
      setImportDraft("");
      setImportAsPrimary(false);
    } catch (error) {
      console.warn("Song import audio error", error);
      Alert.alert("Import failed", "Could not import that audio file into this song.");
    } finally {
      setIsImporting(false);
    }
  }

  function buildProjectQueue(clipIds?: string[]) {
    if (!selectedIdea || selectedIdea.kind !== "project") return [];
    return selectedIdea.clips
      .filter((clip) => (!!clip.audioUri) && (!clipIds || clipIds.includes(clip.id)))
      .map((clip) => ({
        ideaId: selectedIdea.id,
        clipId: clip.id,
      }));
  }

  function playProjectQueue(clipIds?: string[]) {
    const queue = buildProjectQueue(clipIds);
    if (queue.length === 0) {
      Alert.alert("Nothing to play", "This song does not have any playable clips yet.");
      return;
    }
    useStore.getState().setPlayerQueue(queue, 0, true);
    navigation.navigate("Player" as never);
  }

  return (
    <SafeAreaView style={[styles.screen, selectedIdea.kind === "project" ? styles.screenProjectDetail : styles.screenClipDetail]}>
      <IdeaHeader
        isEditMode={isEditMode}
        setIsEditMode={setIsEditMode}
        draftTitle={draftTitle}
        setDraftTitle={setDraftTitle}
        compactTitleMode={songTab === "takes" && isIdeasSticky}
        onSave={handleSave}
        onCancel={handleCancel}
        onPlayAll={() => {
          playProjectQueue();
        }}
        playAllDisabled={selectedIdea.kind !== "project" || buildProjectQueue().length === 0}
        onImportAudio={() => {
          void openImportAudioFlow();
        }}
      />

      {clipClipboard && !isEditMode && selectedIdea.kind === "project" ? (
        <ClipboardBanner
          count={clipClipboard.clipIds.length}
          mode={clipClipboard.mode}
          actionLabel="Paste clips here"
          onAction={() => {
            const includesProjectsFromList =
              clipClipboard.from === "list" && (clipClipboard.itemType === "project" || clipClipboard.itemType === "mixed");

            if (clipClipboard.sourceIdeaId === selectedIdea.id) {
              if (clipClipboard.mode === "move") {
                Alert.alert("Cannot move here", "You cannot move clips into the same song they are already in. To duplicate them, cancel and use Copy instead.");
                return;
              } else {
                Alert.alert(
                  "Duplicate clips?",
                  duplicateWarningText,
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Duplicate", onPress: () => appActions.pasteClipboardToProject(selectedIdea.id) }
                  ]
                );
                return;
              }
            }
            if (includesProjectsFromList) {
              Alert.alert(
                `${clipClipboard.mode === "move" ? "Move primary clips here?" : "Copy primary clips here?"}`,
                `Songs can't be placed inside another song. For now, SongSeed will ${clipClipboard.mode} only the primary clip from each selected song into this song.`,
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Continue", style: "default", onPress: () => appActions.pasteClipboardToProject(selectedIdea.id) }
                ]
              );
              return;
            }
            Alert.alert(
              `${clipClipboard.mode === "move" ? "Move" : "Copy"} clips here?`,
              `Are you sure you want to ${clipClipboard.mode} these clips into this song?`,
              [
                { text: "Cancel", style: "cancel" },
                { text: "Yes", style: "default", onPress: () => appActions.pasteClipboardToProject(selectedIdea.id) }
              ]
            );
          }}
          onCancel={cancelClipboard}
        />
      ) : null}

      {parentPickState ? (
        <View style={styles.selectionBar}>
          <View style={styles.songDetailParentPickCopy}>
            <Text style={styles.selectionText}>Choose parent clip</Text>
            <Text style={styles.songDetailParentPickHelper}>{parentPickPrompt}</Text>
            {parentPickMeta ? (
              <Text style={styles.songDetailParentPickMeta}>{parentPickMeta}</Text>
            ) : null}
          </View>
          <View style={styles.rowButtons}>
            <Button
              variant="secondary"
              label="Cancel"
              onPress={() => setParentPickState(null)}
            />
          </View>
        </View>
      ) : (
        <SelectionBars
          onStartSetParent={handleStartSetParent}
          onMakeRoot={handleMakeRoot}
        />
      )}
      {songTabs}
      {nonTakesTabContent ? (
        nonTakesTabContent
      ) : (
        <ClipList
          isEditMode={isEditMode}
          viewMode={clipViewMode}
          setViewMode={setClipViewMode}
          timelineSortMetric={timelineSortMetric}
          setTimelineSortMetric={setTimelineSortMetric}
          timelineSortDirection={timelineSortDirection}
          setTimelineSortDirection={setTimelineSortDirection}
          timelineMainTakesOnly={timelineMainTakesOnly}
          setTimelineMainTakesOnly={setTimelineMainTakesOnly}
          clipTagFilter={clipTagFilter}
          setClipTagFilter={setClipTagFilter}
          summaryContent={takesSummaryContent}
          onIdeasStickyChange={setIsIdeasSticky}
          isParentPicking={!!parentPickState}
          parentPickSourceClipIds={parentPickState?.sourceClipIds ?? []}
          parentPickInvalidTargetIds={parentPickInvalidTargetIds}
          onStartSetParent={handleStartSetParent}
          onMakeRoot={handleMakeRoot}
          onPickParentTarget={handlePickParentTarget}
          footerSpacerHeight={
            selectedIdea.kind === "project" && !isEditMode && !clipSelectionMode && !parentPickState
              ? clipListFooterSpacerHeight
              : 28
          }
        />
      )}
      {selectedIdea.kind === "project" &&
      !isEditMode &&
      !clipSelectionMode &&
      !parentPickState &&
      songTab === "takes" ? (
        <FloatingActionDock
          onRecord={() => {
            setRecordingParentClipId(null);
            setRecordingIdeaId(selectedIdea.id);
            navigation.navigate("Recording" as never);
          }}
          menuItems={[
            {
              key: "import",
              label: "Import",
              icon: "download-outline",
              onPress: () => {
                void openImportAudioFlow();
              },
            },
          ]}
        />
      ) : null}
      {undoState ? (
        <View style={[styles.ideasUndoWrap, { bottom: songUndoBottom }]}>
          <View style={styles.ideasUndoCard}>
            <Text style={styles.ideasUndoText} numberOfLines={1}>
              {undoState.message}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.ideasUndoBtn, pressed ? styles.pressDown : null]}
              onPress={() => {
                if (undoTimerRef.current) {
                  clearTimeout(undoTimerRef.current);
                  undoTimerRef.current = null;
                }
                undoState.undo();
                setUndoState(null);
              }}
            >
              <Text style={styles.ideasUndoBtnText}>Undo</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <QuickNameModal
        visible={importModalOpen}
        title="Import audio into song"
        draftValue={importDraft}
        placeholderValue={importAsset ? buildImportedTitle(importAsset.name) : ""}
        onChangeDraft={setImportDraft}
        isPrimary={importAsPrimary}
        onChangeIsPrimary={setImportAsPrimary}
        onCancel={resetImportModal}
        onSave={() => {
          void saveImportedAudio();
        }}
        helperText={`Destination: ${selectedIdea.title} as a new clip version.\nFile: ${importAsset?.name ?? "Selected audio"}`}
        saveLabel={isImporting ? "Importing..." : "Import"}
        saveDisabled={isImporting}
        cancelDisabled={isImporting}
      />
      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}
