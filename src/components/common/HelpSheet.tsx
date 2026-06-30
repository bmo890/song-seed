import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "./BottomSheet";
import { styles } from "../../styles";
import { colors, radii } from "../../design/tokens";

export type HelpItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
};

/** A "?" popup that explains a screen and its icon buttons — the legend that
 * lets us keep buttons icon-only instead of wordy. Keep copy short. */
export function HelpSheet({
  visible,
  onClose,
  title,
  intro,
  items,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  intro?: string;
  items: HelpItem[];
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.selectionSheetTitle}>{title}</Text>
      {intro ? <Text style={helpStyles.intro}>{intro}</Text> : null}
      <View style={helpStyles.list}>
        {items.map((item) => (
          <View key={item.label} style={helpStyles.row}>
            <View style={helpStyles.iconWrap}>
              <Ionicons name={item.icon} size={16} color={colors.primary} />
            </View>
            <View style={helpStyles.text}>
              <Text style={helpStyles.label}>{item.label}</Text>
              <Text style={helpStyles.desc}>{item.description}</Text>
            </View>
          </View>
        ))}
      </View>
    </BottomSheet>
  );
}

const helpStyles = StyleSheet.create({
  intro: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  list: {
    gap: 14,
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
