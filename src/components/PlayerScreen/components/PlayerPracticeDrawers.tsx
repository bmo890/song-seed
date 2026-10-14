import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Slider } from "../../common/Slider";
import { Ionicons } from "@expo/vector-icons";
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
import { StickyInScroll } from "../../common/StickyInScroll";
import { windowedSliderBounds } from "../../../domain/markSliderWindow";
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
import { useTranslation } from "react-i18next";
import { MARK_NUDGE_BASE_MS, MARK_NUDGE_MIN_MS, MarkInspector, nudgeStepMsForZoom } from "../../common/MarkInspector";
import { Switch } from "../../common/Switch";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { durations } from "../../../design/motion";
import { markGroupPositions, markRowTimeline, sectionPhase } from "../../../domain/markPhase";
import { Press } from "../../common/Press";
import { SpeedPitchDials } from "../../common/SpeedPitchDials";
import { LevelToneStrip } from "../../common/LevelToneStrip";
import { isTonePresetNeutral, type OverdubToneFlag } from "../../../domain/overdub";
import { UndoRedoButtons } from "../../common/useUndoHistory";
import { PIN_ICON } from "../../../design/markIcons";

/**
 * The practice tools as three drawers — Marks / Loop / Sound — replacing the old
 * accordion stack and its absolutely-positioned settings popover (which could park
 * the speed slider off-screen; docs/product-plan/full-player-audit.md A1/A6).
 *
 * Selection replaces per-row controls: one mark at a time is "held", and only it
 * shows the inspector (edge chips, drag slider, zoom-scaled nudges, use-playhead).
 * Tapping a row or an edge chip also CUES the playhead there — deliberate, decided
 * 2026-07-31: no separate cue button. That ruling also kept play controls out of the
 * editor; SUPERSEDED 2026-09-10 by founder request — every row now carries one quiet
 * trailing play glyph (cue + start, through the loop-aware seek), pinned at the row's
 * end so it never moves between the held and unheld states. A newly added mark is
 * held straight away and scrolled into view.
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
  /** Cue the playhead AND start playback there (the row's play glyph). */
  onPlayFrom: (ms: number) => void;
  isPlaying: boolean;
  /** Scroll the enclosing body so `node` is fully visible (a just-added mark). */
  onRevealRow?: (node: View) => void;
  /** Reel zoom multiple — scales the nudge step so carets stay micro-adjust. */
  zoomMultiple: number;
  /** The reel's visible range at the current zoom — the slider spans this. */
  visibleWindowStartMs: number;
  visibleWindowEndMs: number;

  // Marks
  sections: ClipSection[];
  practiceMarkers: PracticeMarker[];
  /** Returns the new section's id (null when the spot was taken). */
  onAddSection: (kind: ClipSectionKind, custom?: SectionCustomInput) => string | null;
  onEditSection: (sectionId: string, edits: { label: string; color: string }) => void;
  onRepositionSectionEdge: (sectionId: string, edge: "start" | "end", ms: number) => void;
  onSectionPreview: (preview: { id: string; startMs?: number; endMs?: number } | null) => void;
  onDeleteSection: (sectionId: string) => void;
  /** Returns the new pin's id, so it can be named on the spot. */
  onAddPin: () => string | null;
  onRepositionPin: (markerId: string, atMs: number) => void;
  onPinPreview: (preview: { id: string; atMs: number } | null) => void;
  onEditPin: (markerId: string, edits: { label: string; note: string }) => void;
  onDeletePin: (markerId: string) => void;
  /** One shared undo history over sections + pins — edits here are quick and
   *  easy to fat-finger, so every change can be stepped back. */
  canUndoMarks: boolean;
  canRedoMarks: boolean;
  onUndoMarks: () => void;
  onRedoMarks: () => void;

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
  /** Playback-click volume (0–100), its own store dial. */
  clickLevel: number;
  onSetClickLevel: (value: number) => void;
  clickAvailable: boolean;
  clickEnabled: boolean;
  onSetClickEnabled: (enabled: boolean) => void;
  /** The click's own haptic switch; hidden (not disabled) where the engine can't buzz. */
  clickHapticAvailable: boolean;
  clickHaptic: boolean;
  onSetClickHaptic: (enabled: boolean) => void;

  // Record a layer
  onRecordOverdub: (playheadMs: number) => void;

  // The take's sound (Sound room, 2026-10-14): its root level and tone, saved on
  // the take as they are set. Null while no clip is loaded.
  sound: { gainDb: number; tonePreset: string } | null;
  /** The knob's value on release — absolute, in dB. */
  onCommitSoundLevel: (gainDb: number) => void;
  onToggleSoundTone: (flag: OverdubToneFlag) => void;
};

/** Pin a row's visual order to LTR regardless of language direction. */

const MIN_LOOP_LENGTH_MS = 1000;

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
}: {
  completedLoops: number;
  totalLoops: number;
  passNumber: number;
  rate: number;
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
        {`${passNumber} / ${totalLoops}`}
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
  onPlayFrom,
  isPlaying,
  onRevealRow,
  zoomMultiple,
  visibleWindowStartMs,
  visibleWindowEndMs,
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
  canUndoMarks,
  canRedoMarks,
  onUndoMarks,
  onRedoMarks,
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
  clickLevel,
  onSetClickLevel,
  clickAvailable,
  clickEnabled,
  onSetClickEnabled,
  clickHapticAvailable,
  clickHaptic,
  onSetClickHaptic,
  onRecordOverdub,
  sound,
  onCommitSoundLevel,
  onToggleSoundTone,
}: PlayerPracticeDrawersProps) {
  const { t } = useTranslation();
  const [drawer, setDrawer] = useState<Drawer>("marks");
  const [selected, setSelected] = useState<SelectedMark>(null);
  // The mark whose play glyph started the current playback — it wears the accent
  // only while the tape rolls; a pause or a cue elsewhere lets it go.
  const [playFromId, setPlayFromId] = useState<string | null>(null);
  useEffect(() => {
    if (!isPlaying) setPlayFromId(null);
  }, [isPlaying]);
  // A just-added mark: held (selected) and, once its card has laid out, revealed.
  const [pendingRevealId, setPendingRevealId] = useState<string | null>(null);
  const pendingRevealNodeRef = useRef<View | null>(null);
  const handlePendingRevealLayout = useCallback(() => {
    const node = pendingRevealNodeRef.current;
    if (node) onRevealRow?.(node);
    setPendingRevealId(null);
  }, [onRevealRow]);
  const holdNewMark = useCallback(
    (mark: NonNullable<SelectedMark>) => {
      setSelected(mark);
      setPendingRevealId(mark.id);
      onSectionPreview(null);
      onPinPreview(null);
    },
    [onPinPreview, onSectionPreview]
  );
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
  // A pin you just dropped opens its name field straight away. Naming was reachable
  // only through the row's overflow, so pins stayed called "Pin" — and an unnamed
  // pin is a mark you have to play back to identify.
  const [namingPinId, setNamingPinId] = useState<string | null>(null);
  const namingPin = namingPinId
    ? (practiceMarkers.find((marker) => marker.id === namingPinId) ?? null)
    : null;

  const customSectionOptions = useMemo(() => getCustomSectionOptions(sections), [sections]);

  const nudgeStepMs = nudgeStepMsForZoom(zoomMultiple, MARK_NUDGE_BASE_MS, MARK_NUDGE_MIN_MS);

  type MarkEntry =
    | { kind: "section"; atMs: number; section: ClipSection }
    | { kind: "pin"; atMs: number; marker: PracticeMarker };
  const marks = useMemo<MarkEntry[]>(() => {
    const entries: MarkEntry[] = [
      ...sections.map((section) => ({ kind: "section" as const, atMs: section.startMs, section })),
      ...practiceMarkers.map((marker) => ({ kind: "pin" as const, atMs: marker.atMs, marker })),
    ];
    // By time; on the same instant a section leads, so a pin dropped exactly on
    // a section's start is listed (and grouped) under it.
    return entries.sort((a, b) => a.atMs - b.atMs || (a.kind === b.kind ? 0 : a.kind === "section" ? -1 : 1));
  }, [sections, practiceMarkers]);
  // Pins inside a section are grouped with it (domain/markPhase).
  const markGroups = useMemo(
    () =>
      markGroupPositions(
        marks.map((entry) =>
          entry.kind === "section"
            ? { kind: "section", id: entry.section.id, startMs: entry.section.startMs, endMs: entry.section.endMs }
            : { kind: "pin", id: entry.marker.id, atMs: entry.atMs }
        )
      ),
    [marks]
  );
  const sectionsById = useMemo(() => new Map(sections.map((section) => [section.id, section])), [sections]);

  // A dot means something is RUNNING, not merely set up: the loop is looping, or
  // a sound setting is bent away from neutral. Step-up can't run without the
  // loop, and count-in is a one-shot arming choice — neither is a live state.
  const drawerHasState = {
    loop: practiceLoopEnabled,
    sound:
      Math.abs(playbackSpeed - 1) > 0.01 ||
      pitchShiftSemitones !== 0 ||
      (clickAvailable && clickEnabled) ||
      (!!sound && (sound.gainDb !== 0 || !isTonePresetNeutral(sound.tonePreset))),
  };

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
    const isPlayingFrom = isPlaying && playFromId === id;
    // Where this mark stands against the playhead: passed marks recede, the one
    // you are in is lit, what is ahead waits. The held row is exempt: it is being
    // edited and wears its own card.
    // A pin inside a section follows its section: lit with it, never faded
    // while it plays. The group shares one wash and a rail in the section's ink.
    const group = markGroups[index] ?? { sectionId: null, role: "lone" as const, last: false };
    const groupSection = group.sectionId ? sectionsById.get(group.sectionId) ?? null : null;
    const groupPhase = groupSection ? sectionPhase(groupSection.startMs, groupSection.endMs, playheadMs) : null;
    const timeline = markRowTimeline(
      isSection
        ? { kind: "section", id, startMs: entry.section.startMs, endMs: entry.section.endMs }
        : { kind: "pin", id, atMs: entry.atMs },
      { role: group.role, sectionPhase: groupPhase },
      playheadMs
    );
    const isPast = timeline.past && !isSelected;
    const isNow = timeline.lit && !isSelected;
    const isStrong = timeline.strong && !isSelected;
    const inGroup = group.role !== "lone" && groupSection != null;
    const groupLit = inGroup && groupPhase === "now";

    // Cue + start from this mark. Holding the row is part of the gesture, so the
    // inspector and the playhead agree about which mark is "the one".
    const playButton = (
      <Press
        feel="glyph"
        style={pd.headIconBtn}
        // Going to a mark and opening its controls are two separate wishes
        // (founder, 2026-10-13): this glyph only goes there and plays.
        onPress={() => {
          setPlayFromId(id);
          onPlayFrom(entry.atMs);
        }}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t("player.playFrom", { name })}
      >
        <Ionicons
          name="play"
          size={15}
          color={isPlayingFrom ? colors.primaryDeep : colors.textSecondary}
        />
      </Press>
    );

    const row = (
      <Press
        key={`${entry.kind}-${id}-row`}
        style={pd.markRow}
        onPress={() => {
          if (isSelected) {
            setSelected(null);
            onSectionPreview(null);
            onPinPreview(null);
            return;
          }
          // Selecting never moves the playhead: you may have parked it exactly
          // where this mark's edge should go. The play glyph, or a tap on the
          // mark on the reel, is how you go there.
          setSelected(
            isSection ? { kind: "section", id, edge: "start" } : { kind: "pin", id }
          );
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected, expanded: isSelected }}
        accessibilityLabel={`${name}, ${fmtDuration(entry.atMs)}`}
      >
        {/* "You are here": a tonal wash that fades in and out, never a colour. */}
        {isNow ? (
          <Animated.View
            pointerEvents="none"
            entering={FadeIn.duration(durations.base)}
            exiting={FadeOut.duration(durations.base)}
            style={[
              pd.markNowWash,
              // One wash for the whole group: square where its rows meet.
              groupLit && group.role === "head" ? pd.markNowWashHead : null,
              groupLit && group.role === "member" ? (group.last ? pd.markNowWashTail : pd.markNowWashMid) : null,
            ]}
          />
        ) : null}
        {/* The group's rail: the section's own ink down the left of the section
            and every pin inside it. Quiet at rest, full while the section plays. */}
        {inGroup && !isSelected ? (
          <View
            pointerEvents="none"
            style={[
              pd.markGroupRail,
              group.role === "head" ? pd.markGroupRailHead : null,
              group.last ? pd.markGroupRailTail : null,
              { backgroundColor: getSectionColor(groupSection), opacity: groupLit ? 1 : isPast ? 0.2 : 0.4 },
            ]}
          />
        ) : null}
        {/* The play glyph leads the row, as it leads every card in the app. */}
        {playButton}
        <View style={[pd.markGlyph, isPast ? pd.markPastGlyph : null]}>
          {isSection ? (
            <SpanGlyph color={color} />
          ) : (
            <Ionicons name={PIN_ICON} size={14} color={color} />
          )}
        </View>
        {/* A pin's note is the reason it exists — "watch the turnaround" is worth more
            than "Pin 3". It rides under the name, quiet and clipped to one line. */}
        <View style={pd.markNameWrap}>
          <Text
            style={[
              pd.markName,
              isSelected ? pd.markNameSelected : null,
              isStrong ? pd.markNameNow : null,
              isPast ? pd.markNamePast : null,
            ]}
            numberOfLines={1}
          >
            {name}
          </Text>
          {!isSection && entry.marker.note ? (
            <Text style={pd.markNote} numberOfLines={1}>
              {entry.marker.note}
            </Text>
          ) : null}
        </View>
        {/* Trailing seat: the time (unheld) and the overflow (held) trade it. */}
        {isSelected ? (
          <View style={pd.selectedHeadActions}>
            <Press
              feel="glyph"
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
            </Press>
          </View>
        ) : (
          <View style={pd.markTrailing}>
            <Text style={[pd.markTime, isNow ? pd.markTimeNow : null, isPast ? pd.markTimePast : null]}>
              {isSection
                ? `${fmtDuration(entry.section.startMs)}–${fmtDuration(entry.section.endMs)}`
                : fmtDuration(entry.atMs)}
            </Text>
          </View>
        )}
      </Press>
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
    const legalMin = section ? (edge === "start" ? 0 : Math.min(section.startMs + MIN_SECTION_LENGTH_MS, durationMs)) : 0;
    const legalMax = section
      ? edge === "start"
        ? Math.max(0, section.endMs - MIN_SECTION_LENGTH_MS)
        : Math.max(1, durationMs)
      : Math.max(1, durationMs);
    const currentEdgeMs = section ? (edge === "start" ? section.startMs : section.endMs) : entry.atMs;
    const { min: sliderMin, max: sliderMax } = windowedSliderBounds(
      legalMin,
      legalMax,
      currentEdgeMs,
      visibleWindowStartMs,
      visibleWindowEndMs
    );
    const canUsePlayhead = section
      ? edge === "start"
        ? playheadMs <= section.endMs - MIN_SECTION_LENGTH_MS
        : playheadMs >= section.startMs + MIN_SECTION_LENGTH_MS
      : true;

    // One-tap snap to the neighboring section: start edge meets the previous
    // section's end, end edge meets the next section's start — so mapped sections
    // can sit flush without slider fiddling.
    const neighborMs = (() => {
      if (!section) return null;
      if (edge === "start") {
        const prevEnd = sections
          .filter((other) => other.id !== section.id && other.startMs < section.startMs)
          .reduce<number | null>((max, other) => Math.max(max ?? 0, other.endMs), null);
        return prevEnd != null && prevEnd <= section.endMs - MIN_SECTION_LENGTH_MS ? prevEnd : null;
      }
      const nextStart = sections
        .filter((other) => other.id !== section.id && other.startMs > section.startMs)
        .reduce<number | null>(
          (min, other) => (min == null ? other.startMs : Math.min(min, other.startMs)),
          null
        );
      return nextStart != null && nextStart >= section.startMs + MIN_SECTION_LENGTH_MS
        ? nextStart
        : null;
    })();

    const isPendingReveal = pendingRevealId === id;
    return (
      <View
        key={`${entry.kind}-${id}`}
        style={pd.selectedCard}
        ref={isPendingReveal ? pendingRevealNodeRef : undefined}
        onLayout={isPendingReveal ? handlePendingRevealLayout : undefined}
      >
        {row}
        <MarkInspector
          startMs={section ? section.startMs : entry.atMs}
          endMs={section ? section.endMs : null}
          edge={edge}
          startLabel={section ? t("player.start") : t("player.atLabel")}
          endLabel={t("player.end")}
          // Hold a box to type its time; the same rules as a drag apply.
          onTypeTime={(which, ms) => {
            if (section) onRepositionSectionEdge(id, which, clampSectionEdge(section, which, ms));
            else onRepositionPin(id, Math.max(0, Math.min(durationMs, ms)));
          }}
          typeRangeFor={(which) =>
            section
              ? which === "start"
                ? { minMs: 0, maxMs: Math.max(0, section.endMs - MIN_SECTION_LENGTH_MS) }
                : {
                    minMs: Math.min(section.startMs + MIN_SECTION_LENGTH_MS, Math.max(1, durationMs)),
                    maxMs: Math.max(1, durationMs),
                  }
              : { minMs: 0, maxMs: Math.max(0, durationMs) }
          }
          onPickEdge={(nextEdge) => {
            // Choosing which edge the slider and nudges act on; the playhead stays.
            if (section) setSelected({ kind: "section", id, edge: nextEdge });
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
            if (section) {
              const current = edge === "start" ? section.startMs : section.endMs;
              onRepositionSectionEdge(id, edge, clampSectionEdge(section, edge, current + deltaMs));
            } else {
              onRepositionPin(id, Math.max(0, Math.min(durationMs, entry.atMs + deltaMs)));
            }
          }}
          onUsePlayhead={() => {
            if (section) {
              onRepositionSectionEdge(id, edge, clampSectionEdge(section, edge, Math.round(playheadMs)));
            } else {
              onRepositionPin(id, Math.round(playheadMs));
            }
          }}
          usePlayheadDisabled={!canUsePlayhead}
          nudgeStepMs={nudgeStepMs}
          neighborLabel={
            neighborMs != null
              ? edge === "start"
                ? t("player.snapPrevEnd")
                : t("player.snapNextStart")
              : null
          }
          onUseNeighbor={
            neighborMs != null && section
              ? () => {
                  onRepositionSectionEdge(id, edge, clampSectionEdge(section, edge, neighborMs));
                }
              : undefined
          }
        />
      </View>
    );
  };

  const marksDrawer = (
    <View style={pd.wrap}>
      {/* The add row leads the list and pins to the top of the body once the
          list scrolls under it (founder, 2026-10-12): adding a mark, and
          undoing or redoing an edit, must never need a scroll to reach. */}
      <StickyInScroll style={[pd.addRow, pd.addRowLead, pd.addRowSticky]}>
        <Press
          feel="glyph"
          style={pd.inkLink}
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t("player.addSection")}
        >
          <Ionicons name="add" size={14} color={colors.primaryDeep} />
          <Text style={pd.inkLinkText}>{t("player.sectionShort")}</Text>
        </Press>
        <Press
          feel="glyph"
          style={pd.inkLink}
          onPress={() => {
            const id = onAddPin();
            if (!id) return;
            holdNewMark({ kind: "pin", id });
            setNamingPinId(id);
          }}
          accessibilityRole="button"
          accessibilityLabel={t("player.addPin")}
        >
          <Ionicons name="add" size={14} color={colors.primaryDeep} />
          <Text style={pd.inkLinkText}>{t("player.pinShort")}</Text>
        </Press>
        <Text style={pd.addHint}>{t("player.atTime", { time: fmtDuration(playheadMs) })}</Text>
        <View style={pd.undoRedoRow}>
          <UndoRedoButtons
            canUndo={canUndoMarks}
            canRedo={canRedoMarks}
            onUndo={onUndoMarks}
            onRedo={onRedoMarks}
          />
        </View>
      </StickyInScroll>
      {marks.length === 0 ? (
        <Text style={pd.emptyText}>{t("player.noMarks")}</Text>
      ) : (
        marks.map(renderMarkRow)
      )}
    </View>
  );

  // ---------------------------------------------------------------- count-in
  const countInLengths: Exclude<CountInOption, "off">[] = clickAvailable ? ["3s", "1b", "2b"] : ["3s"];
  const countInOn = countInOption !== "off";
  // The length shown while the switch is off is the one it will come on with:
  // the last one used, falling back to seconds when bars are no longer on offer.
  const lastCountInLengthRef = useRef<Exclude<CountInOption, "off">>("3s");
  if (countInOption !== "off") lastCountInLengthRef.current = countInOption;
  const [countInLengthPick, setCountInLengthPick] = useState<Exclude<CountInOption, "off"> | null>(null);
  const preferredLength = countInOn ? countInOption : (countInLengthPick ?? lastCountInLengthRef.current);
  const countInLength = countInLengths.includes(preferredLength as Exclude<CountInOption, "off">)
    ? (preferredLength as Exclude<CountInOption, "off">)
    : "3s";
  const labelForCountIn = (length: Exclude<CountInOption, "off">) =>
    length === "3s"
      ? t("player.countInSeconds", { count: 3 })
      : t("player.bars", { count: length === "1b" ? 1 : 2 });
  const countInLengthLabel = labelForCountIn(countInLength);
  const cycleCountInLength = () => {
    const next = countInLengths[(countInLengths.indexOf(countInLength) + 1) % countInLengths.length];
    setCountInLengthPick(next);
    if (countInOn) onSelectCountIn(next);
  };

  // ---------------------------------------------------------------- loop
  const loop = practiceLoopRange;
  const loopLegalMin = loopEdge === "start" ? 0 : Math.min(loop.start + MIN_LOOP_LENGTH_MS, durationMs);
  const loopLegalMax = loopEdge === "start" ? Math.max(0, loop.end - MIN_LOOP_LENGTH_MS) : Math.max(1, durationMs);
  const { min: loopSliderMin, max: loopSliderMax } = windowedSliderBounds(
    loopLegalMin,
    loopLegalMax,
    loopEdge === "start" ? loop.start : loop.end,
    visibleWindowStartMs,
    visibleWindowEndMs
  );
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
          <Switch
            value={practiceLoopEnabled}
            onValueChange={() => onTogglePracticeLoop()}
            accessibilityLabel={t("player.toggleLoop")}
          />
        </View>
        {practiceLoopEnabled ? (
          <MarkInspector
            startMs={loop.start}
            endMs={loop.end}
            edge={loopEdge}
            startLabel={t("player.start")}
            endLabel={t("player.end")}
            // Typed times answer to the loop's LEGAL span, not the slider's window.
            onTypeTime={(which, ms) => {
              if (which === "start") {
                onSetLoopRange(Math.max(0, Math.min(Math.max(0, loop.end - MIN_LOOP_LENGTH_MS), ms)), loop.end);
              } else {
                onSetLoopRange(
                  loop.start,
                  Math.max(Math.min(loop.start + MIN_LOOP_LENGTH_MS, durationMs), Math.min(Math.max(1, durationMs), ms))
                );
              }
            }}
            typeRangeFor={(which) =>
              which === "start"
                ? { minMs: 0, maxMs: Math.max(0, loop.end - MIN_LOOP_LENGTH_MS) }
                : { minMs: Math.min(loop.start + MIN_LOOP_LENGTH_MS, durationMs), maxMs: Math.max(1, durationMs) }
            }
            onPickEdge={(nextEdge) => setLoopEdge(nextEdge)}
            minMs={loopSliderMin}
            maxMs={loopSliderMax}
            onSlide={setLoopEdgeMs}
            onSlideCommit={setLoopEdgeMs}
            onNudge={(deltaMs) => {
              setLoopEdgeMs((loopEdge === "start" ? loop.start : loop.end) + deltaMs);
            }}
            onUsePlayhead={() => {
              setLoopEdgeMs(Math.round(playheadMs));
            }}
            usePlayheadDisabled={!canLoopUsePlayhead}
            nudgeStepMs={nudgeStepMs}
          />
        ) : null}
      </View>
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
                <Press
                  key={section.id}
                  feel="glyph"
                  style={pd.partInk}
                  onPress={() => {
                    onLoopSection(section);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={t("player.loopSection")}
                >
                  <View style={[pd.partInkBar, { backgroundColor: getSectionColor(section) }]} />
                  <Text style={[pd.partInkText, active ? pd.partInkTextOn : null]}>{section.label}</Text>
                </Press>
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
        {/* The plan's name is not on this row (founder, 2026-10-13): it said
            nothing while the drill was off and crowded the controls. It lives
            in the plan sheet behind the sliders glyph. */}
        <View style={pd.rowSpacer} />
        {/* Restarting only means something while a drill is running. */}
        {stepUpEnabled ? (
          <Press
            feel="glyph"
          style={pd.headIconBtn}
            onPress={onRestartStepUp}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t("player.stepUpRestart")}
          >
            <Ionicons name="refresh" size={16} color={colors.textMuted} />
          </Press>
        ) : null}
        <Press
          feel="glyph"
          style={pd.headIconBtn}
          onPress={() => setStepUpSheetOpen(true)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t("player.stepUpEdit")}
        >
          <Ionicons name="options-outline" size={16} color={colors.textMuted} />
        </Press>
        {/* Step up counts loop passes, so it can only run while the loop does — the
            session hook ends one the moment the loop goes off. Disabled rather than
            silently self-cancelling. */}
        <Switch
          value={stepUpEnabled}
          onValueChange={() => onToggleStepUp()}
          disabled={!practiceLoopEnabled}
          accessibilityLabel={t("player.toggleStepUp")}
        />
      </View>
      <AnimatedCollapse visible={stepUpEnabled && stepUpProgress != null}>
        {stepUpProgress ? (
          <StepUpProgressLine
            completedLoops={stepUpProgress.completedLoops}
            totalLoops={stepUpProgress.totalLoops}
            passNumber={stepUpProgress.passNumber}
            rate={stepUpProgress.rate}
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
        thesis={t("player.stepUpHelpThesis")}
        items={[{ icon: "options-outline", description: t("player.stepUpHelpPlan") }]}
      />
      <View style={[pd.row, pd.rowDivider]}>
        {/* Label, how long, and one switch (founder, 2026-10-13): on or off must
            read at a glance. Seconds are always offered — a run-up of the SONG
            ITSELF needs no grid. Bar counts exist only where a trustworthy click
            does; there the length is a key that steps through the choices. */}
        <View style={pd.countInLabelRow}>
          <Text style={pd.rowLabel}>{t("player.countIn")}</Text>
          {countInLengths.length > 1 ? (
            <Press
              feel="glyph"
              haptic="light"
              style={pd.countInLengthKey}
              onPress={cycleCountInLength}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`${t("player.countIn")}: ${countInLengthLabel}`}
            >
              <Text style={[pd.countInLength, countInOn ? pd.countInLengthOn : null]}>{countInLengthLabel}</Text>
              <Ionicons name="chevron-expand-outline" size={12} color={colors.textMuted} />
            </Press>
          ) : (
            <Text style={[pd.countInLength, countInOn ? pd.countInLengthOn : null]}>{countInLengthLabel}</Text>
          )}
        </View>
        <View style={pd.rowSpacer} />
        <Switch
          value={countInOn}
          onValueChange={(next) => onSelectCountIn(next ? countInLength : "off")}
          accessibilityLabel={t("player.countIn")}
        />
      </View>
    </View>
  );

  // ---------------------------------------------------------------- sound

  const soundDrawer = (
    <View style={pd.wrap}>
      <SpeedPitchDials
        playbackSpeed={playbackSpeed}
        speedPresets={speedPresets}
        speedMin={speedMin}
        speedMax={speedMax}
        onSpeedTap={onSpeedTap}
        onSpeedSlideStart={onSpeedSlideStart}
        onSpeedSliding={onSpeedSliding}
        onSpeedSlideEnd={onSpeedSlideEnd}
        pitchShiftSemitones={pitchShiftSemitones}
        supportsPitchShift={supportsPitchShift}
        onAdjustPitchShift={onAdjustPitchShift}
      />

      {/* Below the hairline: the take's own sound, kept with it. Above it, how you
          practise today. */}
      {sound ? (
        <>
          <View style={pd.soundDivider} />
          <LevelToneStrip
            style={pd.soundStrip}
            gainDb={sound.gainDb}
            tonePreset={sound.tonePreset}
            onCommitGain={onCommitSoundLevel}
            onToggleToneFlag={onToggleSoundTone}
            testID="sound-strip"
          />
        </>
      ) : null}

      {clickAvailable ? (
        <>
          <View style={[pd.row, pd.rowDivider]}>
            <Text style={pd.rowLabel}>{t("player.click")}</Text>
            {clickDetail ? <Text style={pd.rowValue}>{clickDetail}</Text> : null}
            <Switch
              value={clickEnabled}
              onValueChange={onSetClickEnabled}
              accessibilityLabel={t("player.click")}
            />
          </View>
          {/* The click's own volume — it competes with the song, so it has a dial
              here rather than borrowing the standalone metronome's beep level. */}
          {clickEnabled ? (
            <View style={pd.clickVolumeRow}>
              <Ionicons name="volume-low-outline" size={16} color={colors.textMuted} />
              <Slider
                style={pd.clickVolumeSlider}
                minimumValue={0}
                maximumValue={100}
                step={5}
                detent={10}
                value={clickLevel}
                onSlidingComplete={(value) => onSetClickLevel(Math.round(value))}
                accessibilityLabel={t("player.clickVolume")}
              />
              <Ionicons name="volume-high-outline" size={16} color={colors.textMuted} />
            </View>
          ) : null}
          {/* A tap in the hand along with the click — the same quiet row recipe. */}
          {clickEnabled && clickHapticAvailable ? (
            <View style={pd.row}>
              <Text style={pd.rowLabel}>{t("player.clickHaptic")}</Text>
              <Switch
                value={clickHaptic}
                onValueChange={onSetClickHaptic}
                accessibilityLabel={t("player.clickHaptic")}
              />
            </View>
          ) : null}
        </>
      ) : null}
      {/* With no grid on the take there is no Click row at all (founder,
          2026-10-13): tempo detection is not trustworthy yet, so its "Detect
          tempo" door is hidden rather than offered. The detect plumbing
          (onDetectAnalysis, analysis, analysisError) is still passed in and
          comes back with the row. */}
    </View>
  );

  // ---------------------------------------------------------------- shell
  return (
    <View style={s.toolList}>
      {/* Recording a layer left this list (founder, 2026-10-13): a full row above
          the tabs cost the drawers their room. It is the "Layer" key beside
          Tools in the reel's toolbar now. */}
      <SegmentedControl<Drawer>
        options={[
          // The dot means "something is RUNNING in there" — a loop looping, a
          // sound bent away from neutral. Marks merely existing is not a state
          // to signal, so that tab never wears one.
          { key: "marks", label: t("player.marks") },
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

      <SectionPickerModal
        visible={pickerOpen}
        title={t("player.addSection")}
        customOptions={customSectionOptions}
        onPickPreset={(kind) => {
          const id = onAddSection(kind);
          if (id) holdNewMark({ kind: "section", id, edge: "start" });
          setPickerOpen(false);
        }}
        onPickCustom={(custom) => {
          const id = onAddSection("custom", custom);
          if (id) holdNewMark({ kind: "section", id, edge: "start" });
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
          if (detailModal?.mode === "edit") {
            onEditSection(detailModal.section.id, custom);
          } else {
            const id = onAddSection("custom", custom);
            if (id) holdNewMark({ kind: "section", id, edge: "start" });
          }
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
      {/* The same editor, opened by dropping a pin rather than by hunting for it.
          Closing without a name is fine — the pin keeps its time and stays unnamed. */}
      <PinDetailModal
        visible={namingPin != null}
        initialName={namingPin?.label ?? ""}
        initialNote={namingPin?.note ?? ""}
        onConfirm={(edits) => {
          if (namingPin) onEditPin(namingPin.id, edits);
          setNamingPinId(null);
        }}
        onDelete={
          namingPin
            ? () => {
                onDeletePin(namingPin.id);
                setNamingPinId(null);
              }
            : undefined
        }
        onClose={() => setNamingPinId(null)}
      />
    </View>
  );
}
