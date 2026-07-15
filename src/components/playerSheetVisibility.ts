/**
 * Pure visibility rules for the root-level player sheet.
 *
 * Kept OUT of PlayerSheet.tsx so they're testable without dragging in the entire
 * player tree (expo-audio and friends) — the same split as floatingActionDockLayout.
 */

/** Root routes that legitimately open ON TOP of the player (trim, re-record,
 *  lyric/chord editing…). The sheet hides beneath them but stays mounted, so
 *  audio and player state survive the round-trip and it reappears on back. */
export const OBSCURING_ROUTES = new Set([
  "Editor",
  "Recording",
  "BluetoothCalibration",
  "Lyrics",
  "LyricsVersion",
  "ChordSheet",
  "ClipLineage",
  "ShareImport",
]);

/**
 * Should the sheet be hidden (kept mounted, painted invisible)?
 *
 * The selection-toolbar case is the subtle one. The DOCKED sheet is a full-height view
 * whose top hides exactly behind the media dock. A selection toolbar lifts the dock off
 * the screen bottom — and the sheet cannot follow, because moving a full-height view up
 * doesn't shorten it: its body still covers the toolbar, and its own header pokes out
 * below the dock. Since a docked sheet is invisible by design, hiding it costs nothing
 * and reveals the toolbar.
 */
export function shouldObscurePlayerSheet(opts: {
  activeRouteName: string;
  isDrawerOpen: boolean;
  /** A selection toolbar is on screen, which lifts the media dock off the bottom. */
  selectionBarActive: boolean;
  /** The sheet is the active surface (only true once a drag has FINISHED opening it). */
  expanded: boolean;
  /** The sheet is animating or being dragged (true from the drag's START). */
  inMotion: boolean;
}): boolean {
  if (OBSCURING_ROUTES.has(opts.activeRouteName) || opts.isDrawerOpen) return true;
  // Never hide it mid-drag or while expanded — only the invisible docked state.
  return opts.selectionBarActive && !opts.expanded && !opts.inMotion;
}
