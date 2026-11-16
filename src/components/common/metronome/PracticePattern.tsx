import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import { Stepper } from "../Stepper";
import { InkKey, inkKeyColor } from "../InkKey";
import { SegmentedControl } from "../SegmentedControl";
import { colors, radii, spacing } from "../../../design/tokens";
import type { MetronomeSubdivision } from "../../../domain/metronome";
import {
  MAX_PRACTICE_BARS,
  beatTier,
  practiceSubdivisions,
  subTier,
  withAllSilent,
  withAllSounding,
  withBarAdded,
  withBarRemoved,
  withBarRestToggled,
  withBeatCycled,
  withSubCycled,
  withSubdivision,
  type MetronomePractice,
  type PracticeBar,
} from "../../../domain/metronomePractice";

const SUBDIVISION_LABEL_KEYS: Record<MetronomeSubdivision, string> = {
  1: "metronome.feel.beats",
  2: "metronome.feel.eighths",
  3: "metronome.feel.triplets",
  4: "metronome.feel.sixteenths",
};

/**
 * The metronome page's practice pattern (founder, 2026-11-16, mockup v6): one row per bar,
 * at most four. In a row every beat and every sub-beat is its own switch — a beat cycles
 * accent → click → silent, a sub-beat sound → accent → silent — and the bar's number rests
 * the whole bar (a whole-rest sign; tapping again brings back what it held). The
 * subdivision is chosen right here as ink tabs. Sound all / Silence all are two fixed keys,
 * never one key that flips meaning.
 */
export type PracticePulse = { token: number; bar: number; beat: number; stepMs: number };

/** One pattern dot at rest, for the help sheet: the sheet shows the mark it explains. */
export function PracticeDotMark({ tier }: { tier: "accent" | "click" | "rest" }) {
  return <View style={[s.dot, tier === "accent" ? s.dotAccent : tier === "click" ? s.dotClick : s.dotRest]} />;
}

/** A bar's number as the row draws it, for the help sheet. */
export function PracticeBarNumberMark() {
  return <Text style={s.numberText}>1</Text>;
}

export function PracticePattern({
  practice,
  baseBeats,
  currentBar,
  currentBeat,
  pulse,
  onChange,
}: {
  practice: MetronomePractice;
  /** The feel's own accents: what Sound all brings back. */
  baseBeats: readonly number[];
  /** 0-based bar and beat being heard, or null when stopped. */
  currentBar: number | null;
  currentBeat: number | null;
  /** The beat that just sounded (anchor-timed, with the visual cue on): its sounding dot
   *  and ticks swell in turn, each on its own step. Null when stopped. */
  pulse?: PracticePulse | null;
  onChange: (next: MetronomePractice) => void;
}) {
  const { t } = useTranslation();
  const subdivisions = practiceSubdivisions(practice.meterId);
  const barCount = practice.bars.length;

  return (
    <View style={s.wrap}>
      {subdivisions.length > 1 ? (
        <SegmentedControl
          options={subdivisions.map((sub) => ({ key: String(sub), label: t(SUBDIVISION_LABEL_KEYS[sub]) }))}
          value={String(practice.subdivision)}
          onChange={(key) => onChange(withSubdivision(practice, Number(key) as MetronomeSubdivision))}
        />
      ) : null}

      <View style={s.rows}>
        {practice.bars.map((bar, barIndex) => (
          <BarRow
            key={barIndex}
            bar={bar}
            barIndex={barIndex}
            subdivision={practice.subdivision}
            current={currentBar === barIndex}
            currentBeat={currentBar === barIndex ? currentBeat : null}
            pulse={pulse && pulse.bar === barIndex ? pulse : null}
            onToggleRest={() => onChange(withBarRestToggled(practice, barIndex))}
            onTapBeat={(pulse) => onChange(withBeatCycled(practice, barIndex, pulse))}
            onTapSub={(pulse, position) => onChange(withSubCycled(practice, barIndex, pulse, position))}
          />
        ))}
      </View>

      {/* One line under the rows: the bar count (a new bar appears just above it), then
          Sound all / Silence all, two fixed keys. Wraps on a narrow phone. */}
      <View style={s.foot}>
        <Stepper
          glyphs="plusMinus"
          onStep={(direction) => onChange(direction > 0 ? withBarAdded(practice) : withBarRemoved(practice))}
          canDecrement={barCount > 1}
          canIncrement={barCount < MAX_PRACTICE_BARS}
          decrementLabel={t("metronome.practice.removeBar")}
          incrementLabel={t("metronome.practice.addBar")}
        >
          <Text style={s.barCount}>{t("metronome.practice.bars", { count: barCount })}</Text>
        </Stepper>
        <View style={s.footKeys}>
          <InkKey
            glyph={<Ionicons name="volume-medium-outline" size={17} color={inkKeyColor("idle")} />}
            label={t("metronome.practice.soundAll")}
            onPress={() => onChange(withAllSounding(practice, baseBeats))}
          />
          <InkKey
            glyph={<Ionicons name="volume-mute-outline" size={17} color={inkKeyColor("idle")} />}
            label={t("metronome.practice.silenceAll")}
            onPress={() => onChange(withAllSilent(practice))}
          />
        </View>
      </View>
    </View>
  );
}

function BarRow({
  bar,
  barIndex,
  subdivision,
  current,
  currentBeat,
  pulse: stepPulse,
  onToggleRest,
  onTapBeat,
  onTapSub,
}: {
  bar: PracticeBar;
  barIndex: number;
  subdivision: MetronomeSubdivision;
  current: boolean;
  currentBeat: number | null;
  pulse: PracticePulse | null;
  onToggleRest: () => void;
  onTapBeat: (pulse: number) => void;
  onTapSub: (pulse: number, position: number) => void;
}) {
  const { t } = useTranslation();
  const number = barIndex + 1;
  // One clock per beat: 0 → subdivision across the beat, so step i swells as the clock
  // passes i. Beat time, not a motion token: the swell IS the tempo.
  const stepClock = useRef(new Animated.Value(subdivision)).current;
  useEffect(() => {
    if (!stepPulse) return;
    stepClock.stopAnimation();
    stepClock.setValue(0);
    Animated.timing(stepClock, {
      toValue: subdivision,
      duration: stepPulse.stepMs * subdivision,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
    // The token is the beat; bar, beat and step length change with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepPulse?.token]);
  const swell = (step: number) => ({
    transform: [
      {
        scale: stepClock.interpolate({
          inputRange: [step - 0.001, step, step + 0.7],
          outputRange: [1, SWELL, 1],
          extrapolate: "clamp",
        }),
      },
    ],
  });
  return (
    <View style={[s.row, current ? s.rowCurrent : null]}>
      <Press
        feel="glyph"
        // Haptics vocabulary: `tap` — a control changed value.
        haptic="tap"
        style={s.number}
        onPress={onToggleRest}
        accessibilityRole="button"
        accessibilityLabel={t(bar.rest ? "metronome.practice.barRests" : "metronome.practice.barPlays", { number })}
      >
        <Text style={[s.numberText, bar.rest ? s.numberResting : null]}>{number}</Text>
      </Press>
      {bar.rest ? (
        // A whole rest: the musician's own sign for a silent bar.
        <View style={s.restWrap} pointerEvents="none">
          <View style={s.restLine} />
          <View style={s.restBlock} />
        </View>
      ) : (
        <View style={s.cells}>
          <View style={s.staff} pointerEvents="none" />
          {bar.beats.map((weight, pulse) => {
            const tier = beatTier(weight);
            const now = currentBeat === pulse && tier !== "rest";
            // Only the beat that just sounded swells, and only what it sounds.
            const swelling = stepPulse?.beat === pulse;
            return (
              <View key={pulse} style={s.cell}>
                <Press
                  feel="glyph"
                  haptic="tap"
                  style={s.beatHit}
                  onPress={() => onTapBeat(pulse)}
                  accessibilityRole="button"
                  accessibilityLabel={t("metronome.practice.beat", {
                    bar: number,
                    number: pulse + 1,
                    state: t(`metronome.pulse.${tier}`),
                  })}
                >
                  {now ? <View style={s.halo} /> : null}
                  <Animated.View
                    style={[
                      s.dot,
                      tier === "accent" ? s.dotAccent : tier === "click" ? s.dotClick : s.dotRest,
                      swelling && tier !== "rest" ? swell(0) : null,
                    ]}
                  />
                </Press>
                {Array.from({ length: subdivision - 1 }, (_, index) => {
                  const position = index + 1;
                  const subWeight = bar.subs[pulse]?.[index] ?? 0;
                  const state = subTier(subWeight);
                  return (
                    <Press
                      key={position}
                      feel="glyph"
                      haptic="tap"
                      style={s.subHit}
                      onPress={() => onTapSub(pulse, position)}
                      accessibilityRole="button"
                      accessibilityLabel={t("metronome.practice.sub", {
                        beat: pulse + 1,
                        number: position,
                        state: t(
                          state === "accent"
                            ? "metronome.practice.subAccent"
                            : state === "on"
                              ? "metronome.practice.subOn"
                              : "metronome.practice.subOff"
                        ),
                      })}
                    >
                      <Animated.View
                        style={[
                          s.tick,
                          state === "accent" ? s.tickAccent : state === "off" ? s.tickOff : null,
                          swelling && state !== "off" ? swell(position) : null,
                        ]}
                      />
                    </Press>
                  );
                })}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const ROW_HEIGHT = 44;
/** How far a sounding step swells as it plays: felt, not a pop. */
const SWELL = 1.38;

const s = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  barCount: {
    minWidth: 52,
    textAlign: "center",
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    color: colors.textStrong,
    fontVariant: ["tabular-nums"],
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
  numberResting: {
    color: colors.textMuted,
    textDecorationLine: "line-through",
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
    flexDirection: "row",
    alignItems: "center",
    height: ROW_HEIGHT,
  },
  // Every step, beat or sub-beat, takes an equal slot with its mark in the middle, so
  // the bar sits centred in its row at any subdivision (founder, 2026-11-16).
  beatHit: {
    flex: 1,
    height: ROW_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: radii.round,
    backgroundColor: colors.primarySurface,
  },
  dot: {
    borderRadius: radii.round,
    backgroundColor: colors.page,
  },
  // Three dots, three loudnesses (founder, 2026-11-16: "slightly better"): an accent is
  // the big terracotta dot, a click a smaller ink dot, a silent beat an empty ring the
  // click's size, so the slot still reads as a beat you can bring back.
  dotAccent: {
    width: 18,
    height: 18,
    backgroundColor: colors.primaryDeep,
  },
  dotClick: {
    width: 11,
    height: 11,
    backgroundColor: colors.textStrong,
  },
  dotRest: {
    width: 11,
    height: 11,
    borderWidth: 1.5,
    borderColor: colors.borderMuted,
  },
  subHit: {
    flex: 1,
    height: ROW_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  // Sub-beats follow the dots: ink when they sound, terracotta and taller when accented,
  // a faint stub when silent.
  tick: {
    width: 3,
    height: 11,
    borderRadius: 2,
    backgroundColor: colors.textSecondary,
  },
  tickAccent: {
    width: 3.5,
    height: 18,
    backgroundColor: colors.primaryDeep,
  },
  tickOff: {
    height: 4,
    backgroundColor: colors.borderMuted,
  },
  restWrap: {
    flex: 1,
    height: ROW_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  restLine: {
    width: 24,
    height: 1.5,
    backgroundColor: colors.textSecondary,
  },
  restBlock: {
    width: 12,
    height: 6,
    backgroundColor: colors.textSecondary,
  },
  foot: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    rowGap: spacing.xs,
  },
  footKeys: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
});
