import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { fmt, fmtDuration } from "../../utils";
import { colors, radii } from "../../design/tokens";
import { CUT_COLOR, KEEP_COLOR, type EditableSelection } from "./helpers";

type EditorSelectionListProps = {
  selectedRanges: EditableSelection[];
  intent: "keep" | "remove";
  onSeekRangeStart: (range: EditableSelection) => void;
  onSeekRangeEnd: (range: EditableSelection) => void;
  onRemoveRange: (id: string) => void;
};

/** Neutral region rows — type is the global intent, so rows just show the span;
 * the left accent + index color reflect the current keep/cut intent. */
export function EditorSelectionList({
  selectedRanges,
  intent,
  onSeekRangeStart,
  onSeekRangeEnd,
  onRemoveRange,
}: EditorSelectionListProps) {
  if (selectedRanges.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyText}>
          No regions yet — drag across the waveform or tap “Add at playhead”.
        </Text>
      </View>
    );
  }

  const accent = intent === "keep" ? KEEP_COLOR : CUT_COLOR;
  const ordered = [...selectedRanges].sort((a, b) => a.start - b.start);

  return (
    <View style={s.wrap}>
      {ordered.map((range, index) => (
        <View key={range.id} style={[s.row, { borderLeftColor: accent }]}>
          <View style={[s.idx, { backgroundColor: accent }]}>
            <Text style={s.idxText}>{index + 1}</Text>
          </View>
          <View style={s.copy}>
            <Text style={s.times}>
              {fmt(range.start)} – {fmt(range.end)}
            </Text>
            <Text style={s.dur}>{fmtDuration(range.end - range.start)}</Text>
          </View>
          <View style={s.actions}>
            <Pressable onPress={() => onSeekRangeStart(range)} hitSlop={6} style={s.iconBtn} accessibilityLabel="Jump to start">
              <Feather name="skip-back" size={16} color={colors.textSecondary} />
            </Pressable>
            <Pressable onPress={() => onSeekRangeEnd(range)} hitSlop={6} style={s.iconBtn} accessibilityLabel="Jump to end">
              <Feather name="skip-forward" size={16} color={colors.textSecondary} />
            </Pressable>
            <Pressable onPress={() => onRemoveRange(range.id)} hitSlop={6} style={s.iconBtn} accessibilityLabel="Delete region">
              <Feather name="trash-2" size={16} color={CUT_COLOR} />
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 16, gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
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
  actions: { flexDirection: "row", alignItems: "center", gap: 14 },
  iconBtn: { padding: 2 },
  empty: {
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  emptyText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    textAlign: "center",
  },
});
