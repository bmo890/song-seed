import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
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
import { ltrRow, MarkInspector, nudgeStepMsForZoom } from "../../common/MarkInspector";
import { UndoRedoButtons } from "../../common/useUndoHistory";

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

  // Record a layer
  onRecordOverdub: (playheadMs: number) => void;
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
  onRecordOverdub,
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

  const nudgeStepMs = nudgeStepMsForZoom(zoomMultiple);

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

  // A dot means something is RUNNING, not merely set up: the loop is looping, or
  // a sound setting is bent away from neutral. Step-up can't run without the
  // loop, and count-in is a one-shot arming choice — neither is a live state.
  const drawerHasState = {
    loop: practiceLoopEnabled,
    sound:
      Math.abs(playbackSpeed - 1) > 0.01 ||
      pitchShiftSemitones !== 0 ||
      (clickAvailable && clickEnabled),
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
        {/* A pin's note is the reason it exists — "watch the turnaround" is worth more
            than "Pin 3". It rides under the name, quiet and clipped to one line. */}
        <View style={pd.markNameWrap}>
          <Text style={[pd.markName, isSelected ? pd.markNameSelected : null]} numberOfLines={1}>
            {name}
          </Text>
          {!isSection && entry.marker.note ? (
            <Text style={pd.markNote} numberOfLines={1}>
              {entry.marker.note}
            </Text>
          ) : null}
        </View>
        {isSelected ? (
          <View style={pd.selectedHeadActions}>
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
                  haptic.tap();
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
      {/* The add row leads the list rather than trailing it: on a well-marked
          take the tail scrolls behind the transport, and adding a mark (or
          undoing one) must never need a scroll to reach. */}
      <View style={[pd.addRow, pd.addRowLead]}>
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
          onPress={() => setNamingPinId(onAddPin())}
          accessibilityRole="button"
          accessibilityLabel={t("player.addPin")}
        >
          <Ionicons name="add" size={14} color={colors.primaryDeep} />
          <Text style={pd.inkLinkText}>{t("player.pinShort")}</Text>
        </Pressable>
        <Text style={pd.addHint}>{t("player.atTime", { time: fmtDuration(playheadMs) })}</Text>
        <View style={pd.undoRedoRow}>
          <UndoRedoButtons
            canUndo={canUndoMarks}
            canRedo={canRedoMarks}
            onUndo={onUndoMarks}
            onRedo={onRedoMarks}
          />
        </View>
      </View>
      {marks.length === 0 ? (
        <Text style={pd.emptyText}>{t("player.noMarks")}</Text>
      ) : (
        marks.map(renderMarkRow)
      )}
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
        {/* The row states which plan is loaded — just its name. A custom plan's
            actual speeds live in the step-up sheet, not on this line. */}
        <View style={pd.stepUpValueRow}>
          <Text style={pd.stepUpPlanName} numberOfLines={1}>
            {stepUpPlanName}
          </Text>
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
        {/* Seconds are always offered — a run-up of the SONG ITSELF needs no
            grid, and it's the honest count-in for a take that never had one.
            Bar counts only exist where a trustworthy click does. */}
        <View style={pd.inkOptionRow}>
          {(
            [
              { key: "off" as const, label: t("player.off") },
              { key: "3s" as const, label: t("player.countInSeconds", { count: 3 }) },
              ...(clickAvailable
                ? [
                    { key: "1b" as const, label: t("player.bars", { count: 1 }) },
                    { key: "2b" as const, label: t("player.bars", { count: 2 }) },
                  ]
                : []),
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
      </View>
    </View>
  );

  // ---------------------------------------------------------------- sound
  const speedIsPreset = (preset: number) => Math.abs(playbackSpeed - preset) < 0.01;
  const detectedLabel = hasAnalysisResult(analysis) ? formatBpmLabel(analysis) : null;

  const soundDrawer = (
    <View style={pd.wrap}>
      {/* Each dial resets from its own label — the reset lives with the thing it
          resets, and only appears once there is something to undo. */}
      <View style={pd.dialHead}>
        <Text style={pd.rowLabel}>{t("player.speed")}</Text>
        {Math.abs(playbackSpeed - 1) > 0.01 ? (
          <Pressable
            style={({ pressed }) => [pd.dialResetBtn, pressed ? s.toolHeaderPressed : null]}
            onPress={() => {
              haptic.tap();
              onSpeedTap(1);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("player.resetSpeed")}
          >
            <Ionicons name="refresh" size={14} color={colors.primaryDeep} />
          </Pressable>
        ) : null}
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
        {supportsPitchShift && pitchShiftSemitones !== 0 ? (
          <Pressable
            style={({ pressed }) => [pd.dialResetBtn, pressed ? s.toolHeaderPressed : null]}
            onPress={() => {
              haptic.tap();
              onAdjustPitchShift(0);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("player.resetPitch")}
          >
            <Ionicons name="refresh" size={14} color={colors.primaryDeep} />
          </Pressable>
        ) : null}
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
      </View>

      {clickAvailable ? (
        <>
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
                value={clickLevel}
                onSlidingComplete={(value) => {
                  haptic.tap();
                  onSetClickLevel(Math.round(value));
                }}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.surfaceHigh}
                thumbTintColor={colors.primary}
                accessibilityLabel={t("player.clickVolume")}
              />
              <Ionicons name="volume-high-outline" size={16} color={colors.textMuted} />
            </View>
          ) : null}
        </>
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
    </View>
  );

  // ---------------------------------------------------------------- shell
  return (
    <View style={s.toolList}>
      {/* Above the tabs: recording a layer is a constant of the Tools room, not a
          fact of any one drawer, so it never moves when the tabs do. */}
      <Pressable
        style={({ pressed }) => [pd.recordLayerRow, pressed ? s.toolHeaderPressed : null]}
        onPress={() => onRecordOverdub(playheadMs)}
        accessibilityRole="button"
        accessibilityLabel={
          playheadMs > 1000 ? t("player.recordLayerAtPlayhead") : t("player.recordLayerOver")
        }
      >
        <View style={pd.recordLayerDot} />
        {/* Static label on purpose — a ticking mm:ss here made the row feel live
            and urgent; "at playhead" says the same thing without the clock. */}
        <Text style={pd.recordLayerText}>
          {playheadMs > 1000 ? t("player.recordLayerAtPlayhead") : t("player.recordLayer")}
        </Text>
      </Pressable>

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
