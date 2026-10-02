import { createContext, useContext } from "react";
import type { SharedValue } from "react-native-reanimated";

/**
 * Whether the surface a reel sits on can be seen right now (2026-10-02).
 *
 * The full player stays mounted behind the media dock for the whole of a
 * playback session, so its reel kept running its frame loop — tracker, tape
 * transform, every Skia redraw hanging off them — with nothing of it on
 * screen. Measured in the simulator: playback with the player docked cost the
 * same as with it open.
 *
 * A shared value, read on the UI thread, so the reel wakes on the frame the
 * sheet starts to rise rather than a JS round trip later. `null` (no provider)
 * means the reel is on an ordinary page and always visible.
 */
export const ReelStageVisibleContext = createContext<SharedValue<boolean> | null>(null);

export function useReelStageVisible(): SharedValue<boolean> | null {
  return useContext(ReelStageVisibleContext);
}
