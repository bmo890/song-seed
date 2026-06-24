import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSharedValue } from "react-native-reanimated";
import type { RootStackParamList } from "../../../App";
import type { ClipSection, PracticeMarker } from "../../types";
import { styles } from "../../styles";
import { colors } from "../../design/tokens";
import { useFullPlayerContext } from "../../hooks/FullPlayerProvider";
import { fmtDuration } from "../../utils";
import { TransportLayout } from "../common/TransportLayout";
import { useTransportScrubbing } from "../../hooks/useTransportScrubbing";
import { usePlayerTransportClock } from "./hooks/usePlayerTransportClock";
import { usePracticeLoopController } from "./hooks/usePracticeLoopController";
import { usePlayerSpeedControls } from "./hooks/usePlayerSpeedControls";
import { usePlayerPins } from "./hooks/usePlayerPins";
import { usePlayerSections } from "./hooks/usePlayerSections";
import { useClipAnalysis } from "./hooks/useClipAnalysis";
import { usePlayerScreenData } from "./hooks/usePlayerScreenData";
import { usePlayerScreenLifecycle } from "./hooks/usePlayerScreenLifecycle";
import { usePlayerPracticePitchTransport } from "./hooks/usePlayerPracticePitchTransport";
import { usePlayerScreenUi } from "./hooks/usePlayerScreenUi";
import { appActions } from "../../state/actions";
import { useStore } from "../../state/useStore";
import { isPlaybackNearEnd } from "../../services/transportPlayback";
import { PlayerTimeline } from "./components/PlayerTimeline";
import { PlayerHeaderSection } from "./components/PlayerHeaderSection";
import { PlayerFooterSection } from "./components/PlayerFooterSection";
import { PlayerPracticePanel } from "./components/PlayerPracticePanel";
import { PlayerSupportSections } from "./components/PlayerSupportSections";
import { PlayerPinSheets } from "./components/PlayerPinSheets";
import { playerScreenStyles } from "./styles";
import { getVisibleTimelineRange } from "./helpers";
import { AppAlert } from "../common/AppAlert";

const PRACTICE_SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5] as const;
const PRACTICE_SPEED_MIN = 0.5;
const PRACTICE_SPEED_MAX = 1.5;

// Stable empty arrays so hiding reel markers doesn't churn the memoized timeline.
const EMPTY_MARKERS: PracticeMarker[] = [];
const EMPTY_SECTIONS: ClipSection[] = [];

export function PlayerScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, "Player">>();
  const isFocused = useIsFocused();

  // Tell the root provider this screen owns queue loading/advancing while mounted;
  // when unmounted (minimized to the dock) the provider takes over.
  useEffect(() => {
    useStore.getState().setPlayerScreenMounted(true);
    const unsubscribeTransitionEnd = navigation.addListener("transitionEnd", (event) => {
      if (event.data?.closing) return;
      useStore.getState().setPlayerDockPresentationHold(false);
    });

    return () => {
      unsubscribeTransitionEnd();
      useStore.getState().setPlayerScreenMounted(false);
      useStore.getState().setPlayerDockPresentationHold(false);
    };
  }, [navigation]);

  const ui = usePlayerScreenUi();
  const draggingMarkerId = useSharedValue("");
  const draggingMarkerX = useSharedValue(0);
  const timelineAudioProgress = useSharedValue(0);
  const pauseVisualHoldMs = useSharedValue(-1);
  const pauseVisualHoldToken = useSharedValue(0);
  const setPauseDisplayPositionRef = React.useRef<((positionMs: number) => void) | null>(null);
  const [pinPreview, setPinPreview] = useState<{ id: string; atMs: number } | null>(null);
  const [sectionPreview, setSectionPreview] = useState<{
    id: string;
    startMs?: number;
    endMs?: number;
  } | null>(null);

  const fullPlayer = useFullPlayerContext();
  const {
    playerTarget: activePlayerTarget,
    playerPosition,
    playerDuration,
    playbackRate,
    isPlayerPlaying,
    finishedPlaybackToken,
    finishedPlaybackClipId,
    currentPlaybackSourceUri,
    openPlayer,
    syncPlayerSource,
    closePlayer,
    pausePlayer,
    playPlayer,
    seekTo,
    updateLockScreenMetadata,
    setPlaybackRate,
  } = fullPlayer;
  const data = usePlayerScreenData({
    playerDuration,
  });
  const playerIdea = data.playerIdea;
  const playerClip = data.playerClip;
  const resolvedDisplayDuration = data.displayDuration;
  const isMixUpdating = data.isOverdubPreviewRendering;
  // While a pin is dragged/nudged we override its position locally so the reel moves live,
  // without writing the whole library snapshot to SQLite on every tick.
  const previewedMarkers = useMemo(() => {
    if (!pinPreview) return data.practiceMarkers;
    return data.practiceMarkers.map((marker) =>
      marker.id === pinPreview.id ? { ...marker, atMs: pinPreview.atMs } : marker
    );
  }, [data.practiceMarkers, pinPreview]);
  // Same live-override trick for a section boundary while its slider is dragged.
  const previewedSections = useMemo(() => {
    if (!sectionPreview) return data.sections;
    return data.sections.map((section) =>
      section.id === sectionPreview.id
        ? {
            ...section,
            ...(sectionPreview.startMs != null ? { startMs: sectionPreview.startMs } : null),
            ...(sectionPreview.endMs != null ? { endMs: sectionPreview.endMs } : null),
          }
        : section
    );
  }, [data.sections, sectionPreview]);
  const pauseFullPlayerAtVisiblePosition = useCallback(async () => {
    const durationMs = resolvedDisplayDuration || playerDuration;
    const visualProgress = timelineAudioProgress.value;
    const visualPositionMs = Math.max(
      0,
      Math.min(durationMs || 0, visualProgress * (durationMs || 0))
    );
    const pauseCorrectionDeltaMs = Math.abs(visualPositionMs - playerPosition);
    const shouldCorrectNativePause =
      durationMs > 0 &&
      visualProgress > 0 &&
      Number.isFinite(visualPositionMs) &&
      pauseCorrectionDeltaMs > 12 &&
      pauseCorrectionDeltaMs <= 250;

    if (shouldCorrectNativePause) {
      pauseVisualHoldMs.value = visualPositionMs;
      pauseVisualHoldToken.value += 1;
      setPauseDisplayPositionRef.current?.(visualPositionMs);
    }

    await pausePlayer();

    if (shouldCorrectNativePause) {
      await seekTo(visualPositionMs);
    }
  }, [
    pausePlayer,
    pauseVisualHoldMs,
    pauseVisualHoldToken,
    playerDuration,
    playerPosition,
    resolvedDisplayDuration,
    seekTo,
    timelineAudioProgress,
  ]);
  const practicePitchTransport = usePlayerPracticePitchTransport({
    mode: ui.mode,
    isFocused,
    clip: playerClip
      ? {
          id: playerClip.id,
          audioUri: data.playbackAudioUri,
        }
      : null,
    pitchShiftSemitones: ui.pitchShiftSemitones,
    playerShouldAutoplay: data.playerShouldAutoplay,
    fullPlayerPosition: playerPosition,
    fullPlayerDuration: resolvedDisplayDuration,
    fullPlayerPlaybackRate: playbackRate,
    fullPlayerIsPlaying: isPlayerPlaying,
    pauseFullPlayer: pauseFullPlayerAtVisiblePosition,
    playFullPlayer: playPlayer,
    seekFullPlayerTo: seekTo,
    setFullPlayerPlaybackRate: setPlaybackRate,
  });
  const effectivePlayerPosition = practicePitchTransport.effectivePositionMs;
  const effectivePlayerDuration =
    practicePitchTransport.effectiveDurationMs || resolvedDisplayDuration;
  const effectivePlaybackRate = practicePitchTransport.effectivePlaybackRate;
  const effectiveIsPlaying = practicePitchTransport.effectiveIsPlaying;
  const transportClock = usePlayerTransportClock({
    positionMs: effectivePlayerPosition,
    durationMs: effectivePlayerDuration,
    isPlaying: effectiveIsPlaying,
    playbackRate: effectivePlaybackRate,
    resetKey: playerClip?.id ?? null,
    resetPositionMs: 0,
  });
  setPauseDisplayPositionRef.current = transportClock.setDisplayPositionMs;
  const hasPreviousTrack = data.playerQueueIndex > 0;
  const hasNextTrack = data.playerQueueIndex >= 0 && data.playerQueueIndex < data.playerQueue.length - 1;
  const transportScrub = useTransportScrubbing({
    isPlaying: effectiveIsPlaying,
    durationMs: effectivePlayerDuration,
    pause: practicePitchTransport.pause,
    play: practicePitchTransport.play,
    seekTo: practicePitchTransport.seekTo,
  });
  const { beginScrub, endScrub, cancelScrub } = transportScrub;
  const {
    playbackSpeed,
    speedPanelVisible,
    setSpeedPanelVisible,
    handleSpeedSlideStart,
    handleSpeedSliding,
    handleSpeedSlideEnd,
    handleSpeedTap,
  } = usePlayerSpeedControls({
    minSpeed: PRACTICE_SPEED_MIN,
    maxSpeed: PRACTICE_SPEED_MAX,
    playbackRate: effectivePlaybackRate,
    isPlayerPlaying: effectiveIsPlaying,
    pausePlayer: practicePitchTransport.pause,
    playPlayer: practicePitchTransport.play,
    setPlaybackRate: practicePitchTransport.setPlaybackRate,
  });
  const visiblePracticeRange = useMemo(
    () =>
      getVisibleTimelineRange(
        effectivePlayerDuration,
        effectivePlayerPosition,
        ui.practiceZoomMultiple
      ),
    [effectivePlayerDuration, effectivePlayerPosition, ui.practiceZoomMultiple]
  );
  const {
    practiceLoopEnabled,
    practiceLoopRange,
    practiceLoopSelection,
    hasValidPracticeLoop,
    isPinDragging,
    setPracticeLoopRange,
    cancelPendingPracticeSeek,
    handleLoopAwareSeek,
    handlePracticeLoopToggle,
    handleTransportToggle,
    handlePinDragStateChange,
    resetPracticeLoopRange,
    movePracticeLoopToPlayhead,
  } = usePracticeLoopController({
    clipId: playerClip?.id,
    mode: ui.mode,
    durationMs: effectivePlayerDuration,
    playerPosition: effectivePlayerPosition,
    isPlayerPlaying: effectiveIsPlaying,
    playbackRate: effectivePlaybackRate,
    isScrubbing: transportScrub.isScrubbing,
    seekTo: practicePitchTransport.seekTo,
    playPlayer: practicePitchTransport.play,
    pausePlayer: practicePitchTransport.pause,
    onDisplaySeek: transportClock.setDisplayPositionMs,
    visibleWindowStartMs: visiblePracticeRange.start,
    visibleWindowEndMs: visiblePracticeRange.end,
  });
  const handleTransportToggleWithDisplaySync = useCallback(async () => {
    const loopControllerWillSeek =
      ui.mode === "practice" && practiceLoopEnabled && hasValidPracticeLoop;
    const shouldDisplayRestart =
      !effectiveIsPlaying &&
      !loopControllerWillSeek &&
      !practicePitchTransport.isOwningNativeTransport &&
      isPlaybackNearEnd(effectivePlayerPosition, effectivePlayerDuration);

    if (shouldDisplayRestart) {
      transportClock.setDisplayPositionMs(0);
    }

    await handleTransportToggle();
  }, [
    effectiveIsPlaying,
    effectivePlayerDuration,
    effectivePlayerPosition,
    handleTransportToggle,
    hasValidPracticeLoop,
    practiceLoopEnabled,
    practicePitchTransport.isOwningNativeTransport,
    transportClock,
    ui.mode,
  ]);
  const {
    newPinLabel,
    pinModalVisible,
    pinActionsTarget,
    pinActionsVisible,
    pinRenameValue,
    setNewPinLabel,
    setPinModalVisible,
    setPinActionsTarget,
    setPinActionsVisible,
    setPinRenameValue,
    handleAddPin,
    handleRepositionMarker,
    handlePinActions,
    handleRenamePin,
    handleDeletePin,
    handleEditPin,
    handleDeletePinId,
    expandedPinId,
    pinNoteDraft,
    setPinNoteDraft,
    togglePinExpanded,
    commitPinNote,
  } = usePlayerPins({
    playerIdeaId: playerIdea?.id,
    playerClipId: playerClip?.id,
    practiceMarkers: data.practiceMarkers,
    displayDuration: effectivePlayerDuration,
    playerPosition: effectivePlayerPosition,
  });
  const sectionsApi = usePlayerSections({
    playerIdeaId: playerIdea?.id,
    playerClipId: playerClip?.id,
    sections: data.sections,
    displayDuration: effectivePlayerDuration,
    playerPosition: effectivePlayerPosition,
  });
  const clipAnalysis = useClipAnalysis({
    playerIdeaId: playerIdea?.id,
    playerClipId: playerClip?.id,
    audioUri: data.playbackAudioUri,
  });
  // Repeat (playlist-style): replay the clip from the top when it finishes.
  const replayClip = useCallback(async () => {
    await practicePitchTransport.seekTo(0);
    await practicePitchTransport.play();
  }, [practicePitchTransport]);
  const lifecycle = usePlayerScreenLifecycle({
    navigation,
    isFocused,
    playerIdea: playerIdea ? { id: playerIdea.id, title: playerIdea.title } : null,
    playerClip,
    playbackAudioUri: data.playbackAudioUri,
    currentPlaybackSourceUri,
    activeWorkspaceId: data.activeWorkspaceId,
    activePlayerTargetClipId: activePlayerTarget?.clipId,
    playerPosition,
    playerDuration,
    displayDuration: resolvedDisplayDuration,
    isPlayerPlaying: effectiveIsPlaying,
    finishedPlaybackToken: practicePitchTransport.isOwningNativeTransport
      ? practicePitchTransport.finishedPlaybackToken
      : finishedPlaybackToken,
    finishedPlaybackClipId: practicePitchTransport.isOwningNativeTransport
      ? practicePitchTransport.finishedPlaybackClipId
      : finishedPlaybackClipId,
    hasNextTrack,
    repeatEnabled: ui.repeatEnabled,
    replayClip,
    playerQueue: data.playerQueue,
    playerToggleRequestToken: data.playerToggleRequestToken,
    playerCloseRequestToken: data.playerCloseRequestToken,
    mode: ui.mode,
    suppressAutoplayOnOpen: practicePitchTransport.shouldSuppressSourceAutoplay,
    speedPanelVisible,
    openPlayer,
    syncPlayerSource,
    closePlayer,
    pausePlayer: practicePitchTransport.pause,
    updateLockScreenMetadata,
    beginScrub,
    endScrub,
    cancelScrub,
    cancelPendingPracticeSeek,
    handleTransportToggle: handleTransportToggleWithDisplaySync,
    setSpeedPanelVisible,
    prepareTransportForClose: practicePitchTransport.prepareForPlayerClose,
  });

  const handleLoopRangeChange = useCallback(
    (start: number, end: number) => setPracticeLoopRange({ start, end }),
    [setPracticeLoopRange]
  );
  const handleLoopSection = useCallback(
    (section: ClipSection) => {
      setPracticeLoopRange({ start: section.startMs, end: section.endMs });
      if (!practiceLoopEnabled) handlePracticeLoopToggle();
    },
    [setPracticeLoopRange, practiceLoopEnabled, handlePracticeLoopToggle]
  );
  const handleRequestAddPin = useCallback(() => {
    handleAddPin("");
  }, [handleAddPin]);
  const handleAddOverdub = useCallback(async () => {
    if (!playerIdea || !playerClip) return;
    try {
      await appActions.startClipOverdubRecording(playerIdea.id, playerClip.id);
      navigation.navigate("Recording" as never);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not start overdub recording.";
      AppAlert.info("Overdub unavailable", message);
    }
  }, [navigation, playerClip, playerIdea]);
  const handleSaveCombined = useCallback(async () => {
    if (!playerIdea || !playerClip) return;
    if (effectiveIsPlaying) {
      await practicePitchTransport.pause();
    }
    try {
      await appActions.saveCombinedClipAsNewClip(playerIdea.id, playerClip.id);
      if (navigation.canGoBack()) {
        navigation.goBack();
        return;
      }
      AppAlert.info("Combined clip saved", "The flattened mix was added as a new clip.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save a combined clip.";
      AppAlert.info("Save combined failed", message);
    }
  }, [effectiveIsPlaying, navigation, playerClip, playerIdea, practicePitchTransport]);
  const handleAdjustRootGain = useCallback(
    (deltaDb: number) => {
      if (!playerIdea || !playerClip) return;
      void appActions.adjustClipOverdubRootGain(playerIdea.id, playerClip.id, deltaDb).catch((error) => {
        const message = error instanceof Error ? error.message : "Could not update the root mix gain.";
        AppAlert.info("Layer update failed", message);
      });
    },
    [playerClip, playerIdea]
  );
  const handleToggleRootLowCut = useCallback(() => {
    if (!playerIdea || !playerClip) return;
    void appActions.toggleClipOverdubRootLowCut(playerIdea.id, playerClip.id).catch((error) => {
      const message = error instanceof Error ? error.message : "Could not update the root mix tone.";
      AppAlert.info("Layer update failed", message);
    });
  }, [playerClip, playerIdea]);
  const handleAdjustStemGain = useCallback(
    (stemId: string, deltaDb: number) => {
      if (!playerIdea || !playerClip) return;
      void appActions.adjustClipOverdubStemGain(playerIdea.id, playerClip.id, stemId, deltaDb).catch((error) => {
        const message = error instanceof Error ? error.message : "Could not update the overdub gain.";
        AppAlert.info("Layer update failed", message);
      });
    },
    [playerClip, playerIdea]
  );
  const handleToggleStemMute = useCallback(
    (stemId: string) => {
      if (!playerIdea || !playerClip) return;
      void appActions.toggleClipOverdubStemMute(playerIdea.id, playerClip.id, stemId).catch((error) => {
        const message = error instanceof Error ? error.message : "Could not update the overdub mute state.";
        AppAlert.info("Layer update failed", message);
      });
    },
    [playerClip, playerIdea]
  );
  const handleToggleStemLowCut = useCallback(
    (stemId: string) => {
      if (!playerIdea || !playerClip) return;
      void appActions.toggleClipOverdubStemLowCut(playerIdea.id, playerClip.id, stemId).catch((error) => {
        const message = error instanceof Error ? error.message : "Could not update the overdub tone.";
        AppAlert.info("Layer update failed", message);
      });
    },
    [playerClip, playerIdea]
  );
  const handleRemoveStem = useCallback(
    (stemId: string) => {
      if (!playerIdea || !playerClip) return;
      void appActions.removeClipOverdubStem(playerIdea.id, playerClip.id, stemId).catch((error) => {
        const message = error instanceof Error ? error.message : "Could not remove the overdub stem.";
        AppAlert.info("Layer update failed", message);
      });
    },
    [playerClip, playerIdea]
  );

  if (!playerIdea || !playerClip) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.subtitle}>Loading player…</Text>
      </SafeAreaView>
    );
  }

  const practiceRangeLabel =
    practiceLoopRange.end > practiceLoopRange.start
      ? `${fmtDuration(practiceLoopRange.start)} → ${fmtDuration(practiceLoopRange.end)}`
      : "No loop";
  const isTransportLocked = isMixUpdating;

  return (
    <SafeAreaView style={[styles.screen, playerScreenStyles.screen]}>
      <TransportLayout
        scrollable
        header={
          <PlayerHeaderSection
            clipTitle={playerClip.title}
            projectTitle={playerIdea.kind === "project" ? playerIdea.title : null}
            createdAt={playerClip.createdAt}
            overdubLayerCount={data.clipOverdubStemCount}
            playerPosition={effectivePlayerPosition}
            displayDuration={effectivePlayerDuration}
            mode={ui.mode}
            onBack={lifecycle.handleBack}
            onMinimize={lifecycle.minimizePlayer}
            onOverflow={lifecycle.handleOverflowMenu}
          />
        }
        stickyTop={
          <View style={playerScreenStyles.stickyReel}>
            {/* When the page header is collapsed (practice mode) it no longer shows the
                timing, so surface a compact playhead / length row just above the reel. */}
            {ui.mode === "practice" ? (
              <View style={playerScreenStyles.reelTimingRow}>
                <Text style={playerScreenStyles.reelTimingText}>
                  {fmtDuration(effectivePlayerPosition)} / {fmtDuration(effectivePlayerDuration)}
                </Text>
              </View>
            ) : null}
            <View style={playerScreenStyles.waveformSection}>
              <View style={playerScreenStyles.waveformShell}>
                <PlayerTimeline
                  mode={ui.mode}
                  reelExpanded={ui.reelExpanded}
                  waveformPeaks={data.waveformPeaks}
                  durationMs={effectivePlayerDuration}
                  resetKey={playerClip.id}
                  isPlayerPlaying={effectiveIsPlaying}
                  playbackRate={effectivePlaybackRate}
                  isScrubbing={transportScrub.isScrubbing}
                  transportClock={transportClock}
                  sharedAudioProgress={timelineAudioProgress}
                  sharedPauseHoldMs={pauseVisualHoldMs}
                  sharedPauseHoldToken={pauseVisualHoldToken}
                  practiceLoopEnabled={practiceLoopEnabled}
                  practiceLoopSelection={practiceLoopSelection}
                  practiceMarkers={ui.markersVisible ? previewedMarkers : EMPTY_MARKERS}
                  sections={ui.markersVisible ? previewedSections : EMPTY_SECTIONS}
                  draggingMarkerId={draggingMarkerId}
                  draggingMarkerX={draggingMarkerX}
                  onLoopRangeChange={handleLoopRangeChange}
                  onSeek={isTransportLocked ? () => {} : handleLoopAwareSeek}
                  onTogglePlay={isTransportLocked ? () => {} : lifecycle.handleTogglePlayPress}
                  onScrubStateChange={isTransportLocked ? () => {} : lifecycle.handleScrubStateChange}
                  onRepositionMarker={handleRepositionMarker}
                  onRequestPinActions={handlePinActions}
                  onRequestAddPin={handleRequestAddPin}
                  onPinDragStateChange={handlePinDragStateChange}
                  practiceZoomMultiple={ui.practiceZoomMultiple}
                  onPracticeZoomMultipleChange={ui.setPracticeZoomMultiple}
                />
                {isTransportLocked ? (
                  <View style={playerScreenStyles.mixUpdatingOverlay}>
                    <View style={playerScreenStyles.mixUpdatingBadge}>
                      <Text style={playerScreenStyles.mixUpdatingLabel}>Updating mix…</Text>
                      <Text style={playerScreenStyles.mixUpdatingMeta}>
                        Playback and scrubbing will resume when the latest layer render finishes.
                      </Text>
                    </View>
                  </View>
                ) : null}
                {/* Expand/shrink floats in the reel's top-right corner, out of the toolbar. */}
                <Pressable
                  style={({ pressed }) => [
                    playerScreenStyles.reelCornerButton,
                    pressed ? playerScreenStyles.overflowButtonPressed : null,
                  ]}
                  onPress={() => ui.setReelExpanded((value) => !value)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: ui.reelExpanded }}
                  accessibilityLabel={ui.reelExpanded ? "Shrink waveform" : "Expand waveform"}
                >
                  <Ionicons
                    name={ui.reelExpanded ? "contract-outline" : "expand-outline"}
                    size={15}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </View>
            </View>

            {/* Reel stays pinned above the scrollable tools. Show/hide toggles all markers;
                Tools toggles practice mode. */}
            <View style={playerScreenStyles.reelToolbar}>
              <Pressable
                style={({ pressed }) => [
                  playerScreenStyles.reelExpandButton,
                  pressed ? playerScreenStyles.overflowButtonPressed : null,
                ]}
                onPress={() => ui.setMarkersVisible((value) => !value)}
                accessibilityRole="button"
                accessibilityState={{ checked: ui.markersVisible }}
                accessibilityLabel={ui.markersVisible ? "Hide markers" : "Show markers"}
              >
                <Ionicons
                  name={ui.markersVisible ? "eye-outline" : "eye-off-outline"}
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={playerScreenStyles.reelExpandText}>
                  {ui.markersVisible ? "Hide markers" : "Show markers"}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  playerScreenStyles.toolsPill,
                  ui.mode === "practice" ? playerScreenStyles.toolsPillActive : null,
                  pressed ? playerScreenStyles.overflowButtonPressed : null,
                ]}
                onPress={() => ui.setMode(ui.mode === "practice" ? "player" : "practice")}
                accessibilityRole="button"
                accessibilityState={{ selected: ui.mode === "practice" }}
                accessibilityLabel={ui.mode === "practice" ? "Close practice tools" : "Open practice tools"}
              >
                <Ionicons
                  name="options-outline"
                  size={15}
                  color={ui.mode === "practice" ? colors.onPrimary : colors.textSecondary}
                />
                <Text
                  style={[
                    playerScreenStyles.toolsPillText,
                    ui.mode === "practice" ? playerScreenStyles.toolsPillTextActive : null,
                  ]}
                >
                  Tools
                </Text>
              </Pressable>
            </View>
          </View>
        }
        footer={
          <PlayerFooterSection
            mode={ui.mode}
            playDisabled={isTransportLocked}
            isPlaying={effectiveIsPlaying}
            hasPreviousTrack={hasPreviousTrack}
            hasNextTrack={hasNextTrack}
            queueEntryCount={data.queueEntries.length}
            repeatEnabled={ui.repeatEnabled}
            queueExpanded={ui.queueExpanded}
            onPreviousTrack={lifecycle.handlePreviousTrack}
            onTogglePlay={isTransportLocked ? () => {} : lifecycle.handleTogglePlayPress}
            onNextTrack={lifecycle.handleNextTrack}
            onToggleRepeat={() => ui.setRepeatEnabled((value) => !value)}
            onToggleQueueExpanded={() => ui.setQueueExpanded((value) => !value)}
          />
        }
      >
        <View style={playerScreenStyles.content}>
          {ui.mode === "practice" ? (
            <PlayerPracticePanel
              expandedTool={ui.expandedTool}
              onToggleTool={ui.toggleTool}
              onClose={ui.closeTool}
              analysis={data.analysis}
              isAnalyzing={clipAnalysis.isAnalyzing}
              analysisError={clipAnalysis.error}
              onDetectAnalysis={clipAnalysis.runAnalysis}
              practiceLoopEnabled={practiceLoopEnabled}
              practiceRangeLabel={practiceRangeLabel}
              onSeekLoopStart={() => handleLoopAwareSeek(practiceLoopRange.start)}
              onMoveLoopToPlayhead={movePracticeLoopToPlayhead}
              onLoopSection={handleLoopSection}
              onTogglePracticeLoop={handlePracticeLoopToggle}
              practiceMarkers={data.practiceMarkers}
              playheadMs={effectivePlayerPosition}
              onAddPin={handleRequestAddPin}
              onSeekPin={isTransportLocked ? () => {} : handleLoopAwareSeek}
              expandedPinId={expandedPinId}
              pinsDurationMs={effectivePlayerDuration}
              onTogglePinExpanded={togglePinExpanded}
              onRepositionPin={handleRepositionMarker}
              onPinPreview={setPinPreview}
              onEditPin={handleEditPin}
              onDeletePin={handleDeletePinId}
              sections={data.sections}
              sectionsDurationMs={effectivePlayerDuration}
              editingSectionId={sectionsApi.editingSectionId}
              onAddSection={sectionsApi.handleAddSection}
              onSeekSection={isTransportLocked ? () => {} : handleLoopAwareSeek}
              onToggleSectionEdit={sectionsApi.handleToggleEdit}
              onEditSection={sectionsApi.handleEditSection}
              onRepositionSectionEdge={sectionsApi.handleRepositionSectionEdge}
              onSectionPreview={setSectionPreview}
              onDeleteSection={sectionsApi.handleDeleteSection}
              playbackSpeed={playbackSpeed}
              speedPresets={PRACTICE_SPEED_PRESETS}
              speedMin={PRACTICE_SPEED_MIN}
              speedMax={PRACTICE_SPEED_MAX}
              onSpeedTap={handleSpeedTap}
              onSpeedSlideStart={handleSpeedSlideStart}
              onSpeedSliding={handleSpeedSliding}
              onSpeedSlideEnd={handleSpeedSlideEnd}
              pitchShiftSemitones={ui.pitchShiftSemitones}
              supportsPitchShift={practicePitchTransport.isPitchShiftAvailable}
              onAdjustPitchShift={ui.setPitchShiftSemitones}
              countInOption={ui.countInOption}
              onSelectCountIn={ui.setCountInOption}
              onRecordOverdub={handleAddOverdub}
            />
          ) : (
            <PlayerSupportSections
              hasProjectLyrics={data.hasProjectLyrics}
              latestLyricsText={data.latestLyricsText}
              lyricsVersionCount={playerIdea.lyrics?.versions.length ?? 1}
              latestLyricsUpdatedAt={data.latestLyricsVersion?.updatedAt ?? null}
              lyricsExpanded={ui.lyricsExpanded}
              hasClipOverdubs={data.hasClipOverdubs}
              clipOverdubStemCount={data.clipOverdubStemCount}
              clipPlaybackUsesRenderedMix={data.clipPlaybackUsesRenderedMix}
              isOverdubPreviewRendering={isMixUpdating}
              isMainPlaybackPlaying={effectiveIsPlaying}
              overdubRootSettings={data.overdubRootSettings}
              overdubStemEntries={data.overdubStemEntries}
              onAddOverdub={handleAddOverdub}
              onSaveCombined={handleSaveCombined}
              onPauseMainPlayback={practicePitchTransport.pause}
              onAdjustRootGain={handleAdjustRootGain}
              onToggleRootLowCut={handleToggleRootLowCut}
              onAdjustStemGain={handleAdjustStemGain}
              onToggleStemMute={handleToggleStemMute}
              onToggleStemLowCut={handleToggleStemLowCut}
              onRemoveStem={handleRemoveStem}
              clipNotes={data.clipNotes}
              clipNotesSummary={data.clipNotesSummary}
              notesExpanded={ui.notesExpanded}
              queueEntries={data.queueEntries}
              currentClipId={playerClip.id}
              queueExpanded={ui.queueExpanded}
              onToggleLyricsExpanded={ui.setLyricsExpanded}
              onToggleNotesExpanded={ui.setNotesExpanded}
              onToggleQueueExpanded={ui.setQueueExpanded}
              onSelectQueueEntry={lifecycle.handleQueueSelect}
            />
          )}
        </View>
      </TransportLayout>

      <PlayerPinSheets
        pinModalVisible={pinModalVisible}
        pinActionsVisible={pinActionsVisible}
        newPinLabel={newPinLabel}
        playerPosition={effectivePlayerPosition}
        pinTargetLabel={pinActionsTarget?.label ?? null}
        pinTargetAtMs={pinActionsTarget?.atMs ?? null}
        pinRenameValue={pinRenameValue}
        onCloseCreate={() => {
          setPinModalVisible(false);
          setNewPinLabel("");
        }}
        onChangeNewPinLabel={setNewPinLabel}
        onSaveNewPin={() => handleAddPin(newPinLabel)}
        onCloseActions={() => {
          setPinActionsVisible(false);
          setPinActionsTarget(null);
        }}
        onChangePinRenameValue={setPinRenameValue}
        onRenamePin={handleRenamePin}
        onDeletePin={handleDeletePin}
      />

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}
