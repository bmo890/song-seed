import React from "react";
import { SharedValue, useAnimatedStyle, useSharedValue, runOnJS, withSpring } from "react-native-reanimated";
import Animated from "react-native-reanimated";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { AudioReel } from "../../common/AudioReel";
import { openingZoomForDuration } from "../playerZoom";
import { MultiTimeRangeSelector } from "../../common/TimeRangeSelector";
import { OverdubLayerLanes, type OverdubLayerLane } from "../../common/OverdubLayerLanes";
import { PracticePinBadges } from "../PracticePinBadges";
import type { PracticeMarker, ClipSection, RecordingGrid } from "../../../types";
import { buildSectionBands, sectionMoveBounds, sectionPushBounds } from "../../../domain/playerSections";
import { haptic } from "../../../design/haptics";
import { colors } from "../../../design/tokens";
import { useStore } from "../../../state/useStore";
import { laneDensityForHeight, reelHeightForFlow, type ListeningBelow } from "../../../domain/reelLanes";
import { springs } from "../../../design/motion";

type Range = {
  id: string;
  start: number;
  end: number;
  type: "keep" | "remove";
};

/** Height of the tappable rail over each section band — the bottom strip where
 *  the Skia label chip rides. Kept shallow so taps higher on the tape still scrub. */
const SECTION_JUMP_RAIL_HEIGHT = 30;

/** How far a held section must travel before the drag counts as a move. */
const SECTION_MOVE_MIN_MS = 150;

type JumpBand = { id: string; label: string; startMs: number; endMs: number };
type MoveBounds = {
  minStartMs: number;
  maxStartMs: number;
  /** How far the section may be leaned past a neighbour, and which neighbours. */
  pushMinStartMs: number;
  pushMaxStartMs: number;
  prevId: string | null;
  nextId: string | null;
};

/** How far past a neighbour the finger must lean before that neighbour's edge
 *  gives way. Distance, not time, guards against an accidental push. */
const SECTION_PUSH_LEAN_PX = 28;

/** Invisible rails over the section bands. A tap on a section's label strip jumps
 *  the playhead to its start; with `onMove`, holding it and dragging slides the
 *  whole section (its length kept, its neighbours as walls). The visible rule and
 *  name are Skia, glued to the tape; these are hitboxes only, same pattern as the
 *  pin badges. The canvas reads the two shared values to draw the drag. */
function SectionJumpHitboxes({
  bands,
  pixelsPerMs,
  timelineTranslateX,
  timelineScale,
  onSeek,
  moveBounds,
  onMove,
  draggingSectionId,
  draggingSectionDeltaMs,
  pushedSectionId,
  pushedSectionDeltaMs,
}: {
  bands: JumpBand[];
  pixelsPerMs: number;
  timelineTranslateX: SharedValue<number>;
  timelineScale: SharedValue<number>;
  onSeek: (timeMs: number) => void;
  moveBounds?: Map<string, MoveBounds>;
  onMove?: (sectionId: string, startMs: number, push?: boolean) => void;
  draggingSectionId: SharedValue<string>;
  draggingSectionDeltaMs: SharedValue<number>;
  pushedSectionId: SharedValue<string>;
  pushedSectionDeltaMs: SharedValue<number>;
}) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {bands.map((band) => (
        <SectionJumpHitbox
          key={band.id}
          band={band}
          pixelsPerMs={pixelsPerMs}
          timelineTranslateX={timelineTranslateX}
          timelineScale={timelineScale}
          onSeek={onSeek}
          bounds={moveBounds?.get(band.id)}
          onMove={onMove}
          draggingSectionId={draggingSectionId}
          draggingSectionDeltaMs={draggingSectionDeltaMs}
          pushedSectionId={pushedSectionId}
          pushedSectionDeltaMs={pushedSectionDeltaMs}
        />
      ))}
    </View>
  );
}

function SectionJumpHitbox({
  band,
  pixelsPerMs,
  timelineTranslateX,
  timelineScale,
  onSeek,
  bounds,
  onMove,
  draggingSectionId,
  draggingSectionDeltaMs,
  pushedSectionId,
  pushedSectionDeltaMs,
}: {
  band: JumpBand;
  pixelsPerMs: number;
  timelineTranslateX: SharedValue<number>;
  timelineScale: SharedValue<number>;
  onSeek: (timeMs: number) => void;
  bounds?: MoveBounds;
  onMove?: (sectionId: string, startMs: number, push?: boolean) => void;
  draggingSectionId: SharedValue<string>;
  draggingSectionDeltaMs: SharedValue<number>;
  pushedSectionId: SharedValue<string>;
  pushedSectionDeltaMs: SharedValue<number>;
}) {
  // 0 moving freely · 1 held at a neighbour · 2 leaning through it.
  const pushZone = useSharedValue(0);
  const handleJump = React.useCallback(
    () => onSeek(band.startMs),
    [band.startMs, onSeek]
  );
  const handleMove = React.useCallback(
    (startMs: number, push: boolean) => onMove?.(band.id, startMs, push),
    [band.id, onMove]
  );
  const canMove = !!onMove && !!bounds;
  const minDeltaMs = bounds ? bounds.minStartMs - band.startMs : 0;
  const maxDeltaMs = bounds ? bounds.maxStartMs - band.startMs : 0;
  const pushMinDeltaMs = bounds ? bounds.pushMinStartMs - band.startMs : 0;
  const pushMaxDeltaMs = bounds ? bounds.pushMaxStartMs - band.startMs : 0;
  const prevId = bounds?.prevId ?? "";
  const nextId = bounds?.nextId ?? "";
  const gesture = React.useMemo(() => {
    const tap = Gesture.Tap().onEnd(() => {
      // Haptics vocabulary: `tap` — an acknowledged press (the jump lands).
      runOnJS(haptic.tap)();
      runOnJS(handleJump)();
    });
    if (!canMove) return tap;
    const pan = Gesture.Pan()
      .activateAfterLongPress(300)
      .onStart(() => {
        draggingSectionDeltaMs.value = 0;
        pushedSectionDeltaMs.value = 0;
        pushedSectionId.value = "";
        pushZone.value = 0;
        draggingSectionId.value = band.id;
        // Haptics vocabulary: `grab` — picking something up (drag lift).
        runOnJS(haptic.grab)();
      })
      .onChange((event) => {
        if (pixelsPerMs <= 0 || timelineScale.value <= 0) return;
        const pxPerMs = pixelsPerMs * timelineScale.value;
        const raw = event.translationX / pxPerMs;
        const lean = SECTION_PUSH_LEAN_PX / pxPerMs;
        // Free between the neighbours; held at one; and, leaned far enough past
        // it, taking that neighbour's near edge along.
        let delta = raw;
        let zone = 0;
        let pushed = "";
        let pushedBy = 0;
        if (raw > maxDeltaMs) {
          delta = maxDeltaMs;
          zone = 1;
          if (nextId !== "" && raw > maxDeltaMs + lean) {
            delta = Math.min(pushMaxDeltaMs, raw - lean);
            zone = 2;
            pushed = nextId;
            pushedBy = delta - maxDeltaMs;
          }
        } else if (raw < minDeltaMs) {
          delta = minDeltaMs;
          zone = 1;
          if (prevId !== "" && raw < minDeltaMs - lean) {
            delta = Math.max(pushMinDeltaMs, raw + lean);
            zone = 2;
            pushed = prevId;
            pushedBy = delta - minDeltaMs;
          }
        }
        if (zone > pushZone.value) {
          // Haptics vocabulary: `tick` — a detent reached (the neighbour);
          // `grab` — a heavier mode entered (the neighbour gives way).
          if (zone === 2) runOnJS(haptic.grab)();
          else runOnJS(haptic.tick)();
        }
        pushZone.value = zone;
        draggingSectionDeltaMs.value = delta;
        pushedSectionDeltaMs.value = pushedBy;
        pushedSectionId.value = pushed;
      })
      .onEnd(() => {
        const deltaMs = draggingSectionDeltaMs.value;
        if (Math.abs(deltaMs) >= SECTION_MOVE_MIN_MS) {
          runOnJS(handleMove)(Math.round(band.startMs + deltaMs), pushZone.value === 2);
        }
      })
      .onFinalize(() => {
        if (draggingSectionId.value === band.id) {
          draggingSectionId.value = "";
          pushedSectionId.value = "";
        }
      });
    return Gesture.Exclusive(pan, tap);
  }, [
    band.id,
    band.startMs,
    canMove,
    draggingSectionDeltaMs,
    draggingSectionId,
    handleJump,
    handleMove,
    maxDeltaMs,
    minDeltaMs,
    nextId,
    pixelsPerMs,
    prevId,
    pushMaxDeltaMs,
    pushMinDeltaMs,
    pushZone,
    pushedSectionDeltaMs,
    pushedSectionId,
    timelineScale,
  ]);
  const animatedStyle = useAnimatedStyle(() => {
    const scale = timelineScale.value;
    const left = band.startMs * pixelsPerMs * scale + timelineTranslateX.value;
    const width = Math.max(0, (band.endMs - band.startMs) * pixelsPerMs * scale);
    return { transform: [{ translateX: left }], width };
  });
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[sectionJumpStyles.rail, animatedStyle]}
        accessibilityRole="button"
        accessibilityLabel={band.label}
      />
    </GestureDetector>
  );
}

const sectionJumpStyles = StyleSheet.create({
  rail: {
    position: "absolute",
    bottom: 0,
    left: 0,
    height: SECTION_JUMP_RAIL_HEIGHT,
  },
});

/** The classic (pre-lanes) reel while Tools is open. The lanes reel takes its
 *  heights from `reelHeightForFlow`. */
const CLASSIC_PRACTICE_REEL_HEIGHT = 128;
const LOOP_MOVE_PILL_WIDTH = 34;
const LOOP_MOVE_PILL_HEIGHT = 10;
const LOOP_MOVE_HITBOX_WIDTH = 52;
const LOOP_MOVE_HITBOX_HEIGHT = 24;
const LOOP_MOVE_ROW_HEIGHT = 14;
/** Looper accent — matches the terracotta loop region drawn on the reel. */
const LOOP_ACCENT = "rgba(139, 79, 59, 0.95)";

type TransportClock = {
  sharedCurrentTimeMs: SharedValue<number>;
  sharedDurationMs: SharedValue<number>;
  sharedIsPlaying: SharedValue<boolean>;
  sharedPlaybackRate: SharedValue<number>;
  sharedUpdateToken: SharedValue<number>;
  sharedSeekLandedToken: SharedValue<number>;
};

type Props = {
  mode: "player" | "practice" | "layers";
  /** Reading rung of the ladder: the SAME reel, only thinner — bands, pins,
   *  scrub and pinch-zoom all keep working while an artifact holds the page. */
  readingSlim?: boolean;
  /** What the listening page holds beneath the reel; the reel takes the rest. */
  listeningBelow?: ListeningBelow;
  waveformPeaks: number[];
  /** Peaks are a synthetic placeholder — draw the pending line instead of a fake wave. */
  waveformPending?: boolean;
  /** A decode is in flight right now — show the "Analyzing waveform…" caption. */
  waveformAnalyzing?: boolean;
  /** The high-res source is still loading — hold back a too-coarse stand-in. */
  waveformResolving?: boolean;
  durationMs: number;
  resetKey?: string | number | null;
  isPlayerPlaying: boolean;
  playbackRate: number;
  isScrubbing: boolean;
  /** Loop visuals + handles live on the reel wherever a loop-bearing surface is
   *  open — practice Tools, or the writing editor on the slim reel. */
  loopActive?: boolean;
  transportClock: TransportClock;
  sharedAudioProgress?: SharedValue<number>;
  sharedPauseHoldMs?: SharedValue<number>;
  sharedPauseHoldToken?: SharedValue<number>;
  practiceLoopEnabled: boolean;
  practiceLoopSelection: Range[];
  practiceMarkers: PracticeMarker[];
  sections: ClipSection[];
  /** The take's beat grid — draws bars/beats/tempo changes on the reel. */
  recordingGrid?: RecordingGrid | null;
  /** Un-flattened overdub layers, drawn as slim lanes under the reel so their placement
   *  on the master's timeline is visible at a glance. */
  overdubLayerLanes?: OverdubLayerLane[];
  /** Lane-as-portal: tapping the lane opens the mixer (player mode only). */
  onOpenLayerMixer?: () => void;
  layerMixerAccessibilityLabel?: string;
  /** Bench (layers mode): lanes become the layer selector. */
  selectedLaneId?: string | null;
  onPressLane?: (id: string) => void;
  onLaneDragEnd?: (id: string, deltaMs: number, msPerPx: number) => void;
  laneDragResetToken?: number;
  draggingMarkerId: SharedValue<string>;
  draggingMarkerX: SharedValue<number>;
  onLoopRangeChange: (start: number, end: number) => void;
  onSeek: (timeMs: number) => void | Promise<void>;
  onTogglePlay: () => void;
  onScrubStateChange: (scrubbing: boolean) => void;
  onRepositionMarker: (markerId: string, newAtMs: number) => void;
  /** Slide a section whole to a new start (hold its name or rule, then drag). */
  onMoveSection?: (sectionId: string, startMs: number, push?: boolean) => void;
  onRequestPinActions: (marker: PracticeMarker) => void;
  onRequestAddPin: () => void;
  onPinDragStateChange: (dragging: boolean) => void;
  practiceZoomMultiple: number;
  onPracticeZoomMultipleChange: (zoomMultiple: number) => void;
};

function DragIndicatorLine({
  draggingMarkerId,
  draggingMarkerX,
}: {
  draggingMarkerId: SharedValue<string>;
  draggingMarkerX: SharedValue<number>;
}) {
  const lineStyle = useAnimatedStyle(() => ({
    position: "absolute" as const,
    // `start` (not `left`) so the drag line resolves against the LTR-pinned reel.
    start: draggingMarkerX.value - 1,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.primary,
    opacity: draggingMarkerId.value !== "" ? 1 : 0,
  }));

  return <Animated.View style={lineStyle} pointerEvents="none" />;
}

function LoopMoveHandle({
  range,
  durationMs,
  pixelsPerMs,
  timelineTranslateX,
  timelineScale,
  sharedPreviewStartMs,
  sharedPreviewEndMs,
  onLoopRangeChange,
  onScrubStateChange,
  quiet = false,
}: {
  range: Range;
  durationMs: number;
  pixelsPerMs: number;
  timelineTranslateX: SharedValue<number>;
  timelineScale: SharedValue<number>;
  sharedPreviewStartMs: SharedValue<number>;
  sharedPreviewEndMs: SharedValue<number>;
  onLoopRangeChange: (start: number, end: number) => void;
  onScrubStateChange: (scrubbing: boolean) => void;
  /** Lanes look: a slim terracotta bar, no shadow and no inner grip. */
  quiet?: boolean;
}) {
  const dragStartStartMs = useSharedValue(range.start);
  const dragStartEndMs = useSharedValue(range.end);
  const isDragging = useSharedValue(false);

  React.useEffect(() => {
    sharedPreviewStartMs.value = range.start;
    sharedPreviewEndMs.value = range.end;
  }, [range.end, range.start, sharedPreviewEndMs, sharedPreviewStartMs]);

  const handleCommit = React.useCallback(
    (startMs: number, endMs: number) => {
      onLoopRangeChange(startMs, endMs);
      onScrubStateChange(false);
    },
    [onLoopRangeChange, onScrubStateChange]
  );

  const panGesture = Gesture.Pan()
    .activateAfterLongPress(220)
    .onStart(() => {
      isDragging.value = true;
      dragStartStartMs.value = sharedPreviewStartMs.value;
      dragStartEndMs.value = sharedPreviewEndMs.value;
      runOnJS(onScrubStateChange)(true);
      runOnJS(haptic.tap)();
    })
    .onChange((event) => {
      if (pixelsPerMs <= 0 || timelineScale.value <= 0) {
        return;
      }

      const deltaMs = event.translationX / (pixelsPerMs * timelineScale.value);
      const loopWidthMs = dragStartEndMs.value - dragStartStartMs.value;
      const maxStartMs = Math.max(0, durationMs - loopWidthMs);
      const nextStartMs = Math.max(0, Math.min(maxStartMs, dragStartStartMs.value + deltaMs));

      sharedPreviewStartMs.value = nextStartMs;
      sharedPreviewEndMs.value = nextStartMs + loopWidthMs;
    })
    .onEnd(() => {
      isDragging.value = false;
      runOnJS(handleCommit)(Math.round(sharedPreviewStartMs.value), Math.round(sharedPreviewEndMs.value));
    })
    .onFinalize(() => {
      isDragging.value = false;
    });

  const handleStyle = useAnimatedStyle(() => {
    const centerMs = (sharedPreviewStartMs.value + sharedPreviewEndMs.value) / 2;
    const centerX = centerMs * pixelsPerMs * timelineScale.value + timelineTranslateX.value;

    return {
      transform: [{ translateX: centerX - LOOP_MOVE_HITBOX_WIDTH / 2 }],
      opacity: withSpring(isDragging.value ? 1 : 0.92, springs.handle),
    };
  });

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(isDragging.value ? 1.06 : 1, springs.handle) }],
  }));

  return (
    <View style={timelineStyles.loopMoveRow} pointerEvents="box-none">
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[timelineStyles.loopMoveHitbox, handleStyle]}>
          <Animated.View
            style={[quiet ? timelineStyles.loopMoveBar : timelineStyles.loopMovePill, pillStyle]}
          >
            {quiet ? null : <View style={timelineStyles.loopMoveGrip} />}
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}


function PlayerTimelineInner({
  mode,
  readingSlim,
  listeningBelow,
  waveformPeaks,
  waveformPending,
  waveformAnalyzing,
  waveformResolving,
  durationMs,
  resetKey,
  isPlayerPlaying,
  playbackRate,
  isScrubbing,
  loopActive = false,
  transportClock,
  sharedAudioProgress,
  sharedPauseHoldMs,
  sharedPauseHoldToken,
  practiceLoopEnabled,
  practiceLoopSelection,
  practiceMarkers,
  sections,
  recordingGrid,
  overdubLayerLanes,
  onOpenLayerMixer,
  layerMixerAccessibilityLabel,
  selectedLaneId,
  onPressLane,
  onLaneDragEnd,
  laneDragResetToken,
  draggingMarkerId,
  draggingMarkerX,
  onLoopRangeChange,
  onSeek,
  onTogglePlay,
  onScrubStateChange,
  onRepositionMarker,
  onMoveSection,
  onRequestPinActions,
  onRequestAddPin,
  onPinDragStateChange,
  practiceZoomMultiple,
  onPracticeZoomMultipleChange,
}: Props) {
  // Lanes are the reel's default look; the hitboxes below follow the same geometry.
  const lanes = !useStore((state) => state.classicReel);
  // A section being dragged whole: which one, and how far. The hitbox writes
  // them on the UI thread; the canvas draws from them. No React state moves.
  const draggingSectionId = useSharedValue("");
  const draggingSectionDeltaMs = useSharedValue(0);
  // The neighbour whose near edge is being pushed, and by how much (signed).
  const pushedSectionId = useSharedValue("");
  const pushedSectionDeltaMs = useSharedValue(0);
  const sectionMoveBoundsById = React.useMemo(() => {
    const map = new Map<string, MoveBounds>();
    for (const section of sections) {
      const bounds = sectionMoveBounds(sections, section.id, durationMs);
      const push = sectionPushBounds(sections, section.id, durationMs);
      if (bounds && push) map.set(section.id, { ...bounds, ...push });
    }
    return map;
  }, [sections, durationMs]);
  const handleMarkerLongPress = React.useCallback(
    (markerId: string) => {
      const marker = practiceMarkers.find((candidate) => candidate.id === markerId);
      if (marker) onRequestPinActions(marker);
    },
    [onRequestPinActions, practiceMarkers]
  );
  // One height per flow (domain/reelLanes): the reel takes the page while
  // nothing is open beneath it and pays rent the moment something is. It used
  // to need a corner button to grow; now the page decides.
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const usableHeight = windowHeight - insets.top - insets.bottom;
  const reelHeight = readingSlim
    ? reelHeightForFlow("reading", usableHeight)
    : mode !== "player"
      ? lanes
        ? reelHeightForFlow("tools", usableHeight)
        : CLASSIC_PRACTICE_REEL_HEIGHT
      : reelHeightForFlow("listening", usableHeight, listeningBelow);
  const previewRange = practiceLoopSelection[0];
  const sharedLoopPreviewStartMs = useSharedValue(previewRange?.start ?? 0);
  const sharedLoopPreviewEndMs = useSharedValue(previewRange?.end ?? Math.max(1000, durationMs));

  React.useEffect(() => {
    sharedLoopPreviewStartMs.value = previewRange?.start ?? 0;
    sharedLoopPreviewEndMs.value = previewRange?.end ?? Math.max(1000, durationMs);
  }, [durationMs, previewRange?.end, previewRange?.start, sharedLoopPreviewEndMs, sharedLoopPreviewStartMs]);

  // Section bands ride inside the Skia surface (behind the wave) so they scroll and
  // scale with it. Shown in both modes — the song map is useful while listening too.
  const sectionBands = React.useMemo(
    () => buildSectionBands(sections, durationMs),
    [sections, durationMs]
  );

  return (
    <AudioReel
      waveformPeaks={waveformPeaks}
      waveformPending={waveformPending}
      waveformAnalyzing={waveformAnalyzing}
      waveformResolving={waveformResolving}
      durationMs={durationMs}
      resetKey={resetKey}
      initialZoomMultiple={openingZoomForDuration(durationMs)}
      currentTimeMs={0}
      sharedCurrentTimeMs={transportClock.sharedCurrentTimeMs}
      sharedDurationMs={transportClock.sharedDurationMs}
      sharedTransportUpdateToken={transportClock.sharedUpdateToken}
      sharedSeekLandedToken={transportClock.sharedSeekLandedToken}
      sharedAudioProgress={sharedAudioProgress}
      sharedPauseHoldMs={sharedPauseHoldMs}
      sharedPauseHoldToken={sharedPauseHoldToken}
      isPlaying={isPlayerPlaying}
      sharedIsPlaying={transportClock.sharedIsPlaying}
      playbackRate={playbackRate}
      sharedPlaybackRate={transportClock.sharedPlaybackRate}
      isScrubbing={isScrubbing}
      chrome="light"
      showTransportControls={false}
      showExpandToggle={false}
      // Zoom is part of the reel's identity — the slim reel keeps the controls
      // and pinch alike; the minimap halves instead so navigation stays cheap.
      // The bench halves it too: three stacked waveforms is one too many.
      showZoomControls
      // The map halves whenever the page below needs the room: reading, the
      // bench, and Tools.
      minimapCompact={readingSlim || mode !== "player"}
      zoomPlacement="overlay"
      showTimingRow={false}
      defaultExpanded={false}
      surfaceRadius={4}
      timelineHorizontalPadding={0}
      // Bigger reel in the default listening view (waveform as hero); smaller when Tools
      // are open to leave room for the practice console; slimmest while an artifact is
      // open for reading — the tape stays a live instrument, it just pays rent.
      collapsedHeightOverride={reelHeight}
      // Practice mode is controlled (parent owns the zoom). The normal player runs
      // UNCONTROLLED so the zoom buttons work and the duration-aware follow-window
      // (initialZoomMultiple) applies — long songs open as a scrolling tape.
      zoomMultiple={mode === "practice" ? practiceZoomMultiple : undefined}
      onZoomMultipleChange={mode === "practice" ? onPracticeZoomMultipleChange : undefined}
      // "auto" = show once zoomed past 1x, which is precisely when a thumb needs it: the
      // clip no longer fits the reel. It was pinned off outside practice mode, so the full
      // player lost its only way to cross a zoomed clip quickly. Reading has no zoom
      // controls, so auto stays quiet there on its own.
      showMinimapMode="auto"
      freezeSelectedRangeWhenFullyVisible={loopActive}
      selectedRanges={loopActive ? practiceLoopSelection : undefined}
      // Pins show wherever the tape does — full height or reading-slim. They're
      // the song's own map, not a practice tool. Only the bench skips them
      // (three stacked waveforms is already plenty).
      practiceMarkers={mode !== "layers" ? practiceMarkers : undefined}
      sharedDraggingMarkerId={draggingMarkerId}
      // Lanes: holding a pin's line and dragging moves it, on the tape itself.
      sharedDraggingMarkerX={draggingMarkerX}
      markerDragEnabled={lanes && mode === "practice"}
      onMarkerDragStateChange={onPinDragStateChange}
      onMarkerDragEnd={onRepositionMarker}
      onMarkerLongPress={handleMarkerLongPress}
      sharedDraggingSectionId={draggingSectionId}
      sharedDraggingSectionDeltaMs={draggingSectionDeltaMs}
      sharedPushedSectionId={pushedSectionId}
      sharedPushedSectionDeltaMs={pushedSectionDeltaMs}
      sectionBands={sectionBands}
      grid={recordingGrid}
      sharedSelectedRangeStartMs={loopActive ? sharedLoopPreviewStartMs : undefined}
      sharedSelectedRangeEndMs={loopActive ? sharedLoopPreviewEndMs : undefined}
      selectedRangeType={previewRange?.type}
      renderOverlay={({ pixelsPerMs, timelineTranslateX, timelineScale, scale, sharedAudioProgress }) => (
        <View style={{ flex: 1, position: "relative" }}>
          {/* Section titles are drawn inside the reel's canvas (PlaybackTapeVisualizer) —
              part of the tape's own picture, so they can never slip against it. */}
          {loopActive ? (
            <MultiTimeRangeSelector
                  durationMs={durationMs}
                  pixelsPerMs={pixelsPerMs}
                  regions={practiceLoopSelection}
                  onRegionChange={(_, start, end) => onLoopRangeChange(start, end)}
                  sharedTranslateX={timelineTranslateX}
                  sharedScale={timelineScale}
                  sharedAudioProgress={sharedAudioProgress}
                  sharedPreviewStartMs={sharedLoopPreviewStartMs}
                  sharedPreviewEndMs={sharedLoopPreviewEndMs}
                  onScrubStateChange={onScrubStateChange}
                  onSeek={(timeMs) => void onSeek(timeMs)}
                  showVisuals={false}
                />
          ) : null}
          {mode !== "layers" ? (
            <>
              {mode === "practice" ? (
                <DragIndicatorLine
                  draggingMarkerId={draggingMarkerId}
                  draggingMarkerX={draggingMarkerX}
                />
              ) : null}
              <SectionJumpHitboxes
                bands={sectionBands}
                pixelsPerMs={pixelsPerMs}
                timelineTranslateX={timelineTranslateX}
                timelineScale={timelineScale}
                onSeek={(timeMs) => void onSeek(timeMs)}
                // Practice owns editing, as with pins: elsewhere a section only jumps.
                moveBounds={mode === "practice" ? sectionMoveBoundsById : undefined}
                onMove={mode === "practice" ? onMoveSection : undefined}
                draggingSectionId={draggingSectionId}
                draggingSectionDeltaMs={draggingSectionDeltaMs}
                pushedSectionId={pushedSectionId}
                pushedSectionDeltaMs={pushedSectionDeltaMs}
              />
              <PracticePinBadges
                markers={practiceMarkers}
                pixelsPerMs={pixelsPerMs}
                timelineTranslateX={timelineTranslateX}
                timelineScale={timelineScale}
                durationMs={durationMs}
                onSeek={(timeMs) => void onSeek(timeMs)}
                onRepositionMarker={onRepositionMarker}
                onRequestActions={onRequestPinActions}
                onDragStateChange={onPinDragStateChange}
                draggingMarkerId={draggingMarkerId}
                draggingMarkerX={draggingMarkerX}
                editable={mode === "practice"}
                lanes={lanes}
                labelScale={scale}
                laneDensity={laneDensityForHeight(reelHeight)}
              />
            </>
          ) : null}
        </View>
      )}
      renderBelowSurface={({ pixelsPerMs, timelineTranslateX, timelineScale }) => (
        <>
          {overdubLayerLanes && overdubLayerLanes.length > 0 ? (
            <OverdubLayerLanes
              lanes={overdubLayerLanes}
              pixelsPerMs={pixelsPerMs}
              timelineTranslateX={timelineTranslateX}
              timelineScale={timelineScale}
              onPress={onOpenLayerMixer}
              accessibilityLabel={layerMixerAccessibilityLabel}
              selectedLaneId={mode === "layers" ? selectedLaneId : undefined}
              onPressLane={mode === "layers" ? onPressLane : undefined}
              onLaneDragEnd={mode === "layers" ? onLaneDragEnd : undefined}
              laneDragResetToken={laneDragResetToken}
            />
          ) : null}
          {loopActive && previewRange ? (
            <LoopMoveHandle
              range={previewRange}
              durationMs={durationMs}
              pixelsPerMs={pixelsPerMs}
              timelineTranslateX={timelineTranslateX}
              timelineScale={timelineScale}
              sharedPreviewStartMs={sharedLoopPreviewStartMs}
              sharedPreviewEndMs={sharedLoopPreviewEndMs}
              onLoopRangeChange={onLoopRangeChange}
              onScrubStateChange={onScrubStateChange}
              quiet={lanes}
            />
          ) : null}
        </>
      )}
      onSeek={onSeek}
      onTogglePlay={onTogglePlay}
      onSeekToStart={() => onSeek(0)}
      onSeekToEnd={() => onSeek(durationMs)}
      onScrubStateChange={onScrubStateChange}
    />
  );
}

export const PlayerTimeline = React.memo(PlayerTimelineInner);

const timelineStyles = StyleSheet.create({
  loopMoveRow: {
    height: LOOP_MOVE_ROW_HEIGHT,
    overflow: "visible",
    marginTop: -4,
    marginBottom: 0,
  },
  loopMoveHitbox: {
    position: "absolute",
    top: -2,
    width: LOOP_MOVE_HITBOX_WIDTH,
    height: LOOP_MOVE_HITBOX_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  loopMovePill: {
    width: LOOP_MOVE_PILL_WIDTH,
    height: LOOP_MOVE_PILL_HEIGHT,
    borderRadius: LOOP_MOVE_PILL_HEIGHT / 2,
    backgroundColor: LOOP_ACCENT,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.16,
    shadowRadius: 2,
    elevation: 2,
  },
  loopMoveBar: {
    width: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  loopMoveGrip: {
    width: 12,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.88)",
  },
});
