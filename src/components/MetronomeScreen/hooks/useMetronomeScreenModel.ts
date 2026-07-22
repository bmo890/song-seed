import { Animated } from "react-native";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useMetronome } from "../../../hooks/useMetronome";
import { useBrowseRootBackHandler } from "../../../hooks/useBrowseRootBackHandler";

export function useMetronomeScreenModel() {
  useBrowseRootBackHandler();
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const metronome = useMetronome();

  // Leaving the page ends the session. The native metronome engine runs on its
  // own thread and keeps ticking after this screen unmounts, so nothing stops
  // the click unless we do it here — otherwise it plays on in the background
  // with no way to stop it but to navigate back in and hit Stop. Refs keep the
  // blur cleanup stable so an unrelated re-render can't tear down a live session.
  const isActiveRef = useRef(false);
  isActiveRef.current =
    metronome.isRunning || metronome.isCountIn || metronome.isPreparing;
  const stopRef = useRef(metronome.stop);
  stopRef.current = metronome.stop;

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (isActiveRef.current) {
          void stopRef.current();
        }
      };
    }, [])
  );

  const activeOutputCount = useMemo(
    () => Object.values(metronome.outputs).filter(Boolean).length,
    [metronome.outputs]
  );
  // Deliberately loud: the halo is the page's visual beat, so it flashes at
  // 0.55 opacity and grows well past the core instead of a faint shimmer.
  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1.35],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.55],
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
