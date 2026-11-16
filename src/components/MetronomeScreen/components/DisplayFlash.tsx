import { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";
import { colors } from "../../../design/tokens";
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
  height,
}: {
  active: boolean;
  pulseToken: number;
  /** 1-based beat the pulse stands for. */
  beat: number | undefined;
  accentPattern: readonly number[];
  /** From the top of the scroll content to the display's foot. */
  height: number;
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
    if (!active) {
      wash.stopAnimation();
      wash.setValue(0);
    }
  }, [active, wash]);
  if (height <= 0) return null;
  return <Animated.View pointerEvents="none" style={[s.wash, { height, opacity: wash }]} />;
}

const s = StyleSheet.create({
  // A first child of the scroll content: its padding box is the screen's full width.
  wash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.primary,
  },
});
