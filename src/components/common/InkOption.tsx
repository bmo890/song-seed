import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radii } from "../../design/tokens";
import { Press } from "./Press";

/**
 * Editorial ink (design-system: multi-select and on/off preferences): a word
 * led by a dot. Hollow = off, terracotta = on. The word names the THING, never
 * the state or the action ("Marks", not "Marks hidden" or "Hide marks"), so the
 * control cannot read backwards: lit means it is there.
 *
 * The same width in both states — flipping it never re-flows the row it is in.
 */
export type InkOptionProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  /** The dot's colour when on: a stage's or a tag's own ink. Terracotta by default. */
  ink?: string;
  style?: StyleProp<ViewStyle>;
  /** On a lane's name line under the reel: smaller type and dot, a 20 pt row
   *  (the 8 pt hit slop keeps it a finger's target). */
  compact?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

export function InkOption({
  label,
  selected,
  onPress,
  disabled,
  ink,
  style,
  compact = false,
  accessibilityLabel,
  testID,
}: InkOptionProps) {
  return (
    <Press
      // Haptics (haptics.ts): `light` — a small state flip.
      haptic="light"
      style={[s.row, compact ? s.rowCompact : null, style]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
    >
      <View
        style={[
          s.dot,
          compact ? s.dotCompact : null,
          selected ? s.dotOn : null,
          selected && ink ? { backgroundColor: ink, borderColor: ink } : null,
        ]}
      />
      <Text style={[s.label, compact ? s.labelCompact : null, selected ? s.labelOn : null]}>{label}</Text>
    </Press>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 32,
    alignSelf: "flex-start",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.round,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
  },
  dotOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  label: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textMuted,
  },
  labelOn: {
    color: colors.textStrong,
  },
  rowCompact: {
    gap: 5,
    minHeight: 20,
  },
  dotCompact: {
    width: 6,
    height: 6,
  },
  labelCompact: {
    fontSize: 11,
  },
});
