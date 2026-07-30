import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSharedValue } from "react-native-reanimated";
import {
  resolveClockPosition,
  type PendingDisplaySeek,
  type TransportPositionChannel,
} from "../domain/transportPosition";

type Args = {
  positionMs: number;
  durationMs: number;
  isPlaying: boolean;
  playbackRate: number;
  resetKey?: string | number | null;
  resetPositionMs?: number;
  /**
   * Position straight from the audio engine, bypassing React. When supplied AND
   * `channelDriven` is true, the visual clock follows this instead of the `positionMs`
   * prop, so playback no longer needs a render per report — which is what kept the reel's
   * overlays glued to its canvas (docs/product-plan/reel-smoothness-findings.md).
   */
  positionChannel?: TransportPositionChannel;
  /**
   * False when something other than the full player owns the transport (practice mode's
   * native pitch engine), in which case position still arrives as a prop.
   */
  channelDriven?: boolean;
};

const SOURCE_RESET_HOLD_MS = 700;

export function useTransportClock({
  positionMs,
  durationMs,
  isPlaying,
  playbackRate,
  resetKey,
  resetPositionMs = 0,
  positionChannel,
  channelDriven = false,
}: Args) {
  // Seed the visual playhead from the live position, not resetPositionMs. On a
  // fresh mount the source may already be loaded mid-track (e.g. returning to the
  // full player from the minimized dock while paused) — we want to show that
  // position immediately, not snap to 0. The reset hold only applies when the
  // source actually CHANGES after mount (handled by the resetKey effect below),
  // so we start with no hold here.
  const initialPositionMs = positionMs;
  const nativePositionRef = useRef(initialPositionMs);
  const playbackRateRef = useRef(playbackRate);
  const resetKeyRef = useRef(resetKey);
  const resetHoldUntilRef = useRef(0);
  const pendingDisplaySeekRef = useRef<PendingDisplaySeek | null>(null);
  const sharedCurrentTimeMs = useSharedValue(initialPositionMs);
  const sharedDurationMs = useSharedValue(durationMs);
  const sharedIsPlaying = useSharedValue(isPlaying);
  const sharedPlaybackRate = useSharedValue(playbackRate);
  const sharedUpdateToken = useSharedValue(0);

  useEffect(() => {
    if (resetKeyRef.current === resetKey) {
      return;
    }

    resetKeyRef.current = resetKey;
    if (resetKey == null) {
      return;
    }

    nativePositionRef.current = resetPositionMs;
    pendingDisplaySeekRef.current = null;
    resetHoldUntilRef.current = Date.now() + SOURCE_RESET_HOLD_MS;
    sharedCurrentTimeMs.value = resetPositionMs;
    sharedUpdateToken.value += 1;
  }, [resetKey, resetPositionMs, sharedCurrentTimeMs, sharedUpdateToken]);

  /**
   * Apply one position report to the visual clock. Called from the channel subscription
   * (~20×/second, no render involved) or, when something else owns the transport, from the
   * prop effect. The rules it runs are the same either way — see `resolveClockPosition`.
   */
  const applyReport = useCallback(
    (reportedMs: number, reportIsPlaying: boolean, reportPlaybackRate: number) => {
      const resolution = resolveClockPosition({
        positionMs: reportedMs,
        isPlaying: reportIsPlaying,
        resetPositionMs,
        resetHoldUntil: resetHoldUntilRef.current,
        pendingSeek: pendingDisplaySeekRef.current,
        playbackRate: reportPlaybackRate,
        nowMs: Date.now(),
      });

      if (resolution.clearResetHold) {
        resetHoldUntilRef.current = 0;
      }
      if (resolution.recordAsNativePosition) {
        nativePositionRef.current = resolution.positionMs;
      }
      if (resolution.clearPendingSeek) {
        pendingDisplaySeekRef.current = null;
      }
      if (!resolution.shouldWrite) {
        return;
      }

      sharedCurrentTimeMs.value = resolution.positionMs;
      sharedUpdateToken.value += 1;
    },
    [resetPositionMs, sharedCurrentTimeMs, sharedUpdateToken]
  );

  useEffect(() => {
    // The channel is the authority when it is driving; taking the prop as well would
    // re-apply a stale render-time position over a fresher one.
    if (channelDriven) {
      return;
    }
    applyReport(positionMs, isPlaying, playbackRateRef.current);
  }, [applyReport, channelDriven, isPlaying, positionMs]);

  useEffect(() => {
    if (!channelDriven || !positionChannel) {
      return;
    }
    return positionChannel.subscribe((report) => {
      applyReport(report.positionMs, report.isPlaying, report.playbackRate);
    });
  }, [applyReport, channelDriven, positionChannel]);

  useEffect(() => {
    sharedDurationMs.value = durationMs;
  }, [durationMs, sharedDurationMs]);

  useEffect(() => {
    sharedIsPlaying.value = isPlaying;
  }, [isPlaying, sharedIsPlaying]);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
    sharedPlaybackRate.value = playbackRate;
  }, [playbackRate, sharedPlaybackRate]);

  const setDisplayPositionMs = useCallback(
    (nextPositionMs: number) => {
      pendingDisplaySeekRef.current = {
        sourceMs: nativePositionRef.current,
        targetMs: nextPositionMs,
        until: Date.now() + 420,
      };
      sharedCurrentTimeMs.value = nextPositionMs;
      sharedUpdateToken.value += 1;
    },
    [sharedCurrentTimeMs, sharedUpdateToken]
  );

  return useMemo(
    () => ({
      sharedCurrentTimeMs,
      sharedDurationMs,
      sharedIsPlaying,
      sharedPlaybackRate,
      sharedUpdateToken,
      setDisplayPositionMs,
    }),
    [sharedCurrentTimeMs, sharedDurationMs, sharedIsPlaying, sharedPlaybackRate, sharedUpdateToken, setDisplayPositionMs]
  );
}
