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
