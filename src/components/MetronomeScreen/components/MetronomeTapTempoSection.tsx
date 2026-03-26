import { Pressable, Text, View } from "react-native";
import { styles } from "../styles";

type Props = {
  tapCount: number;
  onTapTempo: () => void;
  onReset: () => void;
};

export function MetronomeTapTempoSection({
  tapCount,
  onTapTempo,
  onReset,
}: Props) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Tap tempo</Text>
        <Text style={styles.sectionMeta}>
          {tapCount > 0
            ? `${tapCount} tap${tapCount === 1 ? "" : "s"} captured`
            : "Tap 3 or more times"}
        </Text>
      </View>

      <View style={styles.tapRow}>
        <Pressable
          style={({ pressed }) => [
            styles.tapButton,
            pressed ? styles.pressDown : null,
          ]}
          onPress={onTapTempo}
        >
          <Text style={styles.tapButtonText}>Tap tempo</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.tapResetButton,
            pressed ? styles.pressDown : null,
          ]}
          onPress={onReset}
        >
          <Text style={styles.tapResetButtonText}>Reset</Text>
        </Pressable>
      </View>

      <Text style={styles.helperText}>
        BPM updates from the most recent consistent taps so it settles without bouncing
        around.
      </Text>
    </View>
  );
}
