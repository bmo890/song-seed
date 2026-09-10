import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { PITCH_SHIFT_MAX_SEMITONES, PITCH_SHIFT_MIN_SEMITONES } from "../../domain/pitchShift";
import { colors, radii, text } from "../../design/tokens";
import { haptic } from "../../design/haptics";
import { styles } from "../../styles";
import { ltrRow } from "../../i18n/direction";

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
  testID?: string;
};

/**
 * THE speed and pitch dials — one component for the player's Sound drawer and the
 * clip editor's Speed & pitch tab, so bending a take reads the same in both rooms.
 * Each dial carries its own reset, which only appears once there is something to
 * undo; the value goes terracotta when bent so a glance says "played differently".
 *
 * Haptics (docs/design-system.md §4): slider release, preset tap and reset = `tap`
 * (acknowledged press / slider release); the pitch carets are step controls, so each
 * detent = `light`.
 *
 * The caller owns the semantics: the player applies live practice values; the editor
 * bakes them into a new clip. This component only knows the numbers.
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
  testID,
}: SpeedPitchDialsProps) {
  const { t } = useTranslation();
  const speedIsPreset = (preset: number) => Math.abs(playbackSpeed - preset) < 0.01;
  // "Bent away from original" — drives both the reset affordance and the value's
  // colour, so the two can never disagree about whether anything changed.
  const speedIsChanged = Math.abs(playbackSpeed - 1) > 0.01;
  const pitchIsChanged = supportsPitchShift && pitchShiftSemitones !== 0;
  const canDecreasePitch = supportsPitchShift && pitchShiftSemitones > PITCH_SHIFT_MIN_SEMITONES;
  const canIncreasePitch = supportsPitchShift && pitchShiftSemitones < PITCH_SHIFT_MAX_SEMITONES;

  return (
    <View style={d.wrap} testID={testID}>
      {/* Each dial resets from its own label — the reset lives with the thing it
          resets, and only appears once there is something to undo. */}
      <View style={d.dialHead}>
        <View style={d.dialLabelGroup}>
          <Text style={d.rowLabel}>{t("player.speed")}</Text>
          {speedIsChanged ? (
            <Pressable
              style={({ pressed }) => [d.dialResetBtn, pressed ? styles.pressDown : null]}
              onPress={() => {
                haptic.tap();
                onSpeedTap(1);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("player.resetSpeed")}
            >
              <Ionicons name="refresh" size={14} color={colors.primaryDeep} />
            </Pressable>
          ) : null}
        </View>
        <Text style={[d.dialValue, speedIsChanged ? d.dialValueChanged : null]}>
          {`${Math.round(playbackSpeed * 100) / 100}×`}
        </Text>
      </View>
      <Slider
        style={d.soundSlider}
        minimumValue={speedMin}
        maximumValue={speedMax}
        step={0.05}
        value={playbackSpeed}
        onValueChange={onSpeedSliding}
        onSlidingStart={onSpeedSlideStart}
        onSlidingComplete={(value) => {
          haptic.tap();
          onSpeedSlideEnd(value);
        }}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.surfaceHigh}
        thumbTintColor={colors.primary}
      />
      <View style={d.tickLabelRow}>
        {speedPresets.map((preset) => (
          <Pressable
            key={preset}
            onPress={() => {
              haptic.tap();
              onSpeedTap(preset);
            }}
            hitSlop={8}
            style={({ pressed }) => (pressed ? styles.pressDown : null)}
            accessibilityRole="button"
            accessibilityLabel={`${preset}×`}
          >
            <Text style={[d.tickLabel, speedIsPreset(preset) ? d.tickLabelOn : null]}>{`${preset}`}</Text>
          </Pressable>
        ))}
      </View>

      <View style={d.dialHead}>
        <View style={d.dialLabelGroup}>
          <Text style={d.rowLabel}>{t("player.pitch")}</Text>
          {pitchIsChanged ? (
            <Pressable
              style={({ pressed }) => [d.dialResetBtn, pressed ? styles.pressDown : null]}
              onPress={() => {
                haptic.tap();
                onAdjustPitchShift(0);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("player.resetPitch")}
            >
              <Ionicons name="refresh" size={14} color={colors.primaryDeep} />
            </Pressable>
          ) : null}
        </View>
        <Text style={[d.dialValue, pitchIsChanged ? d.dialValueChanged : null]}>
          {supportsPitchShift ? `${pitchShiftSemitones > 0 ? "+" : ""}${pitchShiftSemitones}` : "—"}
          {supportsPitchShift ? (
            <Text style={[d.dialUnit, pitchIsChanged ? d.dialUnitChanged : null]}>
              {" "}
              {t("player.semitones")}
            </Text>
          ) : null}
        </Text>
      </View>
      {/* The rail maps onto pitch, low to high, so it is pinned LTR like the tape. */}
      <View style={[d.pitchRow, ltrRow]}>
        <Pressable
          style={({ pressed }) => [
            d.nudgeBtn,
            !canDecreasePitch ? styles.btnDisabled : null,
            pressed && canDecreasePitch ? styles.pressDown : null,
          ]}
          onPress={() => {
            if (!canDecreasePitch) return;
            haptic.light();
            onAdjustPitchShift(pitchShiftSemitones - 1);
          }}
          disabled={!canDecreasePitch}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canDecreasePitch }}
          accessibilityLabel={t("player.lowerPitch")}
        >
          <Ionicons name="remove" size={16} color={canDecreasePitch ? colors.textStrong : colors.textMuted} />
        </Pressable>
        <View style={d.pitchRail}>
          {Array.from({ length: PITCH_SHIFT_MAX_SEMITONES - PITCH_SHIFT_MIN_SEMITONES + 1 }, (_, i) => {
            const semitone = PITCH_SHIFT_MIN_SEMITONES + i;
            const isCurrent = supportsPitchShift && semitone === pitchShiftSemitones;
            return (
              <View
                key={semitone}
                style={[
                  d.pitchTick,
                  semitone === 0 ? d.pitchTickZero : null,
                  isCurrent ? d.pitchTickOn : null,
                ]}
              />
            );
          })}
        </View>
        <Pressable
          style={({ pressed }) => [
            d.nudgeBtn,
            !canIncreasePitch ? styles.btnDisabled : null,
            pressed && canIncreasePitch ? styles.pressDown : null,
          ]}
          onPress={() => {
            if (!canIncreasePitch) return;
            haptic.light();
            onAdjustPitchShift(pitchShiftSemitones + 1);
          }}
          disabled={!canIncreasePitch}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canIncreasePitch }}
          accessibilityLabel={t("player.raisePitch")}
        >
          <Ionicons name="add" size={16} color={canIncreasePitch ? colors.textStrong : colors.textMuted} />
        </Pressable>
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
    ...text.caption,
    fontSize: 14,
    color: colors.textPrimary,
  },
  dialResetBtn: {
    width: 26,
    height: 26,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  // The value is the one thing on the dial the musician made — it earns the serif.
  dialValue: {
    ...text.headerTitle,
    fontSize: 26,
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
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
  },
  nudgeBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  pitchRail: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 22,
  },
  pitchTick: {
    width: 1,
    height: 7,
    backgroundColor: colors.borderMuted,
  },
  pitchTickZero: {
    height: 12,
    backgroundColor: colors.textMuted,
  },
  pitchTickOn: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
});
