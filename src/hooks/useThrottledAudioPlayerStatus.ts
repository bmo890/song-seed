import { useEffect, useRef, useState } from "react";
import type { AudioPlayer, AudioStatus } from "expo-audio";

/**
 * Drop-in replacement for expo-audio's `useAudioPlayerStatus` that decouples the
 * React re-render cadence from the native status event cadence.
 *
 * The stock hook setStates on EVERY status event — at a 50ms updateInterval that
 * re-renders the consumer (and, from the root player provider, every context
 * consumer under it) 20×/sec for the whole duration of playback. Those commits are
 * what made the app feel glitchy while playing: modal fades restarted mid-animation,
 * sheet drags stuttered against the commit traffic, and with a large library each
 * commit got more expensive.
 *
 * Nothing in the React tree needs position at 20Hz — smooth playhead motion comes
 * from the UI-thread transport clock (shared values + frame predictor), which only
 * needs periodic reports to stay corrected. So:
 *  - meaningful TRANSITIONS (play/pause, load, finish, rate/duration change, seeks)
 *    commit immediately;
 *  - pure position ticks commit at most every `positionIntervalMs`;
 *  - `statusRef` always holds the freshest event for imperative readers.
 */
export function useThrottledAudioPlayerStatus(
  player: AudioPlayer,
  { positionIntervalMs = 200 }: { positionIntervalMs?: number } = {}
) {
  const [status, setStatus] = useState<AudioStatus>(() => player.currentStatus);
  const statusRef = useRef<AudioStatus>(status);
  const lastCommitAtRef = useRef(0);

  useEffect(() => {
    // A recreated player instance starts a fresh status stream.
    statusRef.current = player.currentStatus;
    setStatus(player.currentStatus);

    const subscription = player.addListener("playbackStatusUpdate", (next: AudioStatus) => {
      const previous = statusRef.current;
      statusRef.current = next;

      const isTransition =
        previous.playing !== next.playing ||
        previous.didJustFinish !== next.didJustFinish ||
        previous.isLoaded !== next.isLoaded ||
        previous.playbackState !== next.playbackState ||
        (previous.playbackRate ?? 1) !== (next.playbackRate ?? 1) ||
        (previous.duration ?? 0) !== (next.duration ?? 0) ||
        // A jump far beyond tick spacing (seek/source swap) should render now, not
        // up to a throttle window later.
        Math.abs((next.currentTime ?? 0) - (previous.currentTime ?? 0)) > 1.5;

      const now = Date.now();
      if (isTransition || now - lastCommitAtRef.current >= positionIntervalMs) {
        lastCommitAtRef.current = now;
        setStatus(next);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [player, positionIntervalMs]);

  return { status, statusRef };
}
