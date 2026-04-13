import { Pressable, Text, View } from "react-native";
import { METRONOME_METER_PRESETS, type MetronomeMeterId } from "../../../metronome";
import { styles } from "../styles";

type Props = {
  meterId: MetronomeMeterId;
  onSelectMeter: (meterId: MetronomeMeterId) => void;
};

export function MetronomeMeterSection({ meterId, onSelectMeter }: Props) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Meter</Text>

      <View style={styles.outputRow}>
        {METRONOME_METER_PRESETS.map((preset) => {
          const active = preset.id === meterId;
          return (
            <Pressable
              key={preset.id}
              style={({ pressed }) => [
                styles.outputToggle,
                active ? styles.outputToggleActive : null,
                pressed ? styles.pressDown : null,
              ]}
              onPress={() => onSelectMeter(preset.id)}
            >
              <Text style={[styles.outputToggleText, active ? styles.outputToggleTextActive : null]}>
                {preset.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
