import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { activateMetronomeAudioSession } from "../services/audioSession";
import {
  clampMetronomeBpm,
  DEFAULT_METRONOME_BPM,
  DEFAULT_METRONOME_OUTPUTS,
  deriveTapTempoBpm,
  getMetronomeBeatIntervalMs,
  MAX_TAP_HISTORY,
  type MetronomeOutputKey,
  type MetronomeOutputs,
  shouldResetTapTempo,
} from "../metronome";

type UseMetronomeArgs = {
  initialBpm?: number;
  initialOutputs?: Partial<MetronomeOutputs>;
};

function nowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}

export function useMetronome({ initialBpm = DEFAULT_METRONOME_BPM, initialOutputs }: UseMetronomeArgs = {}) {
  const [bpm, setBpm] = useState(() => clampMetronomeBpm(initialBpm));
  const [isRunning, setIsRunning] = useState(false);
  const [outputs, setOutputs] = useState<MetronomeOutputs>({
    ...DEFAULT_METRONOME_OUTPUTS,
    ...initialOutputs,
  });
  const [pulseToken, setPulseToken] = useState(0);
  const [beatCount, setBeatCount] = useState(0);
  const [tapCount, setTapCount] = useState(0);

  const beatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runTokenRef = useRef(0);
  const isRunningRef = useRef(isRunning);
  const bpmRef = useRef(bpm);
  const outputsRef = useRef(outputs);
  const tapTimesRef = useRef<number[]>([]);
  const lastTapAtRef = useRef<number | null>(null);

  const beepPlayer = useAudioPlayer(require("../../assets/metronome-click.wav"), {
    keepAudioSessionActive: true,
  });

  useEffect(() => {
    try {
      beepPlayer.volume = 0.18;
      beepPlayer.loop = false;
    } catch {
      // ignore player setup races
    }
  }, [beepPlayer]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    outputsRef.current = outputs;
  }, [outputs]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  const beatIntervalMs = useMemo(() => getMetronomeBeatIntervalMs(bpm), [bpm]);

  const clearTapTempo = useCallback(() => {
    tapTimesRef.current = [];
    lastTapAtRef.current = null;
    setTapCount(0);
  }, []);

  const clearScheduledBeat = useCallback(() => {
    if (beatTimerRef.current) {
      clearTimeout(beatTimerRef.current);
      beatTimerRef.current = null;
    }
  }, []);

  const playBeep = useCallback(async () => {
    try {
      beepPlayer.pause();
    } catch {
      // ignore stale pause errors
    }

    try {
      await beepPlayer.seekTo(0);
    } catch {
      // ignore unloaded seek errors
    }

    try {
      beepPlayer.play();
    } catch {
      // ignore unloaded play errors
    }
  }, [beepPlayer]);

  const dispatchBeat = useCallback(() => {
    const activeOutputs = outputsRef.current;

    setBeatCount((current) => current + 1);

    if (activeOutputs.visual) {
      setPulseToken((current) => current + 1);
    }

    if (activeOutputs.haptic) {
      void Haptics.selectionAsync().catch(() => {
        // ignore unsupported haptic environments
      });
    }

    if (activeOutputs.beep) {
      void playBeep();
    }
  }, [playBeep]);

  const scheduleBeatAt = useCallback((targetAt: number) => {
    clearScheduledBeat();
    const delay = Math.max(0, targetAt - nowMs());

    beatTimerRef.current = setTimeout(() => {
      if (!isRunningRef.current) {
        return;
      }

      dispatchBeat();
      const nextBeatAt = targetAt + getMetronomeBeatIntervalMs(bpmRef.current);
      scheduleBeatAt(nextBeatAt);
    }, delay);
  }, [clearScheduledBeat, dispatchBeat]);

  const stop = useCallback(() => {
    runTokenRef.current += 1;
    isRunningRef.current = false;
    clearScheduledBeat();
    setIsRunning(false);
  }, [clearScheduledBeat]);

  const start = useCallback(async () => {
    const runToken = runTokenRef.current + 1;
    runTokenRef.current = runToken;
    clearScheduledBeat();
    isRunningRef.current = true;
    setBeatCount(0);
    setIsRunning(true);

    if (outputsRef.current.beep) {
      try {
        await activateMetronomeAudioSession();
      } catch (error) {
        console.warn("Metronome audio session failed", error);
      }
    }

    if (runTokenRef.current !== runToken) {
      return;
    }

    dispatchBeat();
    scheduleBeatAt(nowMs() + getMetronomeBeatIntervalMs(bpmRef.current));
  }, [clearScheduledBeat, dispatchBeat, scheduleBeatAt]);

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
    if (!isRunningRef.current) {
      return;
    }

    scheduleBeatAt(nowMs() + getMetronomeBeatIntervalMs(bpm));
  }, [bpm, scheduleBeatAt]);

  useEffect(() => {
    return () => {
      clearScheduledBeat();
      try {
        beepPlayer.pause();
      } catch {
        // ignore cleanup races
      }
    };
  }, [beepPlayer, clearScheduledBeat]);

  return {
    bpm,
    beatCount,
    beatIntervalMs,
    isRunning,
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
    toggleOutput,
  };
}
