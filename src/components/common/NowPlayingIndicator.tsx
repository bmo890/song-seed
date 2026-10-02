import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Canvas, RoundedRect } from "@shopify/react-native-skia";
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useAppInForeground } from "../../hooks/useAppForeground";

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

const BAR_WIDTH = 3;
const BAR_GAP = 2;
const BARS_WIDTH = BARS.length * BAR_WIDTH + (BARS.length - 1) * BAR_GAP;

/** One bar's level, 0..1 of the full height, looping while the app is on screen. */
function useBarLevel(bar: (typeof BARS)[number], foreground: boolean): SharedValue<number> {
  const level = useSharedValue(bar.trough);
  const { peak, trough, phase } = bar;

  useEffect(() => {
    // A repeating animation asks for a frame, every frame, screen on or off.
    if (!foreground) return;
    const half = CYCLE_MS / 2;
    level.value = withDelay(
      phase,
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
  }, [foreground, level, peak, trough, phase]);

  return level;
}

function useBarGeometry(level: SharedValue<number>, maxHeight: number) {
  const height = useDerivedValue(() => Math.max(2, maxHeight * level.value));
  const y = useDerivedValue(() => maxHeight - height.value);
  return { height, y };
}

/**
 * The bars are drawn in one small Skia canvas rather than as three animated views.
 * A Reanimated style that moves every frame is committed through the whole view
 * tree every frame (and an animated HEIGHT re-lays it out as well); the bars run
 * for as long as anything plays, so that was most of the cost of playback with
 * the player docked (2026-10-02). A canvas redraws itself and nothing else.
 */
function PlayingBars({ color, size }: { color: string; size: number }) {
  const foreground = useAppInForeground();
  const first = useBarGeometry(useBarLevel(BARS[0]!, foreground), size);
  const second = useBarGeometry(useBarLevel(BARS[1]!, foreground), size);
  const third = useBarGeometry(useBarLevel(BARS[2]!, foreground), size);
  const width = size + 2;
  const left = (width - BARS_WIDTH) / 2;

  return (
    <Canvas style={{ width, height: size }}>
      {[first, second, third].map((bar, index) => (
        <RoundedRect
          key={index}
          x={left + index * (BAR_WIDTH + BAR_GAP)}
          y={bar.y}
          width={BAR_WIDTH}
          height={bar.height}
          r={BAR_WIDTH / 2}
          color={color}
        />
      ))}
    </Canvas>
  );
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

  return <PlayingBars color={color} size={size} />;
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
});
