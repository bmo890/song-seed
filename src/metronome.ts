export type MetronomeOutputKey = "beep" | "visual" | "haptic";
export type MetronomeBeepLevel = number;
export type MetronomeHapticLevel = number;

export type MetronomeOutputs = Record<MetronomeOutputKey, boolean>;

export const MIN_METRONOME_BPM = 40;
export const MAX_METRONOME_BPM = 240;
export const DEFAULT_METRONOME_BPM = 92;
export const TAP_TEMPO_RESET_MS = 2200;
export const MAX_TAP_HISTORY = 8;
export const METRONOME_LOOP_BEAT_COUNT = 4;

export const DEFAULT_METRONOME_OUTPUTS: MetronomeOutputs = {
  beep: true,
  visual: true,
  haptic: false,
};

export const MIN_METRONOME_LEVEL = 0;
export const MAX_METRONOME_LEVEL = 100;

export const DEFAULT_METRONOME_BEEP_LEVEL: MetronomeBeepLevel = 72;
export const DEFAULT_METRONOME_HAPTIC_LEVEL: MetronomeHapticLevel = 96;

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

export function formatMetronomeLevel(level: number) {
  return `${clampMetronomeLevel(level)}%`;
}

export function getMetronomeBeatIntervalMs(bpm: number) {
  return 60000 / clampMetronomeBpm(bpm);
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

export function formatMetronomeIntervalLabel(intervalMs: number) {
  return `${Math.round(intervalMs)} ms per beat`;
}
