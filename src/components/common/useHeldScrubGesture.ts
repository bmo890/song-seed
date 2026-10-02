import { useMemo } from "react";
import { Gesture } from "react-native-gesture-handler";
import { runOnJS, useSharedValue, type SharedValue } from "react-native-reanimated";

/** How far above and below a scrub line a touch still grabs it. */
const GRAB_SLOP = 10;

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
};

/**
 * A scrub that holds once grabbed (2026-10-02).
 *
 * The card's scrub lines are a few points tall. As JS PanResponders they read
 * `locationX` and could lose the touch to the list as soon as the thumb drifted
 * off the line — and a thumb resting on a line hides the playhead it is moving.
 * This is a native pan that takes the touch the moment it lands (a tap is a
 * seek; a drag is never the list's to steal) and keeps it until the finger
 * lifts, wherever the finger goes: slide the thumb down off the line and it
 * keeps steering, the way every scrubber people know behaves.
 *
 * `onTrack` must be a worklet. Attach the gesture to a view exactly as wide as
 * the line; `event.x` stays relative to it outside its bounds.
 */
export function useHeldScrubGesture({ width, onTrack, onGrab, onCommit, onCancel }: Options) {
  const held = useSharedValue(false);
  /** This touch was already committed as a tap; a late pan start must not repeat it. */
  const tapped = useSharedValue(false);

  return useMemo(() => {
    const fractionAt = (x: number) => {
      "worklet";
      const w = width.value;
      return w <= 0 ? 0 : Math.max(0, Math.min(1, x / w));
    };
    return Gesture.Pan()
      .maxPointers(1)
      .manualActivation(true)
      .shouldCancelWhenOutside(false)
      .hitSlop({ top: GRAB_SLOP, bottom: GRAB_SLOP })
      .onTouchesDown((_event, manager) => {
        "worklet";
        tapped.value = false;
        manager.activate();
      })
      .onTouchesMove((_event, manager) => {
        "worklet";
        // No-op once active; covers a platform that declines the activation
        // on touch-down.
        manager.activate();
      })
      .onTouchesUp((event) => {
        "worklet";
        // A tap quick enough to lift before the activation above has landed
        // never starts the pan. It is still a seek.
        if (held.value) return;
        const touch = event.changedTouches[0];
        if (!touch) return;
        tapped.value = true;
        const fraction = fractionAt(touch.x);
        runOnJS(onGrab)();
        onTrack(fraction);
        runOnJS(onCommit)(fraction);
      })
      .onStart((event) => {
        "worklet";
        if (tapped.value) return;
        held.value = true;
        runOnJS(onGrab)();
        onTrack(fractionAt(event.x));
      })
      .onUpdate((event) => {
        "worklet";
        if (!held.value) return;
        onTrack(fractionAt(event.x));
      })
      .onEnd((event, success) => {
        "worklet";
        if (!success || !held.value) return;
        held.value = false;
        runOnJS(onCommit)(fractionAt(event.x));
      })
      .onFinalize(() => {
        "worklet";
        if (!held.value) return;
        held.value = false;
        runOnJS(onCancel)();
      });
  }, [held, onCancel, onCommit, onGrab, onTrack, tapped, width]);
}
