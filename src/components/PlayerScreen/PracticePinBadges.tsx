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
import * as Haptics from "expo-haptics";
import type { PracticeMarker } from "../../types";
import { colors } from "../../design/tokens";

const BADGE_HEIGHT = 18;
const BADGE_CHAR_WIDTH = 6;
const BADGE_H_PAD = 12;
const ROW_GAP = 2;
const TOP_PAD = 3; // gap between reel top and the first badge row

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

// The label is a flag flying to the RIGHT of the line (the pole), so it anchors at "start"
// (left edge on the line). Only near the right edge does it flip to "end" so it stays on-reel.
type BadgeAnchor = "start" | "end";
const EDGE_GUARD_PX = 8;

function resolveBadgeAnchor(centerX: number, width: number, contentWidth: number): BadgeAnchor {
  if (centerX + width > contentWidth - EDGE_GUARD_PX) return "end";
  return "start";
}

function getBadgeEdges(centerX: number, width: number, anchor: BadgeAnchor) {
  if (anchor === "end") return { left: centerX - width, right: centerX };
  return { left: centerX, right: centerX + width };
}

function estimateBadgeWidth(label: string): number {
  if (!label) return BADGE_HEIGHT; // unlabelled pin is a dot
  return Math.max(32, label.length * BADGE_CHAR_WIDTH + BADGE_H_PAD);
}

/* Assign each badge the first row whose last badge clears it — overlapping pins drop to a
   lower row (and the next, and the next) so every label stays readable. */
function assignRows(
  markers: PracticeMarker[],
  pixelsPerMs: number,
  scale: number,
  durationMs: number
): { marker: PracticeMarker; row: number }[] {
  if (markers.length === 0) return [];
  const sorted = [...markers].sort((a, b) => a.atMs - b.atMs);
  const contentWidth = durationMs * pixelsPerMs * scale;
  const rowRightEdges: number[] = [];
  const result: { marker: PracticeMarker; row: number }[] = [];

  for (const m of sorted) {
    const centerX = m.atMs * pixelsPerMs * scale;
    const width = estimateBadgeWidth(m.label);
    const anchor = resolveBadgeAnchor(centerX, width, contentWidth);
    const { left, right } = getBadgeEdges(centerX, width, anchor);

    let assignedRow = rowRightEdges.findIndex((edge) => left >= edge + 4);
    if (assignedRow === -1) {
      assignedRow = rowRightEdges.length;
      rowRightEdges.push(right);
    } else {
      rowRightEdges[assignedRow] = right;
    }
    result.push({ marker: m, row: assignedRow });
  }
  return result;
}

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
  const badgeW = estimateBadgeWidth(marker.label);
  const dragTimeMs = useSharedValue(marker.atMs);
  const dragStartMs = useSharedValue(0);
  const isDragging = useSharedValue(false);

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
      dragStartMs.value = marker.atMs;
      dragTimeMs.value = marker.atMs;
      draggingMarkerId.value = marker.id;
      draggingMarkerX.value =
        marker.atMs * pixelsPerMs * timelineScale.value + timelineTranslateX.value;
      if (onDragStateChange) runOnJS(onDragStateChange)(true);
      runOnJS(Haptics.selectionAsync)();
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
      draggingMarkerId.value = "";
      if (onDragStateChange) runOnJS(onDragStateChange)(false);
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(handleSeek)();
  });

  const composed = Gesture.Exclusive(panGesture, tapGesture);
  const topOffset = TOP_PAD + row * (BADGE_HEIGHT + ROW_GAP);

  const animatedStyle = useAnimatedStyle(() => {
    const timeMs = isDragging.value ? dragTimeMs.value : marker.atMs;
    const x = timeMs * pixelsPerMs * timelineScale.value + timelineTranslateX.value;
    const contentWidth = durationMs * pixelsPerMs * timelineScale.value;
    const badgeAnchor = x + badgeW > contentWidth - EDGE_GUARD_PX ? "end" : "start";
    const anchorOffset = badgeAnchor === "end" ? -badgeW : 0;
    return {
      transform: [
        { translateX: x },
        { translateX: anchorOffset },
        { scale: withSpring(isDragging.value ? 1.1 : 1, { damping: 20, stiffness: 300 }) },
      ],
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
    () => assignRows(markers, pixelsPerMs, 1, durationMs),
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
    height: BADGE_HEIGHT,
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
