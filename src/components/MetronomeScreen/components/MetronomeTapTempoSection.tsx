import { Pressable, Text, View } from "react-native";
import { styles } from "../styles";

type Props = {
  tapCount: number;
  onTapTempo: () => void;
  onReset: () => void;
};

export function MetronomeTapTempoSection({ tapCount, onTapTempo, onReset }: Props) {
  const hasEnoughTaps = tapCount >= 3;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Tap Tempo</Text>

      <View style={styles.tapRow}>
        <Pressable
          style={({ pressed }) => [
            styles.tapButton,
            tapCount > 0 ? styles.tapButtonActive : null,
            pressed ? styles.pressDown : null,
          ]}
          onPress={onTapTempo}
        >
          <Text style={styles.tapButtonText}>Tap</Text>
        </Pressable>

        {tapCount > 0 ? (
          <Pressable
            style={({ pressed }) => [styles.tapResetButton, pressed ? styles.pressDown : null]}
            onPress={onReset}
          >
            <Text style={styles.tapResetButtonText}>Reset</Text>
          </Pressable>
        ) : null}
      </View>

      {tapCount > 0 ? (
        <Text style={styles.tapCountLabel}>
          {hasEnoughTaps
            ? `${tapCount} taps`
            : `${tapCount} tap${tapCount === 1 ? "" : "s"} — keep going`}
        </Text>
      ) : null}
    </View>
  );
}
