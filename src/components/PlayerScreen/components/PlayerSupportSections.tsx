import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import type { LyricsLine, RecordingGrid } from "../../../types";
import { PlayerLyricsPanel } from "../PlayerLyricsPanel";
import { PlayerQueue } from "../PlayerQueue";
import { BottomSheet } from "../../common/BottomSheet";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { formatDate } from "../../../utils";
import { activateAndPlay, replacePlaybackSource } from "../../../services/transportPlayback";
import { OVERDUB_GAIN_STEP_DB } from "../../../overdub";
import { playerScreenStyles } from "../styles";
import { AppAlert } from "../../common/AppAlert";
import { actionIcons } from "../../common/actionIcons";
import { LayerControlButton, OverdubLayerCard, type OverdubLayerSection } from "./OverdubLayerCard";
import { useOverdubAlignmentAudition } from "../hooks/useOverdubAlignmentAudition";

type QueueEntry = {
  ideaId: string;
  clipId: string;
  title: string;
  subtitle: string;
};

type OverdubStemEntry = {
  id: string;
  title: string;
  meta: string;
  audioUri: string | null;
  durationMs: number;
  waveformPeaks?: number[];
  gainDb: number;
  offsetMs: number;
  isMuted: boolean;
  tonePreset: string;
  color: string;
};

type PlayerSupportSectionsProps = {
  hasProjectLyrics: boolean;
  latestLyricsText: string;
  lyricsChordLines?: LyricsLine[];
  lyricsVersionCount: number;
  latestLyricsUpdatedAt: number | null;
  lyricsExpanded: boolean;
  hasClipOverdubs: boolean;
  clipOverdubStemCount: number;
  isOverdubPreviewRendering: boolean;
  isMainPlaybackPlaying: boolean;
  overdubRootSettings: { gainDb: number; tonePreset: string } | null;
  overdubStemEntries: OverdubStemEntry[];
  /** The root take the stems are mixed against (its audio is the mix's t=0 reference). */
  overdubRootAudioUri: string | null;
  overdubRootDurationMs: number;
  overdubRootWaveformPeaks?: number[];
  overdubRootRecordingGrid?: RecordingGrid | null;
  onAddOverdub: () => void;
  onSaveAsOneClip: (mode: "copy" | "replace") => void;
  onPauseMainPlayback: () => Promise<void>;
  onAdjustRootGain: (deltaDb: number) => void;
  onToggleRootLowCut: () => void;
  onAdjustStemGain: (stemId: string, deltaDb: number) => void;
  onNudgeStem: (stemId: string, deltaMs: number) => void;
  onRenameStem: (stemId: string, title: string) => void;
  onChangeStemColor: (stemId: string, color: string) => void;
  onToggleStemMute: (stemId: string) => void;
  onToggleStemLowCut: (stemId: string) => void;
  onRemoveStem: (stemId: string) => void;
  clipNotes: string;
  clipNotesSummary: string;
  notesExpanded: boolean;
  queueEntries: QueueEntry[];
  currentClipId: string;
  queueExpanded: boolean;
  onToggleLyricsExpanded: (value: boolean) => void;
  onToggleNotesExpanded: (value: boolean) => void;
  onToggleQueueExpanded: (value: boolean) => void;
  onSelectQueueEntry: (index: number) => void;
};

/** A quiet pill in the utility row beneath the lyrics. Carries an optional
 * count badge (Layers/Queue) or a terracotta presence dot (Notes). */
const UtilityChip = React.memo(function UtilityChip({
  icon,
  label,
  count,
  dot,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  count?: number;
  dot?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [chipStyles.chip, pressed ? appStyles.pressDown : null]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={chipStyles.chipLabel}>{label}</Text>
      {count != null ? (
        <View style={chipStyles.chipCount}>
          <Text style={chipStyles.chipCountText}>{count}</Text>
        </View>
      ) : null}
      {dot ? <View style={chipStyles.chipDot} /> : null}
    </Pressable>
  );
});

export function PlayerSupportSections({
  hasProjectLyrics,
  latestLyricsText,
  lyricsChordLines,
  lyricsVersionCount,
  latestLyricsUpdatedAt,
  lyricsExpanded,
  hasClipOverdubs,
  clipOverdubStemCount,
  isOverdubPreviewRendering,
  isMainPlaybackPlaying,
  overdubRootSettings,
  overdubStemEntries,
  overdubRootAudioUri,
  overdubRootDurationMs,
  overdubRootWaveformPeaks,
  overdubRootRecordingGrid,
  onAddOverdub,
  onSaveAsOneClip,
  onPauseMainPlayback,
  onAdjustRootGain,
  onToggleRootLowCut,
  onAdjustStemGain,
  onNudgeStem,
  onRenameStem,
  onChangeStemColor,
  onToggleStemMute,
  onToggleStemLowCut,
  onRemoveStem,
  clipNotes,
  notesExpanded,
  queueEntries,
  currentClipId,
  queueExpanded,
  onToggleLyricsExpanded,
  onToggleNotesExpanded,
  onToggleQueueExpanded,
  onSelectQueueEntry,
}: PlayerSupportSectionsProps) {
  const layerPreviewPlayer = useAudioPlayer(null, { updateInterval: 120 });
  const layerPreviewStatus = useAudioPlayerStatus(layerPreviewPlayer);
  const [activeLayerPreviewId, setActiveLayerPreviewId] = useState<string | null>(null);
  const [layersSheetOpen, setLayersSheetOpen] = useState(false);
  // Progressive disclosure: one section open at a time across the whole sheet (accordion),
  // so the layer list stays scannable instead of every control being permanently expanded.
  const [rootMixExpanded, setRootMixExpanded] = useState(false);
  const [expandedStemSection, setExpandedStemSection] = useState<{
    stemId: string;
    section: OverdubLayerSection;
  } | null>(null);
  // The offset a layer had when its Align section was opened — the "Original" revert
  // target. Captured on open so a sitting's nudges can be undone without discarding a
  // previously-saved alignment. One at a time (accordion), so a single slot suffices.
  const alignBaselineRef = React.useRef<{ stemId: string; offsetMs: number } | null>(null);

  // In-place master+layer audition for the Align section — the nudge feedback loop.
  const audition = useOverdubAlignmentAudition();
  const auditioningStem =
    overdubStemEntries.find((stem) => stem.id === audition.auditioningStemId) ?? null;
  const lastAuditionOffsetRef = React.useRef<number | null>(null);
  const auditionRestartTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeLayerPreviewDurationMs = Math.round((layerPreviewStatus.duration ?? 0) * 1000);
  const activeLayerPreviewPositionMs = Math.round((layerPreviewStatus.currentTime ?? 0) * 1000);

  const pauseLayerPreviewSafely = React.useCallback(() => {
    try {
      const result = layerPreviewPlayer.pause();
      void Promise.resolve(result).catch(() => {});
    } catch {
      // Ignore teardown noise from stale native player handles during unmount/handoff.
    }
  }, [layerPreviewPlayer]);

  useEffect(() => {
    if (layerPreviewStatus.didJustFinish) {
      setActiveLayerPreviewId(null);
    }
  }, [layerPreviewStatus.didJustFinish]);

  useEffect(() => {
    if (!isMainPlaybackPlaying || !activeLayerPreviewId) return;
    pauseLayerPreviewSafely();
    setActiveLayerPreviewId(null);
  }, [activeLayerPreviewId, isMainPlaybackPlaying, pauseLayerPreviewSafely]);

  // Main playback wins over the alignment audition too — never two transports at once.
  useEffect(() => {
    if (isMainPlaybackPlaying && audition.auditioningStemId) {
      audition.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audition.auditioningStemId, isMainPlaybackPlaying]);

  // Hearing a nudge is the point: while auditioning, an offset change restarts playback
  // at the new offset after a short settle, so successive nudge taps coalesce into one
  // restart and each landing is audible within ~a third of a second.
  useEffect(() => {
    if (!auditioningStem || !auditioningStem.audioUri || !overdubRootAudioUri) {
      return;
    }
    if (lastAuditionOffsetRef.current === auditioningStem.offsetMs) {
      return;
    }
    if (auditionRestartTimerRef.current) {
      clearTimeout(auditionRestartTimerRef.current);
    }
    const target = {
      stemId: auditioningStem.id,
      masterAudioUri: overdubRootAudioUri,
      stemAudioUri: auditioningStem.audioUri,
      offsetMs: auditioningStem.offsetMs,
      stemGainDb: auditioningStem.gainDb,
    };
    auditionRestartTimerRef.current = setTimeout(() => {
      auditionRestartTimerRef.current = null;
      lastAuditionOffsetRef.current = target.offsetMs;
      void audition.start(target).catch(() => {
        audition.stop();
      });
    }, 350);

    return () => {
      if (auditionRestartTimerRef.current) {
        clearTimeout(auditionRestartTimerRef.current);
        auditionRestartTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditioningStem?.id, auditioningStem?.offsetMs, overdubRootAudioUri]);

  useEffect(() => {
    return () => {
      pauseLayerPreviewSafely();
    };
  }, [pauseLayerPreviewSafely]);

  const previewSources = useMemo(
    () =>
      overdubStemEntries.map((stem) => ({
        id: stem.id,
        audioUri: stem.audioUri,
        durationMs: stem.durationMs,
      })),
    [overdubStemEntries]
  );

  useEffect(() => {
    if (!activeLayerPreviewId) return;
    const activeSourceStillExists = previewSources.some(
      (entry) => entry.id === activeLayerPreviewId && !!entry.audioUri
    );
    if (activeSourceStillExists) return;

    pauseLayerPreviewSafely();
    setActiveLayerPreviewId(null);
  }, [activeLayerPreviewId, pauseLayerPreviewSafely, previewSources]);

  const activeLayerDurationMs =
    previewSources.find((entry) => entry.id === activeLayerPreviewId)?.durationMs ??
    activeLayerPreviewDurationMs;

  async function toggleLayerPreview(id: string, audioUri: string | null) {
    if (!audioUri) return;

    try {
      if (activeLayerPreviewId === id && layerPreviewStatus.playing) {
        await layerPreviewPlayer.pause();
        return;
      }

      audition.stop();
      await onPauseMainPlayback();

      if (activeLayerPreviewId === id) {
        await activateAndPlay(
          layerPreviewPlayer,
          layerPreviewStatus,
          activeLayerDurationMs,
          activeLayerPreviewPositionMs
        );
        return;
      }

      await replacePlaybackSource(layerPreviewPlayer, audioUri, false);
      setActiveLayerPreviewId(id);
      await activateAndPlay(layerPreviewPlayer, { duration: 0, currentTime: 0 });
    } catch (error) {
      pauseLayerPreviewSafely();
      setActiveLayerPreviewId(null);
      const message = error instanceof Error ? error.message : "Could not play this layer.";
      console.warn("Layer preview failed", error);
      AppAlert.info("Layer preview failed", message);
    }
  }

  function getLayerProgressRatio(id: string) {
    if (activeLayerPreviewId !== id || !activeLayerDurationMs) return 0;
    return activeLayerPreviewPositionMs / activeLayerDurationMs;
  }

  function removeStemSafely(stemId: string) {
    if (activeLayerPreviewId === stemId) {
      pauseLayerPreviewSafely();
      setActiveLayerPreviewId(null);
    }
    if (audition.auditioningStemId === stemId) {
      audition.stop();
    }
    if (expandedStemSection?.stemId === stemId) {
      setExpandedStemSection(null);
    }
    onRemoveStem(stemId);
  }

  function toggleStemSection(stemId: string, section: OverdubLayerSection) {
    const isClosing =
      expandedStemSection?.stemId === stemId && expandedStemSection.section === section;
    // Collapsing (or switching away from) an Align section ends its audition — the
    // controls it belongs to are gone.
    if (audition.auditioningStemId && (isClosing || audition.auditioningStemId !== stemId)) {
      audition.stop();
    }
    setExpandedStemSection(isClosing ? null : { stemId, section });
    if (!isClosing) {
      setRootMixExpanded(false);
      // Snapshot the alignment baseline the moment Align opens, so "Original" reverts to
      // where this layer sat before the user started nudging in this sitting.
      if (section === "align") {
        const stem = overdubStemEntries.find((candidate) => candidate.id === stemId);
        alignBaselineRef.current = { stemId, offsetMs: stem?.offsetMs ?? 0 };
      }
    }
  }

  function toggleStemAudition(stem: (typeof overdubStemEntries)[number]) {
    if (audition.auditioningStemId === stem.id) {
      audition.stop();
      return;
    }
    if (!stem.audioUri || !overdubRootAudioUri) {
      return;
    }
    pauseLayerPreviewSafely();
    setActiveLayerPreviewId(null);
    lastAuditionOffsetRef.current = stem.offsetMs;
    void onPauseMainPlayback().catch(() => {});
    void audition
      .start({
        stemId: stem.id,
        masterAudioUri: overdubRootAudioUri,
        stemAudioUri: stem.audioUri,
        offsetMs: stem.offsetMs,
        stemGainDb: stem.gainDb,
      })
      .catch((error) => {
        console.warn("Alignment audition failed", error);
        audition.stop();
      });
  }

  function closeLayersSheet() {
    audition.stop();
    setLayersSheetOpen(false);
  }

  // "Save as one clip" is a flatten/bounce — like a photo editor's Save: keep the layered
  // take and make a flat copy, or flatten over this take (irreversible: the layers can't
  // be re-edited after). The chooser IS the confirmation; each option spells the outcome.
  function openSaveAsOneClip() {
    AppAlert.custom("Save as one clip", "Combine every layer into a single audio clip.", [
      {
        label: "Save as a copy",
        description: "Keep this layered take and add a new flattened clip.",
        icon: actionIcons.copy,
        onPress: () => {
          closeLayersSheet();
          onSaveAsOneClip("copy");
        },
      },
      {
        label: "Replace this take",
        description: "Flatten over this take — the layers can't be edited afterward.",
        icon: actionIcons.convert,
        style: "destructive",
        onPress: () => {
          closeLayersSheet();
          onSaveAsOneClip("replace");
        },
      },
      { label: "Cancel", style: "cancel" },
    ]);
  }

  const hasLyrics = hasProjectLyrics && latestLyricsUpdatedAt !== null;
  const hasQueue = queueEntries.length > 1;
  const hasNotes = clipNotes.trim().length > 0;

  return (
    <View style={playerScreenStyles.supportStack}>
      {hasLyrics ? (
        <PlayerLyricsPanel
          text={latestLyricsText}
          chordLines={lyricsChordLines}
          versionLabel={`Version ${lyricsVersionCount}`}
          updatedAtLabel={formatDate(latestLyricsUpdatedAt!)}
          autoscrollState={{
            mode: "off",
            currentTimeMs: 0,
            durationMs: 0,
            activeLineId: null,
          }}
          defaultExpanded={false}
          expanded={lyricsExpanded}
          onToggleExpanded={onToggleLyricsExpanded}
        />
      ) : null}

      {/* Quiet utility row: notes, layers, and the queue live behind a tap
          rather than each holding a permanent card. */}
      <View style={chipStyles.utilityRow}>
        <UtilityChip
          icon="document-text-outline"
          label="Notes"
          dot={hasNotes}
          onPress={() => onToggleNotesExpanded(true)}
        />
        {hasClipOverdubs ? (
          <UtilityChip
            icon="layers-outline"
            label="Layers"
            count={clipOverdubStemCount}
            onPress={() => setLayersSheetOpen(true)}
          />
        ) : null}
        {hasQueue ? (
          <UtilityChip
            icon="list-outline"
            label="Queue"
            count={queueEntries.length}
            onPress={() => onToggleQueueExpanded(true)}
          />
        ) : null}
      </View>

      {/* Notes — read-only here; editing lives on the song's Notes tab. */}
      <BottomSheet visible={notesExpanded} onClose={() => onToggleNotesExpanded(false)}>
        <Text style={chipStyles.sheetTitle}>Clip notes</Text>
        <Text style={chipStyles.sheetMeta}>
          {hasNotes ? "Attached to this take" : "No notes saved"}
        </Text>
        <ScrollView style={chipStyles.sheetScroll} showsVerticalScrollIndicator={false}>
          <Text style={hasNotes ? chipStyles.notesText : chipStyles.notesPlaceholder}>
            {hasNotes ? clipNotes.trim() : "This clip doesn't have notes yet."}
          </Text>
        </ScrollView>
      </BottomSheet>

      {/* Queue */}
      {hasQueue ? (
        <BottomSheet visible={queueExpanded} onClose={() => onToggleQueueExpanded(false)}>
          <Text style={chipStyles.sheetTitle}>Queue</Text>
          <Text style={chipStyles.sheetMeta}>{queueEntries.length} clips lined up</Text>
          <PlayerQueue
            entries={queueEntries}
            currentClipId={currentClipId}
            compact
            onSelect={(index) => {
              onSelectQueueEntry(index);
              onToggleQueueExpanded(false);
            }}
          />
        </BottomSheet>
      ) : null}

      {/* Layers (overdub mixer) */}
      {hasClipOverdubs ? (
        <BottomSheet visible={layersSheetOpen} onClose={closeLayersSheet}>
          <View style={chipStyles.layersHeaderRow}>
            <View style={chipStyles.layersHeaderCopy}>
              <Text style={chipStyles.sheetTitle}>Layers</Text>
              <Text style={chipStyles.sheetMeta}>
                {`${clipOverdubStemCount} ${clipOverdubStemCount === 1 ? "layer" : "layers"}`}
                {isOverdubPreviewRendering ? " · updating…" : ""}
              </Text>
            </View>
            <View style={chipStyles.layersHeaderActions}>
              <Pressable
                style={chipStyles.headerIconButton}
                onPress={() => {
                  closeLayersSheet();
                  onAddOverdub();
                }}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Record a new layer"
              >
                <Ionicons name="add" size={22} color="#824f3f" />
              </Pressable>
              <Pressable
                style={chipStyles.headerIconButton}
                onPress={openSaveAsOneClip}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Save as one clip"
              >
                <Ionicons name="ellipsis-horizontal" size={18} color="#84736f" />
              </Pressable>
            </View>
          </View>
          <ScrollView style={chipStyles.sheetScroll} showsVerticalScrollIndicator={false}>
            {/* Base take: one quiet row; its controls disclose on tap like the layers'. */}
            {overdubRootSettings ? (
              <View style={playerScreenStyles.layerRootSection}>
                <Pressable
                  style={playerScreenStyles.layerRootHeader}
                  onPress={() => {
                    setRootMixExpanded((current) => !current);
                    setExpandedStemSection(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Base take settings"
                >
                  <Text style={playerScreenStyles.layerRootTitle}>Base take</Text>
                  <View style={chipStyles.rootMetaCluster}>
                    <Text style={playerScreenStyles.layerRootMeta}>
                      {`${overdubRootSettings.gainDb > 0 ? "+" : ""}${overdubRootSettings.gainDb} dB${
                        overdubRootSettings.tonePreset === "low-cut" ? " · Low cut" : ""
                      }`}
                    </Text>
                    <Ionicons
                      name={rootMixExpanded ? "chevron-up" : "chevron-down"}
                      size={13}
                      color="#a89994"
                    />
                  </View>
                </Pressable>
                {rootMixExpanded ? (
                  <View style={playerScreenStyles.layerControls}>
                    <LayerControlButton
                      label={`-${OVERDUB_GAIN_STEP_DB} dB`}
                      onPress={() => onAdjustRootGain(-OVERDUB_GAIN_STEP_DB)}
                    />
                    <LayerControlButton
                      label={`+${OVERDUB_GAIN_STEP_DB} dB`}
                      onPress={() => onAdjustRootGain(OVERDUB_GAIN_STEP_DB)}
                    />
                    <LayerControlButton
                      label="Low cut"
                      active={overdubRootSettings.tonePreset === "low-cut"}
                      onPress={onToggleRootLowCut}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={playerScreenStyles.layerList}>
              {overdubStemEntries.map((stem) => (
                <OverdubLayerCard
                  key={stem.id}
                  title={stem.title}
                  durationMs={stem.durationMs}
                  waveformPeaks={stem.waveformPeaks}
                  gainDb={stem.gainDb}
                  offsetMs={stem.offsetMs}
                  tonePreset={stem.tonePreset}
                  isMuted={stem.isMuted}
                  audioUri={stem.audioUri}
                  color={stem.color}
                  onChangeColor={(color) => onChangeStemColor(stem.id, color)}
                  isRendering={isOverdubPreviewRendering}
                  isPreviewPlaying={activeLayerPreviewId === stem.id && !!layerPreviewStatus.playing}
                  previewProgressRatio={getLayerProgressRatio(stem.id)}
                  onTogglePreview={() => toggleLayerPreview(stem.id, stem.audioUri)}
                  onToggleMuted={() => onToggleStemMute(stem.id)}
                  expandedSection={
                    expandedStemSection?.stemId === stem.id ? expandedStemSection.section : null
                  }
                  onToggleSection={(section) => toggleStemSection(stem.id, section)}
                  onRename={(nextTitle) => onRenameStem(stem.id, nextTitle)}
                  onAdjustGain={(deltaDb) => onAdjustStemGain(stem.id, deltaDb)}
                  onToggleLowCut={() => onToggleStemLowCut(stem.id)}
                  onRemove={() => removeStemSafely(stem.id)}
                  masterAudioUri={overdubRootAudioUri}
                  masterDurationMs={overdubRootDurationMs}
                  masterWaveformPeaks={overdubRootWaveformPeaks}
                  masterRecordingGrid={overdubRootRecordingGrid}
                  onNudge={(deltaMs) => onNudgeStem(stem.id, deltaMs)}
                  baselineOffsetMs={
                    alignBaselineRef.current?.stemId === stem.id
                      ? alignBaselineRef.current.offsetMs
                      : stem.offsetMs
                  }
                  onRestoreOriginal={() => {
                    const baseline =
                      alignBaselineRef.current?.stemId === stem.id
                        ? alignBaselineRef.current.offsetMs
                        : stem.offsetMs;
                    if (baseline !== stem.offsetMs) {
                      onNudgeStem(stem.id, baseline - stem.offsetMs);
                    }
                  }}
                  isAuditioning={audition.auditioningStemId === stem.id}
                  onToggleAudition={() => toggleStemAudition(stem)}
                />
              ))}
            </View>
          </ScrollView>
        </BottomSheet>
      ) : null}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  utilityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  chipLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textStrong,
  },
  chipCount: {
    minWidth: 18,
    height: 18,
    borderRadius: radii.round,
    paddingHorizontal: 5,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  chipCountText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 11,
    color: colors.textSecondary,
  },
  chipDot: {
    width: 7,
    height: 7,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
  },
  rootMetaCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  layersHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  layersHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  layersHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceContainer,
  },
  sheetTitle: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 19,
    color: colors.textPrimary,
  },
  sheetMeta: {
    ...textTokens.supporting,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  sheetScroll: {
    maxHeight: 420,
  },
  notesText: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 16,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  notesPlaceholder: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: "italic",
  },
});
