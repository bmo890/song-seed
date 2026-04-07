import React from "react";
import { Pressable, Text, View } from "react-native";
import { styles } from "../../../styles";
import { revisitStyles } from "../styles";

type RevisitTuningPanelProps = {
  ageBias: "balanced" | "older" | "deep-cuts";
  density: "less" | "more";
  onSetAgeBias: (value: "balanced" | "older" | "deep-cuts") => void;
  onSetDensity: (value: "less" | "more") => void;
};

type TuningChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function TuningChip({ label, selected, onPress }: TuningChipProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        revisitStyles.tuningChip,
        selected ? revisitStyles.tuningChipSelected : null,
        pressed ? styles.pressDown : null,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          revisitStyles.tuningChipText,
          selected ? revisitStyles.tuningChipTextSelected : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function RevisitTuningPanel({
  ageBias,
  density,
  onSetAgeBias,
  onSetDensity,
}: RevisitTuningPanelProps) {
  return (
    <View style={[styles.card, revisitStyles.tuningPanel]}>
      <View style={revisitStyles.tuningHeader}>
        <Text style={revisitStyles.filterPanelTitle}>Tuning</Text>
        <Text style={revisitStyles.tuningMetaText}>Local to Revisit</Text>
      </View>

      <View style={revisitStyles.tuningGroup}>
        <Text style={revisitStyles.tuningLabel}>Age</Text>
        <View style={revisitStyles.filterWrap}>
          <TuningChip
            label="Balanced"
            selected={ageBias === "balanced"}
            onPress={() => onSetAgeBias("balanced")}
          />
          <TuningChip
            label="Older first"
            selected={ageBias === "older"}
            onPress={() => onSetAgeBias("older")}
          />
          <TuningChip
            label="Deep cuts"
            selected={ageBias === "deep-cuts"}
            onPress={() => onSetAgeBias("deep-cuts")}
          />
        </View>
      </View>

      <View style={revisitStyles.tuningGroup}>
        <Text style={revisitStyles.tuningLabel}>Density</Text>
        <View style={revisitStyles.filterWrap}>
          <TuningChip
            label="Less"
            selected={density === "less"}
            onPress={() => onSetDensity("less")}
          />
          <TuningChip
            label="More"
            selected={density === "more"}
            onPress={() => onSetDensity("more")}
          />
        </View>
      </View>
    </View>
  );
}
