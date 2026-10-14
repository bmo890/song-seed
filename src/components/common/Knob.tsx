import React, { useCallback, useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { colors, shadows } from "../../design/tokens";
import { durations, springs } from "../../design/motion";
import { haptic } from "../../design/haptics";

/**
 * A knob: the mixer's level control, in the app's materials (Sound room,
 * 2026-10-14). A white disc on the paper with a terracotta pointer, a tick arc
 * around it with a longer tick at the rest value, and the arc filling from rest
 * toward the pointer so a glance says which way it leans.
 *
 * Turned by dragging up or down, the touch-mixer convention: the pan activates on
 * touch, so the page does not scroll from a finger on the knob. Travel is
 * `TRAVEL_PX` for the whole range. The value follows the finger on the UI thread
 * and is reported quantised to `step`; the caller commits it on release.
 *
 * Haptics (haptics.ts), owned here so no caller fires its own:
 *   grab   the finger lands on the knob
 *   tick   a `detent` crossed under the moving finger
 *   light  arriving at `rest` mid-drag (the detent you feel apart), and the lift
 * Reaching an end stop is silent: the pointer simply stops.
 */
export type KnobProps = {
  value: number;
  minimumValue: number;
  maximumValue: number;
  /** Quantum of the reported value. */
  step?: number;
  /** Value travel between haptic ticks. Omit for no ticks. */
  detent?: number;
  /** The value the pointer rests at (the long tick, the fill's origin). */
  rest?: number;
  /** Disc diameter in pt; the tick arc adds to it. */
  size?: number;
  onValueChange?: (value: number) => void;
  onGrab?: () => void;
  onRelease: (value: number) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

/** Finger travel, in pt, that turns the knob end to end. */
const TRAVEL_PX = 150;
/** The arc's sweep either side of the rest position, in degrees. */
const SWEEP_DEG = 135;
const TICK_COUNT = 9;

const AnimatedPath = Animated.createAnimatedComponent(Path);

function quantise(value: number, step: number) {
  "worklet";
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, fromDeg: number, toDeg: number) {
  "worklet";
  const a0 = ((fromDeg - 90) * Math.PI) / 180;
  const a1 = ((toDeg - 90) * Math.PI) / 180;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  const sweep = toDeg > fromDeg ? 1 : 0;
  return `M${x0} ${y0} A${r} ${r} 0 ${large} ${sweep} ${x1} ${y1}`;
}

export function Knob({
  value,
  minimumValue,
  maximumValue,
  step = 1,
  detent,
  rest = 0,
  size = 76,
  onValueChange,
  onGrab,
  onRelease,
  disabled = false,
  style,
  accessibilityLabel,
  testID,
}: KnobProps) {
  const range = Math.max(1e-9, maximumValue - minimumValue);
  const box = size + 16;
  const c = box / 2;
  const arcR = size / 2 + 4;
  const discR = size / 2 - 8;
  const restDeg = ((rest - minimumValue) / range) * 2 * SWEEP_DEG - SWEEP_DEG;

  const dragging = useSharedValue(false);
  const dragValue = useSharedValue(value);
  const startValue = useSharedValue(value);
  const lastReported = useSharedValue(value);
  const lastDetent = useSharedValue(0);
  const wasAtRest = useSharedValue(value === rest);

  // Between drags the pointer is where the prop says; during one, under the finger.
  const shown = useDerivedValue(() => (dragging.value ? dragValue.value : value));
  const angle = useDerivedValue(
    () => ((shown.value - minimumValue) / range) * 2 * SWEEP_DEG - SWEEP_DEG
  );

  const report = useCallback((next: number) => onValueChange?.(next), [onValueChange]);
  const grab = useCallback(() => {
    // Haptics: `grab` — the finger has picked the knob up.
    haptic.grab();
    onGrab?.();
  }, [onGrab]);
  const release = useCallback(
    (next: number) => {
      // Haptics: `light` — the value is set; a small state flip, not a press.
      haptic.light();
      onRelease(next);
    },
    [onRelease]
  );
  const tick = useCallback(() => {
    // Haptics: `tick` — a detent crossed under the moving finger.
    haptic.tick();
  }, []);
  const land = useCallback(() => {
    // Haptics: `light` — the pointer has come to rest; felt apart from the stops.
    haptic.light();
  }, []);

  const gesture = useMemo(() => {
    const valueAt = (dy: number) => {
      "worklet";
      const raw = startValue.value - (dy / TRAVEL_PX) * range;
      return Math.max(minimumValue, Math.min(maximumValue, quantise(raw, step)));
    };
    const track = (dy: number) => {
      "worklet";
      const next = valueAt(dy);
      dragValue.value = next;
      if (next === lastReported.value) return;
      lastReported.value = next;
      runOnJS(report)(next);
      const atRest = next === rest;
      if (atRest && !wasAtRest.value) {
        wasAtRest.value = true;
        runOnJS(land)();
        if (detent && detent > 0) lastDetent.value = Math.floor(next / detent);
        return;
      }
      wasAtRest.value = atRest;
      if (detent && detent > 0) {
        const d = Math.floor(next / detent);
        if (d !== lastDetent.value) {
          lastDetent.value = d;
          runOnJS(tick)();
        }
      }
    };
    // Activates on touch: a finger on the knob means the knob, never the page.
    return Gesture.Pan()
      .enabled(!disabled)
      .maxPointers(1)
      .shouldCancelWhenOutside(false)
      .manualActivation(true)
      .onTouchesDown((_e, state) => {
        "worklet";
        state.activate();
      })
      .onStart(() => {
        "worklet";
        dragging.value = true;
        startValue.value = value;
        dragValue.value = value;
        lastReported.value = value;
        lastDetent.value = detent && detent > 0 ? Math.floor(value / detent) : 0;
        wasAtRest.value = value === rest;
        runOnJS(grab)();
      })
      .onUpdate((e) => {
        "worklet";
        if (!dragging.value) return;
        track(e.translationY);
      })
      .onEnd((e, success) => {
        "worklet";
        if (!dragging.value) return;
        if (success) track(e.translationY);
        dragging.value = false;
        runOnJS(release)(lastReported.value);
      })
      .onFinalize(() => {
        "worklet";
        if (!dragging.value) return;
        dragging.value = false;
        runOnJS(release)(lastReported.value);
      });
  }, [
    detent,
    disabled,
    dragValue,
    dragging,
    grab,
    land,
    lastDetent,
    lastReported,
    maximumValue,
    minimumValue,
    range,
    release,
    report,
    rest,
    startValue,
    step,
    tick,
    value,
    wasAtRest,
  ]);

  const fillProps = useAnimatedProps(() => {
    const a = angle.value;
    if (Math.abs(a - restDeg) < 0.01) return { d: "M0 0" };
    return { d: arcPath(c, c, arcR, restDeg, a) };
  });
  const pointerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value}deg` }],
  }));
  const discStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(dragging.value ? 1.04 : 1, springs.handle) }],
    borderColor: withTiming(dragging.value ? colors.primary : colors.borderSubtle, {
      duration: durations.fast,
    }),
  }));

  const ticks = useMemo(
    () =>
      Array.from({ length: TICK_COUNT }, (_, i) => {
        const deg = -SWEEP_DEG + (i * 2 * SWEEP_DEG) / (TICK_COUNT - 1);
        const isRest = Math.abs(deg - restDeg) < 0.01;
        const inner = polar(c, c, isRest ? arcR - 8 : arcR - 6, deg);
        const outer = polar(c, c, arcR - 1, deg);
        return { key: i, inner, outer, isRest };
      }),
    [arcR, c, restDeg]
  );

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[{ width: box, height: box }, disabled ? s.disabled : null, style]}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min: minimumValue, max: maximumValue, now: value }}
        accessibilityState={{ disabled }}
        testID={testID}
      >
        <Svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} pointerEvents="none">
          <Path
            d={arcPath(c, c, arcR, -SWEEP_DEG, SWEEP_DEG)}
            stroke={colors.borderMuted}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
          <AnimatedPath
            animatedProps={fillProps}
            stroke={colors.primary}
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
          />
          {ticks.map((t) => (
            <Line
              key={t.key}
              x1={t.inner.x}
              y1={t.inner.y}
              x2={t.outer.x}
              y2={t.outer.y}
              stroke={t.isRest ? colors.textMuted : colors.borderMuted}
              strokeWidth={1.2}
            />
          ))}
          <Circle cx={c} cy={c} r={discR} fill={colors.surface} />
        </Svg>
        {/* The disc's edge and the pointer are views, so they can animate without
            re-rendering the SVG. */}
        <Animated.View
          pointerEvents="none"
          style={[
            s.disc,
            { left: c - discR, top: c - discR, width: discR * 2, height: discR * 2, borderRadius: discR },
            discStyle,
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[s.pointerArm, { left: c - 1.5, top: c - discR, height: discR }, pointerStyle]}
        >
          <View style={s.pointer} />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const s = StyleSheet.create({
  disabled: {
    opacity: 0.4,
  },
  disc: {
    position: "absolute",
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.control,
  },
  // Rotates about the disc's centre: its origin is the bottom of the arm.
  pointerArm: {
    position: "absolute",
    width: 3,
    transformOrigin: "50% 100%",
    alignItems: "center",
  },
  pointer: {
    position: "absolute",
    top: 4,
    width: 3,
    height: 12,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
});
