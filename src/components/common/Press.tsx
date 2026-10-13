import React from "react";
import {
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { haptic } from "../../design/haptics";

/**
 * The app's one press language (2026-10-13).
 *
 * Before this, a press looked three ways: `styles.pressDown` on surfaces,
 * `IconButton`'s own dip for bare glyphs, and whatever a file reached for.
 * `Press` is a `Pressable` that owns the felt press and its haptic, so every
 * tappable dips the same way and no call site restyles it.
 *
 *   feel="surface"  a filled thing: a chip, a row, a key. Barely dips.
 *   feel="glyph"    a bare icon on the page. Dims and dips, since there is no
 *                   fill to darken.
 *   feel="still"    a control that animates its own state (a switch). No dip;
 *                   the press is felt through the state change.
 *
 * Haptics (haptics.ts): `tap` by default — an acknowledged press. Pass
 * `haptic="none"` when the thing pressed fires its own (a toggle's `light`),
 * never to save the tick.
 */
export type PressFeel = "surface" | "glyph" | "still";
export type PressHaptic = "tap" | "light" | "grab" | "none";

export type PressProps = Omit<PressableProps, "style"> & {
  feel?: PressFeel;
  haptic?: PressHaptic;
  style?: StyleProp<ViewStyle>;
};

export function Press({
  feel = "surface",
  haptic: hapticVerb = "tap",
  style,
  disabled,
  onPress,
  children,
  ...rest
}: PressProps) {
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      style={({ pressed }) => [
        style,
        pressed && !disabled && feel !== "still" ? (feel === "glyph" ? s.glyphDown : s.surfaceDown) : null,
        disabled ? s.disabled : null,
      ]}
      onPress={(event: GestureResponderEvent) => {
        if (disabled) return;
        if (hapticVerb !== "none") haptic[hapticVerb]();
        onPress?.(event);
      }}
    >
      {children}
    </Pressable>
  );
}

const s = StyleSheet.create({
  surfaceDown: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  glyphDown: {
    opacity: 0.5,
    transform: [{ scale: 0.9 }],
  },
  disabled: {
    opacity: 0.35,
  },
});
