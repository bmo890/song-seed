export const PITCH_SHIFT_MIN_SEMITONES = -12;
export const PITCH_SHIFT_MAX_SEMITONES = 12;

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
