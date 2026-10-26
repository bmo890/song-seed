import React from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  SharedValue,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { haptic } from "../../design/haptics";
import { colors } from "../../design/tokens";
import { springs } from "../../design/motion";

/**
 * The bar under the reel that carries a range whole: the player's loop, and the
 * clip editor's held part (2026-10-16, founder: "mimic the looper exactly").
 * Hold it (220 ms) and slide; the range keeps its length and lands on release.
 * Drawn below the reel's surface, centred on the range, following zoom and scroll.
 */
const LOOP_MOVE_PILL_WIDTH = 34;
const LOOP_MOVE_PILL_HEIGHT = 10;
const LOOP_MOVE_HITBOX_WIDTH = 52;
const LOOP_MOVE_HITBOX_HEIGHT = 24;
const LOOP_MOVE_ROW_HEIGHT = 14;
const LOOP_ACCENT = "rgba(139, 79, 59, 0.95)";

export function LoopMoveHandle({
  range,
  durationMs,
  pixelsPerMs,
  timelineTranslateX,
  timelineScale,
  sharedPreviewStartMs,
  sharedPreviewEndMs,
  onRangeChange,
  onScrubStateChange,
  quiet = false,
  ink,
}: {
  range: { start: number; end: number };
  durationMs: number;
  pixelsPerMs: number;
  timelineTranslateX: SharedValue<number>;
  timelineScale: SharedValue<number>;
  sharedPreviewStartMs: SharedValue<number>;
  sharedPreviewEndMs: SharedValue<number>;
  onRangeChange: (start: number, end: number) => void;
  onScrubStateChange: (scrubbing: boolean) => void;
  /** Lanes look: a slim terracotta bar, no shadow and no inner grip. */
  quiet?: boolean;
  /** The range's own ink where it is not the loop's (a removed part is danger). */
  ink?: string;
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
      onRangeChange(startMs, endMs);
      onScrubStateChange(false);
    },
    [onRangeChange, onScrubStateChange]
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
            style={[
              quiet ? timelineStyles.loopMoveBar : timelineStyles.loopMovePill,
              ink ? { backgroundColor: ink } : null,
              pillStyle,
            ]}
          >
            {quiet ? null : <View style={timelineStyles.loopMoveGrip} />}
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const timelineStyles = StyleSheet.create({
  loopMoveRow: {
    height: LOOP_MOVE_ROW_HEIGHT,
    overflow: "visible",
    marginTop: -4,
    marginBottom: 0,
  },
  // Placed from the physical left, like the reel it rides (time runs left to
  // right in every language); without it the hitbox started at the right edge
  // in Hebrew and the translate pushed it off the loop.
  loopMoveHitbox: {
    position: "absolute",
    left: 0,
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
