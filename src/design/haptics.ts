import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

// Master switch, driven by the persisted `hapticsEnabled` preference (see
// useStore) so a single Settings toggle silences every call site.
let hapticsEnabled = true;

export function setHapticsEnabled(value: boolean) {
  hapticsEnabled = value;
}

/**
 * Semantic haptic vocabulary — call these instead of expo-haptics directly so
 * the same physical gesture always feels the same everywhere.
 *
 *   tap      → any acknowledged press: buttons, menu rows, toggles, tabs
 *   tick     → a detent crossed mid-gesture: a slider passing a second, a
 *              stepper notch. Selection on iOS; on Android selection is too
 *              faint to feel under a moving thumb (founder, 2026-10-13), so
 *              it is a light impact there.
 *   light    → small state flips: bookmark, favorite, chip select
 *   grab     → picking something up / entering a heavier mode: drag lift,
 *              long-press into selection mode, record state changes
 *   success  → a meaningful completion: save landed, export finished
 *   warning  → about to do something destructive: confirm dialogs opening
 *   error    → something failed
 *
 * Choreographies (2026-10-15, founder: one shared feel across the app). A
 * gesture is a sentence made of the verbs above, and the same gesture always
 * says the same sentence, whatever surface it is on:
 *
 *   press                 tap. Navigation is silent.
 *   scrub / drag a value  grab when the finger lands and the thing is held;
 *                         tick at every detent crossed (one second on a
 *                         timeline, the control's own step on a slider or
 *                         stepper); light when the finger lifts and the value
 *                         is set. Nothing on continuous motion between detents.
 *   tap to seek           tap, once, at the landing.
 *   snap to a magnet      tick, in place of the release light.
 *   sheet settles         light. Dragging a sheet is silent.
 *   lift into a mode      grab (drag lift, selection mode, record).
 *   finish / fail         success / error. Never both.
 *
 * Built once in Slider, Stepper, useHeldScrubGesture, the reel and the
 * minimap; a new surface reuses those before it fires a verb by hand.
 *
 * All fire-and-forget; failures are swallowed (haptics are never load-bearing).
 */
export const haptic = {
  tap: () => {
    if (hapticsEnabled) void Haptics.selectionAsync().catch(() => {});
  },
  tick: () => {
    if (!hapticsEnabled) return;
    if (Platform.OS === "android") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } else {
      void Haptics.selectionAsync().catch(() => {});
    }
  },
  light: () => {
    if (hapticsEnabled) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  grab: () => {
    if (hapticsEnabled) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  success: () => {
    if (hapticsEnabled)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  warning: () => {
    if (hapticsEnabled)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
  error: () => {
    if (hapticsEnabled)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  },
} as const;
