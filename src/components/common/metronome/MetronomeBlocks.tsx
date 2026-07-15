import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { haptic } from "../../../design/haptics";
import { colors, radii } from "../../../design/tokens";
import {
  MAX_METRONOME_BPM,
  MAX_METRONOME_LEVEL,
  METRONOME_METER_PRESETS,
  MIN_METRONOME_BPM,
  MIN_METRONOME_LEVEL,
  type MetronomeMeterId,
  type MetronomeOutputKey,
  type MetronomeOutputs,
} from "../../../domain/metronome";

/**
 * Shared metronome control blocks — the single source for the tempo stepper/tap/
 * slider, meter chips, cue tiles, and level sub-controls. Rendered by both the
 * in-recorder sheet (RecordingMetronomeSheet) and the standalone Metronome page,
 * so the two surfaces stay pixel-identical as they evolve.
 */

export type HapticStrengthId = "light" | "medium" | "strong";

export const HAPTIC_STRENGTH_PRESETS: { id: HapticStrengthId; label: string; level: number }[] = [
  { id: "light", label: "Light", level: 20 },
  { id: "medium", label: "Medium", level: 55 },
  { id: "strong", label: "Strong", level: 90 },
];

export function nearestHapticStrengthId(level: number): HapticStrengthId {
  return HAPTIC_STRENGTH_PRESETS.reduce((closest, preset) =>
    Math.abs(preset.level - level) < Math.abs(closest.level - level) ? preset : closest
  ).id;
}

export function TempoBlock({
  bpm,
  tapCount,
  disabled,
  onNudgeBpm,
  onSetBpmValue,
  onTapTempo,
}: {
  bpm: number;
  tapCount: number;
  disabled?: boolean;
  onNudgeBpm: (delta: number) => void;
  onSetBpmValue: (value: number) => void;
  onTapTempo: () => unknown;
}) {
  return (
    <>
      <View style={ms.tempoRow}>
        <View style={ms.stepper}>
          <Pressable
            style={({ pressed }) => [ms.step, pressed ? ms.pressed : null]}
            onPress={() => onNudgeBpm(-1)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Slow the tempo by one BPM"
          >
            <Ionicons name="remove" size={15} color={colors.primary} />
          </Pressable>
          <Text style={ms.bpm}>{bpm} BPM</Text>
          <Pressable
            style={({ pressed }) => [ms.step, pressed ? ms.pressed : null]}
            onPress={() => onNudgeBpm(1)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Raise the tempo by one BPM"
          >
            <Ionicons name="add" size={15} color={colors.primary} />
          </Pressable>
        </View>
        <Pressable
          style={({ pressed }) => [
            ms.tap,
            tapCount > 0 ? ms.tapActive : null,
            pressed ? ms.pressed : null,
          ]}
          onPress={() => onTapTempo()}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Tap tempo"
        >
          <Ionicons
            name="hand-left-outline"
            size={15}
            color={tapCount > 0 ? colors.onPrimary : colors.primary}
          />
          <Text style={[ms.tapText, tapCount > 0 ? ms.tapTextActive : null]}>
            {tapCount > 0 ? `Tap (${tapCount})` : "Tap"}
          </Text>
        </Pressable>
      </View>
      <Slider
        onSlidingComplete={() => haptic.tap()}
        minimumValue={MIN_METRONOME_BPM}
        maximumValue={MAX_METRONOME_BPM}
        step={1}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.borderSubtle}
        thumbTintColor={colors.primary}
        value={bpm}
        onValueChange={onSetBpmValue}
        disabled={disabled}
      />
    </>
  );
}

export function MeterChips({
  meterId,
  disabled,
  onSelectMeter,
}: {
  meterId: MetronomeMeterId;
  disabled?: boolean;
  onSelectMeter: (meterId: MetronomeMeterId) => void;
}) {
  return (
    <View style={ms.chipsRow}>
      {METRONOME_METER_PRESETS.map((preset) => {
        const active = preset.id === meterId;
        return (
          <Pressable
            key={preset.id}
            style={({ pressed }) => [ms.chip, active ? ms.chipActive : null, pressed ? ms.pressed : null]}
            onPress={() => onSelectMeter(preset.id)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${preset.label} time`}
          >
            <Text style={[ms.chipText, active ? ms.chipTextActive : null]}>{preset.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const CUES: { key: MetronomeOutputKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "beep", label: "Beep", icon: "volume-high-outline" },
  { key: "visual", label: "Visual", icon: "pulse-outline" },
  { key: "haptic", label: "Haptic", icon: "phone-portrait-outline" },
];

export function CueTiles({
  outputs,
  disabled,
  onToggleOutput,
}: {
  outputs: MetronomeOutputs;
  disabled?: boolean;
  onToggleOutput: (key: MetronomeOutputKey) => void;
}) {
  return (
    <View style={ms.cuesRow}>
      {CUES.map((cue) => {
        const active = outputs[cue.key];
        return (
          <Pressable
            key={cue.key}
            style={({ pressed }) => [ms.cue, active ? ms.cueActive : null, pressed ? ms.pressed : null]}
            onPress={() => onToggleOutput(cue.key)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={cue.label}
          >
            <Ionicons name={cue.icon} size={20} color={active ? colors.primaryDeep : colors.textMuted} />
            <Text style={[ms.cueLabel, active ? ms.cueLabelActive : null]}>{cue.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function BeepLevelControl({
  beepLevel,
  onChangeBeepLevel,
}: {
  beepLevel: number;
  onChangeBeepLevel: (level: number) => void;
}) {
  return (
    <View style={ms.subControl}>
      <Ionicons name="volume-low-outline" size={14} color={colors.textMuted} />
      <Slider
        onSlidingComplete={() => haptic.tap()}
        style={ms.subSlider}
        minimumValue={MIN_METRONOME_LEVEL}
        maximumValue={MAX_METRONOME_LEVEL}
        step={1}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.borderSubtle}
        thumbTintColor={colors.primary}
        value={beepLevel}
        onValueChange={onChangeBeepLevel}
      />
      <Ionicons name="volume-high-outline" size={14} color={colors.textMuted} />
    </View>
  );
}

export function HapticStrengthControl({
  hapticLevel,
  onChangeHapticLevel,
}: {
  hapticLevel: number;
  onChangeHapticLevel: (level: number) => void;
}) {
  const activeId = nearestHapticStrengthId(hapticLevel);
  return (
    <View style={ms.segmentGroup}>
      {HAPTIC_STRENGTH_PRESETS.map((preset) => {
        const active = preset.id === activeId;
        return (
          <Pressable
            key={preset.id}
            style={({ pressed }) => [ms.segment, active ? ms.segmentActive : null, pressed ? ms.pressed : null]}
            onPress={() => onChangeHapticLevel(preset.level)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${preset.label} haptic strength`}
          >
            <Text style={[ms.segmentText, active ? ms.segmentTextActive : null]}>{preset.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Shared styles for the metronome control vocabulary (sheet + standalone page). */
export const ms = StyleSheet.create({
  label: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textSecondary,
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
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceContainer,
  },
  bpm: {
    fontSize: 17,
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.primary,
    fontVariant: ["tabular-nums"],
  },
  tap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceContainer,
  },
  tapActive: {
    backgroundColor: colors.primary,
  },
  tapText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.primary,
  },
  tapTextActive: {
    color: colors.onPrimary,
    fontVariant: ["tabular-nums"],
  },
  quietRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  quietLabel: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textPrimary,
  },
  valuePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceContainer,
  },
  valueText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.textStrong,
    fontVariant: ["tabular-nums"],
  },
  segmentGroup: {
    flexDirection: "row",
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    padding: 3,
    gap: 3,
    marginBottom: 6,
  },
  segment: {
    flex: 1,
    minHeight: 36,
    borderRadius: radii.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.onPrimary,
  },
  chipsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  chip: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceContainer,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.onPrimary,
  },
  cuesRow: {
    flexDirection: "row",
    gap: 8,
  },
  cue: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  cueActive: {
    backgroundColor: "#F2E4DF",
  },
  cueLabel: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textSecondary,
  },
  cueLabelActive: {
    color: colors.primaryDeep,
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
