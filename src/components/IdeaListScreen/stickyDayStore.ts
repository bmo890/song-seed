import { useSyncExternalStore } from "react";

/**
 * Module-level store for the floating "Today / Yesterday / …" day chip.
 *
 * The label changes while the list scrolls past day boundaries. Routing it
 * through the screen model re-rendered the entire provider tree (all visible
 * rows) mid-scroll — a visible hitch on Android. With this store, a label
 * change re-renders only the chip component.
 */
let currentLabel: string | null = null;
// The label of the very first (most recent) cohort in the list. While the
// current label still matches this, the chip is suppressed — it only appears
// once scrolling has passed into an older cohort.
let topLabel: string | null = null;
const listeners = new Set<() => void>();

export const stickyDayStore = {
  set(label: string | null) {
    if (label === currentLabel) return;
    currentLabel = label;
    listeners.forEach((l) => l());
  },
  setTopLabel(label: string | null) {
    if (label === topLabel) return;
    topLabel = label;
    listeners.forEach((l) => l());
  },
  get: () => currentLabel,
  getTopLabel: () => topLabel,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useStickyDayLabel(): string | null {
  return useSyncExternalStore(stickyDayStore.subscribe, stickyDayStore.get);
}

/** True once the visible label has scrolled past the most-recent cohort. */
export function useStickyDayChipVisible(): boolean {
  return useSyncExternalStore(
    stickyDayStore.subscribe,
    () => currentLabel !== null && currentLabel !== topLabel
  );
}
