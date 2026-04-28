import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSharedValue } from "react-native-reanimated";

type Args = {
  positionMs: number;
  durationMs: number;
  isPlaying: boolean;
  playbackRate: number;
  resetKey?: string | number | null;
  resetPositionMs?: number;
};

const SOURCE_RESET_HOLD_MS = 700;
const SOURCE_RESET_POSITION_TOLERANCE_MS = 90;

export function useTransportClock({
  positionMs,
  durationMs,
  isPlaying,
  playbackRate,
  resetKey,
  resetPositionMs = 0,
}: Args) {
  const initialPositionMs = resetKey == null ? positionMs : resetPositionMs;
  const nativePositionRef = useRef(initialPositionMs);
  const playbackRateRef = useRef(playbackRate);
  const resetKeyRef = useRef(resetKey);
  const resetHoldUntilRef = useRef(resetKey == null ? 0 : Date.now() + SOURCE_RESET_HOLD_MS);
  const pendingDisplaySeekRef = useRef<{
    sourceMs: number;
    targetMs: number;
    until: number;
  } | null>(null);
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

  useEffect(() => {
    const resetHoldActive = Date.now() < resetHoldUntilRef.current;
    const isWithinResetTolerance =
      Math.abs(positionMs - resetPositionMs) <= SOURCE_RESET_POSITION_TOLERANCE_MS;
    const isStaleSourcePosition =
      resetHoldActive &&
      !isPlaying &&
      !isWithinResetTolerance;

    if (isStaleSourcePosition) {
      return;
    }

    if (resetHoldActive && !isPlaying && isWithinResetTolerance) {
      resetHoldUntilRef.current = 0;
    }

    nativePositionRef.current = positionMs;
    const pendingDisplaySeek = pendingDisplaySeekRef.current;
    if (pendingDisplaySeek) {
      const toleranceMs = Math.max(60, Math.round(140 * playbackRateRef.current));
      const hasReachedTarget = Math.abs(positionMs - pendingDisplaySeek.targetMs) <= toleranceMs;
      const stillLooksLikeSource = Math.abs(positionMs - pendingDisplaySeek.sourceMs) <= toleranceMs;
      const hasTimedOut = Date.now() >= pendingDisplaySeek.until;

      if (!hasReachedTarget && stillLooksLikeSource && !hasTimedOut) {
        return;
      }

      pendingDisplaySeekRef.current = null;
    }

    sharedCurrentTimeMs.value = positionMs;
    sharedUpdateToken.value += 1;
  }, [isPlaying, positionMs, resetPositionMs, sharedCurrentTimeMs, sharedUpdateToken]);

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
