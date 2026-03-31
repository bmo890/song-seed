import { useCallback, useEffect, useMemo } from "react";
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
  const sharedCurrentTimeMs = useSharedValue(positionMs);
  const sharedDurationMs = useSharedValue(durationMs);
  const sharedIsPlaying = useSharedValue(isPlaying);
  const sharedPlaybackRate = useSharedValue(playbackRate);
  const sharedUpdateToken = useSharedValue(0);

  useEffect(() => {
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
    sharedPlaybackRate.value = playbackRate;
  }, [playbackRate, sharedPlaybackRate]);

  const setDisplayPositionMs = useCallback(
    (nextPositionMs: number) => {
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
