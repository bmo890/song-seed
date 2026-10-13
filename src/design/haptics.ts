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
