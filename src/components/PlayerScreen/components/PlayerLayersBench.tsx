import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer } from "expo-audio";
import type { AudioStatus } from "expo-audio";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import { useThrottledAudioPlayerStatus } from "../../../hooks/useThrottledAudioPlayerStatus";
import { StemAlignmentOverlay } from "./StemAlignmentOverlay";
import { WarmModal } from "../../common/WarmModal";
import { HueSlider } from "../../common/HueSlider";
import { hexToHue, hueToAccentHex } from "../../../domain/workspaceTheme";
import { UserTextInput } from "../../../i18n";
import { AppAlert } from "../../common/AppAlert";
import { actionIcons } from "../../common/actionIcons";
import { AnimatedCollapse } from "../../common/AnimatedCollapse";
import { useOverdubAlignmentAudition } from "../hooks/useOverdubAlignmentAudition";
import { activateAndPlay, replacePlaybackSource } from "../../../services/transportPlayback";
import {
  formatClipOverdubStemOffsetLabel,
  hasToneFlag,
  OVERDUB_GAIN_MAX_DB,
  OVERDUB_GAIN_MIN_DB,
  OVERDUB_STEM_NUDGE_STEP_LARGE_MS,
  OVERDUB_STEM_NUDGE_STEP_SMALL_MS,
  OVERDUB_TONE_FLAGS,
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
import { UserText } from "../../../i18n";

/**
 * The bench (phase 4b, settled 2026-08-07): the reel-anchored surface that replaced the
 * Layers sheet. The lanes under the reel are the selector; ONE bench below serves the
 * selected layer — quiet face (Play here · Solo · Mute · Levels), the alignment micro
 * strip always in view, nudges under it. Volume and tone disclose behind the Levels
 * door; nothing stands at attention until asked for. The base take is a selectable lane
 * too, with fewer controls — it has no timing because it IS the timeline.
 */

export const BENCH_ROOT_LANE_ID = "root";

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
  onChangeStemColor: (stemId: string, color: string) => void;
  onToggleStemMute: (stemId: string) => void;
  onToggleStemToneFlag: (stemId: string, flag: OverdubToneFlag) => void;
  onRemoveStem: (stemId: string) => void;
  onSaveAsOneClip: (mode: "copy" | "replace") => void;
  onCloseBench: () => void;
};

/** Circular icon key — the face row's toggles (Solo, Mute). Colour carries state:
 *  quiet ink at rest, terracotta wash when the toggle is live. Words stay in the
 *  accessibility labels. */
function RoundKey({
  icon,
  active = false,
  disabled = false,
  onPress,
  accessibilityLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        benchStyles.roundKey,
        active ? benchStyles.roundKeyActive : null,
        disabled ? benchStyles.keyDisabled : null,
        pressed ? appStyles.pressDown : null,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name={icon} size={16} color={active ? colors.primaryDeep : colors.textStrong} />
    </Pressable>
  );
}

/** Soft key on the bench face — colour carries state, not heft. */
function BenchKey({
  icon,
  label,
  active = false,
  disabled = false,
  trailing = false,
  onPress,
  accessibilityLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  disabled?: boolean;
  /** Pushed to the row's far edge — the door sits apart from the verbs. */
  trailing?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        benchStyles.key,
        active ? benchStyles.keyActive : null,
        disabled ? benchStyles.keyDisabled : null,
        trailing ? benchStyles.keyTrailing : null,
        pressed ? appStyles.pressDown : null,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Ionicons
        name={icon}
        size={14}
        color={active ? colors.primaryDeep : colors.textStrong}
      />
      <Text style={[benchStyles.keyText, active ? benchStyles.keyTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** i18n keys for the tone flags, in the flags' own canonical order. */
const TONE_FLAG_LABEL_KEYS: Record<OverdubToneFlag, string> = {
  "low-cut": "player.lowCut",
  "hi-cut": "player.hiCut",
  "mid-boost": "player.midBoost",
};

/** The tone row: quick EQ switches under their real names, multi-select. */
function ToneFlagRow({
  tonePreset,
  onToggleFlag,
}: {
  tonePreset: string;
  onToggleFlag: (flag: OverdubToneFlag) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={benchStyles.toneRow}>
      {OVERDUB_TONE_FLAGS.map((flag) => (
        <ToneInk
          key={flag}
          label={t(TONE_FLAG_LABEL_KEYS[flag])}
          active={hasToneFlag(tonePreset, flag)}
          onPress={() => {
            haptic.tap(); // Vocabulary: tap = control toggles.
            onToggleFlag(flag);
          }}
        />
      ))}
    </View>
  );
}

/** Editorial ink toggle (word + leading dot, hollow → terracotta) — the tone row's
 *  multi-select language. */
function ToneInk({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [benchStyles.toneInk, pressed ? appStyles.pressDown : null]}
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6 }}
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
      accessibilityLabel={label}
    >
      <View
        style={[
          benchStyles.toneInkDot,
          active ? { backgroundColor: colors.primary, borderColor: colors.primary } : null,
        ]}
      />
      <Text style={[benchStyles.toneInkText, active ? benchStyles.toneInkTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Volume slider + the computed dB level it lands on. Commits the delta on release so a
 *  drag is one store write (and one mix re-render), not a stream of them. */
function GainSliderRow({
  gainDb,
  onCommitGain,
}: {
  gainDb: number;
  onCommitGain: (deltaDb: number) => void;
}) {
  const [dragDb, setDragDb] = useState<number | null>(null);
  const shownDb = dragDb ?? gainDb;
  return (
    <View style={benchStyles.gainRow}>
      <Slider
        style={benchStyles.gainSlider}
        minimumValue={OVERDUB_GAIN_MIN_DB}
        maximumValue={OVERDUB_GAIN_MAX_DB}
        step={1}
        value={gainDb}
        onValueChange={(value) => setDragDb(Math.round(value))}
        onSlidingComplete={(value) => {
          setDragDb(null);
          const delta = Math.round(value) - gainDb;
          if (delta !== 0) onCommitGain(delta);
        }}
        minimumTrackTintColor={colors.primaryDeep}
        maximumTrackTintColor={colors.surfaceHigh}
        thumbTintColor={colors.primaryDeep}
      />
      <Text style={benchStyles.gainReadout}>{`${shownDb > 0 ? "+" : ""}${shownDb} dB`}</Text>
    </View>
  );
}

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
  onChangeStemColor,
  onToggleStemMute,
  onToggleStemToneFlag,
  onRemoveStem,
  onSaveAsOneClip,
  onCloseBench,
}: Props) {
  const { t } = useTranslation();
  const selectedStem = stems.find((stem) => stem.id === selectedLaneId) ?? null;
  const isRoot = selectedLaneId === BENCH_ROOT_LANE_ID || !selectedStem;

  const [levelsOpen, setLevelsOpen] = useState(false);
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
      setLevelsOpen(false);
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

  // Header readout: while bench audio runs, sample the strip playhead at second
  // granularity — one commit per displayed second, the same cadence the main
  // transport's mm:ss already renders at.
  const lastSentSecondRef = useRef<number | null>(null);
  useEffect(() => {
    if (!onDisplayPositionChange) {
      return;
    }
    if (!benchAudible) {
      lastSentSecondRef.current = null;
      onDisplayPositionChange(null);
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
      onDisplayPositionChange(ms);
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => {
      clearInterval(interval);
      lastSentSecondRef.current = null;
      onDisplayPositionChange(null);
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

  function openLayerMenu() {
    if (!selectedStem) return;
    AppAlert.custom(selectedStem.title, undefined, [
      { label: t("songDetail.edit"), icon: actionIcons.edit, onPress: () => setEditModalOpen(true) },
      {
        label: t("player.removeLayer"),
        style: "destructive",
        icon: actionIcons.delete,
        onPress: () => {
          audition.stop();
          pauseSoloSafely();
          setSoloActive(false);
          onRemoveStem(selectedStem.id);
        },
      },
      { label: t("common.cancel"), style: "cancel" },
    ]);
  }

  // The flatten chooser IS the confirmation — each option spells its outcome.
  function openSaveAsOneClip() {
    AppAlert.custom(t("player.combineTitle"), t("player.combineBody"), [
      {
        label: t("player.saveCopy"),
        description: t("player.saveCopyDesc"),
        icon: actionIcons.copy,
        onPress: () => {
          onCloseBench();
          onSaveAsOneClip("copy");
        },
      },
      {
        label: t("player.replaceTake"),
        description: t("player.replaceTakeDesc"),
        icon: actionIcons.convert,
        style: "destructive",
        onPress: () => {
          onCloseBench();
          onSaveAsOneClip("replace");
        },
      },
      { label: t("common.cancel"), style: "cancel" },
    ]);
  }

  return (
    <View style={benchStyles.bench}>
      {isRoot ? (
        // Base take: fewer controls — no timing (it IS the timeline), no solo/mute.
        <View style={benchStyles.section}>
          <View style={benchStyles.headerRow}>
            <View style={[benchStyles.laneDot, { backgroundColor: colors.textMuted }]} />
            <Text style={benchStyles.title}>{t("player.baseTake")}</Text>
            {isRendering ? (
              <ActivityIndicator size="small" color={colors.primaryDeep} accessibilityLabel={t("player.updatingMix")} />
            ) : null}
            <Text style={benchStyles.duration}>{fmtDuration(rootDurationMs)}</Text>
          </View>
          {rootSettings ? (
            <>
              <GainSliderRow gainDb={rootSettings.gainDb} onCommitGain={onAdjustRootGain} />
              <ToneFlagRow tonePreset={rootSettings.tonePreset} onToggleFlag={onToggleRootToneFlag} />
            </>
          ) : null}
        </View>
      ) : (
        <View style={benchStyles.section}>
          <View style={benchStyles.headerRow}>
            <View style={[benchStyles.laneDot, { backgroundColor: selectedStem.color }]} />
            <UserText value={selectedStem.title} style={benchStyles.title} numberOfLines={1}>
              {selectedStem.title}
            </UserText>
            {isRendering ? (
              <ActivityIndicator size="small" color={colors.primaryDeep} accessibilityLabel={t("player.updatingMix")} />
            ) : null}
            <Text style={benchStyles.duration}>{fmtDuration(selectedStem.durationMs)}</Text>
            <Pressable
              style={({ pressed }) => [benchStyles.menuButton, pressed ? appStyles.pressDown : null]}
              onPress={openLayerMenu}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t("player.layerOptions")}
            >
              <Ionicons name="ellipsis-horizontal" size={16} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* The bench face: the four verbs a layer answers to. */}
          <View style={benchStyles.faceRow}>
            <BenchKey
              icon={isAuditioning ? "stop" : "play"}
              label={isAuditioning ? t("player.stop") : t("player.playHere")}
              active={isAuditioning}
              disabled={!selectedStem.audioUri || !rootAudioUri}
              onPress={togglePlayHere}
              accessibilityLabel={isAuditioning ? t("player.stopTogether") : t("player.playTogether")}
            />
            <RoundKey
              icon={soloActive && soloStatus.playing ? "pause" : "headset-outline"}
              active={soloActive}
              disabled={!selectedStem.audioUri}
              onPress={() => void toggleSolo()}
              accessibilityLabel={t("player.solo")}
            />
            <RoundKey
              icon={selectedStem.isMuted ? "volume-mute" : "volume-mute-outline"}
              active={selectedStem.isMuted}
              onPress={() => {
                haptic.tap(); // Vocabulary: tap = control toggles.
                onToggleStemMute(selectedStem.id);
              }}
              accessibilityLabel={selectedStem.isMuted ? t("player.unmuteLayer") : t("player.muteLayer")}
            />
            <BenchKey
              icon="options-outline"
              label={t("player.levels")}
              active={levelsOpen}
              trailing
              onPress={() => {
                haptic.tap(); // Vocabulary: tap = control toggles.
                setLevelsOpen((current) => !current);
              }}
            />
          </View>

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
              minimumTrackTintColor={colors.primaryDeep}
              maximumTrackTintColor={colors.surfaceHigh}
              thumbTintColor={colors.primaryDeep}
              accessibilityLabel={t("player.scrubLayer")}
            />
          ) : null}

          {/* Levels — a door, not a board. Volume with its computed dB, then tone as
              quick EQ switches under their real names. */}
          <AnimatedCollapse visible={levelsOpen}>
            <View style={benchStyles.levelsDrawer}>
              <GainSliderRow
                gainDb={selectedStem.gainDb}
                onCommitGain={(delta) => onAdjustStemGain(selectedStem.id, delta)}
              />
              <ToneFlagRow
                tonePreset={selectedStem.tonePreset}
                onToggleFlag={(flag) => onToggleStemToneFlag(selectedStem.id, flag)}
              />
            </View>
          </AnimatedCollapse>

          {/* The micro strip: this layer against the master, nudge by nudge. Strip and
              nudges breathe as one unit; the groups around them get the air. */}
          <View style={benchStyles.timingGroup}>
          <StemAlignmentOverlay
            masterAudioUri={rootAudioUri}
            masterDurationMs={rootDurationMs}
            masterFallbackPeaks={rootWaveformPeaks}
            stemAudioUri={selectedStem.audioUri}
            stemDurationMs={selectedStem.durationMs}
            stemFallbackPeaks={selectedStem.waveformPeaks}
            offsetMs={selectedStem.offsetMs + slidePreviewMs}
            stemColor={selectedStem.color}
            recordingGrid={rootRecordingGrid}
            onSlide={handleSlide}
            onSlideEnd={handleSlideEnd}
            sharedPlayheadMs={sharedStripPlayheadMs}
            playheadColor={selectedStem.color}
          />
          <View style={benchStyles.nudgeRow}>
            <NudgeKey
              label={`◀ ${OVERDUB_STEM_NUDGE_STEP_LARGE_MS}`}
              onPress={() => onNudgeStem(selectedStem.id, -OVERDUB_STEM_NUDGE_STEP_LARGE_MS)}
            />
            <NudgeKey
              label={`◀ ${OVERDUB_STEM_NUDGE_STEP_SMALL_MS}`}
              onPress={() => onNudgeStem(selectedStem.id, -OVERDUB_STEM_NUDGE_STEP_SMALL_MS)}
            />
            <Text style={benchStyles.offsetReadout}>
              {formatClipOverdubStemOffsetLabel(selectedStem.offsetMs)}
            </Text>
            <NudgeKey
              label={`${OVERDUB_STEM_NUDGE_STEP_SMALL_MS} ▶`}
              onPress={() => onNudgeStem(selectedStem.id, OVERDUB_STEM_NUDGE_STEP_SMALL_MS)}
            />
            <NudgeKey
              label={`${OVERDUB_STEM_NUDGE_STEP_LARGE_MS} ▶`}
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
          </View>
        </View>
      )}

      {/* The surface's foot: flattening is where a layered take stops being layered. */}
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
        <EditLayerModal
          visible={editModalOpen}
          title={selectedStem.title}
          color={selectedStem.color}
          onSave={(nextTitle, nextColor) => {
            if (nextTitle.trim() && nextTitle.trim() !== selectedStem.title) {
              onRenameStem(selectedStem.id, nextTitle.trim());
            }
            if (nextColor !== selectedStem.color) {
              onChangeStemColor(selectedStem.id, nextColor);
            }
          }}
          onClose={() => setEditModalOpen(false)}
        />
      ) : null}
    </View>
  );
}

/** Name + color editor for a layer, combined into one Edit action — the same HueSlider
 *  used for workspace/section colors, so picking a layer's color matches the rest of the
 *  app. Draft state resets from props each time the modal opens. */
function EditLayerModal({
  visible,
  title,
  color,
  onSave,
  onClose,
}: {
  visible: boolean;
  title: string;
  color: string;
  onSave: (title: string, color: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [draftTitle, setDraftTitle] = useState(title);
  const [hue, setHue] = useState(() => hexToHue(color));
  const prevVisible = useRef(false);
  useEffect(() => {
    if (visible && !prevVisible.current) {
      setDraftTitle(title);
      setHue(hexToHue(color));
    }
    prevVisible.current = visible;
  }, [visible, title, color]);

  const previewColor = hueToAccentHex(hue);
  const trimmed = draftTitle.trim();

  return (
    <WarmModal visible={visible} onRequestClose={onClose} title={t("player.editLayer")}>
      <View style={benchStyles.colorPreviewRow}>
        <View style={[benchStyles.colorPreviewSwatch, { backgroundColor: previewColor }]} />
        <UserTextInput
          style={benchStyles.editNameInput}
          value={draftTitle}
          onChangeText={setDraftTitle}
          placeholder={t("player.layerName")}
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
        />
      </View>
      <HueSlider hue={hue} onChange={setHue} />
      <View style={benchStyles.editModalActions}>
        <Pressable
          style={({ pressed }) => [benchStyles.editModalCancel, pressed ? appStyles.pressDown : null]}
          onPress={onClose}
          accessibilityRole="button"
        >
          <Text style={benchStyles.editModalCancelText}>{t("common.cancel")}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            benchStyles.editModalConfirm,
            !trimmed ? benchStyles.editModalConfirmDisabled : null,
            pressed ? appStyles.pressDown : null,
          ]}
          onPress={() => {
            if (!trimmed) return;
            onSave(trimmed, previewColor);
            onClose();
          }}
          disabled={!trimmed}
          accessibilityRole="button"
        >
          <Text style={benchStyles.editModalConfirmText}>{t("common.save")}</Text>
        </Pressable>
      </View>
    </WarmModal>
  );
}

const benchStyles = StyleSheet.create({
  colorPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  colorPreviewSwatch: {
    width: 28,
    height: 28,
    borderRadius: radii.round,
  },
  editNameInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.textPrimary,
    paddingVertical: 6,
  },
  editModalActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 8,
  },
  editModalCancel: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  editModalCancelText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.textSecondary,
  },
  // Soft key, not a stadium pill (button language locked 2026-07-24): tonal
  // terracotta wash carries the commit.
  editModalConfirm: {
    borderRadius: radii.lg,
    backgroundColor: colors.primarySurface,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  editModalConfirmDisabled: {
    opacity: 0.5,
  },
  editModalConfirmText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.primaryDeep,
  },
  bench: {
    gap: spacing.md,
  },
  section: {
    gap: 14,
  },
  timingGroup: {
    gap: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  laneDot: {
    width: 10,
    height: 10,
    borderRadius: radii.round,
  },
  title: {
    flex: 1,
    fontFamily: "Lora_600SemiBold",
    fontSize: 17,
    color: colors.textPrimary,
  },
  duration: {
    ...textTokens.supporting,
    fontVariant: ["tabular-nums"],
  },
  menuButton: {
    width: 30,
    height: 30,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
  },
  faceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  key: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceHigh,
  },
  keyActive: {
    backgroundColor: colors.primarySurface,
  },
  keyDisabled: {
    opacity: 0.45,
  },
  keyTrailing: {
    marginStart: "auto",
  },
  keyText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textStrong,
  },
  keyTextActive: {
    color: colors.primaryDeep,
  },
  roundKey: {
    width: 38,
    height: 38,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceHigh,
  },
  roundKeyActive: {
    backgroundColor: colors.primarySurface,
  },
  soloScrubber: {
    width: "100%",
    height: 26,
    marginTop: -4,
  },
  levelsDrawer: {
    gap: 6,
    paddingVertical: 2,
  },
  gainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  gainSlider: {
    flex: 1,
    height: 30,
  },
  gainReadout: {
    minWidth: 52,
    textAlign: "right",
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  toneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  toneInk: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 4,
  },
  toneInkDot: {
    width: 8,
    height: 8,
    borderRadius: radii.round,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
  },
  toneInkText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textSecondary,
  },
  toneInkTextActive: {
    color: colors.primaryDeep,
  },
  nudgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  // Quiet ink, not chips: nudges are tapped rhythmically — text invites that, fills don't.
  nudgeKey: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  nudgeKeyText: {
    fontSize: 12,
    lineHeight: 15,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textStrong,
    fontVariant: ["tabular-nums"],
  },
  offsetReadout: {
    ...textTokens.supporting,
    fontVariant: ["tabular-nums"],
    minWidth: 52,
    textAlign: "center",
  },
  originalButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginStart: "auto",
  },
  originalButtonDisabled: {
    opacity: 0.4,
  },
  originalButtonText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textSecondary,
  },
  footLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  footLinkText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textSecondary,
  },
});
