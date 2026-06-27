import React from "react";
import { colors } from "../../design/tokens";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  formatPitchShiftLabel,
  PITCH_SHIFT_MAX_SEMITONES,
  PITCH_SHIFT_MIN_SEMITONES,
} from "../../pitchShift";

const MIN_PLAYBACK_RATE = 0.5;
const MAX_PLAYBACK_RATE = 2.0;
const PLAYBACK_RATE_STEP = 0.1;

function formatPlaybackRate(value: number) {
  return `${value.toFixed(2)}x`;
}

type EditorTransformSectionProps = {
  playbackRate: number;
  pitchShiftSemitones: number;
  supportsPitchPreview: boolean;
  onAdjustPlaybackRate: (value: number) => void;
  onAdjustPitchShift: (value: number) => void;
  onResetTransforms: () => void;
};

export function EditorTransformSection({
  playbackRate,
  pitchShiftSemitones,
  supportsPitchPreview,
  onAdjustPlaybackRate,
  onAdjustPitchShift,
  onResetTransforms,
}: EditorTransformSectionProps) {
  const canDecreasePitch = supportsPitchPreview && pitchShiftSemitones > PITCH_SHIFT_MIN_SEMITONES;
  const canIncreasePitch = supportsPitchPreview && pitchShiftSemitones < PITCH_SHIFT_MAX_SEMITONES;
  const canDecreaseSpeed = playbackRate > MIN_PLAYBACK_RATE;
  const canIncreaseSpeed = playbackRate < MAX_PLAYBACK_RATE;
  const transformsActive = pitchShiftSemitones !== 0 || Math.abs(playbackRate - 1) > 0.001;

  return (
    <View style={editorTransformStyles.section}>
      <View style={editorTransformStyles.headerRow}>
        <View>
          <Text style={editorTransformStyles.label}>Speed &amp; pitch</Text>
          <Text style={editorTransformStyles.meta}>
            Audition the change, then save the result as a new clip.
          </Text>
        </View>
        <Pressable
          style={[
            editorTransformStyles.resetButton,
            !transformsActive ? editorTransformStyles.resetButtonDisabled : null,
          ]}
          onPress={onResetTransforms}
          disabled={!transformsActive}
        >
          <Text
            style={[
              editorTransformStyles.resetButtonText,
              !transformsActive ? editorTransformStyles.resetButtonTextDisabled : null,
            ]}
          >
            Reset
          </Text>
        </Pressable>
      </View>

      <View style={editorTransformStyles.row}>
        <Text style={editorTransformStyles.rowLabel}>Speed</Text>
        <View style={editorTransformStyles.controlGroup}>
          <Pressable
            style={[
              editorTransformStyles.stepButton,
              !canDecreaseSpeed ? editorTransformStyles.stepButtonDisabled : null,
            ]}
            onPress={() => canDecreaseSpeed && onAdjustPlaybackRate(playbackRate - PLAYBACK_RATE_STEP)}
            disabled={!canDecreaseSpeed}
          >
            <Ionicons name="remove" size={16} color={canDecreaseSpeed ? colors.textStrong : colors.textMuted} />
          </Pressable>
          <View style={editorTransformStyles.valuePill}>
            <Text style={editorTransformStyles.valueText}>{formatPlaybackRate(playbackRate)}</Text>
          </View>
          <Pressable
            style={[
              editorTransformStyles.stepButton,
              !canIncreaseSpeed ? editorTransformStyles.stepButtonDisabled : null,
            ]}
            onPress={() => canIncreaseSpeed && onAdjustPlaybackRate(playbackRate + PLAYBACK_RATE_STEP)}
            disabled={!canIncreaseSpeed}
          >
            <Ionicons name="add" size={16} color={canIncreaseSpeed ? colors.textStrong : colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <View style={editorTransformStyles.row}>
        <Text style={editorTransformStyles.rowLabel}>Pitch</Text>
        <View style={editorTransformStyles.controlGroup}>
          <Pressable
            style={[
              editorTransformStyles.stepButton,
              !canDecreasePitch ? editorTransformStyles.stepButtonDisabled : null,
            ]}
            onPress={() => canDecreasePitch && onAdjustPitchShift(pitchShiftSemitones - 1)}
            disabled={!canDecreasePitch}
          >
            <Ionicons name="remove" size={16} color={canDecreasePitch ? colors.textStrong : colors.textMuted} />
          </Pressable>
          <View style={[editorTransformStyles.valuePill, !supportsPitchPreview ? editorTransformStyles.valuePillDisabled : null]}>
            <Text style={editorTransformStyles.valueText}>
              {supportsPitchPreview ? `${pitchShiftSemitones > 0 ? "+" : ""}${pitchShiftSemitones} st` : "Unavailable"}
            </Text>
          </View>
          <Pressable
            style={[
              editorTransformStyles.stepButton,
              !canIncreasePitch ? editorTransformStyles.stepButtonDisabled : null,
            ]}
            onPress={() => canIncreasePitch && onAdjustPitchShift(pitchShiftSemitones + 1)}
            disabled={!canIncreasePitch}
          >
            <Ionicons name="add" size={16} color={canIncreasePitch ? colors.textStrong : colors.textMuted} />
          </Pressable>
          <Text style={editorTransformStyles.summaryText}>
            {supportsPitchPreview ? formatPitchShiftLabel(pitchShiftSemitones) : "Pitch preview unavailable"}
          </Text>
        </View>
      </View>
    </View>
  );
}

const editorTransformStyles = StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
    maxWidth: 260,
  },
  resetButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainer,
  },
  resetButtonDisabled: {
    backgroundColor: colors.surfaceContainer,
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textStrong,
  },
  resetButtonTextDisabled: {
    color: colors.textMuted,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textStrong,
    paddingTop: 8,
    minWidth: 48,
  },
  controlGroup: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  stepButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  stepButtonDisabled: {
    backgroundColor: colors.surfaceContainer,
  },
  valuePill: {
    minWidth: 74,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  valuePillDisabled: {
    backgroundColor: colors.surface,
  },
  valueText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  summaryText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
