import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, type ViewStyle } from "react-native";

type Props = {
  /** Monotonic per-beat counter from the metronome engine (drives one flash per beat). */
  beatToken: number;
  /** True on the first beat of the bar (the accented click). */
  isDownbeat: boolean;
  /** Whether the metronome is currently sounding (count-in or running). */
  active: boolean;
  style?: ViewStyle;
  children: React.ReactNode;
};

/**
 * Flashes a warm band behind its children on each metronome beat — brighter on the bar's
 * downbeat, mirroring the accented click. Used to give the count-in an obvious on-screen cue.
 */
export function RecordingBeatPulse({ beatToken, isDownbeat, active, style, children }: Props) {
  const flash = useRef(new Animated.Value(0)).current;
  const isDownbeatRef = useRef(isDownbeat);
  isDownbeatRef.current = isDownbeat;

  useEffect(() => {
    if (!active || beatToken === 0) {
      return;
    }
    const peak = isDownbeatRef.current ? 1 : 0.45;
    flash.stopAnimation();
    Animated.sequence([
      Animated.timing(flash, { toValue: peak, duration: 55, useNativeDriver: false }),
      Animated.timing(flash, { toValue: 0, duration: 240, useNativeDriver: false }),
    ]).start();
  }, [beatToken, active, flash]);

  useEffect(() => {
    if (!active) {
      flash.stopAnimation();
      flash.setValue(0);
    }
  }, [active, flash]);

  const backgroundColor = flash.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(184,125,107,0)", "rgba(184,125,107,0.30)"],
  });

  return (
    <Animated.View style={[localStyles.band, { backgroundColor }, style]}>{children}</Animated.View>
  );
}

const localStyles = StyleSheet.create({
  band: {
    borderRadius: 12,
    paddingVertical: 6,
  },
});
