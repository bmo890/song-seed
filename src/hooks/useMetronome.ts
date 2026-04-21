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
  MAX_TAP_HISTORY,
  METRONOME_LOOP_BEAT_COUNT,
  type MetronomeBeepLevel,
  type MetronomeHapticLevel,
  type MetronomeMeterId,
  type MetronomeOutputKey,
  type MetronomeOutputs,
  shouldResetTapTempo,
} from "../metronome";
import { ensureMetronomeLoopFile } from "../services/metronomeLoop";
import SongseedMetronomeModule from "../../modules/songseed-metronome";
import type { BeatEventPayload, NativeMetronomeState } from "../../modules/songseed-metronome";
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
  if (SongseedMetronomeModule) {
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
  const tapTimesRef = useRef<number[]>([]);
  const lastTapAtRef = useRef<number | null>(null);
  const hapticLevelRef = useRef(hapticLevel);
  const outputsRef = useRef(outputs);
  const bpmRef = useRef(bpm);
  const configuredRef = useRef(false);
  const cueActivationAtRef = useRef<number>(0);

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
    if (!SongseedMetronomeModule) {
      return null;
    }
    setIsPreparing(true);
    try {
      return await SongseedMetronomeModule.configure({
        bpm: bpmRef.current,
        meterId: meterId,
        pulsesPerBar: meterPreset.pulsesPerBar,
        denominator: meterPreset.denominator,
        accentPattern: meterPreset.accentPattern,
        clickEnabled: outputs.beep,
        clickVolume: getMetronomeBeepVolume(beepLevel),
      });
    } finally {
      setIsPreparing(false);
    }
  }, [beepLevel, meterId, meterPreset, outputs.beep]);

  useEffect(() => {
    if (!SongseedMetronomeModule) {
      return;
    }
    void syncNativeConfig().then((state) => {
      if (state) {
        setNativeState(state);
      }
    });
  }, [syncNativeConfig]);

  useEffect(() => {
    if (!SongseedMetronomeModule) {
      return;
    }
    void SongseedMetronomeModule.getState().then((state) => {
      setNativeState(state);
    });
  }, []);

  useEventListener(SongseedMetronomeModule!, "onStateChange", (state) => {
    setNativeState(state);
  });

  useEventListener(SongseedMetronomeModule!, "onBeat", (event: BeatEventPayload) => {
    setBeatCount(event.absolutePulse + 1);
    triggerBeatCue();
  });

  useEventListener(SongseedMetronomeModule!, "onCountInComplete", () => {
    setCountInCompletionToken((current) => current + 1);
  });

  useEventListener(SongseedMetronomeModule!, "onError", ({ message }) => {
    console.warn("Native metronome error", message);
  });

  const start = useCallback(async (options: MetronomeStartOptions = {}) => {
    if (!SongseedMetronomeModule) return;
    try {
      cueActivationAtRef.current = Date.now() + Math.max(0, options.cueDelayMs ?? 0);
      if (options.manageAudioSession ?? true) {
        await activateMetronomeAudioSession({ ownerId: METRONOME_AUDIO_SESSION_OWNER_ID });
      }
      const nextState = await syncNativeConfig();
      if (nextState) {
        setNativeState(nextState);
      }
      setBeatCount(0);
      const state = await SongseedMetronomeModule.start();
      setNativeState(state);
    } catch (error) {
      await releaseAudioSessionOwner(METRONOME_AUDIO_SESSION_OWNER_ID).catch(() => {});
      throw error;
    }
  }, [syncNativeConfig]);

  const startCountIn = useCallback(
    async (bars = effectiveCountInBars, options: MetronomeStartOptions = {}) => {
      if (!SongseedMetronomeModule) return;
      try {
        cueActivationAtRef.current = Date.now() + Math.max(0, options.cueDelayMs ?? 0);
        if (options.manageAudioSession ?? true) {
          await activateMetronomeAudioSession({ ownerId: METRONOME_AUDIO_SESSION_OWNER_ID });
        }
        const nextState = await syncNativeConfig();
        if (nextState) {
          setNativeState(nextState);
        }
        setBeatCount(0);
        const state = await SongseedMetronomeModule.startCountIn(bars);
        setNativeState(state);
      } catch (error) {
        await releaseAudioSessionOwner(METRONOME_AUDIO_SESSION_OWNER_ID).catch(() => {});
        throw error;
      }
    },
    [effectiveCountInBars, syncNativeConfig]
  );

  const stop = useCallback(async () => {
    if (!SongseedMetronomeModule) return;
    try {
      cueActivationAtRef.current = 0;
      const state = await SongseedMetronomeModule.stop();
      setNativeState(state);
      setBeatCount(0);
    } finally {
      await releaseAudioSessionOwner(METRONOME_AUDIO_SESSION_OWNER_ID).catch(() => {});
    }
  }, []);

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
    currentBeatInBar: nativeState?.beatInBar ?? 1,
    currentBar: nativeState?.barNumber ?? 1,
    countInCompletionToken,
    isNativeAvailable:
      nativeState?.isAvailable ?? SongseedMetronomeModule?.isAvailable?.() ?? false,
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
