import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import {
  formatPitchShiftLabel,
  PITCH_SHIFT_MAX_SEMITONES,
  PITCH_SHIFT_MIN_SEMITONES,
} from "../../../pitchShift";
import { fmtDuration } from "../../../utils";
import { colors } from "../../../design/tokens";
import { playerScreenStyles as s } from "../styles";
import type { CountInOption, PracticeTool } from "../hooks/usePlayerScreenUi";
import type { PracticeMarker } from "../../../types";

type PlayerPracticePanelProps = {
  expandedTool: PracticeTool | null;
  onToggleTool: (tool: PracticeTool) => void;
  onClose: () => void;

  // Loop
  practiceLoopEnabled: boolean;
  practiceRangeLabel: string;
  onSeekLoopStart: () => void;
  onMoveLoopToPlayhead: () => void;
  onResetLoopRange: () => void;
  onTogglePracticeLoop: () => void;

  // Pins
  practiceMarkers: PracticeMarker[];
  playheadMs: number;
  onAddPin: () => void;
  onSeekPin: (atMs: number) => void;
  onPinActions: (marker: PracticeMarker) => void;

  // Speed
  playbackSpeed: number;
  speedPresets: readonly number[];
  speedMin: number;
  speedMax: number;
  onSpeedTap: (value: number) => void;
  onSpeedSlideStart: (value: number) => void;
  onSpeedSliding: (value: number) => void;
  onSpeedSlideEnd: (value: number) => void;

  // Pitch
  pitchShiftSemitones: number;
  supportsPitchShift: boolean;
  onAdjustPitchShift: (value: number) => void;

  // Count-in
  countInOption: CountInOption;
  onSelectCountIn: (option: CountInOption) => void;
};

function Chip({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[s.toolChip, active ? s.toolChipActive : null, disabled ? s.toolChipDisabled : null]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[s.toolChipText, active ? s.toolChipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function AccordionRow({
  tool,
  icon,
  label,
  value,
  expanded,
  onToggle,
  children,
}: {
  tool: PracticeTool;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  expanded: boolean;
  onToggle: (tool: PracticeTool) => void;
  children: React.ReactNode;
}) {
  return (
    <View style={s.toolCard}>
      <Pressable
        style={({ pressed }) => [s.toolHeader, pressed ? s.toolHeaderPressed : null]}
        onPress={() => onToggle(tool)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${label}: ${value}`}
      >
        <View style={s.toolHeaderLeft}>
          <Ionicons name={icon} size={16} color={colors.textSecondary} />
          <Text style={s.toolLabel}>{label}</Text>
        </View>
        <View style={s.toolHeaderRight}>
          <Text style={s.toolValue} numberOfLines={1}>
            {value}
          </Text>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
        </View>
      </Pressable>
      {expanded ? <View style={s.toolBody}>{children}</View> : null}
    </View>
  );
}

const SETTING_META: Record<"speed" | "pitch" | "countin", { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  speed: { icon: "speedometer-outline", label: "Speed" },
  pitch: { icon: "musical-notes-outline", label: "Pitch" },
  countin: { icon: "timer-outline", label: "Count-in" },
};

export function PlayerPracticePanel({
  expandedTool,
  onToggleTool,
  onClose,
  practiceLoopEnabled,
  practiceRangeLabel,
  onSeekLoopStart,
  onMoveLoopToPlayhead,
  onResetLoopRange,
  onTogglePracticeLoop,
  practiceMarkers,
  playheadMs,
  onAddPin,
  onSeekPin,
  onPinActions,
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
  countInOption,
  onSelectCountIn,
}: PlayerPracticePanelProps) {
  const [settingsRowHeight, setSettingsRowHeight] = useState(64);

  const canDecreasePitch = supportsPitchShift && pitchShiftSemitones > PITCH_SHIFT_MIN_SEMITONES;
  const canIncreasePitch = supportsPitchShift && pitchShiftSemitones < PITCH_SHIFT_MAX_SEMITONES;
  const isPitchOriginal = pitchShiftSemitones === 0;
  const sortedMarkers = [...practiceMarkers].sort((a, b) => a.atMs - b.atMs);

  const pinsValue = sortedMarkers.length === 0 ? "None" : `${sortedMarkers.length} pin${sortedMarkers.length === 1 ? "" : "s"}`;
  const loopValue = practiceLoopEnabled ? practiceRangeLabel : "Off";
  const speedValue = `${playbackSpeed}×`;
  const pitchValue = !supportsPitchShift
    ? "—"
    : `${pitchShiftSemitones > 0 ? "+" : ""}${pitchShiftSemitones}`;
  const countInValue = countInOption === "off" ? "Off" : countInOption === "1b" ? "1 bar" : "2 bars";

  const settingValues = { speed: speedValue, pitch: pitchValue, countin: countInValue };
  const settingOrder: ("speed" | "pitch" | "countin")[] = ["speed", "pitch", "countin"];
  const popoverTool = expandedTool && expandedTool !== "pins" && expandedTool !== "loop" ? expandedTool : null;

  const renderSettingControls = () => {
    if (popoverTool === "speed") {
      return (
        <>
          <View style={s.toolChipRow}>
            {speedPresets.map((preset) => (
              <Chip
                key={preset}
                label={`${preset}×`}
                active={Math.abs(playbackSpeed - preset) < 0.01}
                onPress={() => onSpeedTap(preset)}
              />
            ))}
          </View>
          <Slider
            style={s.toolSlider}
            minimumValue={speedMin}
            maximumValue={speedMax}
            step={0.05}
            value={playbackSpeed}
            onValueChange={onSpeedSliding}
            onSlidingStart={onSpeedSlideStart}
            onSlidingComplete={onSpeedSlideEnd}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.surfaceHigh}
            thumbTintColor={colors.primary}
          />
        </>
      );
    }
    if (popoverTool === "pitch") {
      return (
        <View style={s.pitchRow}>
          <Pressable
            style={[s.stepButton, !canDecreasePitch ? s.stepButtonDisabled : null]}
            onPress={() => canDecreasePitch && onAdjustPitchShift(pitchShiftSemitones - 1)}
            disabled={!canDecreasePitch}
            accessibilityRole="button"
            accessibilityLabel="Lower pitch by one semitone"
          >
            <Ionicons name="remove" size={18} color={canDecreasePitch ? colors.textStrong : colors.textMuted} />
          </Pressable>
          <View style={s.toolPitchShell}>
            <Text style={s.toolPitchValue}>
              {pitchShiftSemitones > 0 ? "+" : ""}
              {pitchShiftSemitones}
            </Text>
            <Text style={s.toolPitchUnit}>st</Text>
          </View>
          <Pressable
            style={[s.stepButton, !canIncreasePitch ? s.stepButtonDisabled : null]}
            onPress={() => canIncreasePitch && onAdjustPitchShift(pitchShiftSemitones + 1)}
            disabled={!canIncreasePitch}
            accessibilityRole="button"
            accessibilityLabel="Raise pitch by one semitone"
          >
            <Ionicons name="add" size={18} color={canIncreasePitch ? colors.textStrong : colors.textMuted} />
          </Pressable>
          <View style={s.pitchSpacer} />
          <Chip
            label={supportsPitchShift ? "Original" : "Unavailable"}
            active={isPitchOriginal && supportsPitchShift}
            disabled={!supportsPitchShift}
            onPress={() => supportsPitchShift && onAdjustPitchShift(0)}
          />
        </View>
      );
    }
    return (
      <View style={s.toolChipRow}>
        {([
          { key: "off" as const, label: "Off" },
          { key: "1b" as const, label: "1 bar" },
          { key: "2b" as const, label: "2 bars" },
        ]).map((option) => (
          <Chip
            key={option.key}
            label={option.label}
            active={countInOption === option.key}
            onPress={() => onSelectCountIn(option.key)}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={s.toolList}>
      <AccordionRow
        tool="pins"
        icon="location-outline"
        label="Pins"
        value={pinsValue}
        expanded={expandedTool === "pins"}
        onToggle={onToggleTool}
      >
        <Pressable style={s.pinAddButton} onPress={onAddPin} accessibilityRole="button">
          <Ionicons name="add" size={16} color={colors.primary} />
          <Text style={s.pinAddText}>Add pin at {fmtDuration(playheadMs)}</Text>
        </Pressable>
        {sortedMarkers.length === 0 ? (
          <Text style={s.pinEmptyText}>No pins yet — drop one at the playhead.</Text>
        ) : (
          sortedMarkers.map((marker, index) => (
            <View key={marker.id} style={[s.pinRow, index > 0 ? s.pinRowDivider : null]}>
              <Pressable
                style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 }}
                onPress={() => onSeekPin(marker.atMs)}
                accessibilityRole="button"
                accessibilityLabel={`Jump to ${marker.label || "pin"} at ${fmtDuration(marker.atMs)}`}
              >
                <View style={s.pinDot} />
                <Text style={s.pinLabel} numberOfLines={1}>
                  {marker.label || "Pin"}
                </Text>
                <Text style={s.pinTime}>{fmtDuration(marker.atMs)}</Text>
              </Pressable>
              <Pressable
                onPress={() => onPinActions(marker)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Pin options"
              >
                <Ionicons name="ellipsis-horizontal" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          ))
        )}
      </AccordionRow>

      <AccordionRow
        tool="loop"
        icon="repeat"
        label="Loop"
        value={loopValue}
        expanded={expandedTool === "loop"}
        onToggle={onToggleTool}
      >
        <View style={s.toolBodyRow}>
          <Text style={s.toolBodyLabel}>Loop the visible region</Text>
          <Pressable
            style={[s.switchShell, practiceLoopEnabled ? s.switchShellActive : null]}
            onPress={onTogglePracticeLoop}
            accessibilityRole="switch"
            accessibilityState={{ checked: practiceLoopEnabled }}
          >
            <View style={[s.switchKnob, practiceLoopEnabled ? s.switchKnobActive : null]} />
          </Pressable>
        </View>
        {practiceLoopEnabled ? (
          <View style={s.loopControlsRow}>
            <Pressable
              style={({ pressed }) => [s.toolLoopPill, pressed ? s.toolHeaderPressed : null]}
              onPress={onSeekLoopStart}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Jump playhead to loop start"
            >
              <Ionicons name="play-skip-back" size={13} color={colors.textStrong} />
              <Text style={s.toolLoopText}>{practiceRangeLabel}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [s.loopIconButton, pressed ? { opacity: 0.7 } : null]}
              onPress={onMoveLoopToPlayhead}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Move loop to playhead"
            >
              <Ionicons name="locate-outline" size={16} color={colors.textStrong} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [s.loopIconButton, pressed ? { opacity: 0.7 } : null]}
              onPress={onResetLoopRange}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Reset loop to the visible reel"
            >
              <Ionicons name="add-circle-outline" size={16} color={colors.textStrong} />
            </Pressable>
          </View>
        ) : null}
      </AccordionRow>

      <View style={s.settingsWrap}>
        {popoverTool ? <Pressable style={s.popoverBackdrop} onPress={onClose} /> : null}
        <View
          style={s.settingsRow}
          onLayout={(e) => setSettingsRowHeight(e.nativeEvent.layout.height)}
        >
          {settingOrder.map((tool) => {
            const meta = SETTING_META[tool];
            const active = expandedTool === tool;
            return (
              <Pressable
                key={tool}
                style={[s.settingChip, active ? s.settingChipActive : null]}
                onPress={() => onToggleTool(tool)}
                accessibilityRole="button"
                accessibilityState={{ expanded: active }}
                accessibilityLabel={`${meta.label}: ${settingValues[tool]}`}
              >
                <Ionicons name={meta.icon} size={18} color={active ? colors.primary : colors.textSecondary} />
                <Text style={s.settingChipValue} numberOfLines={1}>
                  {settingValues[tool]}
                </Text>
                <Text style={s.settingChipLabel}>{meta.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {popoverTool ? (
          <View style={[s.settingPopover, { top: settingsRowHeight + 6 }]}>{renderSettingControls()}</View>
        ) : null}
      </View>
    </View>
  );
}
