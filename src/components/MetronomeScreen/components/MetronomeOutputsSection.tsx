import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { Pressable, Text, View } from "react-native";
import {
  formatMetronomeLevel,
  MAX_METRONOME_LEVEL,
  MIN_METRONOME_LEVEL,
  type MetronomeOutputKey,
} from "../../../metronome";
import { styles } from "../styles";

type IconName = ComponentProps<typeof Ionicons>["name"];

const OUTPUT_CONTROLS: { key: MetronomeOutputKey; label: string; icon: IconName }[] = [
  { key: "beep",   label: "Sound",   icon: "volume-high-outline" },
  { key: "visual", label: "Visual",  icon: "pulse-outline" },
  { key: "haptic", label: "Haptic",  icon: "phone-portrait-outline" },
];

type Props = {
  outputs: Record<MetronomeOutputKey, boolean>;
  activeOutputCount: number;
  beepLevel: number;
  hapticLevel: number;
  onToggleOutput: (key: MetronomeOutputKey) => void;
  onChangeBeepLevel: (value: number) => void;
  onChangeHapticLevel: (value: number) => void;
};

export function MetronomeOutputsSection({
  outputs,
  beepLevel,
  hapticLevel,
  onToggleOutput,
  onChangeBeepLevel,
  onChangeHapticLevel,
}: Props) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Outputs</Text>

      <View style={styles.outputRow}>
        {OUTPUT_CONTROLS.map((control) => {
          const active = outputs[control.key];
          return (
            <Pressable
              key={control.key}
              style={({ pressed }) => [
                styles.outputToggle,
                active ? styles.outputToggleActive : null,
                pressed ? styles.pressDown : null,
              ]}
              onPress={() => onToggleOutput(control.key)}
            >
              <Ionicons
                name={control.icon}
                size={16}
                color={active ? "#ffffff" : "#84736f"}
              />
              <Text style={[styles.outputToggleText, active ? styles.outputToggleTextActive : null]}>
                {control.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {outputs.beep ? (
        <View style={styles.levelGroup}>
          <View style={styles.levelHeader}>
            <Text style={styles.levelTitle}>Volume</Text>
            <Text style={styles.levelMeta}>{formatMetronomeLevel(beepLevel)}</Text>
          </View>
          <Slider
            minimumValue={MIN_METRONOME_LEVEL}
            maximumValue={MAX_METRONOME_LEVEL}
            step={1}
            minimumTrackTintColor="#824f3f"
            maximumTrackTintColor="#d7c2bd"
            thumbTintColor="#824f3f"
            value={beepLevel}
            onValueChange={onChangeBeepLevel}
          />
          <View style={styles.levelTrackLabels}>
            <Text style={styles.sliderLabel}>Softer</Text>
            <Text style={styles.sliderLabel}>Louder</Text>
          </View>
        </View>
      ) : null}

      {outputs.haptic ? (
        <View style={styles.levelGroup}>
          <View style={styles.levelHeader}>
            <Text style={styles.levelTitle}>Haptic intensity</Text>
            <Text style={styles.levelMeta}>{formatMetronomeLevel(hapticLevel)}</Text>
          </View>
          <Slider
            minimumValue={MIN_METRONOME_LEVEL}
            maximumValue={MAX_METRONOME_LEVEL}
            step={1}
            minimumTrackTintColor="#824f3f"
            maximumTrackTintColor="#d7c2bd"
            thumbTintColor="#824f3f"
            value={hapticLevel}
            onValueChange={onChangeHapticLevel}
          />
          <View style={styles.levelTrackLabels}>
            <Text style={styles.sliderLabel}>Softer</Text>
            <Text style={styles.sliderLabel}>Stronger</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
