import Slider from "@react-native-community/slider";
import { Pressable, Text, View } from "react-native";
import { styles } from "../styles";
import { MAX_METRONOME_BPM, MIN_METRONOME_BPM } from "../../../metronome";

const BPM_STEPS = [
  { label: "-5", delta: -5 },
  { label: "-1", delta: -1 },
  { label: "+1", delta: 1 },
  { label: "+5", delta: 5 },
];

type Props = {
  bpm: number;
  onNudge: (delta: number) => void;
  onChangeValue: (value: number) => void;
};

export function MetronomeTempoSection({ bpm, onNudge, onChangeValue }: Props) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Tempo</Text>
        <Text style={styles.sectionMeta}>
          {MIN_METRONOME_BPM} to {MAX_METRONOME_BPM} BPM
        </Text>
      </View>

      <View style={styles.bpmStepRow}>
        {BPM_STEPS.map((step) => (
          <Pressable
            key={step.label}
            style={({ pressed }) => [
              styles.stepButton,
              pressed ? styles.pressDown : null,
            ]}
            onPress={() => onNudge(step.delta)}
          >
            <Text style={styles.stepButtonText}>{step.label}</Text>
          </Pressable>
        ))}
      </View>

      <Slider
        minimumValue={MIN_METRONOME_BPM}
        maximumValue={MAX_METRONOME_BPM}
        step={1}
        minimumTrackTintColor="#7aa9da"
        maximumTrackTintColor="#d7dee8"
        thumbTintColor="#548ec9"
        value={bpm}
        onValueChange={onChangeValue}
      />

      <View style={styles.sliderLabels}>
        <Text style={styles.sliderLabel}>{MIN_METRONOME_BPM}</Text>
        <Text style={styles.sliderLabel}>{MAX_METRONOME_BPM}</Text>
      </View>
    </View>
  );
}
