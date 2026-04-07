import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

type EditorSelectionModeTabsProps = {
  editMode: "keep" | "remove";
  onSelectMode: (mode: "keep" | "remove") => void;
};

export function EditorSelectionModeTabs({
  editMode,
  onSelectMode,
}: EditorSelectionModeTabsProps) {
  return (
    <View style={{ marginTop: 24, paddingHorizontal: 36 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
        <TouchableOpacity
          onPress={() => onSelectMode("keep")}
          style={{
            flex: 1,
            alignItems: "center",
            padding: 10,
            borderBottomWidth: 2,
            borderBottomColor: editMode === "keep" ? "#10b981" : "transparent",
          }}
        >
          <Text style={{ color: editMode === "keep" ? "#10b981" : "#64748b", fontWeight: "600" }}>
            Extract (Keep)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onSelectMode("remove")}
          style={{
            flex: 1,
            alignItems: "center",
            padding: 10,
            borderBottomWidth: 2,
            borderBottomColor: editMode === "remove" ? "#ef4444" : "transparent",
          }}
        >
          <Text style={{ color: editMode === "remove" ? "#ef4444" : "#64748b", fontWeight: "600" }}>
            Delete (Remove)
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
