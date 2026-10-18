import React, { useCallback, useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { colors, radii, shadows } from "../../design/tokens";
import { haptic } from "../../design/haptics";
import { durations, springs } from "../../design/motion";

/**
 * The app's slider — a drawn track and thumb in place of the platform widget.
 *
 * Why not the community slider package: its thumb is the system's, it cannot
 * tick, and it sat under every mark, loop, speed and tempo control looking like
 * a form field. This one is the same object everywhere: a hairline track, a
 * paper thumb that lifts under the finger, and a detent you can feel.
 *
 * Feel (2026-10-13, founder's bar: "haptics match the interaction"):
 *   grab  → the finger lands (haptics.ts: drag lift)
 *   tick  → every `detent` crossed while dragging (haptics.ts: detent)
 *   light → the finger lifts (haptics.ts: small state flip — the value is set)
 *
 * Value is controlled: the thumb follows `value` between drags and the finger
 * during one. `step` quantises what is reported; `detent` is how far the value
 * must travel between ticks — coarser than `step` where a step is tiny, so a
 * 50 ms slider ticks once a second rather than buzzing.
 */
export type SliderProps = {
  value: number;
  minimumValue: number;
  maximumValue: number;
  /** Quantum of the reported value. 0 = continuous. */
  step?: number;
  /** Value travel between haptic ticks. Omit for no ticks. */
  detent?: number;
  onValueChange?: (value: number) => void;
  onSlidingStart?: () => void;
  onSlidingComplete?: (value: number) => void;
  /** Draw the filled run from the start to the thumb. Off for position sliders,
   *  where "how much" means nothing. */
  fill?: boolean;
  /** Mirror the axis (a value track reads with the language; a time track does not). */
  inverted?: boolean;
  disabled?: boolean;
  /** Draws the track in place of the hairline (e.g. the workspace hue rainbow).
   *  Spans the thumb's travel at CUSTOM_TRACK_HEIGHT; no fill run is drawn over it. */
  track?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

const TRACK_HEIGHT = 3;
const THUMB = 18;
const TOUCH_HEIGHT = 32;
export const CUSTOM_TRACK_HEIGHT = 14;
/** Sideways travel that means "I am sliding". */
const SLIDE_INTENT_PX = 6;
/** Vertical travel that means "I am scrolling the page" — the slider lets go. */
const SCROLL_INTENT_PX = 10;

function quantise(value: number, step: number) {
  "worklet";
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

export function Slider({
  value,
  minimumValue,
  maximumValue,
  step = 0,
  detent,
  onValueChange,
  onSlidingStart,
  onSlidingComplete,
  fill = true,
  inverted = false,
  disabled = false,
  track: customTrack,
  style,
  accessibilityLabel,
  testID,
}: SliderProps) {
  const range = Math.max(1e-9, maximumValue - minimumValue);
  const propFraction = Math.max(0, Math.min(1, (value - minimumValue) / range));

  const width = useSharedValue(0);
  const dragging = useSharedValue(false);
  const dragFraction = useSharedValue(propFraction);
  const lastReported = useSharedValue(value);
  const lastDetent = useSharedValue(0);

  // Between drags the thumb is where the prop says; during one it is under the
  // finger. Derived, not assigned from an effect, so the first frame is right.
  const fraction = useDerivedValue(() => (dragging.value ? dragFraction.value : propFraction));

  const report = useCallback(
    (next: number) => {
      onValueChange?.(next);
    },
    [onValueChange]
  );
  const start = useCallback(() => {
    // Haptics: `grab` — the finger has picked the thumb up.
    haptic.grab();
    onSlidingStart?.();
  }, [onSlidingStart]);
  const complete = useCallback(
    (next: number) => {
      // Haptics: `light` — the value is set; a small state flip, not a press.
      haptic.light();
      onSlidingComplete?.(next);
    },
    [onSlidingComplete]
  );
  // A tap on the track: one move, begun and finished at once.
  const jump = useCallback(
    (next: number) => {
      // Haptics: `light` — the value is set.
      haptic.light();
      onSlidingStart?.();
      onValueChange?.(next);
      onSlidingComplete?.(next);
    },
    [onSlidingComplete, onSlidingStart, onValueChange]
  );
  const tick = useCallback(() => {
    // Haptics: `tick` — a detent crossed under a moving thumb.
    haptic.tick();
  }, []);

  const gesture = useMemo(() => {
    const travel = () => {
      "worklet";
      return Math.max(1, width.value - THUMB);
    };
    const fractionAt = (x: number) => {
      "worklet";
      const f = Math.max(0, Math.min(1, (x - THUMB / 2) / travel()));
      return inverted ? 1 - f : f;
    };
    const valueAt = (f: number) => {
      "worklet";
      const raw = minimumValue + f * range;
      return Math.max(minimumValue, Math.min(maximumValue, quantise(raw, step)));
    };
    const track = (x: number) => {
      "worklet";
      const f = fractionAt(x);
      dragFraction.value = f;
      const next = valueAt(f);
      if (next !== lastReported.value) {
        lastReported.value = next;
        runOnJS(report)(next);
        if (detent && detent > 0) {
          const d = Math.floor(next / detent);
          if (d !== lastDetent.value) {
            lastDetent.value = d;
            runOnJS(tick)();
          }
        }
      }
    };
    // The value follows a SIDEWAYS drag only (founder, 2026-10-13: a slider in a
    // scrolling page moved while the page was being scrolled). The pan waits for
    // horizontal travel and gives up on vertical travel, so the page keeps its
    // scroll; a tap on the track still sets the value directly.
    const pan = Gesture.Pan()
      .enabled(!disabled)
      .maxPointers(1)
      .shouldCancelWhenOutside(false)
      .activeOffsetX([-SLIDE_INTENT_PX, SLIDE_INTENT_PX])
      .failOffsetY([-SCROLL_INTENT_PX, SCROLL_INTENT_PX])
      .hitSlop({ top: 8, bottom: 8 })
      .onStart((e) => {
        "worklet";
        dragging.value = true;
        lastReported.value = valueAt(fractionAt(e.x));
        lastDetent.value = detent && detent > 0 ? Math.floor(lastReported.value / detent) : 0;
        dragFraction.value = fractionAt(e.x);
        runOnJS(start)();
        runOnJS(report)(lastReported.value);
      })
      .onUpdate((e) => {
        "worklet";
        if (!dragging.value) return;
        track(e.x);
      })
      .onEnd((e, success) => {
        "worklet";
        if (!dragging.value) return;
        if (success) track(e.x);
        dragging.value = false;
        runOnJS(complete)(lastReported.value);
      })
      .onFinalize(() => {
        "worklet";
        if (!dragging.value) return;
        dragging.value = false;
        runOnJS(complete)(lastReported.value);
      });
    const tap = Gesture.Tap()
      .enabled(!disabled)
      .hitSlop({ top: 8, bottom: 8 })
      .onEnd((e, success) => {
        "worklet";
        if (!success) return;
        const next = valueAt(fractionAt(e.x));
        lastReported.value = next;
        runOnJS(jump)(next);
      });
    return Gesture.Exclusive(pan, tap);
  }, [
    jump,
    complete,
    detent,
    disabled,
    dragFraction,
    dragging,
    inverted,
    lastDetent,
    lastReported,
    maximumValue,
    minimumValue,
    range,
    report,
    start,
    step,
    tick,
    width,
  ]);

  const thumbX = useDerivedValue(() => {
    const f = inverted ? 1 - fraction.value : fraction.value;
    return f * Math.max(0, width.value - THUMB);
  });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: thumbX.value },
      { scale: withSpring(dragging.value ? 1.2 : 1, springs.handle) },
    ],
    borderColor: withTiming(dragging.value ? colors.primary : colors.borderMuted, {
      duration: durations.fast,
    }),
  }));

  const fillStyle = useAnimatedStyle(() => {
    const w = Math.max(0, width.value - THUMB);
    const f = fraction.value;
    return inverted
      ? { left: undefined, right: THUMB / 2, width: f * w }
      : { left: THUMB / 2, width: f * w };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[s.touch, disabled ? s.disabled : null, style]}
        onLayout={(e) => {
          width.value = e.nativeEvent.layout.width;
        }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min: minimumValue, max: maximumValue, now: value }}
        accessibilityState={{ disabled }}
        // VoiceOver / TalkBack swipe up and down to adjust (2026-10-18: "adjustable"
        // was declared with no actions, so a screen reader could not move it).
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(event) => {
          if (disabled) return;
          const unit = detent && detent > 0 ? detent : step > 0 ? step : range / 10;
          const direction = event.nativeEvent.actionName === "increment" ? 1 : -1;
          const next = Math.max(minimumValue, Math.min(maximumValue, quantise(value + direction * unit, step)));
          if (next === value) return;
          onValueChange?.(next);
          onSlidingComplete?.(next);
        }}
        testID={testID}
      >
        {customTrack ? (
          <View style={s.customTrack} pointerEvents="none">
            {customTrack}
          </View>
        ) : (
          <View style={s.track} pointerEvents="none" />
        )}
        {fill && !customTrack ? <Animated.View style={[s.fill, fillStyle]} pointerEvents="none" /> : null}
        <Animated.View style={[s.thumb, thumbStyle]} pointerEvents="none" />
      </Animated.View>
    </GestureDetector>
  );
}

const s = StyleSheet.create({
  touch: {
    height: TOUCH_HEIGHT,
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.4,
  },
  // Inset by half a thumb, like the hairline, so the colour under the thumb's
  // centre is the value it reports.
  customTrack: {
    position: "absolute",
    left: THUMB / 2,
    right: THUMB / 2,
    height: CUSTOM_TRACK_HEIGHT,
    borderRadius: radii.round,
    overflow: "hidden",
  },
  // A warm line, not a surface tone: it has to read on the page AND on the
  // terracotta wash the loop and marks cards sit on.
  track: {
    position: "absolute",
    left: THUMB / 2,
    right: THUMB / 2,
    height: TRACK_HEIGHT,
    borderRadius: radii.round,
    backgroundColor: colors.borderMuted,
  },
  fill: {
    position: "absolute",
    height: TRACK_HEIGHT,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
  },
  thumb: {
    position: "absolute",
    left: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.borderMuted,
    ...shadows.control,
  },
});
