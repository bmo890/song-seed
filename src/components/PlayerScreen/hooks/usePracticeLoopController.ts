import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type PlayerMode = "player" | "practice";
type LoopTransportState = "idle" | "armed" | "looping" | "seeking_to_start";

type LoopRange = {
  start: number;
  end: number;
};

type Args = {
  clipId?: string | null;
  mode: PlayerMode;
  durationMs: number;
  playerPosition: number;
  isPlayerPlaying: boolean;
  playbackRate: number;
  isScrubbing: boolean;
  seekTo: (ms: number) => Promise<void>;
  playPlayer: () => Promise<void>;
  pausePlayer: () => Promise<void>;
  onDisplaySeek?: (ms: number) => void;
};

function buildDefaultLoopRegion(durationMs: number, anchorMs = 0) {
  if (durationMs <= 0) {
    return { start: 0, end: 0 };
  }

  const loopSpan = Math.max(1000, Math.round(durationMs * 0.25));
  const safeStart = Math.max(0, Math.min(anchorMs, durationMs));
  const nextEnd = Math.min(durationMs, safeStart + loopSpan);

  return {
    start: safeStart,
    end: nextEnd,
  };
}

export function usePracticeLoopController({
  clipId,
  mode,
  durationMs,
  playerPosition,
  isPlayerPlaying,
  playbackRate,
  isScrubbing,
  seekTo,
  playPlayer,
  pausePlayer,
  onDisplaySeek,
}: Args) {
  const [practiceLoopEnabled, setPracticeLoopEnabled] = useState(false);
  const [practiceLoopRange, setPracticeLoopRange] = useState<LoopRange>({ start: 0, end: 0 });
  const [isPinDragging, setIsPinDragging] = useState(false);

  const loopStateRef = useRef<LoopTransportState>("idle");
  const practiceSeekInFlightRef = useRef(false);
  const queuedSeekMsRef = useRef<number | null>(null);
  const pendingUnlockTargetMsRef = useRef<number | null>(null);
  const manualPracticeJumpRef = useRef(false);
  const lastLoopCycleAtRef = useRef(0);

  const hasValidPracticeLoop = practiceLoopRange.end > practiceLoopRange.start;
  const loopLeadMs = Math.max(45, Math.round(85 * playbackRate));
  const loopUnlockToleranceMs = 60;

  const isWithinPracticeLoop = useCallback(
    (timeMs: number) =>
      hasValidPracticeLoop && timeMs >= practiceLoopRange.start && timeMs < practiceLoopRange.end,
    [hasValidPracticeLoop, practiceLoopRange.end, practiceLoopRange.start]
  );

  const practiceLoopSelection = useMemo(
    () => [
      {
        id: "practice-loop",
        start: practiceLoopRange.start,
        end: practiceLoopRange.end,
        type: "keep" as const,
      },
    ],
    [practiceLoopRange.end, practiceLoopRange.start]
  );

  const setLoopState = useCallback((nextState: LoopTransportState) => {
    loopStateRef.current = nextState;
  }, []);

  const cancelPendingPracticeSeek = useCallback(() => {
    queuedSeekMsRef.current = null;
    pendingUnlockTargetMsRef.current = null;
    setLoopState("idle");
  }, []);

  useEffect(() => {
    setPracticeLoopRange(buildDefaultLoopRegion(durationMs));
  }, [clipId, durationMs]);

  useEffect(() => {
    manualPracticeJumpRef.current = false;
    setLoopState("idle");
    queuedSeekMsRef.current = null;
    pendingUnlockTargetMsRef.current = null;
  }, [clipId, mode, practiceLoopEnabled, practiceLoopRange.end, practiceLoopRange.start, setLoopState]);

  useEffect(() => {
    const unlockTargetMs = pendingUnlockTargetMsRef.current;
    if (loopStateRef.current !== "seeking_to_start" || unlockTargetMs === null) {
      return;
    }

    if (Math.abs(playerPosition - unlockTargetMs) <= loopUnlockToleranceMs) {
      pendingUnlockTargetMsRef.current = null;
      setLoopState("looping");
    }
  }, [loopUnlockToleranceMs, playerPosition, setLoopState]);

  const flushQueuedSeek = useCallback(async () => {
    if (practiceSeekInFlightRef.current) {
      return;
    }

    practiceSeekInFlightRef.current = true;
    try {
      while (queuedSeekMsRef.current !== null) {
        const nextTargetMs = queuedSeekMsRef.current;
        queuedSeekMsRef.current = null;
        await seekTo(nextTargetMs);
      }
    } finally {
      practiceSeekInFlightRef.current = false;
    }
  }, [seekTo]);

  const queueSeek = useCallback(
    async (targetMs: number, nextState: LoopTransportState) => {
      queuedSeekMsRef.current = targetMs;
      pendingUnlockTargetMsRef.current = targetMs;
      onDisplaySeek?.(targetMs);
      setLoopState(nextState);
      await flushQueuedSeek();
    },
    [flushQueuedSeek, onDisplaySeek, setLoopState]
  );

  useEffect(() => {
    if (
      mode !== "practice" ||
      !practiceLoopEnabled ||
      !isPlayerPlaying ||
      isScrubbing ||
      isPinDragging
    ) {
      return;
    }

    if (!hasValidPracticeLoop) {
      return;
    }

    if (loopStateRef.current === "idle") {
      if (isWithinPracticeLoop(playerPosition)) {
        manualPracticeJumpRef.current = false;
        setLoopState("looping");
      } else {
        setLoopState("armed");
      }
      return;
    }

    if (playerPosition < practiceLoopRange.start) {
      setLoopState("armed");
      return;
    }

    if (loopStateRef.current === "seeking_to_start") {
      return;
    }

    if (playerPosition < practiceLoopRange.end - loopLeadMs) {
      return;
    }

    const now = Date.now();
    if (now - lastLoopCycleAtRef.current < 70) {
      return;
    }
    lastLoopCycleAtRef.current = now;

    void queueSeek(practiceLoopRange.start, "seeking_to_start").catch((error) => {
      pendingUnlockTargetMsRef.current = null;
      setLoopState("looping");
      console.warn("Practice loop seek failed", error);
    });
  }, [
    hasValidPracticeLoop,
    isPinDragging,
    isPlayerPlaying,
    isScrubbing,
    isWithinPracticeLoop,
    loopLeadMs,
    mode,
    playerPosition,
    practiceLoopEnabled,
    practiceLoopRange.end,
    practiceLoopRange.start,
    queueSeek,
    setLoopState,
  ]);

  const handleLoopAwareSeek = useCallback(
    async (targetMs: number) => {
      const clampedMs = Math.max(0, Math.min(targetMs, durationMs || targetMs));
      const insideLoop =
        mode === "practice" && practiceLoopEnabled && hasValidPracticeLoop
          ? isWithinPracticeLoop(clampedMs)
          : false;

      manualPracticeJumpRef.current = true;
      setLoopState(
        mode === "practice" && practiceLoopEnabled && hasValidPracticeLoop && isPlayerPlaying && insideLoop
          ? "looping"
          : "armed"
      );
      await queueSeek(clampedMs, "seeking_to_start");
    },
    [durationMs, hasValidPracticeLoop, isPlayerPlaying, isWithinPracticeLoop, mode, practiceLoopEnabled, queueSeek, setLoopState]
  );

  const handlePracticeLoopToggle = useCallback(() => {
    setPracticeLoopEnabled((currentValue) => {
      const nextValue = !currentValue;
      manualPracticeJumpRef.current = false;
      setLoopState("idle");

      if (nextValue) {
        setPracticeLoopRange(buildDefaultLoopRegion(durationMs, playerPosition));
        setLoopState(isPlayerPlaying ? "armed" : "idle");
      }

      return nextValue;
    });
  }, [durationMs, isPlayerPlaying, playerPosition, setLoopState]);

  const resetPracticeLoopRange = useCallback(() => {
    setPracticeLoopRange(buildDefaultLoopRegion(durationMs, playerPosition));
    setLoopState(isPlayerPlaying ? "armed" : "idle");
  }, [durationMs, isPlayerPlaying, playerPosition, setLoopState]);

  const handleTransportToggle = useCallback(async () => {
    if (isPlayerPlaying) {
      cancelPendingPracticeSeek();
      await pausePlayer();
      return;
    }

    if (mode === "practice" && practiceLoopEnabled && hasValidPracticeLoop) {
      const shouldResumeFromManualPosition = manualPracticeJumpRef.current;
      const shouldStartInsideLoop = isWithinPracticeLoop(playerPosition);

      if (!shouldResumeFromManualPosition && Math.abs(playerPosition - practiceLoopRange.start) > 20) {
        await handleLoopAwareSeek(practiceLoopRange.start);
        setLoopState("looping");
      } else {
        setLoopState(shouldStartInsideLoop ? "looping" : "armed");
      }

      await playPlayer();
      return;
    }

    setLoopState("idle");
    await playPlayer();
  }, [
    cancelPendingPracticeSeek,
    handleLoopAwareSeek,
    hasValidPracticeLoop,
    isPlayerPlaying,
    isWithinPracticeLoop,
    mode,
    pausePlayer,
    playPlayer,
    playerPosition,
    practiceLoopEnabled,
    practiceLoopRange.start,
    setLoopState,
  ]);

  const handlePinDragStateChange = useCallback(
    (dragging: boolean) => {
      setIsPinDragging(dragging);

      if (dragging) {
        cancelPendingPracticeSeek();
        setLoopState("idle");
        return;
      }

      if (practiceLoopEnabled && hasValidPracticeLoop && isPlayerPlaying && isWithinPracticeLoop(playerPosition)) {
        manualPracticeJumpRef.current = false;
        setLoopState("looping");
        return;
      }

      setLoopState("armed");
    },
    [
      cancelPendingPracticeSeek,
      hasValidPracticeLoop,
      isPlayerPlaying,
      isWithinPracticeLoop,
      playerPosition,
      practiceLoopEnabled,
      setLoopState,
    ]
  );

  return {
    practiceLoopEnabled,
    practiceLoopRange,
    practiceLoopSelection,
    hasValidPracticeLoop,
    isPinDragging,
    setPracticeLoopRange,
    cancelPendingPracticeSeek,
    handleLoopAwareSeek,
    handlePracticeLoopToggle,
    handleTransportToggle,
    handlePinDragStateChange,
    resetPracticeLoopRange,
  };
}
