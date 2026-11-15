import { Animated } from "react-native";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useMetronome } from "../../../hooks/useMetronome";
import { useBrowseRootBackHandler } from "../../../hooks/useBrowseRootBackHandler";
import { durations } from "../../../design/motion";
import { useStore } from "../../../state/useStore";
import {
  defaultPractice,
  practiceSteps,
  type MetronomePractice,
} from "../../../domain/metronomePractice";

const KEEP_AWAKE_TAG = "metronome";

function releaseKeepAwake() {
  try {
    void deactivateKeepAwake(KEEP_AWAKE_TAG);
  } catch {
    // no-op where keep-awake is unavailable (web)
  }
}

export function useMetronomeScreenModel() {
  useBrowseRootBackHandler();
  const pulseAnim = useRef(new Animated.Value(0)).current;
  // The practice pattern: stored once someone edits it, and only while it fits the meter
  // (a new meter opens on its feel again). Before any edit the engine plays the feel.
  const storedPractice = useStore((s) => s.metronomePractice);
  const setStoredPractice = useStore((s) => s.setMetronomePractice);
  const storeMeterId = useStore((s) => s.metronomeMeterId);
  const fittingPractice = storedPractice && storedPractice.meterId === storeMeterId ? storedPractice : null;
  const metronome = useMetronome({
    practice: fittingPractice
      ? { subdivision: fittingPractice.subdivision, steps: practiceSteps(fittingPractice) }
      : null,
  });
  const practice: MetronomePractice = useMemo(
    () =>
      fittingPractice ??
      defaultPractice(metronome.meterId, metronome.accentPattern, metronome.subdivision),
    [fittingPractice, metronome.meterId, metronome.accentPattern, metronome.subdivision]
  );
  const setPractice = useCallback((next: MetronomePractice) => setStoredPractice(next), [setStoredPractice]);
  /** A feel picked in the Meter sheet is a preset: the pattern starts over from it. */
  const setFeelPreset = useCallback(
    (feelId: string) => {
      metronome.setFeel(metronome.meterId, feelId);
      setStoredPractice(null);
    },
    [metronome, setStoredPractice]
  );
  const practiceBarCount = practice.bars.length;
  const isPlaying = metronome.isRunning && !metronome.isCountIn;
  const practiceBar = isPlaying ? (Math.max(1, metronome.currentBar) - 1) % practiceBarCount : null;
  const practiceBeat = isPlaying ? Math.max(1, metronome.currentBeatInBar) - 1 : null;
  // The hero's dots mirror the bar being heard (the first one while stopped).
  const heroBar = practice.bars[practiceBar ?? 0];
  const heroAccentPattern = heroBar.rest ? heroBar.beats.map(() => 0) : heroBar.beats;

  // Leaving the page ends the session. The native metronome engine runs on its
  // own thread and keeps ticking after this screen unmounts, so nothing stops
  // the click unless we do it here — otherwise it plays on in the background
  // with no way to stop it but to navigate back in and hit Stop. Refs keep the
  // blur cleanup stable so an unrelated re-render can't tear down a live session.
  const isActiveRef = useRef(false);
  isActiveRef.current =
    metronome.isRunning || metronome.isCountIn || metronome.isPreparing;
  const stopRef = useRef(metronome.stop);
  stopRef.current = metronome.stop;

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (isActiveRef.current) {
          void stopRef.current();
        }
        releaseKeepAwake();
      };
    }, [])
  );

  // A running metronome lives on a music stand: the screen must not dim under it.
  // Held only while the click runs, released on stop and on leaving the page.
  const isBeating = metronome.isRunning || metronome.isCountIn;
  useEffect(() => {
    if (!isBeating) {
      releaseKeepAwake();
      return;
    }
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return releaseKeepAwake;
  }, [isBeating]);

  const activeOutputCount = useMemo(
    () => Object.values(metronome.outputs).filter(Boolean).length,
    [metronome.outputs]
  );
  // Deliberately loud: the halo is the page's visual beat, so it flashes at
  // 0.55 opacity and grows well past the core instead of a faint shimmer.
  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1.35],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.55],
  });

  useEffect(() => {
    if (
      !metronome.isRunning ||
      !metronome.outputs.visual ||
      metronome.pulseToken === 0
    ) {
      return;
    }

    pulseAnim.stopAnimation();
    pulseAnim.setValue(0);
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: durations.fast,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 0,
        duration: durations.slow,
        useNativeDriver: true,
      }),
    ]).start();
  }, [metronome.isRunning, metronome.outputs.visual, metronome.pulseToken, pulseAnim]);

  return {
    ...metronome,
    activeOutputCount,
    pulseScale,
    pulseOpacity,
    practice,
    setPractice,
    setFeelPreset,
    practiceBar,
    practiceBeat,
    heroAccentPattern: metronome.supportsStepPattern ? heroAccentPattern : metronome.accentPattern,
  };
}
