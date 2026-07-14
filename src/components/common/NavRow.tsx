import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";

type NavRowProps = {
  icon: ComponentProps<typeof Ionicons>["name"];
  iconColor: string;
  label: string;
  eyebrow?: string;
  active?: boolean;
  nested?: boolean;
  disabled?: boolean;
  accessory?: ReactNode;
  onPress: () => void;
};

export function NavRow({
  icon,
  iconColor,
  label,
  eyebrow,
  active = false,
  nested = false,
  disabled = false,
  accessory,
  onPress,
}: NavRowProps) {
  return (
    <Pressable
      testID={`nav-row-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`}
      accessibilityRole="button"
      style={({ pressed }) => [
        navRowStyles.row,
        active ? navRowStyles.rowActive : null,
        nested ? navRowStyles.rowNested : null,
        pressed ? styles.pressDown : null,
        disabled ? navRowStyles.rowDisabled : null,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={navRowStyles.copyRow}>
        <Ionicons name={icon} size={16} color={iconColor} />
        <View style={navRowStyles.copy}>
          {eyebrow ? <Text style={navRowStyles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={eyebrow ? navRowStyles.titleStrong : navRowStyles.title} numberOfLines={1}>
            {label}
          </Text>
        </View>
      </View>
      {accessory}
    </Pressable>
  );
}

const navRowStyles = StyleSheet.create({
  row: {
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rowActive: {
    backgroundColor: "#efeeea",
  },
  rowNested: {
    marginLeft: 10,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  copyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  eyebrow: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 10,
    lineHeight: 13,
    color: "#84736f",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 15,
    lineHeight: 20,
    color: "#1b1c1a",
  },
  titleStrong: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 16,
    lineHeight: 20,
    color: "#1b1c1a",
  },
});
