import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { styles } from "../../styles";

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
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
  },
  segment: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  segmentLabelActive: {
    color: "#0f172a",
  },
});
