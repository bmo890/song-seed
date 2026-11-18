import { Animated } from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import {
  STREAM_SCHEDULE_PULSES,
  metronomeSupportsStream,
  useMetronome,
  type MetronomeStream,
} from "../../../hooks/useMetronome";
import { useBrowseRootBackHandler } from "../../../hooks/useBrowseRootBackHandler";
import { durations } from "../../../design/motion";
import { useStore } from "../../../state/useStore";
import { isSameAccentPattern, type MetronomeSubdivision } from "../../../domain/metronome";
import {
  MAX_PRACTICE_BARS,
  defaultPractice,
  practiceSteps,
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
  // (a new meter opens on its feel again). Before any edit the page draws the feel as a
  // pattern, and the engine plays that same drawn pattern (2026-11-17: it used to play the
  // plain feel, whose voice differs, so an accent drawn on beat 3 sounded like a click).
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
  // Random needs a binary that streams a tempo map (every 1.0.2 build); elsewhere the
  // page keeps to your pattern and hides the tab.
  const randomAvailable = metronomeSupportsStream();
  const randomOn = practiceOn && practiceMode === "random" && randomAvailable;

  // Random (2026-11-17): bar after bar of the feel with beats silenced, streamed to the
  // engine (useMetronome's MetronomeStream), shown four bars to a pass. The feel's weights
  // come from the engine hook below, a render behind: set during render (never an
  // effect), so the first committed frame already plays the right feel.
  const [feelBeats, setFeelBeats] = useState<number[] | null>(null);
  const [feelSubdivision, setFeelSubdivision] = useState<MetronomeSubdivision>(1);
  const [stream, setStream] = useState<MetronomeStream | null>(null);
  const streamKey = feelBeats ? `${storeMeterId}|${feelBeats.join(",")}` : "";
  const ppbNow = feelBeats?.length ?? 1;
  // Bars stay rolled this far past the one playing: beyond what the engine has already
  // scheduled, so a bar is never changed once it can be heard.
  const barsAhead = Math.ceil(STREAM_SCHEDULE_PULSES / Math.max(1, ppbNow)) + 2;
  if (feelBeats && stream?.key !== streamKey) {
    setStream({ key: streamKey, revision: 0, bars: rollRandomBars(feelBeats, randomSilence, barsAhead + MAX_PRACTICE_BARS, Math.random, { opensRun: true }) });
  }
  const liveStream = stream?.key === streamKey ? stream : null;

  const drawnPractice =
    fittingPractice ?? (feelBeats ? defaultPractice(storeMeterId, feelBeats, feelSubdivision) : null);
  const metronome = useMetronome({
    practice: practiceOn && !randomOn && drawnPractice
      ? { subdivision: drawnPractice.subdivision, steps: practiceSteps(drawnPractice) }
      : null,
    stream: randomOn ? liveStream : null,
  });
  if (!feelBeats || !isSameAccentPattern(feelBeats, metronome.accentPattern)) {
    setFeelBeats([...metronome.accentPattern]);
  }
  if (feelSubdivision !== metronome.subdivision) {
    setFeelSubdivision(metronome.subdivision);
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
  const practiceBarCount = practice.bars.length;
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

  // Random's place in the stream: the absolute bar and beat (the engine counts a map run
  // along the whole grid), shown four bars to a pass.
  const randomPulse = !randomOn || !isPlaying
    ? null
    : pulseClock
      ? metronome.pulseIndex
      : (Math.max(1, metronome.currentBar) - 1) * ppb + Math.max(1, metronome.currentBeatInBar) - 1;
  const randomBar = randomPulse == null ? null : Math.floor(randomPulse / ppb);
  // Keep bars rolled ahead of the one playing; a new pass starts fogged.
  useEffect(() => {
    if (randomBar == null || !feelBeats || !liveStream) return;
    const needed = randomBar + barsAhead + MAX_PRACTICE_BARS;
    if (liveStream.bars.length >= needed) return;
    setStream((current) =>
      current && current.key === liveStream.key
        ? { ...current, bars: [...current.bars, ...rollRandomBars(feelBeats, randomSilence, needed - current.bars.length)] }
        : current
    );
  }, [barsAhead, feelBeats, liveStream, randomBar, randomSilence]);
  // Stopped, the stream starts over: the next run opens on fresh bars.
  const wasRunningRef = useRef(false);
  useEffect(() => {
    const was = wasRunningRef.current;
    wasRunningRef.current = metronome.isRunning;
    if (!was || metronome.isRunning || !feelBeats) return;
    setStream((current) =>
      current
        ? { ...current, revision: current.revision + 1, bars: rollRandomBars(feelBeats, randomSilence, barsAhead + MAX_PRACTICE_BARS, Math.random, { opensRun: true }) }
        : current
    );
  }, [barsAhead, feelBeats, metronome.isRunning, randomSilence]);
  /** A new amount takes over from the next bar: the bars not yet heard are rolled again. */
  const changeRandomSilence = useCallback(
    (next: Parameters<typeof setRandomSilence>[0]) => {
      setRandomSilence(next);
      if (!feelBeats) return;
      setStream((current) => {
        if (!current) return current;
        const keep = randomBar == null ? 0 : randomBar + 1;
        const length = Math.max(current.bars.length, keep + barsAhead + MAX_PRACTICE_BARS);
        return {
          ...current,
          revision: current.revision + 1,
          bars: [...current.bars.slice(0, keep), ...rollRandomBars(feelBeats, next, length - keep, Math.random, { opensRun: keep === 0 })],
        };
      });
    },
    [barsAhead, feelBeats, randomBar, setRandomSilence]
  );
  /** This pass's four bars as they play, the bar and beat being heard within it. */
  const randomPass = randomBar == null ? 0 : Math.floor(randomBar / MAX_PRACTICE_BARS);
  const randomShown = useMemo(
    () => liveStream?.bars.slice(randomPass * MAX_PRACTICE_BARS, (randomPass + 1) * MAX_PRACTICE_BARS) ?? null,
    [liveStream?.bars, randomPass]
  );
  const randomCurrentBar = randomBar == null ? null : randomBar % MAX_PRACTICE_BARS;
  const randomCurrentBeat = randomPulse == null ? null : randomPulse % ppb;

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
    randomAvailable,
    randomSilence,
    setRandomSilence: changeRandomSilence,
    randomShown,
    randomCurrentBar,
    randomCurrentBeat,
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
