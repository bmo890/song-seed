import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import {
  MAX_METRONOME_BPM,
  METRONOME_COUNT_IN_BAR_OPTIONS,
  METRONOME_METER_PRESETS,
  MIN_METRONOME_BPM,
  type MetronomeMeterId,
  type MetronomeOutputKey,
  type MetronomeOutputs,
} from "../../metronome";

type Props = {
  enabled: boolean;
  disabled?: boolean;
  bpm: number;
  meterId: MetronomeMeterId;
  countInBars: number;
  outputs: MetronomeOutputs;
  tapCount: number;
  isNativeAvailable: boolean;
  onToggleEnabled: (value: boolean) => void;
  onNudgeBpm: (delta: number) => void;
  onSetBpmValue: (value: number) => void;
  onTapTempo: () => void;
  onResetTapTempo: () => void;
  onSelectMeter: (meterId: MetronomeMeterId) => void;
  onSelectCountInBars: (bars: number) => void;
  onToggleOutput: (key: MetronomeOutputKey) => void;
};

const BPM_STEPS = [
  { label: "-5", delta: -5 },
  { label: "-1", delta: -1 },
  { label: "+1", delta: 1 },
  { label: "+5", delta: 5 },
];

export function RecordingMetronomeSection({
  enabled,
  disabled = false,
  bpm,
  meterId,
  countInBars,
  outputs,
  tapCount,
  isNativeAvailable,
  onToggleEnabled,
  onNudgeBpm,
  onSetBpmValue,
  onTapTempo,
  onResetTapTempo,
  onSelectMeter,
  onSelectCountInBars,
  onToggleOutput,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (enabled) {
      setExpanded(true);
    }
  }, [enabled]);

  const countInLabel = countInBars === 0 ? "No count-in" : `${countInBars} bar count-in`;
  const cueSummary = useMemo(() => {
    const active = Object.entries(outputs)
      .filter(([, value]) => value)
      .map(([key]) => {
        if (key === "beep") return "Beep";
        if (key === "visual") return "Visual";
        return "Haptic";
      });

    return active.length > 0 ? active.join(" + ") : "No cues";
  }, [outputs]);

  return (
    <View style={localStyles.section}>
      <View style={localStyles.headerRow}>
        <Pressable
          style={({ pressed }) => [
            localStyles.headerPressable,
            pressed ? localStyles.pillPressed : null,
          ]}
          onPress={() => setExpanded((current) => !current)}
        >
          <View style={[localStyles.iconBadge, enabled ? localStyles.iconBadgeActive : null]}>
            <Ionicons name="pulse-outline" size={16} color={enabled ? "#1e4f84" : "#64748b"} />
          </View>

          <View style={localStyles.headerCopy}>
            <View style={localStyles.titleRow}>
              <Text style={localStyles.title}>Metronome</Text>
              <Text style={[localStyles.statusPill, enabled ? localStyles.statusPillActive : null]}>
                {enabled ? "On" : "Off"}
              </Text>
            </View>
            <Text style={localStyles.meta} numberOfLines={1}>
              {enabled
                ? `${bpm} BPM · ${meterId} · ${countInLabel} · ${cueSummary}`
                : isNativeAvailable
                  ? "Expand to set tempo, meter, and cues."
                  : "Rebuild the app to enable the native metronome engine."}
            </Text>
          </View>

          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color="#64748b"
          />
        </Pressable>

        <Switch
          value={enabled}
          onValueChange={onToggleEnabled}
          disabled={disabled || !isNativeAvailable}
          trackColor={{ false: "#dbe4ef", true: "#bdd9f5" }}
          thumbColor="#ffffff"
        />
      </View>

      {expanded ? (
        <View style={localStyles.controls}>
          {!isNativeAvailable ? (
            <Text style={localStyles.disabledNote}>
              Rebuild the app to use the native metronome engine on the recording screen.
            </Text>
          ) : null}

          {enabled ? (
            <>
              <View style={localStyles.group}>
                <View style={localStyles.groupHeaderRow}>
                  <Text style={localStyles.groupLabel}>Tempo</Text>
                  <Text style={localStyles.groupValue}>{bpm} BPM</Text>
                </View>
                <Slider
                  minimumValue={MIN_METRONOME_BPM}
                  maximumValue={MAX_METRONOME_BPM}
                  step={1}
                  minimumTrackTintColor="#7aa9da"
                  maximumTrackTintColor="#d7dee8"
                  thumbTintColor="#548ec9"
                  value={bpm}
                  onValueChange={onSetBpmValue}
                  disabled={disabled}
                />
                <View style={localStyles.sliderLabels}>
                  <Text style={localStyles.sliderLabel}>{MIN_METRONOME_BPM}</Text>
                  <Text style={localStyles.sliderLabel}>{MAX_METRONOME_BPM}</Text>
                </View>
                <View style={localStyles.actionRow}>
                  {BPM_STEPS.map((step) => (
                    <Pressable
                      key={step.label}
                      style={({ pressed }) => [
                        localStyles.pill,
                        disabled ? localStyles.pillDisabled : null,
                        pressed ? localStyles.pillPressed : null,
                      ]}
                      onPress={() => onNudgeBpm(step.delta)}
                      disabled={disabled}
                  >
                    <Text style={localStyles.pillText}>{step.label}</Text>
                  </Pressable>
                ))}
                </View>
                <View style={localStyles.tapTempoRow}>
                  <Pressable
                    style={({ pressed }) => [
                      localStyles.pill,
                      localStyles.tapTempoPill,
                      disabled ? localStyles.pillDisabled : null,
                      pressed ? localStyles.pillPressed : null,
                    ]}
                    onPress={onTapTempo}
                    disabled={disabled}
                  >
                    <Text style={localStyles.pillText}>
                      {tapCount > 0 ? `Tap tempo (${tapCount})` : "Tap tempo"}
                    </Text>
                  </Pressable>
                  {tapCount > 0 ? (
                    <Pressable
                      style={({ pressed }) => [
                        localStyles.secondaryPill,
                        disabled ? localStyles.pillDisabled : null,
                        pressed ? localStyles.pillPressed : null,
                      ]}
                      onPress={onResetTapTempo}
                      disabled={disabled}
                    >
                      <Text style={localStyles.secondaryPillText}>Reset</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              <View style={localStyles.group}>
                <Text style={localStyles.groupLabel}>Meter</Text>
                <View style={localStyles.choiceRow}>
                  {METRONOME_METER_PRESETS.map((preset) => {
                    const active = preset.id === meterId;
                    return (
                      <Pressable
                        key={preset.id}
                        style={({ pressed }) => [
                          localStyles.choicePill,
                          active ? localStyles.choicePillActive : null,
                          disabled ? localStyles.pillDisabled : null,
                          pressed ? localStyles.pillPressed : null,
                        ]}
                        onPress={() => onSelectMeter(preset.id)}
                        disabled={disabled}
                      >
                        <Text style={[localStyles.choiceText, active ? localStyles.choiceTextActive : null]}>
                          {preset.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={localStyles.group}>
                <Text style={localStyles.groupLabel}>Count-in</Text>
                <View style={localStyles.choiceRow}>
                  {METRONOME_COUNT_IN_BAR_OPTIONS.map((bars) => {
                    const active = bars === countInBars;
                    const label = bars === 0 ? "Off" : `${bars} bar${bars === 1 ? "" : "s"}`;
                    return (
                      <Pressable
                        key={bars}
                        style={({ pressed }) => [
                          localStyles.choicePill,
                          active ? localStyles.choicePillActive : null,
                          disabled ? localStyles.pillDisabled : null,
                          pressed ? localStyles.pillPressed : null,
                        ]}
                        onPress={() => onSelectCountInBars(bars)}
                        disabled={disabled}
                      >
                        <Text style={[localStyles.choiceText, active ? localStyles.choiceTextActive : null]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={localStyles.group}>
                <Text style={localStyles.groupLabel}>Cue outputs</Text>
                <View style={localStyles.choiceRow}>
                  {[
                    { key: "beep" as const, label: "Beep", icon: "volume-high-outline" as const },
                    { key: "visual" as const, label: "Visual", icon: "pulse-outline" as const },
                    { key: "haptic" as const, label: "Haptic", icon: "phone-portrait-outline" as const },
                  ].map((output) => {
                    const active = outputs[output.key];
                    return (
                      <Pressable
                        key={output.key}
                        style={({ pressed }) => [
                          localStyles.choicePill,
                          active ? localStyles.choicePillActive : null,
                          disabled ? localStyles.pillDisabled : null,
                          pressed ? localStyles.pillPressed : null,
                        ]}
                        onPress={() => onToggleOutput(output.key)}
                        disabled={disabled}
                      >
                        <Ionicons
                          name={output.icon}
                          size={14}
                          color={active ? "#1e4f84" : "#64748b"}
                        />
                        <Text style={[localStyles.choiceText, active ? localStyles.choiceTextActive : null]}>
                          {output.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </>
          ) : (
            <Text style={localStyles.disabledNote}>
              Enable the metronome to expose tempo, tap, meter, and cue controls.
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const localStyles = StyleSheet.create({
  section: {
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef2f7",
    borderWidth: 1,
    borderColor: "#d7dee8",
  },
  iconBadgeActive: {
    backgroundColor: "#d9e9fb",
    borderColor: "#8db6e3",
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
    color: "#64748b",
    backgroundColor: "#eef2f7",
    overflow: "hidden",
  },
  statusPillActive: {
    color: "#1e4f84",
    backgroundColor: "#d9e9fb",
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
    color: "#64748b",
  },
  controls: {
    gap: 14,
    paddingTop: 2,
  },
  group: {
    gap: 8,
  },
  groupHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  groupLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: "#334155",
  },
  groupValue: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: "#1e4f84",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tapTempoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  choiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -4,
  },
  sliderLabel: {
    fontSize: 11,
    lineHeight: 14,
    color: "#94a3b8",
    fontWeight: "600",
  },
  pill: {
    minHeight: 30,
    borderRadius: 15,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#eef2f7",
    borderWidth: 1,
    borderColor: "#d7dee8",
  },
  pillDisabled: {
    opacity: 0.5,
  },
  pillPressed: {
    transform: [{ scale: 0.98 }],
  },
  pillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: "#334155",
  },
  tapTempoPill: {
    paddingHorizontal: 14,
    minWidth: 108,
  },
  secondaryPill: {
    minHeight: 30,
    borderRadius: 15,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d7dee8",
  },
  secondaryPillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: "#475569",
  },
  choicePill: {
    minHeight: 32,
    borderRadius: 16,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#eef2f7",
    borderWidth: 1,
    borderColor: "#d7dee8",
  },
  choicePillActive: {
    backgroundColor: "#d9e9fb",
    borderColor: "#8db6e3",
  },
  choiceText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: "#475569",
  },
  choiceTextActive: {
    color: "#1e4f84",
  },
  disabledNote: {
    fontSize: 12,
    lineHeight: 16,
    color: "#64748b",
  },
});
