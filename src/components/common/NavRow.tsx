import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { colors, spacing } from "../../design/tokens";

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
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  rowActive: {
    backgroundColor: colors.surfaceSelected,
  },
  rowNested: {
    marginLeft: 10,
  },
  rowDisabled: {
    opacity: 0.6,
  },
  copyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  eyebrow: {
    fontSize: 11,
    lineHeight: 14,
    color: colors.textSecondary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  titleStrong: {
    fontSize: 18,
    lineHeight: 22,
    color: colors.textPrimary,
    fontWeight: "700",
  },
});
