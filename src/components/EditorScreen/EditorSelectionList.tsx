import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { fmt } from "../../utils";
import { colors, radii } from "../../design/tokens";
import type { EditableSelection } from "./helpers";

// Keep / remove stay semantic green / red so the edit intent reads at a glance
// (matches the edit-mode tabs and trash affordances elsewhere in the editor).
const KEEP_COLOR = "#10b981";
const REMOVE_COLOR = "#ef4444";

type EditorSelectionListProps = {
  selectedRanges: EditableSelection[];
  keepRegions: EditableSelection[];
  removeRegions: EditableSelection[];
  onSeekRangeStart: (range: EditableSelection) => void;
  onSeekRangeEnd: (range: EditableSelection) => void;
  onRemoveRange: (id: string) => void;
};

export function EditorSelectionList({
  selectedRanges,
  keepRegions,
  removeRegions,
  onSeekRangeStart,
  onSeekRangeEnd,
  onRemoveRange,
}: EditorSelectionListProps) {
  if (selectedRanges.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Selected Regions ({selectedRanges.length})</Text>
      {selectedRanges.map((range) => (
        <View key={range.id} style={styles.row}>
          <View
            style={[
              styles.card,
              { borderLeftColor: range.type === "keep" ? KEEP_COLOR : REMOVE_COLOR },
            ]}
          >
            <View style={styles.copy}>
              <Text style={styles.title}>
                {range.type === "keep"
                  ? `Clip ${keepRegions.findIndex((region) => region.id === range.id) + 1}`
                  : `Delete ${removeRegions.findIndex((region) => region.id === range.id) + 1}`}
              </Text>
              <Text style={styles.meta}>
                {fmt(range.start)} - {fmt(range.end)}
              </Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => onSeekRangeStart(range)} style={styles.iconBtn}>
                <Feather name="skip-back" size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onSeekRangeEnd(range)} style={styles.iconBtn}>
                <Feather name="skip-forward" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity onPress={() => onRemoveRange(range.id)} style={styles.trashBtn}>
            <Feather name="trash-2" size={18} color={REMOVE_COLOR} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 24, paddingHorizontal: 36 },
  heading: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  row: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 10 },
  card: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surfaceContainer,
    padding: 12,
    borderRadius: radii.sm,
    borderLeftWidth: 4,
  },
  copy: { flex: 1 },
  title: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  meta: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 13,
    color: colors.textSecondary,
  },
  actions: { flexDirection: "row", alignItems: "center", gap: 16, paddingRight: 4 },
  iconBtn: { padding: 4 },
  trashBtn: { padding: 6 },
});
