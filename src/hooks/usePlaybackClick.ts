import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEventListener } from "expo";
import SongNookMetronomeModule from "../../modules/songnook-metronome";
import {
  clickEngineParamsAt,
  isPlaybackClickAvailable,
  nativeTempoMapSegments,
  wallMsUntil,
  type PlaybackClickEngineParams,
  type PlaybackClickGrid,
} from "../domain/playbackClick";
import {
  MAX_METRONOME_BPM,
  MAX_METRONOME_LEVEL,
  MIN_METRONOME_BPM,
  clampMetronomeLevel,
  getMetronomeBeepVolume,
} from "../domain/metronome";
import { resolveCurrentRouteLatencyProfile } from "../services/latencyModel";
import { useStore } from "../state/useStore";

/**
 * The playback click: sounds a take's own beat grid along with playback, from any
 * scrub position, following the practice rate. Talks to the native metronome module
 * DIRECTLY — never through useMetronome/store settings, which belong to the user's
 * standalone metronome (this hook must not clobber their saved tempo/meter).
 *
 * Sync model (pre shared-transport, plan §4): re-derive engine params and restart
 * phase-aligned on every play / seek / rate change / tempo-segment boundary, stop at
 * `gridValidToMs`, and correct drift against the engine's grid anchor every few bars.
 * Every sync logs its phase error — that number is the Phase F KPI.
 *
 * Binary compatibility: phase-aligned starts need the `startAtPhase` native call. On
 * older binaries the fallback delays the plain start to the NEXT bar line (JS-timer
 * accuracy) — aligned, just up to one bar late. Count-in uses only long-standing APIs.
 */

const DRIFT_CHECK_INTERVAL_MS = 10_000;
/** Restart the click when it has drifted this far from the playhead's grid. */
const DRIFT_RESYNC_THRESHOLD_MS = 35;

type UsePlaybackClickArgs = {
  grid: PlaybackClickGrid | null | undefined;
  isPlaying: boolean;
  playbackRate: number;
  /** Read the CURRENT content position (ms) — called at sync moments only. */
  getPositionMs: () => number;
};

export type PlaybackClickApi = {
  /** This take can click at all (trustworthy grid + native engine present). */
  isAvailable: boolean;
  /** The current practice rate keeps the scaled tempo inside the engine's range. */
  isRateSupported: boolean;
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  isCountingIn: boolean;
  /**
   * Count one bar (or more) in the take's tempo at the playhead, then fire
   * `onDownbeat` (the caller starts playback there). Resolves false when a count-in
   * can't run (no grid / rate unsupported / engine missing) — caller plays directly.
   */
  playWithCountIn: (bars: number, onDownbeat: () => void) => Promise<boolean>;
  cancelCountIn: () => void;
  /** Call after any committed position jump (seek, loop wrap) with the target ms. */
  notifySeek: (targetMs: number) => void;
  /** The engine can buzz the beat natively (scheduled cues); older binaries can't. */
  supportsHaptic: boolean;
};

export function usePlaybackClick(args: UsePlaybackClickArgs): PlaybackClickApi {
  if (SongNookMetronomeModule) {
    return usePlaybackClickNative(args);
  }
  return usePlaybackClickInert();
}

function usePlaybackClickInert(): PlaybackClickApi {
  return {
    isAvailable: false,
    isRateSupported: false,
    enabled: false,
    setEnabled: () => {},
    isCountingIn: false,
    playWithCountIn: async () => false,
    cancelCountIn: () => {},
    notifySeek: () => {},
    supportsHaptic: false,
  };
}

function usePlaybackClickNative({
  grid,
  isPlaying,
  playbackRate,
  getPositionMs,
}: UsePlaybackClickArgs): PlaybackClickApi {
  // The click's OWN volume dial — never the standalone metronome's beep level,
  // which a musician may keep muted (haptic-only) without meaning to silence
  // the playback click too.
  const beepLevel = useStore((s) => s.playbackClickLevel);
  // Its own haptic switch too (same reasoning); strength shares the metronome's dial,
  // which is a feel setting rather than a per-surface one.
  const hapticEnabled = useStore((s) => s.playbackClickHaptic);
  const hapticLevel = useStore((s) => s.metronomeHapticLevel);
  const bluetoothMonitoringCalibrations = useStore((s) => s.bluetoothMonitoringCalibrations);

  const [enabled, setEnabledState] = useState(false);
  const [isCountingIn, setIsCountingIn] = useState(false);

  const gridRef = useRef(grid);
  gridRef.current = grid;
  const rateRef = useRef(playbackRate);
  rateRef.current = playbackRate;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const beepLevelRef = useRef(beepLevel);
  beepLevelRef.current = beepLevel;
  const hapticRef = useRef(hapticEnabled);
  hapticRef.current = hapticEnabled;
  const hapticLevelRef = useRef(hapticLevel);
  hapticLevelRef.current = hapticLevel;
  const calibrationsRef = useRef(bluetoothMonitoringCalibrations);
  calibrationsRef.current = bluetoothMonitoringCalibrations;
  /** Signed haptic lead for the current route (latency model), refreshed per sync. */
  const hapticLeadMsRef = useRef(0);
  const getPositionRef = useRef(getPositionMs);
  getPositionRef.current = getPositionMs;

  /** Increments on every sync/stop — invalidates in-flight async work and timers. */
  const syncTokenRef = useRef(0);
  const engineOwnedRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const driftIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingDownbeatRef = useRef<(() => void) | null>(null);
  const isCountingInRef = useRef(false);

  const supportsPhaseStart = !!SongNookMetronomeModule?.supportsPhaseStart?.();
  // Haptics only where the engine schedules them itself with the signed lead. No JS
  // event fallback here: a late buzz against a moving take is worse than none.
  const nativeCuesSupported = !!SongNookMetronomeModule?.supportsScheduledCues?.();

  const clearTimers = useCallback(() => {
    for (const timer of timersRef.current) {
      clearTimeout(timer);
    }
    timersRef.current = [];
    if (driftIntervalRef.current) {
      clearInterval(driftIntervalRef.current);
      driftIntervalRef.current = null;
    }
  }, []);

  const stopEngine = useCallback(async () => {
    syncTokenRef.current += 1;
    clearTimers();
    if (!engineOwnedRef.current) {
      return;
    }
    engineOwnedRef.current = false;
    try {
      await SongNookMetronomeModule!.stop();
      // Leave no installed map behind for the standalone metronome to trip over.
      await SongNookMetronomeModule!.clearTempoMap?.().catch(() => {});
    } catch (error) {
      console.warn("[timing] playback click stop failed", error);
    }
  }, [clearTimers]);

  /** Resolve the route's haptic lead the same way the metronome does at start. */
  const refreshHapticLead = useCallback(async (params: PlaybackClickEngineParams) => {
    if (!nativeCuesSupported || !hapticRef.current) {
      hapticLeadMsRef.current = 0;
      return;
    }
    try {
      const profile = await resolveCurrentRouteLatencyProfile({
        calibrations: calibrationsRef.current,
        activeOutputs: { beep: true, visual: false, haptic: true },
        clickLoopBarMs: params.barWallMs,
      });
      hapticLeadMsRef.current = Math.round(profile.hapticLeadMs);
    } catch (error) {
      console.warn("[timing] playback click haptic lead resolution failed", error);
      hapticLeadMsRef.current = 0;
    }
  }, [nativeCuesSupported]);

  const configureForParams = useCallback(async (params: PlaybackClickEngineParams) => {
    await refreshHapticLead(params);
    await SongNookMetronomeModule!.configure({
      bpm: params.bpm,
      meterId: params.meterId,
      pulsesPerBar: params.pulsesPerBar,
      denominator: params.denominator,
      accentPattern: params.accentPattern,
      clickEnabled: true,
      clickVolume: getMetronomeBeepVolume(beepLevelRef.current),
      // Click and song share the output route — both delayed equally, aligned at the
      // ear. No cue-lead correction here; playback surfaces have no beat UI yet.
      outputLatencyMs: 0,
      hapticEnabled: nativeCuesSupported && hapticRef.current,
      hapticStrength: clampMetronomeLevel(hapticLevelRef.current) / MAX_METRONOME_LEVEL,
      hapticOffsetMs: hapticLeadMsRef.current,
      // The engine MERGES configs: pin the ornaments so a subdivision or wood voice
      // left by the standalone metronome never leaks into the practice click.
      subdivision: 1,
      clickVoice: "click",
    });
  }, [nativeCuesSupported, refreshHapticLead]);

  /** (Re)start the click phase-aligned at the given (or current) position. */
  const syncClick = useCallback(
    async (positionOverrideMs?: number) => {
      syncTokenRef.current += 1;
      const token = syncTokenRef.current;
      clearTimers();

      if (!enabledRef.current || !isPlayingRef.current || isCountingInRef.current) {
        return;
      }

      const positionMs = positionOverrideMs ?? getPositionRef.current();
      const rate = rateRef.current;
      const params = clickEngineParamsAt({ grid: gridRef.current, positionMs, rate });
      if (!params) {
        await stopEngine();
        return;
      }

      let usedNativeMap = false;
      let nativeMapSegmentCount = 0;
      try {
        await configureForParams(params);
        if (syncTokenRef.current !== token) return;

        // Map-capable engines take the WHOLE map and a whole-grid offset: tempo
        // changes then land natively (no boundary timers, no restarts).
        const mapSegments =
          SongNookMetronomeModule!.supportsTempoMap?.() && SongNookMetronomeModule!.configureTempoMap
            ? nativeTempoMapSegments(gridRef.current!, rate)
            : null;
        if (mapSegments && SongNookMetronomeModule!.startAtPhase) {
          usedNativeMap = true;
          nativeMapSegmentCount = mapSegments.length;
          await SongNookMetronomeModule!.configureTempoMap!(mapSegments);
          if (syncTokenRef.current !== token) return;
          const offsetMs = Math.max(0, gridRef.current!.firstDownbeatMs ?? 0);
          const gridWallOffsetMs = Math.max(0, (positionMs - offsetMs) / rate);
          await SongNookMetronomeModule!.startAtPhase(gridWallOffsetMs);
          engineOwnedRef.current = true;
          console.log(
            `[timing] click sync (map): pos=${Math.round(positionMs)}ms rate=${rate} ` +
              `gridOffset=${Math.round(gridWallOffsetMs)}ms segments=${mapSegments.length}`
          );
        } else if (supportsPhaseStart && SongNookMetronomeModule!.startAtPhase) {
          await SongNookMetronomeModule!.startAtPhase(params.phaseOffsetWallMs);
          engineOwnedRef.current = true;
          console.log(
            `[timing] click sync: pos=${Math.round(positionMs)}ms rate=${rate} ` +
              `bpm=${params.bpm} phase=${Math.round(params.phaseOffsetWallMs)}ms`
          );
        } else {
          // Old binary: no mid-bar start. Wait for the next bar line, then start clean.
          const waitMs = Math.max(0, params.barWallMs - params.phaseOffsetWallMs);
          console.log(
            `[timing] click sync (no phase start): pos=${Math.round(positionMs)}ms ` +
              `waiting ${Math.round(waitMs)}ms for the next bar line`
          );
          timersRef.current.push(
            setTimeout(() => {
              if (syncTokenRef.current !== token) return;
              void SongNookMetronomeModule!.start()
                .then(() => {
                  engineOwnedRef.current = true;
                })
                .catch(() => {});
            }, waitMs)
          );
        }
      } catch (error) {
        console.warn("[timing] playback click start failed", error);
        return;
      }
      if (syncTokenRef.current !== token) return;

      // Tempo-segment boundary: break phase there and re-derive — needed only on
      // engines without native maps (the map engine lands changes itself).
      if (!usedNativeMap && params.nextBoundaryContentMs != null) {
        timersRef.current.push(
          setTimeout(() => {
            if (syncTokenRef.current !== token) return;
            void syncClick();
          }, wallMsUntil(positionMs, params.nextBoundaryContentMs, rate))
        );
      }
      // Untrusted-grid boundary: the click never sounds a lie.
      if (params.stopAtContentMs != null) {
        timersRef.current.push(
          setTimeout(() => {
            if (syncTokenRef.current !== token) return;
            console.log("[timing] click stopped at gridValidToMs — grid untrusted past here");
            void stopEngine();
          }, wallMsUntil(positionMs, params.stopAtContentMs, rate))
        );
      }

      // Two clocks (engine sample clock vs player clock) — check drift periodically
      // and restart when audible. The logged error is the Phase F shared-clock KPI.
      // The modular phase math assumes ONE bar length; past a native multi-segment
      // map's first boundary it stops being meaningful, so those runs skip the check
      // (their tempo error is bounded by the same int-bpm rounding either way).
      if (usedNativeMap && nativeMapSegmentCount > 1) {
        return;
      }
      driftIntervalRef.current = setInterval(() => {
        void (async () => {
          if (syncTokenRef.current !== token) return;
          const anchor = await SongNookMetronomeModule!.getGridAnchor?.().catch(() => null);
          if (
            syncTokenRef.current !== token ||
            !anchor?.isRunning ||
            anchor.anchorEpochMs == null ||
            anchor.msPerPulse == null
          ) {
            return;
          }
          const barWall = anchor.msPerPulse * (anchor.pulsesPerBar ?? params.pulsesPerBar);
          const enginePhase = ((Date.now() - anchor.anchorEpochMs) % barWall + barWall) % barWall;
          const nowParams = clickEngineParamsAt({
            grid: gridRef.current,
            positionMs: getPositionRef.current(),
            rate: rateRef.current,
          });
          if (!nowParams) return;
          const rawError = enginePhase - nowParams.phaseOffsetWallMs;
          const wrapped = ((rawError % barWall) + barWall * 1.5) % barWall - barWall / 2;
          console.log(`[timing] click drift: ${Math.round(wrapped)}ms`);
          if (Math.abs(wrapped) > DRIFT_RESYNC_THRESHOLD_MS) {
            void syncClick();
          }
        })();
      }, DRIFT_CHECK_INTERVAL_MS);
    },
    [clearTimers, configureForParams, stopEngine, supportsPhaseStart]
  );

  // Follow the transport: play ↔ pause/stop, rate changes, take changes. The
  // volume dial rides along — a level change re-configures mid-play, so the
  // slider is audible immediately rather than from the next sync.
  useEffect(() => {
    if (enabled && isPlaying) {
      void syncClick();
    } else if (!isCountingInRef.current) {
      void stopEngine();
    }
  }, [enabled, isPlaying, playbackRate, grid, beepLevel, hapticEnabled, hapticLevel, syncClick, stopEngine]);

  useEffect(() => {
    return () => {
      void stopEngine();
    };
  }, [stopEngine]);

  useEventListener(SongNookMetronomeModule!, "onCountInComplete", () => {
    if (!isCountingInRef.current) {
      return;
    }
    isCountingInRef.current = false;
    setIsCountingIn(false);
    const onDownbeat = pendingDownbeatRef.current;
    pendingDownbeatRef.current = null;
    onDownbeat?.();
    if (enabledRef.current) {
      const hasChanges = (gridRef.current?.tempoMap?.segments.length ?? 1) > 1;
      if (hasChanges && SongNookMetronomeModule!.supportsTempoMap?.()) {
        // The count-in ran single-tempo; a take with programmed changes re-joins on
        // the map so the boundaries land natively from here.
        void syncClick();
      } else {
        // Let the engine roll on from the count-in's own grid; the first drift check
        // (or the next seek) trues it up against the actual player start.
        engineOwnedRef.current = true;
      }
    } else {
      void stopEngine();
    }
  });

  const playWithCountIn = useCallback(
    async (bars: number, onDownbeat: () => void): Promise<boolean> => {
      const positionMs = getPositionRef.current();
      const params = clickEngineParamsAt({
        grid: gridRef.current,
        positionMs,
        rate: rateRef.current,
      });
      if (!params || bars <= 0) {
        return false;
      }
      try {
        syncTokenRef.current += 1;
        clearTimers();
        await configureForParams(params);
        await SongNookMetronomeModule!.startCountIn(bars);
        engineOwnedRef.current = true;
        pendingDownbeatRef.current = onDownbeat;
        isCountingInRef.current = true;
        setIsCountingIn(true);
        console.log(
          `[timing] click count-in: ${bars} bar(s) at ${params.bpm}bpm before pos=${Math.round(positionMs)}ms`
        );
        return true;
      } catch (error) {
        console.warn("[timing] click count-in failed", error);
        pendingDownbeatRef.current = null;
        isCountingInRef.current = false;
        setIsCountingIn(false);
        return false;
      }
    },
    [clearTimers, configureForParams]
  );

  const cancelCountIn = useCallback(() => {
    if (!isCountingInRef.current) {
      return;
    }
    pendingDownbeatRef.current = null;
    isCountingInRef.current = false;
    setIsCountingIn(false);
    void stopEngine();
  }, [stopEngine]);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
  }, []);

  const notifySeek = useCallback(
    (targetMs: number) => {
      if (isCountingInRef.current) {
        cancelCountIn();
        return;
      }
      if (enabledRef.current && isPlayingRef.current) {
        void syncClick(targetMs);
      }
    },
    [cancelCountIn, syncClick]
  );

  const isAvailable = isPlaybackClickAvailable(grid);
  const isRateSupported = useMemo(() => {
    if (!isAvailable || !grid) return false;
    const scaled = Math.round(grid.bpm * playbackRate);
    return scaled >= MIN_METRONOME_BPM && scaled <= MAX_METRONOME_BPM;
  }, [grid, isAvailable, playbackRate]);

  return {
    isAvailable,
    isRateSupported,
    enabled,
    setEnabled,
    isCountingIn,
    playWithCountIn,
    cancelCountIn,
    notifySeek,
    supportsHaptic: nativeCuesSupported,
  };
}
