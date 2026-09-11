import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { colors, text } from "../../design/tokens";
import { UserText } from "../../i18n";

type NavRowProps = {
  icon: ComponentProps<typeof Ionicons>["name"];
  iconColor: string;
  label: string;
  eyebrow?: string;
  // A quiet second line under the title — a path, never a sentence.
  supporting?: string;
  // The label (and supporting line) is user-authored text: render it through
  // UserText so its writing direction follows the content; alignment follows the app.
  userLabel?: boolean;
  testID?: string;
  accessibilityLabel?: string;
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
  supporting,
  userLabel = false,
  testID,
  accessibilityLabel,
  active = false,
  nested = false,
  disabled = false,
  accessory,
  onPress,
}: NavRowProps) {
  return (
    <Pressable
      testID={testID ?? `nav-row-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
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
          {userLabel ? (
            <UserText value={label} style={eyebrow ? navRowStyles.titleStrong : navRowStyles.title} numberOfLines={1}>
              {label}
            </UserText>
          ) : (
            <Text style={eyebrow ? navRowStyles.titleStrong : navRowStyles.title} numberOfLines={1}>
              {label}
            </Text>
          )}
          {supporting ? (
            userLabel ? (
              <UserText value={supporting} style={navRowStyles.supporting} numberOfLines={1}>
                {supporting}
              </UserText>
            ) : (
              <Text style={navRowStyles.supporting} numberOfLines={1}>
                {supporting}
              </Text>
            )
          ) : null}
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
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  titleStrong: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 16,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  supporting: {
    ...text.supporting,
    lineHeight: 17,
  },
});
