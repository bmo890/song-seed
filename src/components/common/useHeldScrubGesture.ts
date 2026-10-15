import { useMemo } from "react";
import { Gesture, type PanGesture } from "react-native-gesture-handler";
import { runOnJS, useSharedValue, type SharedValue } from "react-native-reanimated";
import { haptic } from "../../design/haptics";

/** How far above and below a scrub line a touch still grabs it. */
const GRAB_SLOP = 10;
/** Sideways travel that reads as "I am scrubbing" before the list could claim a scroll. */
const SCRUB_INTENT_PX = 6;
/** Vertical travel that reads as "I am scrolling" — the line lets the touch go. */
const SCROLL_INTENT_PX = 10;
/** A finger resting this long on the line grabs it even before it moves. */
const HOLD_TO_GRAB_MS = 200;

type Options = {
  /** Width of the line being scrubbed, in points. */
  width: SharedValue<number>;
  /** UI thread, on the grab and on every move: the 0..1 fraction under the finger. */
  onTrack: (fraction: number) => void;
  /** JS thread, once, when the finger lands. */
  onGrab: () => void;
  /** JS thread, when the finger lifts: the final fraction. */
  onCommit: (fraction: number) => void;
  /** JS thread, when the system takes the touch away. */
  onCancel: () => void;
  /** Detents across the whole width: a timeline passes its length in seconds.
   *  Omit for a line with no detents (grab and release still speak). */
  detents?: SharedValue<number>;
};

/**
 * A scrub that holds once grabbed (2026-10-02) — and asks for intent first
 * (2026-10-03).
 *
 * The card's scrub lines are a few points tall. As JS PanResponders they read
 * `locationX` and could lose the touch to the list as soon as the thumb drifted
 * off the line — and a thumb resting on a line hides the playhead it is moving.
 * The first native version grabbed on touch-down, which fixed that and broke
 * scrolling: a flick that happened to start on a live line scrubbed instead.
 *
 * So the grab is earned one of three ways, raced:
 *   - sideways movement (≥ 6 pt before 10 pt of vertical travel) — a scrub;
 *     vertical first fails the pan and the list scrolls as if the line were
 *     not there;
 *   - a still press of ~200 ms — then drag anywhere, the way every scrubber
 *     people know behaves;
 *   - a tap — a seek.
 * Once grabbed, the pan keeps the touch wherever the finger goes until it
 * lifts.
 *
 * `onTrack` must be a worklet. Attach the gesture to a view exactly as wide as
 * the line; `event.x` stays relative to it outside its bounds.
 *
 * Feel is the app's one scrub choreography (haptics.ts): `grab` as the line is
 * held, `tick` at each detent crossed, `light` as the finger lifts, `tap` for
 * a tap-seek. Callers never fire these themselves.
 */
export function useHeldScrubGesture({ width, onTrack, onGrab, onCommit, onCancel, detents }: Options) {
  const held = useSharedValue(false);
  const lastDetent = useSharedValue(0);

  return useMemo(() => {
    const fractionAt = (x: number) => {
      "worklet";
      const w = width.value;
      return w <= 0 ? 0 : Math.max(0, Math.min(1, x / w));
    };
    const detentAt = (fraction: number) => {
      "worklet";
      const count = detents?.value ?? 0;
      return count > 0 ? Math.floor(fraction * count) : 0;
    };

    const scrubbing = (pan: PanGesture) =>
      pan
        .maxPointers(1)
        .shouldCancelWhenOutside(false)
        .hitSlop({ top: GRAB_SLOP, bottom: GRAB_SLOP })
        .onStart((event) => {
          "worklet";
          held.value = true;
          const fraction = fractionAt(event.x);
          lastDetent.value = detentAt(fraction);
          // Haptics vocabulary: `grab` — the line is held.
          runOnJS(haptic.grab)();
          runOnJS(onGrab)();
          onTrack(fraction);
        })
        .onUpdate((event) => {
          "worklet";
          if (!held.value) return;
          const fraction = fractionAt(event.x);
          const detent = detentAt(fraction);
          if (detent !== lastDetent.value) {
            lastDetent.value = detent;
            // Haptics vocabulary: `tick` — a detent crossed under the finger.
            runOnJS(haptic.tick)();
          }
          onTrack(fraction);
        })
        .onEnd((event, success) => {
          "worklet";
          if (!success || !held.value) return;
          held.value = false;
          // Haptics vocabulary: `light` — the finger lifts, the position is set.
          runOnJS(haptic.light)();
          runOnJS(onCommit)(fractionAt(event.x));
        })
        .onFinalize(() => {
          "worklet";
          if (!held.value) return;
          held.value = false;
          runOnJS(onCancel)();
        });

    // Sideways first: a scrub. Vertical first: not ours.
    const sidewaysPan = scrubbing(
      Gesture.Pan()
        .activeOffsetX([-SCRUB_INTENT_PX, SCRUB_INTENT_PX])
        .failOffsetY([-SCROLL_INTENT_PX, SCROLL_INTENT_PX])
    );
    // A still press earns the grab without moving; moving before the hold is
    // up hands the decision to the other two.
    const holdPan = scrubbing(Gesture.Pan().activateAfterLongPress(HOLD_TO_GRAB_MS));
    // A lift before either pan has activated is a seek to where it landed.
    const tap = Gesture.Tap()
      .maxDuration(HOLD_TO_GRAB_MS)
      .hitSlop({ top: GRAB_SLOP, bottom: GRAB_SLOP })
      .onEnd((event, success) => {
        "worklet";
        if (!success) return;
        const fraction = fractionAt(event.x);
        // Haptics vocabulary: `tap` — a tap-seek, once, at the landing.
        runOnJS(haptic.tap)();
        runOnJS(onGrab)();
        onTrack(fraction);
        runOnJS(onCommit)(fraction);
      });

    return Gesture.Race(sidewaysPan, holdPan, tap);
  }, [detents, held, lastDetent, onCancel, onCommit, onGrab, onTrack, width]);
}
