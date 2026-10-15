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

/** A quiet caps label over a menu section ("SHOW", "SORT BY"). */
export function PopoverMenuLabel({ children, trailing }: { children: string; trailing?: ReactNode }) {
  return (
    <View style={s.labelRow}>
      <Text style={s.sectionLabel}>{children}</Text>
      {trailing ?? null}
    </View>
  );
}

/** A section's body, inset like the rows. */
export function PopoverMenuSection({ children, wrap = false }: { children: ReactNode; wrap?: boolean }) {
  return <View style={wrap ? s.wrap : s.section}>{children}</View>;
}

/**
 * One choice of several (a sort field): an ink dot, filled terracotta on the
 * chosen one, and the word at full weight. The single-select sibling of
 * InkOption, for lists too long for a SegmentedControl.
 */
export function PopoverRadioRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Press
      feel="surface"
      // haptics.ts: tap → a control changed value.
      haptic="tap"
      style={s.radioRow}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <View style={[s.radioDot, selected ? s.radioDotOn : null]} />
      <Text style={[s.label, selected ? s.labelOn : null]} numberOfLines={1}>
        {label}
      </Text>
    </Press>
  );
}

/** The menu's one way out of a state ("Clear filters"), quiet ink at its foot. */
export function PopoverMenuFootLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <View style={s.foot}>
      <Press feel="glyph" haptic="tap" onPress={onPress} hitSlop={8} accessibilityRole="button">
        <Text style={s.footText}>{label}</Text>
      </Press>
    </View>
  );
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
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  sectionLabel: {
    flex: 1,
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: spacing.lg,
    rowGap: 2,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 40,
    paddingHorizontal: spacing.lg,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
  },
  radioDotOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  labelOn: {
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  foot: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  footText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.primaryDeep,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderMuted,
    marginVertical: spacing.xs,
    marginHorizontal: spacing.lg,
  },
});
