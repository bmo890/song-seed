import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, text } from "../../../design/tokens";
import { SpeedPitchDials } from "../../common/SpeedPitchDials";
import { useTranslation } from "react-i18next";

/** The editor bakes the change into a new clip, so it reaches further than the
 *  player's practice range: half speed to double. */
const EDITOR_SPEED_MIN = 0.5;
const EDITOR_SPEED_MAX = 2.0;
const EDITOR_SPEED_PRESETS = [0.5, 0.75, 1, 1.5, 2] as const;

type EditorTransformSectionProps = {
  playbackRate: number;
  pitchShiftSemitones: number;
  supportsPitchPreview: boolean;
  onAdjustPlaybackRate: (value: number) => void;
  onAdjustPitchShift: (value: number) => void;
};

/** Speed & pitch — the player's own dials (SpeedPitchDials), so bending a take reads
 *  the same in both rooms. Here the values are auditioned live and then baked into a
 *  new clip by the footer's save; each dial resets from its own label. */
export function EditorTransformSection({
  playbackRate,
  pitchShiftSemitones,
  supportsPitchPreview,
  onAdjustPlaybackRate,
  onAdjustPitchShift,
}: EditorTransformSectionProps) {
  const { t } = useTranslation();

  return (
    <View style={s.section}>
      <SpeedPitchDials
        playbackSpeed={playbackRate}
        speedPresets={EDITOR_SPEED_PRESETS}
        speedMin={EDITOR_SPEED_MIN}
        speedMax={EDITOR_SPEED_MAX}
        onSpeedTap={onAdjustPlaybackRate}
        onSpeedSliding={onAdjustPlaybackRate}
        onSpeedSlideEnd={onAdjustPlaybackRate}
        pitchShiftSemitones={pitchShiftSemitones}
        supportsPitchShift={supportsPitchPreview}
        onAdjustPitchShift={onAdjustPitchShift}
      />
      <Text style={s.note}>
        {supportsPitchPreview ? t("editor.transformHint") : t("editor.pitchUnavailable")}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    gap: spacing.md,
  },
  note: {
    ...text.supporting,
    fontSize: 12,
    color: colors.textMuted,
    paddingHorizontal: 10,
  },
});
