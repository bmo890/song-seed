import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Dimensions, Platform, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Gesture } from "react-native-gesture-handler";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import type { ClipSection, PracticeMarker } from "../../types";
import { styles } from "../../styles";
import { colors } from "../../design/tokens";
import { useFullPlayerContext } from "../../hooks/FullPlayerProvider";
import { fmtDuration, formatClipDate } from "../../utils";
import { TransportLayout } from "../common/TransportLayout";
import { useTransportScrubbing } from "../../hooks/useTransportScrubbing";
import { usePlayerTransportClock } from "./hooks/usePlayerTransportClock";
import { usePlaybackClick } from "../../hooks/usePlaybackClick";
import { resolvePreviousAction } from "../../domain/transportPrevious";
import { usePracticeLoopController } from "./hooks/usePracticeLoopController";
import { usePlayerSpeedControls } from "./hooks/usePlayerSpeedControls";
import { useStepUpLoop } from "./hooks/useStepUpLoop";
import { clickRateBounds } from "../../domain/stepUpLoop";
import { haptic } from "../../design/haptics";
import { toast } from "../common/toastStore";
import { usePlayerPins } from "./hooks/usePlayerPins";
import { usePlayerSections } from "./hooks/usePlayerSections";
import { useUndoHistory } from "../common/useUndoHistory";
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
import { PlayerPracticeDrawers } from "./components/PlayerPracticeDrawers";
import { PlayerSupportSections } from "./components/PlayerSupportSections";
import { PlayerLayersBench, BENCH_ROOT_LANE_ID } from "./components/PlayerLayersBench";
import { HelpSheet } from "../common/HelpSheet";
import { OVERDUB_HELP, PRACTICE_HELP } from "../common/helpContent";
import { PlayerArtifactReader, PlayAlongSpeedControl } from "./components/PlayerArtifactReader";
import { chartSummary, lyricChordSummary } from "./components/PlayerArtifactDoors";
import { PlayerPinSheets } from "./components/PlayerPinSheets";
import { PlayerShelf } from "./components/PlayerShelf";
import { PlayerLyricsWriter } from "./components/PlayerLyricsWriter";
import { playerScreenStyles } from "./styles";
import { getVisibleTimelineRange } from "./helpers";
import { openIdeaInCollection } from "../../navigation";
import { AppAlert } from "../common/AppAlert";
import { getClipOverdubStemCount } from "../../domain/clipPresentation";
import { snapToGrid } from "../../domain/gridRuler";
import { canAddOverdubLayer, isPracticeToolPro, type PracticeTool } from "../../domain/proGating";
import { hasProAccess } from "../../domain/entitlements";
import { ensurePro, openProUpsell } from "../common/proUpsell";
import { useTranslation } from "react-i18next";

const PRACTICE_SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5] as const;
const PRACTICE_SPEED_MIN = 0.5;
const PRACTICE_SPEED_MAX = 1.5;

// Stable empty arrays so hiding reel markers doesn't churn the memoized timeline.
const EMPTY_MARKERS: PracticeMarker[] = [];
const EMPTY_SECTIONS: ClipSection[] = [];

// Release past a quarter of the way down (px) collapses the sheet; a deliberate
// fast flick (px/s) collapses it from anywhere.
const SHEET_DISMISS_DISTANCE = Dimensions.get("window").height * 0.25;
const SHEET_DISMISS_VELOCITY = 1200;

/** Full view's stand-in for the reel: a hairline thread above the transport
 *  carrying playback position, driven off the transport clock's shared values
 *  so it rides the UI thread like the tape does. */
function ProgressThread({
  sharedCurrentTimeMs,
  sharedDurationMs,
}: {
  sharedCurrentTimeMs: SharedValue<number>;
  sharedDurationMs: SharedValue<number>;
}) {
  const fillStyle = useAnimatedStyle(() => {
    const duration = sharedDurationMs.value;
    const pct = duration > 0 ? Math.min(100, (sharedCurrentTimeMs.value / duration) * 100) : 0;
    return { width: `${pct}%` };
  });
  return (
    <View style={playerScreenStyles.progressThreadTrack} pointerEvents="none">
      <Animated.View style={[playerScreenStyles.progressThreadFill, fillStyle]} />
    </View>
  );
}

/** Minimal navigation surface the player needs, provided by PlayerSheet: the
 *  player is a root-level sheet (not a route), so "goBack" means "collapse the
 *  sheet" and "navigate" reaches the root navigator for Editor/Recording/etc. */
export type PlayerSheetNavigation = {
  goBack: () => void;
  canGoBack: () => boolean;
  navigate: (routeName: string, params?: object) => void;
};

export function PlayerScreen({
  navigation,
  isActive,
  dragY,
  sheetInMotion,
}: {
  navigation: PlayerSheetNavigation;
  isActive: boolean;
  /** Sheet vertical offset owned by PlayerSheet (0 = open). The header drag
   *  gesture writes to it so the whole sheet tracks the thumb. */
  dragY: SharedValue<number>;
  /** True while the sheet's open/close animation runs — freezes this subtree. */
  sheetInMotion: boolean;
}) {
  const { t } = useTranslation();
  const isFocused = isActive;

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
  const [helpTopic, setHelpTopic] = useState<"practice" | "overdub" | null>(null);

  const fullPlayer = useFullPlayerContext();
  const {
    playerTarget: activePlayerTarget,
    playerPosition,
    positionChannel,
    playerDuration,
    playbackRate,
    isPlayerPlaying,
    finishedPlaybackToken,
    finishedPlaybackClipId,
    engineOpNonce,
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
    isPlaying: isPlayerPlaying,
  });
  const playerIdea = data.playerIdea;
  const playerClip = data.playerClip;
  const resolvedDisplayDuration = data.displayDuration;
  const isMixUpdating = data.isOverdubPreviewRendering;
  // The Sound drawer's click summary — the take's whole grid, tempo changes included.
  const clickDetail = useMemo(() => {
    const grid = playerClip?.recordingGrid;
    if (!grid) return null;
    const segments = grid.tempoMap?.segments;
    if (segments && segments.length > 1) {
      const first = segments[0];
      const last = segments[segments.length - 1];
      return `${Math.round(first.bpm)} · ${first.meterId} → ${Math.round(last.bpm)} · ${last.meterId}`;
    }
    return `${Math.round(grid.bpm)} bpm · ${grid.meterId}`;
  }, [playerClip?.recordingGrid]);
  // When the latest lyric version has chords, give the panel the structured
  // lines so it renders a chord chart (chords above lyrics) while playing.
  const lyricsChordLines = useMemo(() => {
    const lines = data.latestLyricsVersion?.document.lines ?? [];
    return lines.some((line) => line.chords.length > 0) ? lines : undefined;
  }, [data.latestLyricsVersion]);
  // ---- Reading ladder (settled 2026-08-06) ----
  // reading = an artifact holds the page (slim reel); fullView = the reel leaves
  // and a hairline thread above the transport carries position instead.
  const isReading = ui.mode === "player" && ui.readingArtifact !== null;
  const isWriting = isReading && ui.readingArtifact === "lyrics" && ui.lyricsWriting;
  const isFullView = isReading && !isWriting && ui.readingAltitude === "full";
  const chordSheet = playerIdea?.kind === "project" ? playerIdea.chordSheet ?? null : null;
  const hasChart = useMemo(
    () =>
      !!chordSheet &&
      chordSheet.sections.some((section) =>
        section.kind === "text" ? !!section.text?.trim() : section.measures.length > 0
      ),
    [chordSheet]
  );
  const lyricsPreviewLine = useMemo(() => {
    const firstLine = data.latestLyricsText
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0);
    return firstLine ?? "";
  }, [data.latestLyricsText]);
  const doorChordSummary = useMemo(() => lyricChordSummary(lyricsChordLines), [lyricsChordLines]);
  const chartHandle = useMemo(
    () => chartSummary(chordSheet, (count) => t("player.chartBars", { count })),
    [chordSheet, t]
  );
  // Whispered version meta — "v1 · Jul 25", never a second-precision timestamp.
  const lyricsMeta = useMemo(() => {
    const updatedAt = data.latestLyricsVersion?.updatedAt;
    if (!updatedAt) return null;
    const version = playerIdea?.lyrics?.versions.length ?? 1;
    return `v${version} · ${formatClipDate(updatedAt)}`;
  }, [data.latestLyricsVersion?.updatedAt, playerIdea?.lyrics?.versions.length]);
  // Marker visibility only matters when the clip has marks to show or hide.
  const hasMarks = data.practiceMarkers.length > 0 || data.sections.length > 0;
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
  // Slim lanes under the reel marking where each un-flattened layer sits on the master.
  // In layers mode the lanes fatten into the bench's selector, and the base take joins
  // them as a selectable lane of its own (fewer controls — it IS the timeline).
  const overdubLayerLanes = useMemo(() => {
    const stemLanes = data.overdubStemEntries.map((stem) => ({
      id: stem.id,
      title: stem.title,
      offsetMs: stem.offsetMs,
      durationMs: stem.durationMs,
      color: stem.color,
      isMuted: stem.isMuted,
    }));
    if (ui.mode !== "layers") {
      return stemLanes;
    }
    return [
      {
        id: BENCH_ROOT_LANE_ID,
        title: t("player.baseTake"),
        offsetMs: 0,
        durationMs: playerClip?.durationMs ?? 0,
        color: colors.textMuted,
        isMuted: false,
        fixed: true,
      },
      ...stemLanes,
    ];
  }, [data.overdubStemEntries, ui.mode, playerClip?.durationMs, t]);
  // The bench serves whatever lane is selected; if that layer vanishes (removed,
  // flattened) fall back to the first layer, then the base take.
  const benchSelectedLaneId =
    ui.benchLayerId === BENCH_ROOT_LANE_ID ||
    data.overdubStemEntries.some((stem) => stem.id === ui.benchLayerId)
      ? ui.benchLayerId
      : data.overdubStemEntries[0]?.id ?? BENCH_ROOT_LANE_ID;
  const openLayersBench = useCallback(() => {
    ui.setBenchLayerId(data.overdubStemEntries[0]?.id ?? BENCH_ROOT_LANE_ID);
    ui.setMode("layers");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.overdubStemEntries, ui.setBenchLayerId, ui.setMode]);
  // A flatten-replace (or removing the last layer) dissolves the bench's subject.
  useEffect(() => {
    if (ui.mode === "layers" && !data.hasClipOverdubs) {
      ui.setMode("player");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.mode, data.hasClipOverdubs, ui.setMode]);
  // While bench audio is sounding, the compact timing row reads the bench's clock
  // (second granularity — same commit cadence as the main transport's readout).
  const [benchDisplayMs, setBenchDisplayMs] = useState<number | null>(null);
  const handleBenchDisplayPosition = useCallback((ms: number | null) => {
    setBenchDisplayMs((previous) => {
      if (ms == null) {
        return previous == null ? previous : null;
      }
      if (previous != null && Math.floor(previous / 1000) === Math.floor(ms / 1000)) {
        return previous;
      }
      return ms;
    });
  }, []);
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
  // Stale-position invariant: until the engine's loaded target matches the on-screen
  // clip (the source swap hasn't completed — or failed silently), whatever position the
  // full player reports belongs to the PREVIOUS clip. Show the new clip at 0:00 rather
  // than adopting it. Practice mode is exempt: it owns its own native transport whose
  // position is per-clip by construction.
  const engineMatchesScreenClip = activePlayerTarget?.clipId === playerClip?.id;
  const effectivePlayerPosition =
    practicePitchTransport.isOwningNativeTransport || engineMatchesScreenClip
      ? practicePitchTransport.effectivePositionMs
      : 0;
  // Ref mirror of the scrub position so callbacks (record-a-layer punch-in) can read it
  // at call time without re-creating on every playback tick.
  const playerPositionMsRef = React.useRef(0);
  playerPositionMsRef.current = effectivePlayerPosition;
  const effectivePlayerDuration =
    practicePitchTransport.effectiveDurationMs || resolvedDisplayDuration;
  const effectivePlaybackRate = practicePitchTransport.effectivePlaybackRate;
  const effectiveIsPlaying = practicePitchTransport.effectiveIsPlaying;
  // The take's own beat grid, clicking along with playback (and counting in). Reads
  // the position lazily at sync moments — never re-renders on the transport clock.
  const playbackClick = usePlaybackClick({
    grid: playerClip?.recordingGrid ?? null,
    isPlaying: effectiveIsPlaying,
    playbackRate: effectivePlaybackRate,
    getPositionMs: () => playerPositionMsRef.current,
  });
  const playbackClickLevel = useStore((s) => s.playbackClickLevel);
  const setPlaybackClickLevel = useStore((s) => s.setPlaybackClickLevel);
  // The reel takes position straight off the engine, with no render in between — a React
  // commit landing mid-animation is what pulled its overlays off the tape. The channel is
  // only allowed to drive when the full player genuinely owns the transport AND the engine
  // is loaded with the clip on screen; otherwise position still arrives as a prop, which is
  // what keeps the stale-position invariant above honest.
  const channelDriven =
    engineMatchesScreenClip && !practicePitchTransport.isOwningNativeTransport;
  const transportClock = usePlayerTransportClock({
    positionMs: effectivePlayerPosition,
    durationMs: effectivePlayerDuration,
    isPlaying: effectiveIsPlaying,
    playbackRate: effectivePlaybackRate,
    resetKey: playerClip?.id ?? null,
    resetPositionMs: 0,
    positionChannel,
    channelDriven,
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
  // The loop wrap has to be timed against a position that is actually current. The
  // channel carries the engine's own ticks (~20Hz) with no render in between, where
  // the `playerPosition` prop only commits at ~5Hz by design.
  const freshPositionMsRef = useRef<number | null>(null);
  useEffect(() => {
    if (!channelDriven) {
      freshPositionMsRef.current = null;
      return;
    }
    return positionChannel.subscribe((report) => {
      freshPositionMsRef.current = report.positionMs;
    });
  }, [channelDriven, positionChannel]);
  const getFreshPositionMs = useCallback(() => freshPositionMsRef.current, []);
  // The step-up hook needs the controller's loop state, and the controller needs the
  // step-up pass counter — the cycle callback goes through a ref to break the tie.
  const stepUpLoopCycleRef = useRef<() => void>(() => {});
  const handleStepUpLoopCycle = useCallback(() => stepUpLoopCycleRef.current(), []);
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
    loopSurfaceActive: ui.mode === "practice" || isWriting,
    durationMs: effectivePlayerDuration,
    playerPosition: effectivePlayerPosition,
    isPlayerPlaying: effectiveIsPlaying,
    playbackRate: effectivePlaybackRate,
    isScrubbing: transportScrub.isScrubbing,
    seekTo: practicePitchTransport.seekTo,
    playPlayer: practicePitchTransport.play,
    pausePlayer: practicePitchTransport.pause,
    onDisplaySeek: transportClock.setDisplayPositionMs,
    getFreshPositionMs,
    onLoopCycle: handleStepUpLoopCycle,
    visibleWindowStartMs: visiblePracticeRange.start,
    visibleWindowEndMs: visiblePracticeRange.end,
  });
  // Step up: the loop's speed ladder. While the click is sounding, its supported
  // range fences the climb so the ladder can't carry the click into silence.
  const stepUpClickBounds = useMemo(
    () =>
      playbackClick.enabled && playbackClick.isAvailable
        ? clickRateBounds(playerClip?.recordingGrid ?? null)
        : null,
    [playbackClick.enabled, playbackClick.isAvailable, playerClip?.recordingGrid]
  );
  const stepUpSpeedBounds = useMemo(
    () => ({ minRate: PRACTICE_SPEED_MIN, maxRate: PRACTICE_SPEED_MAX }),
    []
  );
  // A finished drill stops the transport: the plan had a defined end, and looping on
  // at full speed reads as the tool having forgotten it was counting. The toast says
  // why the music stopped — silence alone would look like a fault.
  const handleStepUpComplete = useCallback(() => {
    void practicePitchTransport.pause();
    // Haptics: `success` — a completion the user waited for, always paired with a toast.
    haptic.success();
    toast(t("player.stepUpFinished"), "checkmark-circle-outline");
  }, [practicePitchTransport, t]);
  const stepUp = useStepUpLoop({
    clipId: playerClip?.id,
    isPracticeLoopActive: ui.mode === "practice" && practiceLoopEnabled,
    speedBounds: stepUpSpeedBounds,
    clickBounds: stepUpClickBounds,
    setPlaybackRate: practicePitchTransport.setPlaybackRate,
    onDrillComplete: handleStepUpComplete,
  });
  stepUpLoopCycleRef.current = stepUp.handleLoopCycle;
  const handleTransportToggleWithDisplaySync = useCallback(async () => {
    const loopControllerWillSeek =
      (ui.mode === "practice" || isWriting) && practiceLoopEnabled && hasValidPracticeLoop;
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
    isWriting,
    practiceLoopEnabled,
    practicePitchTransport.isOwningNativeTransport,
    transportClock,
    ui.mode,
  ]);
  // Undo/redo over the marks edited in the Tools drawer (sections + pins share
  // one history — an undo steps back whichever changed last). Snapshots are the
  // STORE's own values, never the lyrics-derived fallback markers or the
  // normalized view, so a restore writes back exactly what was there before.
  const marksSnapshot = useMemo(
    () => ({
      sections: playerClip?.sections ?? [],
      markers: playerClip?.practiceMarkers ?? [],
    }),
    [playerClip?.sections, playerClip?.practiceMarkers]
  );
  const marksSnapshotRef = useRef(marksSnapshot);
  marksSnapshotRef.current = marksSnapshot;
  const restoreMarks = useCallback(
    (value: { sections: ClipSection[]; markers: PracticeMarker[] }) => {
      if (!playerIdea?.id || !playerClip?.id) return;
      const state = useStore.getState();
      state.setClipSections(playerIdea.id, playerClip.id, value.sections);
      state.setClipPracticeMarkers(playerIdea.id, playerClip.id, value.markers);
    },
    [playerIdea?.id, playerClip?.id]
  );
  const marksHistory = useUndoHistory(marksSnapshot, restoreMarks);
  const recordMarksChange = useCallback(
    () => marksHistory.record(marksSnapshotRef.current),
    [marksHistory.record] // eslint-disable-line react-hooks/exhaustive-deps
  );
  // A different clip is a different history.
  const clearMarksHistory = marksHistory.clear;
  useEffect(() => {
    clearMarksHistory();
  }, [clearMarksHistory, playerClip?.id]);
  // Reading follows the SKETCH's artifacts: switching takes within one sketch
  // keeps the page open (same words), but landing on a different idea closes it —
  // otherwise a loose clip inherits the previous clip's empty reading surface.
  const closeReading = ui.closeReading;
  const readingIdeaRef = useRef<string | null>(null);
  useEffect(() => {
    const ideaId = playerIdea?.id ?? null;
    if (readingIdeaRef.current !== null && readingIdeaRef.current !== ideaId) {
      closeReading();
    }
    readingIdeaRef.current = ideaId;
  }, [closeReading, playerIdea?.id]);

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
    onBeforeChange: recordMarksChange,
  });
  const sectionsApi = usePlayerSections({
    playerIdeaId: playerIdea?.id,
    playerClipId: playerClip?.id,
    sections: data.sections,
    displayDuration: effectivePlayerDuration,
    playerPosition: effectivePlayerPosition,
    onBeforeChange: recordMarksChange,
  });
  const clipAnalysis = useClipAnalysis({
    playerIdeaId: playerIdea?.id,
    playerClipId: playerClip?.id,
    audioUri: data.playbackAudioUri,
    durationMs: effectivePlayerDuration,
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
    engineOpNonce,
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
    // Defer a frame so the overflow AppDialog Modal finishes dismissing before the
    // HelpSheet Modal presents — avoids the iOS present-while-dismissing race that
    // can swallow the first tap.
    onShowHelp: (topic) => requestAnimationFrame(() => setHelpTopic(topic)),
  });

  // Count-in intercepts only a play START; pausing (and tapping during the count-in
  // itself) never counts. Falls through to a plain toggle whenever it can't run.
  const handleTogglePlayWithCountIn = useCallback(() => {
    if (playbackClick.isCountingIn) {
      playbackClick.cancelCountIn();
      return;
    }
    // "3s" is a run-up of the SONG itself: back the playhead up three seconds and
    // play, so the musician hears where they are — the count-in a gridless take
    // deserves, and the one that works for punching into a loop.
    if (ui.countInOption === "3s" && !effectiveIsPlaying) {
      void (async () => {
        await handleLoopAwareSeek(Math.max(0, effectivePlayerPosition - 3000));
        lifecycle.handleTogglePlayPress();
      })();
      return;
    }
    const bars = ui.countInOption === "1b" ? 1 : ui.countInOption === "2b" ? 2 : 0;
    if (effectiveIsPlaying || bars <= 0) {
      lifecycle.handleTogglePlayPress();
      return;
    }
    void playbackClick
      .playWithCountIn(bars, () => lifecycle.handleTogglePlayPress())
      .then((ran) => {
        if (!ran) {
          lifecycle.handleTogglePlayPress();
        }
      });
  }, [
    effectiveIsPlaying,
    effectivePlayerPosition,
    handleLoopAwareSeek,
    lifecycle,
    playbackClick,
    ui.countInOption,
  ]);

  // Committed position jumps re-phase the click immediately (drift checks are the
  // backstop, not the mechanism).
  const handleSeekWithClick = useCallback(
    async (timeMs: number) => {
      await handleLoopAwareSeek(timeMs);
      playbackClick.notifySeek(timeMs);
    },
    [handleLoopAwareSeek, playbackClick]
  );

  // As a sheet (not a route) there's nothing for the system back to pop —
  // intercept Android hardware/gesture back and collapse instead.
  const minimizePlayerRef = React.useRef(lifecycle.minimizePlayer);
  minimizePlayerRef.current = lifecycle.minimizePlayer;
  useEffect(() => {
    if (Platform.OS !== "android" || !isActive) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      minimizePlayerRef.current();
      return true;
    });
    return () => subscription.remove();
  }, [isActive]);

  // Prev restarts the take before it leaves it — the convention every player people
  // already know uses, and until now only the lock screen had it. Seeking through
  // handleSeekWithClick keeps the playback click in step with the jump.
  const handlePreviousPress = useCallback(() => {
    const action = resolvePreviousAction({
      positionMs: playerPositionMsRef.current,
      hasPreviousItem: hasPreviousTrack,
    });
    if (action === "restart") {
      void handleSeekWithClick(0);
      return;
    }
    lifecycle.handlePreviousTrack();
  }, [handleSeekWithClick, hasPreviousTrack, lifecycle]);

  // Stable JS entry point for the gesture worklet (reads the live ref at call time).
  const runMinimize = useCallback(() => minimizePlayerRef.current(), []);

  // While the sheet is in motion the player's React subtree is FROZEN (see the
  // cached-element return below): the audio status hook re-renders this screen
  // at 20Hz during playback, and those commits visibly step/stutter against the
  // smooth UI-thread translate. Freezing drops commits to zero for the duration
  // of the gesture; shared-value-driven visuals (the reel) keep animating.
  const [sheetDragActive, setSheetDragActive] = useState(false);
  const dismissedInGesture = useSharedValue(false);
  const frozenTreeRef = useRef<React.ReactElement | null>(null);
  const cachedClipIdRef = useRef<string | null>(null);

  // Header drag-to-dismiss: the whole sheet tracks the thumb via dragY. Released
  // past a distance/velocity threshold it hands off to minimizePlayer (which
  // animates the rest of the way + applies the audition rule); otherwise it
  // springs back to fully open. Vertical + downward only, so it never contests
  // horizontal scrub or upward flicks.
  const dismissGesture = useRef(
    Gesture.Pan()
      .activeOffsetY(12)
      .failOffsetY(-12)
      .onStart(() => {
        "worklet";
        dismissedInGesture.value = false;
        runOnJS(setSheetDragActive)(true);
      })
      .onUpdate((event) => {
        "worklet";
        dragY.value = Math.max(0, event.translationY);
      })
      .onEnd((event) => {
        "worklet";
        if (event.translationY > SHEET_DISMISS_DISTANCE || event.velocityY > SHEET_DISMISS_VELOCITY) {
          // Stay frozen through the exit animation — the sheet unmounts anyway.
          dismissedInGesture.value = true;
          runOnJS(runMinimize)();
        }
      })
      .onFinalize(() => {
        "worklet";
        if (dismissedInGesture.value) {
          // The collapse animation (goBack → inMotion) owns the freeze from here.
          // Clear the drag flag NOW: the sheet stays mounted while docked, so a
          // lingering true would freeze the player forever (stale pause icon…).
          runOnJS(setSheetDragActive)(false);
          return;
        }
        // Plain decelerating slide back to open — no spring overshoot, which
        // read as an unstable bounce. Stay frozen until it lands so the return
        // animation doesn't stutter against playback commits.
        dragY.value = withTiming(
          0,
          { duration: 220, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(setSheetDragActive)(false);
          }
        );
      })
  ).current;

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
  const handleRequestAddPin = useCallback(() => handleAddPin(""), [handleAddPin]);
  const handleAddOverdub = useCallback(async (punchInMs: number) => {
    if (!playerIdea || !playerClip) return;
    // First overdub layer is free; stacking more is Pro. Existing multi-layer clips stay
    // fully playable/editable — only ADDING a new layer past the free one is gated.
    if (!canAddOverdubLayer(getClipOverdubStemCount(playerClip), hasProAccess("overdub-layers"))) {
      openProUpsell("overdub-layers");
      return;
    }
    try {
      // Punch in at the time the button showed. Scrubbed to the chorus = punch in
      // at the chorus (bar-snapped in the action); at the top = classic full layer.
      await appActions.startClipOverdubRecording(playerIdea.id, playerClip.id, {
        punchInMs,
      });
      navigation.navigate("Recording" as never);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("player.layerStartFailed");
      AppAlert.info(t("player.layerUnavailable"), message);
    }
  }, [navigation, playerClip, playerIdea]);
  // Practice tools are Pro (per-tool configurable via PRACTICE_TOOL_IS_PRO — flip one entry
  // to make that tool free, no call-site change). Returns true if the tap may proceed;
  // otherwise opens the upsell. Opening practice mode and viewing existing pins/sections/
  // analysis stays FREE — only USING a gated tool is gated.
  const guardPracticeTool = useCallback((tool: PracticeTool): boolean => {
    if (isPracticeToolPro(tool) && !ensurePro("practice-suite")) return false;
    return true;
  }, []);
  // Writing bar: quick loop scopes without opening Tools — the sections the take
  // already has, or the whole take. Fine-tuning stays on the reel's own handles.
  const handleLoopScopePick = useCallback(() => {
    if (!guardPracticeTool("loop")) return;
    AppAlert.custom(t("player.loopWhat"), "", [
      ...data.sections.slice(0, 5).map((section) => ({
        label: section.label,
        onPress: () => handleLoopSection(section),
      })),
      {
        label: t("player.wholeTake"),
        onPress: () => {
          setPracticeLoopRange({ start: 0, end: effectivePlayerDuration });
          if (!practiceLoopEnabled) handlePracticeLoopToggle();
        },
      },
      { label: t("common.cancel"), style: "cancel" as const },
    ]);
  }, [
    data.sections,
    effectivePlayerDuration,
    guardPracticeTool,
    handleLoopSection,
    handlePracticeLoopToggle,
    practiceLoopEnabled,
    setPracticeLoopRange,
    t,
  ]);
  // The new-version escape while writing: fork the words, or start clean.
  const handleNewLyricVersionWhileWriting = useCallback(() => {
    if (!playerIdea) return;
    AppAlert.custom(t("player.newVersionTitle"), t("player.newVersionBody"), [
      {
        label: t("player.newVersionFromCurrent"),
        onPress: () =>
          appActions.saveProjectLyricsAsNewVersion(playerIdea.id, data.latestLyricsText),
      },
      {
        label: t("player.newVersionBlank"),
        onPress: () => appActions.saveProjectLyricsAsNewVersion(playerIdea.id, ""),
      },
      { label: t("common.cancel"), style: "cancel" as const },
    ]);
  }, [data.latestLyricsText, playerIdea, t]);
  const handleSaveAsOneClip = useCallback(
    async (mode: "copy" | "replace") => {
      if (!playerIdea || !playerClip) return;
      if (effectiveIsPlaying) {
        await practicePitchTransport.pause();
      }
      try {
        await appActions.saveCombinedClipAsNewClip(playerIdea.id, playerClip.id, {
          removeOriginalAfterExport: mode === "replace",
        });
        if (navigation.canGoBack()) {
          navigation.goBack();
          return;
        }
        AppAlert.info(
          t("player.savedOne"),
          mode === "replace"
            ? t("player.flattenedTake")
            : t("player.flattenedCopy")
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : t("player.flattenFailed");
        AppAlert.info(t("player.saveFailed"), message);
      }
    },
    [effectiveIsPlaying, navigation, playerClip, playerIdea, practicePitchTransport]
  );
  // Every layer-mix control shares one shape: guard on a loaded clip, fire the action
  // with (ideaId, clipId, ...args), and surface failures as a "Layer update failed"
  // alert — preferring the action's own error message over the control-specific fallback.
  const layerHandlers = useMemo(() => {
    const wrap =
      <A extends unknown[]>(
        action: (ideaId: string, clipId: string, ...args: A) => Promise<unknown>,
        fallbackMessage: string
      ) =>
      (...args: A) => {
        if (!playerIdea || !playerClip) return;
        void action(playerIdea.id, playerClip.id, ...args).catch((error) => {
          const message = error instanceof Error ? error.message : fallbackMessage;
          AppAlert.info(t("player.layerUpdateFailed"), message);
        });
      };
    return {
      renameStem: wrap(appActions.renameClipOverdubStem, t("player.renameLayerFailed")),
      changeStemColor: wrap(appActions.setClipOverdubStemColor, t("player.layerColorFailed")),
      adjustRootGain: wrap(appActions.adjustClipOverdubRootGain, t("player.rootGainFailed")),
      toggleRootToneFlag: wrap(appActions.toggleClipOverdubRootToneFlag, t("player.rootToneFailed")),
      adjustStemGain: wrap(appActions.adjustClipOverdubStemGain, t("player.layerGainFailed")),
      nudgeStem: wrap(appActions.nudgeClipOverdubStem, t("player.layerTimingFailed")),
      toggleStemMute: wrap(appActions.toggleClipOverdubStemMute, t("player.layerMuteFailed")),
      toggleStemToneFlag: wrap(appActions.toggleClipOverdubStemToneFlag, t("player.layerToneFailed")),
      removeStem: wrap(appActions.removeClipOverdubStem, t("player.removeLayerFailed")),
    };
  }, [playerClip, playerIdea, t]);
  const {
    renameStem: handleRenameStem,
    changeStemColor: handleChangeStemColor,
    adjustRootGain: handleAdjustRootGain,
    toggleRootToneFlag: handleToggleRootToneFlag,
    adjustStemGain: handleAdjustStemGain,
    nudgeStem: handleNudgeStem,
    toggleStemMute: handleToggleStemMute,
    toggleStemToneFlag: handleToggleStemToneFlag,
    removeStem: handleRemoveStem,
  } = layerHandlers;

  // Coarse layer placement from the reel (bench phase 3): the selected lane's drag
  // commits here. The snap tolerance is zoom-aware — ~10px of screen either way — but
  // never more than half a beat, so zoomed-out drags still land on the nearest beat
  // without swallowing deliberate off-grid placements at high zoom.
  const [laneDragResetToken, setLaneDragResetToken] = useState(0);
  const handleLaneDragEnd = useCallback(
    (stemId: string, deltaMs: number, msPerPx: number) => {
      const stem = data.overdubStemEntries.find((entry) => entry.id === stemId);
      if (stem && Math.abs(deltaMs) >= 1) {
        const grid = playerClip?.recordingGrid ?? null;
        const targetMs = stem.offsetMs + deltaMs;
        const beatMs = grid && grid.bpm > 0 ? 60000 / grid.bpm : null;
        const pxToleranceMs = Math.max(60, 10 * msPerPx);
        const toleranceMs = beatMs ? Math.min(pxToleranceMs, beatMs * 0.45) : pxToleranceMs;
        const snappedMs = snapToGrid({ grid, ms: targetMs, toleranceMs, unit: "beat" });
        if (snappedMs != null && Math.abs(snappedMs - targetMs) > 1) {
          // Detent tick (haptics vocabulary: tap) — the layer settled onto a beat line.
          haptic.tap();
        }
        const finalDeltaMs = Math.round(snappedMs ?? targetMs) - stem.offsetMs;
        if (finalDeltaMs !== 0) {
          handleNudgeStem(stemId, finalDeltaMs);
        }
      }
      // Always reset the preview — even a no-op commit must let the bar spring home.
      setLaneDragResetToken((token) => token + 1);
    },
    [data.overdubStemEntries, playerClip?.recordingGrid, handleNudgeStem]
  );

  if (!playerIdea || !playerClip) {
    // The clip can vanish mid-collapse (an audition ends → queue clears while the
    // sheet is still sliding off). Keep showing the last good frame instead of
    // flashing "Loading" as it exits; fall back to the loader only on a genuine
    // cold open with nothing cached yet.
    if (frozenTreeRef.current) return frozenTreeRef.current;
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.subtitle}>{t("player.loading")}</Text>
      </SafeAreaView>
    );
  }

  const practiceRangeLabel =
    practiceLoopRange.end > practiceLoopRange.start
      ? `${fmtDuration(practiceLoopRange.start)} → ${fmtDuration(practiceLoopRange.end)}`
      : t("player.noLoop");
  // NOTE: the transport is deliberately NOT locked while a layer mix re-renders. The
  // previous rendered mix stays loaded and playable; when the new render publishes, the
  // lifecycle's source-sync hot-swaps it at the current position. Locking here made every
  // 25ms nudge freeze playback for the length of a full-clip render.

  const renderedTree = (
    <SafeAreaView style={[styles.screen, playerScreenStyles.screen]}>
      <TransportLayout
        scrollable={!isReading}
        header={
          <PlayerHeaderSection
            clipTitle={playerClip.title}
            projectTitle={playerIdea.kind === "project" ? playerIdea.title : null}
            createdAt={playerClip.createdAt}
            overdubLayerCount={data.clipOverdubStemCount}
            playerPosition={effectivePlayerPosition}
            displayDuration={effectivePlayerDuration}
            collapsed={ui.mode !== "player" || isReading}
            dragGesture={dismissGesture}
            onMinimize={lifecycle.minimizePlayer}
            onOverflow={lifecycle.handleOverflowMenu}
          />
        }
        stickyTop={
          <View style={playerScreenStyles.stickyReel}>
            {/* When the page header is collapsed (practice / reading) it no longer
                shows the timing, so surface a compact playhead / length row above the reel. */}
            {ui.mode !== "player" || isReading ? (
              <View style={playerScreenStyles.reelTimingRow}>
                <Text style={playerScreenStyles.reelTimingText}>
                  {fmtDuration(
                    ui.mode === "layers" && benchDisplayMs != null
                      ? benchDisplayMs
                      : effectivePlayerPosition
                  )}{" "}
                  / {fmtDuration(effectivePlayerDuration)}
                </Text>
              </View>
            ) : null}
            {!isFullView ? (
            <View style={playerScreenStyles.waveformSection}>
              <View style={playerScreenStyles.waveformShell}>
                <PlayerTimeline
                  mode={ui.mode}
                  readingSlim={isReading}
                  reelExpanded={ui.reelExpanded}
                  waveformPeaks={data.waveformPeaks}
                  waveformPending={data.waveformPending}
                  waveformAnalyzing={lifecycle.isAnalyzingWaveform}
                  waveformResolving={data.waveformResolving}
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
                  recordingGrid={playerClip.recordingGrid ?? null}
                  loopActive={practiceLoopEnabled && (ui.mode === "practice" || isWriting)}
                  overdubLayerLanes={overdubLayerLanes}
                  // The lane IS the bench's door: tap it and the surface opens with
                  // the lanes fattened into the selector.
                  onOpenLayerMixer={
                    ui.mode === "player" && data.hasClipOverdubs ? openLayersBench : undefined
                  }
                  layerMixerAccessibilityLabel={t("player.layers")}
                  selectedLaneId={benchSelectedLaneId}
                  onPressLane={(laneId) => {
                    haptic.tap();
                    ui.setBenchLayerId(laneId);
                  }}
                  onLaneDragEnd={handleLaneDragEnd}
                  laneDragResetToken={laneDragResetToken}
                  draggingMarkerId={draggingMarkerId}
                  draggingMarkerX={draggingMarkerX}
                  onLoopRangeChange={handleLoopRangeChange}
                  onSeek={handleSeekWithClick}
                  onTogglePlay={handleTogglePlayWithCountIn}
                  onScrubStateChange={lifecycle.handleScrubStateChange}
                  onRepositionMarker={handleRepositionMarker}
                  onRequestPinActions={handlePinActions}
                  onRequestAddPin={handleRequestAddPin}
                  onPinDragStateChange={handlePinDragStateChange}
                  practiceZoomMultiple={ui.practiceZoomMultiple}
                  onPracticeZoomMultipleChange={ui.setPracticeZoomMultiple}
                />
                {/* Expand/shrink floats in the reel's top-right corner, out of the
                    toolbar. Hidden while reading — the slim reel has no room for
                    corner chrome, and growth belongs to the artifact then. */}
                {!isReading ? (
                  <Pressable
                    style={({ pressed }) => [
                      playerScreenStyles.reelCornerButton,
                      pressed ? playerScreenStyles.overflowButtonPressed : null,
                    ]}
                    onPress={() => ui.setReelExpanded((value) => !value)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: ui.reelExpanded }}
                    accessibilityLabel={ui.reelExpanded ? t("player.shrinkWaveform") : t("player.expandWaveform")}
                  >
                    <Ionicons
                      name={ui.reelExpanded ? "contract-outline" : "expand-outline"}
                      size={15}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                ) : null}
              </View>
            </View>
            ) : null}

            {/* Reel stays pinned above the scrollable content. While reading, the row
                becomes the artifact's bar: name/close, then follow · speed · Aa · full view. */}
            <View style={playerScreenStyles.reelToolbar}>
              {isReading ? (
                <>
                  <Pressable
                    style={({ pressed }) => [
                      playerScreenStyles.reelExpandButton,
                      pressed ? playerScreenStyles.overflowButtonPressed : null,
                    ]}
                    onPress={isWriting ? ui.stopWriting : ui.closeReading}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t("player.closeReading")}
                  >
                    <Ionicons name="chevron-up" size={14} color={colors.textSecondary} />
                    <Text style={playerScreenStyles.reelExpandText}>
                      {ui.readingArtifact === "chart" ? t("screens.chart") : t("common.lyrics")}
                    </Text>
                  </Pressable>
                  {isWriting ? (
                    <View style={playerScreenStyles.reelToolbarRight}>
                      {/* Loop: the writer's companion — keep a part going while words come. */}
                      <Pressable
                        style={({ pressed }) => [
                          playerScreenStyles.readingChip,
                          practiceLoopEnabled ? playerScreenStyles.readingChipActive : null,
                          pressed ? playerScreenStyles.overflowButtonPressed : null,
                        ]}
                        onPress={() => {
                          if (guardPracticeTool("loop")) handlePracticeLoopToggle();
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: practiceLoopEnabled }}
                        accessibilityLabel={t("player.loop")}
                      >
                        <Ionicons
                          name="repeat"
                          size={14}
                          color={practiceLoopEnabled ? colors.primaryDeep : colors.textSecondary}
                        />
                        <Text
                          style={[
                            playerScreenStyles.readingChipText,
                            practiceLoopEnabled ? playerScreenStyles.readingChipTextActive : null,
                          ]}
                        >
                          {t("player.loop")}
                        </Text>
                      </Pressable>
                      {data.sections.length > 0 ? (
                        <Pressable
                          style={({ pressed }) => [
                            playerScreenStyles.readingIconButton,
                            pressed ? playerScreenStyles.overflowButtonPressed : null,
                          ]}
                          onPress={handleLoopScopePick}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel={t("player.loopWhat")}
                        >
                          <Ionicons name="albums-outline" size={15} color={colors.textSecondary} />
                        </Pressable>
                      ) : null}
                      <Pressable
                        style={({ pressed }) => [
                          playerScreenStyles.readingIconButton,
                          pressed ? playerScreenStyles.overflowButtonPressed : null,
                        ]}
                        onPress={handleNewLyricVersionWhileWriting}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={t("player.newVersionTitle")}
                      >
                        <Ionicons name="duplicate-outline" size={15} color={colors.textSecondary} />
                      </Pressable>
                      {/* Transport lives here while the keyboard buries the footer. */}
                      <Pressable
                        style={({ pressed }) => [
                          playerScreenStyles.readingIconButton,
                          pressed ? playerScreenStyles.overflowButtonPressed : null,
                        ]}
                        onPress={handleTogglePlayWithCountIn}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={effectiveIsPlaying ? t("common.pause") : t("common.play")}
                      >
                        <Ionicons
                          name={effectiveIsPlaying ? "pause" : "play"}
                          size={15}
                          color={colors.primaryDeep}
                        />
                      </Pressable>
                    </View>
                  ) : (
                  <View style={playerScreenStyles.reelToolbarRight}>
                    {/* Follow (the old play-along): only offered where it can act. */}
                    <Pressable
                      style={({ pressed }) => [
                        playerScreenStyles.readingChip,
                        ui.followEnabled ? playerScreenStyles.readingChipActive : null,
                        pressed ? playerScreenStyles.overflowButtonPressed : null,
                      ]}
                      onPress={() => ui.setFollowEnabled(!ui.followEnabled)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: ui.followEnabled }}
                      accessibilityLabel={t("player.playAlongLyrics")}
                    >
                      <Ionicons
                        name={ui.followEnabled ? "musical-notes" : "musical-notes-outline"}
                        size={14}
                        color={ui.followEnabled ? colors.primaryDeep : colors.textSecondary}
                      />
                      <Text
                        style={[
                          playerScreenStyles.readingChipText,
                          ui.followEnabled ? playerScreenStyles.readingChipTextActive : null,
                        ]}
                      >
                        {t("player.playAlong")}
                      </Text>
                    </Pressable>
                    {ui.followEnabled ? (
                      <PlayAlongSpeedControl
                        speed={playbackSpeed}
                        presets={PRACTICE_SPEED_PRESETS}
                        min={PRACTICE_SPEED_MIN}
                        max={PRACTICE_SPEED_MAX}
                        onSelect={(value) => {
                          if (guardPracticeTool("speed")) handleSpeedTap(value);
                        }}
                      />
                    ) : ui.readingArtifact === "lyrics" ? (
                      // Aa cycles the text size — a dial would out-weigh the job.
                      <Pressable
                        style={({ pressed }) => [
                          playerScreenStyles.readingIconButton,
                          pressed ? playerScreenStyles.overflowButtonPressed : null,
                        ]}
                        onPress={() => {
                          haptic.tap();
                          const presets = [1, 1.15, 1.3, 0.9];
                          const index = presets.indexOf(ui.readingZoom);
                          ui.setReadingZoom(presets[(index + 1) % presets.length] ?? 1);
                        }}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={t("player.lyricSize")}
                      >
                        <Ionicons name="text" size={15} color={colors.textSecondary} />
                      </Pressable>
                    ) : null}
                    {playerIdea.kind === "project" && ui.readingArtifact === "lyrics" ? (
                      // Read → notice a line → fix it against the same tape.
                      <Pressable
                        style={({ pressed }) => [
                          playerScreenStyles.readingIconButton,
                          pressed ? playerScreenStyles.overflowButtonPressed : null,
                        ]}
                        onPress={ui.openWriting}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={t("player.editLyrics")}
                      >
                        <Ionicons name="create-outline" size={15} color={colors.textSecondary} />
                      </Pressable>
                    ) : null}
                    <Pressable
                      style={({ pressed }) => [
                        playerScreenStyles.readingIconButton,
                        pressed ? playerScreenStyles.overflowButtonPressed : null,
                      ]}
                      onPress={() =>
                        ui.setReadingAltitude(isFullView ? "reading" : "full")
                      }
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isFullView }}
                      accessibilityLabel={isFullView ? t("player.exitFullView") : t("player.fullView")}
                    >
                      <Ionicons
                        name={isFullView ? "contract-outline" : "expand-outline"}
                        size={15}
                        color={colors.textSecondary}
                      />
                    </Pressable>
                  </View>
                  )}
                </>
              ) : ui.mode === "layers" ? (
                <>
                  {/* Bench bar: name/close leading, then record-a-layer and help. */}
                  <Pressable
                    style={({ pressed }) => [
                      playerScreenStyles.reelExpandButton,
                      pressed ? playerScreenStyles.overflowButtonPressed : null,
                    ]}
                    onPress={() => ui.setMode("player")}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t("player.closeLayers")}
                  >
                    <Ionicons name="chevron-up" size={14} color={colors.textSecondary} />
                    <Text style={playerScreenStyles.reelExpandText}>{t("player.layers")}</Text>
                  </Pressable>
                  <View style={playerScreenStyles.reelToolbarRight}>
                    <Pressable
                      style={({ pressed }) => [
                        playerScreenStyles.bareGlyphButton,
                        pressed ? playerScreenStyles.overflowButtonPressed : null,
                      ]}
                      onPress={() => {
                        ui.setMode("player");
                        void handleAddOverdub(playerPositionMsRef.current);
                      }}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={t("player.recordNewLayer")}
                    >
                      <Ionicons name="add" size={18} color={colors.primaryDeep} />
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        playerScreenStyles.bareGlyphButton,
                        pressed ? playerScreenStyles.overflowButtonPressed : null,
                      ]}
                      onPress={() => setHelpTopic("overdub")}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={t("common.help")}
                    >
                      <Ionicons name="help-circle-outline" size={16} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  {/* The eye only earns a place when the clip has marks to hide;
                      icon-only, so toggling never re-flows the row. The empty
                      stand-in keeps Tools pinned to the trailing edge. */}
                  {!hasMarks ? <View /> : null}
                  {hasMarks ? (
                    <Pressable
                      style={({ pressed }) => [
                        playerScreenStyles.readingIconButton,
                        pressed ? playerScreenStyles.overflowButtonPressed : null,
                      ]}
                      onPress={() => ui.setMarkersVisible((value) => !value)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityState={{ checked: ui.markersVisible }}
                      accessibilityLabel={ui.markersVisible ? t("player.hideMarkers") : t("player.showMarkers")}
                    >
                      <Ionicons
                        name={ui.markersVisible ? "eye-outline" : "eye-off-outline"}
                        size={15}
                        color={colors.textSecondary}
                      />
                    </Pressable>
                  ) : null}
                  <View style={playerScreenStyles.reelToolbarRight}>
                    <Pressable
                      style={({ pressed }) => [
                        playerScreenStyles.toolsPill,
                        ui.mode === "practice" ? playerScreenStyles.toolsPillActive : null,
                        pressed ? playerScreenStyles.overflowButtonPressed : null,
                      ]}
                      onPress={() => ui.setMode(ui.mode === "practice" ? "player" : "practice")}
                      accessibilityRole="button"
                      accessibilityState={{ selected: ui.mode === "practice" }}
                      accessibilityLabel={ui.mode === "practice" ? t("player.closePractice") : t("player.openPractice")}
                    >
                      <Ionicons
                        name="options-outline"
                        size={15}
                        color={ui.mode === "practice" ? colors.primaryDeep : colors.textStrong}
                      />
                      <Text
                        style={[
                          playerScreenStyles.toolsPillText,
                          ui.mode === "practice" ? playerScreenStyles.toolsPillTextActive : null,
                        ]}
                      >
                        {t("player.tools")}
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          </View>
        }
        footer={
          <>
            {isFullView ? (
              <ProgressThread
                sharedCurrentTimeMs={transportClock.sharedCurrentTimeMs}
                sharedDurationMs={transportClock.sharedDurationMs}
              />
            ) : null}
            {/* The shelf anchors the page's bottom in the base listening state —
                doors for what the clip has, nothing when it has nothing. */}
            {ui.mode === "player" && !isReading ? (
              <PlayerShelf
                hasNotes={data.clipNotes.trim().length > 0}
                onOpenNotes={() => ui.setNotesExpanded(true)}
              />
            ) : null}
          <PlayerFooterSection
            mode={ui.mode}
            playDisabled={false}
            isPlaying={effectiveIsPlaying}
            hasPreviousTrack={hasPreviousTrack}
            hasNextTrack={hasNextTrack}
            repeatEnabled={ui.repeatEnabled}
            queueExpanded={ui.queueExpanded}
            onPreviousTrack={handlePreviousPress}
            onTogglePlay={handleTogglePlayWithCountIn}
            onNextTrack={lifecycle.handleNextTrack}
            onToggleRepeat={() => ui.setRepeatEnabled((value) => !value)}
            onToggleQueueExpanded={() => ui.setQueueExpanded((value) => !value)}
            onClose={lifecycle.stopSessionAndClose}
          />
          </>
        }
      >
        <View style={isReading ? playerScreenStyles.playAlongContent : playerScreenStyles.content}>
          {isWriting ? (
            <PlayerLyricsWriter
              // Keyed on the version so a new-version fork reseeds the editor.
              key={data.latestLyricsVersion?.id ?? "unwritten"}
              ideaId={playerIdea.id}
              initialText={data.latestLyricsText}
              textDirection={data.latestLyricsVersion?.textDirection ?? "auto"}
            />
          ) : isReading ? (
            <PlayerArtifactReader
              artifact={ui.readingArtifact!}
              text={data.latestLyricsText}
              chordLines={lyricsChordLines}
              chordSheet={chordSheet}
              zoom={ui.readingZoom}
              followEnabled={ui.followEnabled}
              positionMs={effectivePlayerPosition}
              durationMs={effectivePlayerDuration}
              isPlaying={effectiveIsPlaying}
              playbackRate={effectivePlaybackRate}
            />
          ) : ui.mode === "practice" ? (
            <PlayerPracticeDrawers
              analysis={data.analysis}
              recordingGridBpm={playerClip?.recordingGrid?.bpm ?? null}
              clickDetail={clickDetail}
              isAnalyzing={clipAnalysis.isAnalyzing}
              analysisError={clipAnalysis.error}
              onDetectAnalysis={() => {
                if (guardPracticeTool("analysis")) clipAnalysis.runAnalysis();
              }}
              durationMs={effectivePlayerDuration}
              playheadMs={effectivePlayerPosition}
              onSeek={handleSeekWithClick}
              zoomMultiple={ui.practiceZoomMultiple}
              practiceLoopEnabled={practiceLoopEnabled}
              practiceLoopRange={practiceLoopRange}
              onSetLoopRange={(start, end) => {
                if (guardPracticeTool("loop")) handleLoopRangeChange(start, end);
              }}
              onLoopSection={(section) => {
                if (guardPracticeTool("loop")) handleLoopSection(section);
              }}
              onTogglePracticeLoop={() => {
                if (guardPracticeTool("loop")) handlePracticeLoopToggle();
              }}
              stepUpEnabled={stepUp.stepUpEnabled}
              stepUpProgress={stepUp.stepUpProgress}
              stepUpSequence={stepUp.sequence}
              onChangeStepUpSequence={stepUp.setSequence}
              stepUpRateMin={PRACTICE_SPEED_MIN}
              stepUpRateMax={PRACTICE_SPEED_MAX}
              onToggleStepUp={() => {
                if (guardPracticeTool("loop")) stepUp.toggleStepUp();
              }}
              onRestartStepUp={stepUp.restartStepUp}
              practiceMarkers={data.practiceMarkers}
              canUndoMarks={marksHistory.canUndo}
              canRedoMarks={marksHistory.canRedo}
              onUndoMarks={marksHistory.undo}
              onRedoMarks={marksHistory.redo}
              onAddPin={() => (guardPracticeTool("pins") ? handleRequestAddPin() : null)}
              onRepositionPin={handleRepositionMarker}
              onPinPreview={setPinPreview}
              onEditPin={handleEditPin}
              onDeletePin={handleDeletePinId}
              sections={data.sections}
              onAddSection={sectionsApi.handleAddSection}
              onEditSection={sectionsApi.handleEditSection}
              onRepositionSectionEdge={sectionsApi.handleRepositionSectionEdge}
              onSectionPreview={setSectionPreview}
              onDeleteSection={sectionsApi.handleDeleteSection}
              playbackSpeed={playbackSpeed}
              speedPresets={PRACTICE_SPEED_PRESETS}
              speedMin={PRACTICE_SPEED_MIN}
              speedMax={PRACTICE_SPEED_MAX}
              onSpeedTap={(value) => {
                if (guardPracticeTool("speed")) {
                  // A manual speed change means the player took the wheel back.
                  stepUp.cancelStepUp();
                  handleSpeedTap(value);
                }
              }}
              onSpeedSlideStart={() => {
                if (guardPracticeTool("speed")) handleSpeedSlideStart();
              }}
              onSpeedSliding={(value) => {
                if (guardPracticeTool("speed")) handleSpeedSliding(value);
              }}
              onSpeedSlideEnd={(value) => {
                if (guardPracticeTool("speed")) {
                  stepUp.cancelStepUp();
                  handleSpeedSlideEnd(value);
                }
              }}
              pitchShiftSemitones={ui.pitchShiftSemitones}
              supportsPitchShift={practicePitchTransport.isPitchShiftAvailable}
              onAdjustPitchShift={(value) => {
                if (guardPracticeTool("pitch")) ui.setPitchShiftSemitones(value);
              }}
              countInOption={ui.countInOption}
              clickLevel={playbackClickLevel}
              onSetClickLevel={setPlaybackClickLevel}
              onSelectCountIn={ui.setCountInOption}
              clickAvailable={playbackClick.isAvailable}
              clickEnabled={playbackClick.enabled}
              onSetClickEnabled={playbackClick.setEnabled}
              onRecordOverdub={handleAddOverdub}
            />
          ) : ui.mode === "layers" ? (
            <PlayerLayersBench
              selectedLaneId={benchSelectedLaneId}
              stems={data.overdubStemEntries}
              rootSettings={data.overdubRootSettings}
              rootAudioUri={playerClip.audioUri ?? null}
              rootDurationMs={playerClip.durationMs ?? 0}
              rootWaveformPeaks={playerClip.waveformPeaks}
              rootRecordingGrid={playerClip.recordingGrid ?? null}
              isRendering={isMixUpdating}
              isMainPlaybackPlaying={effectiveIsPlaying}
              transportClock={transportClock}
              getRestingPositionMs={() => playerPositionMsRef.current}
              onDisplayPositionChange={handleBenchDisplayPosition}
              onPauseMainPlayback={practicePitchTransport.pause}
              onAdjustRootGain={handleAdjustRootGain}
              onToggleRootToneFlag={handleToggleRootToneFlag}
              onAdjustStemGain={handleAdjustStemGain}
              onNudgeStem={handleNudgeStem}
              onRenameStem={handleRenameStem}
              onChangeStemColor={handleChangeStemColor}
              onToggleStemMute={handleToggleStemMute}
              onToggleStemToneFlag={handleToggleStemToneFlag}
              onRemoveStem={handleRemoveStem}
              onSaveAsOneClip={handleSaveAsOneClip}
              onCloseBench={() => ui.setMode("player")}
            />
          ) : (
            <PlayerSupportSections
              canAuthor={playerIdea.kind === "project"}
              hasLyrics={data.hasProjectLyrics}
              lyricsPreviewLine={lyricsPreviewLine}
              lyricsChordSummary={doorChordSummary}
              lyricsMeta={lyricsMeta}
              hasChart={hasChart}
              chartHandle={chartHandle}
              onOpenLyrics={() => ui.openReading("lyrics")}
              onOpenChart={() => ui.openReading("chart")}
              // "Write" opens against the tape — the whole point of the door.
              onWriteLyrics={ui.openWriting}
              onBuildChart={() => {
                lifecycle.minimizePlayer();
                navigation.navigate("IdeaDetail", { ideaId: playerIdea.id, initialSongTab: "chart" });
              }}
              clipNotes={data.clipNotes}
              notesExpanded={ui.notesExpanded}
              queueEntries={data.queueEntries}
              queueExpanded={ui.queueExpanded}
              onToggleNotesExpanded={ui.setNotesExpanded}
              onToggleQueueExpanded={ui.setQueueExpanded}
              onQueueOpenIdea={(ideaId) => {
                lifecycle.minimizePlayer();
                // Same "view in collection" jump as the dock queue: land on the
                // clip's home collection with its card highlighted.
                openIdeaInCollection(navigation, ideaId);
              }}
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

      <HelpSheet
        visible={helpTopic !== null}
        onClose={() => setHelpTopic(null)}
        title={(helpTopic === "overdub" ? OVERDUB_HELP : PRACTICE_HELP).title}
        intro={(helpTopic === "overdub" ? OVERDUB_HELP : PRACTICE_HELP).intro}
        items={(helpTopic === "overdub" ? OVERDUB_HELP : PRACTICE_HELP).items}
      />
    </SafeAreaView>
  );

  // Freeze wall: return the exact element from the previous commit so React
  // bails out of reconciling this (huge) subtree. It stays frozen while:
  //   · the sheet is in motion (drag/animation) — so 20Hz playback commits
  //     can't stutter the transform, AND
  //   · the sheet is docked/inactive (pre-mounted below the fold) — so the
  //     off-screen player costs nothing beyond running its hooks.
  // It refreshes (renders live once) when the sheet is the active settled
  // surface, on first render, or when the clip changes — the last keeps the
  // docked snapshot current so expanding never reveals a stale track.
  const settledActive = isActive && !sheetInMotion && !sheetDragActive;
  const clipChanged = cachedClipIdRef.current !== playerClip.id;
  if (settledActive || frozenTreeRef.current == null || clipChanged) {
    frozenTreeRef.current = renderedTree;
    cachedClipIdRef.current = playerClip.id;
  }
  return frozenTreeRef.current;
}
