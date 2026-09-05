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
