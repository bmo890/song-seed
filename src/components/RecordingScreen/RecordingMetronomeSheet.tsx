import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { BottomSheet } from "../common/BottomSheet";
import { haptic } from "../../design/haptics";
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

const COUNT_IN_OPTIONS = [0, 1, 2, 4];

function nearestHapticStrengthId(level: number): HapticStrengthId {
  return HAPTIC_STRENGTH_PRESETS.reduce((closest, preset) =>
    Math.abs(preset.level - level) < Math.abs(closest.level - level) ? preset : closest
  ).id;
}

function countInLabel(bars: number) {
  return bars === 0 ? "Off" : `${bars} bar${bars > 1 ? "s" : ""}`;
}

function countInSubtitle(bars: number) {
  return bars === 0
    ? "Recording starts immediately"
    : `${bars} bar${bars > 1 ? "s" : ""} of clicks before recording`;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  disabled: boolean;
  isNativeAvailable: boolean;
  enabled: boolean;
  previewPlaying: boolean;
  bpm: number;
  meterId: MetronomeMeterId;
  countInBars: number;
  outputs: MetronomeOutputs;
  beepLevel: number;
  hapticLevel: number;
  tapCount: number;
  /** "Original take: 92 BPM · 4/4" when the target clip carries a saved recording grid
   *  (the metronome was preset to it on entry). Null when there's nothing to restore. */
  restoredGridLabel?: string | null;
  onToggleEnabled: (value: boolean) => void;
  onTogglePreview: () => void;
  onNudgeBpm: (delta: number) => void;
  onSetBpmValue: (value: number) => void;
  onTapTempo: () => number | null;
  onSelectMeter: (meterId: MetronomeMeterId) => void;
  onSelectCountInBars: (bars: number) => void;
  onToggleOutput: (key: MetronomeOutputKey) => void;
  onChangeBeepLevel: (level: number) => void;
  onChangeHapticLevel: (level: number) => void;
};

export function RecordingMetronomeSheet({
  visible,
  onClose,
  disabled,
  isNativeAvailable,
  enabled,
  previewPlaying,
  bpm,
  meterId,
  countInBars,
  outputs,
  beepLevel,
  hapticLevel,
  tapCount,
  restoredGridLabel,
  onToggleEnabled,
  onTogglePreview,
  onNudgeBpm,
  onSetBpmValue,
  onTapTempo,
  onSelectMeter,
  onSelectCountInBars,
  onToggleOutput,
  onChangeBeepLevel,
  onChangeHapticLevel,
}: Props) {
  const activeHapticStrengthId = useMemo(() => nearestHapticStrengthId(hapticLevel), [hapticLevel]);
  const meterLabel = METRONOME_METER_PRESETS.find((p) => p.id === meterId)?.label ?? "";
  const [expanded, setExpanded] = useState<"meter" | "countin" | null>(null);
  const toggleSection = (section: "meter" | "countin") =>
    setExpanded((prev) => (prev === section ? null : section));

  const cues: { key: MetronomeOutputKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "beep", label: "Beep", icon: "volume-high-outline" },
    { key: "visual", label: "Visual", icon: "pulse-outline" },
    { key: "haptic", label: "Haptic", icon: "phone-portrait-outline" },
  ];

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={s.titleRow}>
        <View style={s.titleLead}>
          <Text style={s.title}>Metronome</Text>
          <Text style={s.titleSub}>{enabled ? "On — clicks while you record" : "Off — no click in the take"}</Text>
          {restoredGridLabel ? <Text style={s.titleGridNote}>{restoredGridLabel}</Text> : null}
        </View>
        <Switch
          value={enabled}
          onValueChange={onToggleEnabled}
          disabled={disabled || !isNativeAvailable}
          trackColor={{ false: "#E8E4DF", true: "#B87D6B" }}
          thumbColor="#ffffff"
        />
      </View>

      {isNativeAvailable ? (
        <Pressable
          style={({ pressed }) => [
            s.listenBtn,
            previewPlaying ? s.listenBtnActive : null,
            pressed ? s.pressed : null,
          ]}
          onPress={onTogglePreview}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={previewPlaying ? "Stop the preview" : "Listen to the metronome"}
        >
          <Ionicons
            name={previewPlaying ? "stop" : "play"}
            size={14}
            color={previewPlaying ? "#FFFFFF" : "#824f3f"}
          />
          <Text style={[s.listenBtnText, previewPlaying ? s.listenBtnTextActive : null]}>
            {previewPlaying ? "Stop preview" : "Listen"}
          </Text>
        </Pressable>
      ) : null}

      {!isNativeAvailable ? (
        <Text style={s.disabledNote}>Rebuild the app to use the native metronome engine.</Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Tempo */}
          <Text style={s.label}>Tempo</Text>
          <View style={s.tempoRow}>
            <View style={s.stepper}>
              <Pressable
                style={({ pressed }) => [s.step, pressed ? s.pressed : null]}
                onPress={() => onNudgeBpm(-1)}
                disabled={disabled}
              >
                <Ionicons name="remove" size={15} color="#B87D6B" />
              </Pressable>
              <Text style={s.bpm}>{bpm} BPM</Text>
              <Pressable
                style={({ pressed }) => [s.step, pressed ? s.pressed : null]}
                onPress={() => onNudgeBpm(1)}
                disabled={disabled}
              >
                <Ionicons name="add" size={15} color="#B87D6B" />
              </Pressable>
            </View>
            <Pressable
              style={({ pressed }) => [
                s.tap,
                tapCount > 0 ? s.tapActive : null,
                pressed ? s.pressed : null,
              ]}
              onPress={onTapTempo}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel="Tap tempo"
            >
              <Ionicons name="hand-left-outline" size={15} color={tapCount > 0 ? "#FFFFFF" : "#B87D6B"} />
              <Text style={[s.tapText, tapCount > 0 ? s.tapTextActive : null]}>
                {tapCount > 0 ? `Tap (${tapCount})` : "Tap"}
              </Text>
            </Pressable>
          </View>
          <Slider
            onSlidingComplete={() => haptic.tap()}
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

          {/* Count-in — pronounced, self-explaining row */}
          <Pressable
            style={({ pressed }) => [s.featureRow, s.divider, pressed ? s.pressed : null]}
            onPress={() => toggleSection("countin")}
            disabled={disabled}
          >
            <View style={s.featureLead}>
              <View style={s.iconTile}>
                <Ionicons name="timer-outline" size={18} color="#824f3f" />
              </View>
              <View style={s.featureCopy}>
                <Text style={s.featureTitle}>Count-in</Text>
                <Text style={s.featureSub} numberOfLines={1}>{countInSubtitle(countInBars)}</Text>
              </View>
            </View>
            <View style={s.valuePill}>
              <Text style={s.valueText}>{countInLabel(countInBars)}</Text>
              <Ionicons name={expanded === "countin" ? "chevron-up" : "chevron-down"} size={13} color="#a89994" />
            </View>
          </Pressable>
          {expanded === "countin" ? (
            <View style={s.segmentGroup}>
              {COUNT_IN_OPTIONS.map((bars) => {
                const active = countInBars === bars;
                return (
                  <Pressable
                    key={bars}
                    style={({ pressed }) => [s.segment, active ? s.segmentActive : null, pressed ? s.pressed : null]}
                    onPress={() => {
                      onSelectCountInBars(bars);
                      setExpanded(null);
                    }}
                    disabled={disabled}
                  >
                    <Text style={[s.segmentText, active ? s.segmentTextActive : null]}>{countInLabel(bars)}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* Meter — quiet row */}
          <Pressable
            style={({ pressed }) => [s.quietRow, s.divider, pressed ? s.pressed : null]}
            onPress={() => toggleSection("meter")}
            disabled={disabled}
          >
            <Text style={s.quietLabel}>Meter</Text>
            <View style={s.valuePill}>
              <Text style={s.valueText}>{meterLabel}</Text>
              <Ionicons name={expanded === "meter" ? "chevron-up" : "chevron-down"} size={13} color="#a89994" />
            </View>
          </Pressable>
          {expanded === "meter" ? (
            <View style={s.chipsRow}>
              {METRONOME_METER_PRESETS.map((preset) => {
                const active = preset.id === meterId;
                return (
                  <Pressable
                    key={preset.id}
                    style={({ pressed }) => [s.chip, active ? s.chipActive : null, pressed ? s.pressed : null]}
                    onPress={() => {
                      onSelectMeter(preset.id);
                      setExpanded(null);
                    }}
                    disabled={disabled}
                  >
                    <Text style={[s.chipText, active ? s.chipTextActive : null]}>{preset.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* Cues — square toggles */}
          <Text style={[s.label, s.divider, { paddingTop: 14 }]}>Cues</Text>
          <View style={s.cuesRow}>
            {cues.map((cue) => {
              const active = outputs[cue.key];
              return (
                <Pressable
                  key={cue.key}
                  style={({ pressed }) => [s.cue, active ? s.cueActive : null, pressed ? s.pressed : null]}
                  onPress={() => onToggleOutput(cue.key)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={cue.label}
                >
                  <Ionicons name={cue.icon} size={20} color={active ? "#824f3f" : "#a89994"} />
                  <Text style={[s.cueLabel, active ? s.cueLabelActive : null]}>{cue.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Levels stay adjustable mid-take: volume is a live param on the native engine
              (no restart, no phase reset) and haptic strength is JS-side only. Structural
              controls (tempo/meter/count-in/cue toggles) stay locked while recording. */}
          {outputs.beep ? (
            <View style={s.subControl}>
              <Ionicons name="volume-low-outline" size={14} color="#a89994" />
              <Slider
                onSlidingComplete={() => haptic.tap()}
                style={s.subSlider}
                minimumValue={MIN_METRONOME_LEVEL}
                maximumValue={MAX_METRONOME_LEVEL}
                step={1}
                minimumTrackTintColor="#B87D6B"
                maximumTrackTintColor="#E8E4DF"
                thumbTintColor="#B87D6B"
                value={beepLevel}
                onValueChange={onChangeBeepLevel}
              />
              <Ionicons name="volume-high-outline" size={14} color="#a89994" />
            </View>
          ) : null}

          {outputs.haptic ? (
            <View style={s.segmentGroup}>
              {HAPTIC_STRENGTH_PRESETS.map((preset) => {
                const active = preset.id === activeHapticStrengthId;
                return (
                  <Pressable
                    key={preset.id}
                    style={({ pressed }) => [s.segment, active ? s.segmentActive : null, pressed ? s.pressed : null]}
                    onPress={() => onChangeHapticLevel(preset.level)}
                  >
                    <Text style={[s.segmentText, active ? s.segmentTextActive : null]}>{preset.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  titleLead: {
    flexShrink: 1,
  },
  title: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 19,
    color: "#1b1c1a",
  },
  titleSub: {
    fontSize: 11,
    color: "#84736f",
    marginTop: 1,
  },
  titleGridNote: {
    fontSize: 11,
    color: "#824f3f",
    fontWeight: "600",
    marginTop: 2,
  },
  listenBtn: {
    flexDirection: "row",
    alignSelf: "flex-end",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#F4F1ED",
    marginTop: 12,
  },
  listenBtnActive: {
    backgroundColor: "#B87D6B",
  },
  listenBtnText: {
    color: "#824f3f",
    fontSize: 13,
    fontWeight: "700",
  },
  listenBtnTextActive: {
    color: "#FFFFFF",
  },
  disabledNote: {
    fontSize: 13,
    lineHeight: 18,
    color: "#84736f",
    paddingBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#84736f",
    marginTop: 16,
    marginBottom: 8,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: "#EFE8E2",
  },
  tempoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  step: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F1ED",
  },
  bpm: {
    fontSize: 17,
    fontWeight: "800",
    color: "#B87D6B",
    fontVariant: ["tabular-nums"],
  },
  tap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#F4F1ED",
  },
  tapActive: {
    backgroundColor: "#B87D6B",
  },
  tapText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#B87D6B",
  },
  tapTextActive: {
    color: "#FFFFFF",
    fontVariant: ["tabular-nums"],
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    marginTop: 16,
  },
  featureLead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexShrink: 1,
  },
  iconTile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#F2E4DF",
    alignItems: "center",
    justifyContent: "center",
  },
  featureCopy: {
    flexShrink: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1b1c1a",
  },
  featureSub: {
    fontSize: 11,
    color: "#84736f",
    marginTop: 1,
  },
  quietRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  quietLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1b1c1a",
  },
  valuePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#F4F1ED",
  },
  valueText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#524440",
    fontVariant: ["tabular-nums"],
  },
  segmentGroup: {
    flexDirection: "row",
    backgroundColor: "#F4F1ED",
    borderRadius: 10,
    padding: 3,
    gap: 3,
    marginBottom: 6,
  },
  segment: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  segmentActive: {
    backgroundColor: "#B87D6B",
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#84736f",
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
  chipsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#F4F1ED",
  },
  chipActive: {
    backgroundColor: "#B87D6B",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#84736f",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  cuesRow: {
    flexDirection: "row",
    gap: 8,
  },
  cue: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#F4F1ED",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  cueActive: {
    backgroundColor: "#F2E4DF",
  },
  cueLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#84736f",
  },
  cueLabelActive: {
    color: "#824f3f",
  },
  subControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  subSlider: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
