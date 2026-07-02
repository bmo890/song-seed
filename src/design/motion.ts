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
} as const;

/** Spring for surfaces sliding into place (sheets, docks). */
export const springs = {
  surface: { damping: 20, stiffness: 220, mass: 0.9 },
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
