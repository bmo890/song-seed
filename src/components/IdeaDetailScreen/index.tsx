import React, { useState, useEffect } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { RootStackParamList } from "../../../App";
import { Alert, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { styles } from "../../styles";
import { useStore } from "../../state/useStore";
import { appActions } from "../../state/actions";
import { IdeaStatus } from "../../types";
import type { SongTimelineSortDirection, SongTimelineSortMetric } from "../../clipGraph";

import { IdeaHeader } from "./IdeaHeader";
import { SelectionBars } from "./SelectionBars";
import { ClipList } from "./ClipList";
import { ClipboardBanner } from "../ClipboardBanner";
import { QuickNameModal } from "../modals/QuickNameModal";
import { FloatingActionDock } from "../common/FloatingActionDock";
import { IdeaStatusProgress } from "./IdeaStatusProgress";
import { IdeaNotes } from "./IdeaNotes";
import { LyricsVersionsPanel } from "../LyricsScreen/LyricsVersionsPanel";
import { buildImportedTitle, importAudioAsset, pickSingleAudioFile, type ImportedAudioAsset } from "../../services/audioStorage";
import { buildDefaultIdeaTitle, ensureUniqueIdeaTitle } from "../../utils";
import type { SongClipTagFilter } from "./songClipControls";

type IdeaDetailRoute = RouteProp<RootStackParamList, "IdeaDetail">;

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
  const [timelineSortDirection, setTimelineSortDirection] = useState<SongTimelineSortDirection>("asc");
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
    setTimelineSortDirection("asc");
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
      <View style={styles.songDetailTopStack}>
        {isEditMode ? (
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
        ) : (
          <>
            {songProgressStrip}
            {songTabs}
          </>
        )}
      </View>
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
        <View style={styles.songDetailTopStack}>
          {songProgressStrip}
          {songTabs}
        </View>
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

      <SelectionBars />
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
          clipTagFilter={clipTagFilter}
          setClipTagFilter={setClipTagFilter}
          summaryContent={takesSummaryContent}
          onIdeasStickyChange={setIsIdeasSticky}
          footerSpacerHeight={
            selectedIdea.kind === "project" && !isEditMode && !clipSelectionMode
              ? clipListFooterSpacerHeight
              : 28
          }
        />
      )}
      {selectedIdea.kind === "project" && !isEditMode && !clipSelectionMode && songTab === "takes" ? (
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
