import { Animated } from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useMetronome } from "../../../hooks/useMetronome";
import { useBrowseRootBackHandler } from "../../../hooks/useBrowseRootBackHandler";
import { durations } from "../../../design/motion";
import { useStore } from "../../../state/useStore";
import { isSameAccentPattern } from "../../../domain/metronome";
import {
  MAX_PRACTICE_BARS,
  defaultPractice,
  practiceSteps,
  randomPractice,
  rollRandomBar,
  rollRandomBars,
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
  // A mode you switch on (2026-11-16): off, the page plays the plain feel and keeps the
  // pattern for next time.
  const practiceOn = useStore((s) => s.metronomePracticeOn);
  const setPracticeOn = useStore((s) => s.setMetronomePracticeOn);
  const screenFlash = useStore((s) => s.metronomeScreenFlash);
  const setStoredScreenFlash = useStore((s) => s.setMetronomeScreenFlash);
  const visualDots = useStore((s) => s.metronomeVisualDots);
  const setStoredVisualDots = useStore((s) => s.setMetronomeVisualDots);
  const fittingPractice = storedPractice && storedPractice.meterId === storeMeterId ? storedPractice : null;
  const practiceMode = useStore((s) => s.metronomePracticeMode);
  const setPracticeMode = useStore((s) => s.setMetronomePracticeMode);
  const randomSilence = useStore((s) => s.metronomeRandomSilence);
  const setRandomSilence = useStore((s) => s.setMetronomeRandomSilence);
  const randomOn = practiceOn && practiceMode === "random";

  // Random (2026-11-17): four bars of the feel with beats silenced. `front` holds the first
  // two bars as they were heard this pass, once they have been rolled again for the next.
  // The feel's weights come from the engine hook below, a render behind: set during render
  // (never an effect), so the first committed frame already plays the right feel.
  const [feelBeats, setFeelBeats] = useState<number[] | null>(null);
  const [random, setRandom] = useState<{ key: string; bars: number[][]; front: number[][] | null } | null>(null);
  const randomKey = feelBeats ? `${storeMeterId}|${feelBeats.join(",")}|${randomSilence}` : "";
  if (feelBeats && random?.key !== randomKey) {
    setRandom({ key: randomKey, bars: rollRandomBars(feelBeats, randomSilence), front: null });
  }
  const randomBars = random?.key === randomKey ? random.bars : null;

  const enginePractice = !practiceOn
    ? null
    : randomOn
      ? randomBars
        ? randomPractice(storeMeterId, fittingPractice?.subdivision ?? 1, randomBars)
        : null
      : fittingPractice;
  const metronome = useMetronome({
    practice: enginePractice ? { subdivision: enginePractice.subdivision, steps: practiceSteps(enginePractice) } : null,
  });
  if (!feelBeats || !isSameAccentPattern(feelBeats, metronome.accentPattern)) {
    setFeelBeats([...metronome.accentPattern]);
  }
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
  // Dots and Flash are independent; switching the last one off turns the Visual cue off.
  // Both stay off as left while the row folds away (restoring the dots then made them
  // blink back on mid-fold, 2026-11-16); turning Visual on again brings the dots back.
  const { toggleOutput: toggleCueOutput } = metronome;
  const setVisualDots = useCallback(
    (on: boolean) => {
      setStoredVisualDots(on);
      if (!on && !screenFlash) toggleCueOutput("visual");
    },
    [screenFlash, setStoredVisualDots, toggleCueOutput]
  );
  const setScreenFlash = useCallback(
    (on: boolean) => {
      setStoredScreenFlash(on);
      if (!on && !visualDots) toggleCueOutput("visual");
    },
    [visualDots, setStoredScreenFlash, toggleCueOutput]
  );
  const toggleOutput = useCallback(
    (key: Parameters<typeof toggleCueOutput>[0]) => {
      if (key === "visual" && !metronome.outputs.visual && !visualDots && !screenFlash) {
        setStoredVisualDots(true);
      }
      toggleCueOutput(key);
    },
    [metronome.outputs.visual, screenFlash, setStoredVisualDots, toggleCueOutput, visualDots]
  );
  const practiceBarCount = randomOn ? MAX_PRACTICE_BARS : practice.bars.length;
  const isPlaying = practiceOn && metronome.isRunning && !metronome.isCountIn;
  const ppb = Math.max(1, metronome.meterPreset.pulsesPerBar);
  // One clock on screen (2026-11-16): with the visual cue on, the bar, the beat and the
  // pattern's pulse all read the anchor-timed pulse, so nothing lands a beat apart.
  const pulseClock = metronome.isRunning && metronome.outputs.visual;
  const practiceBar = !isPlaying
    ? null
    : pulseClock
      ? Math.floor(metronome.pulseIndex / ppb) % practiceBarCount
      : (Math.max(1, metronome.currentBar) - 1) % practiceBarCount;
  const practiceBeat = !isPlaying
    ? null
    : pulseClock
      ? metronome.pulseIndex % ppb
      : Math.max(1, metronome.currentBeatInBar) - 1;
  /** The step pulse for the pattern: which beat just sounded and how long each step lasts. */
  const practicePulse =
    isPlaying && pulseClock && practiceBar != null && practiceBeat != null
      ? {
          token: metronome.pulseToken,
          bar: practiceBar,
          beat: practiceBeat,
          stepMs: metronome.beatIntervalMs / Math.max(1, practice.subdivision),
        }
      : null;
  // The dots only count (founder, 2026-11-17): every beat is the same dot, the one
  // included (no ring), whatever the pattern or feel accents or silences. The pattern
  // shows itself below; someone who wants no visual turns the dots off. Groups still
  // open their gap (6/8 reads 3 + 3) from the grouping. The flash keeps its own
  // stronger wash on the one.
  const heroAccentPattern = useMemo(() => Array.from({ length: ppb }, () => 0.5), [ppb]);
  const heroPulseBeat = pulseClock ? (metronome.pulseIndex % ppb) + 1 : undefined;

  // Random rolls the half that is not playing: entering bar 3, the first two bars are rolled
  // for the next pass (what they played stays on screen as `front`); back at bar 1, the last
  // two. A rolled bar is always a bar or more away, so the engine has it in time and carries
  // on from where it is (same-grid configure continues).
  const lastRandomBarRef = useRef<number | null>(null);
  useEffect(() => {
    const previous = lastRandomBarRef.current;
    lastRandomBarRef.current = randomOn ? practiceBar : null;
    if (!randomOn || practiceBar == null || previous == null || previous === practiceBar || !feelBeats) return;
    if (practiceBar === 2) {
      setRandom((current) =>
        current && {
          ...current,
          front: current.bars.slice(0, 2),
          bars: [rollRandomBar(feelBeats, randomSilence), rollRandomBar(feelBeats, randomSilence), ...current.bars.slice(2)],
        }
      );
    } else if (practiceBar === 0) {
      setRandom((current) =>
        current && {
          ...current,
          front: null,
          bars: [...current.bars.slice(0, 2), rollRandomBar(feelBeats, randomSilence), rollRandomBar(feelBeats, randomSilence)],
        }
      );
    }
  }, [feelBeats, practiceBar, randomOn, randomSilence]);
  /** What each bar of this pass plays, for the page: the first two as heard once rolled anew. */
  const randomShown = useMemo(() => {
    if (!randomBars) return null;
    if (practiceBar != null && practiceBar >= 2 && random?.front) return [...random.front, ...randomBars.slice(2)];
    return randomBars;
  }, [practiceBar, random?.front, randomBars]);

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
    practiceOn,
    setPracticeOn,
    practiceMode,
    setPracticeMode,
    randomSilence,
    setRandomSilence,
    randomShown,
    screenFlash,
    setScreenFlash,
    visualDots,
    setVisualDots,
    toggleOutput,
    setFeelPreset,
    practiceBar,
    practiceBeat,
    practicePulse,
    heroPulseBeat,
    heroAccentPattern,
  };
}
