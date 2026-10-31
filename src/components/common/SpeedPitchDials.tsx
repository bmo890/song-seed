import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { PITCH_SHIFT_MAX_SEMITONES, PITCH_SHIFT_MIN_SEMITONES } from "../../domain/pitchShift";
import { colors, text } from "../../design/tokens";
import { Press } from "./Press";
import { SegmentedControl } from "./SegmentedControl";
import { Slider } from "./Slider";
import { Stepper } from "./Stepper";
import { signedNumberText } from "../../i18n/direction";
import { bpmAtRate, bpmRange, rateAtBpm, type SpeedUnit } from "../../domain/tempoSpeed";

type SpeedPitchDialsProps = {
  playbackSpeed: number;
  speedPresets: readonly number[];
  speedMin: number;
  speedMax: number;
  /** A preset tap or a per-dial reset — a committed value. */
  onSpeedTap: (value: number) => void;
  onSpeedSlideStart?: (value: number) => void;
  onSpeedSliding?: (value: number) => void;
  onSpeedSlideEnd: (value: number) => void;
  pitchShiftSemitones: number;
  supportsPitchShift: boolean;
  onAdjustPitchShift: (value: number) => void;
  /** The take's own tempo (domain/tempoSpeed.ts). With it, and a unit to
   *  report to, the speed dial can be read and set in BPM. */
  tempoBpm?: number | null;
  speedUnit?: SpeedUnit;
  onChangeSpeedUnit?: (unit: SpeedUnit) => void;
  testID?: string;
};

/**
 * THE speed and pitch dials — one component for the player's Sound drawer and the
 * clip editor's Speed & pitch tab, so bending a take reads the same in both rooms.
 * Each dial carries its own reset, which only appears once there is something to
 * undo; the value goes terracotta when bent so a glance says "played differently".
 *
 * Haptics are owned by the kit controls: the Slider (grab, tick per detent, light on
 * lift), the Stepper (tick per semitone), and Press (tap) on the resets and presets.
 * Nothing here fires its own.
 *
 * The caller owns the semantics: the player applies live practice values; the editor
 * bakes them into a new clip. This component only knows the numbers.
 *
 * On a take with a tempo the speed label becomes Speed · BPM ink tabs (founder,
 * 2026-10-31). In BPM the dial reads "80 bpm" and moves one bpm per step, but it
 * still hands the caller a rate: BPM is how the number reads, never what is stored.
 */
export function SpeedPitchDials({
  playbackSpeed,
  speedPresets,
  speedMin,
  speedMax,
  onSpeedTap,
  onSpeedSlideStart,
  onSpeedSliding,
  onSpeedSlideEnd,
  pitchShiftSemitones,
  supportsPitchShift,
  onAdjustPitchShift,
  tempoBpm,
  speedUnit = "rate",
  onChangeSpeedUnit,
  testID,
}: SpeedPitchDialsProps) {
  const { t } = useTranslation();
  const canCountBpm = tempoBpm != null && !!onChangeSpeedUnit;
  const baseBpm = canCountBpm && speedUnit === "bpm" ? tempoBpm : null;
  const heardBpm = baseBpm != null ? bpmAtRate(baseBpm, playbackSpeed) : null;
  const { minBpm, maxBpm } = baseBpm != null ? bpmRange(baseBpm, speedMin, speedMax) : { minBpm: 0, maxBpm: 0 };
  // The slider speaks the dial's unit; the caller always hears a rate.
  const toRate = (value: number) => (baseBpm != null ? rateAtBpm(baseBpm, Math.round(value)) : value);
  const speedIsPreset = (preset: number) =>
    baseBpm != null ? heardBpm === bpmAtRate(baseBpm, preset) : Math.abs(playbackSpeed - preset) < 0.01;
  // "Bent away from original" — drives both the reset affordance and the value's
  // colour, so the two can never disagree about whether anything changed.
  const speedIsChanged =
    baseBpm != null ? heardBpm !== bpmAtRate(baseBpm, 1) : Math.abs(playbackSpeed - 1) > 0.01;
  const pitchIsChanged = supportsPitchShift && pitchShiftSemitones !== 0;
  const canDecreasePitch = supportsPitchShift && pitchShiftSemitones > PITCH_SHIFT_MIN_SEMITONES;
  const canIncreasePitch = supportsPitchShift && pitchShiftSemitones < PITCH_SHIFT_MAX_SEMITONES;

  return (
    <View style={d.wrap} testID={testID}>
      {/* Each dial resets from its own label — the reset lives with the thing it
          resets, and only appears once there is something to undo. */}
      <View style={[d.dialHead, canCountBpm ? d.dialHeadTabs : null]}>
        <View style={d.dialLabelGroup}>
          {canCountBpm ? (
            <View style={d.unitTabs}>
              <SegmentedControl<SpeedUnit>
                options={[
                  { key: "rate", label: t("player.speed") },
                  { key: "bpm", label: t("player.speedUnitBpm") },
                ]}
                value={speedUnit}
                onChange={onChangeSpeedUnit}
              />
            </View>
          ) : (
            <Text style={d.rowLabel}>{t("player.speed")}</Text>
          )}
          {speedIsChanged ? (
            <Press
              feel="glyph"
              style={d.dialResetBtn}
              onPress={() => onSpeedTap(1)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("player.resetSpeed")}
            >
              <Ionicons name="refresh" size={14} color={colors.primaryDeep} />
            </Press>
          ) : null}
        </View>
        <Text style={[d.dialValue, speedIsChanged ? d.dialValueChanged : null]}>
          {heardBpm != null
            ? t("player.bpmValue", { bpm: heardBpm })
            : `${Math.round(playbackSpeed * 100) / 100}×`}
        </Text>
      </View>
      {/* Ticks every tenth: a drag from 0.5× to 1.5× is ten felt stops, a dial.
          In BPM it steps one bpm and ticks every five. */}
      <Slider
        style={d.soundSlider}
        minimumValue={baseBpm != null ? minBpm : speedMin}
        maximumValue={baseBpm != null ? maxBpm : speedMax}
        step={baseBpm != null ? 1 : 0.05}
        detent={baseBpm != null ? 5 : 0.1}
        value={heardBpm ?? playbackSpeed}
        onValueChange={onSpeedSliding ? (value) => onSpeedSliding(toRate(value)) : undefined}
        onSlidingStart={() => onSpeedSlideStart?.(playbackSpeed)}
        onSlidingComplete={(value) => onSpeedSlideEnd(toRate(value))}
        accessibilityLabel={baseBpm != null ? t("player.speedUnitBpm") : t("player.speed")}
      />
      <View style={d.tickLabelRow}>
        {speedPresets.map((preset) => (
          <Press
            key={preset}
            feel="glyph"
            onPress={() => onSpeedTap(preset)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={baseBpm != null ? t("player.bpmValue", { bpm: bpmAtRate(baseBpm, preset) }) : `${preset}×`}
          >
            <Text style={[d.tickLabel, speedIsPreset(preset) ? d.tickLabelOn : null]}>
              {baseBpm != null ? `${bpmAtRate(baseBpm, preset)}` : `${preset}`}
            </Text>
          </Press>
        ))}
      </View>

      {/* Pitch is one row (2026-10-15): label, then − value + at the end. The
          semitone ruler is gone; the value says where it sits. */}
      {/* Speed and pitch are values, like volume: in Hebrew the whole block reads
          from the right (slow and − on the right), as Apple Music's volume does. */}
      <View style={d.pitchRow}>
        <View style={d.dialLabelGroup}>
          <Text style={d.rowLabel}>{t("player.pitch")}</Text>
          {pitchIsChanged ? (
            <Press
              feel="glyph"
              style={d.dialResetBtn}
              onPress={() => onAdjustPitchShift(0)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("player.resetPitch")}
            >
              <Ionicons name="refresh" size={14} color={colors.primaryDeep} />
            </Press>
          ) : null}
        </View>
        <View style={d.pitchSpacer} />
        <Stepper
          glyphs="plusMinus"
          onStep={(direction) => onAdjustPitchShift(pitchShiftSemitones + direction)}
          canDecrement={canDecreasePitch}
          canIncrement={canIncreasePitch}
          decrementLabel={t("player.lowerPitch")}
          incrementLabel={t("player.raisePitch")}
        >
          <Text style={[d.dialValue, d.pitchValue, pitchIsChanged ? d.dialValueChanged : null]}>
            {supportsPitchShift
              ? `${signedNumberText(`${pitchShiftSemitones > 0 ? "+" : ""}${pitchShiftSemitones}`)} ${t("player.semitones")}`
              : "—"}
          </Text>
        </Stepper>
      </View>
    </View>
  );
}

const d = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  dialHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingTop: 4,
  },
  // With the Speed · BPM tabs in the label's place, the row centres on the tabs.
  dialHeadTabs: {
    alignItems: "center",
    paddingTop: 0,
  },
  // Two short words: the tabs take their own width, not the drawer's.
  unitTabs: {
    width: 128,
  },
  // Label + reset travel together as one group. The group (not the button) is the
  // baseline participant of `dialHead`, so the label still shares the big value's
  // baseline while the button centers against the LABEL rather than against the
  // 26px number's much taller line box — which is what floated it high.
  dialLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowLabel: {
    ...text.body,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textPrimary,
  },
  dialResetBtn: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  // A measured value, not a name: tabular Jakarta (2026-10-15; it was the serif).
  dialValue: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 15,
    color: colors.textStrong,
    fontVariant: ["tabular-nums"],
  },
  // Off-neutral: the number itself carries the action colour, so a glance at the
  // drawer says "this take is being played differently" without reading a value.
  dialValueChanged: {
    color: colors.primaryDeep,
  },
  dialUnit: {
    ...text.caption,
  },
  dialUnitChanged: {
    color: colors.primaryDeep,
  },
  soundSlider: {
    height: 34,
    marginHorizontal: 10,
  },
  tickLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    marginTop: -2,
  },
  tickLabel: {
    ...text.supporting,
    fontSize: 10.5,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  tickLabelOn: {
    ...text.sectionTitle,
    fontSize: 10.5,
    letterSpacing: 0,
    textTransform: "none",
    color: colors.primaryDeep,
  },
  pitchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    minHeight: 46,
  },
  pitchSpacer: {
    flex: 1,
  },
  pitchValue: {
    minWidth: 52,
    textAlign: "center",
  },
});
