import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { Pressable, Text, View } from "react-native";
import { colors } from "../../../design/tokens";
import {
  formatMetronomeLevel,
  MAX_METRONOME_LEVEL,
  MIN_METRONOME_LEVEL,
  type MetronomeOutputKey,
} from "../../../metronome";
import { styles } from "../styles";

type IconName = ComponentProps<typeof Ionicons>["name"];

const OUTPUT_CONTROLS: { key: MetronomeOutputKey; label: string; icon: IconName }[] = [
  { key: "beep", label: "Beep", icon: "volume-high-outline" },
  { key: "visual", label: "Visual", icon: "pulse-outline" },
  { key: "haptic", label: "Haptic", icon: "phone-portrait-outline" },
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
  activeOutputCount,
  beepLevel,
  hapticLevel,
  onToggleOutput,
  onChangeBeepLevel,
  onChangeHapticLevel,
}: Props) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Cue outputs</Text>
        <Text style={styles.sectionMeta}>Use them alone or combined</Text>
      </View>

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
                size={18}
                color={active ? "#2f6aa8" : colors.iconMuted}
              />
              <Text
                style={[
                  styles.outputToggleText,
                  active ? styles.outputToggleTextActive : null,
                ]}
              >
                {control.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.helperText}>
        {activeOutputCount === 0
          ? "Enable at least one cue mode to hear, see, or feel the pulse."
          : "All cue modes can run together, and each toggle takes effect on the next beat."}
      </Text>

      <View style={styles.levelGroup}>
        <View style={styles.levelHeader}>
          <Text style={styles.levelTitle}>Beep level</Text>
          <Text style={styles.levelMeta}>
            {outputs.beep ? formatMetronomeLevel(beepLevel) : "Off"}
          </Text>
        </View>
        <Slider
          minimumValue={MIN_METRONOME_LEVEL}
          maximumValue={MAX_METRONOME_LEVEL}
          step={1}
          minimumTrackTintColor="#7aa9da"
          maximumTrackTintColor="#d7dee8"
          thumbTintColor="#548ec9"
          value={beepLevel}
          onValueChange={onChangeBeepLevel}
        />
        <View style={styles.levelTrackLabels}>
          <Text style={styles.sliderLabel}>Softer</Text>
          <Text style={styles.sliderLabel}>Stronger</Text>
        </View>
      </View>

      <View style={styles.levelGroup}>
        <View style={styles.levelHeader}>
          <Text style={styles.levelTitle}>Haptic level</Text>
          <Text style={styles.levelMeta}>
            {outputs.haptic ? formatMetronomeLevel(hapticLevel) : "Off"}
          </Text>
        </View>
        <Slider
          minimumValue={MIN_METRONOME_LEVEL}
          maximumValue={MAX_METRONOME_LEVEL}
          step={1}
          minimumTrackTintColor="#7aa9da"
          maximumTrackTintColor="#d7dee8"
          thumbTintColor="#548ec9"
          value={hapticLevel}
          onValueChange={onChangeHapticLevel}
        />
        <View style={styles.levelTrackLabels}>
          <Text style={styles.sliderLabel}>Softer</Text>
          <Text style={styles.sliderLabel}>Stronger</Text>
        </View>
      </View>
    </View>
  );
}
