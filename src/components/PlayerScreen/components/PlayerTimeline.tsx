import React from "react";
import { SharedValue, useAnimatedStyle, useSharedValue, runOnJS, withSpring } from "react-native-reanimated";
import Animated from "react-native-reanimated";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { AudioReel } from "../../common/AudioReel";
import { openingZoomForDuration } from "../playerZoom";
import { MultiTimeRangeSelector } from "../../common/TimeRangeSelector";
import { OverdubLayerLanes, type OverdubLayerLane } from "../../common/OverdubLayerLanes";
import { PracticePinBadges } from "../PracticePinBadges";
import type { PracticeMarker, ClipSection, RecordingGrid } from "../../../types";
import { buildSectionBands } from "../../../domain/playerSections";
import { haptic } from "../../../design/haptics";
import { colors } from "../../../design/tokens";

type Range = {
  id: string;
  start: number;
  end: number;
  type: "keep" | "remove";
};

/** Height of the tappable rail over each section band — the bottom strip where
 *  the Skia label chip rides. Kept shallow so taps higher on the tape still scrub. */
const SECTION_JUMP_RAIL_HEIGHT = 30;

/** Invisible tap rails over the section bands: tapping a section's label strip
 *  jumps the playhead to its start. The visible chip is Skia (glued to the
 *  tape); these are hitboxes only, same pattern as the pin badges. */
function SectionJumpHitboxes({
  bands,
  pixelsPerMs,
  timelineTranslateX,
  timelineScale,
  onSeek,
}: {
  bands: { id: string; label: string; startMs: number; endMs: number }[];
  pixelsPerMs: number;
  timelineTranslateX: SharedValue<number>;
  timelineScale: SharedValue<number>;
  onSeek: (timeMs: number) => void;
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
}: {
  band: { id: string; label: string; startMs: number; endMs: number };
  pixelsPerMs: number;
  timelineTranslateX: SharedValue<number>;
  timelineScale: SharedValue<number>;
  onSeek: (timeMs: number) => void;
}) {
  const handleJump = React.useCallback(
    () => onSeek(band.startMs),
    [band.startMs, onSeek]
  );
  const tapGesture = React.useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        runOnJS(handleJump)();
      }),
    [handleJump]
  );
  const animatedStyle = useAnimatedStyle(() => {
    const scale = timelineScale.value;
    const left = band.startMs * pixelsPerMs * scale + timelineTranslateX.value;
    const width = Math.max(0, (band.endMs - band.startMs) * pixelsPerMs * scale);
    return { transform: [{ translateX: left }], width };
  });
  return (
    <GestureDetector gesture={tapGesture}>
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
  reelExpanded: boolean;
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
      opacity: withSpring(isDragging.value ? 1 : 0.92, { damping: 20, stiffness: 300 }),
    };
  });

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(isDragging.value ? 1.06 : 1, { damping: 20, stiffness: 300 }) }],
  }));

  return (
    <View style={timelineStyles.loopMoveRow} pointerEvents="box-none">
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[timelineStyles.loopMoveHitbox, handleStyle]}>
          <Animated.View style={[timelineStyles.loopMovePill, pillStyle]}>
            <View style={timelineStyles.loopMoveGrip} />
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}


function PlayerTimelineInner({
  mode,
  readingSlim,
  reelExpanded,
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
  onRequestPinActions,
  onRequestAddPin,
  onPinDragStateChange,
  practiceZoomMultiple,
  onPracticeZoomMultipleChange,
}: Props) {
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
      minimapCompact={readingSlim || mode === "layers"}
      zoomPlacement="overlay"
      showTimingRow={false}
      defaultExpanded={false}
      surfaceRadius={4}
      timelineHorizontalPadding={0}
      // Bigger reel in the default listening view (waveform as hero); smaller when Tools
      // are open to leave room for the practice console; slimmest while an artifact is
      // open for reading — the tape stays a live instrument, it just pays rent.
      collapsedHeightOverride={
        readingSlim ? 64 : reelExpanded ? 250 : mode !== "player" ? 128 : 184
      }
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
  loopMoveGrip: {
    width: 12,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.88)",
  },
});
