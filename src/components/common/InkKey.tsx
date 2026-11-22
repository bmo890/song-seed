import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Press, type PressHaptic } from "./Press";
import { colors } from "../../design/tokens";
import { ProMarkText } from "./ProMark";

/**
 * A key in ink (2026-10-15, founder picked "Ink"): a glyph and a word, no fill,
 * no box. The toolbar's secondary actions and toggles (the player's Marks,
 * Layer and Tools) read as one line of ink beside each other instead of grey
 * soft keys. Active is terracotta ink, the state colour; idle is ink; off (a
 * toggle that is switched off) recedes to muted.
 *
 * The caller hands in the glyph so it can colour it from `inkKeyColor(tone)`;
 * `haptic` follows the vocabulary (a toggle is `light`, an action `tap`).
 *
 * `opens` is for a key that opens a panel beneath it (Tools): while active it
 * also wears the ink tabs' 2 pt rule under its word, in terracotta, so an open
 * panel reads as open at a glance rather than by colour alone (founder,
 * 2026-10-21).
 */
export type InkKeyTone = "idle" | "active" | "off";

export function inkKeyColor(tone: InkKeyTone): string {
  if (tone === "active") return colors.primaryDeep;
  if (tone === "off") return colors.textMuted;
  return colors.textStrong;
}

export function InkKey({
  glyph,
  label,
  tone = "idle",
  onPress,
  haptic = "tap",
  role = "button",
  opens = false,
  pro = false,
  disabled = false,
  size = "regular",
  style,
  accessibilityLabel,
  testID,
}: {
  glyph: ReactNode;
  label: string;
  tone?: InkKeyTone;
  onPress: () => void;
  haptic?: PressHaptic;
  /** A toggle reports itself as a switch, checked while active. */
  role?: "button" | "switch";
  opens?: boolean;
  /** The key opens the Pro page for this person: the Pro mark follows its word
   *  (the caller asks `useProLocked`, so mark and gate agree). */
  pro?: boolean;
  /** Holds its state but takes no press (a per-take choice while the take rolls). */
  disabled?: boolean;
  /** "small" (2026-11-22): the recorder's Ready row, beside the metronome's quiet chip,
   *  where a full-size key out-shouts the controls around it. Same anatomy, smaller. */
  size?: "regular" | "small";
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}) {
  return (
    <Press
      feel="glyph"
      haptic={haptic}
      style={[s.key, size === "small" ? s.keySmall : null, style]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole={role}
      accessibilityState={role === "switch" ? { checked: tone === "active" } : { selected: tone === "active" }}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
    >
      {glyph}
      <Text
        style={[
          s.label,
          size === "small" ? s.labelSmall : null,
          tone === "active" ? s.labelActive : null,
          { color: inkKeyColor(tone) },
        ]}
      >
        {label}
      </Text>
      {pro ? <ProMarkText /> : null}
      {opens && tone === "active" ? <View style={s.openRule} /> : null}
    </Press>
  );
}

const s = StyleSheet.create({
  key: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 44,
  },
  label: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 15,
  },
  keySmall: {
    gap: 5,
    minHeight: 30,
  },
  labelSmall: {
    fontSize: 12,
  },
  labelActive: {
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  openRule: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 4,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.primary,
  },
});
