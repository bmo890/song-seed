import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useEventListener } from "expo";
import * as Haptics from "expo-haptics";
import { Platform, Vibration } from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  activateMetronomeAudioSession,
  releaseAudioSessionOwner,
} from "../services/audioSession";
import {
  clampMetronomeBpm,
  clampMetronomeLevel,
  DEFAULT_METRONOME_BEEP_LEVEL,
  DEFAULT_METRONOME_BPM,
  DEFAULT_METRONOME_COUNT_IN_BARS,
  DEFAULT_METRONOME_HAPTIC_LEVEL,
  DEFAULT_METRONOME_METER_ID,
  DEFAULT_METRONOME_OUTPUTS,
  deriveTapTempoBpm,
  getMetronomeAndroidVibrationDuration,
  getMetronomeBeepVolume,
  getMetronomeBeatIntervalMs,
  getMetronomeHapticFallbackDuration,
  getMetronomeMeterPreset,
  MAX_METRONOME_LEVEL,
  MAX_TAP_HISTORY,
  METRONOME_LOOP_BEAT_COUNT,
  type MetronomeBeepLevel,
  type MetronomeHapticLevel,
  type MetronomeMeterId,
  type MetronomeOutputKey,
  type MetronomeOutputs,
  shouldResetTapTempo,
} from "../domain/metronome";
import { ensureMetronomeLoopFile } from "../services/metronomeLoop";
import { resolveCurrentRouteLatencyProfile } from "../services/latencyModel";
import SongNookMetronomeModule from "../../modules/songnook-metronome";
import type { BeatEventPayload, NativeMetronomeState } from "../../modules/songnook-metronome";
import { useStore } from "../state/useStore";

type UseMetronomeArgs = {
  initialBpm?: number;
  initialOutputs?: Partial<MetronomeOutputs>;
};

type MetronomeStartOptions = {
  manageAudioSession?: boolean;
  cueDelayMs?: number;
};

const METRONOME_AUDIO_SESSION_OWNER_ID = "metronome";

export function useMetronome({ initialBpm = DEFAULT_METRONOME_BPM, initialOutputs }: UseMetronomeArgs = {}) {
  if (SongNookMetronomeModule) {
    return useNativeMetronomeImpl({ initialBpm, initialOutputs });
  }

  return useLegacyMetronomeImpl({ initialBpm, initialOutputs });
}

function useNativeMetronomeImpl({ initialBpm = DEFAULT_METRONOME_BPM, initialOutputs }: UseMetronomeArgs = {}) {
  const bpm = useStore((s) => s.metronomeBpm);
  const meterId = useStore((s) => s.metronomeMeterId);
  const outputs = useStore((s) => s.metronomeOutputs);
  const beepLevel = useStore((s) => s.metronomeBeepLevel);
  const hapticLevel = useStore((s) => s.metronomeHapticLevel);
  const countInBars = useStore((s) => s.metronomeCountInBars);
  const setMetronomeBpm = useStore((s) => s.setMetronomeBpm);
  const setMetronomeMeterId = useStore((s) => s.setMetronomeMeterId);
  const setMetronomeOutputEnabled = useStore((s) => s.setMetronomeOutputEnabled);
  const setMetronomeBeepLevel = useStore((s) => s.setMetronomeBeepLevel);
  const setMetronomeHapticLevel = useStore((s) => s.setMetronomeHapticLevel);
  const setMetronomeCountInBars = useStore((s) => s.setMetronomeCountInBars);

  const [pulseToken, setPulseToken] = useState(0);
  const [beatCount, setBeatCount] = useState(0);
  const [tapCount, setTapCount] = useState(0);
  const [isPreparing, setIsPreparing] = useState(false);
  const [nativeState, setNativeState] = useState<NativeMetronomeState | null>(null);
  const [countInCompletionToken, setCountInCompletionToken] = useState(0);
  const bluetoothMonitoringCalibrations = useStore((s) => s.bluetoothMonitoringCalibrations);

  const tapTimesRef = useRef<number[]>([]);
  const lastTapAtRef = useRef<number | null>(null);
  const hapticLevelRef = useRef(hapticLevel);
  const outputsRef = useRef(outputs);
  const bpmRef = useRef(bpm);
  const configuredRef = useRef(false);
  const cueActivationAtRef = useRef<number>(0);
  // Binaries whose engines schedule haptics natively (no bridge at fire time). On older
  // binaries the JS event-driven fallback below keeps working.
  const nativeCuesSupported = !!SongNookMetronomeModule?.supportsScheduledCues?.();

  // Live-route cue timing (latency model output), refreshed at every start. outputMs
  // delays visual/haptic beat EVENTS on the engine (matters on Bluetooth); the signed
  // leads drive the scheduled cue paths (native haptics + the JS visual scheduler),
  // which unlike events can fire EARLY when the cue pipeline is slower than the route.
  const routeLatencyProfileRef = useRef({ outputMs: 0, visualLeadMs: 0, hapticLeadMs: 0 });
  const cueLatencyInputsRef = useRef({
    calibrations: bluetoothMonitoringCalibrations,
    outputs,
    barMs: getMetronomeBeatIntervalMs(bpm) * getMetronomeMeterPreset(meterId).pulsesPerBar,
  });
  cueLatencyInputsRef.current = {
    calibrations: bluetoothMonitoringCalibrations,
    outputs,
    barMs: getMetronomeBeatIntervalMs(bpm) * getMetronomeMeterPreset(meterId).pulsesPerBar,
  };

  const refreshRouteLatencyForCues = useCallback(async () => {
    try {
      const inputs = cueLatencyInputsRef.current;
      const route = (await SongNookMetronomeModule?.getCurrentAudioOutputRoute?.().catch(() => null)) ?? null;
      const profile = await resolveCurrentRouteLatencyProfile({
        calibrations: inputs.calibrations,
        activeOutputs: inputs.outputs,
        clickLoopBarMs: inputs.barMs,
      });
      routeLatencyProfileRef.current = {
        outputMs: Math.round(profile.outputMs),
        visualLeadMs: Math.round(profile.visualLeadMs),
        hapticLeadMs: Math.round(profile.hapticLeadMs),
      };
      console.log(
        `[timing] cue profile @start: route=${route?.type ?? "?"}/${route?.name ?? "?"} ` +
          `out=${Math.round(profile.outputMs)}ms(${profile.sources.output}) ` +
          `visualLead=${Math.round(profile.visualLeadMs)}ms hapticLead=${Math.round(profile.hapticLeadMs)}ms ` +
          `(${inputs.calibrations.length} calibration${inputs.calibrations.length === 1 ? "" : "s"} saved)`
      );
    } catch (error) {
      console.warn("[timing] cue profile resolution failed", error);
      routeLatencyProfileRef.current = { outputMs: 0, visualLeadMs: 0, hapticLeadMs: 0 };
    }
  }, []);

  // ── Anchor-aligned visual scheduler ────────────────────────────────────────────────
  // The pulse is scheduled AGAINST THE GRID (getGridAnchor) with the signed visual lead,
  // instead of reacting to per-beat bridge events — so it can fire early where the render
  // pipeline is slower than the route, and its jitter is JS-timer class instead of
  // poll+bridge+render class. Re-anchors to the audio clock every bar, so tempo changes
  // and drift self-heal. Falls back to event-driven pulses when no anchor is available.
  const visualSchedulerRef = useRef<{
    token: number;
    timer: ReturnType<typeof setTimeout> | null;
    active: boolean;
  }>({ token: 0, timer: null, active: false });

  const stopVisualScheduler = useCallback(() => {
    const scheduler = visualSchedulerRef.current;
    scheduler.token += 1;
    scheduler.active = false;
    if (scheduler.timer) {
      clearTimeout(scheduler.timer);
      scheduler.timer = null;
    }
  }, []);

  const startVisualScheduler = useCallback(async () => {
    if (!SongNookMetronomeModule?.getGridAnchor) {
      return;
    }
    const scheduler = visualSchedulerRef.current;
    scheduler.token += 1;
    const token = scheduler.token;

    const fetchAnchor = async () => {
      const next = await SongNookMetronomeModule!.getGridAnchor!().catch(() => null);
      if (!next?.isRunning || next.anchorEpochMs == null || next.msPerPulse == null) {
        return null;
      }
      return next;
    };

    // Let the engine's audio clock settle before anchoring.
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 90);
    });
    let anchor = await fetchAnchor();
    if (!anchor || scheduler.token !== token) {
      scheduler.active = false;
      return;
    }
    scheduler.active = true;
    let pulsesSinceAnchorRefresh = 0;

    const scheduleNext = () => {
      if (scheduler.token !== token) {
        return;
      }
      const msPerPulse = anchor!.msPerPulse!;
      const visualOffsetMs = routeLatencyProfileRef.current.visualLeadMs;
      const now = Date.now();
      const pulseIndex = Math.max(
        0,
        Math.ceil((now - anchor!.anchorEpochMs! - visualOffsetMs + 4) / msPerPulse)
      );
      const fireAtMs = anchor!.anchorEpochMs! + pulseIndex * msPerPulse + visualOffsetMs;

      scheduler.timer = setTimeout(() => {
        void (async () => {
          if (scheduler.token !== token) {
            return;
          }
          if (outputsRef.current.visual && Date.now() >= cueActivationAtRef.current) {
            setPulseToken((current) => current + 1);
          }
          pulsesSinceAnchorRefresh += 1;
          if (pulsesSinceAnchorRefresh >= (anchor!.pulsesPerBar ?? 4)) {
            pulsesSinceAnchorRefresh = 0;
            const refreshed = await fetchAnchor();
            if (scheduler.token !== token) {
              return;
            }
            if (refreshed) {
              anchor = refreshed;
            }
            // A failed refresh (transient bridge hiccup) keeps the last anchor: the grid
            // only moves on tempo/meter changes, so stale-by-a-bar beats handing the
            // pulse to the event-driven fallback mid-take, whose different timing made
            // the visual cue visibly change character. A real stop invalidates the token.
          }
          scheduleNext();
        })();
      }, Math.max(1, fireAtMs - now));
    };
    scheduleNext();
  }, []);

  useEffect(() => {
    return () => {
      stopVisualScheduler();
    };
  }, [stopVisualScheduler]);

  const effectiveBpm = configuredRef.current ? bpm : initialBpm;
  const effectiveOutputs = configuredRef.current
    ? outputs
    : {
        ...DEFAULT_METRONOME_OUTPUTS,
        ...initialOutputs,
      };
  const effectiveMeterId = configuredRef.current ? meterId : DEFAULT_METRONOME_METER_ID;
  const effectiveCountInBars = configuredRef.current ? countInBars : DEFAULT_METRONOME_COUNT_IN_BARS;
  const meterPreset = useMemo(() => getMetronomeMeterPreset(effectiveMeterId), [effectiveMeterId]);
  const beatIntervalMs = useMemo(() => getMetronomeBeatIntervalMs(effectiveBpm), [effectiveBpm]);
  const loopDurationMs = beatIntervalMs * meterPreset.pulsesPerBar;
  const activeOutputCount = useMemo(
    () => Object.values(effectiveOutputs).filter(Boolean).length,
    [effectiveOutputs]
  );

  useEffect(() => {
    hapticLevelRef.current = hapticLevel;
  }, [hapticLevel]);

  useEffect(() => {
    outputsRef.current = outputs;
  }, [outputs]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    configuredRef.current = true;
  }, []);

  const clearTapTempo = useCallback(() => {
    tapTimesRef.current = [];
    lastTapAtRef.current = null;
    setTapCount(0);
  }, []);

  const triggerBeatCue = useCallback(() => {
    if (Date.now() < cueActivationAtRef.current) {
      return;
    }

    const activeOutputs = outputsRef.current;
    // The anchor-aligned scheduler owns the pulse when it's running; event-driven pulses
    // are the fallback for engines with no grid anchor.
    if (activeOutputs.visual && !visualSchedulerRef.current.active) {
      setPulseToken((current) => current + 1);
    }

    if (!activeOutputs.haptic) {
      return;
    }

    // Engines with scheduled cues fire haptics natively (no bridge at fire time, signed
    // lead applied) — the JS fallback below is for older binaries only.
    if (nativeCuesSupported) {
      return;
    }

    const nextHapticLevel = hapticLevelRef.current;
    const beatInterval = getMetronomeBeatIntervalMs(bpmRef.current);
    const fallbackDuration = getMetronomeHapticFallbackDuration(nextHapticLevel);

    if (Platform.OS === "android") {
      Vibration.vibrate(getMetronomeAndroidVibrationDuration(nextHapticLevel, beatInterval));
      return;
    }

    if (nextHapticLevel >= 88 && beatInterval >= 500) {
      Vibration.vibrate();
      return;
    }

    if (nextHapticLevel >= 70) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {
        Vibration.vibrate(fallbackDuration);
      });
      return;
    }

    if (nextHapticLevel >= 38) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {
        Vibration.vibrate(fallbackDuration);
      });
      return;
    }

    if (nextHapticLevel >= 24) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {
        Vibration.vibrate(fallbackDuration);
      });
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {
      Vibration.vibrate(fallbackDuration);
    });
  }, []);

  const syncNativeConfig = useCallback(async () => {
    if (!SongNookMetronomeModule) {
      return null;
    }
    setIsPreparing(true);
    try {
      return await SongNookMetronomeModule.configure({
        bpm,
        meterId: meterId,
        pulsesPerBar: meterPreset.pulsesPerBar,
        denominator: meterPreset.denominator,
        accentPattern: meterPreset.accentPattern,
        clickEnabled: outputs.beep,
        clickVolume: getMetronomeBeepVolume(beepLevel),
        // Live-route cue delay from the latency model (refreshed at start): delays the
        // visual/haptic beat EVENTS so legacy consumers land with the audible click.
        outputLatencyMs: routeLatencyProfileRef.current.outputMs,
        // Scheduled-cue engines fire haptics themselves with the signed lead.
        hapticEnabled: nativeCuesSupported && outputs.haptic,
        hapticStrength: clampMetronomeLevel(hapticLevel) / MAX_METRONOME_LEVEL,
        hapticOffsetMs: routeLatencyProfileRef.current.hapticLeadMs,
      });
    } finally {
      setIsPreparing(false);
    }
  }, [bpm, beepLevel, hapticLevel, meterId, meterPreset, nativeCuesSupported, outputs.beep, outputs.haptic]);

  // Volume applies instantly and live: the native engines treat volume as a live param
  // (no restart, no phase reset), so a mid-take level tweak never breaks the grid. On
  // binaries that predate setClickVolume the debounced configure below still carries it.
  useEffect(() => {
    if (!SongNookMetronomeModule?.setClickVolume) {
      return;
    }
    void SongNookMetronomeModule.setClickVolume(getMetronomeBeepVolume(beepLevel))
      .then((state) => {
        setNativeState(state);
      })
      .catch(() => {});
  }, [beepLevel]);

  // Debounced: the native engine treats structural configure() changes (tempo/meter) as a
  // full restart whenever it's already running (beat position resets, click buffer
  // rebuilds), so without this, dragging the tempo slider or repeated +/- taps would
  // restart audibly on every single intermediate value. This also fixes bpm never reaching
  // a running engine at all — it used to be read from a ref outside this callback's
  // dependencies, so changing it alone never re-triggered a sync.
  const configSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!SongNookMetronomeModule) {
      return;
    }
    if (configSyncTimerRef.current) {
      clearTimeout(configSyncTimerRef.current);
    }
    configSyncTimerRef.current = setTimeout(() => {
      void syncNativeConfig().then((state) => {
        if (state) {
          setNativeState(state);
        }
      });
    }, 280);

    return () => {
      if (configSyncTimerRef.current) {
        clearTimeout(configSyncTimerRef.current);
        configSyncTimerRef.current = null;
      }
    };
  }, [syncNativeConfig]);

  useEffect(() => {
    if (!SongNookMetronomeModule) {
      return;
    }
    void SongNookMetronomeModule.getState().then((state) => {
      setNativeState(state);
    });
  }, []);

  useEventListener(SongNookMetronomeModule!, "onStateChange", (state) => {
    setNativeState(state);
  });

  useEventListener(SongNookMetronomeModule!, "onBeat", (event: BeatEventPayload) => {
    setBeatCount(event.absolutePulse + 1);
    triggerBeatCue();
  });

  useEventListener(SongNookMetronomeModule!, "onCountInComplete", () => {
    setCountInCompletionToken((current) => current + 1);
  });

  useEventListener(SongNookMetronomeModule!, "onError", ({ message }) => {
    console.warn("Native metronome error", message);
  });

  const start = useCallback(async (options: MetronomeStartOptions = {}) => {
    if (!SongNookMetronomeModule) return;
    try {
      cueActivationAtRef.current = Date.now() + Math.max(0, options.cueDelayMs ?? 0);
      if (options.manageAudioSession ?? true) {
        await activateMetronomeAudioSession({ ownerId: METRONOME_AUDIO_SESSION_OWNER_ID });
      }
      await refreshRouteLatencyForCues();
      const nextState = await syncNativeConfig();
      if (nextState) {
        setNativeState(nextState);
      }
      setBeatCount(0);
      const state = await SongNookMetronomeModule.start();
      setNativeState(state);
      void startVisualScheduler();
    } catch (error) {
      await releaseAudioSessionOwner(METRONOME_AUDIO_SESSION_OWNER_ID).catch(() => {});
      throw error;
    }
  }, [startVisualScheduler, syncNativeConfig]);

  const startCountIn = useCallback(
    async (bars = effectiveCountInBars, options: MetronomeStartOptions = {}) => {
      if (!SongNookMetronomeModule) return;
      try {
        cueActivationAtRef.current = Date.now() + Math.max(0, options.cueDelayMs ?? 0);
        if (options.manageAudioSession ?? true) {
          await activateMetronomeAudioSession({ ownerId: METRONOME_AUDIO_SESSION_OWNER_ID });
        }
        await refreshRouteLatencyForCues();
        const nextState = await syncNativeConfig();
        if (nextState) {
          setNativeState(nextState);
        }
        setBeatCount(0);
        const state = await SongNookMetronomeModule.startCountIn(bars);
        setNativeState(state);
        void startVisualScheduler();
      } catch (error) {
        await releaseAudioSessionOwner(METRONOME_AUDIO_SESSION_OWNER_ID).catch(() => {});
        throw error;
      }
    },
    [effectiveCountInBars, startVisualScheduler, syncNativeConfig]
  );

  const stop = useCallback(async () => {
    if (!SongNookMetronomeModule) return;
    try {
      stopVisualScheduler();
      cueActivationAtRef.current = 0;
      const state = await SongNookMetronomeModule.stop();
      setNativeState(state);
      setBeatCount(0);
    } finally {
      await releaseAudioSessionOwner(METRONOME_AUDIO_SESSION_OWNER_ID).catch(() => {});
    }
  }, [stopVisualScheduler]);

  const toggleRunning = useCallback(() => {
    if (nativeState?.isRunning) {
      void stop();
      return;
    }
    void start();
  }, [nativeState?.isRunning, start, stop]);

  const setBpmValue = useCallback((nextValue: number) => {
    clearTapTempo();
    setMetronomeBpm(nextValue);
  }, [clearTapTempo, setMetronomeBpm]);

  const nudgeBpm = useCallback((delta: number) => {
    clearTapTempo();
    setMetronomeBpm(bpmRef.current + delta);
  }, [clearTapTempo, setMetronomeBpm]);

  const setOutputEnabled = useCallback((key: MetronomeOutputKey, value: boolean) => {
    setMetronomeOutputEnabled(key, value);
  }, [setMetronomeOutputEnabled]);

  const toggleOutput = useCallback((key: MetronomeOutputKey) => {
    setMetronomeOutputEnabled(key, !outputsRef.current[key]);
  }, [setMetronomeOutputEnabled]);

  const setBeepLevelValue = useCallback((nextLevel: MetronomeBeepLevel) => {
    setMetronomeBeepLevel(nextLevel);
  }, [setMetronomeBeepLevel]);

  const setHapticLevelValue = useCallback((nextLevel: MetronomeHapticLevel) => {
    setMetronomeHapticLevel(nextLevel);
  }, [setMetronomeHapticLevel]);

  const setMeterIdValue = useCallback((nextMeterId: MetronomeMeterId) => {
    setMetronomeMeterId(nextMeterId);
  }, [setMetronomeMeterId]);

  const tapTempo = useCallback(() => {
    const tapAt = Date.now();
    const nextTapTimes = shouldResetTapTempo(lastTapAtRef.current, tapAt)
      ? [tapAt]
      : [...tapTimesRef.current, tapAt].slice(-MAX_TAP_HISTORY);

    tapTimesRef.current = nextTapTimes;
    lastTapAtRef.current = tapAt;
    setTapCount(nextTapTimes.length);

    const nextBpm = deriveTapTempoBpm(nextTapTimes);
    if (nextBpm === null) {
      return null;
    }

    setMetronomeBpm(nextBpm);
    return nextBpm;
  }, [setMetronomeBpm]);

  return {
    bpm: effectiveBpm,
    beatCount,
    beatIntervalMs,
    loopDurationMs,
    isRunning: nativeState?.isRunning ?? false,
    isCountIn: nativeState?.isCountIn ?? false,
    isPreparing,
    beepLevel,
    hapticLevel,
    outputs: effectiveOutputs,
    pulseToken,
    tapCount,
    meterId: effectiveMeterId,
    meterPreset,
    countInBars: effectiveCountInBars,
    // Beat position derives from the SAME onBeat event stream that pulses the UI ring
    // (beatCount), not the separate onStateChange snapshot — the two streams desync
    // under load (recording), which pinned the "big" downbeat accent to random pulses.
    currentBeatInBar:
      beatCount > 0
        ? ((beatCount - 1) % Math.max(1, meterPreset.pulsesPerBar)) + 1
        : nativeState?.beatInBar ?? 1,
    currentBar:
      beatCount > 0
        ? Math.floor((beatCount - 1) / Math.max(1, meterPreset.pulsesPerBar)) + 1
        : nativeState?.barNumber ?? 1,
    countInCompletionToken,
    isNativeAvailable:
      nativeState?.isAvailable ?? SongNookMetronomeModule?.isAvailable?.() ?? false,
    start,
    startCountIn,
    stop,
    toggleRunning,
    setBpmValue,
    nudgeBpm,
    tapTempo,
    clearTapTempo,
    setOutputEnabled,
    setBeepLevelValue,
    setHapticLevelValue,
    toggleOutput,
    setMeterIdValue,
    setCountInBarsValue: setMetronomeCountInBars,
  };
}

function useLegacyMetronomeImpl({ initialBpm = DEFAULT_METRONOME_BPM, initialOutputs }: UseMetronomeArgs = {}) {
  const [bpm, setBpm] = useState(() => clampMetronomeBpm(initialBpm));
  const [isRunning, setIsRunning] = useState(false);
  const [outputs, setOutputs] = useState<MetronomeOutputs>({
    ...DEFAULT_METRONOME_OUTPUTS,
    ...initialOutputs,
  });
  const [beepLevel, setBeepLevel] = useState<MetronomeBeepLevel>(DEFAULT_METRONOME_BEEP_LEVEL);
  const [hapticLevel, setHapticLevel] = useState<MetronomeHapticLevel>(DEFAULT_METRONOME_HAPTIC_LEVEL);
  const [pulseToken, setPulseToken] = useState(0);
  const [beatCount, setBeatCount] = useState(0);
  const [tapCount, setTapCount] = useState(0);
  const [isPreparing, setIsPreparing] = useState(false);

  const runTokenRef = useRef(0);
  const isRunningRef = useRef(isRunning);
  const bpmRef = useRef(bpm);
  const outputsRef = useRef(outputs);
  const beepLevelRef = useRef(beepLevel);
  const hapticLevelRef = useRef(hapticLevel);
  const tapTimesRef = useRef<number[]>([]);
  const lastTapAtRef = useRef<number | null>(null);
  const activeLoopUriRef = useRef<string | null>(null);
  const sourceRequestIdRef = useRef(0);
  const cycleCountRef = useRef(0);
  const lastBeatOrdinalRef = useRef(-1);
  const lastPlayerTimeMsRef = useRef(0);
  const [loopSource, setLoopSource] = useState<{ uri: string; bpm: number } | null>(null);

  const player = useAudioPlayer(null, {
    updateInterval: 16,
    keepAudioSessionActive: true,
  });
  const status = useAudioPlayerStatus(player);
  const playerTimeMs = Math.max(0, Math.round((status.currentTime ?? 0) * 1000));

  useEffect(() => {
    try {
      player.loop = true;
    } catch {
      // ignore player setup races
    }
  }, [player]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    outputsRef.current = outputs;
  }, [outputs]);

  useEffect(() => {
    beepLevelRef.current = beepLevel;
  }, [beepLevel]);

  useEffect(() => {
    hapticLevelRef.current = hapticLevel;
  }, [hapticLevel]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  const beatIntervalMs = useMemo(() => getMetronomeBeatIntervalMs(bpm), [bpm]);
  const loopDurationMs = beatIntervalMs * METRONOME_LOOP_BEAT_COUNT;

  const clearTapTempo = useCallback(() => {
    tapTimesRef.current = [];
    lastTapAtRef.current = null;
    setTapCount(0);
  }, []);

  const resetBeatTracking = useCallback(() => {
    cycleCountRef.current = 0;
    lastBeatOrdinalRef.current = -1;
    lastPlayerTimeMsRef.current = 0;
    setBeatCount(0);
  }, []);

  const triggerBeatCue = useCallback(() => {
    const activeOutputs = outputsRef.current;

    if (activeOutputs.visual) {
      setPulseToken((current) => current + 1);
    }

    if (!activeOutputs.haptic) {
      return;
    }

    const nextHapticLevel = hapticLevelRef.current;
    const beatInterval = getMetronomeBeatIntervalMs(bpmRef.current);
    const fallbackDuration = getMetronomeHapticFallbackDuration(nextHapticLevel);

    if (Platform.OS === "android") {
      const vibrationDuration = getMetronomeAndroidVibrationDuration(
        nextHapticLevel,
        beatInterval
      );
      Vibration.vibrate(vibrationDuration);
      return;
    }

    if (nextHapticLevel >= 88 && beatInterval >= 500) {
      Vibration.vibrate();
      return;
    }

    if (nextHapticLevel >= 70) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {
        Vibration.vibrate(fallbackDuration);
      });
      return;
    }

    if (nextHapticLevel >= 38) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {
        Vibration.vibrate(fallbackDuration);
      });
      return;
    }

    if (nextHapticLevel >= 24) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {
        Vibration.vibrate(fallbackDuration);
      });
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {
      Vibration.vibrate(fallbackDuration);
    });
  }, []);

  const syncPlayerSource = useCallback(async (uri: string, shouldPlay: boolean) => {
    if (activeLoopUriRef.current !== uri) {
      player.replace({ uri });
      activeLoopUriRef.current = uri;
    }

    try {
      player.loop = true;
      player.volume = outputsRef.current.beep ? getMetronomeBeepVolume(beepLevelRef.current) : 0;
    } catch {
      // ignore shared object setup races
    }

    try {
      await player.seekTo(0);
    } catch {
      // ignore early seek errors while source is warming
    }

    if (shouldPlay) {
      try {
        player.play();
      } catch {
        // ignore early play errors while source is warming
      }
      return;
    }

    try {
      player.pause();
    } catch {
      // ignore pause races
    }
  }, [player]);

  const loadLoopSource = useCallback(async (targetBpm: number) => {
    const requestId = sourceRequestIdRef.current + 1;
    sourceRequestIdRef.current = requestId;
    setIsPreparing(true);

    try {
      const loopSource = await ensureMetronomeLoopFile(targetBpm);
      if (sourceRequestIdRef.current !== requestId) {
        return null;
      }
      setLoopSource({ uri: loopSource.uri, bpm: loopSource.bpm });
      return loopSource.uri;
    } finally {
      if (sourceRequestIdRef.current === requestId) {
        setIsPreparing(false);
      }
    }
  }, []);

  const stop = useCallback(async () => {
    runTokenRef.current += 1;
    isRunningRef.current = false;
    resetBeatTracking();
    setIsRunning(false);
    try {
      player.pause();
    } catch {
      // ignore pause races
    } finally {
      await releaseAudioSessionOwner(METRONOME_AUDIO_SESSION_OWNER_ID).catch(() => {});
    }
  }, [player, resetBeatTracking]);

  const start = useCallback(async (options: MetronomeStartOptions = {}) => {
    const runToken = runTokenRef.current + 1;
    runTokenRef.current = runToken;
    isRunningRef.current = true;
    resetBeatTracking();
    setIsRunning(true);

    try {
      if (options.manageAudioSession ?? true) {
        await activateMetronomeAudioSession({ ownerId: METRONOME_AUDIO_SESSION_OWNER_ID });
      }
    } catch (error) {
      console.warn("Metronome audio session failed", error);
    }

    if (runTokenRef.current !== runToken) {
      return;
    }

    const nextLoopUri =
      loopSource?.bpm === bpmRef.current ? loopSource.uri : await loadLoopSource(bpmRef.current);
    if (runTokenRef.current !== runToken || !nextLoopUri) {
      return;
    }

    await syncPlayerSource(nextLoopUri, true);
  }, [loadLoopSource, loopSource, resetBeatTracking, syncPlayerSource]);

  const toggleRunning = useCallback(() => {
    if (isRunningRef.current) {
      void stop().catch(() => {});
      return;
    }

    void start();
  }, [start, stop]);

  const setBpmValue = useCallback((nextValue: number) => {
    clearTapTempo();
    setBpm((current) => {
      const nextBpm = clampMetronomeBpm(nextValue);
      return current === nextBpm ? current : nextBpm;
    });
  }, [clearTapTempo]);

  const nudgeBpm = useCallback((delta: number) => {
    clearTapTempo();
    setBpm((current) => clampMetronomeBpm(current + delta));
  }, [clearTapTempo]);

  const setOutputEnabled = useCallback((key: MetronomeOutputKey, value: boolean) => {
    setOutputs((current) => {
      if (current[key] === value) {
        return current;
      }

      return {
        ...current,
        [key]: value,
      };
    });
  }, []);

  const toggleOutput = useCallback((key: MetronomeOutputKey) => {
    setOutputs((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }, []);

  const setBeepLevelValue = useCallback((nextLevel: MetronomeBeepLevel) => {
    const normalizedLevel = clampMetronomeLevel(nextLevel);
    setBeepLevel((current) => (current === normalizedLevel ? current : normalizedLevel));
  }, []);

  const setHapticLevelValue = useCallback((nextLevel: MetronomeHapticLevel) => {
    const normalizedLevel = clampMetronomeLevel(nextLevel);
    setHapticLevel((current) => (current === normalizedLevel ? current : normalizedLevel));
  }, []);

  const tapTempo = useCallback(() => {
    const tapAt = Date.now();
    const nextTapTimes = shouldResetTapTempo(lastTapAtRef.current, tapAt)
      ? [tapAt]
      : [...tapTimesRef.current, tapAt].slice(-MAX_TAP_HISTORY);

    tapTimesRef.current = nextTapTimes;
    lastTapAtRef.current = tapAt;
    setTapCount(nextTapTimes.length);

    const nextBpm = deriveTapTempoBpm(nextTapTimes);
    if (nextBpm === null) {
      return null;
    }

    setBpm((current) => (current === nextBpm ? current : nextBpm));
    return nextBpm;
  }, []);

  useEffect(() => {
    void loadLoopSource(bpm);
  }, [bpm, loadLoopSource]);

  useEffect(() => {
    try {
      player.volume = outputs.beep ? getMetronomeBeepVolume(beepLevel) : 0;
    } catch {
      // ignore shared object volume races
    }
  }, [beepLevel, outputs.beep, player]);

  useEffect(() => {
    if (!isRunning || !loopSource) {
      return;
    }

    if (activeLoopUriRef.current === loopSource.uri) {
      return;
    }

    resetBeatTracking();
    void syncPlayerSource(loopSource.uri, true);
  }, [isRunning, loopSource, resetBeatTracking, syncPlayerSource]);

  useEffect(() => {
    if (isRunning || !loopSource) {
      return;
    }

    if (activeLoopUriRef.current === loopSource.uri) {
      return;
    }

    void syncPlayerSource(loopSource.uri, false);
  }, [isRunning, loopSource, syncPlayerSource]);

  useEffect(() => {
    if (!isRunning || !status.playing || playerTimeMs <= 0) {
      return;
    }

    const previousTimeMs = lastPlayerTimeMsRef.current;
    if (playerTimeMs + Math.max(40, beatIntervalMs * 0.2) < previousTimeMs) {
      cycleCountRef.current += 1;
    }
    lastPlayerTimeMsRef.current = playerTimeMs;

    const beatWithinLoop = Math.min(
      METRONOME_LOOP_BEAT_COUNT - 1,
      Math.floor(playerTimeMs / beatIntervalMs)
    );
    const beatOrdinal = cycleCountRef.current * METRONOME_LOOP_BEAT_COUNT + beatWithinLoop;

    if (beatOrdinal <= lastBeatOrdinalRef.current) {
      return;
    }

    lastBeatOrdinalRef.current = beatOrdinal;
    setBeatCount(beatOrdinal + 1);
    triggerBeatCue();
  }, [beatIntervalMs, isRunning, playerTimeMs, status.playing, triggerBeatCue]);

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        // ignore cleanup races
      }
      void releaseAudioSessionOwner(METRONOME_AUDIO_SESSION_OWNER_ID).catch(() => {});
    };
  }, [player]);

  return {
    bpm,
    beatCount,
    beatIntervalMs,
    loopDurationMs,
    isRunning,
    isPreparing,
    beepLevel,
    hapticLevel,
    outputs,
    pulseToken,
    tapCount,
    meterId: DEFAULT_METRONOME_METER_ID,
    meterPreset: getMetronomeMeterPreset(DEFAULT_METRONOME_METER_ID),
    countInBars: DEFAULT_METRONOME_COUNT_IN_BARS,
    currentBeatInBar: ((beatCount - 1) % METRONOME_LOOP_BEAT_COUNT) + 1,
    currentBar: Math.max(1, Math.floor(Math.max(beatCount - 1, 0) / METRONOME_LOOP_BEAT_COUNT) + 1),
    countInCompletionToken: 0,
    isCountIn: false,
    isNativeAvailable: false,
    start,
    startCountIn: async (
      _bars = DEFAULT_METRONOME_COUNT_IN_BARS,
      options: MetronomeStartOptions = {}
    ) => {
      await start(options);
    },
    stop,
    toggleRunning,
    setBpmValue,
    nudgeBpm,
    tapTempo,
    clearTapTempo,
    setOutputEnabled,
    setBeepLevelValue,
    setHapticLevelValue,
    toggleOutput,
    setMeterIdValue: () => {},
    setCountInBarsValue: () => {},
  };
}
