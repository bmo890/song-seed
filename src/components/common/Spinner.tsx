import React, { useEffect } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { colors, radii } from "../../design/tokens";
import { durations } from "../../design/motion";

/**
 * The app's spinner — a hairline arc turning once per `durations.spin`, in
 * place of the platform ActivityIndicator, which is the system's widget and
 * looks different on each OS. Quiet on purpose: waiting is not an event.
 *
 * The API mirrors what the old call sites passed (`size`, `color`) so the
 * swap was mechanical.
 */
export type SpinnerProps = {
  size?: "small" | "large" | number;
  color?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const SIZES = { small: 18, large: 30 } as const;

export function Spinner({ size = "small", color = colors.primary, accessibilityLabel, style }: SpinnerProps) {
  const px = typeof size === "number" ? size : SIZES[size];
  const turn = useSharedValue(0);

  useEffect(() => {
    turn.value = withRepeat(withTiming(1, { duration: durations.spin, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(turn);
  }, [turn]);

  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));

  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      style={[
        s.arc,
        { width: px, height: px, borderWidth: px >= 24 ? 2 : 1.5, borderTopColor: color },
        spin,
        style,
      ]}
    />
  );
}

const s = StyleSheet.create({
  // Three quiet sides and one inked: the arc is the top border.
  arc: {
    borderRadius: radii.round,
    borderColor: colors.borderSubtle,
  },
});
