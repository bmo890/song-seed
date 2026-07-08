import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const BAR_COUNT = 3;
const PHASE_DELAYS_MS = [0, 140, 70];

function IndicatorBar({
  color,
  maxHeight,
  delayMs,
}: {
  color: string;
  maxHeight: number;
  delayMs: number;
}) {
  const level = useSharedValue(0.5);

  useEffect(() => {
    level.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 260 }),
          withTiming(0.3, { duration: 230 }),
          withTiming(0.8, { duration: 210 }),
          withTiming(0.45, { duration: 250 })
        ),
        -1,
        true
      )
    );
    return () => cancelAnimation(level);
  }, [delayMs, level]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: Math.max(2, maxHeight * level.value),
  }));

  return <Animated.View style={[indicatorStyles.bar, { backgroundColor: color }, animatedStyle]} />;
}

/**
 * The "this row is playing" mark: three small EQ bars that bounce while audio
 * plays. Paused swaps to a plain pause glyph — a clean state change rather than
 * an animation that merely stops, so playing vs. paused reads unambiguously at
 * a glance. Used in the queue panel and playlist track rows.
 */
export function NowPlayingIndicator({
  playing,
  color,
  size = 14,
}: {
  playing: boolean;
  color: string;
  size?: number;
}) {
  if (!playing) {
    return (
      <View style={[indicatorStyles.wrap, indicatorStyles.wrapCentered, { height: size, width: size + 2 }]}>
        <Ionicons name="pause" size={size} color={color} />
      </View>
    );
  }

  return (
    <View style={[indicatorStyles.wrap, { height: size, width: size + 2 }]}>
      {Array.from({ length: BAR_COUNT }, (_, index) => (
        <IndicatorBar key={index} color={color} maxHeight={size} delayMs={PHASE_DELAYS_MS[index]} />
      ))}
    </View>
  );
}

const indicatorStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 2,
  },
  wrapCentered: {
    alignItems: "center",
  },
  bar: {
    width: 3,
    borderRadius: 1.5,
  },
});
