import React, { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { colors, radii } from "../../../design/tokens";
import { getGroupGapIndices } from "../../../domain/metronome";

/**
 * The visual metronome: one dot per pulse in the bar, the live pulse filled and
 * pulsing. Shared by the standalone Metronome page (hero variant) and the
 * recording flow (compact variant) so "where the beat is" reads the same
 * everywhere.
 *
 * Weight comes from the GROUPING, not from a hardcoded "beat 1 is big": each
 * dot is sized by its accent — downbeat, secondary, or weak — and a gap opens
 * between groups only when chunking helps you count (some group of three or
 * more). So 5/4 reads 2 + 3 or 3 + 2 depending on how the song is felt, 6/8
 * reads 3 + 3, and 4/4 stays one even run.
 *
 * Driven by the same onBeat stream as the audio click (`pulseToken` increments
 * per beat; `currentBeat` is 1-based within the bar), so the flash can't drift
 * from the sound.
 */

const MAX_BEATS = 12;

type Accent = "downbeat" | "secondary" | "weak";

function accentOf(weight: number | undefined): Accent {
  if (weight == null) return "weak";
  if (weight >= 0.95) return "downbeat";
  if (weight >= 0.65) return "secondary";
  return "weak";
}

type Props = {
  /** Pulses per bar from the meter preset (3/4 → 3, 6/8 → 6 …). */
  beatsPerBar: number;
  /** Per-pulse click weights — the same array the engine runs on, so the dots
   *  can't disagree with what you hear. Falls back to "only pulse 1 accented". */
  accentPattern?: readonly number[];
  /** Pulse counts per group, e.g. [2, 3]. Drives where the row opens a gap. */
  grouping?: readonly number[];
  /** 1-based beat position within the bar. */
  currentBeat: number;
  /** Increments on every beat event — triggers the pulse animation. */
  pulseToken: number;
  /** Whether the metronome is actually beating (running + visual cue on). */
  active: boolean;
  variant?: "hero" | "compact";
};

export function MetronomeBeatBar({
  beatsPerBar,
  accentPattern,
  grouping,
  currentBeat,
  pulseToken,
  active,
  variant = "hero",
}: Props) {
  const hero = variant === "hero";
  const gapIndices = useMemo(
    () => new Set(grouping ? getGroupGapIndices(grouping) : []),
    [grouping]
  );
  const dotAnims = useRef(
    Array.from({ length: MAX_BEATS }, () => new Animated.Value(0))
  ).current;
  const beats = useMemo(
    () => Array.from({ length: Math.min(MAX_BEATS, Math.max(1, beatsPerBar)) }, (_, i) => i + 1),
    [beatsPerBar]
  );

  useEffect(() => {
    if (!active || pulseToken === 0) return;
    const anim = dotAnims[currentBeat - 1];
    if (!anim) return;
    anim.stopAnimation();
    anim.setValue(1);
    Animated.timing(anim, { toValue: 0, duration: 320, useNativeDriver: true }).start();
  }, [active, currentBeat, dotAnims, pulseToken]);

  useEffect(() => {
    if (active) return;
    dotAnims.forEach((anim) => {
      anim.stopAnimation();
      anim.setValue(0);
    });
  }, [active, dotAnims]);

  return (
    <View style={[s.row, hero ? s.rowHero : s.rowCompact]}>
      {beats.map((beat) => {
        const accent = accentPattern ? accentOf(accentPattern[beat - 1]) : beat === 1 ? "downbeat" : "weak";
        const isDownbeat = accent === "downbeat";
        const isAccented = accent !== "weak";
        const isCurrent = active && beat === currentBeat;
        const anim = dotAnims[beat - 1];
        const base = hero
          ? accent === "downbeat" ? 18 : accent === "secondary" ? 15 : 12
          : accent === "downbeat" ? 12 : accent === "secondary" ? 10 : 8;
        return (
          <View
            key={beat}
            style={[
              s.dotSlot,
              { width: base + (hero ? 10 : 6) },
              gapIndices.has(beat - 1) ? (hero ? s.groupGapHero : s.groupGap) : null,
            ]}
          >
            {/* Pulse ring — flares out from the dot on its beat */}
            <Animated.View
              pointerEvents="none"
              style={[
                s.ring,
                {
                  width: base,
                  height: base,
                  borderRadius: radii.round,
                  backgroundColor: isDownbeat ? colors.primaryDeep : colors.primary,
                  opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }),
                  transform: [
                    { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, hero ? 2.6 : 2.2] }) },
                  ],
                },
              ]}
            />
            {/* The dot itself — filled while it's the live beat */}
            <Animated.View
              style={[
                {
                  width: base,
                  height: base,
                  borderRadius: radii.round,
                  backgroundColor: isCurrent
                    ? isAccented
                      ? colors.primaryDeep
                      : colors.primary
                    : colors.borderSubtle,
                  transform: [
                    { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, hero ? 1.35 : 1.3] }) },
                  ],
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    // Beats progress downbeat→last, left→right — a temporal reading that stays
    // fixed even under a Hebrew UI, so the bar isn't mirrored.
    direction: "ltr",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  rowHero: {
    gap: 6,
    minHeight: 26,
  },
  rowCompact: {
    gap: 4,
    minHeight: 16,
  },
  dotSlot: {
    alignItems: "center",
    justifyContent: "center",
  },
  // Physical margins: the row is pinned LTR above, so the gap must not mirror.
  groupGap: {
    marginLeft: 9,
  },
  groupGapHero: {
    marginLeft: 13,
  },
  ring: {
    position: "absolute",
  },
});
