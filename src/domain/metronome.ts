export type MetronomeOutputKey = "beep" | "visual" | "haptic";
export type MetronomeBeepLevel = number;
export type MetronomeHapticLevel = number;
export type MetronomeMeterId = "2/4" | "3/4" | "4/4" | "5/4" | "6/8" | "7/8" | "9/8" | "12/8";
/** Audio-only ornament: how many equal parts each pulse is split into. 1 = beats only.
 *  Sub-clicks never touch the beat grid (events, anchor, haptics, dots stay per pulse). */
export type MetronomeSubdivision = 1 | 2 | 3 | 4;
/** The click's timbre — one bright stock click, one softer wood-block voice. */
export type MetronomeClickVoice = "click" | "wood";

export type MetronomeOutputs = Record<MetronomeOutputKey, boolean>;
export type MetronomeMeterPreset = {
  id: MetronomeMeterId;
  label: string;
  numerator: number;
  denominator: 4 | 8;
  pulsesPerBar: number;
  /** Per-pulse click weight for the DEFAULT grouping — hand-tuned, and the
   *  audio truth as long as the grouping isn't customised. */
  accentPattern: number[];
  /** How the bar is felt, as pulse counts: 5/4 is [2, 3]. The first pulse of
   *  each group is accented. Must sum to `pulsesPerBar`. */
  defaultGrouping: number[];
  /** The groupings offered in the UI, defaultGrouping first. Curated rather
   *  than every partition — 5/4 is really 2+3 or 3+2, not eight arrangements. */
  groupings: number[][];
};

export const MIN_METRONOME_BPM = 40;
export const MAX_METRONOME_BPM = 240;
export const DEFAULT_METRONOME_BPM = 92;
export const TAP_TEMPO_RESET_MS = 2200;
export const MAX_TAP_HISTORY = 8;
export const METRONOME_LOOP_BEAT_COUNT = 4;
export const DEFAULT_METRONOME_METER_ID: MetronomeMeterId = "4/4";
export const METRONOME_COUNT_IN_BAR_OPTIONS = [0, 1, 2, 4] as const;
export const DEFAULT_METRONOME_COUNT_IN_BARS = 1;
export const METRONOME_SUBDIVISION_OPTIONS: readonly MetronomeSubdivision[] = [1, 2, 3, 4];
export const DEFAULT_METRONOME_SUBDIVISION: MetronomeSubdivision = 1;
/** Weight of every sub-click (weak voice). Quiet and present, well under a weak beat. */
export const SUBDIVISION_CLICK_ACCENT = 0.18;
export const METRONOME_CLICK_VOICES: readonly MetronomeClickVoice[] = ["click", "wood"];
export const DEFAULT_METRONOME_CLICK_VOICE: MetronomeClickVoice = "click";

export const DEFAULT_METRONOME_OUTPUTS: MetronomeOutputs = {
  beep: true,
  visual: true,
  haptic: false,
};

export const MIN_METRONOME_LEVEL = 0;
export const MAX_METRONOME_LEVEL = 100;

export const DEFAULT_METRONOME_BEEP_LEVEL: MetronomeBeepLevel = 72;
export const DEFAULT_METRONOME_HAPTIC_LEVEL: MetronomeHapticLevel = 96;

// Ordered as two rows of four: the simple meters, then the compound and odd ones.
export const METRONOME_METER_PRESETS: readonly MetronomeMeterPreset[] = [
  {
    id: "2/4",
    label: "2/4",
    numerator: 2,
    denominator: 4,
    pulsesPerBar: 2,
    accentPattern: [1, 0.46],
    defaultGrouping: [2],
    groupings: [[2]],
  },
  {
    id: "3/4",
    label: "3/4",
    numerator: 3,
    denominator: 4,
    pulsesPerBar: 3,
    accentPattern: [1, 0.48, 0.48],
    defaultGrouping: [3],
    groupings: [[3]],
  },
  {
    id: "4/4",
    label: "4/4",
    numerator: 4,
    denominator: 4,
    pulsesPerBar: 4,
    accentPattern: [1, 0.46, 0.72, 0.46],
    defaultGrouping: [2, 2],
    groupings: [[2, 2], [4]],
  },
  {
    id: "5/4",
    label: "5/4",
    numerator: 5,
    denominator: 4,
    pulsesPerBar: 5,
    accentPattern: [1, 0.46, 0.7, 0.46, 0.46],
    defaultGrouping: [2, 3],
    groupings: [[2, 3], [3, 2], [5]],
  },
  {
    id: "6/8",
    label: "6/8",
    numerator: 6,
    denominator: 8,
    pulsesPerBar: 6,
    accentPattern: [1, 0.4, 0.32, 0.84, 0.4, 0.32],
    defaultGrouping: [3, 3],
    groupings: [[3, 3], [2, 2, 2], [6]],
  },
  {
    id: "7/8",
    label: "7/8",
    numerator: 7,
    denominator: 8,
    pulsesPerBar: 7,
    accentPattern: [1, 0.4, 0.78, 0.4, 0.78, 0.4, 0.4],
    defaultGrouping: [2, 2, 3],
    groupings: [[2, 2, 3], [3, 2, 2], [2, 3, 2]],
  },
  {
    id: "9/8",
    label: "9/8",
    numerator: 9,
    denominator: 8,
    pulsesPerBar: 9,
    accentPattern: [1, 0.4, 0.32, 0.8, 0.4, 0.32, 0.8, 0.4, 0.32],
    defaultGrouping: [3, 3, 3],
    groupings: [[3, 3, 3]],
  },
  {
    id: "12/8",
    label: "12/8",
    numerator: 12,
    denominator: 8,
    pulsesPerBar: 12,
    // Pulse 7 sits a hair above the other group starts: the half-bar in 12/8.
    accentPattern: [1, 0.4, 0.32, 0.8, 0.4, 0.32, 0.84, 0.4, 0.32, 0.8, 0.4, 0.32],
    defaultGrouping: [3, 3, 3, 3],
    groupings: [[3, 3, 3, 3]],
  },
] as const;

export function clampMetronomeBpm(value: number) {
  return Math.min(MAX_METRONOME_BPM, Math.max(MIN_METRONOME_BPM, Math.round(value)));
}

export function clampMetronomeLevel(value: number) {
  return Math.min(MAX_METRONOME_LEVEL, Math.max(MIN_METRONOME_LEVEL, Math.round(value)));
}

export function getMetronomeBeepVolume(level: MetronomeBeepLevel) {
  const normalized = clampMetronomeLevel(level) / MAX_METRONOME_LEVEL;
  return 0.16 + normalized * 0.4;
}

export function getMetronomeHapticFallbackDuration(level: MetronomeHapticLevel) {
  const normalized = clampMetronomeLevel(level) / MAX_METRONOME_LEVEL;
  return Math.round(14 + normalized * 22);
}

export function getMetronomeAndroidVibrationDuration(level: MetronomeHapticLevel, beatIntervalMs: number) {
  const normalized = clampMetronomeLevel(level) / MAX_METRONOME_LEVEL;
  const targetDuration = 42 + normalized * 64;
  const safeMaxDuration = Math.max(26, Math.min(140, beatIntervalMs * 0.55));
  return Math.round(Math.min(targetDuration, safeMaxDuration));
}

export function isMetronomeMeterId(value: unknown): value is MetronomeMeterId {
  return METRONOME_METER_PRESETS.some((preset) => preset.id === value);
}

export function getMetronomeMeterPreset(meterId: MetronomeMeterId) {
  return (
    METRONOME_METER_PRESETS.find((preset) => preset.id === meterId) ??
    METRONOME_METER_PRESETS.find((preset) => preset.id === DEFAULT_METRONOME_METER_ID)!
  );
}

export function getMetronomeBeatIntervalMs(bpm: number) {
  return 60000 / clampMetronomeBpm(bpm);
}

export function clampMetronomeCountInBars(value: number) {
  const minBars = METRONOME_COUNT_IN_BAR_OPTIONS[0];
  const maxBars = METRONOME_COUNT_IN_BAR_OPTIONS[METRONOME_COUNT_IN_BAR_OPTIONS.length - 1];
  return Math.min(maxBars, Math.max(minBars, Math.round(value)));
}

export function clampMetronomeSubdivision(value: unknown): MetronomeSubdivision {
  const rounded = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 1;
  return (Math.min(4, Math.max(1, rounded)) as MetronomeSubdivision);
}

export function isMetronomeClickVoice(value: unknown): value is MetronomeClickVoice {
  return METRONOME_CLICK_VOICES.some((voice) => voice === value);
}

export type TempoMarking =
  | "largo"
  | "adagio"
  | "andante"
  | "moderato"
  | "allegro"
  | "presto"
  | "prestissimo";

/** The classical marking for a tempo — a quiet label under the BPM readout. */
export function getTempoMarking(bpm: number): TempoMarking {
  const value = clampMetronomeBpm(bpm);
  if (value < 60) return "largo";
  if (value < 76) return "adagio";
  if (value < 108) return "andante";
  if (value < 120) return "moderato";
  if (value < 168) return "allegro";
  if (value < 200) return "presto";
  return "prestissimo";
}

export function shouldResetTapTempo(lastTapAt: number | null, nextTapAt: number) {
  return lastTapAt === null || nextTapAt - lastTapAt > TAP_TEMPO_RESET_MS;
}

export function deriveTapTempoBpm(tapTimes: number[]) {
  const recentTaps = tapTimes.slice(-MAX_TAP_HISTORY);
  if (recentTaps.length < 3) {
    return null;
  }

  const minInterval = 60000 / MAX_METRONOME_BPM;
  const maxInterval = 60000 / MIN_METRONOME_BPM;
  const intervals = recentTaps
    .slice(1)
    .map((tapTime, index) => tapTime - recentTaps[index])
    .filter((interval) => interval >= minInterval && interval <= maxInterval);

  if (intervals.length < 2) {
    return null;
  }

  const sorted = [...intervals].sort((left, right) => left - right);
  const median = sorted[Math.floor(sorted.length / 2)];
  const tolerance = Math.max(30, median * 0.22);
  const consistentIntervals = intervals.filter((interval) => Math.abs(interval - median) <= tolerance);

  if (consistentIntervals.length < Math.max(2, Math.ceil(intervals.length * 0.6))) {
    return null;
  }

  const averageInterval =
    consistentIntervals.reduce((sum, interval) => sum + interval, 0) / consistentIntervals.length;

  return clampMetronomeBpm(60000 / averageInterval);
}

// ── Grouping ────────────────────────────────────────────────────────────────
// A meter's numerator says how many pulses; the GROUPING says how they're felt.
// 5/4 is 2+3 for some songs and 3+2 for others, and the click, the beat dots and
// the visual pulse all have to agree — so grouping is the single source and
// everything downstream derives from it.

/** Click weight for the first pulse of the bar, of a later group, and the rest. */
const GROUP_ACCENT_DOWNBEAT = 1;
const GROUP_ACCENT_SECONDARY = 0.78;
const GROUP_ACCENT_WEAK = 0.44;

export function isSameGrouping(a: readonly number[], b: readonly number[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Validate a stored/incoming grouping against its meter. */
export function isValidGrouping(meterId: MetronomeMeterId, grouping: unknown): grouping is number[] {
  if (!Array.isArray(grouping) || grouping.length === 0) return false;
  if (!grouping.every((n) => Number.isInteger(n) && n > 0)) return false;
  const preset = getMetronomeMeterPreset(meterId);
  return grouping.reduce((sum, n) => sum + n, 0) === preset.pulsesPerBar;
}

export function getMetronomeGrouping(
  meterId: MetronomeMeterId,
  custom?: readonly number[] | null
): number[] {
  const preset = getMetronomeMeterPreset(meterId);
  return custom && isValidGrouping(meterId, custom) ? [...custom] : [...preset.defaultGrouping];
}

/** Turn a grouping into per-pulse click weights. */
export function buildAccentPattern(grouping: readonly number[]): number[] {
  const pattern: number[] = [];
  grouping.forEach((size, groupIndex) => {
    for (let i = 0; i < size; i += 1) {
      pattern.push(
        i > 0
          ? GROUP_ACCENT_WEAK
          : groupIndex === 0
            ? GROUP_ACCENT_DOWNBEAT
            : GROUP_ACCENT_SECONDARY
      );
    }
  });
  return pattern;
}

/**
 * The weights the engine and the visuals both run on. The preset's hand-tuned
 * pattern wins while the grouping is the default one, so customising is additive
 * and never quietly changes how the stock meters sound.
 */
export function getMetronomeAccentPattern(
  meterId: MetronomeMeterId,
  custom?: readonly number[] | null
): number[] {
  const preset = getMetronomeMeterPreset(meterId);
  const grouping = getMetronomeGrouping(meterId, custom);
  return isSameGrouping(grouping, preset.defaultGrouping)
    ? [...preset.accentPattern]
    : buildAccentPattern(grouping);
}

/** Pulse indices (0-based) that start a group — i.e. the accented pulses. */
export function getGroupStarts(grouping: readonly number[]): number[] {
  const starts: number[] = [];
  let at = 0;
  for (const size of grouping) {
    starts.push(at);
    at += size;
  }
  return starts;
}

/**
 * Where the beat row should open a gap. Chunking only helps when a group runs to
 * three or more — four dots read fine as four, six do not — so 4/4 stays one even
 * run while 6/8 shows 3 + 3.
 */
export function getGroupGapIndices(grouping: readonly number[]): number[] {
  if (grouping.length < 2 || Math.max(...grouping) < 3) return [];
  return getGroupStarts(grouping).slice(1);
}

/** "2 + 3" — for the grouping picker. */
export function formatGrouping(grouping: readonly number[]): string {
  return grouping.join(" + ");
}

// ── Feel ────────────────────────────────────────────────────────────────────
// "Click on" is the one question the metronome asks after the meter: what to
// click and how the bar is felt. It folds subdivision (sub-clicks per pulse) and
// grouping (which pulses are accented) into a short list of feels per meter — the
// ones players actually set — plus Custom, which edits the bar's pulses directly.

export type MetronomeFeel = {
  id: string;
  /** Note glyph shown above the word. */
  glyph: string;
  /** i18n key for the word; groups carry a literal label ("3 + 2") instead. */
  labelKey?: string;
  label?: string;
  subdivision: MetronomeSubdivision;
  /** The grouping this feel sets. undefined = leave the meter's current grouping
   *  alone (5/4 "Eighths" keeps 3 + 2 or 2 + 3); null = the preset default. */
  grouping?: number[] | null;
  /** Rest-based feels (compound meters felt on the dotted beat) need an engine
   *  that treats a zero weight as silence. */
  usesRests: boolean;
};

export const METRONOME_FEEL_CUSTOM = "custom";
export const METRONOME_FEEL_IN_GROUPS = "in-groups";

/** The three weights a custom pattern cycles through: accent → click → rest. */
export const METRONOME_PULSE_WEIGHTS = {
  accent: GROUP_ACCENT_DOWNBEAT,
  click: GROUP_ACCENT_WEAK,
  rest: 0,
} as const;

const SIMPLE_FEELS: MetronomeFeel[] = [
  { id: "beats", glyph: "♩", labelKey: "metronome.feel.beats", subdivision: 1, grouping: null, usesRests: false },
  { id: "eighths", glyph: "♫", labelKey: "metronome.feel.eighths", subdivision: 2, grouping: null, usesRests: false },
  { id: "triplets", glyph: "♪³", labelKey: "metronome.feel.triplets", subdivision: 3, grouping: null, usesRests: false },
  { id: "sixteenths", glyph: "♬", labelKey: "metronome.feel.sixteenths", subdivision: 4, grouping: null, usesRests: false },
];

function groupFeel(grouping: number[], glyph: string): MetronomeFeel {
  return {
    id: `group:${grouping.join("+")}`,
    glyph,
    label: formatGrouping(grouping),
    subdivision: 1,
    grouping,
    usesRests: false,
  };
}

const IN_GROUPS_LABEL_KEYS: Record<number, string> = {
  2: "metronome.feel.inTwo",
  3: "metronome.feel.inThree",
  4: "metronome.feel.inFour",
};

function compoundFeels(preset: MetronomeMeterPreset): MetronomeFeel[] {
  return [
    {
      id: METRONOME_FEEL_IN_GROUPS,
      glyph: "♩.",
      labelKey: IN_GROUPS_LABEL_KEYS[preset.defaultGrouping.length] ?? "metronome.feel.inTwo",
      subdivision: 1,
      grouping: null,
      usesRests: true,
    },
    { id: "eighths", glyph: "♪", labelKey: "metronome.feel.eighths", subdivision: 1, grouping: null, usesRests: false },
  ];
}

const CUSTOM_FEEL: MetronomeFeel = {
  id: METRONOME_FEEL_CUSTOM,
  glyph: "✎\uFE0E",
  labelKey: "metronome.feel.custom",
  subdivision: 1,
  grouping: null,
  usesRests: true,
};

function feelsForMeter(meterId: MetronomeMeterId): MetronomeFeel[] {
  const preset = getMetronomeMeterPreset(meterId);
  switch (preset.id) {
    case "5/4":
      return [
        groupFeel([3, 2], "♩"),
        groupFeel([2, 3], "♩"),
        { id: "eighths", glyph: "♫", labelKey: "metronome.feel.eighths", subdivision: 2, usesRests: false },
      ];
    case "7/8":
      return preset.groupings.map((grouping) => groupFeel([...grouping], "♪"));
    case "6/8":
    case "9/8":
    case "12/8":
      return compoundFeels(preset);
    default:
      return SIMPLE_FEELS;
  }
}

/**
 * The feels offered for a meter, Custom last. Rest-based feels are dropped on
 * binaries that can't keep a pulse silent (the control would lie otherwise).
 */
export function getMetronomeFeels(meterId: MetronomeMeterId, supportsRests = true): MetronomeFeel[] {
  const feels = feelsForMeter(meterId).filter((feel) => supportsRests || !feel.usesRests);
  return [...feels, CUSTOM_FEEL];
}

export function getMetronomeFeel(meterId: MetronomeMeterId, feelId: string): MetronomeFeel | null {
  return getMetronomeFeels(meterId).find((feel) => feel.id === feelId) ?? null;
}

/** Group starts click, everything between them rests — the compound meters
 *  felt on the dotted beat ("in two" for 6/8). */
export function buildRestPattern(grouping: readonly number[]): number[] {
  return buildAccentPattern(grouping).map((weight, index) =>
    index === 0 ? GROUP_ACCENT_DOWNBEAT : weight === GROUP_ACCENT_SECONDARY ? GROUP_ACCENT_SECONDARY : 0
  );
}

/** A stored custom pattern is only trusted when it fits the meter exactly. */
export function isValidAccentPattern(meterId: MetronomeMeterId, pattern: unknown): pattern is number[] {
  if (!Array.isArray(pattern)) return false;
  const preset = getMetronomeMeterPreset(meterId);
  return (
    pattern.length === preset.pulsesPerBar &&
    pattern.every((weight) => typeof weight === "number" && Number.isFinite(weight) && weight >= 0 && weight <= 1)
  );
}

export function isSameAccentPattern(a: readonly number[], b: readonly number[]) {
  return a.length === b.length && a.every((value, index) => Math.abs(value - b[index]) < 0.001);
}

/**
 * The feel a meter is currently in. An explicit choice wins; otherwise the
 * legacy subdivision + grouping fields (installs from before feels existed) are
 * read back into the nearest feel so nobody's click changes on update.
 */
export function resolveMetronomeFeelId(
  meterId: MetronomeMeterId,
  feelId: string | undefined,
  legacy: { subdivision: MetronomeSubdivision; grouping?: readonly number[] | null }
): string {
  const feels = getMetronomeFeels(meterId);
  if (feelId && feels.some((feel) => feel.id === feelId)) return feelId;
  const grouping = getMetronomeGrouping(meterId, legacy.grouping);
  const groupMatch = feels.find((feel) => feel.grouping && isSameGrouping(feel.grouping, grouping));
  if (legacy.subdivision > 1) {
    const bySubdivision = feels.find((feel) => feel.subdivision === legacy.subdivision);
    if (bySubdivision) return bySubdivision.id;
  }
  if (groupMatch) return groupMatch.id;
  const preset = getMetronomeMeterPreset(meterId);
  const defaultFeel =
    preset.denominator === 8
      ? feels.find((feel) => feel.id === "eighths")
      : feels.find((feel) => feel.subdivision === 1 && feel.id !== METRONOME_FEEL_CUSTOM);
  return (defaultFeel ?? feels[0]).id;
}

export type MetronomeFeelParams = {
  subdivision: MetronomeSubdivision;
  grouping: number[];
  accentPattern: number[];
  /** True when the pattern can't be described by the grouping alone (rests or a
   *  custom edit) — what a take must store to replay the same feel. */
  explicitPattern: boolean;
};

/** Everything the engine and visuals need for a feel. */
export function getMetronomeFeelParams(
  meterId: MetronomeMeterId,
  feelId: string,
  options: { customPattern?: readonly number[] | null; currentGrouping?: readonly number[] | null } = {}
): MetronomeFeelParams {
  const preset = getMetronomeMeterPreset(meterId);
  const feel = getMetronomeFeel(meterId, feelId) ?? getMetronomeFeels(meterId)[0];
  const grouping =
    feel.grouping === undefined
      ? getMetronomeGrouping(meterId, options.currentGrouping)
      : getMetronomeGrouping(meterId, feel.grouping);
  if (feel.id === METRONOME_FEEL_CUSTOM) {
    const pattern = isValidAccentPattern(meterId, options.customPattern)
      ? [...options.customPattern]
      : [...preset.accentPattern];
    return { subdivision: 1, grouping, accentPattern: pattern, explicitPattern: true };
  }
  if (feel.id === METRONOME_FEEL_IN_GROUPS) {
    return { subdivision: 1, grouping, accentPattern: buildRestPattern(grouping), explicitPattern: true };
  }
  return {
    subdivision: feel.subdivision,
    grouping,
    accentPattern: getMetronomeAccentPattern(meterId, grouping),
    explicitPattern: false,
  };
}

/** The next weight when a custom pulse is tapped: accent → click → rest → accent.
 *  Without rest support the cycle skips silence. */
export function cyclePulseWeight(weight: number, supportsRests = true): number {
  if (weight >= 0.95) return METRONOME_PULSE_WEIGHTS.click;
  if (weight > 0) return supportsRests ? METRONOME_PULSE_WEIGHTS.rest : METRONOME_PULSE_WEIGHTS.accent;
  return METRONOME_PULSE_WEIGHTS.accent;
}

/** The feel a saved take's grid describes — used to preset the metronome on return. */
export function feelIdForGrid(
  meterId: MetronomeMeterId,
  grouping?: readonly number[] | null,
  accentPattern?: readonly number[] | null
): string {
  if (accentPattern && isValidAccentPattern(meterId, accentPattern)) {
    const resolvedGrouping = getMetronomeGrouping(meterId, grouping);
    return isSameAccentPattern(accentPattern, buildRestPattern(resolvedGrouping))
      ? METRONOME_FEEL_IN_GROUPS
      : METRONOME_FEEL_CUSTOM;
  }
  return resolveMetronomeFeelId(meterId, undefined, { subdivision: 1, grouping });
}
