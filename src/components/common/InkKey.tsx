import type { ReactNode } from "react";
import { StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { Press, type PressHaptic } from "./Press";
import { colors } from "../../design/tokens";

/**
 * A key in ink (2026-10-15, founder picked "Ink"): a glyph and a word, no fill,
 * no box. The toolbar's secondary actions and toggles (the player's Marks,
 * Layer and Tools) read as one line of ink beside each other instead of grey
 * soft keys. Active is terracotta ink, the state colour; idle is ink; off (a
 * toggle that is switched off) recedes to muted.
 *
 * The caller hands in the glyph so it can colour it from `inkKeyColor(tone)`;
 * `haptic` follows the vocabulary (a toggle is `light`, an action `tap`).
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
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}) {
  return (
    <Press
      feel="glyph"
      haptic={haptic}
      style={[s.key, style]}
      onPress={onPress}
      hitSlop={6}
      accessibilityRole={role}
      accessibilityState={role === "switch" ? { checked: tone === "active" } : { selected: tone === "active" }}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
    >
      {glyph}
      <Text style={[s.label, tone === "active" ? s.labelActive : null, { color: inkKeyColor(tone) }]}>
        {label}
      </Text>
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
  labelActive: {
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
});
