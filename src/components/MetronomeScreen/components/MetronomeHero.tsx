import { Animated, Pressable, Text, View } from "react-native";
import { styles } from "../styles";
import type { useMetronomeScreenModel } from "../hooks/useMetronomeScreenModel";

type MetronomeModel = ReturnType<typeof useMetronomeScreenModel>;

function getStatusLabel(model: MetronomeModel): string {
  if (!model.isNativeAvailable) return "Native engine unavailable";
  if (model.isPreparing) return "Preparing…";
  if (model.isRunning && model.activeOutputCount === 0) return "No outputs active";
  if (model.isRunning) return "Running";
  return "";
}

export function MetronomeHero({ model }: { model: MetronomeModel }) {
  const statusLabel = getStatusLabel(model);
  const isRunning = model.isRunning;

  return (
    <View style={styles.heroSurface}>
      {/* Pulse circle — shows beat animation when running, plain dot when idle */}
      <View style={styles.pulseStack}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pulseHalo,
            { opacity: model.pulseOpacity, transform: [{ scale: model.pulseScale }] },
          ]}
        />
        <View
          style={[
            styles.pulseCore,
            isRunning ? styles.pulseCoreActive : null,
            isRunning && !model.outputs.visual ? styles.pulseCoreMuted : null,
          ]}
        />
      </View>

      <Text style={styles.bpmValue}>{model.bpm}</Text>
      <Text style={styles.bpmLabel}>BPM</Text>

      <Pressable
        style={({ pressed }) => [
          styles.primaryAction,
          isRunning ? styles.primaryActionStop : null,
          model.isPreparing || !model.isNativeAvailable ? styles.primaryActionDisabled : null,
          pressed ? styles.pressDown : null,
        ]}
        onPress={model.toggleRunning}
        disabled={model.isPreparing || !model.isNativeAvailable}
      >
        <Text style={[styles.primaryActionText, isRunning ? styles.primaryActionTextStop : null]}>
          {model.isPreparing ? "Preparing…" : isRunning ? "Stop" : "Start"}
        </Text>
      </Pressable>

      {statusLabel ? (
        <Text style={[styles.statusLabel, isRunning ? styles.statusLabelRunning : null]}>
          {statusLabel}
        </Text>
      ) : null}
    </View>
  );
}
