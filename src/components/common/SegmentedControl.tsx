import { Pressable, StyleSheet, Text, View } from "react-native";
import { styles } from "../../styles";
import { colors, radii, shadows, spacing, text } from "../../design/tokens";

type SegmentedOption<T extends string> = {
  key: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  options: SegmentedOption<T>[];
  selectedKey: T;
  onSelect: (key: T) => void;
};

export function SegmentedControl<T extends string>({
  options,
  selectedKey,
  onSelect,
}: SegmentedControlProps<T>) {
  return (
    <View style={segmentedControlStyles.wrap}>
      {options.map((option) => {
        const active = option.key === selectedKey;
        return (
          <Pressable
            key={option.key}
            style={({ pressed }) => [
              segmentedControlStyles.option,
              active ? segmentedControlStyles.optionActive : null,
              pressed ? styles.pressDown : null,
            ]}
            onPress={() => onSelect(option.key)}
          >
            <Text
              style={[
                segmentedControlStyles.optionText,
                active ? segmentedControlStyles.optionTextActive : null,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const segmentedControlStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    marginBottom: spacing.lg,
    padding: spacing.xs,
    backgroundColor: colors.borderSubtle,
    borderRadius: radii.sm,
  },
  option: {
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    borderRadius: 6,
  },
  optionActive: {
    backgroundColor: colors.surface,
    ...shadows.control,
  },
  optionText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  optionTextActive: {
    color: colors.textPrimary,
  },
});
