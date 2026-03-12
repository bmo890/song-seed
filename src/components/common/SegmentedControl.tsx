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
    alignItems: "center",
    padding: 4,
    borderRadius: 16,
    backgroundColor: "#e8eaee",
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: {
    backgroundColor: "#cfe0f4",
    shadowColor: "#94a3b8",
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  segmentLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#334155",
  },
  segmentLabelActive: {
    color: "#111827",
  },
});
