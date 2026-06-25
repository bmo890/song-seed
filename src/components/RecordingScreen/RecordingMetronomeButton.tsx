import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MetronomeIcon } from "../common/MetronomeIcon";
import { getMetronomeMeterPreset, type MetronomeMeterId } from "../../metronome";

type Props = {
  enabled: boolean;
  disabled?: boolean;
  isNativeAvailable: boolean;
  bpm: number;
  meterId: MetronomeMeterId;
  onToggleEnabled: (value: boolean) => void;
  onOpenSettings: () => void;
};

export function RecordingMetronomeButton({
  enabled,
  disabled = false,
  isNativeAvailable,
  bpm,
  meterId,
  onToggleEnabled,
  onOpenSettings,
}: Props) {
  const isDisabled = disabled || !isNativeAvailable;
  const meterLabel = getMetronomeMeterPreset(meterId).label;

  return (
    <View style={localStyles.wrap}>
      <View style={localStyles.circleSlot}>
        <Pressable
          style={({ pressed }) => [
            localStyles.btn,
            enabled ? localStyles.btnActive : null,
            isDisabled ? localStyles.btnDisabled : null,
            pressed ? localStyles.pressed : null,
          ]}
          onPress={() => onToggleEnabled(!enabled)}
          disabled={isDisabled}
          accessibilityRole="button"
          accessibilityLabel={enabled ? "Turn metronome off" : "Turn metronome on"}
        >
          <MetronomeIcon size={20} color={enabled ? "#FFFFFF" : "#524440"} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [localStyles.badge, pressed ? localStyles.pressed : null]}
          onPress={onOpenSettings}
          accessibilityRole="button"
          accessibilityLabel="Metronome settings"
        >
          <Ionicons name="settings-outline" size={11} color="#524440" />
        </Pressable>
      </View>
      <View style={localStyles.labelGroup}>
        <Text style={localStyles.label} numberOfLines={1}>
          Metronome
        </Text>
        <Text style={localStyles.sublabel} numberOfLines={1}>
          {bpm} BPM · {meterLabel}
        </Text>
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  wrap: {
    width: 76,
    alignItems: "center",
    gap: 6,
  },
  labelGroup: {
    width: 76,
    alignItems: "center",
    gap: 1,
  },
  circleSlot: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  btn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F1ED",
  },
  btnActive: {
    backgroundColor: "#B87D6B",
  },
  btnDisabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
  badge: {
    position: "absolute",
    bottom: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E4DF",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#84736f",
    textAlign: "center",
  },
  sublabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#a89994",
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
});
