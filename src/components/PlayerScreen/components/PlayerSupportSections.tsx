import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { PlayerLyricsPanel } from "../PlayerLyricsPanel";
import { PlayerQueue } from "../PlayerQueue";
import { PlayerSupportPanel } from "../PlayerSupportPanel";
import { WaveformMiniPreview } from "../../common/WaveformMiniPreview";
import { formatDate, fmtDuration } from "../../../utils";
import { activateAndPlay, replacePlaybackSource } from "../../../services/transportPlayback";
import { OVERDUB_GAIN_STEP_DB } from "../../../overdub";
import { playerScreenStyles } from "../styles";

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

export function PlayerSupportSections({
  hasProjectLyrics,
  latestLyricsText,
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
  clipNotesSummary,
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
      Alert.alert("Layer preview failed", message);
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

  return (
    <View style={playerScreenStyles.supportStack}>
      {hasProjectLyrics && latestLyricsUpdatedAt !== null ? (
        <PlayerLyricsPanel
          text={latestLyricsText}
          versionLabel={`Version ${lyricsVersionCount}`}
          updatedAtLabel={formatDate(latestLyricsUpdatedAt)}
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

      {hasClipOverdubs ? (
        <PlayerSupportPanel
          title="Layers"
          meta={`${clipOverdubStemCount} ${clipOverdubStemCount === 1 ? "overdub" : "overdubs"}`}
          summary={
            isOverdubPreviewRendering
              ? "Updating the combined preview mix. Main playback and scrubbing stay locked until the latest layer changes settle."
              : clipPlaybackUsesRenderedMix
              ? "Main playback uses the current combined preview mix. Solo layer audition plays the raw take; gain and low cut are heard in the main mix."
              : "This take has overdubs attached, but the combined mix has not been refreshed yet."
          }
        >
          <View style={playerScreenStyles.layerToolbar}>
            <Pressable style={playerScreenStyles.layerToolbarButton} onPress={onAddOverdub}>
              <Text style={playerScreenStyles.layerToolbarButtonText}>Add overdub</Text>
            </Pressable>
            <Pressable style={playerScreenStyles.layerToolbarButton} onPress={onSaveCombined}>
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
        </PlayerSupportPanel>
      ) : null}

      <PlayerSupportPanel
        title="Clip notes"
        meta={clipNotes.trim() ? "Attached to this take" : "No notes saved"}
        summary={clipNotesSummary}
        expanded={notesExpanded}
        onToggleExpanded={onToggleNotesExpanded}
      >
        <Text
          style={[
            playerScreenStyles.notesText,
            !clipNotes.trim() ? playerScreenStyles.notesPlaceholder : null,
          ]}
        >
          {clipNotes.trim() || "This clip does not have notes yet."}
        </Text>
      </PlayerSupportPanel>

      {queueEntries.length > 1 ? (
        <PlayerSupportPanel
          title="Queue"
          meta={`${queueEntries.length} clips`}
          summary={`${queueEntries.length} clips lined up for playback.`}
          expanded={queueExpanded}
          onToggleExpanded={onToggleQueueExpanded}
        >
          <PlayerQueue
            entries={queueEntries}
            currentClipId={currentClipId}
            compact={hasProjectLyrics}
            onSelect={onSelectQueueEntry}
          />
        </PlayerSupportPanel>
      ) : null}
    </View>
  );
}
