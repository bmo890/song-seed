import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSharedValue } from "react-native-reanimated";

type Args = {
  positionMs: number;
  durationMs: number;
  isPlaying: boolean;
  playbackRate: number;
};

export function usePlayerTransportClock({
  positionMs,
  durationMs,
  isPlaying,
  playbackRate,
}: Args) {
  const nativePositionRef = useRef(positionMs);
  const playbackRateRef = useRef(playbackRate);
  const pendingDisplaySeekRef = useRef<{
    sourceMs: number;
    targetMs: number;
    until: number;
  } | null>(null);
  const sharedCurrentTimeMs = useSharedValue(positionMs);
  const sharedDurationMs = useSharedValue(durationMs);
  const sharedIsPlaying = useSharedValue(isPlaying);
  const sharedPlaybackRate = useSharedValue(playbackRate);
  const sharedUpdateToken = useSharedValue(0);

  useEffect(() => {
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
  }, [positionMs, sharedCurrentTimeMs, sharedUpdateToken]);

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
        until: Date.now() + 220,
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
