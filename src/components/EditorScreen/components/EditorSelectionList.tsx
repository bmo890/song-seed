import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { fmt, fmtDuration } from "../../../utils";
import { colors, radii } from "../../../design/tokens";
import { styles as appStyles } from "../../../styles";
import { hexToRgba } from "../../../domain/playerSections";
import { CUT_COLOR, KEEP_COLOR, type EditableSelection } from "../helpers";
import { useTranslation } from "react-i18next";

type EditorSelectionListProps = {
  selectedRanges: EditableSelection[];
  intent: "keep" | "remove";
  selectedRangeId: string | null;
  onSelectRange: (range: EditableSelection) => void;
  onRemoveRange: (id: string) => void;
};

/** The parts of the clip, in time order. Tapping one selects it — which cues the
 * playhead and opens the inspector beneath — so the row itself is the control; the
 * accent and index colour carry the current keep/remove intent. */
export function EditorSelectionList({
  selectedRanges,
  intent,
  selectedRangeId,
  onSelectRange,
  onRemoveRange,
}: EditorSelectionListProps) {
  const { t } = useTranslation();
  if (selectedRanges.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyTitle}>{t("editor.noPartsTitle")}</Text>
        <Text style={s.emptyText}>{t("editor.noPartsBody")}</Text>
      </View>
    );
  }

  const accent = intent === "keep" ? KEEP_COLOR : CUT_COLOR;
  const ordered = [...selectedRanges].sort((a, b) => a.start - b.start);

  return (
    <View style={s.wrap}>
      {ordered.map((range, index) => {
        const selected = range.id === selectedRangeId;
        return (
          <Pressable
            key={range.id}
            onPress={() => onSelectRange(range)}
            style={({ pressed }) => [
              s.row,
              { borderLeftColor: accent },
              selected
                ? { backgroundColor: hexToRgba(accent, 0.08), borderColor: hexToRgba(accent, 0.35) }
                : null,
              pressed ? appStyles.pressDown : null,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <View style={[s.idx, { backgroundColor: accent }]}>
              <Text style={s.idxText}>{index + 1}</Text>
            </View>
            <View style={s.copy}>
              <Text style={s.times}>
                {fmt(range.start)} – {fmt(range.end)}
              </Text>
              <Text style={s.dur}>{fmtDuration(range.end - range.start)}</Text>
            </View>
            <Pressable
              onPress={() => onRemoveRange(range.id)}
              hitSlop={8}
              style={s.iconBtn}
              accessibilityLabel={t("editor.deletePart")}
            >
              <Feather name="trash-2" size={16} color={CUT_COLOR} />
            </Pressable>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 16, gap: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderLeftWidth: 3,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  idx: {
    width: 20,
    height: 20,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
  },
  idxText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 11,
    color: colors.onPrimary,
  },
  copy: { flex: 1, flexDirection: "row", alignItems: "baseline", gap: 8 },
  times: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  dur: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  iconBtn: { padding: 2 },
  empty: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 4,
  },
  emptyTitle: {
    fontFamily: "Lora_500Medium",
    fontSize: 17,
    color: colors.textStrong,
    textAlign: "center",
  },
  emptyText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    textAlign: "center",
  },
});
