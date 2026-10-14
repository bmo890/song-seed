import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useDerivedValue, withTiming } from "react-native-reanimated";
import { colors, radii } from "../../design/tokens";
import { durations } from "../../design/motion";
import { Press } from "./Press";

/**
 * A lit key: a piece of gear (Sound room, 2026-10-14). A quiet white box on the
 * paper with a small lamp at its leading edge. Off, the lamp is a dim bead and the
 * word is grey. On, the lamp glows terracotta and the word darkens. The box itself
 * never changes, so a lit key and an unlit key sit as equals, the way switches do
 * on a desk.
 *
 * This is the one boxed toggle in the app, and it earns the box by being the one
 * control that is equipment: tone presets, and the Layers bench's switches. Every
 * other on/off stays editorial ink (`InkOption`).
 *
 * Haptics (haptics.ts): `light` on press — a small state flip that lands under the
 * thumb; owned by `Press`. The lamp lights on release, not on touch, so a slip off
 * the key leaves it as it was. Its glow is a `durations.fast` fade; nothing moves.
 */
export type LitKeyProps = {
  label: string;
  on: boolean;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

export function LitKey({ label, on, onPress, disabled, style, accessibilityLabel, testID }: LitKeyProps) {
  const lit = useDerivedValue(() => withTiming(on ? 1 : 0, { duration: durations.fast }), [on]);
  const lampStyle = useAnimatedStyle(() => ({ opacity: lit.value }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: lit.value * 0.22 }));

  return (
    <Press
      haptic="light"
      style={[s.key, style]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
    >
      <View style={s.lampSeat}>
        <Animated.View style={[s.halo, haloStyle]} />
        <View style={s.bead} />
        <Animated.View style={[s.lamp, lampStyle]} />
      </View>
      <Text style={[s.label, on ? s.labelOn : null]} numberOfLines={1}>
        {label}
      </Text>
    </Press>
  );
}

const LAMP = 6;
const HALO = 12;

const s = StyleSheet.create({
  key: {
    height: 36,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    minWidth: 0,
  },
  lampSeat: {
    width: HALO,
    height: HALO,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    width: HALO,
    height: HALO,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
  },
  bead: {
    position: "absolute",
    width: LAMP,
    height: LAMP,
    borderRadius: radii.round,
    backgroundColor: colors.borderMuted,
  },
  lamp: {
    position: "absolute",
    width: LAMP,
    height: LAMP,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
  },
  label: {
    flexShrink: 1,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textSecondary,
  },
  labelOn: {
    color: colors.textStrong,
  },
});
