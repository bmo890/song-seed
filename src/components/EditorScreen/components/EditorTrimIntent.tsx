import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "../../../design/tokens";
import { SegmentedControl } from "../../common/SegmentedControl";
import { CUT_COLOR, KEEP_COLOR, formatSelectionDuration } from "../helpers";
import { useTranslation } from "react-i18next";

type EditorTrimIntentProps = {
  intent: "keep" | "remove";
  /** Number of parts for the ACTIVE intent (kept parts when extracting, removed parts
   *  when cutting) — drives the outcome summary. */
  regionCount: number;
  removedMs: number;
  onSelectIntent: (intent: "keep" | "remove") => void;
};

/** Global intent for the whole trim: every part is either kept (each becomes a clip) or
 * removed (cut out, the rest joined into one clip). One colour, one outcome. */
export function EditorTrimIntent({
  intent,
  regionCount,
  removedMs,
  onSelectIntent,
}: EditorTrimIntentProps) {
  const { t } = useTranslation();
  const options = useMemo(
    () => [
      { key: "keep" as const, label: t("editor.keepParts") },
      { key: "remove" as const, label: t("editor.removeParts") },
    ],
    [t]
  );

  const keeping = intent === "keep";
  const outcome =
    regionCount === 0
      ? t("editor.markFirst")
      : keeping
        ? t("editor.extractOutcome", { count: regionCount })
        : t("editor.cutOutcome", { duration: formatSelectionDuration(removedMs) });
  const pipColor = regionCount === 0 ? colors.textMuted : keeping ? KEEP_COLOR : CUT_COLOR;

  return (
    <View style={s.wrap}>
      <SegmentedControl options={options} value={intent} onChange={onSelectIntent} />
      <View style={s.outcomeRow}>
        <View style={[s.pip, { backgroundColor: pipColor }]} />
        <Text style={s.outcomeText}>{outcome}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, gap: spacing.sm },
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
