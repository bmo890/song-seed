import { useEffect, useState } from "react";

type Args = {
  durationMs: number;
  isPaused: boolean;
  isRecording: boolean;
};

export function useRecordingDisplayElapsed({
  durationMs,
  isPaused,
  isRecording,
}: Args) {
  const [displayElapsedMs, setDisplayElapsedMs] = useState(0);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    if (isRecording && !isPaused) {
      const baseElapsedMs = durationMs;
      const startedAt = Date.now();

      setDisplayElapsedMs(baseElapsedMs);
      intervalId = setInterval(() => {
        setDisplayElapsedMs(baseElapsedMs + (Date.now() - startedAt));
      }, 33);
    } else {
      setDisplayElapsedMs(durationMs);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [durationMs, isPaused, isRecording]);

  return displayElapsedMs;
}
