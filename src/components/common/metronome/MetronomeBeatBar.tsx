import React, { useEffect, useMemo, useRef, useState } from "react";
import { durations } from "../../../design/motion";
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent } from "react-native";
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
// Hero sizing (2026-11-16, founder: "more pronounced", read from a music stand): every
// beat gets an equal slot sized to the row's width, so 4/4 is big and 12/8 still fits.
const HERO_SLOT_MAX = 54;
const HERO_SLOT_MIN = 26;
/** Width the hero assumes before its first layout (a narrow phone, so it never overflows). */
const HERO_FALLBACK_WIDTH = 343;
/** A group gap in slots: chunking reads, the row stays inside the phone. */
const HERO_GROUP_GAP = 0.3;

function heroSizes(width: number, beats: number, groupGaps: number) {
  const slot = Math.max(
    HERO_SLOT_MIN,
    Math.min(HERO_SLOT_MAX, Math.floor(width / (beats + groupGaps * HERO_GROUP_GAP)))
  );
  const weak = Math.min(22, Math.round(slot * 0.42));
  return {
    slot,
    groupGap: Math.round(slot * HERO_GROUP_GAP),
    weak,
    secondary: Math.round(weak * 1.18),
    downbeat: Math.round(weak * 1.36),
  };
}
/** Above this many pulses the row switches to its dense sizing. */
const DENSE_FROM_BEATS = 8;

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
  /** 1-based beat the latest pulseToken stands for, when the caller knows it (the
   *  anchor-timed visual pulse). Both the flash and the fill follow it, so a pulse never
   *  lights the beat before alongside its own (2026-11-16). */
  pulseBeat?: number;
  /** Whether the metronome is actually beating (running + visual cue on). */
  active: boolean;
  /** Hero only: one beat in ms. With it, a glide under the dots travels to the next
   *  beat through the second half of each beat and lands as it sounds, so the eye can
   *  see the beat coming, the way it follows a pendulum (2026-11-16). */
  beatMs?: number;
  variant?: "hero" | "compact";
};

export function MetronomeBeatBar({
  beatsPerBar,
  accentPattern,
  grouping,
  currentBeat,
  pulseToken,
  pulseBeat,
  active,
  beatMs,
  variant = "hero",
}: Props) {
  const liveBeat = pulseBeat ?? currentBeat;
  // A rest (weight 0) neither flashes nor fills: a silent beat stays silent to the eye.
  const isSilentBeat = (beat: number) => accentPattern != null && (accentPattern[beat - 1] ?? 1) <= 0;
  const hero = variant === "hero";
  // Nine or twelve pulses need smaller dots to fit a phone's width — the tiers keep
  // their ratio, the row just tightens.
  const dense = beatsPerBar > DENSE_FROM_BEATS;
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
  // Native-driven interpolations, built once per variant: a fresh `interpolate`
  // per dot per render detached and re-attached native animated nodes on every
  // recorder render (about 12 nodes × 10+ renders a second during a take).
  const [rowWidth, setRowWidth] = useState(HERO_FALLBACK_WIDTH);
  const onHeroLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== rowWidth) setRowWidth(next);
  };
  const sizes = heroSizes(rowWidth, beats.length, gapIndices.size);
  /** Centre of a beat's slot from the row's left edge (the row is pinned LTR). */
  const slotCentre = (beat: number) => {
    let gaps = 0;
    gapIndices.forEach((index) => {
      if (index < beat) gaps += 1;
    });
    return (beat - 1) * sizes.slot + sizes.slot / 2 + gaps * sizes.groupGap;
  };
  const glideX = useRef(new Animated.Value(sizes.slot / 2)).current;
  const dotStyles = useMemo(
    () =>
      dotAnims.map((anim) => ({
        ringOpacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }),
        ringScale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, hero ? 1.9 : 2.2] }),
        dotScale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, hero ? 1.35 : 1.3] }),
      })),
    [dotAnims, hero]
  );

  useEffect(() => {
    if (!active || pulseToken === 0) return;
    const anim = dotAnims[liveBeat - 1];
    if (!anim || isSilentBeat(liveBeat)) return;
    anim.stopAnimation();
    anim.setValue(1);
    Animated.timing(anim, { toValue: 0, duration: durations.slow, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isSilentBeat reads accentPattern
  }, [active, liveBeat, dotAnims, pulseToken]);

  // The glide: from this beat to the next sounding one (it waits under a beat whose
  // successor is silent). Beat time, not a motion token: the glide IS the tempo.
  useEffect(() => {
    if (!hero || !active || pulseToken === 0 || !beatMs) return;
    const next = (liveBeat % beats.length) + 1;
    const from = slotCentre(liveBeat);
    const to = isSilentBeat(next) ? from : slotCentre(next);
    glideX.stopAnimation();
    glideX.setValue(from);
    Animated.timing(glideX, {
      toValue: to,
      delay: beatMs * 0.5,
      duration: beatMs * 0.45,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the token is the beat
  }, [active, pulseToken]);

  useEffect(() => {
    if (active) return;
    dotAnims.forEach((anim) => {
      anim.stopAnimation();
      anim.setValue(0);
    });
  }, [active, dotAnims]);

  const row = (
    <View style={[s.row, hero ? s.rowHero : s.rowCompact, !hero && dense ? s.rowCompactDense : null]}>
      {beats.map((beat) => {
        const accent = accentPattern ? accentOf(accentPattern[beat - 1]) : beat === 1 ? "downbeat" : "weak";
        const isDownbeat = accent === "downbeat";
        const isAccented = accent !== "weak";
        const isCurrent = active && beat === liveBeat && !isSilentBeat(beat);
        const dotStyle = dotStyles[beat - 1]!;
        const base = hero
          ? accent === "downbeat" ? sizes.downbeat : accent === "secondary" ? sizes.secondary : sizes.weak
          : dense
            ? accent === "downbeat" ? 9 : accent === "secondary" ? 8 : 6
            : accent === "downbeat" ? 12 : accent === "secondary" ? 10 : 8;
        return (
          <View
            key={beat}
            style={[
              s.dotSlot,
              hero ? { width: sizes.slot, height: sizes.downbeat * 1.6 } : { width: base + (dense ? 4 : 6) },
              gapIndices.has(beat - 1) ? (hero ? { marginLeft: sizes.groupGap } : s.groupGap) : null,
            ]}
          >
            {/* Where the bar starts, marked even at rest: a thin ring round the one. */}
            {hero && isDownbeat ? (
              <View
                pointerEvents="none"
                style={[s.downbeatRing, { width: base + 10, height: base + 10, borderRadius: radii.round }]}
              />
            ) : null}
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
                  opacity: dotStyle.ringOpacity,
                  transform: [{ scale: dotStyle.ringScale }],
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
                  transform: [{ scale: dotStyle.dotScale }],
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );

  if (!hero) return row;
  return (
    <View style={s.heroWrap} onLayout={onHeroLayout}>
      <View>
        {row}
        {active && beatMs ? (
          <Animated.View
            pointerEvents="none"
            style={[
              s.glide,
              { width: Math.round(sizes.slot * 0.4), left: -Math.round(sizes.slot * 0.2) },
              { transform: [{ translateX: glideX }] },
            ]}
          />
        ) : null}
      </View>
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
    gap: 0,
  },
  // Full width so the hero can size its slots to the phone; the row centres inside.
  heroWrap: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingBottom: 10,
  },
  downbeatRing: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: colors.borderMuted,
  },
  glide: {
    position: "absolute",
    bottom: -8,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primaryDeep,
  },
  rowCompact: {
    gap: 4,
    minHeight: 16,
  },
  rowCompactDense: {
    gap: 3,
  },
  dotSlot: {
    alignItems: "center",
    justifyContent: "center",
  },
  // Physical margins: the row is pinned LTR above, so the gap must not mirror.
  groupGap: {
    marginLeft: 9,
  },
  ring: {
    position: "absolute",
  },
});
