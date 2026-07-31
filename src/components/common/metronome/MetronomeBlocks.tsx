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
  formatGrouping,
  getMetronomeMeterPreset,
  isSameGrouping,
  type MetronomeMeterId,
  type MetronomeOutputKey,
  type MetronomeOutputs,
} from "../../../domain/metronome";
import { SegmentedControl } from "../SegmentedControl";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  return (
    <>
      <View style={ms.tempoRow}>
        <View style={ms.stepper}>
          <Pressable
            style={({ pressed }) => [ms.step, pressed ? ms.pressed : null]}
            onPress={() => onNudgeBpm(-1)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={t("metronome.slow")}
          >
            <Ionicons name="remove" size={15} color={colors.primary} />
          </Pressable>
          <Text style={ms.bpm}>{bpm} BPM</Text>
          <Pressable
            style={({ pressed }) => [ms.step, pressed ? ms.pressed : null]}
            onPress={() => onNudgeBpm(1)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={t("metronome.raise")}
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
          accessibilityLabel={t("metronome.tapTempo")}
        >
          <Ionicons
            name="hand-left-outline"
            size={15}
            color={tapCount > 0 ? colors.onPrimary : colors.primary}
          />
          <Text style={[ms.tapText, tapCount > 0 ? ms.tapTextActive : null]}>
            {tapCount > 0 ? t("metronome.tapCount", { count: tapCount }) : t("metronome.tap")}
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
  const { t } = useTranslation();
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
            accessibilityLabel={t("metronome.meterTime", { label: preset.label })}
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
  const { t } = useTranslation();
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
            accessibilityLabel={t(`metronome.${cue.key}`)}
          >
            <Ionicons name={cue.icon} size={20} color={active ? colors.primaryDeep : colors.textMuted} />
            <Text style={[ms.cueLabel, active ? ms.cueLabelActive : null]}>{t(`metronome.${cue.key}`)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The level controls for whichever cues are ON, each named. Two unlabelled
 * controls stacked under the tiles (a bare slider, then a bare three-way) gave
 * no way to tell which belonged to which — and turning a cue off silently
 * removed one of them, so the remaining control looked like it had changed
 * meaning. A cue's level now says whose it is, and appears only with its cue.
 */
export function CueLevels({
  outputs,
  beepLevel,
  hapticLevel,
  onChangeBeepLevel,
  onChangeHapticLevel,
}: {
  outputs: MetronomeOutputs;
  beepLevel: number;
  hapticLevel: number;
  onChangeBeepLevel: (level: number) => void;
  onChangeHapticLevel: (level: number) => void;
}) {
  const { t } = useTranslation();
  if (!outputs.beep && !outputs.haptic) return null;
  return (
    <View style={ms.cueLevels}>
      {outputs.beep ? (
        <View>
          <Text style={ms.subLabel}>{t("metronome.beepVolume")}</Text>
          <BeepLevelControl beepLevel={beepLevel} onChangeBeepLevel={onChangeBeepLevel} />
        </View>
      ) : null}
      {outputs.haptic ? (
        <View>
          <Text style={ms.subLabel}>{t("metronome.hapticLevel")}</Text>
          <HapticStrengthControl hapticLevel={hapticLevel} onChangeHapticLevel={onChangeHapticLevel} />
        </View>
      ) : null}
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
  const { t } = useTranslation();
  const activeId = nearestHapticStrengthId(hapticLevel);
  // Canon single-select: the sliding thumb, not a hand-rolled row of filled
  // chips that made the same interaction look different from every other one.
  return (
    <View style={ms.segmentWrap}>
      <SegmentedControl
        options={HAPTIC_STRENGTH_PRESETS.map((preset) => ({
          key: preset.id,
          label: t(`metronome.${preset.id}`),
        }))}
        value={activeId}
        onChange={(id) => {
          const preset = HAPTIC_STRENGTH_PRESETS.find((option) => option.id === id);
          if (preset) onChangeHapticLevel(preset.level);
        }}
      />
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
  // Soft keys at r8 — stadium was retired on text buttons (2026-07-24).
  tap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: radii.lg,
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
    borderRadius: radii.lg,
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
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 16,
    borderRadius: radii.lg,
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
    backgroundColor: colors.primarySurface,
  },
  cueLabel: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textSecondary,
  },
  cueLabelActive: {
    color: colors.primaryDeep,
  },
  // Grouping is subordinate to meter, so its active state is a tonal wash rather
  // than the solid fill — one glance tells you which row is the primary choice.
  chipActiveSoft: {
    backgroundColor: "#F3E4DE",
  },
  chipTextActiveSoft: {
    color: colors.primaryDeep,
  },
  subLabel: {
    fontSize: 9.5,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginTop: 12,
    marginBottom: 6,
  },
  cueLevels: {
    gap: 4,
  },
  segmentWrap: {
    marginBottom: 6,
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

/**
 * How the bar is FELT, not how many pulses it has: 5/4 as 2 + 3 or 3 + 2. Only
 * rendered when the meter offers a real choice, so 3/4 never shows a row with
 * one option in it.
 */
export function GroupingChips({
  meterId,
  grouping,
  disabled,
  onSelectGrouping,
}: {
  meterId: MetronomeMeterId;
  grouping: readonly number[];
  disabled?: boolean;
  onSelectGrouping: (meterId: MetronomeMeterId, grouping: number[] | null) => void;
}) {
  const { t } = useTranslation();
  const preset = getMetronomeMeterPreset(meterId);
  if (preset.groupings.length < 2) return null;
  return (
    <>
      {/* Named, because meter and grouping are different questions: without this
          the two chip rows read as one list of eight options. */}
      <Text style={ms.subLabel}>{t("metronome.grouping")}</Text>
      <View style={ms.chipsRow}>
      {preset.groupings.map((option) => {
        const active = isSameGrouping(option, grouping);
        const isDefault = isSameGrouping(option, preset.defaultGrouping);
        const label = option.length === 1 ? t("metronome.groupingEven") : formatGrouping(option);
        return (
          <Pressable
            key={label}
            style={({ pressed }) => [ms.chip, active ? ms.chipActiveSoft : null, pressed ? ms.pressed : null]}
            // Storing the default would freeze the preset's hand-tuned click
            // weights; passing null keeps them.
            onPress={() => onSelectGrouping(meterId, isDefault ? null : [...option])}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t("metronome.groupingA11y", { label })}
          >
            <Text style={[ms.chipText, active ? ms.chipTextActiveSoft : null]}>{label}</Text>
          </Pressable>
        );
      })}
      </View>
    </>
  );
}
