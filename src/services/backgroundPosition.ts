import { AppState } from "react-native";

/**
 * Who still needs the playback position while the app is off screen (2026-10-02).
 *
 * With the screen locked nothing draws, so position ticks have no reader: the
 * lock-screen card keeps its own clock natively, and a clip ending, a pause or
 * a new source all arrive as their own events. The player therefore stops
 * forwarding plain position ticks in the background (no shared-value writes,
 * no once-a-second render), and on Android asks the engine to report once a
 * second instead of twenty times.
 *
 * Two things do read position with the screen off, and hold this open while
 * they run: the practice loop (its wrap is timed from the position) and the
 * playback click (it re-syncs the beat against the position).
 */

/** How often the engine reports while in the background with no one asking. */
export const BACKGROUND_STATUS_INTERVAL_MS = 1000;

let holds = 0;
const listeners = new Set<() => void>();

/** Keep position flowing in the background until the returned release is called. */
export function holdBackgroundPosition(): () => void {
  holds += 1;
  if (holds === 1) notify();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds -= 1;
    if (holds === 0) notify();
  };
}

export function isBackgroundPositionHeld(): boolean {
  return holds > 0;
}

export function subscribeBackgroundPositionHold(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  for (const listener of Array.from(listeners)) listener();
}

/** iOS "inactive" (app switcher, a system sheet over the app) is still on screen. */
export function isAppOnScreen(): boolean {
  return AppState.currentState !== "background";
}

/** Whether a plain position tick has any reader right now. */
export function arePositionTicksWanted(): boolean {
  return isAppOnScreen() || holds > 0;
}

/**
 * One step of a JS frame loop: the next animation frame while the app is on
 * screen, a slow timer while it is not. Returns the cancel.
 *
 * A `requestAnimationFrame` loop has no frame to wait for once the app is in
 * the background — on iOS the callbacks then run back to back (measured: half
 * a core for the recorder's elapsed clock during a backgrounded take).
 */
export function scheduleFrameOrBackgroundTick(callback: () => void, backgroundDelayMs = 250): () => void {
  if (isAppOnScreen()) {
    const frame = requestAnimationFrame(callback);
    return () => cancelAnimationFrame(frame);
  }
  const timer = setTimeout(callback, backgroundDelayMs);
  return () => clearTimeout(timer);
}
