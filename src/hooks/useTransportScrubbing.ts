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

  const beginScrub = useCallback(async () => {
    setIsScrubbing((prev) => (prev ? prev : true));
    wasPlayingRef.current = isPlaying || wasPlayingRef.current;
    if (isPlaying) {
      await pause();
    }
  }, [isPlaying, pause]);

  const endScrub = useCallback(async () => {
    setIsScrubbing((prev) => (prev ? false : prev));
    if (wasPlayingRef.current) {
      await play();
    }
    wasPlayingRef.current = false;
  }, [play]);

  const cancelScrub = useCallback(async () => {
    setIsScrubbing((prev) => (prev ? false : prev));
    if (wasPlayingRef.current) {
      await play();
    }
    wasPlayingRef.current = false;
  }, [play]);

  const scrubTo = useCallback(
    async (ms: number) => {
      const clampedMs = Math.max(0, Math.min(ms, durationMs || ms));
      const wasPlaying = isPlaying || wasPlayingRef.current;

      setIsScrubbing((prev) => (prev ? prev : true));
      await seekTo(clampedMs);
      await wait(settleDelayMs);

      const atEnd = durationMs > 0 && clampedMs >= durationMs - endToleranceMs;
      if (!wasPlaying || atEnd) {
        wasPlayingRef.current = false;
      }
    },
    [durationMs, endToleranceMs, isPlaying, seekTo, settleDelayMs]
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
