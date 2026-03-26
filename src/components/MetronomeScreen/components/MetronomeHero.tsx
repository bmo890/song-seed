import { Animated, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../styles";
import { formatMetronomeIntervalLabel } from "../../../metronome";
import type { useMetronomeScreenModel } from "../hooks/useMetronomeScreenModel";

type MetronomeModel = ReturnType<typeof useMetronomeScreenModel>;

export function MetronomeHero({ model }: { model: MetronomeModel }) {
  return (
    <View style={styles.heroSurface}>
      <View style={styles.pulseStack}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pulseHalo,
            {
              opacity: model.pulseOpacity,
              transform: [{ scale: model.pulseScale }],
            },
          ]}
        />
        <View
          style={[
            styles.pulseCore,
            model.isRunning ? styles.pulseCoreActive : null,
            model.outputs.visual ? null : styles.pulseCoreMuted,
          ]}
        >
          <Ionicons
            name={model.isRunning ? "pause" : "play"}
            size={26}
            color={model.isRunning ? "#0f172a" : "#334155"}
          />
        </View>
      </View>

      <Text style={styles.bpmValue}>{model.bpm}</Text>
      <Text style={styles.bpmLabel}>beats per minute</Text>
      <Text style={styles.intervalLabel}>
        {formatMetronomeIntervalLabel(model.beatIntervalMs)}
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.primaryAction,
          model.isRunning ? styles.primaryActionStop : null,
          model.isPreparing ? styles.primaryActionDisabled : null,
          pressed ? styles.pressDown : null,
        ]}
        onPress={model.toggleRunning}
        disabled={model.isPreparing}
      >
        <Text
          style={[
            styles.primaryActionText,
            model.isRunning ? styles.primaryActionTextStop : null,
          ]}
        >
          {model.isPreparing ? "Preparing..." : model.isRunning ? "Stop" : "Start"}
        </Text>
      </Pressable>

      <Text style={styles.statusLabel}>
        {model.isPreparing
          ? "Rendering the click loop for this tempo."
          : model.isRunning
            ? model.activeOutputCount === 0
              ? "Running with no active cue outputs."
              : `${model.activeOutputCount} cue mode${
                  model.activeOutputCount === 1 ? "" : "s"
                } active.`
            : "Ready"}
      </Text>
    </View>
  );
}
