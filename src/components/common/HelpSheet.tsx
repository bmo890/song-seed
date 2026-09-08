import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "./BottomSheet";
import { colors, radii, spacing } from "../../design/tokens";

export type HelpItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
};

/**
 * The "?" sheet — help law (2026-09-08): it explains INVISIBLE rules only.
 * Visible controls explain themselves through labels, placeholders, disabled
 * states and empty states; a sheet that restates them is noise and gets removed.
 *
 * One grammar: no title (the sheet opens on the page, so the page is the title),
 * a one-line thesis in Lora, then at most four rows whose bodies stay ≤ 12 words.
 * Icons are muted — colour is scarce and a legend is not an action. The list
 * scrolls as a safety net; a sheet that needs it has too many rows.
 */
export function HelpSheet({
  visible,
  onClose,
  thesis,
  items,
}: {
  visible: boolean;
  onClose: () => void;
  thesis: string;
  items: HelpItem[];
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={helpStyles.thesis}>{thesis}</Text>
      <ScrollView
        style={helpStyles.scroll}
        contentContainerStyle={helpStyles.list}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {items.map((item) => (
          <View key={item.label} style={helpStyles.row}>
            <View style={helpStyles.iconWrap}>
              <Ionicons name={item.icon} size={16} color={colors.textSecondary} />
            </View>
            <View style={helpStyles.text}>
              <Text style={helpStyles.label}>{item.label}</Text>
              <Text style={helpStyles.desc}>{item.description}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

const helpStyles = StyleSheet.create({
  thesis: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 19,
    lineHeight: 26,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  scroll: {
    maxHeight: 420,
  },
  list: {
    gap: 14,
    paddingBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
    gap: 1,
  },
  label: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.textPrimary,
  },
  desc: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
});
