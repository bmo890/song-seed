import React, { useCallback } from "react";
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
const BADGE_EST_WIDTH = 60; // estimated half-width for centering

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
  draggingMarkerId: SharedValue<string>;
  draggingMarkerX: SharedValue<number>;
};

/* ── Individual badge with tap / longpress-drag gestures ────────── */

function PinBadge({
  marker,
  pixelsPerMs,
  timelineTranslateX,
  timelineScale,
  durationMs,
  onSeek,
  onRepositionMarker,
  onRequestActions,
  draggingMarkerId,
  draggingMarkerX,
}: Omit<Props, "markers" | "onRequestAdd"> & { marker: PracticeMarker }) {
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
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(handleSeek)();
  });

  const composed = Gesture.Exclusive(panGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => {
    const timeMs = isDragging.value ? dragTimeMs.value : marker.atMs;
    const x = timeMs * pixelsPerMs * timelineScale.value + timelineTranslateX.value;
    return {
      transform: [
        { translateX: x },
        { translateX: -BADGE_EST_WIDTH / 2 },
        { scale: withSpring(isDragging.value ? 1.1 : 1, { damping: 20, stiffness: 300 }) },
      ],
      zIndex: isDragging.value ? 10 : 0,
    };
  });

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[badgeStyles.badgeWrap, animatedStyle]}>
        <View style={badgeStyles.badge}>
          <Text style={badgeStyles.badgeText} numberOfLines={1}>
            {marker.label}
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

/* ── Container: renders all badges + add button ─────────────────── */

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
  draggingMarkerId,
  draggingMarkerX,
}: Props) {
  return (
    <View style={badgeStyles.container}>
      {markers.map((marker) => (
        <PinBadge
          key={marker.id}
          marker={marker}
          pixelsPerMs={pixelsPerMs}
          timelineTranslateX={timelineTranslateX}
          timelineScale={timelineScale}
          durationMs={durationMs}
          onSeek={onSeek}
          onRepositionMarker={onRepositionMarker}
          onRequestActions={onRequestActions}
          draggingMarkerId={draggingMarkerId}
          draggingMarkerX={draggingMarkerX}
        />
      ))}
      <Pressable
        style={({ pressed }) => [badgeStyles.addButton, pressed && { opacity: 0.6 }]}
        onPress={onRequestAdd}
        hitSlop={8}
      >
        <Ionicons name="add" size={14} color="#ca8a04" />
      </Pressable>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  container: {
    position: "relative",
    height: BADGE_HEIGHT + 8,
    overflow: "visible",
    marginTop: 2,
  },
  badgeWrap: {
    position: "absolute",
    top: 4,
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
  addButton: {
    position: "absolute",
    right: 0,
    top: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fef3c7",
    alignItems: "center",
    justifyContent: "center",
  },
});
