import { useCallback, useEffect, useRef, useState } from "react";
import { haptic } from "../../../design/haptics";
import {
  STEP_UP_DEFAULT_SEQUENCE,
  intersectRateBounds,
  normalizeStepUpSequence,
  stepUpSequenceProgressAtLoop,
  type RateBounds,
  type StepUpSequenceProgress,
  type StepUpStage,
} from "../../../domain/stepUpLoop";

/**
 * Step up — the session around the pure sequence (src/domain/stepUpLoop.ts).
 *
 * The hook owns the editable sequence (the customizer sheet writes it) and, while a
 * session runs, only a pass counter; the rate and progress are derived every render,
 * never assigned from an effect. The practice loop controller reports each wrap via
 * `handleLoopCycle`, which advances the counter and — when the stage changes rate —
 * pushes the new rate into the pitch-preserving transport.
 *
 * A sequence needs no grid and no metronome: rates scale the track itself. The
 * playback click's supported range constrains the session only while the click is
 * actually sounding (the climb must not carry the click into silence); with no click,
 * only the practice-speed range applies. If those ranges ever fail to overlap, the
 * click constraint yields — the click falls silent and the drill goes on.
 *
 * Editing the sequence mid-session restarts the drill from its first stage:
 * predictable beats clever when a musician is mid-pass.
 */

type Args = {
  clipId: string | null | undefined;
  /** practice mode with the loop switched on — the only place a session can live. */
  isPracticeLoopActive: boolean;
  speedBounds: RateBounds;
  /** Click engine's supported range, null when the click is off or unavailable. */
  clickBounds: RateBounds | null;
  setPlaybackRate: (rate: number) => void;
  /**
   * The plan's last pass has played. A drill is a finite thing — it stops here
   * rather than looping on at the final speed, which reads as the tool forgetting
   * it was ever counting.
   */
  onDrillComplete: () => void;
};

type StepUpSession = {
  stages: StepUpStage[];
  completedLoops: number;
};

export function useStepUpLoop({
  clipId,
  isPracticeLoopActive,
  speedBounds,
  clickBounds,
  setPlaybackRate,
  onDrillComplete,
}: Args) {
  const [sequence, setSequenceState] = useState<StepUpStage[]>(STEP_UP_DEFAULT_SEQUENCE);
  const [session, setSession] = useState<StepUpSession | null>(null);

  const onDrillCompleteRef = useRef(onDrillComplete);
  onDrillCompleteRef.current = onDrillComplete;

  const sessionRef = useRef(session);
  const speedBoundsRef = useRef(speedBounds);
  const clickBoundsRef = useRef(clickBounds);
  sessionRef.current = session;
  speedBoundsRef.current = speedBounds;
  clickBoundsRef.current = clickBounds;

  // Losing the room ends the session: clip change, mode change, loop switched off.
  useEffect(() => {
    if (!isPracticeLoopActive) {
      setSession(null);
    }
  }, [clipId, isPracticeLoopActive]);

  const sessionBounds = useCallback(
    () =>
      intersectRateBounds(speedBoundsRef.current, clickBoundsRef.current) ??
      speedBoundsRef.current,
    []
  );

  const cancelStepUp = useCallback(() => {
    setSession(null);
  }, []);

  /** The customizer writes here; a running session restarts on the new sequence. */
  const setSequence = useCallback(
    (stages: StepUpStage[]) => {
      const normalized = normalizeStepUpSequence(stages, speedBoundsRef.current);
      setSequenceState(normalized);
      if (sessionRef.current) {
        const sessionStages = normalizeStepUpSequence(normalized, sessionBounds());
        setSession({ stages: sessionStages, completedLoops: 0 });
        setPlaybackRate(sessionStages[0].rate);
      }
    },
    [sessionBounds, setPlaybackRate]
  );

  const toggleStepUp = useCallback(() => {
    // Haptics: `tap` — any acknowledged press: buttons, rows, toggles.
    haptic.tap();
    if (sessionRef.current) {
      setSession(null);
      return;
    }
    const stages = normalizeStepUpSequence(sequence, sessionBounds());
    setSession({ stages, completedLoops: 0 });
    setPlaybackRate(stages[0].rate);
  }, [sequence, sessionBounds, setPlaybackRate]);

  /** Start the drill over from its first step, keeping the plan. */
  const restartStepUp = useCallback(() => {
    const current = sessionRef.current;
    if (!current) {
      return;
    }
    // Haptics: `tap` — any acknowledged press: buttons, rows, toggles.
    haptic.tap();
    setSession({ stages: current.stages, completedLoops: 0 });
    setPlaybackRate(current.stages[0].rate);
  }, [setPlaybackRate]);

  const handleLoopCycle = useCallback(() => {
    const current = sessionRef.current;
    if (!current) {
      return;
    }
    const completedLoops = current.completedLoops + 1;
    const previous = stepUpSequenceProgressAtLoop(current.stages, current.completedLoops);
    const next = stepUpSequenceProgressAtLoop(current.stages, completedLoops);
    setSession({ stages: current.stages, completedLoops });

    // The plan's passes are all played: the drill is over. The session stays so the
    // line reads "done" and restart is one tap away, but nothing drives the rate now.
    if (next.atEnd) {
      onDrillCompleteRef.current();
      return;
    }

    if (next.rate !== previous.rate) {
      setPlaybackRate(next.rate);
      // Haptics: `light` — step/detent boundaries; the climb is felt, not watched.
      haptic.light();
    }
  }, [setPlaybackRate]);

  const stepUpProgress: StepUpSequenceProgress | null = session
    ? stepUpSequenceProgressAtLoop(session.stages, session.completedLoops)
    : null;

  return {
    sequence,
    setSequence,
    stepUpEnabled: session != null,
    stepUpProgress,
    toggleStepUp,
    restartStepUp,
    handleLoopCycle,
    cancelStepUp,
  };
}
