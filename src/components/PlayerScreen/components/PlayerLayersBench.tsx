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
import { useOverdubAlignmentAudition, type AlignmentAuditionTarget } from "../hooks/useOverdubAlignmentAudition";
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
import { colors, radii, text as textTokens } from "../../../design/tokens";
import { styles as appStyles } from "../../../styles";
import { haptic } from "../../../design/haptics";
import { fmtDuration } from "../../../utils";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { UserText } from "../../../i18n";
import { userFacingMessage } from "../../../i18n/userFacingError";

/**
 * A take's layers, behind the lanes (2026-10-22, founder: "the lanes as the list").
 * The lanes under the reel are the one place layers show: each is its name, where it
 * plays, Solo and Mute. This draws nothing of its own until asked: a layer's sheet
 * (play together, solo, alignment, timing, level, tone, rename, remove) when a lane is
 * opened, and the merge picker. It owns the layer audio (Solo, Play together) and drives
 * the reel's playhead while that audio sounds.
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

export type AuditionFiles = { bedUri: string; layerUri: string; layerLeadMs: number };

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
  /** The reel's pause hold: the tape ignores reports for a moment after any pause,
   *  so handing it back to its resting place has to go through this. */
  sharedPauseHoldMs?: SharedValue<number>;
  sharedPauseHoldToken?: SharedValue<number>;
};

/** What the player drives (the lanes under the reel are the layer list). */
export type LayerSheetHandle = {
  openLayer: (stemId: string) => void;
  toggleSolo: (stemId: string) => void;
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
  transportClock: BenchTransportClock;
  /** Where the main transport rests — the playhead returns here when bench audio stops. */
  getRestingPositionMs: () => number;
  /** Second-granularity position for the header's mm:ss readout while bench audio is
   *  what's sounding; null hands the readout back to the main transport. */
  onDisplayPositionChange?: (ms: number | null) => void;
  onPauseMainPlayback: () => Promise<void>;
  onAdjustStemGain: (stemId: string, deltaDb: number) => void;
  onNudgeStem: (stemId: string, deltaMs: number) => void;
  onRenameStem: (stemId: string, title: string) => void;
  onToggleStemToneFlag: (stemId: string, flag: OverdubToneFlag) => void;
  onRemoveStem: (stemId: string) => void;
  onSaveAsOneClip: (mode: "copy" | "replace") => void;
  /** The layer whose Solo is sounding (null: none), for the lanes' Solo keys. */
  onSoloChange?: (stemId: string | null) => void;
  /** Layer audio started or stopped sounding (the reel follows it meanwhile). */
  onAudioActiveChange?: (active: boolean) => void;
  /** The layers' help (formerly on the Layers view's bar). */
  onHelp?: () => void;
  /** Play together's files for a layer: the song without it, and the layer with its
   *  level and tone after `layerLeadMs` of silence. Null: play the raw files. */
  prepareAudition?: (stemId: string) => Promise<AuditionFiles | null>;
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
    transportClock,
    getRestingPositionMs,
    onDisplayPositionChange,
    onPauseMainPlayback,
    onAdjustStemGain,
    onNudgeStem,
    onRenameStem,
    onToggleStemToneFlag,
    onRemoveStem,
    onSaveAsOneClip,
    onSoloChange,
    onAudioActiveChange,
    onHelp,
    prepareAudition,
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
    const restingMs = getRestingPositionMs();
    transportClock.sharedIsPlaying.value = false;
    transportClock.sharedCurrentTimeMs.value = restingMs;
    transportClock.sharedUpdateToken.value += 1;
    // Without this the tape stayed where the bench audio stopped while the readout
    // said the resting time (2026-10-22).
    if (transportClock.sharedPauseHoldMs && transportClock.sharedPauseHoldToken) {
      transportClock.sharedPauseHoldMs.value = restingMs;
      transportClock.sharedPauseHoldToken.value += 1;
    }
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

  // "Original" is where the layer was recorded (founder, 2026-10-22). Layers saved
  // before that was kept fall back to where it was when this sitting began.
  const baselineRef = useRef<{ stemId: string; offsetMs: number } | null>(null);
  if (selectedStem && baselineRef.current?.stemId !== selectedStem.id) {
    baselineRef.current = { stemId: selectedStem.id, offsetMs: selectedStem.offsetMs };
  }
  const baselineOffsetMs =
    selectedStem?.recordedOffsetMs ?? baselineRef.current?.offsetMs ?? selectedStem?.offsetMs ?? 0;
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

  // Second-granularity position for the header's mm:ss readout — one commit per
  // displayed second, the same cadence the main transport's readout renders at. The
  // strip no longer follows it: its window re-centring once a second read as the
  // playhead jumping (2026-10-22); the window stays on the layer, the cursor moves.
  const lastSentSecondRef = useRef<number | null>(null);
  useEffect(() => {
    if (!benchAudible) {
      lastSentSecondRef.current = null;
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
      onDisplayPositionChange?.(ms);
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => {
      clearInterval(interval);
      lastSentSecondRef.current = null;
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
    const stem = selectedStem;
    auditionRestartTimerRef.current = setTimeout(() => {
      auditionRestartTimerRef.current = null;
      lastAuditionOffsetRef.current = stem.offsetMs;
      void auditionTargetFor(stem)
        .then((target) => (target ? audition.start(target) : audition.stop()))
        .catch(() => {
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

  async function toggleSolo({ felt = true }: { felt?: boolean } = {}) {
    if (!selectedStem?.audioUri) return;
    if (felt) haptic.tap(); // Vocabulary: tap = control toggles.
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
      const message = userFacingMessage(error, t("player.layerPlayFailed"));
      console.warn("Layer solo failed", error);
      AppAlert.error(t("player.layerPreviewFailed"), message);
    }
  }

  // Play together's two files (the song without this layer, and the layer) come
  // from the owner, rendered once and cached; without a renderer it falls back to
  // the raw base take and the raw layer.
  const [auditionPreparing, setAuditionPreparing] = useState(false);
  const prepareRunRef = useRef(0);
  async function auditionTargetFor(stem: BenchStemEntry): Promise<AlignmentAuditionTarget | null> {
    if (!stem.audioUri || !rootAudioUri) return null;
    let files: AuditionFiles | null = null;
    if (prepareAudition) {
      try {
        files = await prepareAudition(stem.id);
      } catch (error) {
        console.warn("Play together render failed — playing the raw take", error);
      }
    }
    return {
      stemId: stem.id,
      bedUri: files?.bedUri ?? rootAudioUri,
      layerUri: files?.layerUri ?? stem.audioUri,
      layerLeadMs: files?.layerLeadMs ?? 0,
      layerVolume: files ? 1 : overdubGainDbToPlayerVolume(stem.gainDb),
      offsetMs: stem.offsetMs,
      layerDurationMs: stem.durationMs,
    };
  }

  async function togglePlayHere() {
    if (!selectedStem) return;
    haptic.tap(); // Vocabulary: tap = control toggles.
    const run = ++prepareRunRef.current;
    if (isAuditioning || auditionPreparing) {
      setAuditionPreparing(false);
      audition.stop();
      return;
    }
    if (!selectedStem.audioUri || !rootAudioUri) return;
    pauseSoloSafely();
    setSoloActive(false);
    lastAuditionOffsetRef.current = selectedStem.offsetMs;
    void onPauseMainPlayback().catch(() => {});
    setAuditionPreparing(true);
    try {
      const target = await auditionTargetFor(selectedStem);
      if (run !== prepareRunRef.current || !target) return;
      await audition.start(target);
    } catch (error) {
      console.warn("Alignment audition failed", error);
      haptic.error(); // Vocabulary: failures fire error.
      audition.stop();
    } finally {
      if (run === prepareRunRef.current) setAuditionPreparing(false);
    }
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
    setSelectedLaneId(stemId);
  }
  useEffect(() => {
    if (pendingSoloRef.current && pendingSoloRef.current === selectedStem?.id && !soloActive) {
      pendingSoloRef.current = null;
      void toggleSolo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStem?.id, soloActive]);

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
    audition.stop();
    pauseSoloSafely();
    setSoloActive(false);
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

  // Playing together belongs to the sheet: closing it stops that. Solo stays — it
  // has its own key on the row.
  function closeSheet() {
    setSheetOpen(false);
    if (audition.auditioningStemId) audition.stop();
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
              if (stem.id === selectedStem?.id) {
                audition.stop();
                pauseSoloSafely();
                setSoloActive(false);
              }
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
    toggleSolo: requestSolo,
    startMerge: () => {
      setSheetOpen(false);
      setMergePicks(selectedStem ? [selectedStem.id] : []);
    },
    openCombine: openSaveAsOneClip,
  }));

  // The lanes light Solo from this.
  const soloingStemId = soloActive && soloStatus.playing ? selectedStem?.id ?? null : null;
  useEffect(() => {
    onSoloChange?.(soloingStemId);
  }, [soloingStemId, onSoloChange]);
  useEffect(() => {
    onAudioActiveChange?.(benchAudible);
  }, [benchAudible, onAudioActiveChange]);

  const stemTools = selectedStem ? (
    <View style={benchStyles.tools}>
      {/* The alignment strip: this layer against the take; slide it to move it. */}
      <StemAlignmentOverlay
        headerLeading={
          <View style={benchStyles.playKeys}>
            <InkKey
              // Haptics: the toggle fires its own `tap` (togglePlayHere).
              haptic="none"
              tone={isAuditioning || auditionPreparing ? "active" : "idle"}
              label={t("player.playTogetherShort")}
              glyph={
                auditionPreparing ? (
                  <Spinner size="small" color={inkKeyColor("active")} accessibilityLabel={t("player.updatingMix")} />
                ) : (
                  <Ionicons
                    name={isAuditioning ? "stop" : "play"}
                    size={14}
                    color={inkKeyColor(isAuditioning ? "active" : "idle")}
                  />
                )
              }
              onPress={() => void togglePlayHere()}
              accessibilityLabel={isAuditioning ? t("player.stopTogether") : t("player.playTogether")}
            />
            <InkKey
              // Haptics vocabulary: `tap` — a control toggles (the key's own; toggleSolo stays quiet).
              haptic="tap"
              tone={soloActive && soloStatus.playing ? "active" : "idle"}
              label={t("player.solo")}
              glyph={
                <Ionicons
                  name={soloActive && soloStatus.playing ? "stop" : "play"}
                  size={14}
                  color={inkKeyColor(soloActive && soloStatus.playing ? "active" : "idle")}
                />
              }
              onPress={() => void toggleSolo({ felt: false })}
              accessibilityLabel={t("player.playAloneA11y")}
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
        sharedPlayheadMs={sharedStripPlayheadMs}
        playheadColor={colors.playhead}
      />
      {/* Solo: the layer's own tape, scrubbable while it is loaded. Under the strip, so
          the sheet does not jump when it appears. */}
      {soloActive ? (
        <View style={benchStyles.soloRow}>
        <Text style={benchStyles.soloTime}>{fmtDuration(soloPositionMs)}</Text>
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
        <Text style={benchStyles.soloTime}>{fmtDuration(soloDurationMs)}</Text>
        </View>
      ) : null}


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
  playKeys: {
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
  // Solo's own tape: where in the layer you are, start and end in time, so it
  // reads as a playhead and not as another setting.
  soloRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  soloScrubber: {
    flex: 1,
    height: 26,
  },
  soloTime: {
    ...textTokens.caption,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
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
