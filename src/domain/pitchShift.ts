export const PITCH_SHIFT_MIN_SEMITONES = -12;
export const PITCH_SHIFT_MAX_SEMITONES = 12;

export type PitchShiftCapabilities = {
  isAvailable: boolean;
  supportsPracticePlayback: boolean;
  supportsEditorPreview: boolean;
  supportsOfflineRender: boolean;
  minSemitones: number;
  maxSemitones: number;
  /** The engine can carry the play-along click in the song's own stream. */
  supportsPlayAlongClick: boolean;
  /** …and buzzes with it from the same stream. */
  supportsPlayAlongHaptic: boolean;
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
    supportsPlayAlongClick: false,
    supportsPlayAlongHaptic: false,
  };
}
