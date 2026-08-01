import React, { useMemo, useState } from "react";
import { I18nManager, Pressable, Text, View, type ViewStyle } from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { PITCH_SHIFT_MAX_SEMITONES, PITCH_SHIFT_MIN_SEMITONES } from "../../../domain/pitchShift";
import { fmtDuration } from "../../../utils";
import { colors } from "../../../design/tokens";
import { getCustomSectionOptions, getSectionColor, MIN_SECTION_LENGTH_MS } from "../../../domain/playerSections";
import type { SectionCustomInput } from "../hooks/usePlayerSections";
import { formatBpmLabel, hasAnalysisResult, isTempoSteady } from "../../../domain/clipAnalysis";
import { playerScreenStyles as s } from "../styles";
import { pd } from "./practiceDrawerStyles";
import type { CountInOption } from "../hooks/usePlayerScreenUi";
import type { ClipAnalysis, ClipSection, ClipSectionKind, PracticeMarker } from "../../../types";
import { SegmentedControl } from "../../common/SegmentedControl";
import { PinDetailModal } from "./PinDetailModal";
import { SectionDetailModal, SectionPickerModal } from "./sectionModals";
import { StepUpSequenceSheet } from "./StepUpSequenceSheet";
import {
  STEP_UP_BUILTIN_PRESETS,
  matchStepUpPreset,
  type StepUpSequenceProgress,
  type StepUpStage,
} from "../../../domain/stepUpLoop";
import { HelpButton } from "../../common/HelpButton";
import { HelpSheet } from "../../common/HelpSheet";
import { AnimatedCollapse } from "../../common/AnimatedCollapse";
import { haptic } from "../../../design/haptics";
import { useTranslation } from "react-i18next";

/**
 * The practice tools as three drawers — Marks / Loop / Sound — replacing the old
 * accordion stack and its absolutely-positioned settings popover (which could park
 * the speed slider off-screen; docs/product-plan/full-player-audit.md A1/A6).
 *
 * Selection replaces per-row controls: one mark at a time is "held", and only it
 * shows the inspector (edge chips, drag slider, zoom-scaled nudges, use-playhead).
 * Tapping a row or an edge chip also CUES the playhead there — deliberate, decided
 * 2026-07-31: no separate cue button, and no play control inside the editor.
 *
 * RTL: rows tied to the tape's time axis are pinned LTR ("left = earlier" must
 * agree with the reel); language rows mirror normally. See `ltrRow`.
 */

type Drawer = "marks" | "loop" | "sound";

type SelectedMark =
  | { kind: "section"; id: string; edge: "start" | "end" }
  | { kind: "pin"; id: string }
  | null;

type PlayerPracticeDrawersProps = {
  // Tempo / analysis (Sound drawer)
  analysis: ClipAnalysis | null;
  recordingGridBpm: number | null;
  /** e.g. "92 · 3/4 → 102 · 4/4" for a tempo-mapped grid; null without a grid. */
  clickDetail: string | null;
  isAnalyzing: boolean;
  analysisError: string | null;
  onDetectAnalysis: () => void;

  // Shared
  durationMs: number;
  playheadMs: number;
  /** Cue the playhead (does not start playback). */
  onSeek: (ms: number) => void;
  /** Reel zoom multiple — scales the nudge step so carets stay micro-adjust. */
  zoomMultiple: number;

  // Marks
  sections: ClipSection[];
  practiceMarkers: PracticeMarker[];
  onAddSection: (kind: ClipSectionKind, custom?: SectionCustomInput) => void;
  onEditSection: (sectionId: string, edits: { label: string; color: string }) => void;
  onRepositionSectionEdge: (sectionId: string, edge: "start" | "end", ms: number) => void;
  onSectionPreview: (preview: { id: string; startMs?: number; endMs?: number } | null) => void;
  onDeleteSection: (sectionId: string) => void;
  onAddPin: () => void;
  onRepositionPin: (markerId: string, atMs: number) => void;
  onPinPreview: (preview: { id: string; atMs: number } | null) => void;
  onEditPin: (markerId: string, edits: { label: string; note: string }) => void;
  onDeletePin: (markerId: string) => void;

  // Loop
  practiceLoopEnabled: boolean;
  practiceLoopRange: { start: number; end: number };
  onSetLoopRange: (start: number, end: number) => void;
  onTogglePracticeLoop: () => void;
  onLoopSection: (section: ClipSection) => void;

  // Step up — the loop's speed sequence (rates only; no grid required)
  stepUpEnabled: boolean;
  stepUpProgress: StepUpSequenceProgress | null;
  stepUpSequence: StepUpStage[];
  onChangeStepUpSequence: (stages: StepUpStage[]) => void;
  stepUpRateMin: number;
  stepUpRateMax: number;
  onToggleStepUp: () => void;
  onRestartStepUp: () => void;

  // Sound
  playbackSpeed: number;
  speedPresets: readonly number[];
  speedMin: number;
  speedMax: number;
  onSpeedTap: (value: number) => void;
  onSpeedSlideStart: (value: number) => void;
  onSpeedSliding: (value: number) => void;
  onSpeedSlideEnd: (value: number) => void;
  pitchShiftSemitones: number;
  supportsPitchShift: boolean;
  onAdjustPitchShift: (value: number) => void;
  countInOption: CountInOption;
  onSelectCountIn: (option: CountInOption) => void;
  clickAvailable: boolean;
  clickEnabled: boolean;
  onSetClickEnabled: (enabled: boolean) => void;

  // Record a layer
  onRecordOverdub: (playheadMs: number) => void;
  onRecordLayerAt: (atMs: number) => void;
};

/** Pin a row's visual order to LTR regardless of language direction. */
const ltrRow: ViewStyle = { flexDirection: I18nManager.isRTL ? "row-reverse" : "row" };

const MIN_LOOP_LENGTH_MS = 1000;

/** "0.5× → 1×" — a climb reads as a journey, not a range. One rate states itself. */
function stepUpClimbLabel(sequence: StepUpStage[]): string {
  const first = sequence[0]?.rate;
  const last = sequence[sequence.length - 1]?.rate;
  if (first == null || last == null) return "";
  return first === last ? `${first}×` : `${first}× → ${last}×`;
}

/** Dots never exceed this — beyond it each dot stands for several passes. */
const STEP_UP_MAX_DOTS = 12;

/**
 * The drill's own line, under the row: connected dots for the passes, the pass
 * counter, and the live speed. A long plan folds several passes into one dot rather
 * than growing a wider and wider string of them.
 *
 * A dot is filled once its passes are behind you, ringed while you are inside it,
 * and quiet ahead — so the line reads as position without being counted.
 */
function StepUpProgressLine({
  completedLoops,
  totalLoops,
  passNumber,
  rate,
  atEnd,
}: {
  completedLoops: number;
  totalLoops: number;
  passNumber: number;
  rate: number;
  atEnd: boolean;
}) {
  const { t } = useTranslation();
  const dotCount = Math.max(1, Math.min(totalLoops, STEP_UP_MAX_DOTS));
  const passesPerDot = Math.ceil(totalLoops / dotCount);
  return (
    <View style={pd.stepUpProgressRow}>
      <View style={pd.stepUpDots}>
        {Array.from({ length: dotCount }, (_, index) => {
          const done = completedLoops >= (index + 1) * passesPerDot;
          const current = !done && completedLoops >= index * passesPerDot;
          return (
            <React.Fragment key={index}>
              {index > 0 ? (
                <View
                  style={[
                    pd.stepUpDotLink,
                    { backgroundColor: done ? colors.primary : colors.borderSubtle },
                  ]}
                />
              ) : null}
              <View
                style={[
                  pd.stepUpDot,
                  done ? pd.stepUpDotDone : current ? pd.stepUpDotCurrent : null,
                ]}
              />
            </React.Fragment>
          );
        })}
      </View>
      <Text style={pd.stepUpProgressCount}>
        {atEnd ? t("player.stepUpDone") : `${passNumber} / ${totalLoops}`}
      </Text>
      <Text style={pd.stepUpProgressRate}>{`${rate}×`}</Text>
    </View>
  );
}

function SpanGlyph({ color }: { color: string }) {
  return (
    <View style={pd.spanGlyph}>
      <View style={[pd.spanBarV, { backgroundColor: color }]} />
      <View style={[pd.spanBarH, { backgroundColor: color }]} />
      <View style={[pd.spanBarV, { backgroundColor: color }]} />
    </View>
  );
}

function EdgeChip({
  label,
  timeMs,
  active,
  onPress,
}: {
  label: string;
  timeMs: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        pd.edgeChip,
        active ? pd.edgeChipActive : null,
        pressed ? s.toolHeaderPressed : null,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label} ${fmtDuration(timeMs)}`}
    >
      <Text style={[pd.edgeChipLabel, active ? pd.edgeChipLabelActive : null]}>{label}</Text>
      <Text style={pd.edgeChipTime}>{fmtDuration(timeMs)}</Text>
    </Pressable>
  );
}

/**
 * The one editor every mark — and the loop — gets: edge chips, a drag slider
 * (live-previewed on the reel), zoom-scaled nudge carets and use-playhead.
 */
function MarkInspector({
  startMs,
  endMs,
  edge,
  onPickEdge,
  minMs,
  maxMs,
  onSlide,
  onSlideCommit,
  onNudge,
  onUsePlayhead,
  usePlayheadDisabled,
  nudgeStepMs,
  startLabel,
  endLabel,
}: {
  startMs: number;
  /** null for a pin — a single point in time. */
  endMs: number | null;
  edge: "start" | "end";
  onPickEdge: (edge: "start" | "end") => void;
  minMs: number;
  maxMs: number;
  onSlide: (ms: number) => void;
  onSlideCommit: (ms: number) => void;
  onNudge: (deltaMs: number) => void;
  onUsePlayhead: () => void;
  usePlayheadDisabled: boolean;
  nudgeStepMs: number;
  startLabel: string;
  endLabel: string;
}) {
  const { t } = useTranslation();
  const [dragMs, setDragMs] = useState<number | null>(null);
  const current = edge === "start" || endMs == null ? startMs : endMs;
  const displayMs = dragMs ?? current;
  return (
    <View style={pd.inspector}>
      <View style={[pd.edgesRow, ltrRow]}>
        <EdgeChip
          label={startLabel}
          timeMs={edge === "start" ? displayMs : startMs}
          active={edge === "start" || endMs == null}
          onPress={() => onPickEdge("start")}
        />
        {endMs != null ? (
          <>
            <Text style={pd.edgeArrow}>→</Text>
            <EdgeChip
              label={endLabel}
              timeMs={edge === "end" ? displayMs : endMs}
              active={edge === "end"}
              onPress={() => onPickEdge("end")}
            />
          </>
        ) : null}
      </View>
      <View style={[pd.dragRow, ltrRow]}>
        <Pressable
          style={pd.nudgeBtn}
          onPress={() => onNudge(-nudgeStepMs)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t("player.nudgeEarlier")}
        >
          <Ionicons name="chevron-back" size={15} color={colors.textStrong} />
        </Pressable>
        <Slider
          style={pd.dragSlider}
          inverted={I18nManager.isRTL}
          minimumValue={minMs}
          maximumValue={Math.max(minMs + 1, maxMs)}
          step={50}
          value={Math.max(minMs, Math.min(maxMs, current))}
          onValueChange={(value) => {
            const next = Math.round(value);
            setDragMs(next);
            onSlide(next);
          }}
          onSlidingComplete={(value) => {
            haptic.tap();
            onSlideCommit(Math.round(value));
            setDragMs(null);
          }}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.surfaceHigh}
          thumbTintColor={colors.primary}
        />
        <Pressable
          style={pd.nudgeBtn}
          onPress={() => onNudge(nudgeStepMs)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t("player.nudgeLater")}
        >
          <Ionicons name="chevron-forward" size={15} color={colors.textStrong} />
        </Pressable>
      </View>
      <View style={pd.hintRow}>
        <Text style={pd.inspectorHint} numberOfLines={1}>
          {t("player.inspectorHint", { step: nudgeStepMs })}
        </Text>
        <Pressable
          style={({ pressed }) => [
            pd.usePlayheadBtn,
            usePlayheadDisabled ? { opacity: 0.4 } : null,
            pressed ? s.toolHeaderPressed : null,
          ]}
          onPress={onUsePlayhead}
          disabled={usePlayheadDisabled}
          accessibilityRole="button"
          accessibilityLabel={t("player.usePlayhead")}
        >
          <Ionicons name="locate-outline" size={13} color={colors.primaryDeep} />
          <Text style={pd.usePlayheadText}>{t("player.usePlayhead")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function PlayerPracticeDrawers({
  analysis,
  recordingGridBpm,
  clickDetail,
  isAnalyzing,
  analysisError,
  onDetectAnalysis,
  durationMs,
  playheadMs,
  onSeek,
  zoomMultiple,
  sections,
  practiceMarkers,
  onAddSection,
  onEditSection,
  onRepositionSectionEdge,
  onSectionPreview,
  onDeleteSection,
  onAddPin,
  onRepositionPin,
  onPinPreview,
  onEditPin,
  onDeletePin,
  practiceLoopEnabled,
  practiceLoopRange,
  onSetLoopRange,
  onTogglePracticeLoop,
  onLoopSection,
  stepUpEnabled,
  stepUpProgress,
  stepUpSequence,
  onChangeStepUpSequence,
  stepUpRateMin,
  stepUpRateMax,
  onToggleStepUp,
  onRestartStepUp,
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
  clickAvailable,
  clickEnabled,
  onSetClickEnabled,
  onRecordOverdub,
  onRecordLayerAt,
}: PlayerPracticeDrawersProps) {
  const { t } = useTranslation();
  const [drawer, setDrawer] = useState<Drawer>("marks");
  const [selected, setSelected] = useState<SelectedMark>(null);
  const [loopEdge, setLoopEdge] = useState<"start" | "end">("start");
  const [stepUpSheetOpen, setStepUpSheetOpen] = useState(false);
  const [stepUpHelpOpen, setStepUpHelpOpen] = useState(false);
  // The plan wears its name when it IS one — a built-in drill or a saved sequence;
  // an edited plan is honestly "Custom" rather than borrowing the last name it had.
  // A plan is one of the three ready-made drills, or it is the musician's own —
  // there is nothing else to be, now that named sequences are parked.
  const stepUpBuiltinKey = useMemo(
    () =>
      matchStepUpPreset(
        stepUpSequence,
        STEP_UP_BUILTIN_PRESETS.map((preset) => ({ key: preset.id, stages: preset.stages })),
        { minRate: stepUpRateMin, maxRate: stepUpRateMax }
      ),
    [stepUpRateMax, stepUpRateMin, stepUpSequence]
  );
  const stepUpIsCustomPlan = stepUpBuiltinKey == null;
  const stepUpPlanName = stepUpBuiltinKey
    ? t(`player.stepUpPreset_${stepUpBuiltinKey}`)
    : t("player.stepUpCustom");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detailModal, setDetailModal] = useState<
    | { mode: "edit"; section: ClipSection }
    | { mode: "new" }
    | null
  >(null);
  const [pinEditModal, setPinEditModal] = useState<PracticeMarker | null>(null);

  const customSectionOptions = useMemo(() => getCustomSectionOptions(sections), [sections]);

  // Micro-adjust only: the caret step shrinks as the reel zooms in.
  const nudgeStepMs = Math.max(10, Math.round(100 / Math.max(1, zoomMultiple)));

  type MarkEntry =
    | { kind: "section"; atMs: number; section: ClipSection }
    | { kind: "pin"; atMs: number; marker: PracticeMarker };
  const marks = useMemo<MarkEntry[]>(() => {
    const entries: MarkEntry[] = [
      ...sections.map((section) => ({ kind: "section" as const, atMs: section.startMs, section })),
      ...practiceMarkers.map((marker) => ({ kind: "pin" as const, atMs: marker.atMs, marker })),
    ];
    return entries.sort((a, b) => a.atMs - b.atMs);
  }, [sections, practiceMarkers]);

  const drawerHasState = {
    marks: marks.length > 0,
    loop: practiceLoopEnabled || stepUpEnabled,
    sound:
      Math.abs(playbackSpeed - 1) > 0.01 ||
      pitchShiftSemitones !== 0 ||
      (clickAvailable && clickEnabled) ||
      countInOption !== "off",
  };

  const canDecreasePitch = supportsPitchShift && pitchShiftSemitones > PITCH_SHIFT_MIN_SEMITONES;
  const canIncreasePitch = supportsPitchShift && pitchShiftSemitones < PITCH_SHIFT_MAX_SEMITONES;

  const clampSectionEdge = (section: ClipSection, edge: "start" | "end", ms: number) => {
    const minMs = edge === "start" ? 0 : Math.min(section.startMs + MIN_SECTION_LENGTH_MS, Math.max(1, durationMs));
    const maxMs = edge === "start" ? Math.max(0, section.endMs - MIN_SECTION_LENGTH_MS) : Math.max(1, durationMs);
    return Math.max(minMs, Math.min(maxMs, ms));
  };

  // ---------------------------------------------------------------- marks
  const renderMarkRow = (entry: MarkEntry, index: number) => {
    const isSection = entry.kind === "section";
    const id = isSection ? entry.section.id : entry.marker.id;
    const isSelected = selected != null && selected.kind === entry.kind && selected.id === id;
    const color = isSection ? getSectionColor(entry.section) : colors.primaryDeep;
    const name = isSection ? entry.section.label : entry.marker.label || t("player.pin");

    const row = (
      <Pressable
        key={`${entry.kind}-${id}-row`}
        style={({ pressed }) => [pd.markRow, pressed && !isSelected ? s.toolHeaderPressed : null]}
        onPress={() => {
          haptic.tap();
          if (isSelected) {
            setSelected(null);
            onSectionPreview(null);
            onPinPreview(null);
            return;
          }
          setSelected(
            isSection ? { kind: "section", id, edge: "start" } : { kind: "pin", id }
          );
          // Selecting a mark cues the playhead to it — the whole point of holding it.
          onSeek(entry.atMs);
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={
          isSection
            ? t("player.jumpSection", { title: name, time: fmtDuration(entry.atMs) })
            : t("player.jumpPin", { title: name, time: fmtDuration(entry.atMs) })
        }
      >
        <View style={pd.markGlyph}>
          {isSection ? (
            <SpanGlyph color={color} />
          ) : (
            <Ionicons name="flag" size={13} color={color} />
          )}
        </View>
        <Text style={[pd.markName, isSelected ? pd.markNameSelected : null]} numberOfLines={1}>
          {name}
        </Text>
        {isSelected ? (
          <View style={pd.selectedHeadActions}>
            <Pressable
              style={pd.headIconBtn}
              onPress={() => onRecordLayerAt(entry.atMs)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t("player.recordFromTitle", { title: name })}
            >
              <Ionicons name="mic-outline" size={16} color={colors.primary} />
            </Pressable>
            <Pressable
              style={pd.headIconBtn}
              onPress={() =>
                isSection ? setDetailModal({ mode: "edit", section: entry.section }) : setPinEditModal(entry.marker)
              }
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={
                isSection
                  ? t("player.editSectionDetails", { title: name })
                  : t("player.editPinDetails", { title: name })
              }
            >
              <Ionicons name="ellipsis-horizontal" size={16} color={colors.primaryDeep} />
            </Pressable>
          </View>
        ) : (
          <Text style={pd.markTime}>
            {isSection
              ? `${fmtDuration(entry.section.startMs)}–${fmtDuration(entry.section.endMs)}`
              : fmtDuration(entry.atMs)}
          </Text>
        )}
      </Pressable>
    );

    if (!isSelected) {
      return (
        <React.Fragment key={`${entry.kind}-${id}`}>
          {index > 0 ? <View style={pd.markDivider} /> : null}
          {row}
        </React.Fragment>
      );
    }

    const section = isSection ? entry.section : null;
    const edge = selected!.kind === "section" ? selected!.edge : "start";
    const sliderMin = section ? (edge === "start" ? 0 : Math.min(section.startMs + MIN_SECTION_LENGTH_MS, durationMs)) : 0;
    const sliderMax = section
      ? edge === "start"
        ? Math.max(0, section.endMs - MIN_SECTION_LENGTH_MS)
        : Math.max(1, durationMs)
      : Math.max(1, durationMs);
    const canUsePlayhead = section
      ? edge === "start"
        ? playheadMs <= section.endMs - MIN_SECTION_LENGTH_MS
        : playheadMs >= section.startMs + MIN_SECTION_LENGTH_MS
      : true;

    return (
      <View key={`${entry.kind}-${id}`} style={pd.selectedCard}>
        {row}
        <MarkInspector
          startMs={section ? section.startMs : entry.atMs}
          endMs={section ? section.endMs : null}
          edge={edge}
          startLabel={section ? t("player.start") : t("player.atLabel")}
          endLabel={t("player.end")}
          onPickEdge={(nextEdge) => {
            if (section) {
              setSelected({ kind: "section", id, edge: nextEdge });
              onSeek(nextEdge === "start" ? section.startMs : section.endMs);
            } else {
              onSeek(entry.atMs);
            }
          }}
          minMs={sliderMin}
          maxMs={sliderMax}
          onSlide={(ms) => {
            if (section) {
              onSectionPreview({ id, [edge === "start" ? "startMs" : "endMs"]: ms });
            } else {
              onPinPreview({ id, atMs: ms });
            }
          }}
          onSlideCommit={(ms) => {
            if (section) {
              onRepositionSectionEdge(id, edge, ms);
              onSectionPreview(null);
            } else {
              onRepositionPin(id, ms);
              onPinPreview(null);
            }
          }}
          onNudge={(deltaMs) => {
            haptic.tap();
            if (section) {
              const current = edge === "start" ? section.startMs : section.endMs;
              onRepositionSectionEdge(id, edge, clampSectionEdge(section, edge, current + deltaMs));
            } else {
              onRepositionPin(id, Math.max(0, Math.min(durationMs, entry.atMs + deltaMs)));
            }
          }}
          onUsePlayhead={() => {
            haptic.tap();
            if (section) {
              onRepositionSectionEdge(id, edge, clampSectionEdge(section, edge, Math.round(playheadMs)));
            } else {
              onRepositionPin(id, Math.round(playheadMs));
            }
          }}
          usePlayheadDisabled={!canUsePlayhead}
          nudgeStepMs={nudgeStepMs}
        />
      </View>
    );
  };

  const marksDrawer = (
    <View style={pd.wrap}>
      {marks.length === 0 ? (
        <Text style={pd.emptyText}>{t("player.noMarks")}</Text>
      ) : (
        marks.map(renderMarkRow)
      )}
      <View style={pd.addRow}>
        <Pressable
          style={({ pressed }) => [pd.inkLink, pressed ? s.toolHeaderPressed : null]}
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t("player.addSection")}
        >
          <Ionicons name="add" size={14} color={colors.primaryDeep} />
          <Text style={pd.inkLinkText}>{t("player.sectionShort")}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [pd.inkLink, pressed ? s.toolHeaderPressed : null]}
          onPress={onAddPin}
          accessibilityRole="button"
          accessibilityLabel={t("player.addPin")}
        >
          <Ionicons name="add" size={14} color={colors.primaryDeep} />
          <Text style={pd.inkLinkText}>{t("player.pinShort")}</Text>
        </Pressable>
        <Text style={pd.addHint}>{t("player.atTime", { time: fmtDuration(playheadMs) })}</Text>
      </View>
    </View>
  );

  // ---------------------------------------------------------------- loop
  const loop = practiceLoopRange;
  const loopSliderMin = loopEdge === "start" ? 0 : Math.min(loop.start + MIN_LOOP_LENGTH_MS, durationMs);
  const loopSliderMax = loopEdge === "start" ? Math.max(0, loop.end - MIN_LOOP_LENGTH_MS) : Math.max(1, durationMs);
  const clampLoopEdge = (ms: number) => Math.max(loopSliderMin, Math.min(loopSliderMax, ms));
  const setLoopEdgeMs = (ms: number) => {
    if (loopEdge === "start") onSetLoopRange(clampLoopEdge(ms), loop.end);
    else onSetLoopRange(loop.start, clampLoopEdge(ms));
  };
  const canLoopUsePlayhead =
    loopEdge === "start" ? playheadMs <= loop.end - MIN_LOOP_LENGTH_MS : playheadMs >= loop.start + MIN_LOOP_LENGTH_MS;

  const loopDrawer = (
    <View style={pd.wrap}>
      <View style={practiceLoopEnabled ? pd.selectedCard : null}>
        <View style={[pd.row, practiceLoopEnabled ? pd.rowInCard : null]}>
          <Text style={pd.rowLabel}>{t("player.loop")}</Text>
          {practiceLoopEnabled ? (
            <Text style={pd.rowValue}>{`${fmtDuration(loop.start)} → ${fmtDuration(loop.end)}`}</Text>
          ) : (
            <Text style={pd.rowValue}>{t("player.off")}</Text>
          )}
          <Pressable
            style={[s.switchShell, practiceLoopEnabled ? s.switchShellActive : null]}
            onPress={onTogglePracticeLoop}
            accessibilityRole="switch"
            accessibilityState={{ checked: practiceLoopEnabled }}
            accessibilityLabel={t("player.toggleLoop")}
          >
            <View style={[s.switchKnob, practiceLoopEnabled ? s.switchKnobActive : null]} />
          </Pressable>
        </View>
        {practiceLoopEnabled ? (
          <MarkInspector
            startMs={loop.start}
            endMs={loop.end}
            edge={loopEdge}
            startLabel={t("player.start")}
            endLabel={t("player.end")}
            onPickEdge={(nextEdge) => {
              setLoopEdge(nextEdge);
              onSeek(nextEdge === "start" ? loop.start : loop.end);
            }}
            minMs={loopSliderMin}
            maxMs={loopSliderMax}
            onSlide={setLoopEdgeMs}
            onSlideCommit={setLoopEdgeMs}
            onNudge={(deltaMs) => {
              haptic.tap();
              setLoopEdgeMs((loopEdge === "start" ? loop.start : loop.end) + deltaMs);
            }}
            onUsePlayhead={() => {
              haptic.tap();
              setLoopEdgeMs(Math.round(playheadMs));
            }}
            usePlayheadDisabled={!canLoopUsePlayhead}
            nudgeStepMs={nudgeStepMs}
          />
        ) : null}
      </View>
      {!practiceLoopEnabled ? <Text style={pd.note}>{t("player.loopHint")}</Text> : null}
      {sections.length > 0 ? (
        <>
          <Text style={pd.subhead}>{t("player.loopAPart")}</Text>
          <View style={pd.partsRow}>
            {sections.map((section) => {
              const active =
                practiceLoopEnabled &&
                Math.abs(loop.start - section.startMs) < 60 &&
                Math.abs(loop.end - section.endMs) < 60;
              return (
                <Pressable
                  key={section.id}
                  style={({ pressed }) => [pd.partInk, pressed ? s.toolHeaderPressed : null]}
                  onPress={() => {
                    haptic.tap();
                    onLoopSection(section);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={t("player.loopSection")}
                >
                  <View style={[pd.partInkBar, { backgroundColor: getSectionColor(section) }]} />
                  <Text style={[pd.partInkText, active ? pd.partInkTextOn : null]}>{section.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
      {/* Step up rides the loop: it only means anything while the loop repeats, so it
          lives here rather than in Sound with the manual speed dial. */}
      <View style={[pd.row, pd.rowDivider]}>
        <View style={pd.stepUpLabelRow}>
          <Text style={pd.rowLabel}>{t("player.stepUp")}</Text>
          <HelpButton compact onPress={() => setStepUpHelpOpen(true)} />
        </View>
        {/* The row states which plan is loaded; the live progression gets its own line
            below, which keeps room here for the controls. A named plan carries its
            speeds in its name, so the range is only spelled out for a custom one. */}
        <View style={pd.stepUpValueRow}>
          <Text style={pd.stepUpPlanName} numberOfLines={1}>
            {stepUpPlanName}
          </Text>
          {stepUpIsCustomPlan ? (
            <Text style={pd.stepUpClimb}>{stepUpClimbLabel(stepUpSequence)}</Text>
          ) : null}
        </View>
        {/* Restarting only means something while a drill is running. */}
        {stepUpEnabled ? (
          <Pressable
            style={pd.headIconBtn}
            onPress={onRestartStepUp}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t("player.stepUpRestart")}
          >
            <Ionicons name="refresh" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
        <Pressable
          style={pd.headIconBtn}
          onPress={() => setStepUpSheetOpen(true)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t("player.stepUpEdit")}
        >
          <Ionicons name="options-outline" size={16} color={colors.textMuted} />
        </Pressable>
        {/* Step up counts loop passes, so it can only run while the loop does — the
            session hook ends one the moment the loop goes off. Disabled rather than
            silently self-cancelling. */}
        <Pressable
          style={[
            s.switchShell,
            stepUpEnabled ? s.switchShellActive : null,
            !practiceLoopEnabled ? pd.stepUpSwitchDisabled : null,
          ]}
          onPress={onToggleStepUp}
          disabled={!practiceLoopEnabled}
          accessibilityRole="switch"
          accessibilityState={{ checked: stepUpEnabled, disabled: !practiceLoopEnabled }}
          accessibilityLabel={t("player.toggleStepUp")}
        >
          <View style={[s.switchKnob, stepUpEnabled ? s.switchKnobActive : null]} />
        </Pressable>
      </View>
      <AnimatedCollapse visible={stepUpEnabled && stepUpProgress != null}>
        {stepUpProgress ? (
          <StepUpProgressLine
            completedLoops={stepUpProgress.completedLoops}
            totalLoops={stepUpProgress.totalLoops}
            passNumber={stepUpProgress.passNumber}
            rate={stepUpProgress.rate}
            atEnd={stepUpProgress.atEnd}
          />
        ) : null}
      </AnimatedCollapse>
      <StepUpSequenceSheet
        visible={stepUpSheetOpen}
        onClose={() => setStepUpSheetOpen(false)}
        sequence={stepUpSequence}
        onChangeSequence={onChangeStepUpSequence}
        rateBounds={{ minRate: stepUpRateMin, maxRate: stepUpRateMax }}
      />
      <HelpSheet
        visible={stepUpHelpOpen}
        onClose={() => setStepUpHelpOpen(false)}
        title={t("player.stepUp")}
        intro={t("player.stepUpHelpIntro")}
        items={[
          {
            icon: "layers-outline",
            label: t("player.stepUpHelpStepsLabel"),
            description: t("player.stepUpHelpStepsBody"),
          },
          {
            icon: "infinite",
            label: t("player.stepUpHelpLoopLabel"),
            description: t("player.stepUpHelpLoopBody"),
          },
          {
            icon: "options-outline",
            label: t("player.stepUpHelpPresetsLabel"),
            description: t("player.stepUpHelpPresetsBody"),
          },
          {
            icon: "speedometer-outline",
            label: t("player.stepUpHelpSpeedLabel"),
            description: t("player.stepUpHelpSpeedBody"),
          },
        ]}
      />
      <View style={[pd.row, pd.rowDivider]}>
        <Text style={pd.rowLabel}>{t("player.countIn")}</Text>
        {clickAvailable ? (
          <View style={pd.inkOptionRow}>
            {(
              [
                { key: "off" as const, label: t("player.off") },
                { key: "1b" as const, label: t("player.bars", { count: 1 }) },
                { key: "2b" as const, label: t("player.bars", { count: 2 }) },
              ]
            ).map((option) => {
              const active = countInOption === option.key;
              return (
                <Pressable
                  key={option.key}
                  style={({ pressed }) => [pd.inkOption, pressed ? s.toolHeaderPressed : null]}
                  onPress={() => {
                    haptic.tap();
                    onSelectCountIn(option.key);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${t("player.countIn")}: ${option.label}`}
                >
                  {active ? <View style={pd.inkOptionDot} /> : null}
                  <Text style={[pd.inkOptionText, active ? pd.inkOptionTextOn : null]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={pd.rowValue}>{t("player.clickUnavailable")}</Text>
        )}
      </View>
    </View>
  );

  // ---------------------------------------------------------------- sound
  const speedIsPreset = (preset: number) => Math.abs(playbackSpeed - preset) < 0.01;
  const detectedLabel = hasAnalysisResult(analysis) ? formatBpmLabel(analysis) : null;

  const soundDrawer = (
    <View style={pd.wrap}>
      <View style={pd.dialHead}>
        <Text style={pd.rowLabel}>{t("player.speed")}</Text>
        <Text style={pd.dialValue}>{`${Math.round(playbackSpeed * 100) / 100}×`}</Text>
      </View>
      <Slider
        style={pd.soundSlider}
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
      <View style={pd.tickLabelRow}>
        {speedPresets.map((preset) => (
          <Pressable
            key={preset}
            onPress={() => {
              haptic.tap();
              onSpeedTap(preset);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${preset}×`}
          >
            <Text style={[pd.tickLabel, speedIsPreset(preset) ? pd.tickLabelOn : null]}>{`${preset}`}</Text>
          </Pressable>
        ))}
      </View>

      <View style={pd.dialHead}>
        <Text style={pd.rowLabel}>{t("player.pitch")}</Text>
        <Text style={pd.dialValue}>
          {supportsPitchShift ? `${pitchShiftSemitones > 0 ? "+" : ""}${pitchShiftSemitones}` : "—"}
          {supportsPitchShift ? <Text style={pd.dialUnit}> {t("player.semitones")}</Text> : null}
        </Text>
      </View>
      <View style={[pd.pitchRow, ltrRow]}>
        <Pressable
          style={[pd.nudgeBtn, !canDecreasePitch ? { opacity: 0.4 } : null]}
          onPress={() => canDecreasePitch && onAdjustPitchShift(pitchShiftSemitones - 1)}
          disabled={!canDecreasePitch}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t("player.lowerPitch")}
        >
          <Ionicons name="remove" size={16} color={canDecreasePitch ? colors.textStrong : colors.textMuted} />
        </Pressable>
        <View style={pd.pitchRail}>
          {Array.from({ length: PITCH_SHIFT_MAX_SEMITONES - PITCH_SHIFT_MIN_SEMITONES + 1 }, (_, i) => {
            const semitone = PITCH_SHIFT_MIN_SEMITONES + i;
            const isCurrent = supportsPitchShift && semitone === pitchShiftSemitones;
            return (
              <View
                key={semitone}
                style={[
                  pd.pitchTick,
                  semitone === 0 ? pd.pitchTickZero : null,
                  isCurrent ? pd.pitchTickOn : null,
                ]}
              />
            );
          })}
        </View>
        <Pressable
          style={[pd.nudgeBtn, !canIncreasePitch ? { opacity: 0.4 } : null]}
          onPress={() => canIncreasePitch && onAdjustPitchShift(pitchShiftSemitones + 1)}
          disabled={!canIncreasePitch}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t("player.raisePitch")}
        >
          <Ionicons name="add" size={16} color={canIncreasePitch ? colors.textStrong : colors.textMuted} />
        </Pressable>
        <Pressable
          onPress={() => supportsPitchShift && onAdjustPitchShift(0)}
          disabled={!supportsPitchShift || pitchShiftSemitones === 0}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("player.original")}
        >
          <Text
            style={[
              pd.inkLinkText,
              !supportsPitchShift || pitchShiftSemitones === 0 ? { color: colors.textMuted } : null,
            ]}
          >
            {t("player.original")}
          </Text>
        </Pressable>
      </View>

      {clickAvailable ? (
        <View style={[pd.row, pd.rowDivider]}>
          <Text style={pd.rowLabel}>{t("player.click")}</Text>
          {clickDetail ? <Text style={pd.rowValue}>{clickDetail}</Text> : null}
          <Pressable
            style={[s.switchShell, clickEnabled ? s.switchShellActive : null]}
            onPress={() => onSetClickEnabled(!clickEnabled)}
            accessibilityRole="switch"
            accessibilityState={{ checked: clickEnabled }}
            accessibilityLabel={t("player.click")}
          >
            <View style={[s.switchKnob, clickEnabled ? s.switchKnobActive : null]} />
          </Pressable>
        </View>
      ) : (
        <View style={pd.ghostRow}>
          <Text style={pd.rowLabel}>{t("player.click")}</Text>
          <Text style={pd.rowValue}>
            {detectedLabel
              ? `${detectedLabel}${analysis && analysis.bpm != null && !isTempoSteady(analysis) ? ` · ${t("player.loose")}` : ""}`
              : t("player.noTempoYet")}
          </Text>
          <Pressable
            style={({ pressed }) => [pd.inkLink, pressed ? s.toolHeaderPressed : null]}
            onPress={onDetectAnalysis}
            disabled={isAnalyzing}
            accessibilityRole="button"
            accessibilityLabel={detectedLabel ? t("player.redetect") : t("player.detect")}
          >
            <Ionicons
              name={isAnalyzing ? "sync" : "sparkles-outline"}
              size={13}
              color={colors.primaryDeep}
            />
            <Text style={pd.inkLinkText}>{isAnalyzing ? t("player.analyzing") : t("player.detect")}</Text>
          </Pressable>
        </View>
      )}
      {analysisError ? <Text style={pd.note}>{analysisError}</Text> : null}
      <Text style={pd.note}>{t("player.playbackOnly")}</Text>
    </View>
  );

  // ---------------------------------------------------------------- shell
  return (
    <View style={s.toolList}>
      <SegmentedControl<Drawer>
        options={[
          { key: "marks", label: t("player.marks"), dot: drawerHasState.marks },
          { key: "loop", label: t("player.loop"), dot: drawerHasState.loop },
          { key: "sound", label: t("player.sound"), dot: drawerHasState.sound },
        ]}
        selectedKey={drawer}
        onSelect={(next) => {
          setDrawer(next);
          onSectionPreview(null);
          onPinPreview(null);
        }}
      />
      {drawer === "marks" ? marksDrawer : drawer === "loop" ? loopDrawer : soundDrawer}

      <Pressable
        style={({ pressed }) => [pd.recordLayerRow, pressed ? s.toolHeaderPressed : null]}
        onPress={() => onRecordOverdub(playheadMs)}
        accessibilityRole="button"
        accessibilityLabel={
          playheadMs > 1000
            ? t("player.recordLayerFrom", { time: fmtDuration(playheadMs) })
            : t("player.recordLayerOver")
        }
      >
        <View style={pd.recordLayerDot} />
        <Text style={pd.recordLayerText}>
          {playheadMs > 1000 ? t("player.recordLayerFrom", { time: fmtDuration(playheadMs) }) : t("player.recordLayer")}
        </Text>
      </Pressable>

      <SectionPickerModal
        visible={pickerOpen}
        title={t("player.addSection")}
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
        title={detailModal?.mode === "edit" ? t("player.editSection") : t("player.newSection")}
        confirmLabel={detailModal?.mode === "edit" ? t("common.save") : t("songDetail.add")}
        initialName={detailModal?.mode === "edit" ? detailModal.section.label : ""}
        initialColor={
          detailModal?.mode === "edit" ? getSectionColor(detailModal.section) : colors.sectionCustom
        }
        onConfirm={(custom) => {
          if (detailModal?.mode === "edit") onEditSection(detailModal.section.id, custom);
          else onAddSection("custom", custom);
          setDetailModal(null);
        }}
        onDelete={
          detailModal?.mode === "edit"
            ? () => {
                onDeleteSection(detailModal.section.id);
                setDetailModal(null);
                setSelected(null);
              }
            : undefined
        }
        onClose={() => setDetailModal(null)}
      />
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
                setSelected(null);
              }
            : undefined
        }
        onClose={() => setPinEditModal(null)}
      />
    </View>
  );
}
