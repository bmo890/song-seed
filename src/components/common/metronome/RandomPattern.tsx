import { useEffect, useRef, type ReactNode } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { InkOption } from "../InkOption";
import { colors, radii, spacing } from "../../../design/tokens";
import { durations } from "../../../design/motion";
import { RANDOM_SILENCES, beatTier, type RandomSilence } from "../../../domain/metronomePractice";
import { PracticeDotMark, PracticeLine } from "./PracticePattern";

const SILENCE_LABEL_KEYS: Record<RandomSilence, string> = {
  few: "metronome.practice.silenceFew",
  some: "metronome.practice.silenceSome",
  many: "metronome.practice.silenceMany",
};

/**
 * Random (founder, 2026-11-17, mockup round two "C · Frost"): four bars of the feel with
 * beats silenced at random. Every beat ahead is the same soft blur, so the page gives
 * nothing away; each comes into focus as it plays, a dot if it sounded, a ring if it
 * did not. A new pass fogs over again with a new pattern. How much goes silent is one
 * line of ink options above the rows.
 */
export function RandomPattern({
  lead,
  bars,
  silence,
  onChangeSilence,
  currentBar,
  currentBeat,
}: {
  /** The mode tabs, at the start of the practice line. */
  lead: ReactNode;
  /** Each bar's beat weights as this pass plays them (0 = silent). */
  bars: readonly (readonly number[])[];
  silence: RandomSilence;
  onChangeSilence: (next: RandomSilence) => void;
  /** 0-based bar and beat being heard, or null when stopped. */
  currentBar: number | null;
  currentBeat: number | null;
}) {
  const { t } = useTranslation();
  return (
    <View style={s.wrap}>
      <PracticeLine lead={lead}>
        <View style={s.silenceLine}>
        <Text style={s.silenceLabel}>{t("metronome.practice.silence")}</Text>
        {RANDOM_SILENCES.map((amount) => (
          <InkOption
            key={amount}
            label={t(SILENCE_LABEL_KEYS[amount])}
            selected={silence === amount}
            onPress={() => onChangeSilence(amount)}
            accessibilityLabel={t("metronome.practice.silenceA11y", { amount: t(SILENCE_LABEL_KEYS[amount]) })}
          />
        ))}
        </View>
      </PracticeLine>
      <View style={s.rows}>
        {bars.map((beats, barIndex) => (
          <View
            key={barIndex}
            style={[s.row, currentBar === barIndex ? s.rowCurrent : null]}
            accessible
            accessibilityLabel={t("metronome.practice.barLabel", { number: barIndex + 1 })}
          >
            <View style={s.number}>
              <Text style={s.numberText}>{barIndex + 1}</Text>
            </View>
            <View style={s.cells}>
              <View style={s.staff} pointerEvents="none" />
              {beats.map((weight, pulse) => {
                const heard =
                  currentBar != null &&
                  currentBeat != null &&
                  (barIndex < currentBar || (barIndex === currentBar && pulse <= currentBeat));
                return (
                  <View key={pulse} style={s.cell}>
                    {heard ? <FocusIn><PracticeDotMark tier={beatTier(weight)} /></FocusIn> : <Fog />}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/** "Your pattern" as a mark: a little score of an accent, a click and a rest. */
export function PatternModeGlyph({ color }: { color: string }) {
  return (
    <View style={s.modeGlyph}>
      <View style={[s.modeAccent, { backgroundColor: color }]} />
      <View style={[s.modeClick, { backgroundColor: color }]} />
      <View style={[s.modeRest, { borderColor: color }]} />
    </View>
  );
}

/** A beat not yet heard: the same soft blur for every beat, three tonal rings. */
export function Fog() {
  return (
    <View style={s.fog} pointerEvents="none">
      <View style={[s.fogRing, s.fogOuter]} />
      <View style={[s.fogRing, s.fogMiddle]} />
      <View style={[s.fogRing, s.fogInner]} />
    </View>
  );
}

/** The heard beat comes into focus: a fade, nothing pops. */
function FocusIn({ children }: { children: ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: durations.fast, useNativeDriver: true }).start();
  }, [opacity]);
  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

const ROW_HEIGHT = 44;
const FOG = 20;

const s = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  silenceLine: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    columnGap: spacing.md,
  },
  silenceLabel: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    color: colors.textSecondary,
  },
  rows: {
    gap: 2,
  },
  // Music reads left to right in every language: the beats never mirror.
  row: {
    direction: "ltr",
    flexDirection: "row",
    alignItems: "center",
    height: ROW_HEIGHT,
    borderRadius: radii.lg,
    paddingEnd: spacing.xs,
  },
  rowCurrent: {
    backgroundColor: colors.primarySurface,
  },
  number: {
    width: 32,
    height: ROW_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  numberText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  cells: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: ROW_HEIGHT,
  },
  staff: {
    position: "absolute",
    left: 0,
    right: 0,
    top: ROW_HEIGHT / 2,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
  },
  cell: {
    flex: 1,
    height: ROW_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  modeGlyph: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 20,
  },
  modeAccent: {
    width: 7,
    height: 7,
    borderRadius: radii.round,
  },
  modeClick: {
    width: 4.5,
    height: 4.5,
    borderRadius: radii.round,
  },
  modeRest: {
    width: 5,
    height: 5,
    borderRadius: radii.round,
    borderWidth: 1.2,
  },
  fog: {
    width: FOG,
    height: FOG,
    alignItems: "center",
    justifyContent: "center",
  },
  fogRing: {
    position: "absolute",
    borderRadius: radii.round,
    backgroundColor: colors.borderMuted,
  },
  fogOuter: {
    width: FOG,
    height: FOG,
    opacity: 0.22,
  },
  fogMiddle: {
    width: 14,
    height: 14,
    opacity: 0.32,
  },
  fogInner: {
    width: 8,
    height: 8,
    opacity: 0.45,
  },
});
