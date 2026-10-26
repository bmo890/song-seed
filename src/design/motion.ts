import { withSpring, withTiming } from "react-native-reanimated";

/**
 * Motion tokens — the app's shared animation vocabulary.
 *
 * Durations and spring profiles were previously hardcoded per component
 * (12+ distinct values); new animation code should draw from here so the
 * whole app moves at the same tempo.
 */

export const durations = {
  /** Micro feedback: menu/overlay fade-ins, chip state changes. */
  fast: 120,
  /** Standard UI transitions: toggles, thumbs, small reveals. */
  base: 180,
  /** Entrances of larger surfaces: docks, banners, sheets sliding. */
  gentle: 220,
  /** Expansive changes: panel expand/collapse, progress. */
  slow: 300,
  /** Following the keyboard when the platform states no duration (Android, or an
   *  iOS event without one): about the system keyboard's own slide. */
  keyboard: 250,
  /** A BottomSheet's exit slide (`gentle`) plus a beat, for a store that clears
   *  its request once the sheet is off screen. */
  sheetExit: 260,
  /** One turn of the Spinner. Slow enough to read as waiting, not as hurry. */
  spin: 900,
  /** A highlight, flash or pulse fading away: long enough to be seen after
   *  the eye arrives, short enough to be gone before it is asked about. */
  linger: 900,
} as const;

/** Spring for surfaces sliding into place (sheets, docks). */
export const springs = {
  // Surfaces land without overshoot: underdamped, a sheet sailed past its rest and
  // bobbed back, read as the sheet jumping on open (founder, 2026-10-26).
  surface: { damping: 20, stiffness: 220, mass: 0.9, overshootClamping: true },
  /** A surface snapping back to rest after a drag let it go. */
  settle: { damping: 20, stiffness: 240, mass: 0.85, overshootClamping: true },
  /** Snappier pop for small cards/dialogs scaling in. */
  pop: { damping: 18, stiffness: 320 },
  /** Handles and grabbed elements tracking a gesture. */
  handle: { damping: 20, stiffness: 300 },
} as const;

/**
 * Shared entrance for centered cards (dialogs, warm modals): slight scale-up
 * + fade, spring-settled. Use as `entering={popIn}` on a reanimated view.
 */
export const popIn = () => {
  "worklet";
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.94 }] },
    animations: {
      opacity: withTiming(1, { duration: 160 }),
      transform: [{ scale: withSpring(1, springs.pop) }],
    },
  };
};

/**
 * Accordion body entrance: fade + a 6px settle from above. Pair with
 * `collapseOut`; consumed via `common/AnimatedCollapse`.
 */
export const collapseIn = () => {
  "worklet";
  return {
    initialValues: { opacity: 0, transform: [{ translateY: -6 }] },
    animations: {
      opacity: withTiming(1, { duration: durations.base }),
      transform: [{ translateY: withTiming(0, { duration: durations.base }) }],
    },
  };
};

/** Accordion body exit: quick fade (no motion — content above/below reflows). */
export const collapseOut = () => {
  "worklet";
  return {
    initialValues: { opacity: 1 },
    animations: {
      opacity: withTiming(0, { duration: durations.fast }),
    },
  };
};

/**
 * Sticky-footer entrance (picker footer): fade + a 6px settle from below —
 * the mirror of `collapseIn`, for chrome that belongs to the screen's bottom
 * edge. Pair with `riseOut`.
 */
export const riseIn = () => {
  "worklet";
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 6 }] },
    animations: {
      opacity: withTiming(1, { duration: durations.gentle }),
      transform: [{ translateY: withTiming(0, { duration: durations.gentle }) }],
    },
  };
};

/** Sticky-footer exit: quick fade, no motion. */
export const riseOut = () => {
  "worklet";
  return {
    initialValues: { opacity: 1 },
    animations: {
      opacity: withTiming(0, { duration: durations.fast }),
    },
  };
};
