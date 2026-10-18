import { useNavigation } from "@react-navigation/native";
import { useAudioPlayer } from "expo-audio";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Spinner } from "../common/Spinner";
import { Ionicons } from "@expo/vector-icons";
import { audioDeviceManager, type AudioDevice } from "@siteed/audio-studio";
import { AppAlert } from "../common/AppAlert";
import { actionIcons } from "../common/actionIcons";
import { Button } from "../common/Button";
import { ScreenHeader } from "../common/ScreenHeader";
import { InkLink } from "../common/InkLink";
import { ListRow, ListRows } from "../common/ListRow";
import { Stepper } from "../common/Stepper";
import { toast } from "../common/toastStore";
import { styles as globalStyles } from "../../styles";
import { haptic } from "../../design/haptics";
import { useStore } from "../../state/useStore";
import { ensureCalibrationClickTrackFile } from "../../services/metronomeLoop";
import {
  activatePlaybackAudioSession,
  releaseAudioSessionOwner,
} from "../../services/audioSession";
import { sanitizeOsOutputLatencyMs } from "../../services/latencyModel";
import SongNookMetronomeModule from "../../../modules/songnook-metronome";
import { colors } from "../../design/tokens";
import {
  buildBluetoothMonitoringRouteKey,
  buildBluetoothMonitoringRouteLabel,
  isBluetoothLikeAudioDevice,
  normalizeBluetoothMonitoringOffsetMs,
  normalizeBluetoothMonitoringSavedOffsetMs,
  type AudioRouteLike,
} from "../../domain/bluetoothMonitoring";
import {
  CALIBRATION_BEAT_COUNT,
  CALIBRATION_BEAT_INTERVAL_MS,
  CALIBRATION_BPM,
  IGNORED_LEAD_IN_BEATS,
  analyzeAudioPhaseTaps,
  analyzePatternPhaseTaps,
  buildCalibrationGapPattern,
  buildResultWarning,
  median,
} from "./calibrationAnalysis";
import { screenStyles } from "./styles";
import { useTranslation } from "react-i18next";

const START_DELAY_MS = 1500;
const COUNTDOWN_STEP_MS = 500;
/** One Stepper detent on a measured delay: fine enough to hear, coarse enough to hold. */
const OFFSET_STEP_MS = 10;

/** Two ear-measured passes: the PLAYER pass beeps through the media pipeline the
 *  guide/master uses; the CLICK pass runs the real metronome engine. On many devices the
 *  two pipelines differ by hundreds of ms — one number cannot serve both.
 *  Both passes play a steady grid with a few RANDOMLY SILENCED beats (fresh pattern per
 *  run): taps stay predictive — prediction cancels reaction time, which a random
 *  "hearing test" beep cannot — while the gap fingerprint pins each tap to its true
 *  beat, so a consistent early tapper measures slightly negative instead of aliasing
 *  into a huge late offset. */
type CalibrationPhase = "idle" | "player-running" | "click-running" | "result";

type RouteInfo = AudioRouteLike;

export function BluetoothCalibrationScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const calibrations = useStore((state) => state.bluetoothMonitoringCalibrations);
  const setCalibration = useStore((state) => state.setBluetoothMonitoringCalibration);
  const removeCalibration = useStore((state) => state.removeBluetoothMonitoringCalibration);

  const [currentDevice, setCurrentDevice] = useState<AudioDevice | null>(null);
  const [currentOutputRoute, setCurrentOutputRoute] = useState<RouteInfo | null>(null);
  const [phase, setPhase] = useState<CalibrationPhase>("idle");
  const [phaseElapsedMs, setPhaseElapsedMs] = useState(0);
  /** Player-pipeline result (guide/master playback path). */
  const [estimatedOffsetMs, setEstimatedOffsetMs] = useState<number | null>(null);
  /** Click-pipeline result (metronome path). */
  const [estimatedClickOffsetMs, setEstimatedClickOffsetMs] = useState<number | null>(null);
  const [phaseError, setPhaseError] = useState<string | null>(null);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [lastAnalysisSummary, setLastAnalysisSummary] = useState<string | null>(null);
  /** The NEXT run's gap pattern. Its beep file bakes while the screen is idle, so
   *  Start never waits on synthesis; each completed run rolls a fresh pattern. */
  const [pendingPattern, setPendingPattern] = useState<boolean[]>(() => buildCalibrationGapPattern());
  const [audioLoopUri, setAudioLoopUri] = useState<string | null>(null);
  const [isPreparingAudio, setIsPreparingAudio] = useState(false);
  const [bluetoothTargetRoute, setBluetoothTargetRoute] = useState<{ routeKey: string; routeLabel: string } | null>(
    null
  );
  const [reportedLatencyMs, setReportedLatencyMs] = useState<number | null>(null);

  const timersRef = useRef<number[]>([]);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseStartAtRef = useRef<number | null>(null);
  /** Tap timestamps as epochs — converted to grid-relative residuals at analysis time,
   *  so a late anchor refinement re-bases every tap instead of only the ones after it. */
  const tapEpochsRef = useRef<number[]>([]);
  /** Player-pass anchor candidates. A single position read can return a stale value and
   *  shift the WHOLE measurement by a constant (a 600ms outlier against a real ~340ms
   *  poisoned every BT take until recalibration) — the median of several reads can't. */
  const anchorSamplesRef = useRef<number[]>([]);
  const playerOffsetDraftRef = useRef<number | null>(null);
  /** The pattern of the run in flight (frozen at Start; pendingPattern rolls on). */
  const runPatternRef = useRef<boolean[] | null>(null);
  /** The result steppers hold a SAVED calibration (its menu's Fine-tune), not a run. */
  const fineTuningSavedRef = useRef(false);
  /** Whether the click pass actually rendered the gap pattern (needs silent-beat
   *  support in the native binary) — decides which analysis reads its taps. */
  const clickPatternActiveRef = useRef(false);
  /** Bumped by Stop, Retry and leaving the page. The click pass's start is async
   *  (configure, start, a settle, an anchor read): each step checks it is still the
   *  run in flight, so a Stop in that window can't start the engine afterwards or
   *  arm a finish timer nothing clears (audit 2026-10-18). */
  const runIdRef = useRef(0);

  const audioPlayer = useAudioPlayer(audioLoopUri ? { uri: audioLoopUri } : null, { updateInterval: 250 });
  // The player instance is recreated whenever the pattern (and its file) changes; timer
  // callbacks scheduled before that must reach the CURRENT instance, not their closure's.
  const audioPlayerRef = useRef(audioPlayer);
  audioPlayerRef.current = audioPlayer;

  const activeRoute = currentOutputRoute ?? currentDevice;
  const activeRouteKey = useMemo(() => buildBluetoothMonitoringRouteKey(activeRoute), [activeRoute]);
  const activeRouteLabel = useMemo(() => buildBluetoothMonitoringRouteLabel(activeRoute, t), [activeRoute, t]);
  const isBluetoothRoute = useMemo(() => isBluetoothLikeAudioDevice(activeRoute), [activeRoute]);
  const isHfpRoute = currentOutputRoute?.profile === "hfp";
  const editableRouteKey = bluetoothTargetRoute?.routeKey ?? (isBluetoothRoute ? activeRouteKey : null);
  const editableRouteLabel = bluetoothTargetRoute?.routeLabel ?? (isBluetoothRoute ? activeRouteLabel : null);

  // Recording flows leave a higher-priority "recording" session owner active, which
  // keeps `allowsRecording` on, which keeps the headset mic claimed — and Bluetooth
  // monitoring stuck on the phone-call (HFP) profile whose latency has nothing to do
  // with normal listening. The EXCLUSIVE playback claim outranks that owner for as long
  // as this screen is open, so the route renegotiates to the profile takes monitor on.
  useEffect(() => {
    void activatePlaybackAudioSession({
      ownerId: "bluetooth-calibration",
      force: true,
      exclusive: true,
    }).catch(() => {});
    return () => {
      void releaseAudioSessionOwner("bluetooth-calibration").catch(() => {});
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshCurrentDevice() {
      try {
        const device = await audioDeviceManager.getCurrentDevice();
        const outputRoute = await SongNookMetronomeModule?.getCurrentAudioOutputRoute?.();
        // OS-reported route latency (iOS reliable incl. BT codec buffer; Android best-effort).
        // Used to seed the estimate so the tap pass verifies instead of measuring from zero.
        const routeLatency = await SongNookMetronomeModule?.getCurrentAudioRouteLatencyMs?.().catch(() => null);
        if (!cancelled) {
          setCurrentDevice(device ?? null);
          setCurrentOutputRoute(outputRoute ?? null);
          // Sanitize through the latency model: raw values can be buffer-inflated garbage
          // (device logs: 209ms reported where the real sink latency is 108ms — and a
          // poisoned "use reported" seed corrupts every cue and trim downstream).
          const sanitized = sanitizeOsOutputLatencyMs(routeLatency?.outputMs ?? null, null);
          setReportedLatencyMs(sanitized.source === "os" ? Math.round(sanitized.outputMs) : null);
        }
      } catch {
        if (!cancelled) {
          setCurrentDevice(null);
          setCurrentOutputRoute(null);
          setReportedLatencyMs(null);
        }
      }
    }

    void refreshCurrentDevice();
    const removeListener = audioDeviceManager.addDeviceChangeListener(() => {
      void refreshCurrentDevice();
    });

    return () => {
      cancelled = true;
      removeListener();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsPreparingAudio(true);
    void ensureCalibrationClickTrackFile(CALIBRATION_BPM, CALIBRATION_BEAT_COUNT, pendingPattern)
      .then((loop) => {
        if (!cancelled) {
          setAudioLoopUri(loop.uri);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAudioLoopUri(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsPreparingAudio(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pendingPattern]);

  // Unmount only: a mid-run exit already cleared the finish timers that would have
  // stopped the engine and the player — without this the click ticks on forever behind
  // whatever screen comes next.
  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      timersRef.current.forEach((timer) => clearTimeout(timer));
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      try {
        audioPlayerRef.current.pause();
      } catch {
        // ignore cleanup noise
      }
      void SongNookMetronomeModule?.stop().catch(() => {});
    };
  }, []);

  function clearPhaseTimers() {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }

  function resetRunState(nextPhase: CalibrationPhase = "idle") {
    clearPhaseTimers();
    tapEpochsRef.current = [];
    anchorSamplesRef.current = [];
    phaseStartAtRef.current = null;
    setPhase(nextPhase);
    setPhaseElapsedMs(0);
    setCountdownValue(null);
    // Roll the next run's gap pattern the moment this one ends; its file bakes while
    // the user reads the result.
    setPendingPattern(buildCalibrationGapPattern());
  }

  async function stopAudioPlayback() {
    try {
      audioPlayerRef.current.pause();
      await audioPlayerRef.current.seekTo(0);
    } catch {
      // ignore player cleanup failures
    }
  }

  async function startAudioPlayback() {
    if (!audioLoopUri) {
      return;
    }
    try {
      const player = audioPlayerRef.current;
      anchorSamplesRef.current = [];
      await player.seekTo(0);
      player.play();

      // Re-anchor the tap grid to when audio *actually* started. The player's own start
      // latency (20–150 ms, different every run) would otherwise be measured as route
      // latency, which is the largest fixable error in this calibration (audit F13).
      const anchorDeadline = Date.now() + 1500;
      while (Date.now() < anchorDeadline) {
        const positionSec = player.currentTime ?? 0;
        if (player.playing && positionSec > 0) {
          phaseStartAtRef.current = Date.now() - positionSec * 1000;
          anchorSamplesRef.current.push(phaseStartAtRef.current);
          break;
        }
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 16);
        });
      }

      // Keep re-deriving the anchor while the pass plays; the analysis uses the median.
      [700, 1600, 2800].forEach((delayMs) => {
        const sampleTimer = setTimeout(() => {
          const positionSec = player.currentTime ?? 0;
          if (player.playing && positionSec > 0) {
            anchorSamplesRef.current.push(Date.now() - positionSec * 1000);
          }
        }, delayMs);
        timersRef.current.push(sampleTimer as unknown as number);
      });
    } catch {
      // Ignore calibration playback failures; analysis will likely fail and prompt retry.
    }
  }

  function setPhaseFailure(tappedBeatCount: number) {
    setLastAnalysisSummary(t("bluetoothCalibration.capturedBeats", { count: tappedBeatCount }));
    setPhaseError(t("bluetoothCalibration.inconsistent"));
    // haptics.ts vocabulary: error → something failed (the run produced nothing).
    haptic.error();
    resetRunState("idle");
  }

  function completePlayerPass() {
    const anchorMs =
      anchorSamplesRef.current.length > 0 ? median(anchorSamplesRef.current) : phaseStartAtRef.current;
    const tapTimes =
      anchorMs != null ? tapEpochsRef.current.map((epoch) => epoch - anchorMs) : [];
    const pattern = runPatternRef.current;
    const analysis = pattern
      ? analyzePatternPhaseTaps(tapTimes, pattern)
      : analyzeAudioPhaseTaps(tapTimes, CALIBRATION_BEAT_COUNT);
    if (!analysis) {
      const analyzedTapCount = Math.max(
        0,
        [...new Set(tapTimes.map((tap) => Math.round(tap / CALIBRATION_BEAT_INTERVAL_MS)))].length -
          IGNORED_LEAD_IN_BEATS
      );
      setPhaseFailure(analyzedTapCount);
      return;
    }

    playerOffsetDraftRef.current = normalizeBluetoothMonitoringOffsetMs(analysis.medianMs);
    setEstimatedOffsetMs(playerOffsetDraftRef.current);
    setPhaseError(null);
    setLastAnalysisSummary(
      t("bluetoothCalibration.musicSummary", {
        count: analysis.tapCount,
        spread: Math.round(analysis.madMs),
      })
    );
    // The two audible pipelines differ by hundreds of ms on some devices — measure the
    // metronome click path with its own pass instead of reusing the player number.
    void startClickPass();
  }

  async function startClickPass() {
    if (!SongNookMetronomeModule?.isAvailable?.()) {
      setEstimatedClickOffsetMs(null);
      resetRunState("result");
      return;
    }

    clearPhaseTimers();
    tapEpochsRef.current = [];
    setPhase("click-running");
    setPhaseElapsedMs(0);
    setCountdownValue(3);
    [3, 2, 1].forEach((value, index) => {
      const countdownTimer = setTimeout(() => {
        setCountdownValue(value);
      }, index * COUNTDOWN_STEP_MS);
      timersRef.current.push(countdownTimer as unknown as number);
    });

    const runId = ++runIdRef.current;
    const stillThisRun = () => runIdRef.current === runId;
    const startTimer = setTimeout(() => {
      void (async () => {
        try {
          if (!stillThisRun()) return;
          setCountdownValue(null);
          // Old binaries render accent 0 as a quiet click, not a rest — fall back to a
          // steady pass there and route its taps through the legacy analysis.
          const pattern = runPatternRef.current;
          const patternActive = !!pattern && !!SongNookMetronomeModule?.supportsSilentBeats?.();
          clickPatternActiveRef.current = patternActive;
          await SongNookMetronomeModule!.configure({
            bpm: CALIBRATION_BPM,
            meterId: "4/4",
            pulsesPerBar: patternActive ? CALIBRATION_BEAT_COUNT : 4,
            denominator: 4,
            accentPattern: patternActive
              ? pattern!.map((played) => (played ? 0.5 : 0))
              : [1, 0.5, 0.5, 0.5],
            clickEnabled: true,
            clickVolume: 0.6,
            outputLatencyMs: 0,
            // The engine MERGES configs, so a haptics-on setting left by a previous
            // metronome session would survive into this pass — and a buzz on the true
            // grid while the beep arrives late is a second, contradictory cue that
            // corrupts the very tap timing this pass measures. Calibration is ears-only.
            hapticEnabled: false,
            hapticStrength: 0,
            hapticOffsetMs: 0,
            // Same merge hazard for the click itself: the onset analysis expects the
            // stock click, one per beat — never a sub-click or the wood voice.
            subdivision: 1,
            clickVoice: "click",
          });
          if (!stillThisRun()) return;
          await SongNookMetronomeModule!.start();
          if (!stillThisRun()) {
            void SongNookMetronomeModule!.stop().catch(() => {});
            return;
          }

          // Anchor taps to the engine's render-domain grid: tap-time − grid-time IS the
          // click pipeline's ear latency, which is exactly what this pass measures.
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 150);
          });
          const anchor = await SongNookMetronomeModule!.getGridAnchor?.().catch(() => null);
          if (!stillThisRun()) {
            void SongNookMetronomeModule!.stop().catch(() => {});
            return;
          }
          if (!anchor?.isRunning || anchor.anchorEpochMs == null) {
            void SongNookMetronomeModule!.stop().catch(() => {});
            setEstimatedClickOffsetMs(null);
            setLastAnalysisSummary(t("bluetoothCalibration.clickUnavailable"));
            resetRunState("result");
            return;
          }
          phaseStartAtRef.current = anchor.anchorEpochMs;
          progressIntervalRef.current = setInterval(() => {
            if (phaseStartAtRef.current == null) return;
            setPhaseElapsedMs(Date.now() - phaseStartAtRef.current);
          }, 33);

          const finishTimer = setTimeout(() => {
            void SongNookMetronomeModule!.stop().catch(() => {});
            completeClickPass();
          }, CALIBRATION_BEAT_COUNT * CALIBRATION_BEAT_INTERVAL_MS + 300);
          timersRef.current.push(finishTimer as unknown as number);
        } catch {
          void SongNookMetronomeModule?.stop().catch(() => {});
          if (!stillThisRun()) return;
          setEstimatedClickOffsetMs(null);
          setLastAnalysisSummary(t("bluetoothCalibration.clickStartFailed"));
          resetRunState("result");
        }
      })();
    }, START_DELAY_MS);
    timersRef.current.push(startTimer as unknown as number);
  }

  function completeClickPass() {
    const anchorMs = phaseStartAtRef.current;
    const tapTimes = anchorMs != null ? tapEpochsRef.current.map((epoch) => epoch - anchorMs) : [];
    const pattern = clickPatternActiveRef.current ? runPatternRef.current : null;
    const analysis = pattern
      ? analyzePatternPhaseTaps(tapTimes, pattern)
      : analyzeAudioPhaseTaps(tapTimes, CALIBRATION_BEAT_COUNT);
    if (!analysis) {
      setEstimatedClickOffsetMs(null);
      setLastAnalysisSummary((current) =>
        `${current ?? ""} ${t("bluetoothCalibration.clickInconsistent")}`.trim()
      );
      resetRunState("result");
      return;
    }
    const clickMs = normalizeBluetoothMonitoringOffsetMs(analysis.medianMs);
    setEstimatedClickOffsetMs(clickMs);
    setLastAnalysisSummary(
      (current) =>
        `${current ?? ""} ${t("bluetoothCalibration.clickSummary", {
          count: analysis.tapCount,
          spread: Math.round(analysis.madMs),
        })}`.trim()
    );
    resetRunState("result");
  }

  function schedulePhase() {
    fineTuningSavedRef.current = false;
    if (isPreparingAudio) {
      return;
    }
    if (!isBluetoothRoute || !activeRouteKey) {
      setPhaseError(t("bluetoothCalibration.switchOutput"));
      return;
    }
    setBluetoothTargetRoute({
      routeKey: activeRouteKey,
      routeLabel: activeRouteLabel,
    });

    clearPhaseTimers();
    tapEpochsRef.current = [];
    anchorSamplesRef.current = [];
    playerOffsetDraftRef.current = null;
    // Freeze the prepared pattern for this run — the pending one (and its beep file)
    // must not roll underneath a pass in flight.
    runPatternRef.current = pendingPattern;
    clickPatternActiveRef.current = false;
    setEstimatedClickOffsetMs(null);
    setPhase("player-running");
    setPhaseElapsedMs(0);
    setPhaseError(null);
    setLastAnalysisSummary(null);
    setCountdownValue(3);

    [3, 2, 1].forEach((value, index) => {
      const countdownTimer = setTimeout(() => {
        setCountdownValue(value);
      }, index * COUNTDOWN_STEP_MS);
      timersRef.current.push(countdownTimer as unknown as number);
    });

    const startTimer = setTimeout(() => {
      setCountdownValue(null);
      phaseStartAtRef.current = Date.now();
      progressIntervalRef.current = setInterval(() => {
        if (phaseStartAtRef.current == null) {
          return;
        }
        setPhaseElapsedMs(Date.now() - phaseStartAtRef.current);
      }, 33);

      void startAudioPlayback();

      // Slack covers the player start latency the anchor re-anchors around, so the final
      // beat still falls inside the capture window even when playback started late.
      const finishTimer = setTimeout(() => {
        void stopAudioPlayback().finally(() => {
          completePlayerPass();
        });
      }, CALIBRATION_BEAT_COUNT * CALIBRATION_BEAT_INTERVAL_MS + 300);
      timersRef.current.push(finishTimer as unknown as number);
    }, START_DELAY_MS);

    timersRef.current.push(startTimer as unknown as number);
  }

  const isPassRunning = phase === "player-running" || phase === "click-running";

  // A route change mid-pass (headphones disconnect, profile renegotiation) means the
  // beeps stopped reaching the ears being measured — the run is garbage. Abort instead
  // of saving speaker latency under the Bluetooth route's key.
  useEffect(() => {
    if (!isPassRunning || !bluetoothTargetRoute) {
      return;
    }
    if (activeRouteKey !== bluetoothTargetRoute.routeKey) {
      void SongNookMetronomeModule?.stop().catch(() => {});
      void stopAudioPlayback();
      setPhaseError(t("bluetoothCalibration.routeChangedAbort"));
      // haptics.ts vocabulary: error → something failed (the run was aborted).
      haptic.error();
      resetRunState("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRouteKey, isPassRunning, bluetoothTargetRoute]);

  function handleTap() {
    if (phase !== "player-running" && phase !== "click-running") {
      return;
    }
    if (phaseStartAtRef.current == null) {
      return;
    }
    tapEpochsRef.current.push(Date.now());
  }

  function adjustDraftOffset(deltaMs: number) {
    setEstimatedOffsetMs((current) => {
      if (current == null) {
        return current;
      }
      return normalizeBluetoothMonitoringSavedOffsetMs(current + deltaMs);
    });
  }

  function adjustClickDraftOffset(deltaMs: number) {
    setEstimatedClickOffsetMs((current) => {
      if (current == null) {
        return current;
      }
      return normalizeBluetoothMonitoringSavedOffsetMs(current + deltaMs);
    });
  }

  const phaseDurationMs = isPassRunning ? CALIBRATION_BEAT_COUNT * CALIBRATION_BEAT_INTERVAL_MS : 0;
  const phaseProgress =
    phaseDurationMs > 0 ? Math.max(0, Math.min(1, phaseElapsedMs / phaseDurationMs)) : 0;

  function handleSaveCalibration() {
    if (!editableRouteKey || !editableRouteLabel || estimatedOffsetMs == null) {
      return;
    }
    setCalibration(
      editableRouteKey,
      editableRouteLabel,
      estimatedOffsetMs,
      estimatedClickOffsetMs ?? undefined,
      // A saved calibration being fine-tuned keeps the OS report it was measured
      // against (undefined preserves it); only a fresh run stamps the current one.
      // Contemporaneous OS report → future sessions apply the ear numbers as a bias on
      // top of the then-current report, tracking per-connection BT drift automatically.
      fineTuningSavedRef.current ? undefined : reportedLatencyMs ?? undefined,
      fineTuningSavedRef.current ? "fineTune" : "fresh"
    );
    // haptics.ts vocabulary: success → a completion the user waited for, paired with a
    // toast (never a dialog — the result needs no decision).
    haptic.success();
    toast(t("bluetoothCalibration.savedToast"), "checkmark-outline");
    navigation.goBack();
  }

  function handleRemoveCalibration(routeKeyToRemove: string, routeLabelToRemove: string) {
    AppAlert.destructive(
      t("bluetoothCalibration.removeTitle"),
      t("bluetoothCalibration.removeBody", { name: routeLabelToRemove }),
      () => {
        removeCalibration(routeKeyToRemove);
        if (routeKeyToRemove === editableRouteKey) {
          setEstimatedOffsetMs(null);
        }
      },
      { confirmLabel: t("bluetoothCalibration.remove"), cancelLabel: t("bluetoothCalibration.keep"), icon: actionIcons.remove }
    );
  }

  /** Stop mid-pass: silence the beeps (the player pass) and the click engine
   *  (resetCalibrationRun) before returning to idle. */
  function stopPass() {
    void stopAudioPlayback();
    resetCalibrationRun();
  }

  function resetCalibrationRun() {
    runIdRef.current += 1;
    fineTuningSavedRef.current = false;
    void SongNookMetronomeModule?.stop().catch(() => {});
    setEstimatedOffsetMs(null);
    setEstimatedClickOffsetMs(null);
    playerOffsetDraftRef.current = null;
    setPhaseError(null);
    setLastAnalysisSummary(null);
    setBluetoothTargetRoute(null);
    resetRunState("idle");
  }

  // Skip the tap passes and start from the OS-reported route latency; the user can
  // fine-tune by ear with the ± buttons before saving. The OS number describes the raw
  // audio-track (click) pipeline; it also seeds the music value as a floor.
  function useReportedLatency() {
    fineTuningSavedRef.current = false;
    if (reportedLatencyMs == null || !isBluetoothRoute || !activeRouteKey) {
      return;
    }
    setBluetoothTargetRoute({
      routeKey: activeRouteKey,
      routeLabel: activeRouteLabel,
    });
    setEstimatedOffsetMs(normalizeBluetoothMonitoringSavedOffsetMs(reportedLatencyMs));
    setEstimatedClickOffsetMs(normalizeBluetoothMonitoringSavedOffsetMs(reportedLatencyMs));
    setPhaseError(null);
    setLastAnalysisSummary(t("bluetoothCalibration.seeded"));
    resetRunState("result");
  }

  /** Re-open a saved calibration on the result steppers, so both delays can be
   *  fine-tuned by ear and saved again (replaces the card's ±10 keys). */
  function fineTuneSaved(calibration: (typeof calibrations)[number]) {
    fineTuningSavedRef.current = true;
    setBluetoothTargetRoute({ routeKey: calibration.routeKey, routeLabel: calibration.routeLabel });
    setEstimatedOffsetMs(calibration.offsetMs);
    setEstimatedClickOffsetMs(calibration.clickOffsetMs ?? null);
    setPhaseError(null);
    setLastAnalysisSummary(null);
    resetRunState("result");
  }

  function openSavedMenu(calibration: (typeof calibrations)[number]) {
    // Order: act on it, then destroy (the menu law).
    AppAlert.menu(
      calibration.routeLabel,
      [
        {
          key: "fine-tune",
          label: t("bluetoothCalibration.fineTuneSaved"),
          icon: "options-outline",
          onPress: () => fineTuneSaved(calibration),
        },
        ...(isBluetoothRoute && activeRouteKey === calibration.routeKey && phase === "idle"
          ? [
              {
                key: "again",
                label: t("bluetoothCalibration.calibrateAgain"),
                icon: actionIcons.restore,
                onPress: schedulePhase,
              },
            ]
          : []),
        {
          key: "remove",
          label: t("bluetoothCalibration.remove"),
          icon: actionIcons.remove,
          tone: "danger" as const,
          onPress: () => handleRemoveCalibration(calibration.routeKey, calibration.routeLabel),
        },
      ],
      t("bluetoothCalibration.savedMetaShort", { music: calibration.offsetMs })
    );
  }

  const activeCalibration = calibrations.find((calibration) => calibration.routeKey === activeRouteKey);
  const routeMeta = isBluetoothRoute
    ? [
        activeCalibration
          ? t("bluetoothCalibration.calibratedMs", { value: activeCalibration.offsetMs })
          : t("bluetoothCalibration.notCalibrated"),
        ...(reportedLatencyMs != null ? [t("bluetoothCalibration.reports", { value: reportedLatencyMs })] : []),
      ].join(" · ")
    : t("bluetoothCalibration.switchOutput");
  // Read from the numbers on screen, so it holds on every way to a result (a failed
  // click pass, a seeded start) and follows the ± fine-tune instead of going stale.
  const resultWarning =
    phase === "result" ? buildResultWarning(estimatedOffsetMs, estimatedClickOffsetMs, reportedLatencyMs, t) : null;
  const resultNote =
    resultWarning ?? (phase === "result" && estimatedOffsetMs == null ? t("bluetoothCalibration.unstable") : null);

  return (
    <SafeAreaView style={globalStyles.screen}>
      {/* A pushed page: the honest back chevron with its origin, the name in
          Lora beneath (2026-10-16; was "Settings" twice and a narrating intro).
          While a pass runs the page steps aside for the tap pad. */}
      <View style={globalStyles.transportHeaderZone}>
        <ScreenHeader
          variant="place"
          title={isPassRunning ? "" : t("bluetoothCalibration.title")}
          leftIcon="back"
        />
      </View>

      <ScrollView style={globalStyles.flexFill} contentContainerStyle={screenStyles.scrollContent}>
        {isPassRunning ? (
          <View>
            <View style={screenStyles.passHead}>
              <Text style={screenStyles.label}>
                {phase === "player-running" ? t("bluetoothCalibration.musicPass") : t("bluetoothCalibration.clickPass")}
              </Text>
              <Text style={screenStyles.passPercent}>{Math.round(phaseProgress * 100)}%</Text>
            </View>
            <View style={screenStyles.progressTrack}>
              <View style={[screenStyles.progressFill, { width: `${Math.round(phaseProgress * 100)}%` }]} />
            </View>
            <Text style={screenStyles.line}>
              {countdownValue != null
                ? t("bluetoothCalibration.countdown", { count: countdownValue })
                : phase === "click-running"
                  ? t("bluetoothCalibration.clickInstruction")
                  : t("bluetoothCalibration.musicInstruction")}
            </Text>
            {/* The pad stays a raw press on purpose: no haptic of its own, nothing
                between the finger and the timestamp the analysis reads. */}
            <Pressable
              style={({ pressed }) => [screenStyles.tapPad, pressed ? globalStyles.pressDown : null]}
              onPress={handleTap}
              accessibilityRole="button"
              accessibilityLabel={t("bluetoothCalibration.tap")}
            >
              <Ionicons name="hand-left-outline" size={32} color={colors.primaryDeep} />
              <Text style={screenStyles.tapPadLabel}>{t("bluetoothCalibration.tap")}</Text>
            </Pressable>
            <Button
              variant="quiet"
              label={t("bluetoothCalibration.stop")}
              style={screenStyles.quietAction}
              textStyle={screenStyles.quietActionText}
              onPress={stopPass}
            />
          </View>
        ) : (
          <>
            <Text style={screenStyles.label}>{t("bluetoothCalibration.currentOutput")}</Text>
            <View style={screenStyles.rows}>
              <View style={screenStyles.row}>
                <View style={screenStyles.rowIcon}>
                  <Ionicons
                    name={isBluetoothRoute ? "bluetooth" : "volume-high-outline"}
                    size={19}
                    color={colors.textStrong}
                  />
                </View>
                <View style={screenStyles.rowCopy}>
                  <Text style={screenStyles.rowTitle} numberOfLines={1}>
                    {activeRouteLabel}
                  </Text>
                  <Text style={screenStyles.rowMeta}>{routeMeta}</Text>
                  {isBluetoothRoute && isHfpRoute ? (
                    <Text style={screenStyles.rowMeta}>{t("bluetoothCalibration.hfpActive")}</Text>
                  ) : null}
                </View>
              </View>
            </View>

            {phase === "idle" ? (
              <View>
                <Text style={screenStyles.line}>{t("bluetoothCalibration.musicInstruction")}</Text>
                {phaseError ? <Text style={screenStyles.error}>{phaseError}</Text> : null}
                {isPreparingAudio ? (
                  <View style={screenStyles.loadingRow}>
                    <Spinner size="small" color={colors.primaryDeep} />
                    <Text style={screenStyles.loadingText}>{t("bluetoothCalibration.preparing")}</Text>
                  </View>
                ) : null}
                <Button
                  label={t("bluetoothCalibration.start")}
                  onPress={schedulePhase}
                  disabled={!isBluetoothRoute || isPreparingAudio || !audioLoopUri}
                />
                {isBluetoothRoute && reportedLatencyMs != null ? (
                  <View style={screenStyles.linkRow}>
                    <InkLink
                      label={t("bluetoothCalibration.useReportedMs", { value: reportedLatencyMs })}
                      onPress={useReportedLatency}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

            {phase === "result" ? (
              <View>
                <View style={screenStyles.labelRow}>
                  <Text style={[screenStyles.label, screenStyles.labelFlex]}>
                    {t("bluetoothCalibration.resultTitle")}
                  </Text>
                  {editableRouteLabel ? (
                    <Text style={screenStyles.labelMeta} numberOfLines={1}>
                      {editableRouteLabel}
                    </Text>
                  ) : null}
                </View>
                <View style={screenStyles.rows}>
                  <View style={screenStyles.row}>
                    <View style={screenStyles.rowCopy}>
                      <Text style={screenStyles.rowTitle}>{t("bluetoothCalibration.music")}</Text>
                      <Text style={screenStyles.rowMeta}>{t("bluetoothCalibration.musicMeta")}</Text>
                    </View>
                    <Stepper
                      glyphs="plusMinus"
                      canDecrement={estimatedOffsetMs != null}
                      canIncrement={estimatedOffsetMs != null}
                      decrementLabel={t("bluetoothCalibration.earlierA11y")}
                      incrementLabel={t("bluetoothCalibration.laterA11y")}
                      onStep={(direction) => adjustDraftOffset(direction * OFFSET_STEP_MS)}
                    >
                      <Text style={screenStyles.delayValue}>
                        {estimatedOffsetMs != null ? t("bluetoothCalibration.ms", { value: estimatedOffsetMs }) : "—"}
                      </Text>
                    </Stepper>
                  </View>
                  <View style={screenStyles.row}>
                    <View style={screenStyles.rowCopy}>
                      <Text style={screenStyles.rowTitle}>{t("bluetoothCalibration.click")}</Text>
                      <Text style={screenStyles.rowMeta}>{t("bluetoothCalibration.clickMeta")}</Text>
                    </View>
                    {estimatedClickOffsetMs != null ? (
                      <Stepper
                        glyphs="plusMinus"
                        decrementLabel={t("bluetoothCalibration.earlierA11y")}
                        incrementLabel={t("bluetoothCalibration.laterA11y")}
                        onStep={(direction) => adjustClickDraftOffset(direction * OFFSET_STEP_MS)}
                      >
                        <Text style={screenStyles.delayValue}>
                          {t("bluetoothCalibration.ms", { value: estimatedClickOffsetMs })}
                        </Text>
                      </Stepper>
                    ) : (
                      <Text style={screenStyles.rowMeta}>{t("bluetoothCalibration.notMeasured")}</Text>
                    )}
                  </View>
                </View>
                {resultNote ? (
                  <View style={screenStyles.note}>
                    <Ionicons name="timer-outline" size={15} color={colors.primaryDeep} />
                    <Text style={screenStyles.noteText}>{resultNote}</Text>
                  </View>
                ) : null}
                {lastAnalysisSummary ? <Text style={screenStyles.summary}>{lastAnalysisSummary}</Text> : null}
                <Button
                  label={t("bluetoothCalibration.save")}
                  onPress={handleSaveCalibration}
                  disabled={estimatedOffsetMs == null || !editableRouteKey || !editableRouteLabel}
                />
                <Button
                  variant="quiet"
                  label={t("bluetoothCalibration.retry")}
                  style={screenStyles.quietAction}
                  textStyle={screenStyles.quietActionText}
                  onPress={resetCalibrationRun}
                />
              </View>
            ) : null}

            <Text style={[screenStyles.label, screenStyles.savedLabel]}>
              {t("bluetoothCalibration.savedCalibrations")}
            </Text>
            {calibrations.length === 0 ? (
              <Text style={screenStyles.rowMeta}>{t("bluetoothCalibration.noneSaved")}</Text>
            ) : (
              <ListRows>
                {calibrations.map((calibration) => (
                  <ListRow
                    key={calibration.routeKey}
                    icon="bluetooth"
                    title={calibration.routeLabel}
                    serifTitle={false}
                    userTitle={false}
                    meta={t("bluetoothCalibration.savedMeta", {
                      music: calibration.offsetMs,
                      click:
                        calibration.clickOffsetMs != null
                          ? t("bluetoothCalibration.savedClick", { value: calibration.clickOffsetMs })
                          : "",
                    })}
                    onPress={() => openSavedMenu(calibration)}
                  />
                ))}
              </ListRows>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
