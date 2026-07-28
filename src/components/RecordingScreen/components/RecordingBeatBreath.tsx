import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { colors } from "../../../design/tokens";

/**
 * The visual metronome: the page itself breathes. A soft vignette at the edge of
 * the screen swells on every pulse and swells deeper on the accents, so the beat
 * lands in peripheral vision — where you actually are while your hands are busy —
 * instead of asking you to look at a small flashing thing in the middle.
 *
 * It replaces the halo that used to flare behind the record button: that put the
 * beat inside a control, and it drew a second circle around the only circle this
 * page is allowed.
 *
 * Depth comes from the meter's accent pattern (the same array the click runs on),
 * so 4/4 breathes strong-weak-mid-weak, 6/8 accents pulse 4, and a custom 3+2
 * grouping moves the deep breath with it. Terracotta, never record-red: red on
 * this screen means one thing, and it is "you are recording".
 *
 * Deliberate exception to the motion vocabulary (fade / ≤6px slide, nothing
 * pops) — the same carve-out the beat engine has for calling expo-haptics
 * directly. A metronome that obeys a calm-motion rule is not a metronome.
 */

// Tuned on device: the gradient covers a lot of area, so numbers that look
// modest as opacities read as a full page wash. Keep the ceiling low and let the
// RATIO between tiers do the work — you should feel the downbeat, not see the
// page change colour.
const PEAK_DOWNBEAT = 0.4;
const PEAK_SECONDARY = 0.2;
const PEAK_WEAK = 0.085;

const ATTACK_MS = 45;
const DECAY_MS = 300;

function peakFor(weight: number | undefined): number {
  if (weight == null) return PEAK_WEAK;
  if (weight >= 0.95) return PEAK_DOWNBEAT;
  if (weight >= 0.65) return PEAK_SECONDARY;
  return PEAK_WEAK;
}

type Props = {
  /** Increments once per pulse — the same stream that drives the click. */
  beatToken: number;
  /** 1-based pulse within the bar. */
  beatInBar: number;
  accentPattern?: readonly number[];
  active: boolean;
};

export function RecordingBeatBreath({ beatToken, beatInBar, accentPattern, active }: Props) {
  const breath = useRef(new Animated.Value(0)).current;
  // Read through a ref so the once-created animation doesn't restart on every
  // beat-position change.
  const accentRef = useRef(accentPattern);
  accentRef.current = accentPattern;
  const beatRef = useRef(beatInBar);
  beatRef.current = beatInBar;

  useEffect(() => {
    if (!active || beatToken === 0) return;
    const peak = peakFor(accentRef.current?.[beatRef.current - 1]);
    breath.stopAnimation();
    Animated.sequence([
      Animated.timing(breath, { toValue: peak, duration: ATTACK_MS, useNativeDriver: true }),
      Animated.timing(breath, { toValue: 0, duration: DECAY_MS, useNativeDriver: true }),
    ]).start();
  }, [active, beatToken, breath]);

  useEffect(() => {
    if (active) return;
    breath.stopAnimation();
    breath.setValue(0);
  }, [active, breath]);

  if (!active) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: breath }]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          {/* Clear through the middle so nothing on the page is tinted — only the
              edges of the room move. */}
          <RadialGradient id="recordingBreath" cx="50%" cy="50%" rx="78%" ry="66%">
            <Stop offset="0.66" stopColor={colors.primary} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0.55} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#recordingBreath)" />
      </Svg>
    </Animated.View>
  );
}
