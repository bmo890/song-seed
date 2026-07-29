import React, { useCallback, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  SharedValue,
  withSpring,
} from "react-native-reanimated";
import type { PracticeMarker } from "../../types";
import { colors } from "../../design/tokens";
import { haptic } from "../../design/haptics";
import {
  assignPinRows,
  estimatePinBadgeWidth,
  pinRowTop,
  PIN_BADGE_HEIGHT,
  PIN_EDGE_GUARD_PX,
} from "../../domain/practicePinLayout";

const PIN_LIFT_SPRING = { damping: 20, stiffness: 300 };

type Props = {
  markers: PracticeMarker[];
  pixelsPerMs: number;
  timelineTranslateX: SharedValue<number>;
  timelineScale: SharedValue<number>;
  durationMs: number;
  onSeek: (timeMs: number) => void;
  onRepositionMarker: (markerId: string, newAtMs: number) => void;
  onRequestActions: (marker: PracticeMarker) => void;
  onDragStateChange?: (dragging: boolean) => void;
  draggingMarkerId: SharedValue<string>;
  draggingMarkerX: SharedValue<number>;
};

function PinBadge({
  marker,
  row,
  pixelsPerMs,
  timelineTranslateX,
  timelineScale,
  durationMs,
  onSeek,
  onRepositionMarker,
  onRequestActions,
  onDragStateChange,
  draggingMarkerId,
  draggingMarkerX,
}: {
  marker: PracticeMarker;
  row: number;
  pixelsPerMs: number;
  timelineTranslateX: SharedValue<number>;
  timelineScale: SharedValue<number>;
  durationMs: number;
  onSeek: (timeMs: number) => void;
  onRepositionMarker: (markerId: string, newAtMs: number) => void;
  onRequestActions: (marker: PracticeMarker) => void;
  onDragStateChange?: (dragging: boolean) => void;
  draggingMarkerId: SharedValue<string>;
  draggingMarkerX: SharedValue<number>;
}) {
  const badgeW = estimatePinBadgeWidth(marker.label);
  const dragTimeMs = useSharedValue(marker.atMs);
  const dragStartMs = useSharedValue(0);
  const isDragging = useSharedValue(false);
  // The lift spring is STARTED on the drag transitions, never called from inside the
  // animated style. `withSpring` in a style that re-evaluates every frame (this one does —
  // it reads the scrolling translateX) re-seeds the animation 60×/second, which both costs
  // UI-thread work per pin and keeps the value from settling. One shared value, two
  // transitions, read as a plain number below.
  const dragLift = useSharedValue(1);

  const handleSeek = useCallback(() => onSeek(marker.atMs), [marker.atMs, onSeek]);
  const handleActions = useCallback(() => onRequestActions(marker), [marker, onRequestActions]);
  const handleReposition = useCallback(
    (newMs: number) => onRepositionMarker(marker.id, newMs),
    [marker.id, onRepositionMarker]
  );

  const panGesture = Gesture.Pan()
    .activateAfterLongPress(300)
    .onStart(() => {
      isDragging.value = true;
      dragLift.value = withSpring(1.1, PIN_LIFT_SPRING);
      dragStartMs.value = marker.atMs;
      dragTimeMs.value = marker.atMs;
      draggingMarkerId.value = marker.id;
      draggingMarkerX.value =
        marker.atMs * pixelsPerMs * timelineScale.value + timelineTranslateX.value;
      if (onDragStateChange) runOnJS(onDragStateChange)(true);
      runOnJS(haptic.tap)();
    })
    .onChange((e) => {
      if (pixelsPerMs <= 0 || timelineScale.value <= 0) return;
      const deltaMs = e.changeX / (pixelsPerMs * timelineScale.value);
      dragTimeMs.value = Math.max(0, Math.min(durationMs, dragTimeMs.value + deltaMs));
      draggingMarkerX.value =
        dragTimeMs.value * pixelsPerMs * timelineScale.value + timelineTranslateX.value;
    })
    .onEnd(() => {
      isDragging.value = false;
      dragLift.value = withSpring(1, PIN_LIFT_SPRING);
      draggingMarkerId.value = "";
      const movedMs = Math.abs(dragTimeMs.value - dragStartMs.value);
      if (movedMs > 200) {
        runOnJS(handleReposition)(Math.round(dragTimeMs.value));
      } else {
        runOnJS(handleActions)();
      }
    })
    .onFinalize(() => {
      isDragging.value = false;
      dragLift.value = withSpring(1, PIN_LIFT_SPRING);
      draggingMarkerId.value = "";
      if (onDragStateChange) runOnJS(onDragStateChange)(false);
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(handleSeek)();
  });

  const composed = Gesture.Exclusive(panGesture, tapGesture);
  const topOffset = pinRowTop(row);

  const animatedStyle = useAnimatedStyle(() => {
    const timeMs = isDragging.value ? dragTimeMs.value : marker.atMs;
    const x = timeMs * pixelsPerMs * timelineScale.value + timelineTranslateX.value;
    const contentWidth = durationMs * pixelsPerMs * timelineScale.value;
    const badgeAnchor = x + badgeW > contentWidth - PIN_EDGE_GUARD_PX ? "end" : "start";
    const anchorOffset = badgeAnchor === "end" ? -badgeW : 0;
    return {
      transform: [
        { translateX: x },
        { translateX: anchorOffset },
        { scale: dragLift.value },
      ],
      // At rest this view is a pure HITBOX: the badge the user sees is drawn inside the
      // reel's canvas, glued to the tape by construction. Mid-drag the canvas twin hides
      // and this one shows — under the finger, where a one-frame slip cannot be seen.
      opacity: isDragging.value ? 1 : 0,
      zIndex: isDragging.value ? 10 : 0,
    };
  });

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[badgeStyles.badgeWrap, { top: topOffset }, animatedStyle]}>
        {marker.label ? (
          <View style={badgeStyles.badge}>
            <Text style={badgeStyles.badgeText} numberOfLines={1}>
              {marker.label}
            </Text>
            {marker.note ? <View style={badgeStyles.noteDot} /> : null}
          </View>
        ) : (
          <View style={[badgeStyles.badgeDot, marker.note ? badgeStyles.badgeDotNote : null]} />
        )}
      </Animated.View>
    </GestureDetector>
  );
}

export function PracticePinBadges({
  markers,
  pixelsPerMs,
  timelineTranslateX,
  timelineScale,
  durationMs,
  onSeek,
  onRepositionMarker,
  onRequestActions,
  onDragStateChange,
  draggingMarkerId,
  draggingMarkerX,
}: Props) {
  const rowAssignments = useMemo(
    () => assignPinRows(markers, pixelsPerMs, 1, durationMs),
    [durationMs, markers, pixelsPerMs]
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {rowAssignments.map(({ marker, row }) => (
        <PinBadge
          key={marker.id}
          marker={marker}
          row={row}
          pixelsPerMs={pixelsPerMs}
          timelineTranslateX={timelineTranslateX}
          timelineScale={timelineScale}
          durationMs={durationMs}
          onSeek={onSeek}
          onRepositionMarker={onRepositionMarker}
          onRequestActions={onRequestActions}
          onDragStateChange={onDragStateChange}
          draggingMarkerId={draggingMarkerId}
          draggingMarkerX={draggingMarkerX}
        />
      ))}
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badgeWrap: {
    position: "absolute",
    height: PIN_BADGE_HEIGHT,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.primary,
    borderRadius: 2,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 10,
    color: colors.onPrimary,
  },
  badgeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginTop: 2,
  },
  badgeDotNote: {
    borderWidth: 1.5,
    borderColor: colors.onPrimary,
  },
  noteDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.onPrimary,
    opacity: 0.85,
    marginLeft: 4,
  },
});
