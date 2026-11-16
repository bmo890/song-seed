import { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";
import { colors, spacing } from "../../../design/tokens";
import { durations } from "../../../design/motion";

/** Peak wash on the one, and on the other sounding beats. */
const DOWNBEAT_PEAK = 0.3;
const BEAT_PEAK = 0.14;

/**
 * The opt-in screen flash (founder, 2026-11-16): the display area, title bar to the
 * practice pattern, washes terracotta on each sounding beat, stronger on the one, for a
 * stand across the room or a loud stage. It rides the same pulse as the dots (token +
 * beat), so it never lands a beat apart from them, and a silent beat never flashes.
 */
export function DisplayFlash({
  active,
  pulseToken,
  beat,
  accentPattern,
}: {
  active: boolean;
  pulseToken: number;
  /** 1-based beat the pulse stands for. */
  beat: number | undefined;
  accentPattern: readonly number[];
}) {
  const wash = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active || pulseToken === 0 || beat == null) return;
    const weight = accentPattern[beat - 1] ?? 1;
    if (weight <= 0) return;
    wash.stopAnimation();
    wash.setValue(beat === 1 || weight >= 0.95 ? DOWNBEAT_PEAK : BEAT_PEAK);
    Animated.timing(wash, { toValue: 0, duration: durations.slow, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the token is the beat
  }, [active, pulseToken]);
  useEffect(() => {
    if (!active) wash.setValue(0);
  }, [active, wash]);
  return <Animated.View pointerEvents="none" style={[s.wash, { opacity: wash }]} />;
}

const s = StyleSheet.create({
  // Edge to edge across the display: out through the page gutter and up to the title bar.
  wash: {
    position: "absolute",
    top: -spacing.md,
    bottom: 0,
    left: -spacing.lg,
    right: -spacing.lg,
    backgroundColor: colors.primary,
  },
});
