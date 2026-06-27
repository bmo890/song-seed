import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { styles } from "../../styles";
import { colors, radii, shadows } from "../../design/tokens";

type SegmentedOption<T extends string> = {
  key: T;
  label: string;
};

type Props<T extends string> = {
  options: SegmentedOption<T>[];
  value?: T;
  onChange?: (value: T) => void;
  selectedKey?: T;
  onSelect?: (key: T) => void;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  selectedKey,
  onSelect,
}: Props<T>) {
  const activeKey = selectedKey ?? value;

  function handleSelect(key: T) {
    onSelect?.(key);
    onChange?.(key);
  }

  return (
    <View style={segmentedControlStyles.root}>
      {options.map((option) => {
        const active = option.key === activeKey;
        return (
          <Pressable
            key={option.key}
            style={({ pressed }) => [
              segmentedControlStyles.segment,
              active ? segmentedControlStyles.segmentActive : null,
              pressed ? styles.pressDown : null,
            ]}
            onPress={() => handleSelect(option.key)}
          >
            <Text
              style={[
                segmentedControlStyles.segmentLabel,
                active ? segmentedControlStyles.segmentLabelActive : null,
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
  root: {
    flexDirection: "row",
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceContainer,
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: {
    backgroundColor: colors.surface,
    ...shadows.control,
  },
  segmentLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textSecondary,
  },
  segmentLabelActive: {
    color: colors.textPrimary,
  },
});
