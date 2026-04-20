import React, { useCallback, useMemo } from "react";
import { Alert, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { useSharedValue } from "react-native-reanimated";
import { styles } from "../../styles";
import { useFullPlayer } from "../../hooks/useFullPlayer";
import { fmtDuration } from "../../utils";
import { TransportLayout } from "../common/TransportLayout";
import { useTransportScrubbing } from "../../hooks/useTransportScrubbing";
import { usePlayerTransportClock } from "./hooks/usePlayerTransportClock";
import { usePracticeLoopController } from "./hooks/usePracticeLoopController";
import { usePlayerSpeedControls } from "./hooks/usePlayerSpeedControls";
import { usePlayerPins } from "./hooks/usePlayerPins";
import { usePlayerScreenData } from "./hooks/usePlayerScreenData";
import { usePlayerScreenLifecycle } from "./hooks/usePlayerScreenLifecycle";
import { usePlayerPracticePitchTransport } from "./hooks/usePlayerPracticePitchTransport";
import { usePlayerScreenUi } from "./hooks/usePlayerScreenUi";
import { appActions } from "../../state/actions";
import { PlayerTimeline } from "./components/PlayerTimeline";
import { PlayerHeaderSection } from "./components/PlayerHeaderSection";
import { PlayerFooterSection } from "./components/PlayerFooterSection";
import { PlayerPracticePanel } from "./components/PlayerPracticePanel";
import { PlayerSupportSections } from "./components/PlayerSupportSections";
import { PlayerPinSheets } from "./components/PlayerPinSheets";
import { playerScreenStyles } from "./styles";
import { getVisibleTimelineRange } from "./helpers";

const PRACTICE_SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5] as const;
const PRACTICE_SPEED_MIN = 0.5;
const PRACTICE_SPEED_MAX = 1.5;

export function PlayerScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const ui = usePlayerScreenUi();
  const draggingMarkerId = useSharedValue("");
  const draggingMarkerX = useSharedValue(0);

  const fullPlayer = useFullPlayer();
  const {
    playerTarget: activePlayerTarget,
    playerPosition,
    playerDuration,
    playbackRate,
    isPlayerPlaying,
    waveformPeaks,
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
    pauseFullPlayer: pausePlayer,
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
  });
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
  } = usePlayerPins({
    playerIdeaId: playerIdea?.id,
    playerClipId: playerClip?.id,
    practiceMarkers: data.practiceMarkers,
    displayDuration: effectivePlayerDuration,
    playerPosition: effectivePlayerPosition,
  });
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
    handleTransportToggle: practicePitchTransport.togglePlay,
    setSpeedPanelVisible,
    prepareTransportForClose: practicePitchTransport.prepareForPlayerClose,
  });

  const handleLoopRangeChange = useCallback(
    (start: number, end: number) => setPracticeLoopRange({ start, end }),
    [setPracticeLoopRange]
  );
  const handleRequestAddPin = useCallback(() => {
    handleAddPin("");
  }, [handleAddPin]);
  const handleAddOverdub = useCallback(() => {
    if (!playerIdea || !playerClip) return;
    try {
      appActions.startClipOverdubRecording(playerIdea.id, playerClip.id);
      navigation.navigate("Recording" as never);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not start overdub recording.";
      Alert.alert("Overdub unavailable", message);
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
      Alert.alert("Combined clip saved", "The flattened mix was added as a new clip.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save a combined clip.";
      Alert.alert("Save combined failed", message);
    }
  }, [effectiveIsPlaying, navigation, playerClip, playerIdea, practicePitchTransport]);
  const handleAdjustRootGain = useCallback(
    (deltaDb: number) => {
      if (!playerIdea || !playerClip) return;
      void appActions.adjustClipOverdubRootGain(playerIdea.id, playerClip.id, deltaDb).catch((error) => {
        const message = error instanceof Error ? error.message : "Could not update the root mix gain.";
        Alert.alert("Layer update failed", message);
      });
    },
    [playerClip, playerIdea]
  );
  const handleToggleRootLowCut = useCallback(() => {
    if (!playerIdea || !playerClip) return;
    void appActions.toggleClipOverdubRootLowCut(playerIdea.id, playerClip.id).catch((error) => {
      const message = error instanceof Error ? error.message : "Could not update the root mix tone.";
      Alert.alert("Layer update failed", message);
    });
  }, [playerClip, playerIdea]);
  const handleAdjustStemGain = useCallback(
    (stemId: string, deltaDb: number) => {
      if (!playerIdea || !playerClip) return;
      void appActions.adjustClipOverdubStemGain(playerIdea.id, playerClip.id, stemId, deltaDb).catch((error) => {
        const message = error instanceof Error ? error.message : "Could not update the overdub gain.";
        Alert.alert("Layer update failed", message);
      });
    },
    [playerClip, playerIdea]
  );
  const handleToggleStemMute = useCallback(
    (stemId: string) => {
      if (!playerIdea || !playerClip) return;
      void appActions.toggleClipOverdubStemMute(playerIdea.id, playerClip.id, stemId).catch((error) => {
        const message = error instanceof Error ? error.message : "Could not update the overdub mute state.";
        Alert.alert("Layer update failed", message);
      });
    },
    [playerClip, playerIdea]
  );
  const handleToggleStemLowCut = useCallback(
    (stemId: string) => {
      if (!playerIdea || !playerClip) return;
      void appActions.toggleClipOverdubStemLowCut(playerIdea.id, playerClip.id, stemId).catch((error) => {
        const message = error instanceof Error ? error.message : "Could not update the overdub tone.";
        Alert.alert("Layer update failed", message);
      });
    },
    [playerClip, playerIdea]
  );
  const handleRemoveStem = useCallback(
    (stemId: string) => {
      if (!playerIdea || !playerClip) return;
      void appActions.removeClipOverdubStem(playerIdea.id, playerClip.id, stemId).catch((error) => {
        const message = error instanceof Error ? error.message : "Could not remove the overdub stem.";
        Alert.alert("Layer update failed", message);
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
            onOverflow={lifecycle.handleOverflowMenu}
            onChangeMode={ui.setMode}
          />
        }
        footer={
          <PlayerFooterSection
            mode={ui.mode}
            speedPanelVisible={speedPanelVisible}
            playbackSpeed={playbackSpeed}
            speedPresets={PRACTICE_SPEED_PRESETS}
            speedMin={PRACTICE_SPEED_MIN}
            speedMax={PRACTICE_SPEED_MAX}
            isPlaying={effectiveIsPlaying}
            hasPreviousTrack={hasPreviousTrack}
            hasNextTrack={hasNextTrack}
            queueEntryCount={data.queueEntries.length}
            practiceLoopEnabled={practiceLoopEnabled}
            queueExpanded={ui.queueExpanded}
            onToggleSpeedPanel={() => setSpeedPanelVisible((value) => !value)}
            onSpeedSliding={handleSpeedSliding}
            onSpeedSlideStart={handleSpeedSlideStart}
            onSpeedSlideEnd={handleSpeedSlideEnd}
            onSpeedTap={handleSpeedTap}
            onPreviousTrack={lifecycle.handlePreviousTrack}
            onTogglePlay={lifecycle.handleTogglePlayPress}
            onNextTrack={lifecycle.handleNextTrack}
            onTogglePracticeLoop={handlePracticeLoopToggle}
            onToggleQueueExpanded={() => ui.setQueueExpanded((value) => !value)}
          />
        }
      >
        <View style={playerScreenStyles.content}>
          <View style={playerScreenStyles.waveformSection}>
            <PlayerTimeline
              mode={ui.mode}
              waveformPeaks={waveformPeaks}
              durationMs={effectivePlayerDuration}
              isPlayerPlaying={effectiveIsPlaying}
              playbackRate={effectivePlaybackRate}
              isScrubbing={transportScrub.isScrubbing}
              transportClock={transportClock}
              practiceLoopEnabled={practiceLoopEnabled}
              practiceLoopSelection={practiceLoopSelection}
              practiceMarkers={data.practiceMarkers}
              draggingMarkerId={draggingMarkerId}
              draggingMarkerX={draggingMarkerX}
              onLoopRangeChange={handleLoopRangeChange}
              onSeek={handleLoopAwareSeek}
              onTogglePlay={lifecycle.handleTogglePlayPress}
              onScrubStateChange={lifecycle.handleScrubStateChange}
              onRepositionMarker={handleRepositionMarker}
              onRequestPinActions={handlePinActions}
              onRequestAddPin={handleRequestAddPin}
              onPinDragStateChange={handlePinDragStateChange}
              practiceZoomMultiple={ui.practiceZoomMultiple}
              onPracticeZoomMultipleChange={ui.setPracticeZoomMultiple}
            />
          </View>

          {ui.mode === "practice" ? (
            <PlayerPracticePanel
              practiceLoopEnabled={practiceLoopEnabled}
              practiceRangeLabel={practiceRangeLabel}
              countInOption={ui.countInOption}
              clipNotes={data.clipNotes}
              pitchShiftSemitones={ui.pitchShiftSemitones}
              supportsPitchShift={practicePitchTransport.isPitchShiftAvailable}
              onSeekLoopStart={() => handleLoopAwareSeek(practiceLoopRange.start)}
              onMoveLoopToPlayhead={movePracticeLoopToPlayhead}
              onResetLoopRange={resetPracticeLoopRange}
              onTogglePracticeLoop={handlePracticeLoopToggle}
              onSelectCountIn={ui.setCountInOption}
              onAdjustPitchShift={ui.setPitchShiftSemitones}
              onPressNotes={() => {
                // TODO: open notes sheet
              }}
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
