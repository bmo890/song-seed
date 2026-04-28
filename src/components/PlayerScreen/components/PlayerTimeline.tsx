import React from "react";
import { SharedValue, useAnimatedStyle, useSharedValue, runOnJS, withSpring } from "react-native-reanimated";
import Animated from "react-native-reanimated";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { AudioReel } from "../../common/AudioReel";
import { MultiTimeRangeSelector } from "../../common/TimeRangeSelector";
import { PracticePinBadges } from "../PracticePinBadges";
import type { PracticeMarker } from "../../../types";

type Range = {
  id: string;
  start: number;
  end: number;
  type: "keep" | "remove";
};

const LOOP_MOVE_PILL_WIDTH = 34;
const LOOP_MOVE_PILL_HEIGHT = 10;
const LOOP_MOVE_HITBOX_WIDTH = 52;
const LOOP_MOVE_HITBOX_HEIGHT = 28;
const LOOP_MOVE_ROW_HEIGHT = 24;

type TransportClock = {
  sharedCurrentTimeMs: SharedValue<number>;
  sharedDurationMs: SharedValue<number>;
  sharedIsPlaying: SharedValue<boolean>;
  sharedPlaybackRate: SharedValue<number>;
  sharedUpdateToken: SharedValue<number>;
};

type Props = {
  mode: "player" | "practice";
  waveformPeaks: number[];
  durationMs: number;
  resetKey?: string | number | null;
  isPlayerPlaying: boolean;
  playbackRate: number;
  isScrubbing: boolean;
  transportClock: TransportClock;
  sharedAudioProgress?: SharedValue<number>;
  sharedPauseHoldMs?: SharedValue<number>;
  sharedPauseHoldToken?: SharedValue<number>;
  practiceLoopEnabled: boolean;
  practiceLoopSelection: Range[];
  practiceMarkers: PracticeMarker[];
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
    left: draggingMarkerX.value - 1,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "#ca8a04",
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
      runOnJS(Haptics.selectionAsync)();
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
  waveformPeaks,
  durationMs,
  resetKey,
  isPlayerPlaying,
  playbackRate,
  isScrubbing,
  transportClock,
  sharedAudioProgress,
  sharedPauseHoldMs,
  sharedPauseHoldToken,
  practiceLoopEnabled,
  practiceLoopSelection,
  practiceMarkers,
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

  return (
    <AudioReel
      waveformPeaks={waveformPeaks}
      durationMs={durationMs}
      resetKey={resetKey}
      currentTimeMs={0}
      sharedCurrentTimeMs={transportClock.sharedCurrentTimeMs}
      sharedDurationMs={transportClock.sharedDurationMs}
      sharedTransportUpdateToken={transportClock.sharedUpdateToken}
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
      showZoomControls={mode === "practice"}
      showTimingRow={false}
      defaultExpanded={false}
      surfaceRadius={24}
      timelineHorizontalPadding={0}
      collapsedHeightOverride={160}
      zoomMultiple={mode === "practice" ? practiceZoomMultiple : 1}
      onZoomMultipleChange={mode === "practice" ? onPracticeZoomMultipleChange : undefined}
      showMinimapMode={mode === "practice" ? "auto" : "never"}
      freezeSelectedRangeWhenFullyVisible={mode === "practice" && practiceLoopEnabled}
      selectedRanges={mode === "practice" && practiceLoopEnabled ? practiceLoopSelection : undefined}
      practiceMarkers={mode === "practice" ? practiceMarkers : undefined}
      sharedSelectedRangeStartMs={mode === "practice" && practiceLoopEnabled ? sharedLoopPreviewStartMs : undefined}
      sharedSelectedRangeEndMs={mode === "practice" && practiceLoopEnabled ? sharedLoopPreviewEndMs : undefined}
      selectedRangeType={previewRange?.type}
      renderOverlay={
        mode === "practice"
          ? ({ pixelsPerMs, timelineTranslateX, timelineScale, sharedAudioProgress }) => (
              <View style={{ flex: 1, position: "relative" }}>
                {practiceLoopEnabled ? (
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
                <DragIndicatorLine
                  draggingMarkerId={draggingMarkerId}
                  draggingMarkerX={draggingMarkerX}
                />
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
                durationMs={durationMs}
                onSeek={(timeMs) => void onSeek(timeMs)}
                onRepositionMarker={onRepositionMarker}
                onRequestActions={onRequestPinActions}
                onRequestAdd={onRequestAddPin}
                onDragStateChange={onPinDragStateChange}
                draggingMarkerId={draggingMarkerId}
                draggingMarkerX={draggingMarkerX}
              />
            )
          : undefined
      }
      renderBelowSurface={
        mode === "practice"
          ? ({ pixelsPerMs, timelineTranslateX, timelineScale }) => (
              <>
                {practiceLoopEnabled && previewRange ? (
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
            )
          : undefined
      }
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
    marginTop: -2,
    marginBottom: 2,
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
    backgroundColor: "rgba(59, 130, 246, 0.92)",
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
