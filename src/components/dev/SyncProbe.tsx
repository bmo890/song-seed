import React from "react";
import { StyleSheet, View } from "react-native";
import { Canvas, Group, Rect } from "@shopify/react-native-skia";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withRepeat,
  withTiming,
  Easing,
  SharedValue,
} from "react-native-reanimated";
import { colors } from "../../design/tokens";

/**
 * TEMPORARY DIAGNOSTIC — not product UI, delete once the reel work lands.
 *
 * One shared value, animated by a single linear `withTiming`, driving a Skia Group
 * transform and an RN `useAnimatedStyle` transform side by side — the same arrangement
 * the reel uses for its canvas and its label overlays. Measured by recording the screen
 * and tracking both layers frame by frame; see docs/product-plan/reel-smoothness-findings.md.
 *
 * CHURN_MODE picks where a React commit lands while the animation runs:
 *   "none"    — no commits. The two layers stay glued to sd 0.34 px.
 *   "same"    — commits re-render the component holding both layers. Glue breaks (sd ~5 px).
 *   "sibling" — commits re-render only a sibling; the animated layers are memoised and
 *               never re-render. Answers whether isolating the reel is enough on its own.
 */
const CHURN_MODE: "none" | "same" | "sibling" = "none";
const CHURN_INTERVAL_MS = 200;

const STRIP_H = 90;
const PITCH = 140;
const MARKS = 12;
const SPAN = PITCH * 4;

const ProbeLayers = React.memo(function ProbeLayers({ tx }: { tx: SharedValue<number> }) {
  const skiaTransform = useDerivedValue(() => [{ translateX: tx.value }]);
  const rnStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  const marks = React.useMemo(() => Array.from({ length: MARKS }, (_, i) => i * PITCH), []);

  return (
    <>
      <Canvas style={StyleSheet.absoluteFill}>
        <Group transform={skiaTransform}>
          {marks.map((x) => (
            <Rect key={x} x={x} y={0} width={3} height={STRIP_H} color={colors.textStrong} />
          ))}
        </Group>
      </Canvas>
      <Animated.View style={[StyleSheet.absoluteFill, rnStyle]}>
        {marks.map((x) => (
          <View key={x} style={[probeStyles.mark, { left: x + 16 }]} />
        ))}
      </Animated.View>
    </>
  );
});

/** Commits on an interval without touching the animated layers. */
function Churner() {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), CHURN_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
  return <View style={[probeStyles.tick, { opacity: 0.001 + (tick % 2) * 0.001 }]} />;
}

export function SyncProbe() {
  const tx = useSharedValue(0);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    tx.value = withRepeat(
      withTiming(-SPAN, { duration: 3000, easing: Easing.linear }),
      -1,
      false
    );
  }, [tx]);

  React.useEffect(() => {
    if (CHURN_MODE !== "same") return;
    const id = setInterval(() => setTick((t) => t + 1), CHURN_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={probeStyles.strip} pointerEvents="none">
      <ProbeLayers tx={tx} />
      {CHURN_MODE === "sibling" ? <Churner /> : null}
      {CHURN_MODE === "same" ? (
        <View style={[probeStyles.tick, { opacity: 0.001 + (tick % 2) * 0.001 }]} />
      ) : null}
    </View>
  );
}

const probeStyles = StyleSheet.create({
  strip: {
    position: "absolute",
    top: 70,
    left: 0,
    right: 0,
    height: STRIP_H,
    backgroundColor: colors.surface,
    overflow: "hidden",
    zIndex: 9999,
  },
  tick: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 2,
    height: 2,
    backgroundColor: colors.textStrong,
  },
  mark: {
    position: "absolute",
    top: 0,
    width: 13,
    height: 14,
    backgroundColor: colors.textStrong,
  },
});
