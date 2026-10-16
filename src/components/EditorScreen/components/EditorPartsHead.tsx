import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Press } from "../../common/Press";
import { colors, radii, spacing } from "../../../design/tokens";
import { useTranslation } from "react-i18next";

/**
 * The Parts line (2026-10-16): a quiet count, "Keep to grid" in editorial ink
 * where the clip has a grid, and the add link. Keep or remove now lives in the
 * page's one row of tabs, and the outcome is said by the save key and sheet.
 */
export function EditorPartsHead({
  count,
  gridAvailable,
  keepToGrid,
  onToggleKeepToGrid,
  addLabel,
  onAdd,
}: {
  count: number;
  /** Only offered when the clip actually has a metronome grid to keep. */
  gridAvailable: boolean;
  keepToGrid: boolean;
  onToggleKeepToGrid: () => void;
  /** "Add part", or "Split here" when the playhead sits inside a part. */
  addLabel: string;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={s.row}>
      <Text style={s.label}>
        {count > 0 ? t("editor.partsCount", { count }) : t("editor.parts")}
      </Text>
      {gridAvailable ? (
        <Press
          // Haptics vocabulary: light, a small state flip.
          haptic="light"
          feel="glyph"
          style={s.ink}
          onPress={onToggleKeepToGrid}
          accessibilityRole="switch"
          accessibilityState={{ checked: keepToGrid }}
          hitSlop={8}
        >
          <View style={[s.dot, keepToGrid ? s.dotOn : null]} />
          <Text style={[s.inkText, keepToGrid ? s.inkTextOn : null]}>{t("editor.keepToGrid")}</Text>
        </Press>
      ) : null}
      <Press
        // Haptics vocabulary: light, a part added is a small state change.
        haptic="light"
        feel="glyph"
        style={s.add}
        onPress={onAdd}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={addLabel}
      >
        <Ionicons name="add" size={14} color={colors.primaryDeep} />
        <Text style={s.addText}>{addLabel}</Text>
      </Press>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  label: {
    flex: 1,
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  ink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.round,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
  },
  dotOn: {
    backgroundColor: colors.primaryDeep,
    borderColor: colors.primaryDeep,
  },
  inkText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    color: colors.textMuted,
  },
  inkTextOn: {
    color: colors.primaryDeep,
  },
  add: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primaryDeep,
  },
});
