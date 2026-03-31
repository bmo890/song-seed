import { useEffect, useRef, useState } from "react";

type Args = {
  positionMs: number;
  durationMs: number;
  isPlaying: boolean;
  playbackRate?: number;
  isScrubbing?: boolean;
};

const REANCHOR_THRESHOLD_MS = 36;

export function useSmoothedPlaybackPosition({
  positionMs,
  durationMs,
  isPlaying,
  playbackRate = 1,
  isScrubbing = false,
}: Args) {
  const [displayPositionMs, setDisplayPositionMs] = useState(positionMs);
  const frameRef = useRef<number | null>(null);
  const lastDisplayRef = useRef(positionMs);
  const anchorPositionRef = useRef(positionMs);
  const anchorStartedAtRef = useRef<number | null>(null);

  const setDisplayPosition = (nextMs: number) => {
    const clamped = Math.max(0, Math.min(durationMs || nextMs, nextMs));
    lastDisplayRef.current = clamped;
    setDisplayPositionMs((prev) => (Math.abs(prev - clamped) < 2 ? prev : clamped));
  };

  useEffect(() => {
    const shouldTick = isPlaying && !isScrubbing;

    if (!shouldTick) {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      anchorPositionRef.current = positionMs;
      anchorStartedAtRef.current = null;
      setDisplayPosition(positionMs);
      return;
    }

    anchorPositionRef.current = Math.max(lastDisplayRef.current, positionMs);
    anchorStartedAtRef.current = Date.now();

    const tick = () => {
      const anchorStartedAt = anchorStartedAtRef.current ?? Date.now();
      const elapsedSinceAnchor = Date.now() - anchorStartedAt;
      const nextPositionMs = anchorPositionRef.current + elapsedSinceAnchor * playbackRate;
      setDisplayPosition(nextPositionMs);
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [isPlaying, isScrubbing, playbackRate, positionMs, durationMs]);

  useEffect(() => {
    if (!isPlaying || isScrubbing) {
      anchorPositionRef.current = positionMs;
      anchorStartedAtRef.current = null;
      setDisplayPosition(positionMs);
      return;
    }

    if (positionMs < lastDisplayRef.current - REANCHOR_THRESHOLD_MS) {
      anchorPositionRef.current = positionMs;
      anchorStartedAtRef.current = Date.now();
      setDisplayPosition(positionMs);
      return;
    }

    if (positionMs > lastDisplayRef.current + REANCHOR_THRESHOLD_MS) {
      anchorPositionRef.current = positionMs;
      anchorStartedAtRef.current = Date.now();
      setDisplayPosition(positionMs);
    }
  }, [isPlaying, isScrubbing, positionMs]);

  return displayPositionMs;
}
