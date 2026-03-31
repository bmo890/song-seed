import { useCallback, useRef, useState } from "react";

type Args = {
  isPlaying: boolean;
  durationMs: number;
  pause: () => Promise<void> | void;
  play: () => Promise<void> | void;
  seekTo: (ms: number) => Promise<void>;
  settleDelayMs?: number;
  endToleranceMs?: number;
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useTransportScrubbing({
  isPlaying,
  durationMs,
  pause,
  play,
  seekTo,
  settleDelayMs = 90,
  endToleranceMs = 5,
}: Args) {
  const [isScrubbing, setIsScrubbing] = useState(false);
  const wasPlayingRef = useRef(false);
  const isPlayingRef = useRef(isPlaying);
  const durationMsRef = useRef(durationMs);
  const pauseRef = useRef(pause);
  const playRef = useRef(play);
  const seekToRef = useRef(seekTo);
  const settleDelayMsRef = useRef(settleDelayMs);
  const endToleranceMsRef = useRef(endToleranceMs);

  isPlayingRef.current = isPlaying;
  durationMsRef.current = durationMs;
  pauseRef.current = pause;
  playRef.current = play;
  seekToRef.current = seekTo;
  settleDelayMsRef.current = settleDelayMs;
  endToleranceMsRef.current = endToleranceMs;

  const beginScrub = useCallback(async () => {
    setIsScrubbing((prev) => (prev ? prev : true));
    const wasPlaying = isPlayingRef.current;
    wasPlayingRef.current = wasPlaying || wasPlayingRef.current;
    if (wasPlaying) {
      await pauseRef.current();
    }
  }, []);

  const endScrub = useCallback(async () => {
    setIsScrubbing((prev) => (prev ? false : prev));
    if (wasPlayingRef.current) {
      await playRef.current();
    }
    wasPlayingRef.current = false;
  }, []);

  const cancelScrub = useCallback(async () => {
    setIsScrubbing((prev) => (prev ? false : prev));
    if (wasPlayingRef.current) {
      await playRef.current();
    }
    wasPlayingRef.current = false;
  }, []);

  const scrubTo = useCallback(
    async (ms: number) => {
      const currentDurationMs = durationMsRef.current;
      const clampedMs = Math.max(0, Math.min(ms, currentDurationMs || ms));
      const wasPlaying = isPlayingRef.current || wasPlayingRef.current;

      setIsScrubbing((prev) => (prev ? prev : true));
      await seekToRef.current(clampedMs);
      await wait(settleDelayMsRef.current);

      const atEnd =
        currentDurationMs > 0 && clampedMs >= currentDurationMs - endToleranceMsRef.current;
      if (!wasPlaying || atEnd) {
        wasPlayingRef.current = false;
      }
    },
    []
  );

  const seekAndSettle = useCallback(
    async (ms: number) => {
      await beginScrub();
      try {
        await scrubTo(ms);
      } finally {
        await endScrub();
      }
    },
    [beginScrub, endScrub, scrubTo]
  );

  return {
    isScrubbing,
    beginScrub,
    endScrub,
    cancelScrub,
    scrubTo,
    seekAndSettle,
  };
}
