import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

// One fixed cycle length shared by every bar, so the three run a single steady
// rolling loop forever — no per-bar period differences to make them drift, and
// no random keyframes. Each bar just oscillates between its own trough and peak,
// evenly phase-staggered (0, ⅓, ⅔ of the cycle) so they never converge into a
// unified jump. This is the exact loop they start on, repeated identically.
const CYCLE_MS = 820;
const BARS = [
  { peak: 1.0, trough: 0.34, phase: 0 },
  { peak: 0.72, trough: 0.3, phase: CYCLE_MS / 3 },
  { peak: 0.9, trough: 0.42, phase: (CYCLE_MS * 2) / 3 },
];

function IndicatorBar({
  color,
  maxHeight,
  peak,
  trough,
  phaseMs,
}: {
  color: string;
  maxHeight: number;
  peak: number;
  trough: number;
  phaseMs: number;
}) {
  const level = useSharedValue(trough);

  useEffect(() => {
    const half = CYCLE_MS / 2;
    level.value = withDelay(
      phaseMs,
      withRepeat(
        withSequence(
          withTiming(peak, { duration: half, easing: Easing.inOut(Easing.sin) }),
          withTiming(trough, { duration: half, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );
    return () => cancelAnimation(level);
  }, [level, peak, trough, phaseMs]);

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
      {BARS.map((bar, index) => (
        <IndicatorBar
          key={index}
          color={color}
          maxHeight={size}
          peak={bar.peak}
          trough={bar.trough}
          phaseMs={bar.phase}
        />
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
