import React, { useEffect, useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import {
  formatPitchShiftLabel,
  PITCH_SHIFT_MAX_SEMITONES,
  PITCH_SHIFT_MIN_SEMITONES,
} from "../../../pitchShift";
import { fmtDuration } from "../../../utils";
import { colors } from "../../../design/tokens";
import {
  getCustomSectionOptions,
  getSectionColor,
  getSectionPreset,
  MIN_SECTION_LENGTH_MS,
  SECTION_QUICK_ADD,
} from "../../../playerSections";
import type { SectionCustomInput } from "../hooks/usePlayerSections";
import { WarmModal } from "../../common/WarmModal";
import { HueSlider } from "../../common/HueSlider";
import { hexToHue, hueToAccentHex } from "../../../workspaceTheme";
import { formatBpmLabel, formatKeyLabel, hasAnalysisResult, isTempoSteady } from "../../../clipAnalysis";
import { playerScreenStyles as s } from "../styles";
import type { CountInOption, PracticeTool } from "../hooks/usePlayerScreenUi";
import type { ClipAnalysis, ClipSection, ClipSectionKind, PracticeMarker } from "../../../types";

type PlayerPracticePanelProps = {
  expandedTool: PracticeTool | null;
  onToggleTool: (tool: PracticeTool) => void;
  onClose: () => void;

  // Analysis (key + tempo)
  analysis: ClipAnalysis | null;
  isAnalyzing: boolean;
  analysisError: string | null;
  onDetectAnalysis: () => void;

  // Loop
  practiceLoopEnabled: boolean;
  practiceRangeLabel: string;
  onSeekLoopStart: () => void;
  onMoveLoopToPlayhead: () => void;
  onLoopSection: (section: ClipSection) => void;
  onTogglePracticeLoop: () => void;

  // Pins
  practiceMarkers: PracticeMarker[];
  playheadMs: number;
  onAddPin: () => void;
  onSeekPin: (atMs: number) => void;
  expandedPinId: string | null;
  pinsDurationMs: number;
  onTogglePinExpanded: (marker: PracticeMarker) => void;
  onRepositionPin: (markerId: string, atMs: number) => void;
  onPinPreview: (preview: { id: string; atMs: number } | null) => void;
  onEditPin: (markerId: string, edits: { label: string; note: string }) => void;
  onDeletePin: (markerId: string) => void;

  // Sections
  sections: ClipSection[];
  sectionsDurationMs: number;
  editingSectionId: string | null;
  onAddSection: (kind: ClipSectionKind, custom?: SectionCustomInput) => void;
  onSeekSection: (atMs: number) => void;
  onToggleSectionEdit: (section: ClipSection) => void;
  onEditSection: (sectionId: string, edits: { label: string; color: string }) => void;
  onRepositionSectionEdge: (sectionId: string, edge: "start" | "end", ms: number) => void;
  onSectionPreview: (preview: { id: string; startMs?: number; endMs?: number } | null) => void;
  onDeleteSection: (sectionId: string) => void;

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

  // Capture
  onRecordOverdub: () => void;
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
  valueOnLeft = false,
  headerAccessory,
  expanded,
  onToggle,
  children,
}: {
  tool: PracticeTool;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  /** Render the value inline next to the title instead of on the right. */
  valueOnLeft?: boolean;
  /** An extra control on the header's right (e.g. an add button). Stops the header toggle. */
  headerAccessory?: React.ReactNode;
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
          {valueOnLeft ? <Text style={s.toolValueInline}>{value}</Text> : null}
        </View>
        <View style={s.toolHeaderRight}>
          {!valueOnLeft ? (
            <Text style={s.toolValue} numberOfLines={1}>
              {value}
            </Text>
          ) : null}
          {headerAccessory}
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
        </View>
      </Pressable>
      {expanded ? <View style={s.toolBody}>{children}</View> : null}
    </View>
  );
}

/** Single-point timing adjuster for a pin — mirrors SectionEdgeAdjuster. */
function PinTimingAdjuster({
  marker,
  durationMs,
  playheadMs,
  onReposition,
  onPreview,
}: {
  marker: PracticeMarker;
  durationMs: number;
  playheadMs: number;
  onReposition: (markerId: string, atMs: number) => void;
  onPreview: (preview: { id: string; atMs: number } | null) => void;
}) {
  const [dragMs, setDragMs] = useState<number | null>(null);
  const current = marker.atMs;
  const maxMs = Math.max(1, durationMs);
  const displayMs = dragMs ?? current;
  const clamp = (ms: number) => Math.max(0, Math.min(maxMs, ms));
  const stepBy = (deltaMs: number) => onReposition(marker.id, clamp(current + deltaMs));
  return (
    <View style={s.sectionAdjuster}>
      <View style={s.sectionAdjusterHeader}>
        <Text style={s.sectionEdgeLabel}>Time</Text>
        <Text style={s.sectionEdgeLiveTime}>{fmtDuration(displayMs)}</Text>
        <View style={{ flex: 1 }} />
        <Pressable
          style={s.sectionPinCircle}
          onPress={() => onReposition(marker.id, Math.round(clamp(playheadMs)))}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Set pin to playhead (${fmtDuration(playheadMs)})`}
        >
          <PlayheadCursorIcon color={PLAYHEAD_COLOR} />
        </Pressable>
      </View>
      <View style={s.pinTrayRow}>
        <Pressable
          style={s.pinStepButton}
          onPress={() => stepBy(-1000)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Nudge pin back one second"
        >
          <Ionicons name="chevron-back" size={16} color={colors.textStrong} />
        </Pressable>
        <Slider
          style={s.pinSlider}
          minimumValue={0}
          maximumValue={maxMs}
          step={50}
          value={Math.max(0, Math.min(maxMs, current))}
          onValueChange={(value) => {
            const next = Math.round(value);
            setDragMs(next);
            onPreview({ id: marker.id, atMs: next });
          }}
          onSlidingComplete={(value) => {
            onReposition(marker.id, Math.round(value));
            onPreview(null);
            setDragMs(null);
          }}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.surfaceHigh}
          thumbTintColor={colors.primary}
        />
        <Pressable
          style={s.pinStepButton}
          onPress={() => stepBy(1000)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Nudge pin forward one second"
        >
          <Ionicons name="chevron-forward" size={16} color={colors.textStrong} />
        </Pressable>
      </View>
    </View>
  );
}

/** Name + note editor for a pin — mirrors SectionDetailModal (note instead of colour). */
function PinDetailModal({
  visible,
  initialName,
  initialNote,
  onConfirm,
  onDelete,
  onClose,
}: {
  visible: boolean;
  initialName: string;
  initialNote: string;
  onConfirm: (edits: { label: string; note: string }) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [note, setNote] = useState(initialNote);
  const prevVisible = React.useRef(false);
  useEffect(() => {
    if (visible && !prevVisible.current) {
      setName(initialName);
      setNote(initialNote);
    }
    prevVisible.current = visible;
  }, [visible, initialName, initialNote]);
  return (
    <WarmModal visible={visible} onRequestClose={onClose} title="Edit pin">
      <TextInput
        style={s.sectionEditInput}
        value={name}
        onChangeText={setName}
        placeholder="Pin name"
        placeholderTextColor={colors.textMuted}
        returnKeyType="done"
      />
      <TextInput
        style={[s.sectionEditInput, s.pinDetailNoteInput]}
        value={note}
        onChangeText={setNote}
        placeholder="Note (optional)"
        placeholderTextColor={colors.textMuted}
        multiline
      />
      <View style={s.sectionModalActions}>
        {onDelete ? (
          <Pressable
            style={s.sectionModalDelete}
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel="Delete pin"
          >
            <Ionicons name="trash-outline" size={17} color="#A8443A" />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }} />
        <Pressable style={s.sectionModalCancel} onPress={onClose} accessibilityRole="button">
          <Text style={s.sectionModalCancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={s.sectionModalConfirm}
          onPress={() => onConfirm({ label: name.trim(), note: note.trim() })}
          accessibilityRole="button"
        >
          <Text style={s.sectionModalConfirmText}>Save</Text>
        </Pressable>
      </View>
    </WarmModal>
  );
}

/** The reel's playhead colour — used to tint the I-beam "set to playhead" icon. */
const PLAYHEAD_COLOR = "#d95b56";

/** A Logic-style I-beam playhead cursor (vertical stem with top/bottom caps). */
function PlayheadCursorIcon({ color }: { color: string }) {
  return (
    <View style={s.ibeam}>
      <View style={[s.ibeamCap, { backgroundColor: color }]} />
      <View style={[s.ibeamStem, { backgroundColor: color }]} />
      <View style={[s.ibeamCap, { backgroundColor: color }]} />
    </View>
  );
}

/** Single adjuster for whichever edge (start/end) is active, with a pin-to-playhead button. */
function SectionEdgeAdjuster({
  section,
  edge,
  durationMs,
  playheadMs,
  onReposition,
  onPreview,
}: {
  section: ClipSection;
  edge: "start" | "end";
  durationMs: number;
  playheadMs: number;
  onReposition: (sectionId: string, edge: "start" | "end", ms: number) => void;
  onPreview: (preview: { id: string; startMs?: number; endMs?: number } | null) => void;
}) {
  const [dragMs, setDragMs] = useState<number | null>(null);
  const isStart = edge === "start";
  const current = isStart ? section.startMs : section.endMs;
  // Keep the handle on its own side of the section; the resolver pushes neighbours on commit.
  const minMs = isStart ? 0 : Math.min(section.startMs + MIN_SECTION_LENGTH_MS, Math.max(1, durationMs));
  const maxMs = isStart
    ? Math.max(0, section.endMs - MIN_SECTION_LENGTH_MS)
    : Math.max(1, durationMs);
  const clamp = (ms: number) => Math.max(minMs, Math.min(maxMs, ms));
  const stepBy = (deltaMs: number) => onReposition(section.id, edge, clamp(current + deltaMs));
  // Pinning the active edge to the playhead only makes sense when it stays on its own side of
  // the section (start before end, end after start). Crossing neighbours is fine — the resolver
  // pushes them — so only the self-crossing case is disabled.
  const canPin = isStart
    ? playheadMs <= section.endMs - MIN_SECTION_LENGTH_MS
    : playheadMs >= section.startMs + MIN_SECTION_LENGTH_MS;
  const displayMs = dragMs ?? current;
  return (
    <View style={s.sectionAdjuster}>
      <View style={s.sectionAdjusterHeader}>
        <Text style={s.sectionEdgeLabel}>{isStart ? "Start" : "End"}</Text>
        <Text style={s.sectionEdgeLiveTime}>{fmtDuration(displayMs)}</Text>
        <View style={{ flex: 1 }} />
        <Pressable
          style={[s.sectionPinCircle, !canPin ? s.sectionPinCircleDisabled : null]}
          onPress={() => canPin && onReposition(section.id, edge, Math.round(playheadMs))}
          disabled={!canPin}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Set ${edge} to playhead (${fmtDuration(playheadMs)})`}
        >
          <PlayheadCursorIcon color={canPin ? PLAYHEAD_COLOR : colors.textMuted} />
        </Pressable>
      </View>
      <View style={s.pinTrayRow}>
        <Pressable
          style={s.pinStepButton}
          onPress={() => stepBy(-1000)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Nudge ${edge} back one second`}
        >
          <Ionicons name="chevron-back" size={16} color={colors.textStrong} />
        </Pressable>
        <Slider
          style={s.pinSlider}
          minimumValue={minMs}
          maximumValue={maxMs}
          step={50}
          value={Math.max(minMs, Math.min(maxMs, current))}
          onValueChange={(value) => {
            const next = Math.round(value);
            setDragMs(next);
            onPreview({ id: section.id, [isStart ? "startMs" : "endMs"]: next });
          }}
          onSlidingComplete={(value) => {
            onReposition(section.id, edge, Math.round(value));
            onPreview(null);
            setDragMs(null);
          }}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.surfaceHigh}
          thumbTintColor={colors.primary}
        />
        <Pressable
          style={s.pinStepButton}
          onPress={() => stepBy(1000)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Nudge ${edge} forward one second`}
        >
          <Ionicons name="chevron-forward" size={16} color={colors.textStrong} />
        </Pressable>
      </View>
    </View>
  );
}

function SectionPickerModal({
  visible,
  title,
  customOptions,
  onPickPreset,
  onPickCustom,
  onCreateNew,
  onClose,
}: {
  visible: boolean;
  title: string;
  customOptions: { label: string; color: string }[];
  onPickPreset: (kind: ClipSectionKind) => void;
  onPickCustom: (custom: SectionCustomInput) => void;
  onCreateNew: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.sectionModalBackdrop} onPress={onClose}>
        <Pressable style={s.sectionModalCard} onPress={() => {}}>
          <Text style={s.sectionModalTitle}>{title}</Text>
          <View style={s.sectionModalGrid}>
            {SECTION_QUICK_ADD.map((kind) => {
              const preset = getSectionPreset(kind);
              return (
                <Pressable
                  key={kind}
                  style={s.sectionChip}
                  onPress={() => onPickPreset(kind)}
                  accessibilityRole="button"
                  accessibilityLabel={preset.label}
                >
                  <View style={[s.sectionSwatch, { backgroundColor: preset.color }]} />
                  <Text style={s.sectionChipText}>{preset.label}</Text>
                </Pressable>
              );
            })}
            {customOptions.map((option) => (
              <Pressable
                key={`custom-${option.label}`}
                style={s.sectionChip}
                onPress={() => onPickCustom(option)}
                accessibilityRole="button"
                accessibilityLabel={option.label}
              >
                <View style={[s.sectionSwatch, { backgroundColor: option.color }]} />
                <Text style={s.sectionChipText}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={s.sectionPickerFooter}>
            <Pressable
              style={s.sectionModalNewButton}
              onPress={onCreateNew}
              accessibilityRole="button"
              accessibilityLabel="Create a new custom section type"
            >
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={s.sectionModalNewText}>New custom…</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable style={s.sectionModalCancel} onPress={onClose} accessibilityRole="button">
              <Text style={s.sectionModalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Title + colour editor used both for "new custom section" and editing an existing one.
 *  Reuses the workspace HueSlider so the colour control matches the rest of the app. */
function SectionDetailModal({
  visible,
  title,
  confirmLabel,
  initialName,
  initialColor,
  onConfirm,
  onDelete,
  onClose,
}: {
  visible: boolean;
  title: string;
  confirmLabel: string;
  initialName: string;
  initialColor: string;
  onConfirm: (custom: SectionCustomInput) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [hue, setHue] = useState(() => hexToHue(initialColor));
  const prevVisible = React.useRef(false);
  useEffect(() => {
    if (visible && !prevVisible.current) {
      setName(initialName);
      setHue(hexToHue(initialColor));
    }
    prevVisible.current = visible;
  }, [visible, initialName, initialColor]);

  const accentColor = hueToAccentHex(hue);
  const trimmed = name.trim();
  return (
    <WarmModal visible={visible} onRequestClose={onClose} title={title}>
      <View style={s.sectionDetailPreviewRow}>
        <View style={[s.sectionDetailSwatch, { backgroundColor: accentColor }]} />
        <Text style={s.sectionDetailPreviewText} numberOfLines={1}>
          {trimmed || "Section name"}
        </Text>
      </View>
      <HueSlider hue={hue} onChange={setHue} />
      <TextInput
        style={s.sectionEditInput}
        value={name}
        onChangeText={setName}
        placeholder="Section name"
        placeholderTextColor={colors.textMuted}
        returnKeyType="done"
        onSubmitEditing={() => trimmed && onConfirm({ label: trimmed, color: accentColor })}
      />
      <View style={s.sectionModalActions}>
        {onDelete ? (
          <Pressable
            style={s.sectionModalDelete}
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel="Delete section"
          >
            <Ionicons name="trash-outline" size={17} color="#A8443A" />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }} />
        <Pressable style={s.sectionModalCancel} onPress={onClose} accessibilityRole="button">
          <Text style={s.sectionModalCancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[s.sectionModalConfirm, !trimmed ? s.sectionModalConfirmDisabled : null]}
          onPress={() => trimmed && onConfirm({ label: trimmed, color: accentColor })}
          disabled={!trimmed}
          accessibilityRole="button"
        >
          <Text style={s.sectionModalConfirmText}>{confirmLabel}</Text>
        </Pressable>
      </View>
    </WarmModal>
  );
}

/** Quick picker to drop the loop region onto an existing section. */
function LoopSectionPickerModal({
  visible,
  sections,
  onPick,
  onClose,
}: {
  visible: boolean;
  sections: ClipSection[];
  onPick: (section: ClipSection) => void;
  onClose: () => void;
}) {
  return (
    <WarmModal visible={visible} onRequestClose={onClose} title="Loop a section" scrollable>
      {sections.map((section) => (
        <Pressable
          key={section.id}
          style={s.loopSectionRow}
          onPress={() => onPick(section)}
          accessibilityRole="button"
          accessibilityLabel={`Loop ${section.label}`}
        >
          <View style={[s.sectionSwatch, { backgroundColor: getSectionColor(section) }]} />
          <Text style={s.loopSectionLabel} numberOfLines={1}>
            {section.label}
          </Text>
          <Text style={s.loopSectionTime}>
            {fmtDuration(section.startMs)}–{fmtDuration(section.endMs)}
          </Text>
        </Pressable>
      ))}
      <View style={s.sectionModalActions}>
        <View style={{ flex: 1 }} />
        <Pressable style={s.sectionModalCancel} onPress={onClose} accessibilityRole="button">
          <Text style={s.sectionModalCancelText}>Cancel</Text>
        </Pressable>
      </View>
    </WarmModal>
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
  analysis,
  isAnalyzing,
  analysisError,
  onDetectAnalysis,
  practiceLoopEnabled,
  practiceRangeLabel,
  onSeekLoopStart,
  onMoveLoopToPlayhead,
  onLoopSection,
  onTogglePracticeLoop,
  practiceMarkers,
  playheadMs,
  onAddPin,
  onSeekPin,
  expandedPinId,
  pinsDurationMs,
  onTogglePinExpanded,
  onRepositionPin,
  onPinPreview,
  onEditPin,
  onDeletePin,
  sections,
  sectionsDurationMs,
  editingSectionId,
  onAddSection,
  onSeekSection,
  onToggleSectionEdit,
  onEditSection,
  onRepositionSectionEdge,
  onSectionPreview,
  onDeleteSection,
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
  onRecordOverdub,
}: PlayerPracticePanelProps) {
  const [settingsRowHeight, setSettingsRowHeight] = useState(64);
  // Type picker (for the + add button), the new-custom / edit detail modal, and which edge
  // (start|end) the single per-section adjuster is currently controlling.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detailModal, setDetailModal] = useState<
    { mode: "new" } | { mode: "edit"; section: ClipSection } | null
  >(null);
  const [activeEdge, setActiveEdge] = useState<"start" | "end">("start");
  const [pinEditModal, setPinEditModal] = useState<PracticeMarker | null>(null);
  const [loopPickerOpen, setLoopPickerOpen] = useState(false);
  const customSectionOptions = getCustomSectionOptions(sections);

  const openEdgeAdjuster = (section: ClipSection, edge: "start" | "end") => {
    setActiveEdge(edge);
    if (editingSectionId !== section.id) onToggleSectionEdit(section);
  };

  const handleDetailConfirm = (custom: SectionCustomInput) => {
    if (detailModal?.mode === "edit") onEditSection(detailModal.section.id, custom);
    else onAddSection("custom", custom);
    setDetailModal(null);
  };

  const canDecreasePitch = supportsPitchShift && pitchShiftSemitones > PITCH_SHIFT_MIN_SEMITONES;
  const canIncreasePitch = supportsPitchShift && pitchShiftSemitones < PITCH_SHIFT_MAX_SEMITONES;
  const isPitchOriginal = pitchShiftSemitones === 0;
  const sortedMarkers = [...practiceMarkers].sort((a, b) => a.atMs - b.atMs);

  const pinsValue = sortedMarkers.length === 0 ? "None" : `${sortedMarkers.length} pin${sortedMarkers.length === 1 ? "" : "s"}`;
  const loopValue = practiceLoopEnabled ? practiceRangeLabel : "Off";
  const sectionsValue =
    sections.length === 0 ? "None" : `${sections.length} part${sections.length === 1 ? "" : "s"}`;
  const speedValue = `${playbackSpeed}×`;
  const pitchValue = !supportsPitchShift
    ? "—"
    : `${pitchShiftSemitones > 0 ? "+" : ""}${pitchShiftSemitones}`;
  const countInValue = countInOption === "off" ? "Off" : countInOption === "1b" ? "1 bar" : "2 bars";

  const settingValues = { speed: speedValue, pitch: pitchValue, countin: countInValue };
  const settingOrder: ("speed" | "pitch" | "countin")[] = ["speed", "pitch", "countin"];
  // Only the bottom settings tools open as a backdrop popover. Listing them explicitly
  // avoids accidentally treating accordion tools (pins/loop/sections) as popovers — doing so
  // drops a full-screen onClose backdrop over their controls and eats every tap.
  const popoverTool =
    expandedTool === "speed" || expandedTool === "pitch" || expandedTool === "countin"
      ? expandedTool
      : null;

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
      <View>
        <View style={s.analysisRow}>
          {hasAnalysisResult(analysis) ? (
            <>
              <Ionicons name="musical-note" size={14} color={colors.primary} />
              <Text style={s.analysisValue}>{formatKeyLabel(analysis)}</Text>
              <View style={s.analysisSep} />
              <Text style={s.analysisValue}>{formatBpmLabel(analysis)}</Text>
              {analysis && analysis.bpm != null && !isTempoSteady(analysis) ? (
                <Text style={s.analysisHint}>loose</Text>
              ) : null}
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={onDetectAnalysis}
                disabled={isAnalyzing}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Re-detect key and tempo"
              >
                <Ionicons name={isAnalyzing ? "sync" : "refresh"} size={15} color={colors.textMuted} />
              </Pressable>
            </>
          ) : (
            <Pressable
              style={s.analysisDetectButton}
              onPress={onDetectAnalysis}
              disabled={isAnalyzing}
              accessibilityRole="button"
              accessibilityLabel="Detect key and tempo"
            >
              <Ionicons name={isAnalyzing ? "sync" : "sparkles-outline"} size={15} color={colors.primary} />
              <Text style={s.analysisDetectText}>{isAnalyzing ? "Analyzing…" : "Detect key & tempo"}</Text>
            </Pressable>
          )}
        </View>
        {analysisError ? <Text style={s.analysisErrorText}>{analysisError}</Text> : null}
      </View>

      <AccordionRow
        tool="sections"
        icon="layers-outline"
        label="Sections"
        value={sectionsValue}
        valueOnLeft
        headerAccessory={
          <Pressable
            style={s.sectionAddCircle}
            onPress={() => setPickerOpen(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Add a section"
          >
            <Ionicons name="add" size={18} color={colors.onPrimary} />
          </Pressable>
        }
        expanded={expandedTool === "sections"}
        onToggle={onToggleTool}
      >
        {sections.length === 0 ? (
          <Text style={s.pinEmptyText}>No sections yet — tap the + to map the song.</Text>
        ) : (
          sections.map((section, index) => {
            const swatchColor = getSectionColor(section);
            const isEditing = editingSectionId === section.id;
            return (
              <View
                key={section.id}
                style={[
                  s.pinRow,
                  index > 0 ? s.pinRowDivider : null,
                  { flexDirection: "column", alignItems: "stretch", gap: 0 },
                ]}
              >
                <View style={s.sectionRowMain}>
                  <Pressable
                    style={s.sectionRowLabel}
                    onPress={() => onSeekSection(section.startMs)}
                    accessibilityRole="button"
                    accessibilityLabel={`Jump to ${section.label} at ${fmtDuration(section.startMs)}`}
                  >
                    <View style={[s.sectionSwatch, { backgroundColor: swatchColor }]} />
                    <Text style={s.sectionRowLabelText} numberOfLines={1}>
                      {section.label}
                    </Text>
                  </Pressable>
                  {/* Start / end times double as the edge selector: the active one is plain,
                      the other sits in a chip. Tapping either opens the adjuster on that edge. */}
                  <Pressable
                    style={[s.sectionTimeChip, isEditing && activeEdge === "start" ? s.sectionTimeChipActive : null]}
                    onPress={() => openEdgeAdjuster(section, "start")}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit start (${fmtDuration(section.startMs)})`}
                  >
                    <Text
                      style={[
                        s.sectionTimeChipText,
                        isEditing && activeEdge === "start" ? s.sectionTimeChipTextActive : null,
                      ]}
                    >
                      {fmtDuration(section.startMs)}
                    </Text>
                  </Pressable>
                  <Text style={s.sectionTimeDash}>–</Text>
                  <Pressable
                    style={[s.sectionTimeChip, isEditing && activeEdge === "end" ? s.sectionTimeChipActive : null]}
                    onPress={() => openEdgeAdjuster(section, "end")}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit end (${fmtDuration(section.endMs)})`}
                  >
                    <Text
                      style={[
                        s.sectionTimeChipText,
                        isEditing && activeEdge === "end" ? s.sectionTimeChipTextActive : null,
                      ]}
                    >
                      {fmtDuration(section.endMs)}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setDetailModal({ mode: "edit", section })}
                    hitSlop={6}
                    style={s.sectionRowIcon}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${section.label} name and colour`}
                  >
                    <Ionicons name="ellipsis-horizontal" size={16} color={colors.textMuted} />
                  </Pressable>
                  <Pressable
                    onPress={() => onToggleSectionEdit(section)}
                    hitSlop={6}
                    style={s.sectionRowIcon}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isEditing }}
                    accessibilityLabel={isEditing ? "Hide timing" : "Adjust timing"}
                  >
                    <Ionicons
                      name={isEditing ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={colors.textMuted}
                    />
                  </Pressable>
                </View>
                {isEditing ? (
                  <SectionEdgeAdjuster
                    section={section}
                    edge={activeEdge}
                    durationMs={sectionsDurationMs}
                    playheadMs={playheadMs}
                    onReposition={onRepositionSectionEdge}
                    onPreview={onSectionPreview}
                  />
                ) : null}
              </View>
            );
          })
        )}
      </AccordionRow>

      <SectionPickerModal
        visible={pickerOpen}
        title="Add section"
        customOptions={customSectionOptions}
        onPickPreset={(kind) => {
          onAddSection(kind);
          setPickerOpen(false);
        }}
        onPickCustom={(custom) => {
          onAddSection("custom", custom);
          setPickerOpen(false);
        }}
        onCreateNew={() => {
          setPickerOpen(false);
          setDetailModal({ mode: "new" });
        }}
        onClose={() => setPickerOpen(false)}
      />
      <SectionDetailModal
        visible={detailModal != null}
        title={detailModal?.mode === "edit" ? "Edit section" : "New section"}
        confirmLabel={detailModal?.mode === "edit" ? "Save" : "Add"}
        initialName={detailModal?.mode === "edit" ? detailModal.section.label : ""}
        initialColor={
          detailModal?.mode === "edit" ? getSectionColor(detailModal.section) : hueToAccentHex(210)
        }
        onConfirm={handleDetailConfirm}
        onDelete={
          detailModal?.mode === "edit"
            ? () => {
                onDeleteSection(detailModal.section.id);
                setDetailModal(null);
              }
            : undefined
        }
        onClose={() => setDetailModal(null)}
      />

      <AccordionRow
        tool="pins"
        icon="location-outline"
        label="Pins"
        value={pinsValue}
        valueOnLeft
        headerAccessory={
          <Pressable
            style={s.sectionAddCircle}
            onPress={onAddPin}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Add a pin at the playhead"
          >
            <Ionicons name="add" size={18} color={colors.onPrimary} />
          </Pressable>
        }
        expanded={expandedTool === "pins"}
        onToggle={onToggleTool}
      >
        {sortedMarkers.length === 0 ? (
          <Text style={s.pinEmptyText}>No pins yet — tap the + to drop one at the playhead.</Text>
        ) : (
          sortedMarkers.map((marker, index) => {
            const isExpanded = expandedPinId === marker.id;
            const hasNote = !!(marker.note && marker.note.trim());
            return (
              <View
                key={marker.id}
                style={[
                  s.pinRow,
                  index > 0 ? s.pinRowDivider : null,
                  { flexDirection: "column", alignItems: "stretch", gap: 0 },
                ]}
              >
                <View style={s.sectionRowMain}>
                  <Pressable
                    style={s.sectionRowLabel}
                    onPress={() => onSeekPin(marker.atMs)}
                    accessibilityRole="button"
                    accessibilityLabel={`Jump to ${marker.label || "pin"} at ${fmtDuration(marker.atMs)}`}
                  >
                    <View style={s.pinDot} />
                    <Text style={s.sectionRowLabelText} numberOfLines={1}>
                      {marker.label || "Pin"}
                    </Text>
                    {hasNote ? (
                      <Ionicons name="document-text-outline" size={13} color={colors.textMuted} />
                    ) : null}
                  </Pressable>
                  <Pressable
                    style={[s.sectionTimeChip, isExpanded ? s.sectionTimeChipActive : null]}
                    onPress={() => onTogglePinExpanded(marker)}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit time (${fmtDuration(marker.atMs)})`}
                  >
                    <Text style={[s.sectionTimeChipText, isExpanded ? s.sectionTimeChipTextActive : null]}>
                      {fmtDuration(marker.atMs)}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setPinEditModal(marker)}
                    hitSlop={6}
                    style={s.sectionRowIcon}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${marker.label || "pin"} name and note`}
                  >
                    <Ionicons name="ellipsis-horizontal" size={16} color={colors.textMuted} />
                  </Pressable>
                  <Pressable
                    onPress={() => onTogglePinExpanded(marker)}
                    hitSlop={6}
                    style={s.sectionRowIcon}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isExpanded }}
                    accessibilityLabel={isExpanded ? "Hide timing" : "Adjust timing"}
                  >
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={colors.textMuted}
                    />
                  </Pressable>
                </View>
                {isExpanded ? (
                  <PinTimingAdjuster
                    marker={marker}
                    durationMs={pinsDurationMs}
                    playheadMs={playheadMs}
                    onReposition={onRepositionPin}
                    onPreview={onPinPreview}
                  />
                ) : null}
              </View>
            );
          })
        )}
      </AccordionRow>

      <PinDetailModal
        visible={pinEditModal != null}
        initialName={pinEditModal?.label ?? ""}
        initialNote={pinEditModal?.note ?? ""}
        onConfirm={(edits) => {
          if (pinEditModal) onEditPin(pinEditModal.id, edits);
          setPinEditModal(null);
        }}
        onDelete={
          pinEditModal
            ? () => {
                onDeletePin(pinEditModal.id);
                setPinEditModal(null);
              }
            : undefined
        }
        onClose={() => setPinEditModal(null)}
      />

      <AccordionRow
        tool="loop"
        icon="infinite"
        label="Loop"
        value={loopValue}
        headerAccessory={
          <Pressable
            style={[s.switchShell, practiceLoopEnabled ? s.switchShellActive : null]}
            onPress={onTogglePracticeLoop}
            accessibilityRole="switch"
            accessibilityState={{ checked: practiceLoopEnabled }}
            accessibilityLabel="Toggle loop"
          >
            <View style={[s.switchKnob, practiceLoopEnabled ? s.switchKnobActive : null]} />
          </Pressable>
        }
        expanded={expandedTool === "loop"}
        onToggle={onToggleTool}
      >
        {!practiceLoopEnabled ? (
          <Text style={s.pinEmptyText}>Turn Loop on to set a practice region.</Text>
        ) : (
          <>
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
                accessibilityLabel="Move loop to the playhead"
              >
                <Ionicons name="locate-outline" size={16} color={colors.textStrong} />
              </Pressable>
            </View>
            <Pressable
              style={[s.sectionChangeTypeButton, sections.length === 0 ? { opacity: 0.5 } : null]}
              onPress={() => sections.length > 0 && setLoopPickerOpen(true)}
              disabled={sections.length === 0}
              accessibilityRole="button"
              accessibilityLabel="Loop a section"
            >
              <Ionicons name="layers-outline" size={15} color={colors.textSecondary} />
              <Text style={s.sectionChangeTypeText}>
                {sections.length === 0 ? "No sections to loop" : "Loop a section"}
              </Text>
              <View style={{ flex: 1 }} />
              <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
            </Pressable>
          </>
        )}
      </AccordionRow>

      <LoopSectionPickerModal
        visible={loopPickerOpen}
        sections={sections}
        onPick={(section) => {
          onLoopSection(section);
          setLoopPickerOpen(false);
        }}
        onClose={() => setLoopPickerOpen(false)}
      />
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

      <Pressable
        style={({ pressed }) => [s.recordLayerButton, pressed ? s.recordLayerButtonPressed : null]}
        onPress={onRecordOverdub}
        accessibilityRole="button"
        accessibilityLabel="Record a new layer over this take"
      >
        <View style={s.recordLayerDot} />
        <Text style={s.recordLayerText}>Record a layer</Text>
      </Pressable>
    </View>
  );
}
