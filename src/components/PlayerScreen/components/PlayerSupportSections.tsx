import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import type { LyricsLine } from "../../../types";
import { PlayerLyricsPanel } from "../PlayerLyricsPanel";
import { PlayerQueue } from "../PlayerQueue";
import { WaveformMiniPreview } from "../../common/WaveformMiniPreview";
import { BottomSheet } from "../../common/BottomSheet";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { formatDate, fmtDuration } from "../../../utils";
import { activateAndPlay, replacePlaybackSource } from "../../../services/transportPlayback";
import { OVERDUB_GAIN_STEP_DB } from "../../../overdub";
import { playerScreenStyles } from "../styles";
import { AppAlert } from "../../common/AppAlert";

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
  isMuted: boolean;
  tonePreset: string;
};

type LayerPreviewCardProps = {
  title: string;
  meta: string;
  durationMs: number;
  waveformPeaks?: number[];
  isPlaying: boolean;
  progressRatio: number;
  onTogglePlay: () => void;
  enabled?: boolean;
  onToggleEnabled?: () => void;
  children?: React.ReactNode;
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
  clipPlaybackUsesRenderedMix: boolean;
  isOverdubPreviewRendering: boolean;
  isMainPlaybackPlaying: boolean;
  overdubRootSettings: { gainDb: number; tonePreset: string } | null;
  overdubStemEntries: OverdubStemEntry[];
  onAddOverdub: () => void;
  onSaveCombined: () => void;
  onPauseMainPlayback: () => Promise<void>;
  onAdjustRootGain: (deltaDb: number) => void;
  onToggleRootLowCut: () => void;
  onAdjustStemGain: (stemId: string, deltaDb: number) => void;
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

const LayerPreviewCard = React.memo(function LayerPreviewCard({
  title,
  meta,
  durationMs,
  waveformPeaks,
  isPlaying,
  progressRatio,
  onTogglePlay,
  enabled = true,
  onToggleEnabled,
  children,
}: LayerPreviewCardProps) {
  return (
    <View style={playerScreenStyles.layerCard}>
      <View style={playerScreenStyles.layerCardHeader}>
        <Pressable style={playerScreenStyles.layerPlayButton} onPress={onTogglePlay}>
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={16}
            color="#824f3f"
            style={isPlaying ? undefined : playerScreenStyles.layerPlayButtonIcon}
          />
        </Pressable>
        <View style={playerScreenStyles.layerCardCopy}>
          <View style={playerScreenStyles.layerCardTitleRow}>
            <Text style={playerScreenStyles.layerCardTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={playerScreenStyles.layerCardDuration}>{fmtDuration(durationMs)}</Text>
          </View>
          <Text style={playerScreenStyles.layerCardMeta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        {onToggleEnabled ? (
          <Pressable
            style={[
              playerScreenStyles.layerEnabledDot,
              enabled ? playerScreenStyles.layerEnabledDotActive : null,
            ]}
            onPress={onToggleEnabled}
          />
        ) : null}
      </View>

      <View style={playerScreenStyles.layerWaveWrap}>
        <WaveformMiniPreview peaks={waveformPeaks} bars={72} />
        <View
          pointerEvents="none"
          style={[
            playerScreenStyles.layerWavePlayhead,
            { left: `${Math.max(0, Math.min(100, progressRatio * 100))}%` },
          ]}
        />
      </View>

      {children ? <View style={playerScreenStyles.layerCardControls}>{children}</View> : null}
    </View>
  );
});

const LayerControlButton = React.memo(function LayerControlButton({
  label,
  onPress,
  active = false,
  destructive = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      style={[
        playerScreenStyles.layerControlButton,
        active ? playerScreenStyles.layerControlButtonActive : null,
        destructive ? playerScreenStyles.layerControlButtonDestructive : null,
        disabled ? playerScreenStyles.layerControlButtonDisabled : null,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          playerScreenStyles.layerControlButtonText,
          active ? playerScreenStyles.layerControlButtonTextActive : null,
          destructive ? playerScreenStyles.layerControlButtonTextDestructive : null,
          disabled ? playerScreenStyles.layerControlButtonTextDisabled : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
});

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
  clipPlaybackUsesRenderedMix,
  isOverdubPreviewRendering,
  isMainPlaybackPlaying,
  overdubRootSettings,
  overdubStemEntries,
  onAddOverdub,
  onSaveCombined,
  onPauseMainPlayback,
  onAdjustRootGain,
  onToggleRootLowCut,
  onAdjustStemGain,
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
      const message = error instanceof Error ? error.message : "Could not play this overdub layer.";
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
    onRemoveStem(stemId);
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
        <BottomSheet visible={layersSheetOpen} onClose={() => setLayersSheetOpen(false)}>
          <Text style={chipStyles.sheetTitle}>Layers</Text>
          <Text style={chipStyles.sheetMeta}>
            {`${clipOverdubStemCount} ${clipOverdubStemCount === 1 ? "overdub" : "overdubs"}`}
            {isOverdubPreviewRendering
              ? " · updating mix…"
              : clipPlaybackUsesRenderedMix
              ? " · combined mix"
              : " · mix not refreshed"}
          </Text>
          <ScrollView style={chipStyles.sheetScroll} showsVerticalScrollIndicator={false}>
            <View style={playerScreenStyles.layerToolbar}>
              <Pressable
                style={playerScreenStyles.layerToolbarButton}
                onPress={() => {
                  setLayersSheetOpen(false);
                  onAddOverdub();
                }}
              >
                <Text style={playerScreenStyles.layerToolbarButtonText}>Add overdub</Text>
              </Pressable>
              <Pressable
                style={playerScreenStyles.layerToolbarButton}
                onPress={() => {
                  setLayersSheetOpen(false);
                  onSaveCombined();
                }}
              >
                <Text style={playerScreenStyles.layerToolbarButtonText}>Save combined</Text>
              </Pressable>
            </View>

            {overdubRootSettings ? (
              <View style={playerScreenStyles.layerRootSection}>
                <View style={playerScreenStyles.layerRootHeader}>
                  <Text style={playerScreenStyles.layerRootTitle}>Root mix</Text>
                  <Text style={playerScreenStyles.layerRootMeta}>
                    {`${overdubRootSettings.gainDb > 0 ? "+" : ""}${overdubRootSettings.gainDb} dB${
                      overdubRootSettings.tonePreset === "low-cut" ? " • Low cut" : ""
                    }`}
                  </Text>
                </View>
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
              </View>
            ) : null}

            <View style={playerScreenStyles.layerList}>
              {overdubStemEntries.map((stem) => (
                <LayerPreviewCard
                  key={stem.id}
                  title={stem.title}
                  meta={`${stem.meta} • ${stem.gainDb > 0 ? "+" : ""}${stem.gainDb} dB${
                    stem.tonePreset === "low-cut" ? " • Low cut" : ""
                  }`}
                  durationMs={stem.durationMs}
                  waveformPeaks={stem.waveformPeaks}
                  isPlaying={activeLayerPreviewId === stem.id && !!layerPreviewStatus.playing}
                  progressRatio={getLayerProgressRatio(stem.id)}
                  onTogglePlay={() => toggleLayerPreview(stem.id, stem.audioUri)}
                  enabled={!stem.isMuted}
                  onToggleEnabled={() => onToggleStemMute(stem.id)}
                >
                  <View style={playerScreenStyles.layerControls}>
                    <LayerControlButton
                      label={`-${OVERDUB_GAIN_STEP_DB} dB`}
                      onPress={() => onAdjustStemGain(stem.id, -OVERDUB_GAIN_STEP_DB)}
                    />
                    <LayerControlButton
                      label={`+${OVERDUB_GAIN_STEP_DB} dB`}
                      onPress={() => onAdjustStemGain(stem.id, OVERDUB_GAIN_STEP_DB)}
                    />
                    <LayerControlButton
                      label="Low cut"
                      active={stem.tonePreset === "low-cut"}
                      onPress={() => onToggleStemLowCut(stem.id)}
                    />
                  </View>
                  <View style={playerScreenStyles.layerControls}>
                    <LayerControlButton
                      label="Remove"
                      destructive
                      onPress={() => removeStemSafely(stem.id)}
                    />
                  </View>
                </LayerPreviewCard>
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
