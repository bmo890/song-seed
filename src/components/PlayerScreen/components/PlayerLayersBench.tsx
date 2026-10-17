import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Spinner } from "../../common/Spinner";
import { Slider } from "../../common/Slider";
import { LevelToneStrip } from "../../common/LevelToneStrip";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer } from "expo-audio";
import type { AudioStatus } from "expo-audio";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import { useThrottledAudioPlayerStatus } from "../../../hooks/useThrottledAudioPlayerStatus";
import { StemAlignmentOverlay } from "./StemAlignmentOverlay";
import { WarmModal } from "../../common/WarmModal";
import { Button } from "../../common/Button";
import { InkKey, inkKeyColor } from "../../common/InkKey";
import { InkOption } from "../../common/InkOption";
import { Press } from "../../common/Press";
import { looksMachineNamed } from "../../../domain/titleNaming";
import { LayerFoldAllKey, LayerFoldKey } from "../../common/OverdubLayerLanes";
import { useLayerPrefsStore } from "../../../state/useLayerPrefsStore";
import { UserTextInput } from "../../../i18n";
import { AppAlert } from "../../common/AppAlert";
import { actionIcons } from "../../common/actionIcons";
import { useOverdubAlignmentAudition } from "../hooks/useOverdubAlignmentAudition";
import { activateAndPlay, replacePlaybackSource } from "../../../services/transportPlayback";
import {
  formatClipOverdubStemOffsetLabel,
  OVERDUB_STEM_NUDGE_STEP_LARGE_MS,
  OVERDUB_STEM_NUDGE_STEP_SMALL_MS,
  overdubGainDbToPlayerVolume,
  type OverdubToneFlag,
} from "../../../domain/overdub";
import { snapToGrid } from "../../../domain/gridRuler";
import type { RecordingGrid } from "../../../types";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { styles as appStyles } from "../../../styles";
import { haptic } from "../../../design/haptics";
import { fmtDuration } from "../../../utils";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { UserText } from "../../../i18n";

/**
 * The bench (redrawn 2026-10-17, founder: "orderly, marked, never overstimulating"):
 * the take's layers as rows on paper, base take first, then the layers in the order
 * they were recorded. Each row is its name, where it plays (its own waveform on the
 * take's timeline, ink; the selected one terracotta) and its Solo and Mute. The
 * selected row opens under itself: play together, the alignment strip, timing nudges,
 * level and tone. The base take has level and tone only: it IS the timeline.
 */

export const BENCH_ROOT_LANE_ID = "root";

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
  isMuted: boolean;
  tonePreset: string;
  color: string;
};

/** The slice of the transport clock the bench is allowed to drive. While Play here or
 *  Solo runs (main transport paused), the bench anchors these directly off its own audio
 *  engines — the reel's playhead then moves with what is actually sounding. */
export type BenchTransportClock = {
  sharedCurrentTimeMs: SharedValue<number>;
  sharedIsPlaying: SharedValue<boolean>;
  sharedPlaybackRate: SharedValue<number>;
  sharedUpdateToken: SharedValue<number>;
};

type Props = {
  selectedLaneId: string;
  stems: BenchStemEntry[];
  rootSettings: { gainDb: number; tonePreset: string } | null;
  rootAudioUri: string | null;
  rootDurationMs: number;
  rootWaveformPeaks?: number[];
  rootRecordingGrid?: RecordingGrid | null;
  isRendering: boolean;
  isMainPlaybackPlaying: boolean;
  transportClock: BenchTransportClock;
  /** Where the main transport rests — the playhead returns here when bench audio stops. */
  getRestingPositionMs: () => number;
  /** Second-granularity position for the header's mm:ss readout while bench audio is
   *  what's sounding; null hands the readout back to the main transport. */
  onDisplayPositionChange?: (ms: number | null) => void;
  onPauseMainPlayback: () => Promise<void>;
  onAdjustRootGain: (deltaDb: number) => void;
  onToggleRootToneFlag: (flag: OverdubToneFlag) => void;
  onAdjustStemGain: (stemId: string, deltaDb: number) => void;
  onNudgeStem: (stemId: string, deltaMs: number) => void;
  onRenameStem: (stemId: string, title: string) => void;
  onSelectLane: (laneId: string) => void;
  onToggleStemMute: (stemId: string) => void;
  onToggleStemToneFlag: (stemId: string, flag: OverdubToneFlag) => void;
  onRemoveStem: (stemId: string) => void;
  onSaveAsOneClip: (mode: "copy" | "replace") => void;
  onCloseBench: () => void;
  /** Scroll the player body so a block is in view (TransportLayout.reveal). */
  onReveal?: (node: View) => void;
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

export function PlayerLayersBench({
  selectedLaneId,
  stems,
  rootSettings,
  rootAudioUri,
  rootDurationMs,
  rootWaveformPeaks,
  rootRecordingGrid,
  isRendering,
  isMainPlaybackPlaying,
  transportClock,
  getRestingPositionMs,
  onDisplayPositionChange,
  onPauseMainPlayback,
  onAdjustRootGain,
  onToggleRootToneFlag,
  onAdjustStemGain,
  onNudgeStem,
  onRenameStem,
  onSelectLane,
  onToggleStemMute,
  onToggleStemToneFlag,
  onRemoveStem,
  onSaveAsOneClip,
  onCloseBench,
  onReveal,
}: Props) {
  const { t } = useTranslation();
  const selectedStem = stems.find((stem) => stem.id === selectedLaneId) ?? null;
  const isRoot = selectedLaneId === BENCH_ROOT_LANE_ID || !selectedStem;

  const [editModalOpen, setEditModalOpen] = useState(false);

  // ---- The position feed ------------------------------------------------------------
  // Raw status events (no renders) anchor the reel clock and the micro strip cursor
  // while the bench is what's sounding. The reel dead-reckons between anchors exactly
  // as it does for the main transport channel; the strip cursor tweens between them.
  const feedActiveRef = useRef<"audition" | "solo" | null>(null);
  const fedRef = useRef(false);
  const selectedOffsetRef = useRef(0);
  selectedOffsetRef.current = selectedStem?.offsetMs ?? 0;
  const isMainPlayingRef = useRef(isMainPlaybackPlaying);
  isMainPlayingRef.current = isMainPlaybackPlaying;
  const sharedStripPlayheadMs = useSharedValue(-1);

  const feedReel = React.useCallback(
    (masterMs: number, playing: boolean) => {
      fedRef.current = true;
      transportClock.sharedCurrentTimeMs.value = masterMs;
      transportClock.sharedIsPlaying.value = playing;
      transportClock.sharedPlaybackRate.value = 1;
      transportClock.sharedUpdateToken.value += 1;
      sharedStripPlayheadMs.value = masterMs;
    },
    [transportClock, sharedStripPlayheadMs]
  );

  // Bench audio ended: hide the strip cursor and hand the clock back — parked at the
  // main transport's resting position, unless the main transport is already playing
  // again (then its own channel owns the clock and we must not touch it).
  const releaseReel = React.useCallback(() => {
    sharedStripPlayheadMs.value = -1;
    if (!fedRef.current) {
      return;
    }
    fedRef.current = false;
    if (isMainPlayingRef.current) {
      return;
    }
    transportClock.sharedIsPlaying.value = false;
    transportClock.sharedCurrentTimeMs.value = getRestingPositionMs();
    transportClock.sharedUpdateToken.value += 1;
  }, [transportClock, sharedStripPlayheadMs, getRestingPositionMs]);

  // ---- Solo (the layer truly alone) -------------------------------------------------
  const soloPlayer = useAudioPlayer(null, { updateInterval: 120 });
  const { status: soloStatus } = useThrottledAudioPlayerStatus(soloPlayer, {
    positionIntervalMs: 200,
    onRawStatus: (status: AudioStatus) => {
      if (feedActiveRef.current !== "solo") {
        return;
      }
      // Solo runs on the layer's own tape — map it onto the master's timeline.
      feedReel(
        selectedOffsetRef.current + Math.round((status.currentTime ?? 0) * 1000),
        !!status.playing
      );
    },
  });
  const [soloActive, setSoloActive] = useState(false);
  const soloDurationMs = selectedStem?.durationMs ?? Math.round((soloStatus.duration ?? 0) * 1000);
  const soloPositionMs = Math.round((soloStatus.currentTime ?? 0) * 1000);

  const pauseSoloSafely = React.useCallback(() => {
    try {
      const result = soloPlayer.pause();
      void Promise.resolve(result).catch(() => {});
    } catch {
      // Stale native handle during teardown/handoff — ignore.
    }
  }, [soloPlayer]);

  // ---- Play here (master + layer together over the layer's span) --------------------
  const audition = useOverdubAlignmentAudition({
    onMasterRawStatus: (status: AudioStatus) => {
      if (feedActiveRef.current !== "audition") {
        return;
      }
      // The audition's master player IS the master timeline — feed it straight through.
      feedReel(Math.round((status.currentTime ?? 0) * 1000), !!status.playing);
    },
  });
  const isAuditioning = audition.auditioningStemId === selectedStem?.id;
  const lastAuditionOffsetRef = useRef<number | null>(null);
  const auditionRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The offset the layer had when it was selected — "Original" undoes this sitting's
  // nudges without touching a previously-saved alignment.
  const baselineRef = useRef<{ stemId: string; offsetMs: number } | null>(null);
  if (selectedStem && baselineRef.current?.stemId !== selectedStem.id) {
    baselineRef.current = { stemId: selectedStem.id, offsetMs: selectedStem.offsetMs };
  }
  const baselineOffsetMs = baselineRef.current?.offsetMs ?? selectedStem?.offsetMs ?? 0;
  const canRestoreOriginal = !!selectedStem && selectedStem.offsetMs !== baselineOffsetMs;

  // Selection change: whatever was sounding belonged to the previous layer.
  const prevSelectionRef = useRef(selectedLaneId);
  useEffect(() => {
    if (prevSelectionRef.current !== selectedLaneId) {
      prevSelectionRef.current = selectedLaneId;
      audition.stop();
      pauseSoloSafely();
      setSoloActive(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLaneId, pauseSoloSafely]);

  // Solo loops the layer (settled 2026-08-07): running out wraps to the top — a steady
  // pulse for level and tone judgements, until the key is tapped again.
  useEffect(() => {
    if (!soloStatus.didJustFinish || !soloActive) {
      return;
    }
    try {
      const seekResult = soloPlayer.seekTo(0);
      void Promise.resolve(seekResult)
        .then(() => {
          soloPlayer.play();
        })
        .catch(() => setSoloActive(false));
    } catch {
      setSoloActive(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soloStatus.didJustFinish]);

  // The feed follows whichever bench engine is live; when neither is, the reel clock
  // goes back to the main transport.
  const benchAudible = isAuditioning || soloActive;
  useEffect(() => {
    feedActiveRef.current = isAuditioning ? "audition" : soloActive ? "solo" : null;
    if (!benchAudible) {
      releaseReel();
    }
  }, [isAuditioning, soloActive, benchAudible, releaseReel]);

  useEffect(() => {
    return () => {
      releaseReel();
    };
  }, [releaseReel]);

  // Second-granularity position for React readers: the header's mm:ss readout and the
  // micro strip's follow window — one commit per displayed second, the same cadence
  // the main transport's readout already renders at.
  const [stripFollowMs, setStripFollowMs] = useState<number | null>(null);
  const lastSentSecondRef = useRef<number | null>(null);
  useEffect(() => {
    if (!benchAudible) {
      lastSentSecondRef.current = null;
      setStripFollowMs(null);
      onDisplayPositionChange?.(null);
      return;
    }
    const tick = () => {
      const ms = sharedStripPlayheadMs.value;
      if (ms < 0) {
        return;
      }
      const second = Math.floor(ms / 1000);
      if (lastSentSecondRef.current === second) {
        return;
      }
      lastSentSecondRef.current = second;
      setStripFollowMs(ms);
      onDisplayPositionChange?.(ms);
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => {
      clearInterval(interval);
      lastSentSecondRef.current = null;
      setStripFollowMs(null);
      onDisplayPositionChange?.(null);
    };
  }, [benchAudible, onDisplayPositionChange, sharedStripPlayheadMs]);

  // Main playback wins — never two transports at once.
  useEffect(() => {
    if (!isMainPlaybackPlaying) return;
    if (soloActive) {
      pauseSoloSafely();
      setSoloActive(false);
    }
    if (audition.auditioningStemId) {
      audition.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMainPlaybackPlaying]);

  // Hearing a nudge is the point: while Play here runs, an offset change restarts the
  // audition at the new offset after a short settle so successive taps coalesce.
  useEffect(() => {
    if (!isAuditioning || !selectedStem?.audioUri || !rootAudioUri) {
      return;
    }
    if (lastAuditionOffsetRef.current === selectedStem.offsetMs) {
      return;
    }
    if (auditionRestartTimerRef.current) {
      clearTimeout(auditionRestartTimerRef.current);
    }
    const target = {
      stemId: selectedStem.id,
      masterAudioUri: rootAudioUri,
      stemAudioUri: selectedStem.audioUri,
      offsetMs: selectedStem.offsetMs,
      stemGainDb: selectedStem.gainDb,
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
  }, [isAuditioning, selectedStem?.id, selectedStem?.offsetMs, rootAudioUri]);

  useEffect(() => {
    return () => {
      pauseSoloSafely();
    };
  }, [pauseSoloSafely]);

  async function toggleSolo() {
    if (!selectedStem?.audioUri) return;
    haptic.tap(); // Vocabulary: tap = control toggles.
    try {
      if (soloActive && soloStatus.playing) {
        await soloPlayer.pause();
        return;
      }
      audition.stop();
      await onPauseMainPlayback();
      soloPlayer.volume = overdubGainDbToPlayerVolume(selectedStem.gainDb);
      if (soloActive) {
        await activateAndPlay(soloPlayer, soloStatus, soloDurationMs, soloPositionMs);
        return;
      }
      await replacePlaybackSource(soloPlayer, selectedStem.audioUri, false);
      setSoloActive(true);
      await activateAndPlay(soloPlayer, { duration: 0, currentTime: 0 });
    } catch (error) {
      pauseSoloSafely();
      setSoloActive(false);
      const message = error instanceof Error ? error.message : t("player.layerPlayFailed");
      console.warn("Layer solo failed", error);
      haptic.error(); // Vocabulary: failures fire error.
      AppAlert.info(t("player.layerPreviewFailed"), message);
    }
  }

  function togglePlayHere() {
    if (!selectedStem) return;
    haptic.tap(); // Vocabulary: tap = control toggles.
    if (isAuditioning) {
      audition.stop();
      return;
    }
    if (!selectedStem.audioUri || !rootAudioUri) return;
    pauseSoloSafely();
    setSoloActive(false);
    lastAuditionOffsetRef.current = selectedStem.offsetMs;
    void onPauseMainPlayback().catch(() => {});
    void audition
      .start({
        stemId: selectedStem.id,
        masterAudioUri: rootAudioUri,
        stemAudioUri: selectedStem.audioUri,
        offsetMs: selectedStem.offsetMs,
        stemGainDb: selectedStem.gainDb,
      })
      .catch((error) => {
        console.warn("Alignment audition failed", error);
        haptic.error(); // Vocabulary: failures fire error.
        audition.stop();
      });
  }

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

  // Solo on a row that is not selected selects it, then solos it once the previous
  // layer's audio has stopped (the selection change stops it first).
  const pendingSoloRef = useRef<string | null>(null);
  function requestSolo(stemId: string) {
    if (stemId === selectedStem?.id) {
      void toggleSolo();
      return;
    }
    pendingSoloRef.current = stemId;
    onSelectLane(stemId);
  }
  useEffect(() => {
    if (pendingSoloRef.current && pendingSoloRef.current === selectedStem?.id && !soloActive) {
      pendingSoloRef.current = null;
      void toggleSolo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStem?.id, soloActive]);

  // Picking another layer brings its tools into view: they sit under the whole
  // stack, and with several layers that is below the fold.
  const toolsRef = useRef<View>(null);
  const revealedLaneRef = useRef(selectedLaneId);
  useEffect(() => {
    if (revealedLaneRef.current === selectedLaneId) return;
    revealedLaneRef.current = selectedLaneId;
    const frame = requestAnimationFrame(() => {
      if (toolsRef.current) onReveal?.(toolsRef.current);
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedLaneId, onReveal]);

  // An item's "…" is the action menu, never a centred dialog; removing asks first.
  function openLayerMenu(stem: BenchStemEntry) {
    AppAlert.menu(stem.title, [
      {
        key: "player.renameLayer",
        label: t("player.renameLayer"),
        icon: actionIcons.edit,
        onPress: () => {
          onSelectLane(stem.id);
          setEditModalOpen(true);
        },
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
              if (stem.id === selectedStem?.id) {
                audition.stop();
                pauseSoloSafely();
                setSoloActive(false);
              }
              onRemoveStem(stem.id);
            },
            { confirmLabel: t("player.removeLayer") }
          ),
      },
    ]);
  }

  function openSaveAsOneClip() {
    openCombineChooser(t, (mode) => {
      onCloseBench();
      onSaveAsOneClip(mode);
    });
  }

  const timelineMs = Math.max(
    1,
    rootDurationMs,
    ...stems.map((stem) => stem.offsetMs + stem.durationMs)
  );

  const stemTools = selectedStem ? (
    <View style={benchStyles.tools}>
      {/* Scrubbable solo transport while the layer is loaded (playing or paused). */}
      {soloActive ? (
        <Slider
          style={benchStyles.soloScrubber}
          minimumValue={0}
          maximumValue={1}
          value={soloDurationMs > 0 ? Math.max(0, Math.min(1, soloPositionMs / soloDurationMs)) : 0}
          onSlidingComplete={(ratio) => {
            if (soloDurationMs <= 0) return;
            try {
              const result = soloPlayer.seekTo((ratio * soloDurationMs) / 1000);
              void Promise.resolve(result).catch(() => {});
            } catch {
              // Stale native handle — ignore.
            }
          }}
          fill={false}
          accessibilityLabel={t("player.scrubLayer")}
        />
      ) : null}

      {/* The alignment strip: this layer against the take; slide it to move it. */}
      <StemAlignmentOverlay
        headerLeading={
          <InkKey
            // Haptics: the toggle fires its own `tap` (togglePlayHere).
            haptic="none"
            tone={isAuditioning ? "active" : "idle"}
            label={t("player.playTogetherShort")}
            glyph={
              <Ionicons
                name={isAuditioning ? "stop" : "play"}
                size={14}
                color={inkKeyColor(isAuditioning ? "active" : "idle")}
              />
            }
            onPress={togglePlayHere}
            accessibilityLabel={isAuditioning ? t("player.stopTogether") : t("player.playTogether")}
          />
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
        sharedPlayheadMs={sharedStripPlayheadMs}
        playheadColor={colors.playhead}
        followMs={stripFollowMs}
      />

      <View style={benchStyles.labelRow}>
        <Text style={benchStyles.toolLabel}>{t("player.timing")}</Text>
        <Text style={benchStyles.toolValue}>{formatClipOverdubStemOffsetLabel(selectedStem.offsetMs)}</Text>
      </View>
      <View style={benchStyles.nudgeRow}>
        <NudgeKey
          label={t("player.nudgeMs", { value: `−${OVERDUB_STEM_NUDGE_STEP_LARGE_MS}` })}
          onPress={() => onNudgeStem(selectedStem.id, -OVERDUB_STEM_NUDGE_STEP_LARGE_MS)}
        />
        <NudgeKey
          label={t("player.nudgeMs", { value: `−${OVERDUB_STEM_NUDGE_STEP_SMALL_MS}` })}
          onPress={() => onNudgeStem(selectedStem.id, -OVERDUB_STEM_NUDGE_STEP_SMALL_MS)}
        />
        <NudgeKey
          label={t("player.nudgeMs", { value: `+${OVERDUB_STEM_NUDGE_STEP_SMALL_MS}` })}
          onPress={() => onNudgeStem(selectedStem.id, OVERDUB_STEM_NUDGE_STEP_SMALL_MS)}
        />
        <NudgeKey
          label={t("player.nudgeMs", { value: `+${OVERDUB_STEM_NUDGE_STEP_LARGE_MS}` })}
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
    <View style={benchStyles.bench}>
      <View style={benchStyles.foldAllRow}>
        <LayerFoldAllKey layerIds={stems.map((stem) => stem.id)} />
      </View>
      <BenchRow
        title={t("player.baseTake")}
        readsAsName={false}
        meta={fmtDuration(rootDurationMs)}
        offsetMs={0}
        durationMs={rootDurationMs}
        timelineMs={timelineMs}
        peaks={rootWaveformPeaks}
        selected={isRoot}
        rendering={isRendering}
        onSelect={() => onSelectLane(BENCH_ROOT_LANE_ID)}
      />

      {stems.map((stem) => {
        const selected = stem.id === selectedStem?.id;
        return (
          <BenchRow
            key={stem.id}
            title={stem.title}
            readsAsName={!looksMachineNamed(stem.title)}
            meta={
              stem.offsetMs > 0
                ? t("player.fromTime", { time: fmtDuration(stem.offsetMs) })
                : fmtDuration(stem.durationMs)
            }
            offsetMs={stem.offsetMs}
            durationMs={stem.durationMs}
            timelineMs={timelineMs}
            peaks={stem.waveformPeaks}
            selected={selected}
            muted={stem.isMuted}
            rendering={selected && isRendering}
            onSelect={() => onSelectLane(stem.id)}
            foldId={stem.id}
            controls={
              <>
                <InkOption
                  label={t("player.solo")}
                  selected={selected && soloActive}
                  disabled={!stem.audioUri}
                  onPress={() => requestSolo(stem.id)}
                />
                <InkOption
                  label={t("player.mute")}
                  selected={stem.isMuted}
                  onPress={() => onToggleStemMute(stem.id)}
                  accessibilityLabel={stem.isMuted ? t("player.unmuteLayer") : t("player.muteLayer")}
                />
                <Press
                  feel="glyph"
                  // Haptics: none — it opens a menu, which settles with its own.
                  haptic="none"
                  style={benchStyles.menuButton}
                  onPress={() => openLayerMenu(stem)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={t("player.layerOptions")}
                >
                  <Ionicons name="ellipsis-horizontal" size={16} color={colors.textSecondary} />
                </Press>
              </>
            }
          />
        );
      })}
      <View style={benchStyles.rule} />

      {/* The selected row's tools sit under the whole stack, so every layer stays
          in view while one is worked on (they used to open inside the list and
          push the rest off the screen). */}
      <View ref={toolsRef} collapsable={false} style={benchStyles.toolsBlock}>
        <Text style={benchStyles.toolsCaption} numberOfLines={1}>
          {isRoot ? t("player.baseTake") : selectedStem?.title}
        </Text>
        {isRoot ? (
          rootSettings ? (
            <LevelToneStrip
              style={benchStyles.strip}
              gainDb={rootSettings.gainDb}
              tonePreset={rootSettings.tonePreset}
              onCommitGain={(db) => onAdjustRootGain(db - rootSettings.gainDb)}
              onToggleToneFlag={onToggleRootToneFlag}
            />
          ) : null
        ) : (
          stemTools
        )}
      </View>
      <View style={benchStyles.rule} />

      {/* The foot: combining is where a layered take stops being layered. */}
      {stems.length > 0 ? (
        <Pressable
          style={({ pressed }) => [benchStyles.footLink, pressed ? appStyles.pressDown : null]}
          onPress={openSaveAsOneClip}
          accessibilityRole="button"
          accessibilityLabel={t("player.saveOneClip")}
        >
          <Ionicons name="albums-outline" size={14} color={colors.textSecondary} />
          <Text style={benchStyles.footLinkText}>{t("player.saveOneClip")}</Text>
        </Pressable>
      ) : null}

      {selectedStem ? (
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
      ) : null}
    </View>
  );
}

/** One row on the bench: name and where it sits (meta), its Solo / Mute / "…",
 *  and its waveform on the take's timeline. The selected row opens beneath. */
function BenchRow({
  title,
  readsAsName,
  meta,
  offsetMs,
  durationMs,
  timelineMs,
  peaks,
  selected,
  muted = false,
  rendering = false,
  onSelect,
  controls,
  foldId,
}: {
  title: string;
  readsAsName: boolean;
  meta: string;
  offsetMs: number;
  durationMs: number;
  timelineMs: number;
  peaks?: number[];
  selected: boolean;
  muted?: boolean;
  rendering?: boolean;
  onSelect: () => void;
  controls?: React.ReactNode;
  /** A layer's id: the row can fold to its name line (shared with the lanes). */
  foldId?: string;
}) {
  const { t } = useTranslation();
  const folded = useLayerPrefsStore((state) => (foldId ? state.collapsedLayerIds.includes(foldId) : false));
  const heights = React.useMemo(() => rowBarHeights(peaks, durationMs), [peaks, durationMs]);
  const leftPct = `${Math.max(0, Math.min(100, (offsetMs / timelineMs) * 100))}%` as const;
  const widthPct = `${Math.max(1, Math.min(100, (durationMs / timelineMs) * 100))}%` as const;
  return (
    <View style={benchStyles.row}>
      <View style={benchStyles.rowHead}>
        <Press
          feel="surface"
          // Haptics: none here — choosing a row taps through onSelect (handlePressLane).
          haptic="none"
          style={benchStyles.rowName}
          onPress={onSelect}
          accessibilityRole="button"
          accessibilityState={{ selected }}
          accessibilityLabel={title}
        >
          <UserText
            value={title}
            style={[
              readsAsName ? benchStyles.nameTyped : benchStyles.nameMachine,
              selected ? benchStyles.nameSelected : null,
            ]}
            numberOfLines={1}
          >
            {title}
          </UserText>
          <Text style={benchStyles.meta} numberOfLines={1}>
            {muted ? `${meta} · ${t("player.mutedShort")}` : meta}
          </Text>
          {rendering ? (
            <Spinner size="small" color={colors.primaryDeep} accessibilityLabel={t("player.updatingMix")} />
          ) : null}
        </Press>
        {controls ? <View style={benchStyles.controls}>{controls}</View> : null}
        {foldId ? <LayerFoldKey layerId={foldId} title={title} folded={folded} /> : null}
      </View>
      {folded ? null : (
      <Press feel="still" haptic="none" onPress={onSelect} style={benchStyles.track} accessibilityElementsHidden>
        <View style={[benchStyles.baseline, muted ? benchStyles.baselineMuted : null]} />
        <View style={[benchStyles.wave, { left: leftPct, width: widthPct }]} pointerEvents="none">
          {heights.map((h, index) => (
            <View
              key={index}
              style={[
                benchStyles.bar,
                selected ? benchStyles.barSelected : null,
                muted ? (selected ? benchStyles.barSelectedMuted : benchStyles.barMuted) : null,
                { height: Math.max(2, Math.round(h * ROW_WAVE_HEIGHT)) },
              ]}
            />
          ))}
        </View>
      </Press>
      )}
    </View>
  );
}

const ROW_WAVE_HEIGHT = 14;

function rowBarHeights(peaks: number[] | undefined, durationMs: number): number[] {
  const count = Math.max(8, Math.min(140, Math.round(durationMs / 140)));
  if (!peaks || peaks.length === 0) return new Array(count).fill(0.12);
  const max = peaks.reduce((m, p) => (Number.isFinite(p) && Math.abs(p) > m ? Math.abs(p) : m), 0) || 1;
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const from = Math.floor((i / count) * peaks.length);
    const to = Math.max(from + 1, Math.floor(((i + 1) / count) * peaks.length));
    let top = 0;
    for (let j = from; j < to && j < peaks.length; j += 1) {
      const v = Math.abs(peaks[j]);
      if (Number.isFinite(v) && v > top) top = v;
    }
    out.push(Math.max(0.12, top / max));
  }
  return out;
}

/** Rename a layer. Draft state resets from props each time the sheet opens. */
function RenameLayerModal({
  visible,
  title,
  onSave,
  onClose,
}: {
  visible: boolean;
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
    <WarmModal visible={visible} onRequestClose={onClose} title={t("player.renameLayer")}>
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
  bench: {
    marginTop: spacing.sm,
  },
  row: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
    paddingVertical: 6,
    gap: 2,
  },
  foldAllRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
  },
  rowHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowName: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    paddingVertical: 2,
  },
  nameTyped: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 16,
    lineHeight: 20,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  nameMachine: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    lineHeight: 20,
    color: colors.textStrong,
    flexShrink: 1,
  },
  nameSelected: {
    color: colors.primaryDeep,
  },
  meta: {
    ...textTokens.caption,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  menuButton: {
    width: 28,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  track: {
    height: ROW_WAVE_HEIGHT + 4,
    justifyContent: "center",
  },
  baseline: {
    position: "absolute",
    left: 0,
    right: 0,
    top: (ROW_WAVE_HEIGHT + 4) / 2,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
  },
  baselineMuted: {
    height: 0,
    backgroundColor: "transparent",
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderSubtle,
  },
  wave: {
    position: "absolute",
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bar: {
    width: 1.6,
    borderRadius: 1,
    backgroundColor: colors.textStrong,
    opacity: 0.45,
  },
  barSelected: {
    backgroundColor: colors.primary,
    opacity: 1,
  },
  barMuted: {
    opacity: 0.15,
  },
  barSelectedMuted: {
    opacity: 0.35,
  },
  tools: {
    gap: 10,
  },
  toolsBlock: {
    paddingTop: 12,
    paddingBottom: 12,
    gap: 6,
  },
  // The selected layer's name over its tools: the row above is lit terracotta,
  // this says the same in words.
  toolsCaption: {
    ...textTokens.annotation,
    color: colors.primaryDeep,
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
  soloScrubber: {
    width: "100%",
    height: 26,
  },
  // The strip sits flush with the bench's rows: no inset of its own.
  strip: {
    paddingHorizontal: 0,
  },
  nudgeRow: {
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
  footLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
  },
  footLinkText: {
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
