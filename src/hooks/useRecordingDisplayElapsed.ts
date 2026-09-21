import { useEffect, useRef, useState } from "react";

type Args = {
  durationMs: number;
  isPaused: boolean;
  isRecording: boolean;
};

const REANCHOR_THRESHOLD_MS = 48;
// The readout shows whole seconds and the lyric follow needs ~tenths. Committing React
// state every animation frame re-rendered the entire recorder (and the dock) 60 times a
// second for the length of a take, so taps waited behind renders (2026-09-21). The
// clock still reads the wall time every frame; it only RE-RENDERS when the tenth changes.
const COMMIT_STEP_MS = 100;

export function useRecordingDisplayElapsed({
  durationMs,
  isPaused,
  isRecording,
}: Args) {
  const normalizedDurationMs = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
  const [displayElapsedMs, setDisplayElapsedMs] = useState(normalizedDurationMs);
  const frameRef = useRef<number | null>(null);
  const lastDisplayRef = useRef(normalizedDurationMs);
  const anchorDurationRef = useRef(normalizedDurationMs);
  const anchorStartedAtRef = useRef<number | null>(null);

  const setDisplayElapsed = (nextMs: number, ticking = false) => {
    lastDisplayRef.current = nextMs;
    setDisplayElapsedMs((prev) => {
      if (ticking) {
        return Math.floor(prev / COMMIT_STEP_MS) === Math.floor(nextMs / COMMIT_STEP_MS) ? prev : nextMs;
      }
      // Settled values (pause, stop, re-anchor) land exactly.
      return Math.abs(prev - nextMs) < 4 ? prev : nextMs;
    });
  };

  useEffect(() => {
    const isActive = isRecording && !isPaused;

    if (!isActive) {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      if (!isRecording && !isPaused && normalizedDurationMs === 0) {
        anchorDurationRef.current = 0;
        anchorStartedAtRef.current = null;
        setDisplayElapsed(0);
        return;
      }

      const settledElapsedMs = Math.max(lastDisplayRef.current, normalizedDurationMs);
      anchorDurationRef.current = settledElapsedMs;
      anchorStartedAtRef.current = null;
      setDisplayElapsed(settledElapsedMs);
      return;
    }

    const startTicking = () => {
      const tick = () => {
        const anchorStartedAt = anchorStartedAtRef.current ?? Date.now();
        const elapsedSinceAnchor = Date.now() - anchorStartedAt;
        const nextElapsedMs = Math.max(
          lastDisplayRef.current,
          normalizedDurationMs,
          anchorDurationRef.current + elapsedSinceAnchor
        );
        setDisplayElapsed(nextElapsedMs, true);
        frameRef.current = requestAnimationFrame(tick);
      };

      frameRef.current = requestAnimationFrame(tick);
    };

    anchorDurationRef.current = Math.max(lastDisplayRef.current, normalizedDurationMs);
    anchorStartedAtRef.current = Date.now();
    startTicking();

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [isPaused, isRecording]);

  useEffect(() => {
    const isActive = isRecording && !isPaused;

    if (!isActive) {
      if (!isRecording && !isPaused && normalizedDurationMs === 0) {
        anchorDurationRef.current = 0;
        anchorStartedAtRef.current = null;
        setDisplayElapsed(0);
        return;
      }

      if (normalizedDurationMs > lastDisplayRef.current) {
        anchorDurationRef.current = normalizedDurationMs;
        setDisplayElapsed(normalizedDurationMs);
      }
      return;
    }

    if (normalizedDurationMs > lastDisplayRef.current + REANCHOR_THRESHOLD_MS) {
      anchorDurationRef.current = normalizedDurationMs;
      anchorStartedAtRef.current = Date.now();
      setDisplayElapsed(normalizedDurationMs);
    }
  }, [isPaused, isRecording, normalizedDurationMs]);

  return displayElapsedMs;
}
