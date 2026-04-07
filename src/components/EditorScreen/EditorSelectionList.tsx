import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { fmt } from "../../utils";
import type { EditableSelection } from "./helpers";

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
    <View style={{ marginTop: 24, paddingHorizontal: 36 }}>
      <Text style={{ fontSize: 16, fontWeight: "600", color: "#f8fafc", marginBottom: 12 }}>
        Selected Regions ({selectedRanges.length})
      </Text>
      {selectedRanges.map((range) => (
        <View key={range.id} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 10 }}>
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: "#1e293b",
              padding: 12,
              borderRadius: 8,
              borderLeftWidth: 4,
              borderLeftColor: range.type === "keep" ? "#10b981" : "#ef4444",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#f8fafc", fontSize: 15, fontWeight: "700", marginBottom: 2 }}>
                {range.type === "keep"
                  ? `Clip ${keepRegions.findIndex((region) => region.id === range.id) + 1}`
                  : `Delete ${removeRegions.findIndex((region) => region.id === range.id) + 1}`}
              </Text>
              <Text style={{ color: "#cbd5e1", fontSize: 13, fontWeight: "500" }}>
                {fmt(range.start)} - {fmt(range.end)}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingRight: 4 }}>
              <TouchableOpacity onPress={() => onSeekRangeStart(range)} style={{ padding: 4 }}>
                <Feather name="skip-back" size={18} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onSeekRangeEnd(range)} style={{ padding: 4 }}>
                <Feather name="skip-forward" size={18} color="#3b82f6" />
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity onPress={() => onRemoveRange(range.id)} style={{ padding: 6 }}>
            <Feather name="trash-2" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}
