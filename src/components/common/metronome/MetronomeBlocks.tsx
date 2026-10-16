import React, { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Slider } from "../Slider";
import { haptic } from "../../../design/haptics";
import { colors, radii, spacing } from "../../../design/tokens";
import {
  MAX_METRONOME_BPM,
  MAX_METRONOME_LEVEL,
  METRONOME_CLICK_VOICES,
  METRONOME_FEEL_CUSTOM,
  METRONOME_METER_PRESETS,
  MIN_METRONOME_BPM,
  MIN_METRONOME_LEVEL,
  cyclePulseWeight,
  getMetronomeFeels,
  getMetronomeMeterPreset,
  getTempoMarking,
  type MetronomeClickVoice,
  type MetronomeFeel,
  type MetronomeMeterId,
  type MetronomeOutputKey,
  type MetronomeOutputs,
  type MetronomeSubdivision,
} from "../../../domain/metronome";
import { SegmentedControl } from "../SegmentedControl";
import { Stepper } from "../Stepper";
import { InkKey, inkKeyColor } from "../InkKey";
import { Press } from "../Press";
import { AnimatedCollapse } from "../AnimatedCollapse";
import { useTranslation } from "react-i18next";

/**
 * Shared metronome control blocks — the single source for the tempo stepper/tap/
 * slider, the meter row, the "click on" feel control with its bar strip, and the
 * cue rows. Rendered by both the in-recorder sheet (RecordingMetronomeSheet) and
 * the standalone Metronome page, so the two surfaces stay identical as they evolve.
 */

export type HapticStrengthId = "light" | "medium" | "strong";

export const HAPTIC_STRENGTH_PRESETS: { id: HapticStrengthId; level: number }[] = [
  { id: "light", level: 20 },
  { id: "medium", level: 55 },
  { id: "strong", level: 90 },
];

const CLICK_VOICE_LABEL_KEYS: Record<MetronomeClickVoice, string> = {
  click: "metronome.voiceClick",
  wood: "metronome.voiceWood",
};

export function nearestHapticStrengthId(level: number): HapticStrengthId {
  return HAPTIC_STRENGTH_PRESETS.reduce((closest, preset) =>
    Math.abs(preset.level - level) < Math.abs(closest.level - level) ? preset : closest
  ).id;
}

export function feelLabel(feel: MetronomeFeel, t: (key: string) => string) {
  return feel.label ?? (feel.labelKey ? t(feel.labelKey) : feel.id);
}

/** "4/4 · Beats": the meter and its feel, as the rows that open them read. */
export function meterSummary(
  meterId: MetronomeMeterId,
  feelId: string,
  supportsRests: boolean,
  t: (key: string) => string
) {
  const meter = METRONOME_METER_PRESETS.find((preset) => preset.id === meterId)?.label ?? "";
  const feel = getMetronomeFeels(meterId, supportsRests).find((candidate) => candidate.id === feelId);
  return feel ? `${meter} · ${feelLabel(feel, t)}` : meter;
}

/** "Click · Beep, Visual", or "Silent" with every cue off. `clickVoice` is
 *  omitted where the engine can't voice it. */
export function soundSummary(
  outputs: MetronomeOutputs,
  clickVoice: MetronomeClickVoice | undefined,
  t: (key: string) => string
) {
  const onCues = (["beep", "visual", "haptic"] as const).filter((key) => outputs[key]);
  if (onCues.length === 0) return t("metronome.cuesOff");
  return [
    ...(clickVoice && outputs.beep ? [t(CLICK_VOICE_LABEL_KEYS[clickVoice])] : []),
    onCues.map((key) => t(`metronome.${key}`)).join(", "),
  ].join(" · ");
}

/**
 * A setting folded to one line (2026-10-16, founder picked A): its name and
 * its value on a hairline; a tap unfolds its controls beneath and hides the
 * value, which the controls now show. The sheet keeps one open at a time.
 */
export function FoldRow({
  label,
  value,
  open,
  onToggle,
  disabled = false,
  children,
  testID,
}: {
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <View style={ms.foldRow}>
      <Press
        // Haptics vocabulary: tap, an acknowledged press (a disclosure opening).
        haptic="tap"
        style={ms.foldHead}
        onPress={onToggle}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled }}
        accessibilityLabel={open ? label : `${label}, ${value}`}
        testID={testID}
      >
        <Text style={[ms.foldLabel, open ? ms.foldLabelOpen : null]}>{label}</Text>
        {open ? null : (
          <Text style={ms.foldValue} numberOfLines={1}>
            {value}
          </Text>
        )}
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={15} color={colors.textMuted} />
      </Press>
      <AnimatedCollapse visible={open} style={ms.foldBody}>
        {children}
      </AnimatedCollapse>
    </View>
  );
}

export function TempoBlock({
  bpm,
  tapCount,
  disabled,
  onNudgeBpm,
  onSetBpmValue,
  onTapTempo,
  /** The standalone page's hero already names the marking under its big readout. */
  showMarking = true,
}: {
  bpm: number;
  tapCount: number;
  disabled?: boolean;
  onNudgeBpm: (delta: number) => void;
  onSetBpmValue: (value: number) => void;
  onTapTempo: () => unknown;
  showMarking?: boolean;
}) {
  const { t } = useTranslation();
  const tapping = tapCount > 0;
  return (
    <>
      {/* The kit Stepper (bare ink − / +, holds to repeat, its own tick) and
          Tap as an ink key: no grey discs, no boxed key (2026-10-15). */}
      <View style={[ms.tempoRow, disabled ? ms.dimmed : null]} pointerEvents={disabled ? "none" : "auto"}>
        <Stepper
          glyphs="plusMinus"
          onStep={(direction) => onNudgeBpm(direction)}
          decrementLabel={t("metronome.slow")}
          incrementLabel={t("metronome.raise")}
        >
          <View style={ms.bpmStack}>
            <Text style={ms.bpm}>{bpm} BPM</Text>
            {showMarking ? (
              <Text style={ms.bpmMarking}>{t(`metronome.marking.${getTempoMarking(bpm)}`)}</Text>
            ) : null}
          </View>
        </Stepper>
        <InkKey
          glyph={<Ionicons name="hand-left-outline" size={17} color={inkKeyColor(tapping ? "active" : "idle")} />}
          label={tapping ? t("metronome.tapCount", { count: tapCount }) : t("metronome.tap")}
          tone={tapping ? "active" : "idle"}
          onPress={() => onTapTempo()}
          accessibilityLabel={t("metronome.tapTempo")}
        />
      </View>
      {/* Ticks every 10 bpm: the whole range is a score of felt stops, not a buzz. */}
      <Slider
        minimumValue={MIN_METRONOME_BPM}
        maximumValue={MAX_METRONOME_BPM}
        step={1}
        detent={10}
        value={bpm}
        onValueChange={onSetBpmValue}
        disabled={disabled}
        accessibilityLabel={t("metronome.bpm")}
      />
    </>
  );
}

/** The eight meters: one choice of eight, so the canon SegmentedControl in
 *  ink (2026-10-15; were boxed tabular keys). */
export function MeterRow({
  meterId,
  disabled,
  onSelectMeter,
}: {
  meterId: MetronomeMeterId;
  disabled?: boolean;
  onSelectMeter: (meterId: MetronomeMeterId) => void;
}) {
  return (
    <View style={disabled ? ms.dimmed : null} pointerEvents={disabled ? "none" : "auto"}>
      <SegmentedControl
        options={METRONOME_METER_PRESETS.map((preset) => ({ key: preset.id, label: preset.label }))}
        value={meterId}
        onChange={onSelectMeter}
      />
    </View>
  );
}

/**
 * "Click on" — the one question after the meter. Folds sub-clicks and grouping
 * into the feels players actually set for that meter, plus Custom, which edits
 * the bar's pulses in the strip below. The strip always shows the bar you'll
 * hear; in Custom it becomes the editor.
 */
export function FeelControl({
  meterId,
  feelId,
  accentPattern,
  subdivision,
  supportsRests,
  supportsSubdivision,
  disabled,
  onSelectFeel,
  onChangeCustomPattern,
  hideLabel = false,
}: {
  meterId: MetronomeMeterId;
  feelId: string;
  /** The weights currently in force (custom or derived). */
  accentPattern: readonly number[];
  subdivision: MetronomeSubdivision;
  supportsRests: boolean;
  /** Older engines ignore sub-clicks, so feels that need them are not offered. */
  supportsSubdivision: boolean;
  disabled?: boolean;
  onSelectFeel: (feelId: string) => void;
  onChangeCustomPattern: (pattern: number[]) => void;
  hideLabel?: boolean;
}) {
  const { t } = useTranslation();
  const feels = getMetronomeFeels(meterId, supportsRests).filter(
    (feel) => supportsSubdivision || feel.subdivision === 1
  );
  const editing = feelId === METRONOME_FEEL_CUSTOM;
  const options = feels.map((feel) => ({ key: feel.id, label: feelLabel(feel, t), glyph: feel.glyph }));
  return (
    <View style={disabled ? ms.dimmed : null} pointerEvents={disabled ? "none" : "auto"}>
      {hideLabel ? null : <Text style={ms.label}>{t("metronome.clickOn")}</Text>}
      <SegmentedControl options={options} value={feelId} onChange={onSelectFeel} />
      <BarStrip
        meterId={meterId}
        accentPattern={accentPattern}
        subdivision={subdivision}
        editing={editing}
        onTapPulse={(index) => {
          const next = [...accentPattern];
          next[index] = cyclePulseWeight(next[index] ?? 0, supportsRests);
          onChangeCustomPattern(next);
        }}
      />
    </View>
  );
}

type PulseTier = "accent" | "click" | "rest";

function pulseTier(weight: number | undefined): PulseTier {
  if (weight == null || weight <= 0) return "rest";
  if (weight >= 0.65) return "accent";
  return "click";
}

/** The bar as dots: filled for an accent, hollow for a click, small for a rest,
 *  ticks between beats for sub-clicks. Tap a dot to cycle it while editing. */
export function BarStrip({
  meterId,
  accentPattern,
  subdivision,
  editing,
  onTapPulse,
}: {
  meterId: MetronomeMeterId;
  accentPattern: readonly number[];
  subdivision: MetronomeSubdivision;
  editing: boolean;
  onTapPulse: (index: number) => void;
}) {
  const { t } = useTranslation();
  const preset = getMetronomeMeterPreset(meterId);
  const pulses = Array.from({ length: preset.pulsesPerBar }, (_, index) => index);
  const ticks = Array.from({ length: Math.max(0, subdivision - 1) }, (_, index) => index);
  return (
    <>
      <View style={[ms.bar, editing ? ms.barEditing : null]}>
        {pulses.map((index) => {
          const tier = pulseTier(accentPattern[index]);
          const downbeat = index === 0 && tier === "accent";
          return (
            <View key={index} style={ms.beat}>
              <Pressable
                style={({ pressed }) => [ms.pulseHit, pressed && editing ? ms.pressed : null]}
                onPress={() => {
                  if (!editing) return;
                  // Haptics vocabulary: `tap` — a control changed value.
                  haptic.tap();
                  onTapPulse(index);
                }}
                disabled={!editing}
                hitSlop={4}
                accessibilityRole={editing ? "button" : undefined}
                accessibilityLabel={t("metronome.pulse.a11y", {
                  number: index + 1,
                  state: t(`metronome.pulse.${tier}`),
                })}
              >
                <View
                  style={[
                    ms.dot,
                    tier === "accent" ? (downbeat ? ms.dotDownbeat : ms.dotAccent) : null,
                    tier === "rest" ? ms.dotRest : null,
                  ]}
                />
              </Pressable>
              {ticks.map((tick) => (
                <View key={tick} style={ms.tick} />
              ))}
            </View>
          );
        })}
        {editing ? (
          <Text style={ms.barTrail}>{t("metronome.pulse.beatCount", { count: preset.pulsesPerBar })}</Text>
        ) : null}
      </View>
      {editing ? (
        <View style={ms.legend}>
          <View style={[ms.dot, ms.dotAccent, ms.legendDot]} />
          <Text style={ms.legendText}>{t("metronome.pulse.accent")}</Text>
          <View style={[ms.dot, ms.legendDot]} />
          <Text style={ms.legendText}>{t("metronome.pulse.click")}</Text>
          <View style={[ms.dot, ms.dotRest, ms.legendDot]} />
          <Text style={ms.legendText}>{t("metronome.pulse.rest")}</Text>
          <Text style={[ms.legendText, ms.legendHint]}>{t("metronome.pulse.edit")}</Text>
        </View>
      ) : null}
    </>
  );
}

const CUE_KEYS: MetronomeOutputKey[] = ["beep", "visual", "haptic"];

/**
 * The cues as a list of ink toggles (word + leading dot), each carrying its own
 * settings on its row: Beep has its volume and sound, Haptic its strength. A cue
 * that is off keeps its row and drops its controls, so the list never reflows.
 */
export function CueRows({
  outputs,
  beepLevel,
  hapticLevel,
  clickVoice,
  voiceDisabled,
  disabled,
  onToggleOutput,
  onChangeBeepLevel,
  onChangeHapticLevel,
  onChangeClickVoice,
}: {
  outputs: MetronomeOutputs;
  beepLevel: number;
  hapticLevel: number;
  /** Omitted on binaries that can't render a second voice — the key isn't there. */
  clickVoice?: MetronomeClickVoice;
  /** Voice is structural on the engine, so unlike the levels it locks mid-take. */
  voiceDisabled?: boolean;
  /** Locks the on/off toggles (structural); the level controls stay live. */
  disabled?: boolean;
  onToggleOutput: (key: MetronomeOutputKey) => void;
  onChangeBeepLevel: (level: number) => void;
  onChangeHapticLevel: (level: number) => void;
  onChangeClickVoice?: (voice: MetronomeClickVoice) => void;
}) {
  const { t } = useTranslation();
  return (
    <View>
      {CUE_KEYS.map((key, rowIndex) => {
        const on = outputs[key];
        return (
          <View key={key} style={[ms.cue, rowIndex > 0 ? ms.cueRowRule : null]}>
            <View style={ms.cueRow}>
              <Pressable
                style={({ pressed }) => [ms.cueToggle, pressed ? ms.pressed : null]}
                onPress={() => onToggleOutput(key)}
                disabled={disabled}
                hitSlop={{ top: 8, bottom: 8 }}
                accessibilityRole="switch"
                accessibilityState={{ checked: on }}
                accessibilityLabel={t(`metronome.${key}`)}
              >
                <View style={[ms.inkDot, on ? ms.inkDotOn : null]} />
                <Text style={[ms.cueWord, on ? ms.cueWordOn : null]}>{t(`metronome.${key}`)}</Text>
              </Pressable>
              {key === "visual" && on ? <Text style={ms.cueHint}>{t("metronome.visualHint")}</Text> : null}
            </View>
            {/* A cue that is on shows its own settings beneath it, indented to
                its word: Beep its volume and sound, Haptic its strength. One
                choice of a few is ink tabs (were boxed cycle keys). */}
            {key === "beep" && on ? (
              <View style={ms.cueBody}>
                <Slider
                  minimumValue={MIN_METRONOME_LEVEL}
                  maximumValue={MAX_METRONOME_LEVEL}
                  step={1}
                  detent={MAX_METRONOME_LEVEL - MIN_METRONOME_LEVEL > 20 ? 10 : 1}
                  value={beepLevel}
                  onValueChange={onChangeBeepLevel}
                  accessibilityLabel={t("metronome.beepVolume")}
                />
                {clickVoice && onChangeClickVoice ? (
                  <View
                    style={disabled || voiceDisabled ? ms.dimmed : null}
                    pointerEvents={disabled || voiceDisabled ? "none" : "auto"}
                  >
                    <SegmentedControl
                      options={METRONOME_CLICK_VOICES.map((voice) => ({
                        key: voice,
                        label: t(CLICK_VOICE_LABEL_KEYS[voice]),
                      }))}
                      value={clickVoice}
                      onChange={onChangeClickVoice}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}
            {key === "haptic" && on ? (
              <View style={ms.cueBody}>
                <SegmentedControl
                  options={HAPTIC_STRENGTH_PRESETS.map((preset) => ({
                    key: preset.id,
                    label: t(`metronome.${preset.id}`),
                  }))}
                  value={nearestHapticStrengthId(hapticLevel)}
                  onChange={(id) => {
                    const preset = HAPTIC_STRENGTH_PRESETS.find((option) => option.id === id);
                    if (preset) onChangeHapticLevel(preset.level);
                  }}
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** Shared styles for the metronome control vocabulary (sheet + standalone page). */
export const ms = StyleSheet.create({
  foldRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderMuted,
  },
  foldHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 52,
  },
  foldLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "PlusJakartaSans_500Medium",
    color: colors.textPrimary,
  },
  foldLabelOpen: {
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  foldValue: {
    flexShrink: 1,
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  foldBody: {
    paddingBottom: spacing.md,
  },
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
    borderTopColor: colors.borderSubtle,
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
  bpmStack: {
    alignItems: "center",
    minWidth: 84,
  },
  bpm: {
    fontSize: 17,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  // The classical marking — a musician's word for the number above it.
  bpmMarking: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textMuted,
    marginTop: 1,
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
  // ── Meter row ──
  meterRow: {
    flexDirection: "row",
    gap: 5,
  },
  meterKey: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceContainer,
  },
  meterKeyActive: {
    backgroundColor: colors.primarySurface,
  },
  meterKeyText: {
    fontSize: 12.5,
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.textStrong,
    fontVariant: ["tabular-nums"],
  },
  meterKeyTextActive: {
    color: colors.primaryDeep,
  },
  // ── Bar strip ──
  // The bar on the paper (2026-10-15): no box. Editing (Custom) earns the
  // tonal wash, the state colour, so you can see the dots are live.
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: radii.lg,
  },
  barEditing: {
    paddingHorizontal: 12,
    backgroundColor: colors.primarySurface,
  },
  beat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  pulseHit: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 13,
    height: 13,
    borderRadius: radii.round,
    borderWidth: 2,
    borderColor: colors.primaryDeep,
  },
  dotDownbeat: {
    width: 15,
    height: 15,
    backgroundColor: colors.primaryDeep,
  },
  dotAccent: {
    backgroundColor: colors.primaryDeep,
  },
  dotRest: {
    width: 7,
    height: 7,
    borderWidth: 1.5,
    borderColor: colors.borderMuted,
  },
  tick: {
    width: 3,
    height: 6,
    borderRadius: 2,
    backgroundColor: colors.borderMuted,
  },
  barTrail: {
    marginStart: "auto",
    fontSize: 11,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  legendDot: {
    transform: [{ scale: 0.8 }],
    marginStart: 6,
  },
  legendText: {
    fontSize: 11.5,
    fontFamily: "PlusJakartaSans_500Medium",
    color: colors.textSecondary,
  },
  legendHint: {
    marginStart: "auto",
    color: colors.textMuted,
  },
  // Breathing room under a sheet's last block.
  sheetFoot: {
    height: 12,
  },
  // ── Cue rows ──
  cue: {
    paddingVertical: 4,
  },
  cueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 46,
  },
  // A cue's settings, indented to its word (dot 10 + gap 10).
  cueBody: {
    paddingStart: 20,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  cueRowRule: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  cueToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: 84,
    paddingVertical: 8,
  },
  inkDot: {
    width: 10,
    height: 10,
    borderRadius: radii.round,
    borderWidth: 1.5,
    borderColor: colors.textStrong,
  },
  inkDotOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  cueWord: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textSecondary,
  },
  cueWordOn: {
    color: colors.textPrimary,
  },
  cueSlider: {
    flex: 1,
  },
  cueHint: {
    flex: 1,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.7,
  },
  // Structural controls lock while a take rolls; the same quiet dim the disabled
  // chips already use, applied to a whole block.
  dimmed: {
    opacity: 0.45,
  },
});
