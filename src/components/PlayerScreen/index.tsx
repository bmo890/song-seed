import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Dimensions, Platform, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Gesture } from "react-native-gesture-handler";
import { Easing, runOnJS, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
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
import { HelpSheet } from "../common/HelpSheet";
import { OVERDUB_HELP, PRACTICE_HELP } from "../common/helpContent";
import { PlayAlongLyrics, PlayAlongSpeedControl } from "./components/PlayAlongLyrics";
import { PlayerPinSheets } from "./components/PlayerPinSheets";
import { playerScreenStyles } from "./styles";
import { getVisibleTimelineRange } from "./helpers";
import { openIdeaInCollection } from "../../navigation";
import { AppAlert } from "../common/AppAlert";
import { getClipOverdubStemCount } from "../../domain/clipPresentation";
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
  // When the latest lyric version has chords, give the panel the structured
  // lines so it renders a chord chart (chords above lyrics) while playing.
  const lyricsChordLines = useMemo(() => {
    const lines = data.latestLyricsVersion?.document.lines ?? [];
    return lines.some((line) => line.chords.length > 0) ? lines : undefined;
  }, [data.latestLyricsVersion]);
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
  const overdubLayerLanes = useMemo(
    () =>
      data.overdubStemEntries.map((stem) => ({
        id: stem.id,
        title: stem.title,
        offsetMs: stem.offsetMs,
        durationMs: stem.durationMs,
        color: stem.color,
        isMuted: stem.isMuted,
      })),
    [data.overdubStemEntries]
  );
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
  const handleRequestAddPin = useCallback(() => {
    handleAddPin("");
  }, [handleAddPin]);
  const handleAddOverdub = useCallback(async () => {
    if (!playerIdea || !playerClip) return;
    // First overdub layer is free; stacking more is Pro. Existing multi-layer clips stay
    // fully playable/editable — only ADDING a new layer past the free one is gated.
    if (!canAddOverdubLayer(getClipOverdubStemCount(playerClip), hasProAccess("overdub-layers"))) {
      openProUpsell("overdub-layers");
      return;
    }
    try {
      // Record the layer from where the player sits: scrubbed to the chorus = punch in
      // at the chorus (bar-snapped in the action). At the top = classic full layer.
      await appActions.startClipOverdubRecording(playerIdea.id, playerClip.id, {
        punchInMs: playerPositionMsRef.current,
      });
      navigation.navigate("Recording" as never);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("player.layerStartFailed");
      AppAlert.info(t("player.layerUnavailable"), message);
    }
  }, [navigation, playerClip, playerIdea]);
  const handleRecordLayerAt = useCallback(
    async (atMs: number) => {
      if (!playerIdea || !playerClip) return;
      if (!canAddOverdubLayer(getClipOverdubStemCount(playerClip), hasProAccess("overdub-layers"))) {
        openProUpsell("overdub-layers");
        return;
      }
      try {
        // Punch in at a section start or pin (bar-snapped in the action).
        await appActions.startClipOverdubRecording(playerIdea.id, playerClip.id, {
          punchInMs: atMs,
        });
        navigation.navigate("Recording" as never);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t("player.layerStartFailed");
        AppAlert.info(t("player.layerUnavailable"), message);
      }
    },
    [navigation, playerClip, playerIdea]
  );
  // Practice tools are Pro (per-tool configurable via PRACTICE_TOOL_IS_PRO — flip one entry
  // to make that tool free, no call-site change). Returns true if the tap may proceed;
  // otherwise opens the upsell. Opening practice mode and viewing existing pins/sections/
  // analysis stays FREE — only USING a gated tool is gated.
  const guardPracticeTool = useCallback((tool: PracticeTool): boolean => {
    if (isPracticeToolPro(tool) && !ensurePro("practice-suite")) return false;
    return true;
  }, []);
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
      toggleRootLowCut: wrap(appActions.toggleClipOverdubRootLowCut, t("player.rootToneFailed")),
      adjustStemGain: wrap(appActions.adjustClipOverdubStemGain, t("player.layerGainFailed")),
      nudgeStem: wrap(appActions.nudgeClipOverdubStem, t("player.layerTimingFailed")),
      toggleStemMute: wrap(appActions.toggleClipOverdubStemMute, t("player.layerMuteFailed")),
      toggleStemLowCut: wrap(appActions.toggleClipOverdubStemLowCut, t("player.layerToneFailed")),
      removeStem: wrap(appActions.removeClipOverdubStem, t("player.removeLayerFailed")),
    };
  }, [playerClip, playerIdea, t]);
  const {
    renameStem: handleRenameStem,
    changeStemColor: handleChangeStemColor,
    adjustRootGain: handleAdjustRootGain,
    toggleRootLowCut: handleToggleRootLowCut,
    adjustStemGain: handleAdjustStemGain,
    nudgeStem: handleNudgeStem,
    toggleStemMute: handleToggleStemMute,
    toggleStemLowCut: handleToggleStemLowCut,
    removeStem: handleRemoveStem,
  } = layerHandlers;

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
        scrollable={ui.mode !== "playalong"}
        header={
          <PlayerHeaderSection
            clipTitle={playerClip.title}
            projectTitle={playerIdea.kind === "project" ? playerIdea.title : null}
            createdAt={playerClip.createdAt}
            overdubLayerCount={data.clipOverdubStemCount}
            playerPosition={effectivePlayerPosition}
            displayDuration={effectivePlayerDuration}
            mode={ui.mode}
            dragGesture={dismissGesture}
            onMinimize={lifecycle.minimizePlayer}
            onOverflow={lifecycle.handleOverflowMenu}
          />
        }
        stickyTop={
          <View style={playerScreenStyles.stickyReel}>
            {/* When the page header is collapsed (practice / play-along) it no longer
                shows the timing, so surface a compact playhead / length row above the reel. */}
            {ui.mode !== "player" ? (
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
                  overdubLayerLanes={overdubLayerLanes}
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
                  accessibilityLabel={ui.reelExpanded ? t("player.shrinkWaveform") : t("player.expandWaveform")}
                >
                  <Ionicons
                    name={ui.reelExpanded ? "contract-outline" : "expand-outline"}
                    size={15}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </View>
            </View>

            {/* Reel stays pinned above the scrollable tools. In play-along the row
                becomes a label + Done; otherwise it carries markers / Play along / Tools. */}
            <View style={playerScreenStyles.reelToolbar}>
              {ui.mode === "playalong" ? (
                <>
                  <View style={playerScreenStyles.reelExpandButton}>
                    <Ionicons name="musical-notes" size={14} color={colors.primary} />
                    <Text style={playerScreenStyles.reelExpandText}>{t("player.playAlong")}</Text>
                  </View>
                  <PlayAlongSpeedControl
                    speed={playbackSpeed}
                    presets={PRACTICE_SPEED_PRESETS}
                    min={PRACTICE_SPEED_MIN}
                    max={PRACTICE_SPEED_MAX}
                    onSelect={(value) => {
                      if (guardPracticeTool("speed")) handleSpeedTap(value);
                    }}
                  />
                  <Pressable
                    style={({ pressed }) => [
                      playerScreenStyles.toolsPill,
                      playerScreenStyles.toolsPillActive,
                      pressed ? playerScreenStyles.overflowButtonPressed : null,
                    ]}
                    onPress={() => ui.setMode("player")}
                    accessibilityRole="button"
                    accessibilityLabel={t("player.exitPlayAlong")}
                  >
                    <Ionicons name="checkmark" size={15} color={colors.onPrimary} />
                    <Text style={[playerScreenStyles.toolsPillText, playerScreenStyles.toolsPillTextActive]}>
                      {t("common.done")}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    style={({ pressed }) => [
                      playerScreenStyles.reelExpandButton,
                      pressed ? playerScreenStyles.overflowButtonPressed : null,
                    ]}
                    onPress={() => ui.setMarkersVisible((value) => !value)}
                    accessibilityRole="button"
                    accessibilityState={{ checked: ui.markersVisible }}
                    accessibilityLabel={ui.markersVisible ? t("player.hideMarkers") : t("player.showMarkers")}
                  >
                    <Ionicons
                      name={ui.markersVisible ? "eye-outline" : "eye-off-outline"}
                      size={14}
                      color={colors.textSecondary}
                    />
                    <Text style={playerScreenStyles.reelExpandText}>
                      {ui.markersVisible ? t("player.hideMarkers") : t("player.showMarkers")}
                    </Text>
                  </Pressable>
                  <View style={playerScreenStyles.reelToolbarRight}>
                    {data.hasProjectLyrics && ui.mode === "player" ? (
                      <Pressable
                        style={({ pressed }) => [
                          playerScreenStyles.toolsPill,
                          pressed ? playerScreenStyles.overflowButtonPressed : null,
                        ]}
                        onPress={() => ui.setMode("playalong")}
                        accessibilityRole="button"
                        accessibilityLabel={t("player.playAlongLyrics")}
                      >
                        <Ionicons name="musical-notes-outline" size={15} color={colors.textSecondary} />
                        <Text style={playerScreenStyles.toolsPillText}>{t("player.playAlong")}</Text>
                      </Pressable>
                    ) : null}
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
                        color={ui.mode === "practice" ? colors.onPrimary : colors.textSecondary}
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
          <PlayerFooterSection
            mode={ui.mode}
            playDisabled={false}
            isPlaying={effectiveIsPlaying}
            hasPreviousTrack={hasPreviousTrack}
            hasNextTrack={hasNextTrack}
            repeatEnabled={ui.repeatEnabled}
            queueExpanded={ui.queueExpanded}
            onPreviousTrack={lifecycle.handlePreviousTrack}
            onTogglePlay={lifecycle.handleTogglePlayPress}
            onNextTrack={lifecycle.handleNextTrack}
            onToggleRepeat={() => ui.setRepeatEnabled((value) => !value)}
            onToggleQueueExpanded={() => ui.setQueueExpanded((value) => !value)}
            onClose={lifecycle.stopSessionAndClose}
          />
        }
      >
        <View style={ui.mode === "playalong" ? playerScreenStyles.playAlongContent : playerScreenStyles.content}>
          {ui.mode === "playalong" ? (
            <PlayAlongLyrics
              text={data.latestLyricsText}
              chordLines={lyricsChordLines}
              positionMs={effectivePlayerPosition}
              durationMs={effectivePlayerDuration}
              isPlaying={effectiveIsPlaying}
              playbackRate={effectivePlaybackRate}
            />
          ) : ui.mode === "practice" ? (
            <PlayerPracticePanel
              expandedTool={ui.expandedTool}
              onToggleTool={ui.toggleTool}
              onClose={ui.closeTool}
              analysis={data.analysis}
              isAnalyzing={clipAnalysis.isAnalyzing}
              analysisError={clipAnalysis.error}
              onDetectAnalysis={() => {
                if (guardPracticeTool("analysis")) clipAnalysis.runAnalysis();
              }}
              practiceLoopEnabled={practiceLoopEnabled}
              practiceRangeLabel={practiceRangeLabel}
              onSeekLoopStart={() => handleLoopAwareSeek(practiceLoopRange.start)}
              onMoveLoopToPlayhead={movePracticeLoopToPlayhead}
              onLoopSection={(section) => {
                if (guardPracticeTool("loop")) handleLoopSection(section);
              }}
              onTogglePracticeLoop={() => {
                if (guardPracticeTool("loop")) handlePracticeLoopToggle();
              }}
              practiceMarkers={data.practiceMarkers}
              playheadMs={effectivePlayerPosition}
              onAddPin={() => {
                if (guardPracticeTool("pins")) handleRequestAddPin();
              }}
              onSeekPin={handleLoopAwareSeek}
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
              onSeekSection={handleLoopAwareSeek}
              onToggleSectionEdit={sectionsApi.handleToggleEdit}
              onEditSection={sectionsApi.handleEditSection}
              onRepositionSectionEdge={sectionsApi.handleRepositionSectionEdge}
              onSectionPreview={setSectionPreview}
              onDeleteSection={sectionsApi.handleDeleteSection}
              playbackSpeed={playbackSpeed}
              speedPresets={PRACTICE_SPEED_PRESETS}
              speedMin={PRACTICE_SPEED_MIN}
              speedMax={PRACTICE_SPEED_MAX}
              onSpeedTap={(value) => {
                if (guardPracticeTool("speed")) handleSpeedTap(value);
              }}
              onSpeedSlideStart={() => {
                if (guardPracticeTool("speed")) handleSpeedSlideStart();
              }}
              onSpeedSliding={(value) => {
                if (guardPracticeTool("speed")) handleSpeedSliding(value);
              }}
              onSpeedSlideEnd={(value) => {
                if (guardPracticeTool("speed")) handleSpeedSlideEnd(value);
              }}
              pitchShiftSemitones={ui.pitchShiftSemitones}
              supportsPitchShift={practicePitchTransport.isPitchShiftAvailable}
              onAdjustPitchShift={(value) => {
                if (guardPracticeTool("pitch")) ui.setPitchShiftSemitones(value);
              }}
              countInOption={ui.countInOption}
              onSelectCountIn={ui.setCountInOption}
              onRecordOverdub={handleAddOverdub}
              onRecordLayerAt={handleRecordLayerAt}
            />
          ) : (
            <PlayerSupportSections
              hasProjectLyrics={data.hasProjectLyrics}
              latestLyricsText={data.latestLyricsText}
              lyricsChordLines={lyricsChordLines}
              lyricsVersionCount={playerIdea.lyrics?.versions.length ?? 1}
              latestLyricsUpdatedAt={data.latestLyricsVersion?.updatedAt ?? null}
              lyricsExpanded={ui.lyricsExpanded}
              hasClipOverdubs={data.hasClipOverdubs}
              clipOverdubStemCount={data.clipOverdubStemCount}
              isOverdubPreviewRendering={isMixUpdating}
              isMainPlaybackPlaying={effectiveIsPlaying}
              overdubRootSettings={data.overdubRootSettings}
              overdubStemEntries={data.overdubStemEntries}
              overdubRootAudioUri={playerClip.audioUri ?? null}
              overdubRootDurationMs={playerClip.durationMs ?? 0}
              overdubRootWaveformPeaks={playerClip.waveformPeaks}
              overdubRootRecordingGrid={playerClip.recordingGrid ?? null}
              onAddOverdub={handleAddOverdub}
              onSaveAsOneClip={handleSaveAsOneClip}
              onPauseMainPlayback={practicePitchTransport.pause}
              onAdjustRootGain={handleAdjustRootGain}
              onToggleRootLowCut={handleToggleRootLowCut}
              onAdjustStemGain={handleAdjustStemGain}
              onNudgeStem={handleNudgeStem}
              onRenameStem={handleRenameStem}
              onChangeStemColor={handleChangeStemColor}
              onToggleStemMute={handleToggleStemMute}
              onToggleStemLowCut={handleToggleStemLowCut}
              onRemoveStem={handleRemoveStem}
              clipNotes={data.clipNotes}
              clipNotesSummary={data.clipNotesSummary}
              notesExpanded={ui.notesExpanded}
              queueEntries={data.queueEntries}
              queueExpanded={ui.queueExpanded}
              onToggleLyricsExpanded={ui.setLyricsExpanded}
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
