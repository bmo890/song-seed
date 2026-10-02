import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import type { AudioPlayer, AudioStatus } from "expo-audio";
import { arePositionTicksWanted, isAppOnScreen } from "../services/backgroundPosition";

/**
 * Drop-in replacement for expo-audio's `useAudioPlayerStatus` that decouples the
 * React re-render cadence from the native status event cadence.
 *
 * The stock hook setStates on EVERY status event — at a 50ms updateInterval that
 * re-renders the consumer (and, from the root player provider, every context
 * consumer under it) 20×/sec for the whole duration of playback.
 *
 * Those commits are not merely wasteful, they are visible. A React commit landing while
 * something is animating knocks the Skia canvas and the RN views above it a frame out of
 * step with each other, which is what pulled the reel's bar numbers, pin badges and
 * section labels off the tape they name. Measured: any commit does it, at any rate, even
 * one in a sibling component — see docs/product-plan/reel-smoothness-findings.md.
 *
 * So nothing here commits for position alone. The reel takes position straight off the
 * engine via `onRawStatus` (see `createTransportPositionChannel`), and React only hears
 * about it when there is something new to SHOW:
 *  - meaningful TRANSITIONS (play/pause, load, finish, rate/duration change, seeks)
 *    commit immediately;
 *  - a plain position tick commits only when the displayed SECOND changes, which is the
 *    finest granularity any mm:ss readout can render — one commit per second, not twenty;
 *  - `positionIntervalMs` is a floor under that, not a target;
 *  - `statusRef` always holds the freshest event for imperative readers;
 *  - off screen there is no readout to show, so position alone commits nothing at all
 *    (see services/backgroundPosition) — only real changes of state do — and the
 *    status is read fresh and committed on the way back.
 */

export type StatusCommitInput = {
  previous: AudioStatus;
  next: AudioStatus;
  lastCommitAtMs: number;
  nowMs: number;
  positionIntervalMs: number;
  /** False when nothing can show or use a position (app off screen, no loop or click
   *  holding it open): only changes of state commit. Defaults to true. */
  positionTicksWanted?: boolean;
};

/** Whether this status event is worth a render. Pure, so the rule is testable. */
export function shouldCommitStatus({
  previous,
  next,
  lastCommitAtMs,
  nowMs,
  positionIntervalMs,
  positionTicksWanted = true,
}: StatusCommitInput): boolean {
  const isStateChange =
    previous.playing !== next.playing ||
    previous.didJustFinish !== next.didJustFinish ||
    previous.isLoaded !== next.isLoaded ||
    previous.playbackState !== next.playbackState ||
    (previous.playbackRate ?? 1) !== (next.playbackRate ?? 1) ||
    (previous.duration ?? 0) !== (next.duration ?? 0);

  if (isStateChange) {
    return true;
  }

  // Compared against the last COMMIT, so with ticks unwanted the distance below only
  // grows — it would read every other report as a seek.
  if (!positionTicksWanted) {
    return false;
  }

  // A jump far beyond tick spacing (seek/source swap) should render now, not
  // up to a throttle window later.
  if (Math.abs((next.currentTime ?? 0) - (previous.currentTime ?? 0)) > 1.5) {
    return true;
  }

  const secondChanged =
    Math.floor(previous.currentTime ?? 0) !== Math.floor(next.currentTime ?? 0);

  return secondChanged && nowMs - lastCommitAtMs >= positionIntervalMs;
}

export function useThrottledAudioPlayerStatus(
  player: AudioPlayer,
  {
    positionIntervalMs = 200,
    onRawStatus,
  }: {
    positionIntervalMs?: number;
    /**
     * Every native status event, unthrottled and BEFORE the commit decision. This is how
     * the reel gets its position without a render — see `createTransportPositionChannel`.
     * Must not setState: a commit here would defeat the whole point.
     */
    onRawStatus?: (status: AudioStatus) => void;
  } = {}
) {
  const [status, setStatus] = useState<AudioStatus>(() => player.currentStatus);
  const statusRef = useRef<AudioStatus>(status);
  const lastCommitAtRef = useRef(0);
  // The status React last saw. The commit rule compares against this, not against the
  // previous EVENT — otherwise a second boundary crossed during a throttled gap would be
  // noticed once and then never again, and the readout would stop ticking.
  const lastCommittedRef = useRef<AudioStatus>(status);
  // Held in a ref so a caller passing an inline function doesn't resubscribe every render.
  const onRawStatusRef = useRef(onRawStatus);
  onRawStatusRef.current = onRawStatus;

  useEffect(() => {
    // A recreated player instance starts a fresh status stream.
    statusRef.current = player.currentStatus;
    lastCommittedRef.current = player.currentStatus;
    setStatus(player.currentStatus);

    const subscription = player.addListener("playbackStatusUpdate", (next: AudioStatus) => {
      statusRef.current = next;
      onRawStatusRef.current?.(next);

      const now = Date.now();
      if (
        shouldCommitStatus({
          previous: lastCommittedRef.current,
          next,
          lastCommitAtMs: lastCommitAtRef.current,
          nowMs: now,
          positionIntervalMs,
          positionTicksWanted: arePositionTicksWanted(),
        })
      ) {
        lastCommitAtRef.current = now;
        lastCommittedRef.current = next;
        setStatus(next);
      }
    });

    // Back on screen: the last thing React saw may be minutes old, and the engine may
    // be reporting slowly (or, paused, not at all). Read it now rather than wait.
    const appState = AppState.addEventListener("change", () => {
      if (!isAppOnScreen()) return;
      let fresh: AudioStatus;
      try {
        fresh = player.currentStatus;
      } catch {
        // A released player has nothing to report.
        return;
      }
      statusRef.current = fresh;
      onRawStatusRef.current?.(fresh);
      lastCommitAtRef.current = Date.now();
      lastCommittedRef.current = fresh;
      setStatus(fresh);
    });

    return () => {
      subscription.remove();
      appState.remove();
    };
  }, [player, positionIntervalMs]);

  return { status, statusRef };
}
