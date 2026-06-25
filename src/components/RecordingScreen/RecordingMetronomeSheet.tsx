import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { BottomSheet } from "../common/BottomSheet";
import {
  MAX_METRONOME_BPM,
  MAX_METRONOME_LEVEL,
  METRONOME_METER_PRESETS,
  MIN_METRONOME_BPM,
  MIN_METRONOME_LEVEL,
  type MetronomeMeterId,
  type MetronomeOutputKey,
  type MetronomeOutputs,
} from "../../metronome";

type HapticStrengthId = "light" | "medium" | "strong";

const HAPTIC_STRENGTH_PRESETS: { id: HapticStrengthId; label: string; level: number }[] = [
  { id: "light", label: "Light", level: 20 },
  { id: "medium", label: "Medium", level: 55 },
  { id: "strong", label: "Strong", level: 90 },
];

function nearestHapticStrengthId(level: number): HapticStrengthId {
  return HAPTIC_STRENGTH_PRESETS.reduce((closest, preset) =>
    Math.abs(preset.level - level) < Math.abs(closest.level - level) ? preset : closest
  ).id;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  disabled: boolean;
  isNativeAvailable: boolean;
  bpm: number;
  meterId: MetronomeMeterId;
  outputs: MetronomeOutputs;
  beepLevel: number;
  hapticLevel: number;
  tapCount: number;
  onNudgeBpm: (delta: number) => void;
  onSetBpmValue: (value: number) => void;
  onTapTempo: () => number | null;
  onSelectMeter: (meterId: MetronomeMeterId) => void;
  onToggleOutput: (key: MetronomeOutputKey) => void;
  onChangeBeepLevel: (level: number) => void;
  onChangeHapticLevel: (level: number) => void;
};

export function RecordingMetronomeSheet({
  visible,
  onClose,
  disabled,
  isNativeAvailable,
  bpm,
  meterId,
  outputs,
  beepLevel,
  hapticLevel,
  tapCount,
  onNudgeBpm,
  onSetBpmValue,
  onTapTempo,
  onSelectMeter,
  onToggleOutput,
  onChangeBeepLevel,
  onChangeHapticLevel,
}: Props) {
  const activeHapticStrengthId = useMemo(() => nearestHapticStrengthId(hapticLevel), [hapticLevel]);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={localStyles.title}>Metronome</Text>

      {!isNativeAvailable ? (
        <Text style={localStyles.disabledNote}>
          Rebuild the app to use the native metronome engine.
        </Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={localStyles.row}>
            <Text style={localStyles.rowLabel}>Tempo</Text>
            <View style={localStyles.tempoValueRow}>
              <Pressable
                style={({ pressed }) => [localStyles.stepBtn, pressed ? localStyles.pressed : null]}
                onPress={() => onNudgeBpm(-1)}
                disabled={disabled}
              >
                <Ionicons name="remove" size={14} color="#B87D6B" />
              </Pressable>
              <Text style={localStyles.tempoValue}>{bpm} BPM</Text>
              <Pressable
                style={({ pressed }) => [localStyles.stepBtn, pressed ? localStyles.pressed : null]}
                onPress={() => onNudgeBpm(1)}
                disabled={disabled}
              >
                <Ionicons name="add" size={14} color="#B87D6B" />
              </Pressable>
            </View>
          </View>
          <Slider
            minimumValue={MIN_METRONOME_BPM}
            maximumValue={MAX_METRONOME_BPM}
            step={1}
            minimumTrackTintColor="#B87D6B"
            maximumTrackTintColor="#E8E4DF"
            thumbTintColor="#B87D6B"
            value={bpm}
            onValueChange={onSetBpmValue}
            disabled={disabled}
          />
          <Pressable
            style={({ pressed }) => [
              localStyles.tapTempoBtn,
              tapCount > 0 ? localStyles.tapTempoBtnActive : null,
              pressed ? localStyles.pressed : null,
            ]}
            onPress={onTapTempo}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Tap tempo"
          >
            <Ionicons
              name="hand-left-outline"
              size={16}
              color={tapCount > 0 ? "#FFFFFF" : "#B87D6B"}
            />
            <Text style={[localStyles.tapTempoText, tapCount > 0 ? localStyles.tapTempoTextActive : null]}>
              {tapCount > 0 ? `Tapping… (${tapCount})` : "Tap tempo"}
            </Text>
          </Pressable>

          <View style={[localStyles.section, localStyles.divider]}>
            <Text style={localStyles.rowLabel}>Meter</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={localStyles.meterScrollContent}
            >
              {METRONOME_METER_PRESETS.map((preset) => {
                const active = preset.id === meterId;
                return (
                  <Pressable
                    key={preset.id}
                    style={({ pressed }) => [
                      localStyles.chip,
                      active ? localStyles.chipActive : null,
                      pressed ? localStyles.pressed : null,
                    ]}
                    onPress={() => onSelectMeter(preset.id)}
                    disabled={disabled}
                  >
                    <Text style={[localStyles.chipText, active ? localStyles.chipTextActive : null]}>
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={[localStyles.section, localStyles.divider]}>
            <Text style={localStyles.sectionLabel}>Cues</Text>

            <View style={localStyles.cueRow}>
              <Ionicons name="volume-high-outline" size={16} color="#B87D6B" />
              <Text style={localStyles.cueLabel}>Beep</Text>
              <Switch
                value={outputs.beep}
                onValueChange={() => onToggleOutput("beep")}
                disabled={disabled}
                trackColor={{ false: "#E8E4DF", true: "#D9BEB3" }}
                thumbColor="#ffffff"
              />
            </View>
            {outputs.beep ? (
              <View style={localStyles.subControl}>
                <Ionicons name="volume-low-outline" size={13} color="#a89994" />
                <Slider
                  style={localStyles.subSlider}
                  minimumValue={MIN_METRONOME_LEVEL}
                  maximumValue={MAX_METRONOME_LEVEL}
                  step={1}
                  minimumTrackTintColor="#B87D6B"
                  maximumTrackTintColor="#E8E4DF"
                  thumbTintColor="#B87D6B"
                  value={beepLevel}
                  onValueChange={onChangeBeepLevel}
                  disabled={disabled}
                />
                <Ionicons name="volume-high-outline" size={13} color="#a89994" />
              </View>
            ) : null}

            <View style={localStyles.cueRow}>
              <Ionicons name="pulse-outline" size={16} color="#B87D6B" />
              <Text style={localStyles.cueLabel}>Visual</Text>
              <Switch
                value={outputs.visual}
                onValueChange={() => onToggleOutput("visual")}
                disabled={disabled}
                trackColor={{ false: "#E8E4DF", true: "#D9BEB3" }}
                thumbColor="#ffffff"
              />
            </View>

            <View style={localStyles.cueRow}>
              <Ionicons name="phone-portrait-outline" size={16} color="#B87D6B" />
              <Text style={localStyles.cueLabel}>Haptic</Text>
              <Switch
                value={outputs.haptic}
                onValueChange={() => onToggleOutput("haptic")}
                disabled={disabled}
                trackColor={{ false: "#E8E4DF", true: "#D9BEB3" }}
                thumbColor="#ffffff"
              />
            </View>
            {outputs.haptic ? (
              <View style={localStyles.segmentGroup}>
                {HAPTIC_STRENGTH_PRESETS.map((preset) => {
                  const active = preset.id === activeHapticStrengthId;
                  return (
                    <Pressable
                      key={preset.id}
                      style={({ pressed }) => [
                        localStyles.segment,
                        localStyles.segmentFlex,
                        active ? localStyles.segmentActive : null,
                        pressed ? localStyles.pressed : null,
                      ]}
                      onPress={() => onChangeHapticLevel(preset.level)}
                      disabled={disabled}
                    >
                      <Text style={[localStyles.segmentText, active ? localStyles.segmentTextActive : null]}>
                        {preset.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const localStyles = StyleSheet.create({
  title: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 19,
    color: "#1b1c1a",
    marginBottom: 14,
  },
  disabledNote: {
    fontSize: 13,
    lineHeight: 18,
    color: "#84736f",
    paddingBottom: 16,
  },
  section: {
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: "#E8E4DF",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    paddingBottom: 4,
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#524440",
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#524440",
    marginBottom: 2,
  },
  tempoValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F1ED",
  },
  pressed: {
    opacity: 0.7,
  },
  tempoValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#B87D6B",
    fontVariant: ["tabular-nums"],
  },
  tapTempoBtn: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "#F4F1ED",
    marginTop: 8,
    marginBottom: 4,
  },
  tapTempoBtnActive: {
    backgroundColor: "#B87D6B",
  },
  tapTempoText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#B87D6B",
  },
  tapTempoTextActive: {
    color: "#FFFFFF",
    fontVariant: ["tabular-nums"],
  },
  meterScrollContent: {
    gap: 6,
    paddingVertical: 2,
  },
  chip: {
    minHeight: 30,
    borderRadius: 15,
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F4F1ED",
  },
  chipActive: {
    backgroundColor: "#B87D6B",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#84736f",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  segmentGroup: {
    flexDirection: "row",
    backgroundColor: "#F4F1ED",
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  segment: {
    minHeight: 28,
    borderRadius: 6,
    paddingHorizontal: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  segmentFlex: {
    flex: 1,
  },
  segmentActive: {
    backgroundColor: "#B87D6B",
  },
  segmentText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#84736f",
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
  cueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  cueLabel: {
    flex: 1,
    fontSize: 13,
    color: "#1b1c1a",
  },
  subControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 26,
    paddingBottom: 8,
  },
  subSlider: {
    flex: 1,
  },
});
