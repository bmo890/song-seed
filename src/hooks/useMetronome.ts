import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as Haptics from "expo-haptics";
import { Platform, Vibration } from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { activateMetronomeAudioSession } from "../services/audioSession";
import {
  clampMetronomeBpm,
  clampMetronomeLevel,
  DEFAULT_METRONOME_BEEP_LEVEL,
  DEFAULT_METRONOME_BPM,
  DEFAULT_METRONOME_HAPTIC_LEVEL,
  DEFAULT_METRONOME_OUTPUTS,
  deriveTapTempoBpm,
  getMetronomeAndroidVibrationDuration,
  getMetronomeBeepVolume,
  getMetronomeBeatIntervalMs,
  getMetronomeHapticFallbackDuration,
  MAX_TAP_HISTORY,
  METRONOME_LOOP_BEAT_COUNT,
  type MetronomeBeepLevel,
  type MetronomeHapticLevel,
  type MetronomeOutputKey,
  type MetronomeOutputs,
  shouldResetTapTempo,
} from "../metronome";
import { ensureMetronomeLoopFile } from "../services/metronomeLoop";

type UseMetronomeArgs = {
  initialBpm?: number;
  initialOutputs?: Partial<MetronomeOutputs>;
};

export function useMetronome({ initialBpm = DEFAULT_METRONOME_BPM, initialOutputs }: UseMetronomeArgs = {}) {
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

  const stop = useCallback(() => {
    runTokenRef.current += 1;
    isRunningRef.current = false;
    resetBeatTracking();
    setIsRunning(false);
    try {
      player.pause();
    } catch {
      // ignore pause races
    }
  }, [player, resetBeatTracking]);

  const start = useCallback(async () => {
    const runToken = runTokenRef.current + 1;
    runTokenRef.current = runToken;
    isRunningRef.current = true;
    resetBeatTracking();
    setIsRunning(true);

    try {
      await activateMetronomeAudioSession();
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
      stop();
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
    start,
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
  };
}
