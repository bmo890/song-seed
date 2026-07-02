import * as Haptics from "expo-haptics";

/**
 * Semantic haptic vocabulary — call these instead of expo-haptics directly so
 * the same physical gesture always feels the same everywhere.
 *
 *   tap      → any acknowledged press: buttons, menu rows, toggles, tabs
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
  tap: () => void Haptics.selectionAsync().catch(() => {}),
  light: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  grab: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  success: () =>
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warning: () =>
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
  error: () =>
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
} as const;
