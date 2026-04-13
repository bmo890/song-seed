import React from "react";
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
          <Text style={editorTransformStyles.label}>Preview Transforms</Text>
          <Text style={editorTransformStyles.meta}>
            Audition speed now. Pitch preview uses native playback; saving transformed audio comes later.
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
            <Ionicons name="remove" size={16} color={canDecreaseSpeed ? "#374151" : "#94a3b8"} />
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
            <Ionicons name="add" size={16} color={canIncreaseSpeed ? "#374151" : "#94a3b8"} />
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
            <Ionicons name="remove" size={16} color={canDecreasePitch ? "#374151" : "#94a3b8"} />
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
            <Ionicons name="add" size={16} color={canIncreasePitch ? "#374151" : "#94a3b8"} />
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
    color: "#0f172a",
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: "#64748b",
    maxWidth: 260,
  },
  resetButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
  },
  resetButtonDisabled: {
    backgroundColor: "#f1f5f9",
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  resetButtonTextDisabled: {
    color: "#94a3b8",
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
    color: "#334155",
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
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  stepButtonDisabled: {
    backgroundColor: "#f1f5f9",
  },
  valuePill: {
    minWidth: 74,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f8fafc",
    alignItems: "center",
  },
  valuePillDisabled: {
    backgroundColor: "#f8fafc",
  },
  valueText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  summaryText: {
    fontSize: 12,
    color: "#64748b",
  },
});
