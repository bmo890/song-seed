import { Animated } from "react-native";
import { useEffect, useMemo, useRef } from "react";
import { useMetronome } from "../../../hooks/useMetronome";
import { useBrowseRootBackHandler } from "../../../hooks/useBrowseRootBackHandler";

export function useMetronomeScreenModel() {
  useBrowseRootBackHandler();
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const metronome = useMetronome();

  const activeOutputCount = useMemo(
    () => Object.values(metronome.outputs).filter(Boolean).length,
    [metronome.outputs]
  );
  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.18],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.26, 0],
  });

  useEffect(() => {
    if (
      !metronome.isRunning ||
      !metronome.outputs.visual ||
      metronome.pulseToken === 0
    ) {
      return;
    }

    pulseAnim.stopAnimation();
    pulseAnim.setValue(0);
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [metronome.isRunning, metronome.outputs.visual, metronome.pulseToken, pulseAnim]);

  return {
    ...metronome,
    activeOutputCount,
    pulseScale,
    pulseOpacity,
  };
}
