import React, { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  SharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import type { PracticeMarker } from "../../types";

const BADGE_HEIGHT = 26;
const BADGE_CHAR_WIDTH = 7;
const BADGE_H_PAD = 16; // total horizontal padding (8 × 2)
const ROW_GAP = 4; // gap between staggered rows
const HEADER_HEIGHT = 28;

type Props = {
  markers: PracticeMarker[];
  pixelsPerMs: number;
  timelineTranslateX: SharedValue<number>;
  timelineScale: SharedValue<number>;
  durationMs: number;
  onSeek: (timeMs: number) => void;
  onRepositionMarker: (markerId: string, newAtMs: number) => void;
  onRequestActions: (marker: PracticeMarker) => void;
  onRequestAdd: () => void;
  onDragStateChange?: (dragging: boolean) => void;
  draggingMarkerId: SharedValue<string>;
  draggingMarkerX: SharedValue<number>;
};

/* ── Estimate badge pixel width from label ─────────────────────── */
function estimateBadgeWidth(label: string): number {
  if (!label) return BADGE_HEIGHT; // unlabelled pin is a circle
  return Math.max(36, label.length * BADGE_CHAR_WIDTH + BADGE_H_PAD);
}

/* ── Assign rows to avoid overlap ──────────────────────────────── */
function assignRows(
  markers: PracticeMarker[],
  pixelsPerMs: number,
  scale: number
): { marker: PracticeMarker; row: number }[] {
  if (markers.length === 0) return [];

  const sorted = [...markers].sort((a, b) => a.atMs - b.atMs);
  const result: { marker: PracticeMarker; row: number; rightEdge: number }[] = [];

  // Track the right edge of the last badge in each row
  const rowRightEdges: number[] = [-Infinity, -Infinity];

  for (const m of sorted) {
    const centerX = m.atMs * pixelsPerMs * scale;
    const halfW = estimateBadgeWidth(m.label) / 2;
    const leftEdge = centerX - halfW;

    // Try row 0 first, then row 1
    let assignedRow = 0;
    if (leftEdge < rowRightEdges[0] + 4) {
      // Would overlap row 0, try row 1
      if (leftEdge < rowRightEdges[1] + 4) {
        // Overlaps both — still put on row 1 (least bad)
        assignedRow = 1;
      } else {
        assignedRow = 1;
      }
    }

    rowRightEdges[assignedRow] = centerX + halfW;
    result.push({ marker: m, row: assignedRow, rightEdge: centerX + halfW });
  }

  return result.map(({ marker, row }) => ({ marker, row }));
}

/* ── Individual badge with tap / longpress-drag gestures ────────── */

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
      if (onDragStateChange) {
        runOnJS(onDragStateChange)(true);
      }
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
      if (onDragStateChange) {
        runOnJS(onDragStateChange)(false);
      }
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(handleSeek)();
  });

  const composed = Gesture.Exclusive(panGesture, tapGesture);

  const topOffset = row * (BADGE_HEIGHT + ROW_GAP);

  const animatedStyle = useAnimatedStyle(() => {
    const timeMs = isDragging.value ? dragTimeMs.value : marker.atMs;
    const x = timeMs * pixelsPerMs * timelineScale.value + timelineTranslateX.value;
    return {
      transform: [
        { translateX: x },
        { translateX: -(badgeW / 2) },
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
          </View>
        ) : (
          <View style={badgeStyles.badgeCircle} />
        )}
      </Animated.View>
    </GestureDetector>
  );
}

/* ── Container: header + positioned badges ──────────────────────── */

export function PracticePinBadges({
  markers,
  pixelsPerMs,
  timelineTranslateX,
  timelineScale,
  durationMs,
  onSeek,
  onRepositionMarker,
  onRequestActions,
  onRequestAdd,
  onDragStateChange,
  draggingMarkerId,
  draggingMarkerX,
}: Props) {
  // We need current scale for collision detection — derive from shared value
  // For initial render, use 1; the animated positions handle the rest
  const rowAssignments = useMemo(
    () => assignRows(markers, pixelsPerMs, 1),
    [markers, pixelsPerMs]
  );

  const hasSecondRow = rowAssignments.some((r) => r.row === 1);
  const badgeAreaHeight = hasSecondRow
    ? BADGE_HEIGHT * 2 + ROW_GAP
    : BADGE_HEIGHT;

  return (
    <View style={badgeStyles.container}>
      {/* Header row: pin icon + title + add button */}
      <View style={badgeStyles.headerRow}>
        <Ionicons name="pin-outline" size={14} color="#b45309" />
        <Text style={badgeStyles.headerTitle}>Pins</Text>
        <Pressable
          style={({ pressed }) => [badgeStyles.addButton, pressed && { opacity: 0.6 }]}
          onPress={onRequestAdd}
          hitSlop={8}
        >
          <Ionicons name="add" size={14} color="#ca8a04" />
        </Pressable>
      </View>

      {/* Badge area */}
      <View style={[badgeStyles.badgeArea, { height: badgeAreaHeight }]}>
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
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  container: {
    overflow: "visible",
    marginTop: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: HEADER_HEIGHT,
    paddingLeft: 2,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#b45309",
  },
  addButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fef3c7",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  badgeArea: {
    position: "relative",
    overflow: "visible",
  },
  badgeWrap: {
    position: "absolute",
    height: BADGE_HEIGHT,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#fef3c7",
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#b45309",
  },
  badgeCircle: {
    width: BADGE_HEIGHT,
    height: BADGE_HEIGHT,
    borderRadius: BADGE_HEIGHT / 2,
    backgroundColor: "#fef3c7",
    borderWidth: 2,
    borderColor: "#fcd34d",
  },
});
