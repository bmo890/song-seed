import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import {
  formatPitchShiftLabel,
  PITCH_SHIFT_MAX_SEMITONES,
  PITCH_SHIFT_MIN_SEMITONES,
} from "../../../domain/pitchShift";
import { fmtDuration } from "../../../utils";
import { colors } from "../../../design/tokens";
import { getCustomSectionOptions, getSectionColor } from "../../../domain/playerSections";
import type { SectionCustomInput } from "../hooks/usePlayerSections";
import { hueToAccentHex } from "../../../domain/workspaceTheme";
import { formatBpmLabel, formatKeyLabel, hasAnalysisResult, isTempoSteady } from "../../../domain/clipAnalysis";
import { playerScreenStyles as s } from "../styles";
import type { CountInOption, PracticeTool } from "../hooks/usePlayerScreenUi";
import type { ClipAnalysis, ClipSection, ClipSectionKind, PracticeMarker } from "../../../types";
import { styles as appStyles } from "../../../styles";
import { haptic } from "../../../design/haptics";
import { AccordionRow, Chip } from "./practicePanelPrimitives";
import { PinDetailModal, PinTimingAdjuster } from "./PinDetailModal";
import {
  LoopSectionPickerModal,
  SectionDetailModal,
  SectionEdgeAdjuster,
  SectionPickerModal,
} from "./sectionModals";

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
  /** Record a layer punched in at a specific song position (section start / pin). */
  onRecordLayerAt: (atMs: number) => void;
};


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
  onRecordLayerAt,
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
            onSlidingComplete={(value) => {
              haptic.tap();
              onSpeedSlideEnd(value);
            }}
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
                    onPress={() => onRecordLayerAt(section.startMs)}
                    hitSlop={6}
                    style={s.sectionRowIcon}
                    accessibilityRole="button"
                    accessibilityLabel={`Record a layer from ${section.label}`}
                  >
                    <Ionicons name="mic-outline" size={16} color={colors.primary} />
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
                    onPress={() => onRecordLayerAt(marker.atMs)}
                    hitSlop={6}
                    style={s.sectionRowIcon}
                    accessibilityRole="button"
                    accessibilityLabel={`Record a layer from ${marker.label || "this pin"}`}
                  >
                    <Ionicons name="mic-outline" size={16} color={colors.primary} />
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
                style={({ pressed }) => [s.loopIconButton, pressed ? appStyles.pressDown : null]}
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

      {/* The label states the punch point up front: mid-song playhead = the layer records
          from there (bar-snapped); at the top it's a classic full-length layer. */}
      <Pressable
        style={({ pressed }) => [s.recordLayerButton, pressed ? s.recordLayerButtonPressed : null]}
        onPress={onRecordOverdub}
        accessibilityRole="button"
        accessibilityLabel={
          playheadMs > 1000
            ? `Record a layer from ${fmtDuration(playheadMs)}`
            : "Record a new layer over this take"
        }
      >
        <View style={s.recordLayerDot} />
        <Text style={s.recordLayerText}>
          {playheadMs > 1000 ? `Record a layer from ${fmtDuration(playheadMs)}` : "Record a layer"}
        </Text>
      </Pressable>
    </View>
  );
}
