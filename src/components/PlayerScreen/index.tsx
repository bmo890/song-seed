import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { StackActions, useIsFocused, useNavigation } from "@react-navigation/native";
import { useSharedValue } from "react-native-reanimated";
import type { PracticeMarker } from "../../types";
import { styles } from "../../styles";
import { useStore } from "../../state/useStore";
import { useFullPlayer } from "../../hooks/useFullPlayer";
import { MANAGED_WAVEFORM_PEAK_COUNT, loadManagedAudioMetadata, shareAudioFile } from "../../services/audioStorage";
import { getLatestLyricsVersion, lyricsDocumentToText } from "../../lyrics";
import { fmtDuration } from "../../utils";
import { getCollectionById } from "../../utils";
import { TransportLayout } from "../common/TransportLayout";
import { useTransportScrubbing } from "../../hooks/useTransportScrubbing";
import { appActions } from "../../state/actions";
import { usePlayerTransportClock } from "./hooks/usePlayerTransportClock";
import { usePracticeLoopController } from "./hooks/usePracticeLoopController";
import { usePlayerSpeedControls } from "./hooks/usePlayerSpeedControls";
import { usePlayerPins } from "./hooks/usePlayerPins";
import { PlayerTimeline } from "./components/PlayerTimeline";
import { PlayerHeaderSection } from "./components/PlayerHeaderSection";
import { PlayerFooterSection } from "./components/PlayerFooterSection";
import { PlayerPracticePanel } from "./components/PlayerPracticePanel";
import { PlayerSupportSections } from "./components/PlayerSupportSections";
import { PlayerPinSheets } from "./components/PlayerPinSheets";
import { playerScreenStyles } from "./styles";

type PlayerMode = "player" | "practice";
type CountInOption = "off" | "1b" | "2b";
const EMPTY_IDEAS: import("../../types").SongIdea[] = [];
const PRACTICE_SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5] as const;
const PRACTICE_SPEED_MIN = 0.5;
const PRACTICE_SPEED_MAX = 1.5;
function getVisibleTimelineRange(durationMs: number, anchorMs: number, zoomMultiple: number) {
  if (durationMs <= 0) {
    return { start: 0, end: 0 };
  }

  const safeZoom = Math.max(1, zoomMultiple);
  const visibleDurationMs = Math.min(durationMs, Math.max(1, durationMs / safeZoom));
  const maxStartMs = Math.max(0, durationMs - visibleDurationMs);
  const startMs = Math.max(0, Math.min(anchorMs - visibleDurationMs / 2, maxStartMs));

  return {
    start: Math.round(startMs),
    end: Math.round(startMs + visibleDurationMs),
  };
}

function extractLyricsMarkers(lyricsText: string, durationMs: number): PracticeMarker[] {
  if (durationMs <= 0) return [];

  const headingLines = lyricsText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && (line.endsWith(":") || /^\[[^\]]+\]$/.test(line)))
    .slice(0, 4)
    .map((line, index, items) => {
      const cleaned = line.replace(/[:\[\]]/g, "").trim();
      const denominator = Math.max(1, items.length - 1);
      return {
        id: `heading-${index}`,
        label: cleaned || `Marker ${index + 1}`,
        atMs: Math.round(durationMs * (0.1 + (0.72 * index) / denominator)),
      };
    });

  return headingLines;
}

function getNoteSummary(notes: string) {
  const trimmed = notes.trim();
  if (!trimmed) return "No clip notes yet.";
  return trimmed;
}

export function PlayerScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const playerTarget = useStore((s) => s.playerTarget);
  const playerQueue = useStore((s) => s.playerQueue);
  const playerQueueIndex = useStore((s) => s.playerQueueIndex);
  const playerToggleRequestToken = useStore((s) => s.playerToggleRequestToken);
  const playerCloseRequestToken = useStore((s) => s.playerCloseRequestToken);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const workspaces = useStore((s) => s.workspaces);
  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId]
  );
  const ideas = activeWorkspace?.ideas ?? EMPTY_IDEAS;

  const playerIdea = useMemo(
    () => (playerTarget ? ideas.find((x) => x.id === playerTarget.ideaId) ?? null : null),
    [ideas, playerTarget]
  );
  const playerClip = useMemo(
    () => (playerIdea && playerTarget ? playerIdea.clips.find((c) => c.id === playerTarget.clipId) ?? null : null),
    [playerIdea, playerTarget]
  );
  const queueEntries = useMemo(
    () =>
      playerQueue
        .map((item) => {
          const idea = ideas.find((candidate) => candidate.id === item.ideaId);
          const clip = idea?.clips.find((candidate) => candidate.id === item.clipId);
          if (!idea || !clip) return null;
          return {
            ideaId: item.ideaId,
            clipId: item.clipId,
            title: clip.title,
            subtitle: idea.title,
          };
        })
        .filter((entry): entry is { ideaId: string; clipId: string; title: string; subtitle: string } => !!entry),
    [playerQueue, ideas]
  );
  const latestLyricsVersion = useMemo(
    () => (playerIdea?.kind === "project" ? getLatestLyricsVersion(playerIdea) : null),
    [playerIdea]
  );
  const latestLyricsText = useMemo(
    () => lyricsDocumentToText(latestLyricsVersion?.document),
    [latestLyricsVersion?.id]
  );
  const hasProjectLyrics = playerIdea?.kind === "project" && latestLyricsText.trim().length > 0;
  const playerCollection =
    playerIdea && activeWorkspace ? getCollectionById(activeWorkspace, playerIdea.collectionId) : null;

  const [mode, setMode] = useState<PlayerMode>("player");
  const [lyricsExpanded, setLyricsExpanded] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [queueExpanded, setQueueExpanded] = useState(false);
  const [countInOption, setCountInOption] = useState<CountInOption>("off");
  const [practiceZoomMultiple, setPracticeZoomMultiple] = useState<number>(1);
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
    openPlayer,
    closePlayer,
    pausePlayer,
    playPlayer,
    seekTo,
    updateLockScreenMetadata,
    setPlaybackRate,
  } = fullPlayer;
  const displayDuration = playerDuration || playerClip?.durationMs || 0;
  const transportClock = usePlayerTransportClock({
    positionMs: playerPosition,
    durationMs: displayDuration,
    isPlaying: isPlayerPlaying,
    playbackRate,
  });
  const hasPreviousTrack = playerQueueIndex > 0;
  const hasNextTrack = playerQueueIndex >= 0 && playerQueueIndex < playerQueue.length - 1;
  const handledToggleTokenRef = useRef(playerToggleRequestToken);
  const handledCloseTokenRef = useRef(playerCloseRequestToken);
  const transportScrub = useTransportScrubbing({
    isPlaying: isPlayerPlaying,
    durationMs: displayDuration,
    pause: pausePlayer,
    play: playPlayer,
    seekTo,
  });
  const { beginScrub, endScrub, cancelScrub } = transportScrub;
  const practiceMarkers = useMemo(() => {
    // Use custom markers if they exist
    if (playerClip?.practiceMarkers && playerClip.practiceMarkers.length > 0) {
      return playerClip.practiceMarkers;
    }
    // Fall back to extracting markers from lyrics if available
    return extractLyricsMarkers(latestLyricsText, displayDuration);
  }, [displayDuration, latestLyricsText, playerClip?.practiceMarkers]);
  const clipNotes = playerClip?.notes ?? "";
  const clipNotesSummary = getNoteSummary(clipNotes);
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
    isPlayerPlaying,
    pausePlayer,
    playPlayer,
    setPlaybackRate,
  });
  const visiblePracticeRange = useMemo(
    () => getVisibleTimelineRange(displayDuration, playerPosition, practiceZoomMultiple),
    [displayDuration, playerPosition, practiceZoomMultiple]
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
    mode,
    durationMs: displayDuration,
    playerPosition,
    isPlayerPlaying,
    playbackRate,
    isScrubbing: transportScrub.isScrubbing,
    seekTo,
    playPlayer,
    pausePlayer,
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
    practiceMarkers,
    displayDuration,
    playerPosition,
  });

  useEffect(() => {
    if (!isFocused) return;
    if (playerIdea && playerClip && playerClip.audioUri) {
      if (activePlayerTarget?.clipId !== playerClip.id) {
        const shouldAutoplay = useStore.getState().playerShouldAutoplay;
        if (shouldAutoplay) {
          useStore.getState().consumePlayerAutoplay();
        }
        void openPlayer(
          playerIdea.id,
          playerClip,
          {
            title: playerClip.title,
            albumTitle: playerIdea.title,
          },
          shouldAutoplay
        );
      }
    }
  }, [activePlayerTarget?.clipId, isFocused, openPlayer, playerClip?.audioUri, playerClip?.id, playerIdea?.id, playerClip, playerIdea]);

  useEffect(() => {
    if (!playerIdea || !playerClip) return;
    updateLockScreenMetadata({
      title: playerClip.title,
      albumTitle: playerIdea.title,
    });
  }, [playerClip?.title, playerIdea?.title, updateLockScreenMetadata]);

  useEffect(() => {
    if (!activeWorkspaceId || !playerIdea || !playerClip || !playerDuration) return;
    if (playerClip.durationMs && playerClip.durationMs > 0) return;
    appActions.hydrateClipAudioMetadata(activeWorkspaceId, playerIdea.id, playerClip.id, {
      durationMs: playerDuration,
    });
  }, [activeWorkspaceId, playerDuration, playerClip?.durationMs, playerClip?.id, playerIdea?.id]);

  useEffect(() => {
    if (!activeWorkspaceId || !playerIdea || !playerClip?.audioUri) return;
    if ((playerClip.waveformPeaks?.length ?? 0) >= MANAGED_WAVEFORM_PEAK_COUNT) return;
    if (hydratedWaveformClipIdsRef.current.has(playerClip.id)) return;

    hydratedWaveformClipIdsRef.current.add(playerClip.id);

    void loadManagedAudioMetadata(
      playerClip.audioUri,
      `${playerIdea.id}-${playerClip.id}`,
      playerClip.durationMs
    )
      .then((metadata) => {
        appActions.hydrateClipAudioMetadata(activeWorkspaceId, playerIdea.id, playerClip.id, {
          durationMs: metadata.durationMs,
          waveformPeaks: metadata.waveformPeaks,
        });
      })
      .catch((error) => {
        console.warn("Player waveform hydration failed", error);
      });
  }, [
    activeWorkspaceId,
    playerClip?.audioUri,
    playerClip?.durationMs,
    playerClip?.id,
    playerClip?.waveformPeaks?.length,
    playerIdea?.id,
  ]);

  useEffect(() => {
    if (!finishedPlaybackToken) return;
    if (!playerClip?.id) return;
    if (finishedPlaybackClipId !== playerClip.id) return;
    if (hasNextTrack) {
      useStore.getState().advancePlayerQueue("next", true);
    }
  }, [finishedPlaybackClipId, finishedPlaybackToken, hasNextTrack, playerClip?.id]);

  const hydratedWaveformClipIdsRef = useRef(new Set<string>());

  useEffect(() => {
    if (mode !== "practice" && speedPanelVisible) {
      setSpeedPanelVisible(false);
    }
  }, [mode, speedPanelVisible]);

  useEffect(() => {
    if (playerToggleRequestToken === handledToggleTokenRef.current) return;
    handledToggleTokenRef.current = playerToggleRequestToken;
    void handleTransportToggle();
  }, [playerToggleRequestToken]); // Token-based: only fires when a new toggle is requested

  useEffect(() => {
    if (playerCloseRequestToken === handledCloseTokenRef.current) return;
    handledCloseTokenRef.current = playerCloseRequestToken;
    cancelPendingPracticeSeek();
    void cancelScrub();
    void closePlayer();
    useStore.getState().clearPlayerQueue();
  }, [cancelPendingPracticeSeek, cancelScrub, closePlayer, playerCloseRequestToken]);

  const handleBack = useCallback(() => {
    cancelPendingPracticeSeek();
    void closePlayer();
    useStore.getState().clearPlayerQueue();
    navigation.goBack();
  }, [cancelPendingPracticeSeek, closePlayer, navigation]);

  const handleScrubStateChange = useCallback((scrubbing: boolean) => {
    if (scrubbing) {
      void beginScrub();
      return;
    }
    void endScrub();
  }, [beginScrub, endScrub]);

  function minimizePlayer() {
    const routes = navigation.getState()?.routes ?? [];
    const targetRoute =
      [...routes]
        .slice(0, -1)
        .reverse()
        .find((route) => route.name !== "Player" && route.name !== "Recording") ?? null;

    if (targetRoute) {
      navigation.dispatch(StackActions.push(targetRoute.name, targetRoute.params));
      return;
    }

    (navigation as any).navigate("Home", { screen: "Workspaces" });
  }

  const handleLoopRangeChange = useCallback(
    (start: number, end: number) => setPracticeLoopRange({ start, end }),
    [setPracticeLoopRange]
  );
  const handleRequestAddPin = useCallback(() => {
    handleAddPin("");
  }, [handleAddPin]);
  const handleTogglePlayPress = useCallback(() => {
    void handleTransportToggle();
  }, [handleTransportToggle]);
  const handlePreviousTrack = useCallback(() => {
    useStore.getState().advancePlayerQueue("previous", true);
  }, []);
  const handleNextTrack = useCallback(() => {
    useStore.getState().advancePlayerQueue("next", true);
  }, []);
  const handleQueueSelect = useCallback((index: number) => {
    useStore.getState().setPlayerQueue(playerQueue, index, true);
  }, [playerQueue]);

  function handleOverflowMenu() {
    Alert.alert("Player options", playerClip?.title, [
      {
        text: "Minimize player",
        onPress: minimizePlayer,
      },
      {
        text: "Edit clip",
        onPress: async () => {
          if (!playerIdea || !playerClip) return;
          if (isPlayerPlaying) {
            await pausePlayer();
          }
          (navigation as any).navigate("Editor", {
            ideaId: playerIdea.id,
            clipId: playerClip.id,
            audioUri: playerClip.audioUri,
            durationMs: displayDuration || undefined,
          });
        },
      },
      {
        text: "Share audio",
        onPress: async () => {
          if (!playerClip?.audioUri) return;
          try {
            await shareAudioFile(playerClip.audioUri, playerClip.title);
          } catch (error) {
            console.warn("Share audio error", error);
            const message = error instanceof Error ? error.message : "Could not share this audio file.";
            Alert.alert("Share failed", message);
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

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
            playerPosition={playerPosition}
            displayDuration={displayDuration}
            mode={mode}
            onBack={handleBack}
            onOverflow={handleOverflowMenu}
            onChangeMode={setMode}
          />
        }
        footer={
          <PlayerFooterSection
            mode={mode}
            speedPanelVisible={speedPanelVisible}
            playbackSpeed={playbackSpeed}
            speedPresets={PRACTICE_SPEED_PRESETS}
            speedMin={PRACTICE_SPEED_MIN}
            speedMax={PRACTICE_SPEED_MAX}
            isPlaying={isPlayerPlaying}
            hasPreviousTrack={hasPreviousTrack}
            hasNextTrack={hasNextTrack}
            queueEntryCount={queueEntries.length}
            practiceLoopEnabled={practiceLoopEnabled}
            queueExpanded={queueExpanded}
            onToggleSpeedPanel={() => setSpeedPanelVisible((value) => !value)}
            onSpeedSliding={handleSpeedSliding}
            onSpeedSlideStart={handleSpeedSlideStart}
            onSpeedSlideEnd={handleSpeedSlideEnd}
            onSpeedTap={handleSpeedTap}
            onPreviousTrack={handlePreviousTrack}
            onTogglePlay={handleTogglePlayPress}
            onNextTrack={handleNextTrack}
            onTogglePracticeLoop={handlePracticeLoopToggle}
            onToggleQueueExpanded={() => setQueueExpanded((value) => !value)}
          />
        }
      >
        <View style={playerScreenStyles.content}>
          <View style={playerScreenStyles.waveformSection}>
            <PlayerTimeline
              mode={mode}
              waveformPeaks={waveformPeaks}
              durationMs={displayDuration}
              isPlayerPlaying={isPlayerPlaying}
              playbackRate={playbackRate}
              isScrubbing={transportScrub.isScrubbing}
              transportClock={transportClock}
              practiceLoopEnabled={practiceLoopEnabled}
              practiceLoopSelection={practiceLoopSelection}
              practiceMarkers={practiceMarkers}
              draggingMarkerId={draggingMarkerId}
              draggingMarkerX={draggingMarkerX}
              onLoopRangeChange={handleLoopRangeChange}
              onSeek={handleLoopAwareSeek}
              onTogglePlay={handleTogglePlayPress}
              onScrubStateChange={handleScrubStateChange}
              onRepositionMarker={handleRepositionMarker}
              onRequestPinActions={handlePinActions}
              onRequestAddPin={handleRequestAddPin}
              onPinDragStateChange={handlePinDragStateChange}
              practiceZoomMultiple={practiceZoomMultiple}
              onPracticeZoomMultipleChange={setPracticeZoomMultiple}
            />
          </View>

          {mode === "practice" ? (
            <PlayerPracticePanel
              practiceLoopEnabled={practiceLoopEnabled}
              practiceRangeLabel={practiceRangeLabel}
              countInOption={countInOption}
              clipNotes={clipNotes}
              onSeekLoopStart={() => handleLoopAwareSeek(practiceLoopRange.start)}
              onMoveLoopToPlayhead={movePracticeLoopToPlayhead}
              onResetLoopRange={resetPracticeLoopRange}
              onTogglePracticeLoop={handlePracticeLoopToggle}
              onSelectCountIn={setCountInOption}
              onPressNotes={() => {
                // TODO: open notes sheet
              }}
            />
          ) : (
            <PlayerSupportSections
              hasProjectLyrics={hasProjectLyrics}
              latestLyricsText={latestLyricsText}
              lyricsVersionCount={playerIdea.lyrics?.versions.length ?? 1}
              latestLyricsUpdatedAt={latestLyricsVersion?.updatedAt ?? null}
              lyricsExpanded={lyricsExpanded}
              clipNotes={clipNotes}
              clipNotesSummary={clipNotesSummary}
              notesExpanded={notesExpanded}
              queueEntries={queueEntries}
              currentClipId={playerClip.id}
              queueExpanded={queueExpanded}
              onToggleLyricsExpanded={setLyricsExpanded}
              onToggleNotesExpanded={setNotesExpanded}
              onToggleQueueExpanded={setQueueExpanded}
              onSelectQueueEntry={handleQueueSelect}
            />
          )}
        </View>
      </TransportLayout>

      <PlayerPinSheets
        pinModalVisible={pinModalVisible}
        pinActionsVisible={pinActionsVisible}
        newPinLabel={newPinLabel}
        playerPosition={playerPosition}
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
