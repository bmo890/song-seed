import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type PlayerMode = "player" | "practice";
type LoopTransportState = "idle" | "armed" | "looping" | "seeking_to_start";

type LoopRange = {
  start: number;
  end: number;
};

type QueueSeekOptions = {
  trackUnlock?: boolean;
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
  /**
   * Freshest known position (ms), read at call time — the transport position
   * channel, which publishes ~20×/second without a render. `playerPosition` reaches
   * this hook through a throttled commit and can be most of a second stale, which is
   * far too coarse to time a loop wrap against. Null when no fast feed is driving.
   */
  getFreshPositionMs?: () => number | null;
  /** Fires once per completed pass, at the wrap seek back to loop start. */
  onLoopCycle?: () => void;
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

function buildLoopRegionPreservingSpan(durationMs: number, anchorMs = 0, spanMs = 0) {
  if (durationMs <= 0) {
    return { start: 0, end: 0 };
  }

  const safeSpanMs = Math.max(
    Math.min(durationMs, spanMs || BASE_DEFAULT_LOOP_SPAN_MS_FALLBACK(durationMs)),
    1
  );
  const safeAnchorMs = Math.max(0, Math.min(anchorMs, durationMs));
  const maxStartMs = Math.max(0, durationMs - safeSpanMs);
  const startMs = Math.max(0, Math.min(safeAnchorMs, maxStartMs));

  return {
    start: Math.round(startMs),
    end: Math.round(startMs + safeSpanMs),
  };
}

function BASE_DEFAULT_LOOP_SPAN_MS_FALLBACK(durationMs: number) {
  return Math.max(1000, Math.round(durationMs * 0.25));
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
  getFreshPositionMs,
  onLoopCycle,
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
  const onLoopCycleRef = useRef(onLoopCycle);
  const lastLoopCycleAtRef = useRef(0);
  const getFreshPositionMsRef = useRef(getFreshPositionMs);
  const wrapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  onLoopCycleRef.current = onLoopCycle;
  getFreshPositionMsRef.current = getFreshPositionMs;

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

  const clearWrapTimer = useCallback(() => {
    if (wrapTimerRef.current === null) return;
    clearTimeout(wrapTimerRef.current);
    wrapTimerRef.current = null;
  }, []);

  const suppressLoopBriefly = useCallback((durationMs = 220) => {
    loopSuppressedUntilRef.current = Date.now() + durationMs;
  }, []);

  const cancelPendingPracticeSeek = useCallback(() => {
    clearWrapTimer();
    queuedSeekMsRef.current = null;
    pendingUnlockTargetMsRef.current = null;
    pendingUnlockSourceMsRef.current = null;
    suppressLoopBriefly();
    setLoopState("idle");
  }, [clearWrapTimer, setLoopState, suppressLoopBriefly]);

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
    async (
      targetMs: number,
      nextState: LoopTransportState,
      { trackUnlock = true }: QueueSeekOptions = {}
    ) => {
      queuedSeekMsRef.current = targetMs;
      if (trackUnlock) {
        pendingUnlockTargetMsRef.current = targetMs;
        pendingUnlockSourceMsRef.current = playerPositionRef.current;
      } else {
        pendingUnlockTargetMsRef.current = null;
        pendingUnlockSourceMsRef.current = null;
      }
      onDisplaySeek?.(targetMs);
      setLoopState(nextState);
      await flushQueuedSeek();
    },
    [flushQueuedSeek, onDisplaySeek, setLoopState]
  );

  /** Wrap the loop now: count the pass and seek back to the start. */
  const performWrap = useCallback(() => {
    clearWrapTimer();
    // A scheduled wrap can land after the transport moved on (paused, scrubbed, the
    // region edited), so the conditions are re-checked at firing time, not trusted
    // from when it was booked.
    if (
      modeRef.current !== "practice" ||
      !practiceLoopEnabledRef.current ||
      !isPlayerPlayingRef.current ||
      !hasValidPracticeLoopRef.current ||
      loopStateRef.current === "seeking_to_start"
    ) {
      return;
    }

    const now = Date.now();
    if (now - lastLoopCycleAtRef.current < 70) {
      return;
    }
    lastLoopCycleAtRef.current = now;
    onLoopCycleRef.current?.();

    const range = practiceLoopRangeRef.current;
    void queueSeek(range.start, "seeking_to_start").catch((error) => {
      pendingUnlockTargetMsRef.current = null;
      setLoopState("looping");
      console.warn("Practice loop seek failed", error);
    });
  }, [clearWrapTimer, queueSeek, setLoopState]);

  const scheduleWrap = useCallback(
    (wallMsFromNow: number) => {
      clearWrapTimer();
      wrapTimerRef.current = setTimeout(performWrap, Math.max(0, wallMsFromNow));
    },
    [clearWrapTimer, performWrap]
  );

  useEffect(() => clearWrapTimer, [clearWrapTimer]);

  useEffect(() => {
    if (
      mode !== "practice" ||
      !practiceLoopEnabled ||
      !isPlayerPlaying ||
      isScrubbing ||
      isPinDragging
    ) {
      clearWrapTimer();
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

    if (manualPracticeJumpRef.current) {
      if (isWithinPracticeLoop(playerPosition)) {
        manualPracticeJumpRef.current = false;
        setLoopState("looping");
        return;
      }

      if (playerPosition >= practiceLoopRange.end) {
        setLoopState("idle");
        return;
      }
    }

    if (loopStateRef.current === "seeking_to_start") {
      return;
    }

    // The wrap is SCHEDULED, not watched for. Position reaches this hook through a
    // deliberately throttled status commit (useFullPlayer keeps the React tree at
    // ~5Hz), so by the time a sample says "past the end" the take has already run
    // most of a second beyond it — measured at ~700ms. Extrapolating from the last
    // sample instead makes the feed's cadence irrelevant: the error collapses to how
    // stale that one sample is, not how far apart samples are.
    const wrapAtContentMs = practiceLoopRange.end - loopLeadMs;
    // Anchor on the freshest position available, not the throttled prop: a stale
    // anchor shifts the whole schedule late by exactly its staleness.
    const anchorMs = getFreshPositionMs?.() ?? playerPosition;
    if (anchorMs < wrapAtContentMs) {
      const safeRate = Math.max(0.05, playbackRate);
      scheduleWrap((wrapAtContentMs - anchorMs) / safeRate);
      return;
    }

    performWrap();
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
      await queueSeek(
        clampedMs,
        currentMode === "practice" &&
          currentPracticeLoopEnabled &&
          currentHasValidPracticeLoop &&
          currentIsPlayerPlaying &&
          insideLoop
          ? "looping"
          : "armed",
        { trackUnlock: false }
      );
    },
    [isWithinPracticeLoop, queueSeek, setLoopState]
  );

  const handlePracticeLoopToggle = useCallback(() => {
    setPracticeLoopEnabled((currentValue) => {
      const nextValue = !currentValue;
      manualPracticeJumpRef.current = false;
      setLoopState("idle");

      if (nextValue) {
        setPracticeLoopRange((currentRange) =>
          currentRange.end > currentRange.start
            ? currentRange
            : buildLoopRegionWithinVisibleWindow(
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

  const movePracticeLoopToPlayhead = useCallback(() => {
    setPracticeLoopRange((currentRange) => {
      const currentSpanMs =
        currentRange.end > currentRange.start
          ? currentRange.end - currentRange.start
          : buildLoopRegionWithinVisibleWindow(
              durationMsRef.current,
              playerPositionRef.current,
              visibleWindowStartMsRef.current,
              visibleWindowEndMsRef.current
            ).end -
            buildLoopRegionWithinVisibleWindow(
              durationMsRef.current,
              playerPositionRef.current,
              visibleWindowStartMsRef.current,
              visibleWindowEndMsRef.current
            ).start;

      return buildLoopRegionPreservingSpan(
        durationMsRef.current,
        playerPositionRef.current,
        currentSpanMs
      );
    });
    manualPracticeJumpRef.current = false;
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
        setLoopState(
          shouldStartInsideLoop
            ? "looping"
            : currentPlayerPosition >= currentPracticeLoopRange.end
              ? "idle"
              : "armed"
        );
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
    movePracticeLoopToPlayhead,
  };
}
