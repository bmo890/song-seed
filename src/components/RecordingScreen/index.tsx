import React, { useEffect, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { styles } from "../../styles";
import { useStore } from "../../state/useStore";
import { ScreenHeader } from "../common/ScreenHeader";
import { QuickNameModal } from "../modals/QuickNameModal";
import { RecordingMeta } from "./RecordingMeta";
import { RecordingControls } from "./RecordingControls";
import { useRecording } from "../../hooks/useRecording";
import { ClipVersion } from "../../types";
import { genClipTitle } from "../../utils";
import { RecordingInputPicker } from "./RecordingInputPicker";
import { getLatestLyricsVersion, lyricsDocumentToText } from "../../lyrics";
import { PlayerLyricsPanel } from "../PlayerScreen/PlayerLyricsPanel";
import { formatDate } from "../../utils";

export function RecordingScreen() {
  const navigation = useNavigation();

  const recordingIdeaId = useStore((s) => s.recordingIdeaId);
  const recordingParentClipId = useStore((s) => s.recordingParentClipId);
  const recordingSaveRequestToken = useStore((s) => s.recordingSaveRequestToken);

  const workspaces = useStore((s) => s.workspaces);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const recordingIdea = workspaces.find((w) => w.id === activeWorkspaceId)?.ideas.find((i) => i.id === recordingIdeaId);
  const latestLyricsVersion = recordingIdea?.kind === "project" ? getLatestLyricsVersion(recordingIdea) : null;
  const latestLyricsText = lyricsDocumentToText(latestLyricsVersion?.document);
  const hasProjectLyrics = recordingIdea?.kind === "project" && latestLyricsText.trim().length > 0;

  const [isPrimaryDraft, setIsPrimaryDraft] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [lyricsExpanded, setLyricsExpanded] = useState(false);
  const [lyricsAutoscrollMode, setLyricsAutoscrollMode] = useState<"off" | "follow" | "manual">("follow");
  const [lyricsAutoscrollSpeedMultiplier, setLyricsAutoscrollSpeedMultiplier] = useState(1);

  const quickNameModalVisible = useStore((s) => s.quickNameModalVisible);
  const quickNameDraft = useStore((s) => s.quickNameDraft);
  const quickNamingIdeaId = useStore((s) => s.quickNamingIdeaId);

  const setQuickNameModalVisible = useStore((s) => s.setQuickNameModalVisible);
  const setQuickNameDraft = useStore((s) => s.setQuickNameDraft);
  const setQuickNamingIdeaId = useStore((s) => s.setQuickNamingIdeaId);
  const preferredRecordingInputId = useStore((s) => s.preferredRecordingInputId);
  const setPreferredRecordingInputId = useStore((s) => s.setPreferredRecordingInputId);
  const updateIdeas = useStore((s) => s.updateIdeas);
  const handledSaveRequestRef = useRef<number | null>(null);

  // Initialize recording natively!
  const recording = useRecording(
    (payload) => {
      if (!recordingIdeaId || !recordingIdea) return;
      const title = genClipTitle(recordingIdea.title, recordingIdea.clips.length + 1);

      const clip: ClipVersion = {
        id: `clip-${Date.now()}`,
        title,
        notes: "",
        createdAt: Date.now(),
        isPrimary: recordingIdea.kind === "project" ? isPrimaryDraft : true,
        parentClipId: recordingParentClipId ?? undefined,
        audioUri: payload.audioUri,
        durationMs: payload.durationMs,
        waveformPeaks: payload.waveformPeaks,
      };

      updateIdeas((p) =>
        p.map((i) => {
          if (i.id !== recordingIdeaId) return i;

          const nextClips = i.clips.map((c) => (isPrimaryDraft ? { ...c, isPrimary: false } : c));

          return { ...i, clips: [clip, ...nextClips] };
        })
      );
    },
    preferredRecordingInputId
  );

  const fallbackClipTitle = () =>
    `New Clip — ${new Date().toLocaleString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })}`;

  const recordingPlaceholderTitle =
    recordingIdea
      ? recordingIdea.kind === "project"
        ? genClipTitle(recordingIdea.title, recordingIdea.clips.length + 1)
        : recordingIdea.title || fallbackClipTitle()
      : fallbackClipTitle();

  async function cancelRecording() {
    if (!recordingIdea) return;
    await recording.discardRecording();
    if (recordingIdea.kind === "clip" && recordingIdea.clips.length === 0) {
      updateIdeas((prev) => prev.filter((i) => i.id !== recordingIdea.id));
    }
    useStore.getState().setRecordingParentClipId(null);
    useStore.getState().setRecordingIdeaId(null);
  }

  function confirmDiscardAndExit() {
    const hasRecordingToDiscard = recording.isRecording || recording.isPaused || recording.elapsedMs > 0;
    if (!hasRecordingToDiscard) {
      navigation.goBack();
      return;
    }

    Alert.alert(
      "Discard recording?",
      "This recording has not been saved yet. If you leave now, it will be deleted.",
      [
        { text: "Keep recording", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            cancelRecording().then(() => navigation.goBack());
          },
        },
      ]
    );
  }

  async function requestSaveRecording() {
    if (!recordingIdea) return;
    if (!recording.isRecording && !recording.isPaused) return;
    if (recording.isRecording && !recording.isPaused) {
      await recording.pauseRecording();
    }

    setQuickNamingIdeaId(recordingIdea.id);
    setQuickNameDraft("");
    setIsPrimaryDraft(false);
    setQuickNameModalVisible(true);
  }

  async function saveQuickClipName() {
    if (!quickNamingIdeaId) return;
    const targetIdea = recordingIdea;
    const isStandaloneClipRecording = targetIdea?.kind === "clip";

    const saved = await recording.saveRecording();
    if (!saved) return;

    const suggestedTitle =
      recordingIdea?.kind === "project"
        ? genClipTitle(recordingIdea.title, recordingIdea.clips.length + 1)
        : recordingIdea?.title || fallbackClipTitle();
    const nextTitle = quickNameDraft.trim() || suggestedTitle;

    updateIdeas((prev) =>
      prev.map((idea) => {
        if (idea.id !== quickNamingIdeaId) return idea;
        const firstClipId = idea.clips[0]?.id;
        if (!firstClipId) return idea;

        if (idea.kind === "clip") {
          return {
            ...idea,
            title: nextTitle,
            clips: idea.clips.map((clip) => (clip.id === firstClipId ? { ...clip, title: nextTitle } : clip)),
          };
        }

        return {
          ...idea,
          clips: idea.clips.map((clip) => (clip.id === firstClipId ? { ...clip, title: nextTitle } : clip)),
        };
      })
    );

    const savedIdea = useStore.getState().workspaces
      .find((workspace) => workspace.id === activeWorkspaceId)
      ?.ideas.find((idea) => idea.id === quickNamingIdeaId);
    const savedClipId = savedIdea?.clips[0]?.id ?? null;
    if (savedIdea) {
      useStore
        .getState()
        .logIdeaActivity(
          savedIdea.id,
          isStandaloneClipRecording ? "created" : "updated",
          "recording",
          savedClipId
        );
    }

    setQuickNameModalVisible(false);
    setQuickNameDraft("");
    setQuickNamingIdeaId(null);
    useStore.getState().setRecordingParentClipId(null);
    useStore.getState().setRecordingIdeaId(null);
  }

  useEffect(() => {
    if (recordingSaveRequestToken === handledSaveRequestRef.current) return;
    handledSaveRequestRef.current = recordingSaveRequestToken;
    if (!recordingSaveRequestToken) return;
    void requestSaveRecording();
  }, [recordingSaveRequestToken]);

  function minimizeRecording() {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("Home" as never);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.recordingScreenLayout}>
        <View style={styles.transportHeaderZone}>
          <ScreenHeader
            title={recordingIdea?.title || "Recording"}
            leftIcon="back"
            onLeftPress={confirmDiscardAndExit}
            rightElement={
              <View style={styles.transportHeaderActionRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.transportHeaderActionBtn,
                    pressed ? styles.pressDown : null,
                  ]}
                  onPress={minimizeRecording}
                  accessibilityRole="button"
                  accessibilityLabel="Minimize recorder"
                >
                  <Ionicons name="remove" size={18} color="#334155" />
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.recordingSettingsBtn,
                    pressed ? styles.pressDown : null,
                  ]}
                  onPress={() => setSettingsVisible(true)}
                >
                  <Ionicons name="ellipsis-horizontal" size={16} color="#111827" />
                </Pressable>
              </View>
            }
          />
        </View>

        <ScrollView
          style={styles.recordingScroll}
          contentContainerStyle={[
            styles.recordingScrollContent,
            hasProjectLyrics && !lyricsExpanded ? styles.recordingScrollContentWithCollapsedLyrics : null,
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.recordingContentBody,
              hasProjectLyrics && !lyricsExpanded ? styles.recordingContentBodyCollapsedLyrics : null,
            ]}
          >
            <RecordingMeta
              ideaTitle=""
              isRecording={recording.isRecording}
              isPaused={recording.isPaused}
              elapsedMs={recording.elapsedMs}
              analysisData={recording.analysisData}
              compact={lyricsExpanded}
            />

            {hasProjectLyrics && latestLyricsVersion ? (
              <PlayerLyricsPanel
                text={latestLyricsText}
                versionLabel={`Version ${recordingIdea?.lyrics?.versions.length ?? 1}`}
                updatedAtLabel={formatDate(latestLyricsVersion.updatedAt)}
                autoscrollState={{
                  mode: lyricsAutoscrollMode,
                  currentTimeMs: recording.elapsedMs,
                  durationMs: recording.elapsedMs,
                  activeLineId: null,
                }}
                variant="recording"
                expanded={lyricsExpanded}
                defaultExpanded={false}
                onToggleExpanded={setLyricsExpanded}
                autoscrollEnabled={lyricsAutoscrollMode === "follow"}
                autoscrollActive={recording.isRecording && !recording.isPaused}
                autoscrollSpeedMultiplier={lyricsAutoscrollSpeedMultiplier}
                onToggleAutoscroll={(enabled) => setLyricsAutoscrollMode(enabled ? "follow" : "off")}
                onAutoscrollInterrupted={() => setLyricsAutoscrollMode("manual")}
                onSelectAutoscrollSpeedMultiplier={setLyricsAutoscrollSpeedMultiplier}
              />
            ) : null}
          </View>
        </ScrollView>

        <View style={styles.recordingBottomDock}>
          <RecordingControls
            isRecording={recording.isRecording}
            isPaused={recording.isPaused}
            compact={false}
            canSave={recording.isRecording || recording.isPaused}
            onOpenInput={() => setSettingsVisible(true)}
            onPause={recording.pauseRecording}
            onResume={recording.resumeRecording}
            onStart={recording.startRecording}
            onRequestSave={requestSaveRecording}
          />
        </View>
      </View>

      <QuickNameModal
        visible={quickNameModalVisible}
        draftValue={quickNameDraft}
        placeholderValue={recordingPlaceholderTitle}
        onChangeDraft={setQuickNameDraft}
        isPrimary={isPrimaryDraft}
        onChangeIsPrimary={recordingIdea?.kind === "project" ? setIsPrimaryDraft : undefined}
        onCancel={() => setQuickNameModalVisible(false)}
        onSave={async () => {
          await saveQuickClipName();
          navigation.goBack();
        }}
      />

      <Modal
        transparent
        animationType="fade"
        visible={settingsVisible}
        onRequestClose={() => setSettingsVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.recordingSettingsModalCard]}>
            <View style={styles.recordingSettingsHeader}>
              <View style={styles.recordingSettingsHeaderCopy}>
                <Text style={styles.recordingSettingsTitle}>Recording Settings</Text>
                <Text style={styles.recordingSettingsMeta}>
                  Choose the microphone here. Playback output still follows your phone&apos;s current route.
                </Text>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.recordingSettingsCloseBtn,
                  pressed ? styles.pressDown : null,
                ]}
                onPress={() => setSettingsVisible(false)}
              >
                <Ionicons name="close" size={18} color="#111827" />
              </Pressable>
            </View>

            <RecordingInputPicker
              disabled={recording.isRecording || recording.isPaused}
              preferredInputId={preferredRecordingInputId}
              onChangePreferredInputId={setPreferredRecordingInputId}
            />
          </View>
        </View>
      </Modal>

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}
