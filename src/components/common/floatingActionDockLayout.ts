/**
 * Pure layout math for the floating record/create dock.
 *
 * Kept OUT of FloatingActionDock.tsx so lists can derive their footer spacing without
 * pulling in the component (and the store/native chain behind it), and so the numbers
 * are unit-testable on their own.
 *
 * The dock's own position and every list's footer spacer BOTH derive from here — a
 * list can't drift out of step with where the buttons actually are.
 */

const FLOATING_ACTION_DOCK_BASE_BOTTOM = 12;
const FLOATING_ACTION_DOCK_MIN_SAFE_AREA = 16;
const FLOATING_ACTION_DOCK_RECORD_BUTTON_SIZE = 62;
/** Breathing room between the last row and the record button once scrolled to the end. */
const FLOATING_ACTION_DOCK_CONTENT_GAP = 24;

/** What else floats over the list's bottom edge right now. */
export type FloatingActionDockLayout = {
  /** Global media dock height (0 when no session). */
  playerDockHeight?: number;
  /** Import progress bar height (0 when no import running). */
  importBannerHeight?: number;
};

/** Distance from the screen bottom to the BOTTOM of the record button. */
export function getFloatingActionDockBottomOffset(
  bottomInset: number,
  { playerDockHeight = 0, importBannerHeight = 0 }: FloatingActionDockLayout = {}
) {
  // The media dock already covers the bottom safe area — adding the safe-area base on
  // top of it double-counts and floats the buttons visibly too high.
  const base =
    playerDockHeight > 0
      ? playerDockHeight + FLOATING_ACTION_DOCK_BASE_BOTTOM
      : FLOATING_ACTION_DOCK_BASE_BOTTOM + Math.max(bottomInset, FLOATING_ACTION_DOCK_MIN_SAFE_AREA);
  return base + importBannerHeight;
}

/**
 * How much empty space a list needs below its last row: exactly enough to scroll that
 * row clear of the record button, plus one gap. This is the WHOLE requirement — a
 * footer taller than this is dead space the user has to scroll through.
 */
export function getFloatingActionDockContentClearance(
  bottomInset: number,
  layout: FloatingActionDockLayout = {}
) {
  return (
    getFloatingActionDockBottomOffset(bottomInset, layout) +
    FLOATING_ACTION_DOCK_RECORD_BUTTON_SIZE +
    FLOATING_ACTION_DOCK_CONTENT_GAP
  );
}
