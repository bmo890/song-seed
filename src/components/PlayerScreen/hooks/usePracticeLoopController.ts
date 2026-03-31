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
  visibleWindowStartMs?: number;
  visibleWindowEndMs?: number;
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

function buildLoopRegionWithinVisibleWindow(
  durationMs: number,
  anchorMs = 0,
  visibleWindowStartMs = 0,
  visibleWindowEndMs = durationMs
) {
  if (durationMs <= 0) {
    return { start: 0, end: 0 };
  }

  const safeVisibleStart = Math.max(0, Math.min(visibleWindowStartMs, durationMs));
  const safeVisibleEnd = Math.max(safeVisibleStart, Math.min(visibleWindowEndMs, durationMs));
  const visibleDurationMs = safeVisibleEnd - safeVisibleStart;

  if (visibleDurationMs <= 0) {
    return buildDefaultLoopRegion(durationMs, anchorMs);
  }

  const loopSpan = Math.min(
    visibleDurationMs,
    Math.max(1000, Math.round(visibleDurationMs * 0.25))
  );
  const maxStart = Math.max(safeVisibleStart, safeVisibleEnd - loopSpan);
  const nextStart = Math.max(safeVisibleStart, Math.min(anchorMs, maxStart));

  return {
    start: Math.round(nextStart),
    end: Math.round(Math.min(safeVisibleEnd, nextStart + loopSpan)),
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
  visibleWindowStartMs,
  visibleWindowEndMs,
}: Args) {
  const [practiceLoopEnabled, setPracticeLoopEnabled] = useState(false);
  const [practiceLoopRange, setPracticeLoopRange] = useState<LoopRange>({ start: 0, end: 0 });
  const [isPinDragging, setIsPinDragging] = useState(false);

  const modeRef = useRef(mode);
  const durationMsRef = useRef(durationMs);
  const playerPositionRef = useRef(playerPosition);
  const isPlayerPlayingRef = useRef(isPlayerPlaying);
  const practiceLoopEnabledRef = useRef(practiceLoopEnabled);
  const practiceLoopRangeRef = useRef(practiceLoopRange);
  const visibleWindowStartMsRef = useRef(visibleWindowStartMs ?? 0);
  const visibleWindowEndMsRef = useRef(visibleWindowEndMs ?? durationMs);
  const loopStateRef = useRef<LoopTransportState>("idle");
  const practiceSeekInFlightRef = useRef(false);
  const queuedSeekMsRef = useRef<number | null>(null);
  const pendingUnlockTargetMsRef = useRef<number | null>(null);
  const pendingUnlockSourceMsRef = useRef<number | null>(null);
  const manualPracticeJumpRef = useRef(false);
  const lastLoopCycleAtRef = useRef(0);
  const loopSuppressedUntilRef = useRef(0);

  const hasValidPracticeLoop = practiceLoopRange.end > practiceLoopRange.start;
  const hasValidPracticeLoopRef = useRef(hasValidPracticeLoop);
  const loopLeadMs = Math.max(45, Math.round(85 * playbackRate));
  const loopUnlockToleranceMs = 60;
  const loopResumeToleranceMs = Math.max(loopUnlockToleranceMs, Math.round(140 * playbackRate));

  modeRef.current = mode;
  durationMsRef.current = durationMs;
  playerPositionRef.current = playerPosition;
  isPlayerPlayingRef.current = isPlayerPlaying;
  practiceLoopEnabledRef.current = practiceLoopEnabled;
  practiceLoopRangeRef.current = practiceLoopRange;
  visibleWindowStartMsRef.current = visibleWindowStartMs ?? 0;
  visibleWindowEndMsRef.current = visibleWindowEndMs ?? durationMs;
  hasValidPracticeLoopRef.current = hasValidPracticeLoop;

  const isWithinPracticeLoop = useCallback(
    (timeMs: number) => {
      const range = practiceLoopRangeRef.current;
      return range.end > range.start && timeMs >= range.start && timeMs < range.end;
    },
    []
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

  const suppressLoopBriefly = useCallback((durationMs = 220) => {
    loopSuppressedUntilRef.current = Date.now() + durationMs;
  }, []);

  const cancelPendingPracticeSeek = useCallback(() => {
    queuedSeekMsRef.current = null;
    pendingUnlockTargetMsRef.current = null;
    pendingUnlockSourceMsRef.current = null;
    suppressLoopBriefly();
    setLoopState("idle");
  }, [setLoopState, suppressLoopBriefly]);

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
    const unlockSourceMs = pendingUnlockSourceMsRef.current;
    if (loopStateRef.current !== "seeking_to_start" || unlockTargetMs === null) {
      return;
    }

    const range = practiceLoopRangeRef.current;
    const unlockUpperBound = Math.min(
      range.end,
      Math.max(unlockTargetMs + loopResumeToleranceMs, range.end - loopLeadMs)
    );
    const resumedInsideLoop =
      range.end > range.start &&
      playerPosition >= unlockTargetMs &&
      playerPosition <= unlockUpperBound &&
      (unlockSourceMs === null ||
        Math.abs(playerPosition - unlockSourceMs) >= Math.max(loopUnlockToleranceMs, loopLeadMs));

    if (Math.abs(playerPosition - unlockTargetMs) <= loopUnlockToleranceMs || resumedInsideLoop) {
      pendingUnlockTargetMsRef.current = null;
      pendingUnlockSourceMsRef.current = null;
      setLoopState("looping");
    }
  }, [loopLeadMs, loopResumeToleranceMs, loopUnlockToleranceMs, playerPosition, setLoopState]);

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
      pendingUnlockSourceMsRef.current = playerPositionRef.current;
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

    if (Date.now() < loopSuppressedUntilRef.current) {
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
      const currentDurationMs = durationMsRef.current;
      const currentMode = modeRef.current;
      const currentPracticeLoopEnabled = practiceLoopEnabledRef.current;
      const currentHasValidPracticeLoop = hasValidPracticeLoopRef.current;
      const currentIsPlayerPlaying = isPlayerPlayingRef.current;
      const clampedMs = Math.max(0, Math.min(targetMs, currentDurationMs || targetMs));
      const insideLoop =
        currentMode === "practice" && currentPracticeLoopEnabled && currentHasValidPracticeLoop
          ? isWithinPracticeLoop(clampedMs)
          : false;

      manualPracticeJumpRef.current = true;
      setLoopState(
        currentMode === "practice" &&
          currentPracticeLoopEnabled &&
          currentHasValidPracticeLoop &&
          currentIsPlayerPlaying &&
          insideLoop
          ? "looping"
          : "armed"
      );
      await queueSeek(clampedMs, "seeking_to_start");
    },
    [isWithinPracticeLoop, queueSeek, setLoopState]
  );

  const handlePracticeLoopToggle = useCallback(() => {
    setPracticeLoopEnabled((currentValue) => {
      const nextValue = !currentValue;
      manualPracticeJumpRef.current = false;
      setLoopState("idle");

      if (nextValue) {
        setPracticeLoopRange(
          buildLoopRegionWithinVisibleWindow(
            durationMsRef.current,
            playerPositionRef.current,
            visibleWindowStartMsRef.current,
            visibleWindowEndMsRef.current
          )
        );
        setLoopState(isPlayerPlayingRef.current ? "armed" : "idle");
      }

      return nextValue;
    });
  }, [setLoopState]);

  const resetPracticeLoopRange = useCallback(() => {
    setPracticeLoopRange(
      buildLoopRegionWithinVisibleWindow(
        durationMsRef.current,
        playerPositionRef.current,
        visibleWindowStartMsRef.current,
        visibleWindowEndMsRef.current
      )
    );
    setLoopState(isPlayerPlayingRef.current ? "armed" : "idle");
  }, [setLoopState]);

  const handleTransportToggle = useCallback(async () => {
    if (isPlayerPlayingRef.current) {
      cancelPendingPracticeSeek();
      await pausePlayer();
      return;
    }

    const currentMode = modeRef.current;
    const currentPracticeLoopEnabled = practiceLoopEnabledRef.current;
    const currentHasValidPracticeLoop = hasValidPracticeLoopRef.current;
    const currentPlayerPosition = playerPositionRef.current;
    const currentPracticeLoopRange = practiceLoopRangeRef.current;

    if (currentMode === "practice" && currentPracticeLoopEnabled && currentHasValidPracticeLoop) {
      const shouldResumeFromManualPosition = manualPracticeJumpRef.current;
      const shouldStartInsideLoop = isWithinPracticeLoop(currentPlayerPosition);

      if (
        !shouldResumeFromManualPosition &&
        Math.abs(currentPlayerPosition - currentPracticeLoopRange.start) > 20
      ) {
        await handleLoopAwareSeek(currentPracticeLoopRange.start);
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
    isWithinPracticeLoop,
    pausePlayer,
    playPlayer,
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

      if (
        practiceLoopEnabledRef.current &&
        hasValidPracticeLoopRef.current &&
        isPlayerPlayingRef.current &&
        isWithinPracticeLoop(playerPositionRef.current)
      ) {
        manualPracticeJumpRef.current = false;
        setLoopState("looping");
        return;
      }

      setLoopState("armed");
    },
    [cancelPendingPracticeSeek, isWithinPracticeLoop, setLoopState]
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
