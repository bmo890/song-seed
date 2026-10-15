import type { ComponentProps, ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Press, type PressHaptic } from "./Press";
import { dirIcon } from "../../design/directionalIcons";
import { colors, spacing } from "../../design/tokens";

/**
 * A row in a "…" popover (2026-10-15): the same language as the action sheet,
 * a glyph then a word, no box and no hairline between rows. A hairline
 * (`PopoverMenuRule`) only separates groups, and always sits above the
 * destructive row. Order rule: see SelectionActionSheet.
 */
export function PopoverMenuRow({
  icon,
  renderIcon,
  label,
  onPress,
  tone = "default",
  disabled,
  trailing,
  haptic = "tap",
  testID,
}: {
  icon?: ComponentProps<typeof Ionicons>["name"];
  /** A composite glyph (the sketch disc with its "+"), drawn in the row's ink. */
  renderIcon?: (color: string) => ReactNode;
  label: string;
  onPress: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
  /** A control that lives on the row (a switch), never a second glyph. */
  trailing?: ReactNode;
  haptic?: PressHaptic;
  testID?: string;
}) {
  const ink = disabled ? colors.textMuted : tone === "danger" ? colors.danger : colors.textStrong;
  return (
    <Press
      feel="surface"
      haptic={haptic}
      style={[s.row, disabled ? s.disabled : null]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      {renderIcon ? renderIcon(ink) : icon ? <Ionicons name={dirIcon(icon)} size={18} color={ink} /> : null}
      <Text
        style={[s.label, tone === "danger" && !disabled ? s.labelDanger : null]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {trailing ?? null}
    </Press>
  );
}

export function PopoverMenuRule() {
  return <View style={s.rule} />;
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  label: {
    flex: 1,
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 15,
    color: colors.textPrimary,
  },
  labelDanger: {
    color: colors.danger,
  },
  disabled: {
    opacity: 0.45,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderMuted,
    marginVertical: spacing.xs,
    marginHorizontal: spacing.lg,
  },
});
