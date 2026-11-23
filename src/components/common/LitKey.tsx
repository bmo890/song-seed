import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useDerivedValue, withTiming } from "react-native-reanimated";
import { colors, radii, shadows } from "../../design/tokens";
import { durations } from "../../design/motion";
import { hexToRgba } from "../../domain/playerSections";
import { Press } from "./Press";

/**
 * A lit key: a piece of gear, the key of a channel strip (first drawn 2026-10-14;
 * this look founder, 2026-11-23: "more like a mixer - like a button with a light when
 * its engaged - 'pressed down' with the right shadow when pressed").
 *
 * Out, it is a quiet raised key: paper white on the page, a whisper of shadow, its lamp
 * dark over its word. In, it sits pressed: the shadow goes, the face sinks a tone with a
 * shade along its top edge (the inside of the well), the word drops a point into full
 * ink, and the lamp lights terracotta inside a soft halo. The lamp is the only colour,
 * so rows of keys stay calm until one is on.
 *
 * This is the one boxed toggle in the app, and it earns the box by being the one
 * control that is equipment: the EQ's Boost and Cut keys. Every other on/off stays
 * editorial ink (`InkOption`, `InkKey`) or a `Switch`.
 *
 * Haptics (haptics.ts): `light` on press, a small state flip that lands under the
 * thumb; owned by `Press`. The lamp lights on release, not on touch, so a slip off
 * the key leaves it as it was. Its glow is a `durations.fast` fade.
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

/** Room for the lamp over its word. A gap left for a missing key takes the same height. */
export const LIT_KEY_HEIGHT = 46;

export function LitKey({ label, on, onPress, disabled, style, accessibilityLabel, testID }: LitKeyProps) {
  const lit = useDerivedValue(() => withTiming(on ? 1 : 0, { duration: durations.fast }), [on]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: lit.value }));

  return (
    <Press
      feel="surface"
      haptic="light"
      style={[s.key, on ? s.keyIn : s.keyOut, style]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
    >
      {on ? <View style={s.shade} pointerEvents="none" /> : null}
      <View style={[s.face, on ? s.faceIn : null]}>
        <View style={s.lampSeat}>
          <Animated.View style={[s.halo, glowStyle]} />
          <View style={s.bead} />
          <Animated.View style={[s.lamp, glowStyle]} />
        </View>
        <Text style={[s.label, on ? s.labelOn : null]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Press>
  );
}

const LAMP = 6;
const HALO = 12;

const s = StyleSheet.create({
  key: {
    minHeight: LIT_KEY_HEIGHT,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  // Out: lifted paper.
  keyOut: {
    backgroundColor: colors.surface,
    borderColor: hexToRgba(colors.textPrimary, 0.08),
    ...shadows.control,
    // The shadow needs the key's own shape, not a clip.
    overflow: "visible",
  },
  // In: the well it was pressed into.
  keyIn: {
    backgroundColor: colors.surfaceHigh,
    borderColor: hexToRgba(colors.textPrimary, 0.1),
  },
  // The shade under the well's top lip.
  shade: {
    position: "absolute",
    top: 0,
    start: 0,
    end: 0,
    height: 3,
    backgroundColor: hexToRgba(colors.textPrimary, 0.07),
  },
  face: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  faceIn: {
    transform: [{ translateY: 1 }],
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
    backgroundColor: hexToRgba(colors.primary, 0.32),
  },
  // The lamp, dark.
  bead: {
    position: "absolute",
    width: LAMP,
    height: LAMP,
    borderRadius: radii.round,
    backgroundColor: hexToRgba(colors.textPrimary, 0.14),
  },
  // The lamp, lit: fades in over the bead.
  lamp: {
    position: "absolute",
    width: LAMP,
    height: LAMP,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
  },
  label: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  labelOn: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textPrimary,
  },
});
