import React from "react";
import { I18nManager, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from "react-native-reanimated";
import { colors, radii, shadows } from "../../design/tokens";
import { durations } from "../../design/motion";
import { Press } from "./Press";

/**
 * The app's switch — in place of the platform `Switch` and the hand-made
 * `switchShell` the loop and step-up rows carried.
 *
 * Shell 46×28, knob 22: the same paper knob the Slider's thumb is, so a knob
 * means one thing everywhere. The knob slides and the shell tints over
 * `durations.base`; nothing pops. Haptics (haptics.ts): `light` — a small
 * state flip — owned here, so no row fires its own.
 */
export type SwitchProps = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  /** `danger` for a toggle that arms destruction (delete the original after
   *  export): the on-state tints brick instead of terracotta. */
  tone?: "accent" | "danger";
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const SHELL_W = 46;
const SHELL_H = 28;
const KNOB = 22;
const PAD = 3;
// The knob starts at the leading edge, which is the right in Hebrew, so it
// travels toward the trailing edge: negative x there (2026-10-21: it slid out
// of the shell, the same flip SegmentedControl's rule makes).
const TRAVEL = (SHELL_W - KNOB - PAD * 2) * (I18nManager.isRTL ? -1 : 1);

export function Switch({
  value,
  onValueChange,
  tone = "accent",
  disabled = false,
  accessibilityLabel,
  style,
  testID,
}: SwitchProps) {
  // Derived from the prop, never assigned from an effect: the first frame is right.
  const progress = useDerivedValue(() => withTiming(value ? 1 : 0, { duration: durations.base }));
  const onColor = tone === "danger" ? colors.danger : colors.primary;

  const shellStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.surfaceHigh, onColor]),
  }));
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * TRAVEL }],
  }));

  return (
    <Press
      feel="still"
      haptic="light"
      style={[s.touch, style]}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={6}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <Animated.View style={[s.shell, shellStyle]}>
        <Animated.View style={[s.knob, knobStyle]} />
      </Animated.View>
    </Press>
  );
}

const s = StyleSheet.create({
  touch: {
    justifyContent: "center",
  },
  shell: {
    width: SHELL_W,
    height: SHELL_H,
    borderRadius: radii.round,
    padding: PAD,
    justifyContent: "center",
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    ...shadows.control,
  },
});
