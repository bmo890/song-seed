export const PITCH_SHIFT_MIN_SEMITONES = -12;
export const PITCH_SHIFT_MAX_SEMITONES = 12;
export const PITCH_SHIFT_PRESET_STEPS = [-5, -3, -2, -1, 0, 1, 2, 3, 5] as const;

export type PitchShiftSemitones = number;

export type PitchShiftMode = "practice" | "editor";

export type PitchShiftCapabilities = {
  isAvailable: boolean;
  supportsPracticePlayback: boolean;
  supportsEditorPreview: boolean;
  supportsOfflineRender: boolean;
  minSemitones: number;
  maxSemitones: number;
};

export function clampPitchShiftSemitones(value: number) {
  return Math.max(PITCH_SHIFT_MIN_SEMITONES, Math.min(PITCH_SHIFT_MAX_SEMITONES, Math.round(value)));
}

export function formatPitchShiftLabel(semitones: number) {
  const clean = clampPitchShiftSemitones(semitones);
  if (clean === 0) {
    return "Original";
  }

  const suffix = Math.abs(clean) === 1 ? "semitone" : "semitones";
  return `${clean > 0 ? "+" : ""}${clean} ${suffix}`;
}

export function formatPitchShiftShortLabel(semitones: number) {
  const clean = clampPitchShiftSemitones(semitones);
  if (clean === 0) {
    return "Pitch";
  }

  return `${clean > 0 ? "+" : ""}${clean} st`;
}

export function buildUnavailablePitchShiftCapabilities(): PitchShiftCapabilities {
  return {
    isAvailable: false,
    supportsPracticePlayback: false,
    supportsEditorPreview: false,
    supportsOfflineRender: false,
    minSemitones: PITCH_SHIFT_MIN_SEMITONES,
    maxSemitones: PITCH_SHIFT_MAX_SEMITONES,
  };
}
