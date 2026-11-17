import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useEventListener } from "expo";
import * as Haptics from "expo-haptics";
import { Platform, Vibration } from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "../components/common/toastStore";
import { haptic } from "../design/haptics";
import {
  activateMetronomeAudioSession,
  releaseAudioSessionOwner,
} from "../services/audioSession";
import {
  DEFAULT_METRONOME_BEEP_LEVEL,
  DEFAULT_METRONOME_BPM,
  DEFAULT_METRONOME_CLICK_VOICE,
  DEFAULT_METRONOME_COUNT_IN_BARS,
  DEFAULT_METRONOME_HAPTIC_LEVEL,
  DEFAULT_METRONOME_METER_ID,
  DEFAULT_METRONOME_OUTPUTS,
  DEFAULT_METRONOME_SUBDIVISION,
  MAX_METRONOME_LEVEL,
  MAX_TAP_HISTORY,
  TAP_TEMPO_RESET_MS,
  METRONOME_LOOP_BEAT_COUNT,
  clampMetronomeBpm,
  clampMetronomeLevel,
  deriveTapTempoBpm,
  getMetronomeAccentPattern,
  getMetronomeAndroidVibrationDuration,
  getMetronomeBeatIntervalMs,
  getMetronomeBeepVolume,
  getMetronomeFeelParams,
  getMetronomeGrouping,
  getMetronomeHapticFallbackDuration,
  getMetronomeMeterPreset,
  isSameAccentPattern,
  resolveMetronomeFeelId,
  shouldResetTapTempo,
  type MetronomeBeepLevel,
  type MetronomeClickVoice,
  type MetronomeHapticLevel,
  type MetronomeMeterId,
  type MetronomeOutputKey,
  type MetronomeOutputs,
  type MetronomeSubdivision,
} from "../domain/metronome";
import { ensureMetronomeLoopFile } from "../services/metronomeLoop";
import { resolveCurrentRouteLatencyProfile } from "../services/latencyModel";
import SongNookMetronomeModule from "../../modules/songnook-metronome";
import type { BeatEventPayload, NativeMetronomeState } from "../../modules/songnook-metronome";
import { useStore } from "../state/useStore";

type UseMetronomeArgs = {
  initialBpm?: number;
  initialOutputs?: Partial<MetronomeOutputs>;
  /** Publish `pulseToken` on every pulse. Off for a consumer that draws its beats
   *  from `beatCount` (the recorder), so each pulse costs it one render, not two. */
  visualPulse?: boolean;
  /** The standalone page's practice pattern (domain/metronomePractice) as engine steps.
   *  Only that page passes it; every other click sends none, so a pattern can never
   *  follow anyone into a take or the player. */
  practice?: { subdivision: MetronomeSubdivision; steps: number[] } | null;
  /** The standalone page's Random practice (2026-11-17): bar after bar of the feel's
   *  weights, 0 = silent, streamed along a tempo map so bars can be added while it plays
   *  without the click starting over. See MetronomeStream. Never with `practice`. */
  stream?: MetronomeStream | null;
};

/**
 * Random's bars, from bar 1 of the run. Appending bars feeds the playing map; a new
 * `revision` (same key) re-cues the run in place with the bars as they now stand; a new
 * `key` (another meter or feel) starts it over.
 *
 * Why a map and not the step pattern (Android, 2026-11-17): re-cueing a looping pattern
 * mid-bar restarted the loop there ("resets halfway, double beats"). A map run streams
 * its clicks, so new bars simply arrive ahead of the playhead on both engines. iOS
 * schedules map clicks up to STREAM_SCHEDULE_PULSES ahead, so a bar that close is fixed.
 */
export type MetronomeStream = { key: string; revision: number; bars: number[][] };
export const STREAM_SCHEDULE_PULSES = 32;

/** Binaries that can stream Random: tempo map with rests, phase starts, and on Android
 *  a map stream primed before it plays (older Android map runs never sounded). */
export function metronomeSupportsStream(): boolean {
  const engine = SongNookMetronomeModule;
  return (
    !!engine?.supportsTempoMap?.() &&
    !!engine.configureTempoMap &&
    !!engine.startAtPhase &&
    engine.supportsPhaseStart?.() === true &&
    !!engine.supportsSilentBeats?.() &&
    (Platform.OS !== "android" || !!engine.supportsPrimedMapStream?.())
  );
}

/** Bars as map segments; a run of identical bars is one segment (the last one holds on). */
function streamSegments(
  bars: readonly (readonly number[])[],
  bpm: number,
  meterId: MetronomeMeterId,
  pulsesPerBar: number,
  denominator: number
): import("../../modules/songnook-metronome").NativeTempoMapSegment[] {
  const segments: import("../../modules/songnook-metronome").NativeTempoMapSegment[] = [];
  bars.forEach((accents, index) => {
    const last = segments[segments.length - 1];
    if (last && isSameAccentPattern(last.accentPattern, accents)) return;
    segments.push({ atBar: index + 1, bpm, meterId, pulsesPerBar, denominator, accentPattern: [...accents] });
  });
  return segments;
}

type MetronomeStartOptions = {
  manageAudioSession?: boolean;
  cueDelayMs?: number;
  /** Install this tempo map right after the config sync (which would otherwise clear
   *  it) so the run schedules clicks along the map. Ignored on binaries without
   *  map support — callers keep their JS fallback for those. */
  tempoMapSegments?: import("../../modules/songnook-metronome").NativeTempoMapSegment[];
  /**
   * Start the click already this far into the grid instead of on a fresh downbeat.
   *
   * Used when resuming a paused take: the take's beat grid is anchored to the downbeat it
   * started on, and capture time does not advance while paused, so a click that restarts
   * from pulse 0 lands at an arbitrary phase against that grid. In single-tempo mode this is
   * ms into the BAR; with a tempo map installed the native engine reads it as a whole-grid
   * position (see SongNookMetronomeModule.startAtPhase). Ignored on binaries without
   * phase-start support, which fall back to a plain start.
   */
  phaseOffsetMs?: number;
};

const METRONOME_AUDIO_SESSION_OWNER_ID = "metronome";

export function useMetronome({ initialBpm = DEFAULT_METRONOME_BPM, initialOutputs, visualPulse = true, practice = null, stream = null }: UseMetronomeArgs = {}) {
  if (SongNookMetronomeModule) {
    return useNativeMetronomeImpl({ initialBpm, initialOutputs, visualPulse, practice, stream });
  }

  return useLegacyMetronomeImpl({ initialBpm, initialOutputs, visualPulse });
}

function useNativeMetronomeImpl({ initialBpm = DEFAULT_METRONOME_BPM, initialOutputs, visualPulse = true, practice = null, stream = null }: UseMetronomeArgs = {}) {
  const { t } = useTranslation();
  const visualPulseRef = useRef(visualPulse);
  visualPulseRef.current = visualPulse;
  const bpm = useStore((s) => s.metronomeBpm);
  const meterId = useStore((s) => s.metronomeMeterId);
  const groupingByMeterId = useStore((s) => s.metronomeGroupingByMeterId);
  const outputs = useStore((s) => s.metronomeOutputs);
  const beepLevel = useStore((s) => s.metronomeBeepLevel);
  const hapticLevel = useStore((s) => s.metronomeHapticLevel);
  const countInBars = useStore((s) => s.metronomeCountInBars);
  const legacySubdivision = useStore((s) => s.metronomeSubdivision);
  const feelByMeterId = useStore((s) => s.metronomeFeelByMeterId);
  const customPatternByMeterId = useStore((s) => s.metronomeCustomPatternByMeterId);
  const clickVoice = useStore((s) => s.metronomeClickVoice);
  const setMetronomeBpm = useStore((s) => s.setMetronomeBpm);
  const setMetronomeMeterId = useStore((s) => s.setMetronomeMeterId);
  const setMetronomeGrouping = useStore((s) => s.setMetronomeGrouping);
  const setMetronomeOutputEnabled = useStore((s) => s.setMetronomeOutputEnabled);
  const setMetronomeBeepLevel = useStore((s) => s.setMetronomeBeepLevel);
  const setMetronomeHapticLevel = useStore((s) => s.setMetronomeHapticLevel);
  const setMetronomeCountInBars = useStore((s) => s.setMetronomeCountInBars);
  const setMetronomeSubdivision = useStore((s) => s.setMetronomeSubdivision);
  const setMetronomeFeel = useStore((s) => s.setMetronomeFeel);
  const setMetronomeCustomPattern = useStore((s) => s.setMetronomeCustomPattern);
  const setMetronomeClickVoice = useStore((s) => s.setMetronomeClickVoice);

  const [pulseToken, setPulseToken] = useState(0);
  // The grid pulse the latest pulseToken stands for (run pulse 0 = the loop's start). Set
  // in the same tick as the token, so a consumer never pairs a new flash with the beat
  // number of the one before (2026-11-16: the page flashed two dots per beat).
  const [pulseIndex, setPulseIndex] = useState(0);
  const [beatCount, setBeatCount] = useState(0);
  const [tapCount, setTapCount] = useState(0);
  const [isPreparing, setIsPreparing] = useState(false);
  const [nativeState, setNativeState] = useState<NativeMetronomeState | null>(null);
  const nativeStateRef = useRef(nativeState);
  nativeStateRef.current = nativeState;
  const [countInCompletionToken, setCountInCompletionToken] = useState(0);
  const bluetoothMonitoringCalibrations = useStore((s) => s.bluetoothMonitoringCalibrations);

  const tapTimesRef = useRef<number[]>([]);
  const lastTapAtRef = useRef<number | null>(null);
  // The tap key reads as active while someone is tapping and lets go once they stop
  // (founder 2026-11-15: no running count, the tempo itself is the answer).
  const tapIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (tapIdleTimerRef.current) clearTimeout(tapIdleTimerRef.current);
  }, []);
  const hapticLevelRef = useRef(hapticLevel);
  const outputsRef = useRef(outputs);
  const bpmRef = useRef(bpm);
  const configuredRef = useRef(false);
  const cueActivationAtRef = useRef<number>(0);
  /** True while the currently running engine pass was started by THIS hook instance —
   *  the beat listener below ignores foreign runs (see comment there). */
  const ownsActiveRunRef = useRef(false);
  // Binaries whose engines schedule haptics natively (no bridge at fire time). On older
  // binaries the JS event-driven fallback below keeps working.
  const nativeCuesSupported = !!SongNookMetronomeModule?.supportsScheduledCues?.();
  // Binaries whose engines render sub-clicks and the wood voice. Older ones ignore the
  // keys, so the controls are hidden there rather than lying.
  const supportsClickStyle = !!SongNookMetronomeModule?.supportsClickStyle?.();
  // Binaries whose engines keep a zero-weight pulse silent — what the rest-based
  // feels ("in two") and custom rests need. Older ones would click every pulse.
  const supportsRests = !!SongNookMetronomeModule?.supportsSilentBeats?.();
  // Binaries whose engines loop a practice pattern of up to four bars of steps.
  const supportsStepPattern = !!SongNookMetronomeModule?.supportsStepPattern?.();
  // Android binaries before supportsLoopPhase can't start the loop part-way: the
  // track's head counts from the start while the sound starts at the phase, so a
  // pattern edit or tempo change kept place in sound but lost it in the beat count and
  // the next re-cue jumped (founder, 2026-11-17: "jumps, separated from the
  // animations"). There a change while playing starts the loop over, in step.
  const loopPhaseReliable = Platform.OS !== "android" || !!SongNookMetronomeModule?.supportsLoopPhase?.();
  /** The loop's structure as last given to the engine (see the config sync below). */
  const lastLoopKeyRef = useRef("");
  const activePractice = supportsStepPattern ? practice : null;
  const practiceStepsKey = activePractice ? activePractice.steps.join(",") : "";
  const activeStream = stream && metronomeSupportsStream() ? stream : null;
  const streamOn = !!activeStream;
  const streamRef = useRef(activeStream);
  streamRef.current = activeStream;
  /** What the current Random run was started from (null: not a Random run). */
  const runStreamRef = useRef<{ key: string; revision: number; barCount: number; configKey: string } | null>(null);
  /** The grid pulse a re-cued Random run resumed at: the engine counts the run from 0
   *  again, the page counts the whole stream. */
  const runPulseOffsetRef = useRef(0);
  const practiceActiveRef = useRef(false);
  practiceActiveRef.current = !!activePractice || streamOn;
  /** While a tempo change re-cues the click in place, the engine's passing stop is not a stop. */
  const rephaseHoldUntilRef = useRef(0);
  /** The run was started along a tempo map (a take's grid): never re-cued in place. */
  const runUsesMapRef = useRef(false);

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
    // While the new anchor settles, the engine's own beat events carry the pulse: a re-cue
    // (tempo, pattern, meter) otherwise left a beat in that window with no flash.
    scheduler.active = false;
    if (scheduler.timer) {
      clearTimeout(scheduler.timer);
      scheduler.timer = null;
    }

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
      const gridPulse = Math.max(
        0,
        Math.ceil((now - anchor!.anchorEpochMs! - visualOffsetMs + 4) / msPerPulse)
      );
      const fireAtMs = anchor!.anchorEpochMs! + gridPulse * msPerPulse + visualOffsetMs;

      scheduler.timer = setTimeout(() => {
        void (async () => {
          if (scheduler.token !== token) {
            return;
          }
          if (visualPulseRef.current && outputsRef.current.visual && Date.now() >= cueActivationAtRef.current) {
            setPulseIndex(gridPulse + runPulseOffsetRef.current);
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
  // The feel is the single source: sub-clicks, the click's accents, the beat dots
  // and the visual pulse all derive from it, so they can never disagree.
  const feelId = useMemo(
    () =>
      resolveMetronomeFeelId(effectiveMeterId, feelByMeterId[effectiveMeterId], {
        subdivision: legacySubdivision,
        grouping: groupingByMeterId[effectiveMeterId],
      }),
    [effectiveMeterId, feelByMeterId, groupingByMeterId, legacySubdivision]
  );
  const customPattern = customPatternByMeterId[effectiveMeterId];
  const feelParams = useMemo(
    () =>
      getMetronomeFeelParams(effectiveMeterId, feelId, {
        customPattern,
        currentGrouping: groupingByMeterId[effectiveMeterId],
      }),
    [customPattern, effectiveMeterId, feelId, groupingByMeterId]
  );
  const grouping = feelParams.grouping;
  const accentPattern = feelParams.accentPattern;
  // Sub-clicks only render on binaries that know the key; the feel still names
  // them so the choice survives until the next build.
  const subdivision = supportsClickStyle ? feelParams.subdivision : 1;
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

  const triggerBeatCue = useCallback((silent = false) => {
    if (Date.now() < cueActivationAtRef.current) {
      return;
    }

    const activeOutputs = outputsRef.current;
    // The anchor-aligned scheduler owns the pulse when it's running; event-driven pulses
    // are the fallback for engines with no grid anchor.
    if (visualPulseRef.current && activeOutputs.visual && !visualSchedulerRef.current.active) {
      setPulseToken((current) => current + 1);
    }

    if (!activeOutputs.haptic || silent) {
      return;
    }

    // Engines with scheduled cues fire haptics natively (no bridge at fire time, signed
    // lead applied) — the JS fallback below is for older binaries, and for Random, whose
    // map run would buzz its silent beats natively (only step patterns skip them there).
    if (nativeCuesSupported && !streamRef.current) {
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

  // `preparing` marks a start in flight. The debounced live sync below passes false: a
  // settings edit is not a start, and flagging it dimmed the play key and slid a
  // "Preparing" line in and out under the page on every change (2026-11-16 flicker).
  const syncNativeConfig = useCallback(async ({ preparing = true }: { preparing?: boolean } = {}) => {
    if (!SongNookMetronomeModule) {
      return null;
    }
    if (preparing) setIsPreparing(true);
    try {
      return await SongNookMetronomeModule.configure({
        bpm,
        meterId: meterId,
        pulsesPerBar: meterPreset.pulsesPerBar,
        denominator: meterPreset.denominator,
        accentPattern,
        clickEnabled: outputs.beep,
        clickVolume: getMetronomeBeepVolume(beepLevel),
        // Live-route cue delay from the latency model (refreshed at start): delays the
        // visual/haptic beat EVENTS so legacy consumers land with the audible click.
        outputLatencyMs: routeLatencyProfileRef.current.outputMs,
        // Scheduled-cue engines fire haptics themselves with the signed lead.
        hapticEnabled: nativeCuesSupported && outputs.haptic && !streamOn,
        hapticStrength: clampMetronomeLevel(hapticLevel) / MAX_METRONOME_LEVEL,
        hapticOffsetMs: routeLatencyProfileRef.current.hapticLeadMs,
        // Audio-only ornaments (structural on the engine). Sent unconditionally: older
        // binaries ignore unknown keys, and pinning them here means a stale value can
        // never survive from another client's run.
        subdivision: activePractice ? activePractice.subdivision : subdivision,
        clickVoice,
        // Always sent: an empty list clears a pattern another run left on the engine.
        stepPattern: activePractice ? activePractice.steps : [],
      });
    } finally {
      if (preparing) setIsPreparing(false);
    }
    // practiceStepsKey stands in for the steps array, so a re-render with the same
    // pattern never re-configures (and so never restarts) a running click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accentPattern, bpm, beepLevel, clickVoice, hapticLevel, meterId, meterPreset, nativeCuesSupported, outputs.beep, outputs.haptic, subdivision, activePractice?.subdivision, practiceStepsKey, streamOn]);

  /** What a Random run must re-cue for: anything the engine treats as structural. */
  const streamConfigKey = `${bpm}|${meterId}|${accentPattern.join(",")}|${outputs.beep}|${subdivision}|${clickVoice}`;
  /** Everything that rebuilds the looping bar: a change to it while playing is a re-cue. */
  const loopKey = `${streamConfigKey}|${activePractice?.subdivision ?? 0}|${practiceStepsKey}`;

  /**
   * (Re)start Random along its map. keepPlace: carry on from where the run had got to
   * (a tempo change, a new silence amount), counted at the new tempo; else bar 1.
   */
  const restream = useCallback(async (keepPlace: boolean): Promise<NativeMetronomeState | null> => {
    const engine = SongNookMetronomeModule;
    const current = streamRef.current;
    if (!engine?.configureTempoMap || !engine.startAtPhase || !current) return null;
    const msPerPulse = getMetronomeBeatIntervalMs(bpm);
    let heardPulses = 0;
    let readAt = Date.now();
    if (keepPlace && engine.getGridAnchor) {
      const anchor = await engine.getGridAnchor().catch(() => null);
      if (anchor?.isRunning && !anchor.isCountIn && anchor.anchorEpochMs != null && anchor.msPerPulse != null) {
        readAt = Date.now();
        heardPulses = runPulseOffsetRef.current + Math.max(0, (readAt - anchor.anchorEpochMs) / anchor.msPerPulse);
      }
    }
    rephaseHoldUntilRef.current = Date.now() + 2000;
    try {
      await engine.stop();
      await syncNativeConfig({ preparing: false });
      await engine.configureTempoMap(
        streamSegments(current.bars, bpm, meterId, meterPreset.pulsesPerBar, meterPreset.denominator)
      );
      runUsesMapRef.current = true;
      const offsetMs = heardPulses > 0 ? heardPulses * msPerPulse + (Date.now() - readAt) : 0;
      const state = offsetMs > 0 ? await engine.startAtPhase(offsetMs) : await engine.start();
      // The engine starts its count at the first pulse at or after the offset.
      runPulseOffsetRef.current = offsetMs > 0 ? Math.ceil(offsetMs / msPerPulse - 0.001) : 0;
      runStreamRef.current = {
        key: current.key,
        revision: current.revision,
        barCount: current.bars.length,
        configKey: streamConfigKey,
      };
      ownsActiveRunRef.current = true;
      setNativeState(state);
      void startVisualScheduler();
      return state;
    } catch (error) {
      console.warn("Metronome Random re-cue failed", error);
      haptic.error(); // haptics vocabulary: `error` — something failed
      stopVisualScheduler();
      ownsActiveRunRef.current = false;
      runStreamRef.current = null;
      rephaseHoldUntilRef.current = 0;
      const state = await engine.getState().catch(() => null);
      if (state) setNativeState(state);
      return state;
    } finally {
      if (rephaseHoldUntilRef.current) rephaseHoldUntilRef.current = Date.now() + 250;
    }
    // streamConfigKey stands in for bpm/meter/feel/cue choices already listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, meterId, meterPreset, startVisualScheduler, stopVisualScheduler, syncNativeConfig, streamConfigKey]);

  // Random while it plays: new bars go straight onto the map (no restart); a new silence
  // amount re-cues in place. Another meter or feel comes through the config sync below.
  const streamBarCount = activeStream?.bars.length ?? 0;
  const streamRevision = activeStream?.revision ?? 0;
  const streamKey = activeStream?.key ?? "";
  useEffect(() => {
    const engine = SongNookMetronomeModule;
    const run = runStreamRef.current;
    const current = streamRef.current;
    if (!engine?.configureTempoMap || !run || !current || !ownsActiveRunRef.current) return;
    if (run.key !== current.key || run.configKey !== streamConfigKey) return;
    if (run.revision !== current.revision) {
      void restream(true);
      return;
    }
    if (current.bars.length !== run.barCount) {
      run.barCount = current.bars.length;
      void engine
        .configureTempoMap(streamSegments(current.bars, bpm, meterId, meterPreset.pulsesPerBar, meterPreset.denominator))
        .catch(() => {});
    }
    // The counts and key stand in for the stream object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamBarCount, streamRevision, streamKey, restream]);

  // A tempo change while the click runs keeps its place (founder, 2026-11-17: on beat 3,
  // a + started over at 1). Both engines rebuild a new tempo from the loop's start, so
  // here, in JS (no new binary), we read where the loop has got to, stop, configure, and
  // start the new tempo at that point. A new meter still starts a new bar, and a pattern
  // edit at one tempo already carries on inside the engine (continueRun), so neither
  // comes here. Returns null when it does not apply.
  const practiceStepCount = activePractice ? activePractice.steps.length : 0;
  const keepPlaceThroughTempoChange = useCallback(async (): Promise<NativeMetronomeState | null> => {
    const engine = SongNookMetronomeModule;
    if (!engine?.getGridAnchor || !engine.startAtPhase || engine.supportsPhaseStart?.() !== true) return null;
    if (!loopPhaseReliable) return null;
    // Binaries that carry a tempo on inside configure() need none of this.
    if (engine.supportsTempoContinue?.() === true) return null;
    if (!ownsActiveRunRef.current || runUsesMapRef.current) return null;
    const anchor = await engine.getGridAnchor().catch(() => null);
    if (!anchor?.isRunning || anchor.isCountIn || anchor.anchorEpochMs == null || anchor.msPerPulse == null) {
      return null;
    }
    const pulsesPerBar = meterPreset.pulsesPerBar;
    const nextMsPerPulse = getMetronomeBeatIntervalMs(bpm);
    if (anchor.pulsesPerBar !== pulsesPerBar || Math.abs(anchor.msPerPulse - nextMsPerPulse) < 0.01) return null;

    const readAt = Date.now();
    const heardPulses = Math.max(0, (readAt - anchor.anchorEpochMs) / anchor.msPerPulse);
    // The new loop's length, as the engines count it: a practice pattern runs its bars.
    const stepsPerPulse = activePractice ? Math.max(1, activePractice.subdivision) : 1;
    const loopBars = practiceStepCount > 0 ? Math.max(1, Math.floor(practiceStepCount / (pulsesPerBar * stepsPerPulse))) : 1;
    const loopPulses = pulsesPerBar * loopBars;
    const loopMs = loopPulses * nextMsPerPulse;

    rephaseHoldUntilRef.current = Date.now() + 2000;
    try {
      await engine.stop();
      await syncNativeConfig({ preparing: false });
      // The new tempo takes over where the old one was read, so the time the swap took
      // counts at the new tempo.
      const offsetMs = ((heardPulses % loopPulses) * nextMsPerPulse + (Date.now() - readAt)) % loopMs;
      const state = await engine.startAtPhase(Math.max(1, offsetMs));
      setNativeState(state);
      // The pulse follows the new grid at once instead of at the next bar's re-anchor.
      void startVisualScheduler();
      return state;
    } catch (error) {
      console.warn("Metronome tempo change failed", error);
      haptic.error(); // haptics vocabulary: `error` — something failed
      stopVisualScheduler();
      ownsActiveRunRef.current = false;
      rephaseHoldUntilRef.current = 0;
      const state = await engine.getState().catch(() => null);
      if (state) setNativeState(state);
      return state;
    } finally {
      if (rephaseHoldUntilRef.current) rephaseHoldUntilRef.current = Date.now() + 250;
    }
    // practiceStepCount + subdivision stand in for the practice object (see syncNativeConfig).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, meterPreset.pulsesPerBar, practiceStepCount, activePractice?.subdivision, startVisualScheduler, stopVisualScheduler, syncNativeConfig]);

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
      void (async () => {
        // Random runs along a map: a structural change re-cues it (in place when the
        // meter and feel hold), and switching Random on or off while playing swaps runs.
        const run = runStreamRef.current;
        const running = !!nativeStateRef.current?.isRunning && ownsActiveRunRef.current;
        if (running && streamRef.current && (!run || run.key !== streamRef.current.key || run.configKey !== streamConfigKey)) {
          await restream(!!run && run.key === streamRef.current.key);
          return;
        }
        const engine = SongNookMetronomeModule;
        if (engine && running && run && !streamRef.current) {
          rephaseHoldUntilRef.current = Date.now() + 2000;
          try {
            await engine.stop();
            await engine.clearTempoMap?.().catch(() => {});
            runStreamRef.current = null;
            runUsesMapRef.current = false;
            runPulseOffsetRef.current = 0;
            await syncNativeConfig({ preparing: false });
            const state = await engine.start();
            setNativeState(state);
            void startVisualScheduler();
          } finally {
            rephaseHoldUntilRef.current = Date.now() + 250;
          }
          return;
        }
        if (await keepPlaceThroughTempoChange()) {
          lastLoopKeyRef.current = loopKey;
          return;
        }
        if (engine && !loopPhaseReliable && running && !runUsesMapRef.current && lastLoopKeyRef.current !== loopKey) {
          rephaseHoldUntilRef.current = Date.now() + 2000;
          try {
            await engine.stop();
            await syncNativeConfig({ preparing: false });
            const state = await engine.start();
            lastLoopKeyRef.current = loopKey;
            setNativeState(state);
            void startVisualScheduler();
          } finally {
            rephaseHoldUntilRef.current = Date.now() + 250;
          }
          return;
        }
        const loopChanged = lastLoopKeyRef.current !== loopKey;
        lastLoopKeyRef.current = loopKey;
        const state = await syncNativeConfig({ preparing: false });
        if (state) {
          setNativeState(state);
        }
        // Anything that rebuilds the loop while playing re-cues it: a pattern edit or a feel
        // carries on (continueRun), a new meter starts on its one. Either way the visual
        // pulse re-anchors at once, so the flash never runs a bar on the old grid
        // (2026-11-17; it used to wait for the next bar's refresh outside a pattern).
        if (state?.isRunning && loopChanged && ownsActiveRunRef.current && visualSchedulerRef.current.active) {
          void startVisualScheduler();
        }
      })();
    }, 280);

    return () => {
      if (configSyncTimerRef.current) {
        clearTimeout(configSyncTimerRef.current);
        configSyncTimerRef.current = null;
      }
    };
    // streamConfigKey and streamOn bring Random's re-cue through here; restream is stable
    // for them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keepPlaceThroughTempoChange, startVisualScheduler, syncNativeConfig, streamOn]);

  useEffect(() => {
    if (!SongNookMetronomeModule) {
      return;
    }
    void SongNookMetronomeModule.getState().then((state) => {
      setNativeState(state);
    });
  }, []);

  useEventListener(SongNookMetronomeModule!, "onStateChange", (state) => {
    // A tempo change re-cueing the click in place passes through a stop: not a real one.
    if (!state.isRunning && Date.now() < rephaseHoldUntilRef.current) {
      return;
    }
    // Any stop ends this instance's ownership — otherwise a stale claim from an earlier
    // run would make this instance cue along to the NEXT run even if it's foreign.
    if (!state.isRunning) {
      ownsActiveRunRef.current = false;
    }
    // The engine emits this on EVERY beat, and every mounted instance hears it
    // (the recorder, the metronome page, the songbook reader). Only a real
    // transition re-renders; the beat position rides on beatCount for the run's
    // owner and on the last snapshot's fields for everyone else (2026-09-30).
    setNativeState((prev) => {
      if (!prev) return state;
      const transition =
        prev.isRunning !== state.isRunning ||
        prev.isCountIn !== state.isCountIn ||
        prev.isAvailable !== state.isAvailable;
      if (transition) return state;
      // The run's owner reads its beat position from onBeat (beatCount); a
      // snapshot that only moved the beat is redundant for it.
      if (ownsActiveRunRef.current) return prev;
      const beatMoved = prev.beatInBar !== state.beatInBar || prev.barNumber !== state.barNumber;
      return beatMoved ? state : prev;
    });
  });

  useEventListener(SongNookMetronomeModule!, "onBeat", (event: BeatEventPayload) => {
    // The engine is a singleton and every mounted instance of this hook hears every
    // run's beats — including runs it didn't start (Bluetooth calibration's click pass,
    // the playback click). Cueing along to a foreign run buzzed and pulsed the recording
    // screen underneath the calibration screen; only the initiator owns the cues.
    if (!ownsActiveRunRef.current) {
      return;
    }
    setBeatCount(event.absolutePulse + 1);
    if (!visualSchedulerRef.current.active) {
      setPulseIndex(event.absolutePulse + runPulseOffsetRef.current);
    }
    // The visual counts every beat, as the scheduled pulse does; a silent beat is silent
    // in the hand (2026-11-17: this path used to skip the flash too, so a silent beat
    // flashed or not depending on which clock drew it).
    triggerBeatCue(event.accent <= 0);
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
      // The config sync above clears any installed map (structural configure);
      // install the run's map AFTER it so the start schedules along the map.
      runUsesMapRef.current = false;
      runStreamRef.current = null;
      runPulseOffsetRef.current = 0;
      const streamNow = options.tempoMapSegments ? null : streamRef.current;
      const mapSegments =
        options.tempoMapSegments ??
        (streamNow
          ? streamSegments(streamNow.bars, bpm, meterId, meterPreset.pulsesPerBar, meterPreset.denominator)
          : undefined);
      if (
        mapSegments &&
        SongNookMetronomeModule.supportsTempoMap?.() &&
        SongNookMetronomeModule.configureTempoMap
      ) {
        await SongNookMetronomeModule.configureTempoMap(mapSegments);
        runUsesMapRef.current = true;
        if (streamNow) {
          runStreamRef.current = {
            key: streamNow.key,
            revision: streamNow.revision,
            barCount: streamNow.bars.length,
            configKey: streamConfigKey,
          };
        }
      }
      setBeatCount(0);
      lastLoopKeyRef.current = loopKey;
      const wantsPhaseStart =
        options.phaseOffsetMs != null &&
        Number.isFinite(options.phaseOffsetMs) &&
        options.phaseOffsetMs > 0 &&
        SongNookMetronomeModule.supportsPhaseStart?.() === true &&
        !!SongNookMetronomeModule.startAtPhase;
      const state = wantsPhaseStart
        ? await SongNookMetronomeModule.startAtPhase!(options.phaseOffsetMs!)
        : await SongNookMetronomeModule.start();
      ownsActiveRunRef.current = true;
      setNativeState(state);
      void startVisualScheduler();
    } catch (error) {
      await releaseAudioSessionOwner(METRONOME_AUDIO_SESSION_OWNER_ID).catch(() => {});
      throw error;
    }
    // streamConfigKey stands in for bpm and the meter's fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startVisualScheduler, syncNativeConfig, streamConfigKey]);

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
        // See start(): the map must go in after the (map-clearing) config sync.
        runUsesMapRef.current = false;
        if (
          options.tempoMapSegments &&
          SongNookMetronomeModule.supportsTempoMap?.() &&
          SongNookMetronomeModule.configureTempoMap
        ) {
          await SongNookMetronomeModule.configureTempoMap(options.tempoMapSegments);
          runUsesMapRef.current = true;
        }
        setBeatCount(0);
        const state = await SongNookMetronomeModule.startCountIn(bars);
        ownsActiveRunRef.current = true;
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
      ownsActiveRunRef.current = false;
      rephaseHoldUntilRef.current = 0;
      runUsesMapRef.current = false;
      runStreamRef.current = null;
      runPulseOffsetRef.current = 0;
      const state = await SongNookMetronomeModule.stop();
      // Leave no installed map behind: the standalone metronome must never
      // accidentally start in map mode because a take's map was still loaded.
      await SongNookMetronomeModule.clearTempoMap?.().catch(() => {});
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
    // start() rethrows after releasing the session (an exclusive owner elsewhere, route
    // negotiation); the rejection used to vanish and leave "Start" up with no word.
    start().catch((error) => {
      console.warn("Metronome start failed", error);
      haptic.error(); // haptics vocabulary: `error` — something failed
      toast(t("metronome.startFailed"), "alert-circle-outline");
    });
  }, [nativeState?.isRunning, start, stop, t]);

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
    if (tapIdleTimerRef.current) clearTimeout(tapIdleTimerRef.current);
    tapIdleTimerRef.current = setTimeout(() => setTapCount(0), TAP_TEMPO_RESET_MS);

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
    pulseIndex,
    tapCount,
    meterId: effectiveMeterId,
    meterPreset,
    grouping,
    accentPattern,
    /** True when the pattern carries rests or a custom edit — a take must store
     *  it (RecordingGrid.accentPattern) to replay the same feel. */
    explicitAccentPattern: feelParams.explicitPattern,
    countInBars: effectiveCountInBars,
    subdivision,
    feelId,
    customPattern: feelParams.accentPattern,
    clickVoice,
    supportsClickStyle,
    supportsRests,
    supportsStepPattern,
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
    setGrouping: setMetronomeGrouping,
    setCountInBarsValue: setMetronomeCountInBars,
    setSubdivisionValue: setMetronomeSubdivision,
    setFeel: setMetronomeFeel,
    setCustomPattern: setMetronomeCustomPattern,
    setClickVoiceValue: setMetronomeClickVoice,
  };
}

function useLegacyMetronomeImpl({ initialBpm = DEFAULT_METRONOME_BPM, initialOutputs, visualPulse = true }: UseMetronomeArgs = {}) {
  const visualPulseRef = useRef(visualPulse);
  visualPulseRef.current = visualPulse;
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
  // The tap key reads as active while someone is tapping and lets go once they stop
  // (founder 2026-11-15: no running count, the tempo itself is the answer).
  const tapIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (tapIdleTimerRef.current) clearTimeout(tapIdleTimerRef.current);
  }, []);
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

    if (visualPulseRef.current && activeOutputs.visual) {
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
    if (tapIdleTimerRef.current) clearTimeout(tapIdleTimerRef.current);
    tapIdleTimerRef.current = setTimeout(() => setTapCount(0), TAP_TEMPO_RESET_MS);

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
    pulseIndex: Math.max(0, beatCount - 1),
    tapCount,
    meterId: DEFAULT_METRONOME_METER_ID,
    meterPreset: getMetronomeMeterPreset(DEFAULT_METRONOME_METER_ID),
    grouping: getMetronomeGrouping(DEFAULT_METRONOME_METER_ID),
    accentPattern: getMetronomeAccentPattern(DEFAULT_METRONOME_METER_ID),
    countInBars: DEFAULT_METRONOME_COUNT_IN_BARS,
    subdivision: DEFAULT_METRONOME_SUBDIVISION as MetronomeSubdivision,
    explicitAccentPattern: false,
    feelId: "beats",
    customPattern: getMetronomeAccentPattern(DEFAULT_METRONOME_METER_ID),
    supportsRests: false,
    supportsStepPattern: false,
    clickVoice: DEFAULT_METRONOME_CLICK_VOICE as MetronomeClickVoice,
    // The WAV fallback renders one stock click per beat; the controls stay hidden here.
    supportsClickStyle: false,
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
    setGrouping: () => {},
    setCountInBarsValue: () => {},
    setSubdivisionValue: () => {},
    setFeel: () => {},
    setCustomPattern: () => {},
    setClickVoiceValue: () => {},
  };
}
