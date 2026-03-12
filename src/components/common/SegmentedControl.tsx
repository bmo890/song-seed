import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Option<T extends string> = {
  key: T;
  label: string;
};

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.root}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            style={({ pressed }) => [
              styles.segment,
              active ? styles.segmentActive : null,
              pressed ? styles.segmentPressed : null,
            ]}
            onPress={() => onChange(option.key)}
          >
            <Text style={[styles.segmentLabel, active ? styles.segmentLabelActive : null]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
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
  segmentPressed: {
    opacity: 0.88,
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
