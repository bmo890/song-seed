import { Pressable, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { colors, radii, spacing, text } from "../../design/tokens";

type SearchFieldProps = {
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  onFocus?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
};

export function SearchField({
  value,
  placeholder,
  onChangeText,
  onFocus,
  containerStyle,
}: SearchFieldProps) {
  return (
    <View style={[searchFieldStyles.wrap, containerStyle]}>
      <Ionicons name="search" size={16} color={colors.textSecondary} />
      <TextInput
        style={searchFieldStyles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onFocus={onFocus}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {value ? (
        <Pressable
          style={({ pressed }) => [searchFieldStyles.clearBtn, pressed ? styles.pressDown : null]}
          onPress={() => onChangeText("")}
        >
          <Ionicons name="close" size={14} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const searchFieldStyles = StyleSheet.create({
  wrap: {
    minHeight: 40,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    backgroundColor: colors.surface,
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
