import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Spinner } from "../../common/Spinner";
import { LevelToneStrip } from "../../common/LevelToneStrip";
import { Ionicons } from "@expo/vector-icons";
import { StemAlignmentOverlay } from "./StemAlignmentOverlay";
import { WarmModal } from "../../common/WarmModal";
import { BottomSheet } from "../../common/BottomSheet";
import { Button } from "../../common/Button";
import { InkKey, inkKeyColor } from "../../common/InkKey";
import { InkOption } from "../../common/InkOption";
import { Press } from "../../common/Press";
import { HelpButton } from "../../common/HelpButton";
import { looksMachineNamed } from "../../../domain/titleNaming";
import { UserTextInput } from "../../../i18n";
import { AppAlert } from "../../common/AppAlert";
import { SelectionActionSheet } from "../../common/SelectionActionSheet";
import type { SelectionAction } from "../../common/SelectionDock";
import { actionIcons } from "../../common/actionIcons";
import {
  formatClipOverdubStemOffsetLabel,
  OVERDUB_STEM_NUDGE_STEP_LARGE_MS,
  OVERDUB_STEM_NUDGE_STEP_SMALL_MS,
  type OverdubToneFlag,
} from "../../../domain/overdub";
import { snapToGrid } from "../../../domain/gridRuler";
import type { RecordingGrid } from "../../../types";
import { colors, radii, text as textTokens } from "../../../design/tokens";
import { styles as appStyles } from "../../../styles";
import { haptic } from "../../../design/haptics";
import { fmtDuration } from "../../../utils";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { UserText, signedNumberText } from "../../../i18n";

/**
 * A take's layers, behind the lanes (2026-10-22, founder: "the lanes as the list").
 * The lanes under the reel are the one place layers show: each is its name, where it
 * plays, Solo and Mute. This draws nothing of its own until asked: a layer's sheet
 * (play, solo, alignment, timing, level, tone, rename, remove) when a lane is opened,
 * and the merge picker. It has no audio of its own: play and Solo go through the main
 * transport, so there is one player and one playhead (2026-10-22).
 */

/** The Combine chooser — it IS the confirmation: each option spells its outcome.
 *  Shared by the bench and the eight-layer limit. */
export function openCombineChooser(t: TFunction, onChoose: (mode: "copy" | "replace") => void) {
  AppAlert.custom(t("player.combineTitle"), t("player.combineBody"), [
    {
      label: t("player.saveCopy"),
      description: t("player.saveCopyDesc"),
      icon: actionIcons.copy,
      onPress: () => onChoose("copy"),
    },
    {
      label: t("player.replaceTake"),
      description: t("player.replaceTakeDesc"),
      icon: actionIcons.convert,
      style: "destructive",
      onPress: () => onChoose("replace"),
    },
    { label: t("common.cancel"), style: "cancel" },
  ]);
}

export type BenchStemEntry = {
  id: string;
  title: string;
  audioUri: string | null;
  durationMs: number;
  waveformPeaks?: number[];
  gainDb: number;
  offsetMs: number;
  /** Where it was recorded; absent on older layers. */
  recordedOffsetMs?: number;
  isMuted: boolean;
  tonePreset: string;
};

/** What the player drives (the lanes under the reel are the layer list). */
export type LayerSheetHandle = {
  openLayer: (stemId: string) => void;
  startMerge: () => void;
  openCombine: () => void;
};

type Props = {
  stems: BenchStemEntry[];
  rootAudioUri: string | null;
  rootDurationMs: number;
  rootWaveformPeaks?: number[];
  rootRecordingGrid?: RecordingGrid | null;
  isRendering: boolean;
  isMainPlaybackPlaying: boolean;
  /** The layers whose Solo is on; the same switches as the lanes'. */
  soloedLayerIds: readonly string[];
  onToggleSolo: (stemId: string) => void;
  /** Play the song through the main transport from a little before this layer. */
  onPlayLayer: (stemId: string) => Promise<void>;
  onPauseMainPlayback: () => Promise<void>;
  onAdjustStemGain: (stemId: string, deltaDb: number) => void;
  onNudgeStem: (stemId: string, deltaMs: number) => void;
  onRenameStem: (stemId: string, title: string) => void;
  onToggleStemToneFlag: (stemId: string, flag: OverdubToneFlag) => void;
  onRemoveStem: (stemId: string) => void;
  onSaveAsOneClip: (mode: "copy" | "replace") => void;
  /** The layers' help (formerly on the Layers view's bar). */
  onHelp?: () => void;
  /** Mix the picked layers into one named layer. Resolves when it is in place. */
  onMergeStems: (stemIds: string[], title: string) => Promise<void>;
};

function NudgeKey({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [benchStyles.nudgeKey, pressed ? appStyles.pressDown : null]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={benchStyles.nudgeKeyText}>{label}</Text>
    </Pressable>
  );
}

export const PlayerLayersBench = React.forwardRef<LayerSheetHandle, Props>(function PlayerLayersBench(
  {
    stems,
    rootAudioUri,
    rootDurationMs,
    rootWaveformPeaks,
    rootRecordingGrid,
    isRendering,
    isMainPlaybackPlaying,
    soloedLayerIds,
    onToggleSolo,
    onPlayLayer,
    onPauseMainPlayback,
    onAdjustStemGain,
    onNudgeStem,
    onRenameStem,
    onToggleStemToneFlag,
    onRemoveStem,
    onSaveAsOneClip,
    onHelp,
    onMergeStems,
  }: Props,
  ref
) {
  const { t } = useTranslation();
  // Which layer the sheet (and Solo) is about. The lanes are the list now; this is
  // the one the player last asked for.
  const [selectedLaneId, setSelectedLaneId] = useState<string | null>(null);
  const selectedStem = stems.find((stem) => stem.id === selectedLaneId) ?? null;

  const [editModalOpen, setEditModalOpen] = useState(false);
  // One layer's settings, in its own sheet (founder, 2026-10-22: "the controls make
  // it feel too cluttered").
  const [sheetOpen, setSheetOpen] = useState(false);

  const isSoloed = !!selectedStem && soloedLayerIds.includes(selectedStem.id);

  // "Original" is where the layer was recorded (founder, 2026-10-22). Layers saved
  // before that was kept fall back to where it was when this sitting began.
  const baselineRef = useRef<{ stemId: string; offsetMs: number } | null>(null);
  if (selectedStem && baselineRef.current?.stemId !== selectedStem.id) {
    baselineRef.current = { stemId: selectedStem.id, offsetMs: selectedStem.offsetMs };
  }
  const baselineOffsetMs =
    selectedStem?.recordedOffsetMs ?? baselineRef.current?.offsetMs ?? selectedStem?.offsetMs ?? 0;
  const canRestoreOriginal = !!selectedStem && selectedStem.offsetMs !== baselineOffsetMs;

  // Slide-to-move on the micro strip: preview rides the drag; the commit snaps onto the
  // master grid's nearest beat when close (60ms magnet — deliberate placements stay).
  const [slidePreviewMs, setSlidePreviewMs] = useState(0);
  const handleSlide = (deltaMs: number) => setSlidePreviewMs(deltaMs);
  const handleSlideEnd = (deltaMs: number) => {
    setSlidePreviewMs(0);
    if (!selectedStem || Math.abs(deltaMs) < 1) {
      return;
    }
    const targetMs = selectedStem.offsetMs + deltaMs;
    const snappedMs = snapToGrid({
      grid: rootRecordingGrid ?? null,
      ms: targetMs,
      toleranceMs: 60,
      unit: "beat",
    });
    if (snappedMs != null && Math.abs(snappedMs - targetMs) > 1) {
      haptic.tap(); // Vocabulary: tap = detent tick — the layer settled onto a beat line.
    }
    onNudgeStem(selectedStem.id, Math.round(snappedMs ?? targetMs) - selectedStem.offsetMs);
  };

  // Merging (founder, 2026-10-18): pick two or more layers, name the result.
  const [mergePicks, setMergePicks] = useState<string[] | null>(null);
  const [mergeNameOpen, setMergeNameOpen] = useState(false);
  const [merging, setMerging] = useState(false);
  const isPicking = mergePicks !== null;
  const togglePick = (stemId: string) =>
    setMergePicks((current) =>
      current ? (current.includes(stemId) ? current.filter((id) => id !== stemId) : [...current, stemId]) : current
    );
  const orderedPicks = mergePicks ? stems.filter((stem) => mergePicks.includes(stem.id)) : [];
  async function runMerge(title: string) {
    if (!mergePicks || mergePicks.length < 2) return;
    setMerging(true);
    try {
      await onMergeStems(orderedPicks.map((stem) => stem.id), title);
      setMergePicks(null);
    } finally {
      setMerging(false);
    }
  }

  function openLane(laneId: string) {
    if (laneId !== selectedLaneId) setSelectedLaneId(laneId);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
  }

  // An item's "…" is the action menu, never a centred dialog; removing asks first.
  // It opens from inside the layer's sheet, so it is drawn there (the app's root
  // menu host cannot present over a sheet on iOS).
  const [menuOpen, setMenuOpen] = useState(false);
  function layerMenuActions(stem: BenchStemEntry): SelectionAction[] {
    return [
      {
        key: "player.renameLayer",
        label: t("player.renameLayer"),
        icon: actionIcons.edit,
        onPress: () => setEditModalOpen(true),
      },
      {
        key: "player.removeLayer",
        label: t("player.removeLayer"),
        icon: actionIcons.delete,
        tone: "danger",
        onPress: () =>
          AppAlert.destructive(
            t("player.removeLayerTitle", { title: stem.title }),
            t("player.removeLayerBody"),
            () => {
              setSheetOpen(false);
              onRemoveStem(stem.id);
            },
            { confirmLabel: t("player.removeLayer") }
          ),
      },
    ];
  }

  function openSaveAsOneClip() {
    openCombineChooser(t, (mode) => onSaveAsOneClip(mode));
  }

  React.useImperativeHandle(ref, () => ({
    openLayer: openLane,
    startMerge: () => {
      setSheetOpen(false);
      setMergePicks(selectedStem ? [selectedStem.id] : []);
    },
    openCombine: openSaveAsOneClip,
  }));

  const stemTools = selectedStem ? (
    <View style={benchStyles.tools}>
      {/* The alignment strip: this layer against the take; slide it to move it. */}
      <StemAlignmentOverlay
        headerLeading={
          <View style={benchStyles.playKeys}>
            <InkKey
              // Haptics vocabulary: `tap` — a control toggles.
              haptic="tap"
              tone={isMainPlaybackPlaying ? "active" : "idle"}
              label={isMainPlaybackPlaying ? t("common.pause") : t("common.play")}
              glyph={
                <Ionicons
                  name={isMainPlaybackPlaying ? "pause" : "play"}
                  size={14}
                  color={inkKeyColor(isMainPlaybackPlaying ? "active" : "idle")}
                />
              }
              onPress={() =>
                void (isMainPlaybackPlaying ? onPauseMainPlayback() : onPlayLayer(selectedStem.id)).catch(() => {})
              }
              accessibilityLabel={isMainPlaybackPlaying ? t("common.pause") : t("player.playLayerA11y")}
            />
            {/* The lane's Solo switch, drawn as a key beside Play (a toggle beside other
                controls is an InkKey): the same set, on in both places at once. */}
            <InkKey
              // Haptics vocabulary: `tap` — a control toggles.
              haptic="tap"
              tone={isSoloed ? "active" : "idle"}
              label={t("player.solo")}
              glyph={
                <Ionicons
                  name={isSoloed ? "ellipse" : "ellipse-outline"}
                  size={10}
                  color={inkKeyColor(isSoloed ? "active" : "idle")}
                />
              }
              onPress={() => onToggleSolo(selectedStem.id)}
              accessibilityLabel={t("player.soloLayer", { title: selectedStem.title })}
            />
          </View>
        }
        masterAudioUri={rootAudioUri}
        masterDurationMs={rootDurationMs}
        masterFallbackPeaks={rootWaveformPeaks}
        stemAudioUri={selectedStem.audioUri}
        stemDurationMs={selectedStem.durationMs}
        stemFallbackPeaks={selectedStem.waveformPeaks}
        offsetMs={selectedStem.offsetMs + slidePreviewMs}
        stemColor={colors.primary}
        recordingGrid={rootRecordingGrid}
        onSlide={handleSlide}
        onSlideEnd={handleSlideEnd}
      />
      {/* The strip holds still (no second playhead): it is for placing the layer. */}
      <Text style={benchStyles.dragHint}>{t("player.dragToMove")}</Text>
      <View style={benchStyles.labelRow}>
        <Text style={benchStyles.toolLabel}>{t("player.timing")}</Text>
        {/* Relative to where it was recorded (the measured place): a fresh layer reads
            "In place", not the correction the app made for the phone's latency. */}
        <Text style={benchStyles.toolValue}>
          {formatClipOverdubStemOffsetLabel(
            selectedStem.recordedOffsetMs != null
              ? selectedStem.offsetMs - selectedStem.recordedOffsetMs
              : selectedStem.offsetMs
          )}
        </Text>
      </View>
      <View style={benchStyles.nudgeRow}>
        <NudgeKey
          label={t("player.nudgeMs", { value: signedNumberText(`−${OVERDUB_STEM_NUDGE_STEP_LARGE_MS}`) })}
          onPress={() => onNudgeStem(selectedStem.id, -OVERDUB_STEM_NUDGE_STEP_LARGE_MS)}
        />
        <NudgeKey
          label={t("player.nudgeMs", { value: signedNumberText(`−${OVERDUB_STEM_NUDGE_STEP_SMALL_MS}`) })}
          onPress={() => onNudgeStem(selectedStem.id, -OVERDUB_STEM_NUDGE_STEP_SMALL_MS)}
        />
        <NudgeKey
          label={t("player.nudgeMs", { value: signedNumberText(`+${OVERDUB_STEM_NUDGE_STEP_SMALL_MS}`) })}
          onPress={() => onNudgeStem(selectedStem.id, OVERDUB_STEM_NUDGE_STEP_SMALL_MS)}
        />
        <NudgeKey
          label={t("player.nudgeMs", { value: signedNumberText(`+${OVERDUB_STEM_NUDGE_STEP_LARGE_MS}`) })}
          onPress={() => onNudgeStem(selectedStem.id, OVERDUB_STEM_NUDGE_STEP_LARGE_MS)}
        />
        <Pressable
          style={({ pressed }) => [
            benchStyles.originalButton,
            !canRestoreOriginal ? benchStyles.originalButtonDisabled : null,
            pressed ? appStyles.pressDown : null,
          ]}
          onPress={() => {
            if (canRestoreOriginal && selectedStem) {
              haptic.tap(); // Vocabulary: tap = an acknowledged press.
              onNudgeStem(selectedStem.id, baselineOffsetMs - selectedStem.offsetMs);
            }
          }}
          disabled={!canRestoreOriginal}
          accessibilityRole="button"
          accessibilityLabel={t("player.restoreAlignment")}
        >
          <Ionicons name="refresh-outline" size={12} color={colors.textSecondary} />
          <Text style={benchStyles.originalButtonText}>{t("player.original")}</Text>
        </Pressable>
      </View>

      <LevelToneStrip
        style={benchStyles.strip}
        gainDb={selectedStem.gainDb}
        tonePreset={selectedStem.tonePreset}
        onCommitGain={(db) => onAdjustStemGain(selectedStem.id, db - selectedStem.gainDb)}
        onToggleToneFlag={(flag) => onToggleStemToneFlag(selectedStem.id, flag)}
      />
    </View>
  ) : null;

  return (
    <>
      <BottomSheet visible={sheetOpen && !!selectedStem} onClose={closeSheet}>
        {selectedStem ? (
          <>
            <View style={benchStyles.sheetHead}>
              <View style={benchStyles.sheetTitleBlock}>
                <UserText
                  value={selectedStem.title}
                  style={
                    !looksMachineNamed(selectedStem.title)
                      ? benchStyles.sheetTitleTyped
                      : benchStyles.sheetTitleMachine
                  }
                  numberOfLines={1}
                >
                  {selectedStem.title}
                </UserText>
                <Text style={benchStyles.meta}>
                  {`${fmtDuration(Math.max(0, selectedStem.offsetMs))} – ${fmtDuration(Math.max(0, selectedStem.offsetMs + selectedStem.durationMs))}`}
                </Text>
              </View>
              {isRendering ? (
                <Spinner size="small" color={colors.primaryDeep} accessibilityLabel={t("player.updatingMix")} />
              ) : null}
              {onHelp ? <HelpButton compact onPress={onHelp} /> : null}
              <Press
                feel="glyph"
                // Haptics: none — it opens a menu, which settles with its own.
                haptic="none"
                style={benchStyles.menuButton}
                onPress={() => setMenuOpen(true)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={t("player.layerOptions")}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
              </Press>
            </View>
            {stemTools}
            {/* The menu and Rename open from this sheet, so they are presented from
                inside it (iOS cannot stack a second Modal from the root). */}
            <SelectionActionSheet
              visible={menuOpen}
              title={selectedStem.title}
              actions={layerMenuActions(selectedStem)}
              onClose={() => setMenuOpen(false)}
            />
            <RenameLayerModal
              visible={editModalOpen}
              title={selectedStem.title}
              onSave={(nextTitle) => {
                if (nextTitle !== selectedStem.title) {
                  onRenameStem(selectedStem.id, nextTitle);
                }
              }}
              onClose={() => setEditModalOpen(false)}
            />
          </>
        ) : null}
      </BottomSheet>

      {/* Merge (founder, 2026-10-18): pick two or more layers, then name the result. */}
      <BottomSheet visible={isPicking} onClose={() => (merging ? undefined : setMergePicks(null))}>
        <Text style={appStyles.selectionSheetTitle}>{t("player.mergeLayers")}</Text>
        <Text style={benchStyles.pickHint}>{t("player.mergePick")}</Text>
        <View style={benchStyles.pickList}>
          {stems.map((stem) => (
            <InkOption
              key={stem.id}
              label={stem.title}
              selected={!!mergePicks?.includes(stem.id)}
              onPress={() => togglePick(stem.id)}
              accessibilityLabel={t("player.pickLayer", { title: stem.title })}
            />
          ))}
        </View>
        <View style={benchStyles.editModalActions}>
          <Button variant="secondary" label={t("common.cancel")} onPress={() => setMergePicks(null)} disabled={merging} />
          <Button
            variant="primary"
            label={merging ? t("player.merging") : t("player.mergeCount", { count: orderedPicks.length })}
            disabled={orderedPicks.length < 2 || merging}
            onPress={() => setMergeNameOpen(true)}
          />
        </View>
        <RenameLayerModal
          visible={mergeNameOpen}
          heading={t("player.mergeName")}
          title={orderedPicks[0]?.title ?? ""}
          onSave={(name) => void runMerge(name)}
          onClose={() => setMergeNameOpen(false)}
        />
      </BottomSheet>
    </>
  );
});

/** Rename a layer. Draft state resets from props each time the sheet opens. */
function RenameLayerModal({
  visible,
  heading,
  title,
  onSave,
  onClose,
}: {
  visible: boolean;
  heading?: string;
  title: string;
  onSave: (title: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [draftTitle, setDraftTitle] = useState(title);
  const prevVisible = useRef(false);
  useEffect(() => {
    if (visible && !prevVisible.current) {
      setDraftTitle(title);
    }
    prevVisible.current = visible;
  }, [visible, title]);
  const trimmed = draftTitle.trim();

  return (
    <WarmModal visible={visible} onRequestClose={onClose} title={heading ?? t("player.renameLayer")}>
      <UserTextInput
        style={benchStyles.editNameInput}
        value={draftTitle}
        onChangeText={setDraftTitle}
        placeholder={t("player.layerName")}
        placeholderTextColor={colors.textMuted}
        returnKeyType="done"
        autoFocus
      />
      <View style={benchStyles.editModalActions}>
        <Button variant="secondary" label={t("common.cancel")} onPress={onClose} />
        <Button
          variant="primary"
          label={t("common.save")}
          disabled={!trimmed}
          onPress={() => {
            if (!trimmed) return;
            onSave(trimmed);
            onClose();
          }}
        />
      </View>
    </WarmModal>
  );
}

const benchStyles = StyleSheet.create({
  pickHint: {
    ...textTokens.supporting,
    marginTop: 2,
  },
  pickList: {
    paddingVertical: 10,
    gap: 4,
  },
  meta: {
    ...textTokens.caption,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  menuButton: {
    width: 28,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  tools: {
    gap: 10,
  },
  // Play, then Solo: left to right in every language, like the strip they sit over.
  playKeys: {
    direction: "ltr",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  sheetTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sheetTitleTyped: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 20,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  sheetTitleMachine: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 17,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  toolLabel: {
    ...textTokens.supporting,
  },
  toolValue: {
    ...textTokens.supporting,
    color: colors.textStrong,
    fontVariant: ["tabular-nums"],
  },
  dragHint: {
    ...textTokens.caption,
    color: colors.textMuted,
    marginTop: -4,
  },
  // The strip sits flush with the bench's rows: no inset of its own.
  strip: {
    paddingHorizontal: 0,
  },
  // Earlier on the left, later on the right, then Original: a time axis, left to
  // right in every language like the strip above it.
  nudgeRow: {
    direction: "ltr",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  // Quiet ink, not chips: nudges are tapped rhythmically — text invites that, fills don't.
  nudgeKey: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  nudgeKeyText: {
    fontSize: 13,
    lineHeight: 16,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textStrong,
    fontVariant: ["tabular-nums"],
  },
  originalButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  originalButtonDisabled: {
    opacity: 0.4,
  },
  originalButtonText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textSecondary,
  },
  editNameInput: {
    fontSize: 16,
    fontFamily: "PlusJakartaSans_500Medium",
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  editModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
});
