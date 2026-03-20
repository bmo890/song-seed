import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { StackActions, useIsFocused, useNavigation } from "@react-navigation/native";
import { useSharedValue } from "react-native-reanimated";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { styles } from "../../styles";
import { useStore } from "../../state/useStore";
import { useFullPlayer } from "../../hooks/useFullPlayer";
import { PlayerControls } from "./PlayerControls";
import { PlayerQueue } from "./PlayerQueue";
import { PlayerLyricsPanel } from "./PlayerLyricsPanel";
import { PlayerSupportPanel } from "./PlayerSupportPanel";
import { PlayerTransportDock } from "./PlayerTransportDock";
import { PracticePinBadges } from "./PracticePinBadges";
import { SegmentedControl } from "../common/SegmentedControl";
import { shareAudioFile } from "../../services/audioStorage";
import { getLatestLyricsVersion, lyricsDocumentToText } from "../../lyrics";
import { formatDate, fmtDuration } from "../../utils";
import { getCollectionById } from "../../utils";
import { TransportLayout } from "../common/TransportLayout";
import { BottomSheet } from "../common/BottomSheet";
import { useTransportScrubbing } from "../../hooks/useTransportScrubbing";
import { appActions } from "../../state/actions";
import { MultiTimeRangeSelector } from "../common/TimeRangeSelector";

type PlayerMode = "player" | "practice";
type CountInOption = "off" | "1b" | "2b";
type PracticeMarker = {
  id: string;
  label: string;
  atMs: number;
};

const EMPTY_IDEAS: import("../../types").SongIdea[] = [];

function buildDefaultLoopRegion(durationMs: number, anchorMs = 0) {
  if (durationMs <= 0) {
    return { start: 0, end: 0 };
  }
  const loopSpan = Math.max(1000, Math.round(durationMs * 0.25));
  const safeStart = Math.max(0, Math.min(anchorMs, durationMs));
  const nextEnd = Math.min(durationMs, safeStart + loopSpan);
  return {
    start: safeStart,
    end: nextEnd,
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

function findActiveMarker(markers: PracticeMarker[], currentTimeMs: number) {
  if (markers.length === 0) return null;
  let activeMarker = markers[0];
  for (const marker of markers) {
    if (currentTimeMs + 600 >= marker.atMs) {
      activeMarker = marker;
    }
  }
  return activeMarker;
}

function getNoteSummary(notes: string) {
  const trimmed = notes.trim();
  if (!trimmed) return "No clip notes yet.";
  return trimmed;
}

/* Animated drag indicator line – rendered inside the waveform overlay */
function DragIndicatorLine({
  draggingMarkerId,
  draggingMarkerX,
}: {
  draggingMarkerId: { value: string };
  draggingMarkerX: { value: number };
}) {
  const lineStyle = useAnimatedStyle(() => ({
    position: "absolute" as const,
    left: draggingMarkerX.value - 1,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "#ca8a04",
    opacity: draggingMarkerId.value !== "" ? 1 : 0,
  }));
  return <Animated.View style={lineStyle} pointerEvents="none" />;
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
  const [practiceLoopEnabled, setPracticeLoopEnabled] = useState(false);
  const [loopPlaybackEngaged, setLoopPlaybackEngaged] = useState(false);
  const [practiceLoopRange, setPracticeLoopRange] = useState({ start: 0, end: 0 });
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [countInOption, setCountInOption] = useState<CountInOption>("off");
  const [newPinLabel, setNewPinLabel] = useState("");
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinActionsTarget, setPinActionsTarget] = useState<PracticeMarker | null>(null);
  const [pinActionsVisible, setPinActionsVisible] = useState(false);
  const [pinRenameValue, setPinRenameValue] = useState("");
  const [isPinDragging, setIsPinDragging] = useState(false);
  const draggingMarkerId = useSharedValue("");
  const draggingMarkerX = useSharedValue(0);
  const loopSeekLockRef = useRef(false);
  const practiceSeekInFlightRef = useRef(false);
  const pendingPracticeSeekMsRef = useRef<number | null>(null);
  const practiceSeekTokenRef = useRef(0);
  const manualPracticeJumpRef = useRef(false);

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
  const lyricsAutoscrollState = useMemo(
    () => ({
      mode: "off" as const,
      currentTimeMs: playerPosition,
      durationMs: displayDuration,
      activeLineId: null,
    }),
    [displayDuration, playerPosition]
  );
  const practiceMarkers = useMemo(() => {
    // Use custom markers if they exist
    if (playerClip?.practiceMarkers && playerClip.practiceMarkers.length > 0) {
      return playerClip.practiceMarkers;
    }
    // Fall back to extracting markers from lyrics if available
    return extractLyricsMarkers(latestLyricsText, displayDuration);
  }, [displayDuration, latestLyricsText, playerClip?.practiceMarkers]);
  const activePracticeMarker = useMemo(
    () => findActiveMarker(practiceMarkers, playerPosition),
    [playerPosition, practiceMarkers]
  );
  const practiceLoopSelection = useMemo(
    () => [
      {
        id: "practice-loop",
        start: practiceLoopRange.start,
        end: practiceLoopRange.end,
        type: "keep" as const,
      },
    ],
    [practiceLoopRange.end, practiceLoopRange.start]
  );
  const clipNotes = playerClip?.notes ?? "";
  const clipNotesSummary = getNoteSummary(clipNotes);
  const hasValidPracticeLoop = practiceLoopRange.end > practiceLoopRange.start;

  // Stable reference: memoized to prevent unnecessary useEffect re-triggers
  const isWithinPracticeLoop = useCallback(
    (timeMs: number) =>
      hasValidPracticeLoop && timeMs >= practiceLoopRange.start && timeMs < practiceLoopRange.end,
    [hasValidPracticeLoop, practiceLoopRange.start, practiceLoopRange.end]
  );

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
    if (!finishedPlaybackToken) return;
    if (!playerClip?.id) return;
    if (finishedPlaybackClipId !== playerClip.id) return;
    if (hasNextTrack) {
      useStore.getState().advancePlayerQueue("next", true);
    }
  }, [finishedPlaybackClipId, finishedPlaybackToken, hasNextTrack, playerClip?.id]);

  useEffect(() => {
    setPracticeLoopRange(buildDefaultLoopRegion(displayDuration));
  }, [displayDuration, playerClip?.id]);

  useEffect(() => {
    manualPracticeJumpRef.current = false;
    setLoopPlaybackEngaged(false);
  }, [mode, playerClip?.id, practiceLoopEnabled, practiceLoopRange.end, practiceLoopRange.start]);

  const wasPlayingBeforeSpeedChange = useRef(false);
  const isSlidingSpeed = useRef(false);

  const cleanSpeed = (v: number) => Math.round(v * 20) / 20; // snap to nearest 0.05

  const handleSpeedSlideStart = useCallback(() => {
    isSlidingSpeed.current = true;
    wasPlayingBeforeSpeedChange.current = isPlayerPlaying;
    if (isPlayerPlaying) pausePlayer();
  }, [isPlayerPlaying, pausePlayer]);

  const handleSpeedSliding = useCallback((v: number) => {
    setPlaybackSpeed(cleanSpeed(v));
  }, []);

  const handleSpeedSlideEnd = useCallback((v: number) => {
    const clean = cleanSpeed(v);
    isSlidingSpeed.current = false;
    setPlaybackSpeed(clean);
    setPlaybackRate(clean);
    if (wasPlayingBeforeSpeedChange.current) {
      setTimeout(() => playPlayer(), 80);
    }
  }, [playPlayer, setPlaybackRate]);

  const handleSpeedTap = useCallback((speed: number) => {
    wasPlayingBeforeSpeedChange.current = isPlayerPlaying;
    if (isPlayerPlaying) pausePlayer();
    setPlaybackSpeed(speed);
    setPlaybackRate(speed);
    if (wasPlayingBeforeSpeedChange.current) {
      setTimeout(() => playPlayer(), 80);
    }
  }, [isPlayerPlaying, pausePlayer, playPlayer, setPlaybackRate]);

  useEffect(() => {
    if (
      mode !== "practice" ||
      !practiceLoopEnabled ||
      !isPlayerPlaying ||
      transportScrub.isScrubbing ||
      isPinDragging
    ) {
      return;
    }
    if (!hasValidPracticeLoop) {
      return;
    }
    if (!loopPlaybackEngaged) {
      if (isWithinPracticeLoop(playerPosition)) {
        manualPracticeJumpRef.current = false;
        setLoopPlaybackEngaged(true);
      }
      return;
    }
    if (playerPosition < practiceLoopRange.start) {
      setLoopPlaybackEngaged(false);
      return;
    }
    if (playerPosition < practiceLoopRange.end - 40 || loopSeekLockRef.current) {
      return;
    }

    loopSeekLockRef.current = true;
    void seekTo(practiceLoopRange.start).finally(() => {
      setTimeout(() => {
        loopSeekLockRef.current = false;
      }, 50);
    });
  }, [
    isPlayerPlaying,
    isWithinPracticeLoop,
    loopPlaybackEngaged,
    mode,
    hasValidPracticeLoop,
    playerPosition,
    practiceLoopEnabled,
    practiceLoopRange.end,
    practiceLoopRange.start,
    seekTo,
    isPinDragging,
    transportScrub.isScrubbing,
  ]);

  useEffect(() => {
    if (playerToggleRequestToken === handledToggleTokenRef.current) return;
    handledToggleTokenRef.current = playerToggleRequestToken;
    void handleTransportToggle();
  }, [playerToggleRequestToken]); // Token-based: only fires when a new toggle is requested

  useEffect(() => {
    if (playerCloseRequestToken === handledCloseTokenRef.current) return;
    handledCloseTokenRef.current = playerCloseRequestToken;
    pendingPracticeSeekMsRef.current = null;
    practiceSeekTokenRef.current += 1;
    loopSeekLockRef.current = false;
    void cancelScrub();
    void closePlayer();
    useStore.getState().clearPlayerQueue();
  }, [cancelScrub, closePlayer, playerCloseRequestToken]);

  function handleBack() {
    pendingPracticeSeekMsRef.current = null;
    practiceSeekTokenRef.current += 1;
    loopSeekLockRef.current = false;
    void closePlayer();
    useStore.getState().clearPlayerQueue();
    navigation.goBack();
  }

  function handleScrubStateChange(scrubbing: boolean) {
    if (scrubbing) {
      void beginScrub();
      return;
    }
    void endScrub();
  }

  function cancelPendingPracticeSeek() {
    pendingPracticeSeekMsRef.current = null;
    practiceSeekTokenRef.current += 1;
    loopSeekLockRef.current = false;
  }

  async function handleLoopAwareSeek(targetMs: number) {
    const clampedMs = Math.max(0, Math.min(targetMs, displayDuration || targetMs));
    const requestToken = ++practiceSeekTokenRef.current;
    const insideLoop =
      mode === "practice" && practiceLoopEnabled && hasValidPracticeLoop
        ? isWithinPracticeLoop(clampedMs)
        : false;

    manualPracticeJumpRef.current = true;

    if (mode === "practice" && practiceLoopEnabled && hasValidPracticeLoop) {
      setLoopPlaybackEngaged(isPlayerPlaying && insideLoop);
    } else {
      manualPracticeJumpRef.current = false;
      setLoopPlaybackEngaged(false);
    }

    pendingPracticeSeekMsRef.current = clampedMs;
    loopSeekLockRef.current = true;

    if (practiceSeekInFlightRef.current) {
      return;
    }

    practiceSeekInFlightRef.current = true;
    try {
      while (pendingPracticeSeekMsRef.current !== null) {
        const nextTargetMs = pendingPracticeSeekMsRef.current;
        pendingPracticeSeekMsRef.current = null;
        await seekTo(nextTargetMs);
      }
    } finally {
      practiceSeekInFlightRef.current = false;
      setTimeout(() => {
        if (
          practiceSeekTokenRef.current === requestToken &&
          pendingPracticeSeekMsRef.current === null
        ) {
          loopSeekLockRef.current = false;
        }
      }, 80);
    }
  }

  function handlePracticeLoopToggle() {
    setPracticeLoopEnabled((currentValue) => {
      const nextValue = !currentValue;
      manualPracticeJumpRef.current = false;
      if (nextValue) {
        setPracticeLoopRange(buildDefaultLoopRegion(displayDuration, playerPosition));
        setLoopPlaybackEngaged(isPlayerPlaying);
      } else {
        setLoopPlaybackEngaged(false);
      }
      return nextValue;
    });
  }

  async function handleTransportToggle() {
    if (isPlayerPlaying) {
      cancelPendingPracticeSeek();
      await pausePlayer();
      return;
    }
    if (mode === "practice" && practiceLoopEnabled && hasValidPracticeLoop) {
      const shouldResumeFromManualPosition = manualPracticeJumpRef.current;
      setLoopPlaybackEngaged(isWithinPracticeLoop(playerPosition));
      if (!shouldResumeFromManualPosition && Math.abs(playerPosition - practiceLoopRange.start) > 20) {
        await seekTo(practiceLoopRange.start);
        setLoopPlaybackEngaged(true);
      }
      await playPlayer();
      return;
    }
    await playPlayer();
  }

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

    navigation.dispatch(StackActions.push("Home"));
  }

  function handleAddPin(label?: string) {
    if (!playerIdea || !playerClip || !activeWorkspaceId) return;
    const resolvedLabel = (label ?? newPinLabel).trim();

    const newMarker: PracticeMarker = {
      id: `pin-${Date.now()}`,
      label: resolvedLabel,
      atMs: playerPosition,
    };

    useStore.getState().addClipPracticeMarker(playerIdea.id, playerClip.id, newMarker);
    setNewPinLabel("");
    setPinModalVisible(false);
  }

  function handleRepositionMarker(markerId: string, newAtMs: number) {
    if (!playerIdea || !playerClip) return;
    const updated = practiceMarkers.map((m) =>
      m.id === markerId ? { ...m, atMs: Math.round(Math.max(0, Math.min(displayDuration, newAtMs))) } : m
    );
    useStore.getState().setClipPracticeMarkers(playerIdea.id, playerClip.id, updated);
  }

  function handlePinDragStateChange(dragging: boolean) {
    setIsPinDragging(dragging);
    if (dragging) {
      cancelPendingPracticeSeek();
      setLoopPlaybackEngaged(false);
      return;
    }

    if (practiceLoopEnabled && hasValidPracticeLoop && isPlayerPlaying && isWithinPracticeLoop(playerPosition)) {
      manualPracticeJumpRef.current = false;
      setLoopPlaybackEngaged(true);
      return;
    }

    setLoopPlaybackEngaged(false);
  }

  function handlePinActions(marker: PracticeMarker) {
    setPinActionsTarget(marker);
    setPinRenameValue(marker.label);
    setPinActionsVisible(true);
  }

  function handleRenamePin() {
    if (!playerIdea || !playerClip || !pinActionsTarget) return;
    const label = pinRenameValue.trim();
    if (!label) return;
    const updated = practiceMarkers.map((m) =>
      m.id === pinActionsTarget.id ? { ...m, label } : m
    );
    useStore.getState().setClipPracticeMarkers(playerIdea.id, playerClip.id, updated);
    setPinActionsVisible(false);
    setPinActionsTarget(null);
  }

  function handleDeletePin() {
    if (!playerIdea || !playerClip || !pinActionsTarget) return;
    useStore.getState().removeClipPracticeMarker(playerIdea.id, playerClip.id, pinActionsTarget.id);
    setPinActionsVisible(false);
    setPinActionsTarget(null);
  }

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
    <SafeAreaView style={[styles.screen, screenStyles.screen]}>
      <TransportLayout
        scrollable
        header={
          <View style={screenStyles.headerBlock}>
            <View style={screenStyles.navRow}>
              <Pressable style={({ pressed }) => [styles.backBtn, pressed ? styles.pressDown : null]} onPress={handleBack}>
                <Text style={styles.backBtnText}>Back</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  screenStyles.overflowButton,
                  pressed ? screenStyles.overflowButtonPressed : null,
                ]}
                onPress={handleOverflowMenu}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color="#111827" />
              </Pressable>
            </View>

            <View style={screenStyles.titleBlock}>
              <Text style={screenStyles.title}>{playerClip.title}</Text>
              <View style={screenStyles.metaRow}>
                {playerIdea.kind === "project" ? (
                  <>
                    <Text style={screenStyles.metaText}>{playerIdea.title}</Text>
                    <Text style={screenStyles.metaDot}>•</Text>
                  </>
                ) : null}
                <Text style={screenStyles.metaText}>{formatDate(playerClip.createdAt)}</Text>
                <View style={screenStyles.metaSpacer} />
                <Text style={screenStyles.timingText}>
                  {fmtDuration(playerPosition)} / {fmtDuration(displayDuration)}
                </Text>
              </View>
            </View>

            <SegmentedControl
              options={[
                { key: "player", label: "Player" },
                { key: "practice", label: "Practice" },
              ]}
              value={mode}
              onChange={setMode}
            />
          </View>
        }
        footer={
          <PlayerTransportDock
            isPlaying={isPlayerPlaying}
            canGoPrevious={hasPreviousTrack}
            canGoNext={hasNextTrack}
            onPrevious={() => useStore.getState().advancePlayerQueue("previous", true)}
            onTogglePlay={() => {
              void handleTransportToggle();
            }}
            onNext={() => useStore.getState().advancePlayerQueue("next", true)}
            trailingIcon={mode === "practice" ? "repeat" : queueEntries.length > 1 ? "list-outline" : undefined}
            trailingActive={mode === "practice" ? practiceLoopEnabled : queueExpanded}
            trailingDisabled={mode === "practice" ? false : queueEntries.length <= 1}
            onTrailingPress={
              mode === "practice"
                ? handlePracticeLoopToggle
                : queueEntries.length > 1
                  ? () => setQueueExpanded((value) => !value)
                  : undefined
            }
            speedBadge={mode === "practice" && Math.abs(playbackSpeed - 1) > 0.001 ? `${playbackSpeed}x` : undefined}
          />
        }
      >
        <View style={screenStyles.content}>
          <View style={screenStyles.waveformSection}>
            <PlayerControls
              playerPosition={playerPosition}
              playerDuration={displayDuration}
              waveformPeaks={waveformPeaks}
              isPlayerPlaying={isPlayerPlaying}
              isScrubbing={transportScrub.isScrubbing}
              chrome="light"
              showTransportControls={false}
              showExpandToggle={false}
              showZoomControls={mode === "practice"}
              showTimingRow={false}
              defaultExpanded={false}
              surfaceRadius={26}
              timelineHorizontalPadding={10}
              collapsedHeightOverride={168}
              showMinimapMode={mode === "practice" ? "auto" : "never"}
              selectedRanges={mode === "practice" && practiceLoopEnabled ? practiceLoopSelection : undefined}
              renderOverlay={
                mode === "practice"
                  ? ({ pixelsPerMs, timelineTranslateX, timelineScale, sharedAudioProgress }) => (
                      <View style={{ flex: 1, position: "relative" }}>
                        {practiceLoopEnabled ? (
                          <MultiTimeRangeSelector
                            durationMs={displayDuration}
                            pixelsPerMs={pixelsPerMs}
                            regions={practiceLoopSelection}
                            onRegionChange={(_, start, end) => setPracticeLoopRange({ start, end })}
                            sharedTranslateX={timelineTranslateX}
                            sharedScale={timelineScale}
                            sharedAudioProgress={sharedAudioProgress}
                            onScrubStateChange={handleScrubStateChange}
                            onSeek={(timeMs) => void handleLoopAwareSeek(timeMs)}
                          />
                        ) : null}
                        <DragIndicatorLine draggingMarkerId={draggingMarkerId} draggingMarkerX={draggingMarkerX} />
                      </View>
                    )
                  : undefined
              }
              renderBelowOverlay={
                mode === "practice"
                  ? ({ pixelsPerMs, timelineTranslateX, timelineScale }) => (
                      <PracticePinBadges
                        markers={practiceMarkers}
                        pixelsPerMs={pixelsPerMs}
                        timelineTranslateX={timelineTranslateX}
                        timelineScale={timelineScale}
                        durationMs={displayDuration}
                        onSeek={(t) => void handleLoopAwareSeek(t)}
                        onRepositionMarker={handleRepositionMarker}
                        onRequestActions={handlePinActions}
                        onRequestAdd={() => handleAddPin("")}
                        onDragStateChange={handlePinDragStateChange}
                        draggingMarkerId={draggingMarkerId}
                        draggingMarkerX={draggingMarkerX}
                      />
                    )
                  : undefined
              }
              onSeekTo={handleLoopAwareSeek}
              onTogglePlay={() => {
                void handleTransportToggle();
              }}
              onScrubStateChange={handleScrubStateChange}
            />
          </View>

          {mode === "practice" ? (
            <View style={screenStyles.practiceContent}>
              <View style={screenStyles.practiceCard}>
                {/* Loop */}
                <View style={screenStyles.practiceRow}>
                  <Text style={screenStyles.practiceLabel}>Loop</Text>
                  <View style={screenStyles.practiceValueRow}>
                    {practiceLoopEnabled ? (
                      <>
                        <Text style={screenStyles.loopRangeText}>{practiceRangeLabel}</Text>
                        <Pressable
                          style={({ pressed }) => [
                            screenStyles.resetButton,
                            pressed ? { opacity: 0.7 } : null,
                          ]}
                          onPress={() => {
                            setPracticeLoopRange(buildDefaultLoopRegion(displayDuration, playerPosition));
                            setLoopPlaybackEngaged(isPlayerPlaying);
                          }}
                          hitSlop={6}
                        >
                          <Ionicons name="refresh" size={14} color="#6b7280" />
                        </Pressable>
                      </>
                    ) : null}
                    <Pressable
                      style={[
                        screenStyles.toggleShell,
                        practiceLoopEnabled ? screenStyles.toggleShellActive : null,
                      ]}
                      onPress={handlePracticeLoopToggle}
                    >
                      <View style={[screenStyles.toggleKnob, practiceLoopEnabled ? screenStyles.toggleKnobActive : null]} />
                    </Pressable>
                  </View>
                </View>

                <View style={screenStyles.divider} />

                {/* Speed slider + ticks */}
                <View style={screenStyles.practiceRowVertical}>
                  <View style={screenStyles.speedBlock}>
                    <Text style={screenStyles.practiceLabel}>Speed</Text>
                    <Slider
                      style={screenStyles.speedSlider}
                      minimumValue={0.5}
                      maximumValue={2}
                      step={0.05}
                      value={playbackSpeed}
                      onValueChange={handleSpeedSliding}
                      onSlidingStart={handleSpeedSlideStart}
                      onSlidingComplete={handleSpeedSlideEnd}
                      minimumTrackTintColor="#3b82f6"
                      maximumTrackTintColor="#d1d5db"
                      thumbTintColor="#ffffff"
                    />
                  </View>
                  <View style={screenStyles.speedTicks}>
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((tick) => {
                      const isActive = Math.abs(playbackSpeed - tick) < 0.01;
                      return (
                        <TouchableOpacity
                          key={tick}
                          onPress={() => handleSpeedTap(tick)}
                          hitSlop={4}
                        >
                          <Text
                            style={[
                              screenStyles.speedTickText,
                              isActive && screenStyles.speedTickTextActive,
                            ]}
                          >
                            {tick}x
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={screenStyles.divider} />

                {/* Count-in */}
                <View style={screenStyles.practiceRow}>
                  <Text style={screenStyles.practiceLabel}>Count-in</Text>
                  <View style={screenStyles.optionGroup}>
                    {([
                      { key: "off" as const, label: "Off" },
                      { key: "1b" as const, label: "1b" },
                      { key: "2b" as const, label: "2b" },
                    ] as const).map((option) => {
                      const active = countInOption === option.key;
                      return (
                        <Pressable
                          key={option.key}
                          style={[screenStyles.optionChip, active ? screenStyles.optionChipActive : null]}
                          onPress={() => setCountInOption(option.key)}
                        >
                          <Text style={[screenStyles.optionChipText, active ? screenStyles.optionChipTextActive : null]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={screenStyles.divider} />

                {/* Notes (inline row) */}
                <Pressable style={screenStyles.practiceRow} onPress={() => {/* TODO: open notes sheet */}}>
                  <Text style={screenStyles.practiceLabel}>Notes</Text>
                  <Text style={screenStyles.notesInlineText} numberOfLines={1}>
                    {clipNotes.trim() || "Add notes..."}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={screenStyles.supportStack}>
              {hasProjectLyrics && latestLyricsVersion ? (
                <PlayerLyricsPanel
                  text={latestLyricsText}
                  versionLabel={`Version ${playerIdea.lyrics?.versions.length ?? 1}`}
                  updatedAtLabel={formatDate(latestLyricsVersion.updatedAt)}
                  autoscrollState={lyricsAutoscrollState}
                  defaultExpanded={false}
                  expanded={lyricsExpanded}
                  onToggleExpanded={setLyricsExpanded}
                />
              ) : null}

              <PlayerSupportPanel
                title="Clip notes"
                meta={clipNotes.trim() ? "Attached to this take" : "No notes saved"}
                summary={clipNotesSummary}
                expanded={notesExpanded}
                onToggleExpanded={setNotesExpanded}
              >
                <Text style={[screenStyles.notesText, !clipNotes.trim() ? screenStyles.notesPlaceholder : null]}>
                  {clipNotes.trim() || "This clip does not have notes yet."}
                </Text>
              </PlayerSupportPanel>

              {queueEntries.length > 1 ? (
                <PlayerSupportPanel
                  title="Queue"
                  meta={`${queueEntries.length} clips`}
                  summary={`${queueEntries.length} clips lined up for playback.`}
                  expanded={queueExpanded}
                  onToggleExpanded={setQueueExpanded}
                >
                  <PlayerQueue
                    entries={queueEntries}
                    currentClipId={playerClip.id}
                    compact={hasProjectLyrics}
                    onSelect={(index) => {
                      useStore.getState().setPlayerQueue(playerQueue, index, true);
                    }}
                  />
                </PlayerSupportPanel>
              ) : null}
            </View>
          )}
        </View>
      </TransportLayout>

      <BottomSheet
        visible={pinModalVisible}
        onClose={() => { setPinModalVisible(false); setNewPinLabel(""); }}
        dismissDistance={360}
        keyboardAvoiding
      >
        <View style={screenStyles.pinSheetContent}>
          <Text style={screenStyles.pinSheetTitle}>Add Practice Pin</Text>
          <Text style={screenStyles.pinSheetTime}>
            at {fmtDuration(playerPosition)}
          </Text>

          <TextInput
            style={screenStyles.pinSheetInput}
            placeholder="e.g., Chorus, Bridge, Solo"
            placeholderTextColor="#94a3b8"
            value={newPinLabel}
            onChangeText={setNewPinLabel}
            onSubmitEditing={() => handleAddPin(newPinLabel)}
            returnKeyType="done"
            autoFocus
          />

          <View style={screenStyles.pinSheetFooter}>
            <Pressable
              style={({ pressed }) => [screenStyles.pinSheetButton, screenStyles.pinSheetButtonSecondary, pressed ? { opacity: 0.7 } : null]}
              onPress={() => { setPinModalVisible(false); setNewPinLabel(""); }}
            >
              <Text style={[screenStyles.pinSheetButtonText, screenStyles.pinSheetButtonSecondaryText]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                screenStyles.pinSheetButton,
                !newPinLabel.trim() ? screenStyles.pinSheetButtonDisabled : null,
                pressed ? { opacity: 0.7 } : null,
              ]}
              onPress={() => handleAddPin(newPinLabel)}
              disabled={!newPinLabel.trim()}
            >
              <Text style={[screenStyles.pinSheetButtonText, !newPinLabel.trim() ? screenStyles.pinSheetButtonTextDisabled : null]}>
                Save Pin
              </Text>
            </Pressable>
          </View>
        </View>
      </BottomSheet>

      <BottomSheet
        visible={pinActionsVisible}
        onClose={() => { setPinActionsVisible(false); setPinActionsTarget(null); }}
        keyboardAvoiding
      >
        <View style={screenStyles.pinSheetContent}>
          <Text style={screenStyles.pinSheetTitle}>
            {pinActionsTarget?.label ?? "Pin"}
          </Text>
          <Text style={screenStyles.pinSheetTime}>
            at {pinActionsTarget ? fmtDuration(pinActionsTarget.atMs) : ""}
          </Text>

          <TextInput
            style={screenStyles.pinSheetInput}
            placeholder="Rename pin"
            placeholderTextColor="#94a3b8"
            value={pinRenameValue}
            onChangeText={setPinRenameValue}
            onSubmitEditing={handleRenamePin}
            returnKeyType="done"
            autoFocus
          />

          <View style={screenStyles.pinSheetFooter}>
            <Pressable
              style={({ pressed }) => [screenStyles.pinSheetButton, screenStyles.pinSheetButtonDanger, pressed ? { opacity: 0.7 } : null]}
              onPress={handleDeletePin}
            >
              <Ionicons name="trash-outline" size={15} color="#ffffff" style={{ marginRight: 4 }} />
              <Text style={screenStyles.pinSheetButtonText}>Delete</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                screenStyles.pinSheetButton,
                !pinRenameValue.trim() ? screenStyles.pinSheetButtonDisabled : null,
                pressed ? { opacity: 0.7 } : null,
              ]}
              onPress={handleRenamePin}
              disabled={!pinRenameValue.trim()}
            >
              <Text style={[screenStyles.pinSheetButtonText, !pinRenameValue.trim() ? screenStyles.pinSheetButtonTextDisabled : null]}>
                Save
              </Text>
            </Pressable>
          </View>
        </View>
      </BottomSheet>

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}

const screenStyles = StyleSheet.create({
  screen: {
    backgroundColor: "#f8f8f7",
  },
  headerBlock: {
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 4,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  overflowButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e1e4ea",
    backgroundColor: "#f8f8f7",
  },
  overflowButtonPressed: {
    opacity: 0.8,
  },
  breadcrumbs: {
    marginTop: 0,
  },
  titleBlock: {
    gap: 4,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
    color: "#05070b",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  metaText: {
    fontSize: 12,
    lineHeight: 16,
    color: "#6b7280",
  },
  metaDot: {
    fontSize: 12,
    lineHeight: 16,
    color: "#9ca3af",
  },
  metaSpacer: {
    flexGrow: 1,
  },
  timingText: {
    fontSize: 12,
    lineHeight: 16,
    color: "#111827",
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 10,
  },
  waveformSection: {
    gap: 6,
  },
  supportStack: {
    gap: 8,
    flexShrink: 1,
  },
  practiceContent: {
    gap: 8,
    flexShrink: 1,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#1f2937",
  },
  notesPlaceholder: {
    color: "#8a93a1",
  },
  practiceCard: {
    backgroundColor: "#f6f7f9",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e3e6eb",
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  practiceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    minHeight: 44,
  },
  practiceLabel: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "600",
    color: "#111827",
  },
  practiceValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  resetButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eceef2",
  },
  practiceRowVertical: {
    paddingVertical: 8,
    gap: 2,
  },
  speedBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  speedSlider: {
    flex: 1,
    height: 28,
  },
  speedTicks: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  speedTickText: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "500",
    fontVariant: ["tabular-nums"] as any,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  speedTickTextActive: {
    color: "#3b82f6",
    fontWeight: "700",
  },
  loopRangeText: {
    fontSize: 13,
    color: "#6b7280",
    fontVariant: ["tabular-nums"] as any,
  },
  notesInlineText: {
    fontSize: 14,
    color: "#9ca3af",
    flex: 1,
    textAlign: "right",
  },
  toggleShell: {
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#e5e7eb",
    padding: 3,
    justifyContent: "center",
  },
  toggleShellActive: {
    backgroundColor: "#dbeafe",
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    shadowColor: "#64748b",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  toggleKnobActive: {
    transform: [{ translateX: 22 }],
  },
  valuePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "#eceef2",
  },
  valuePillText: {
    fontSize: 14,
    lineHeight: 18,
    color: "#111827",
    fontVariant: ["tabular-nums"],
  },
  divider: {
    height: 1,
    backgroundColor: "#e5e7eb",
  },
  optionGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  optionChip: {
    minWidth: 60,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#eceef2",
  },
  optionChipActive: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d8dde6",
    shadowColor: "#94a3b8",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  optionChipText: {
    fontSize: 14,
    lineHeight: 16,
    color: "#374151",
    fontWeight: "600",
  },
  optionChipTextActive: {
    color: "#111827",
  },
  pinSheetContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 16,
  },
  pinSheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  pinSheetTime: {
    fontSize: 13,
    color: "#ca8a04",
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    marginTop: -8,
  },
  pinSheetInput: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    fontSize: 15,
    color: "#111827",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  pinSheetFooter: {
    flexDirection: "row",
    gap: 10,
  },
  pinSheetButton: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#ca8a04",
  },
  pinSheetButtonSecondary: {
    backgroundColor: "#f3f4f6",
  },
  pinSheetButtonDanger: {
    backgroundColor: "#dc2626",
    flexDirection: "row",
    justifyContent: "center",
  },
  pinSheetButtonDisabled: {
    backgroundColor: "#e5e7eb",
  },
  pinSheetButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  pinSheetButtonSecondaryText: {
    color: "#374151",
  },
  pinSheetButtonTextDisabled: {
    color: "#9ca3af",
  },
});
