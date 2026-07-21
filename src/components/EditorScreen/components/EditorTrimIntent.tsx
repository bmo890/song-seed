import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii } from "../../../design/tokens";
import { styles as appStyles } from "../../../styles";
import { CUT_COLOR, KEEP_COLOR, formatSelectionDuration } from "../helpers";
import { useTranslation } from "react-i18next";

type EditorTrimIntentProps = {
  intent: "keep" | "remove";
  /** Number of regions for the ACTIVE intent (keep regions when extracting,
   *  cut regions when cutting) — drives the outcome summary. */
  regionCount: number;
  removedMs: number;
  onSelectIntent: (intent: "keep" | "remove") => void;
};

/** Global intent for the whole trim: every region is either kept (each becomes a
 * clip) or cut (removed, the rest joined into one clip). One color, one outcome. */
export function EditorTrimIntent({
  intent,
  regionCount,
  removedMs,
  onSelectIntent,
}: EditorTrimIntentProps) {
  const { t } = useTranslation();
  const keepActive = intent === "keep";
  const cutActive = intent === "remove";

  const outcome =
    regionCount === 0
      ? t("editor.markFirst")
      : keepActive
        ? t("editor.extractOutcome", { count: regionCount })
        : t("editor.cutOutcome", { duration: formatSelectionDuration(removedMs) });
  const pipColor = regionCount === 0 ? colors.textMuted : keepActive ? KEEP_COLOR : CUT_COLOR;

  return (
    <View style={s.wrap}>
      <View style={s.seg}>
        <Pressable
          style={({ pressed }) => [s.segItem, keepActive ? s.segItemActive : null, pressed ? appStyles.pressDown : null]}
          onPress={() => onSelectIntent("keep")}
          accessibilityRole="button"
          accessibilityState={{ selected: keepActive }}
        >
          <Ionicons name="bookmark-outline" size={14} color={keepActive ? KEEP_COLOR : colors.textSecondary} />
          <Text style={[s.segText, keepActive ? { color: KEEP_COLOR } : null]}>{t("editor.extract")}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [s.segItem, cutActive ? s.segItemActive : null, pressed ? appStyles.pressDown : null]}
          onPress={() => onSelectIntent("remove")}
          accessibilityRole="button"
          accessibilityState={{ selected: cutActive }}
        >
          <Ionicons name="cut-outline" size={14} color={cutActive ? CUT_COLOR : colors.textSecondary} />
          <Text style={[s.segText, cutActive ? { color: CUT_COLOR } : null]}>{t("editor.cut")}</Text>
        </Pressable>
      </View>

      <View style={s.outcomeRow}>
        <View style={[s.pip, { backgroundColor: pipColor }]} />
        <Text style={s.outcomeText}>{outcome}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 16, gap: 8 },
  seg: {
    flexDirection: "row",
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.round,
    padding: 3,
  },
  segItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: radii.round,
  },
  segItemActive: {
    backgroundColor: colors.surface,
  },
  segText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textSecondary,
  },
  outcomeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 2,
  },
  pip: { width: 8, height: 8, borderRadius: radii.round },
  outcomeText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.textSecondary,
  },
});
