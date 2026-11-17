import {
  METRONOME_PULSE_WEIGHTS,
  SUBDIVISION_CLICK_ACCENT,
  getMetronomeMeterPreset,
  isMetronomeMeterId,
  type MetronomeMeterId,
  type MetronomeSubdivision,
} from "./metronome";

/**
 * The practice pattern of the standalone metronome page (founder, 2026-11-16): up to four
 * bars, each its own row of beats and sub-beats, every one of them its own switch, and a
 * whole bar that can rest. The engine plays it as one loop of steps (`stepPattern`,
 * supportsStepPattern binaries); the recorder and the player never send one.
 *
 * A beat cycles accent → click → silent; a sub-beat sound → accent → silent. A bar keeps
 * what it holds while it rests, so resting is undone in one tap.
 */

export const MAX_PRACTICE_BARS = 4;
/** No row of a bar gets more taps than this; denser subdivisions aren't offered for the
 *  meter (12/8 stops at eighths, 7/8 at triplets). */
const MAX_STEPS_PER_BAR = 24;
/** A sub-beat that sounds: the engine's usual sub-click. */
export const PRACTICE_SUB_WEIGHT = SUBDIVISION_CLICK_ACCENT;
/** A sub-beat accent: clearly louder than a sub-click, still in the weak voice. */
export const PRACTICE_SUB_ACCENT_WEIGHT = 0.62;

export type PracticeBar = {
  rest: boolean;
  /** One weight per pulse: accent, click or 0 (silent). */
  beats: number[];
  /** Per pulse, the weights of its sub-beat positions 1–3 (0 = silent). Positions past the
   *  current subdivision are kept but not played. */
  subs: number[][];
};

export type MetronomePractice = {
  meterId: MetronomeMeterId;
  subdivision: MetronomeSubdivision;
  bars: PracticeBar[];
};

/** The subdivisions a meter's row can hold without its targets getting too small. */
export function practiceSubdivisions(meterId: MetronomeMeterId): MetronomeSubdivision[] {
  const pulses = getMetronomeMeterPreset(meterId).pulsesPerBar;
  return ([1, 2, 3, 4] as MetronomeSubdivision[]).filter((sub) => pulses * sub <= MAX_STEPS_PER_BAR);
}

/** A full bar: the given beat weights, every sub-beat sounding. */
export function fullPracticeBar(beatWeights: readonly number[]): PracticeBar {
  return {
    rest: false,
    beats: [...beatWeights],
    subs: beatWeights.map(() => [PRACTICE_SUB_WEIGHT, PRACTICE_SUB_WEIGHT, PRACTICE_SUB_WEIGHT]),
  };
}

/** What the page opens on before anyone edits: one full bar of the feel you hear now. */
export function defaultPractice(
  meterId: MetronomeMeterId,
  beatWeights: readonly number[],
  subdivision: MetronomeSubdivision
): MetronomePractice {
  const allowed = practiceSubdivisions(meterId);
  return {
    meterId,
    subdivision: allowed.includes(subdivision) ? subdivision : 1,
    bars: [fullPracticeBar(beatWeights)],
  };
}

const isWeight = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;

/** A stored pattern, only when it still fits a meter we know. Anything else is dropped
 *  and the page opens on the default. */
export function sanitizePractice(raw: unknown): MetronomePractice | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<MetronomePractice>;
  if (!isMetronomeMeterId(value.meterId)) return null;
  const pulses = getMetronomeMeterPreset(value.meterId).pulsesPerBar;
  const subdivision = value.subdivision;
  if (!practiceSubdivisions(value.meterId).includes(subdivision as MetronomeSubdivision)) return null;
  if (!Array.isArray(value.bars) || value.bars.length < 1 || value.bars.length > MAX_PRACTICE_BARS) return null;
  const bars: PracticeBar[] = [];
  for (const bar of value.bars) {
    if (!bar || !Array.isArray(bar.beats) || !Array.isArray(bar.subs)) return null;
    if (bar.beats.length !== pulses || !bar.beats.every(isWeight)) return null;
    if (bar.subs.length !== pulses) return null;
    if (!bar.subs.every((row) => Array.isArray(row) && row.length === 3 && row.every(isWeight))) return null;
    bars.push({ rest: bar.rest === true, beats: [...bar.beats], subs: bar.subs.map((row) => [...row]) });
  }
  return { meterId: value.meterId, subdivision: subdivision as MetronomeSubdivision, bars };
}

/** The engine's loop: `subdivision` steps per pulse, bar after bar; a resting bar is all 0. */
export function practiceSteps(practice: MetronomePractice): number[] {
  const steps: number[] = [];
  for (const bar of practice.bars) {
    bar.beats.forEach((beat, pulse) => {
      steps.push(bar.rest ? 0 : beat);
      for (let position = 1; position < practice.subdivision; position += 1) {
        steps.push(bar.rest ? 0 : bar.subs[pulse][position - 1] ?? 0);
      }
    });
  }
  return steps;
}

export type BeatTier = "accent" | "click" | "rest";
export type SubTier = "accent" | "on" | "off";

export function beatTier(weight: number): BeatTier {
  if (weight <= 0) return "rest";
  return weight >= 0.65 ? "accent" : "click";
}

export function subTier(weight: number): SubTier {
  if (weight <= 0) return "off";
  return weight > PRACTICE_SUB_WEIGHT + 0.05 ? "accent" : "on";
}

/** accent → click → silent → accent. */
export function cycleBeatWeight(weight: number): number {
  const tier = beatTier(weight);
  if (tier === "accent") return METRONOME_PULSE_WEIGHTS.click;
  if (tier === "click") return METRONOME_PULSE_WEIGHTS.rest;
  return METRONOME_PULSE_WEIGHTS.accent;
}

/** sound → accent → silent → sound. */
export function cycleSubWeight(weight: number): number {
  const tier = subTier(weight);
  if (tier === "on") return PRACTICE_SUB_ACCENT_WEIGHT;
  if (tier === "accent") return 0;
  return PRACTICE_SUB_WEIGHT;
}

function mapBar(practice: MetronomePractice, barIndex: number, change: (bar: PracticeBar) => PracticeBar) {
  return { ...practice, bars: practice.bars.map((bar, index) => (index === barIndex ? change(bar) : bar)) };
}

export function withBeatCycled(practice: MetronomePractice, barIndex: number, pulse: number): MetronomePractice {
  return mapBar(practice, barIndex, (bar) => ({
    ...bar,
    beats: bar.beats.map((weight, index) => (index === pulse ? cycleBeatWeight(weight) : weight)),
  }));
}

export function withSubCycled(
  practice: MetronomePractice,
  barIndex: number,
  pulse: number,
  position: number
): MetronomePractice {
  return mapBar(practice, barIndex, (bar) => ({
    ...bar,
    subs: bar.subs.map((row, index) =>
      index === pulse ? row.map((weight, at) => (at === position - 1 ? cycleSubWeight(weight) : weight)) : row
    ),
  }));
}

export function withBarRestToggled(practice: MetronomePractice, barIndex: number): MetronomePractice {
  return mapBar(practice, barIndex, (bar) => ({ ...bar, rest: !bar.rest }));
}

/** A new bar repeats the last one, so only what differs needs a tap. */
export function withBarAdded(practice: MetronomePractice): MetronomePractice {
  if (practice.bars.length >= MAX_PRACTICE_BARS) return practice;
  const last = practice.bars[practice.bars.length - 1];
  return {
    ...practice,
    bars: [...practice.bars, { rest: last.rest, beats: [...last.beats], subs: last.subs.map((row) => [...row]) }],
  };
}

export function withBarRemoved(practice: MetronomePractice): MetronomePractice {
  if (practice.bars.length <= 1) return practice;
  return { ...practice, bars: practice.bars.slice(0, -1) };
}

/** Every beat and sub-beat in every bar sounds again, on the feel's own accents. */
export function withAllSounding(practice: MetronomePractice, beatWeights: readonly number[]): MetronomePractice {
  return { ...practice, bars: practice.bars.map(() => fullPracticeBar(beatWeights)) };
}

/** Every beat and sub-beat in every bar silent: build up from nothing. */
export function withAllSilent(practice: MetronomePractice): MetronomePractice {
  return {
    ...practice,
    bars: practice.bars.map((bar) => ({
      rest: false,
      beats: bar.beats.map(() => 0),
      subs: bar.subs.map(() => [0, 0, 0]),
    })),
  };
}

/**
 * Random (founder, 2026-11-17): the page silences beats you can't see coming. Bars of the
 * feel with some beats silent are rolled ahead of the one playing and streamed to the
 * engine (useMetronome's MetronomeStream), shown four to a pass, so every pass is new.
 * Few and Some keep the one; Many may silence it too.
 */
export type PracticeMode = "pattern" | "random";
export type RandomSilence = "few" | "some" | "many";
export const RANDOM_SILENCES: readonly RandomSilence[] = ["few", "some", "many"];
const RANDOM_SILENCE_SHARE: Record<RandomSilence, number> = { few: 0.15, some: 0.3, many: 0.5 };

export const isPracticeMode = (value: unknown): value is PracticeMode => value === "pattern" || value === "random";
export const isRandomSilence = (value: unknown): value is RandomSilence =>
  RANDOM_SILENCES.includes(value as RandomSilence);

/**
 * One bar of beats, each silenced at the share. The one keeps the feel's accent and every
 * other beat that sounds is a plain click: Random plays along a tempo map, where only the
 * one has the bright voice, so the page shows no accent it cannot sound (2026-11-17).
 */
export function rollRandomBar(
  beatWeights: readonly number[],
  silence: RandomSilence,
  random: () => number = Math.random
): number[] {
  const share = RANDOM_SILENCE_SHARE[silence];
  return beatWeights.map((weight, pulse) => {
    if (!((pulse === 0 && silence !== "many") || random() >= share)) return 0;
    return pulse === 0 || weight <= 0 ? weight : METRONOME_PULSE_WEIGHTS.click;
  });
}

export function rollRandomBars(
  beatWeights: readonly number[],
  silence: RandomSilence,
  count: number = MAX_PRACTICE_BARS,
  random: () => number = Math.random
): number[][] {
  return Array.from({ length: count }, () => rollRandomBar(beatWeights, silence, random));
}

export function withSubdivision(practice: MetronomePractice, subdivision: MetronomeSubdivision): MetronomePractice {
  return practiceSubdivisions(practice.meterId).includes(subdivision) ? { ...practice, subdivision } : practice;
}
