import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  formatPitchShiftLabel,
  PITCH_SHIFT_MAX_SEMITONES,
  PITCH_SHIFT_MIN_SEMITONES,
} from "../../../pitchShift";
import { playerScreenStyles } from "../styles";

type CountInOption = "off" | "1b" | "2b";

type PlayerPracticePanelProps = {
  practiceLoopEnabled: boolean;
  practiceRangeLabel: string;
  countInOption: CountInOption;
  clipNotes: string;
  pitchShiftSemitones: number;
  supportsPitchShift: boolean;
  onSeekLoopStart: () => void;
  onMoveLoopToPlayhead: () => void;
  onResetLoopRange: () => void;
  onTogglePracticeLoop: () => void;
  onSelectCountIn: (option: CountInOption) => void;
  onAdjustPitchShift: (value: number) => void;
  onPressNotes: () => void;
};

export function PlayerPracticePanel({
  practiceLoopEnabled,
  practiceRangeLabel,
  countInOption,
  clipNotes,
  pitchShiftSemitones,
  supportsPitchShift,
  onSeekLoopStart,
  onMoveLoopToPlayhead,
  onResetLoopRange,
  onTogglePracticeLoop,
  onSelectCountIn,
  onAdjustPitchShift,
  onPressNotes,
}: PlayerPracticePanelProps) {
  const canDecreasePitch = supportsPitchShift && pitchShiftSemitones > PITCH_SHIFT_MIN_SEMITONES;
  const canIncreasePitch = supportsPitchShift && pitchShiftSemitones < PITCH_SHIFT_MAX_SEMITONES;
  const isPitchOriginal = pitchShiftSemitones === 0;

  return (
    <View style={playerScreenStyles.practiceContent}>
      <View style={playerScreenStyles.practiceCard}>
        <View style={playerScreenStyles.practiceRow}>
          {!practiceLoopEnabled ? (
            <Text style={playerScreenStyles.practiceLabel}>Loop</Text>
          ) : null}
          <View style={playerScreenStyles.practiceValueRow}>
            {practiceLoopEnabled ? (
              <>
                <Pressable
                  style={({ pressed }) => [
                    playerScreenStyles.loopRangePill,
                    pressed ? playerScreenStyles.loopRangePillPressed : null,
                  ]}
                  onPress={onSeekLoopStart}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Jump playhead to loop start"
                >
                  <Ionicons name="play-skip-back" size={13} color="#4b5563" />
                  <Text style={playerScreenStyles.loopRangeText}>{practiceRangeLabel}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    playerScreenStyles.loopActionButton,
                    pressed ? { opacity: 0.7 } : null,
                  ]}
                  onPress={onMoveLoopToPlayhead}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Move loop to playhead"
                >
                  <Ionicons name="locate-outline" size={15} color="#4b5563" />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    playerScreenStyles.loopActionButton,
                    pressed ? { opacity: 0.7 } : null,
                  ]}
                  onPress={onResetLoopRange}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Create a new loop from the visible reel"
                >
                  <Ionicons name="add-circle-outline" size={15} color="#4b5563" />
                </Pressable>
              </>
            ) : null}
            <Pressable
              style={[
                playerScreenStyles.toggleShell,
                practiceLoopEnabled ? playerScreenStyles.toggleShellActive : null,
              ]}
              onPress={onTogglePracticeLoop}
            >
              <View
                style={[
                  playerScreenStyles.toggleKnob,
                  practiceLoopEnabled ? playerScreenStyles.toggleKnobActive : null,
                ]}
              />
            </Pressable>
          </View>
        </View>

        <View style={playerScreenStyles.divider} />

        <View style={playerScreenStyles.practiceRow}>
          <Text style={playerScreenStyles.practiceLabel}>Pitch</Text>
          <View style={playerScreenStyles.practicePitchGroup}>
            <Pressable
              style={[
                playerScreenStyles.pitchStepButton,
                !canDecreasePitch ? playerScreenStyles.pitchStepButtonDisabled : null,
              ]}
              onPress={() => {
                if (!canDecreasePitch) return;
                onAdjustPitchShift(pitchShiftSemitones - 1);
              }}
              disabled={!canDecreasePitch}
              accessibilityRole="button"
              accessibilityLabel="Lower pitch by one semitone"
            >
              <Ionicons
                name="remove"
                size={16}
                color={canDecreasePitch ? "#374151" : "#94a3b8"}
              />
            </Pressable>
            <View
              style={[
                playerScreenStyles.pitchValueShell,
                !supportsPitchShift ? playerScreenStyles.optionChipDisabled : null,
              ]}
            >
              <Text style={playerScreenStyles.pitchValueText}>
                {pitchShiftSemitones > 0 ? "+" : ""}
                {pitchShiftSemitones}
              </Text>
              <Text style={playerScreenStyles.pitchValueMeta}>st</Text>
            </View>
            <Pressable
              style={[
                playerScreenStyles.pitchStepButton,
                !canIncreasePitch ? playerScreenStyles.pitchStepButtonDisabled : null,
              ]}
              onPress={() => {
                if (!canIncreasePitch) return;
                onAdjustPitchShift(pitchShiftSemitones + 1);
              }}
              disabled={!canIncreasePitch}
              accessibilityRole="button"
              accessibilityLabel="Raise pitch by one semitone"
            >
              <Ionicons
                name="add"
                size={16}
                color={canIncreasePitch ? "#374151" : "#94a3b8"}
              />
            </Pressable>
            <Pressable
              style={[
                playerScreenStyles.optionChip,
                isPitchOriginal ? playerScreenStyles.optionChipActive : null,
                !supportsPitchShift ? playerScreenStyles.optionChipDisabled : null,
              ]}
              onPress={() => {
                if (!supportsPitchShift) return;
                onAdjustPitchShift(0);
              }}
              disabled={!supportsPitchShift}
              accessibilityRole="button"
              accessibilityLabel="Reset pitch shift to original"
            >
              <Text
                style={[
                  playerScreenStyles.optionChipText,
                  isPitchOriginal ? playerScreenStyles.optionChipTextActive : null,
                  !supportsPitchShift ? playerScreenStyles.optionChipTextDisabled : null,
                ]}
              >
                Original
              </Text>
            </Pressable>
            <Text style={playerScreenStyles.pitchSummaryText}>
              {supportsPitchShift ? formatPitchShiftLabel(pitchShiftSemitones) : "Unavailable"}
            </Text>
          </View>
        </View>

        <View style={playerScreenStyles.divider} />

        <View style={playerScreenStyles.practiceRow}>
          <Text style={playerScreenStyles.practiceLabel}>Count-in</Text>
          <View style={playerScreenStyles.optionGroup}>
            {([
              { key: "off" as const, label: "Off" },
              { key: "1b" as const, label: "1b" },
              { key: "2b" as const, label: "2b" },
            ] as const).map((option) => {
              const active = countInOption === option.key;
              return (
                <Pressable
                  key={option.key}
                  style={[
                    playerScreenStyles.optionChip,
                    active ? playerScreenStyles.optionChipActive : null,
                  ]}
                  onPress={() => onSelectCountIn(option.key)}
                >
                  <Text
                    style={[
                      playerScreenStyles.optionChipText,
                      active ? playerScreenStyles.optionChipTextActive : null,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={playerScreenStyles.divider} />

        <Pressable style={playerScreenStyles.practiceRow} onPress={onPressNotes}>
          <Text style={playerScreenStyles.practiceLabel}>Notes</Text>
          <Text style={playerScreenStyles.notesInlineText} numberOfLines={1}>
            {clipNotes.trim() || "Add notes..."}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
