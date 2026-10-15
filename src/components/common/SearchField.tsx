import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Press } from "./Press";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { colors, radii, spacing, text } from "../../design/tokens";
import { UserTextInput } from "../../i18n";

type SearchFieldProps = {
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  onFocus?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  /** Focus on mount — for a field that appears on demand (the hub's in-place search). */
  autoFocus?: boolean;
  testID?: string;
};

export function SearchField({
  value,
  placeholder,
  onChangeText,
  onFocus,
  containerStyle,
  autoFocus,
  testID,
}: SearchFieldProps) {
  return (
    <View style={[searchFieldStyles.wrap, containerStyle]}>
      <Ionicons name="search" size={16} color={colors.textSecondary} />
      <UserTextInput
        testID={testID}
        style={searchFieldStyles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onFocus={onFocus}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        returnKeyType="search"
      />
      {value ? (
        <Press
          haptic="none"
          style={searchFieldStyles.clearBtn}
          onPress={() => onChangeText("")}
        >
          <Ionicons name="close" size={14} color={colors.textSecondary} />
        </Press>
      ) : null}
    </View>
  );
}

const searchFieldStyles = StyleSheet.create({
  // One search field (2026-10-15): the quiet tonal fill, no outline.
  wrap: {
    minHeight: 40,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    ...text.body,
    paddingVertical: 8,
  },
  clearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
