import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { PracticeMarker } from "../../../types";
import { playerScreenStyles } from "../styles";

type CountInOption = "off" | "1b" | "2b";

type PlayerPracticePanelProps = {
  practiceLoopEnabled: boolean;
  practiceRangeLabel: string;
  countInOption: CountInOption;
  clipNotes: string;
  onSeekLoopStart: () => void;
  onMoveLoopToPlayhead: () => void;
  onResetLoopRange: () => void;
  onTogglePracticeLoop: () => void;
  onSelectCountIn: (option: CountInOption) => void;
  onPressNotes: () => void;
};

export function PlayerPracticePanel({
  practiceLoopEnabled,
  practiceRangeLabel,
  countInOption,
  clipNotes,
  onSeekLoopStart,
  onMoveLoopToPlayhead,
  onResetLoopRange,
  onTogglePracticeLoop,
  onSelectCountIn,
  onPressNotes,
}: PlayerPracticePanelProps) {
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
