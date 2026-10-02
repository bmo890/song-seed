import { useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useFrameCallback, type FrameInfo } from "react-native-reanimated";

/**
 * Animation that only runs while the app can be seen (2026-10-02).
 *
 * A frame callback or a repeating animation asks the system for a frame, every
 * frame, for as long as it is alive — and nothing stops that when the app
 * leaves the screen. On Android the worklets frame queue is written to pause
 * with the activity but is never registered for the pause event
 * (react-native-worklets 0.5.1, `WorkletsModule` implements
 * `LifecycleEventListener` and no one adds it), and with the display off the
 * system keeps handing out frames at ~60 Hz to any process that asks. A
 * playlist played with the screen locked therefore ran the reel's frame loop
 * for its whole length, which is what Android flagged as high CPU. Measured in
 * the iOS simulator, backgrounded playback: 41% of the main thread inside the
 * frame queue, 0 after.
 *
 * "background" is the only state that stops it. iOS "inactive" (app switcher,
 * a system sheet over the app) is still on screen.
 */

function isOnScreen(state: AppStateStatus | null | undefined): boolean {
  return state !== "background";
}

/** True while the app is on screen; re-renders the caller when that changes. */
export function useAppInForeground(): boolean {
  const [foreground, setForeground] = useState(() => isOnScreen(AppState.currentState));
  useEffect(() => {
    setForeground(isOnScreen(AppState.currentState));
    const subscription = AppState.addEventListener("change", (state) => {
      setForeground(isOnScreen(state));
    });
    return () => subscription.remove();
  }, []);
  return foreground;
}

/**
 * `useFrameCallback` that stands down while the app is in the background and
 * picks up again on return, without a render. The callback must tolerate a gap
 * between frames of any length (the reel's does: it re-anchors on the first
 * position report it sees), and must carry its own `"worklet"` directive — the
 * Reanimated plugin only marks callbacks passed to its own hooks.
 */
export function useForegroundFrameCallback(callback: (frameInfo: FrameInfo) => void): void {
  const frameCallback = useFrameCallback(callback, isOnScreen(AppState.currentState));
  useEffect(() => {
    frameCallback.setActive(isOnScreen(AppState.currentState));
    const subscription = AppState.addEventListener("change", (state) => {
      frameCallback.setActive(isOnScreen(state));
    });
    return () => subscription.remove();
  }, [frameCallback]);
}
