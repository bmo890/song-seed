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
// The fast-scroll scrubber's readout for the row under the visible-area top:
// the day label under date sorts, the first letter under title sorts, nothing
// under the rest. Kept here (not in the screen model) for the same reason as
// the chip: it changes per scroll position and must re-render only its reader.
let scrubLabel: string | null = null;
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
  setScrubLabel(label: string | null) {
    if (label === scrubLabel) return;
    scrubLabel = label;
    listeners.forEach((l) => l());
  },
  get: () => currentLabel,
  getScrubLabel: () => scrubLabel,
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

/** The scrubber's readout for the current scroll position. */
export function useScrubLabel(): string | null {
  return useSyncExternalStore(stickyDayStore.subscribe, stickyDayStore.getScrubLabel);
}
