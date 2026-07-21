import React from "react";
import { Pressable, Text, View } from "react-native";
import { shelfStyles } from "../styles";
import { departedAgoLabel } from "../../../domain/shelf";
import type { ShelfDepartedRowData } from "../hooks/useShelfScreenModel";
import { useTranslation } from "react-i18next";
import { UserText } from "../../../i18n";

type ShelfDepartedRowProps = {
  rowData: ShelfDepartedRowData;
  now: number;
  onReshelve: () => void;
};

/** A dim, compact row in "Recently left the shelf" — asks nothing; offers a way back. */
export function ShelfDepartedRow({ rowData, now, onReshelve }: ShelfDepartedRowProps) {
  const { t } = useTranslation();
  return (
    <View style={shelfStyles.departedRow}>
      <UserText value={rowData.idea.title} style={shelfStyles.departedTitle} numberOfLines={1}>
        {rowData.idea.title}
      </UserText>
      <Text style={shelfStyles.departedWhen}>{departedAgoLabel(rowData.departure, now)}</Text>
      <Pressable
        onPress={onReshelve}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t("shelf.reshelveA11y", { title: rowData.idea.title })}
        style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}
      >
        <Text style={shelfStyles.departedReshelve}>{t("shelf.reshelve")}</Text>
      </Pressable>
    </View>
  );
}
