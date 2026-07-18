import React from "react";
import { Pressable, Text, View } from "react-native";
import { shelfStyles } from "../styles";
import { departedAgoLabel } from "../../../domain/shelf";
import type { ShelfDepartedRowData } from "../hooks/useShelfScreenModel";

type ShelfDepartedRowProps = {
  rowData: ShelfDepartedRowData;
  now: number;
  onReshelve: () => void;
};

/** A dim, compact row in "Recently left the shelf" — asks nothing; offers a way back. */
export function ShelfDepartedRow({ rowData, now, onReshelve }: ShelfDepartedRowProps) {
  return (
    <View style={shelfStyles.departedRow}>
      <Text style={shelfStyles.departedTitle} numberOfLines={1}>
        {rowData.idea.title}
      </Text>
      <Text style={shelfStyles.departedWhen}>{departedAgoLabel(rowData.departure, now)}</Text>
      <Pressable
        onPress={onReshelve}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Put ${rowData.idea.title} back on the shelf`}
        style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}
      >
        <Text style={shelfStyles.departedReshelve}>Re-shelve</Text>
      </Pressable>
    </View>
  );
}
