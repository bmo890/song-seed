import { StyleSheet, Text, View } from "react-native";
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
export function PracticePattern({
  practice,
  baseBeats,
  currentBar,
  currentBeat,
  onChange,
}: {
  practice: MetronomePractice;
  /** The feel's own accents: what Sound all brings back. */
  baseBeats: readonly number[];
  /** 0-based bar and beat being heard, or null when stopped. */
  currentBar: number | null;
  currentBeat: number | null;
  onChange: (next: MetronomePractice) => void;
}) {
  const { t } = useTranslation();
  const subdivisions = practiceSubdivisions(practice.meterId);
  const barCount = practice.bars.length;

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Text style={s.eyebrow}>{t("metronome.practice.title")}</Text>
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
      </View>

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
            onToggleRest={() => onChange(withBarRestToggled(practice, barIndex))}
            onTapBeat={(pulse) => onChange(withBeatCycled(practice, barIndex, pulse))}
            onTapSub={(pulse, position) => onChange(withSubCycled(practice, barIndex, pulse, position))}
          />
        ))}
      </View>

      <View style={s.foot}>
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
  );
}

function BarRow({
  bar,
  barIndex,
  subdivision,
  current,
  currentBeat,
  onToggleRest,
  onTapBeat,
  onTapSub,
}: {
  bar: PracticeBar;
  barIndex: number;
  subdivision: MetronomeSubdivision;
  current: boolean;
  currentBeat: number | null;
  onToggleRest: () => void;
  onTapBeat: (pulse: number) => void;
  onTapSub: (pulse: number, position: number) => void;
}) {
  const { t } = useTranslation();
  const number = barIndex + 1;
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
                  <View style={[s.dot, tier === "accent" ? s.dotAccent : tier === "click" ? s.dotClick : s.dotRest]} />
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
                      <View style={[s.tick, state === "accent" ? s.tickAccent : state === "off" ? s.tickOff : null]} />
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

const s = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textSecondary,
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
  beatHit: {
    width: 30,
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
  dotAccent: {
    width: 16,
    height: 16,
    backgroundColor: colors.primaryDeep,
  },
  dotClick: {
    width: 12,
    height: 12,
    borderWidth: 2,
    borderColor: colors.primaryDeep,
  },
  dotRest: {
    width: 7,
    height: 7,
    borderWidth: 1.5,
    borderColor: colors.borderMuted,
  },
  subHit: {
    flex: 1,
    height: ROW_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  tick: {
    width: 3,
    height: 12,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
  },
  tickAccent: {
    height: 16,
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
    justifyContent: "center",
    gap: spacing.lg,
    paddingTop: spacing.xs,
  },
});
