const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

/** Detectable range: 5-string bass B0 up to well past a violin's E string harmonics. */
export const TUNER_MIN_HZ = 27.5;
export const TUNER_MAX_HZ = 2000;

export type TunerReading = {
  detectedFrequency: number;
  noteName: string;
  octave: number;
  nearestNoteFrequency: number;
  centsOff: number;
  tuningLabel: string;
  isInTune: boolean;
};

function centsBetween(frequency: number, referenceFrequency: number) {
  return 1200 * Math.log2(frequency / referenceFrequency);
}

function midiToFrequency(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function frequencyToMidi(frequency: number) {
  return 69 + 12 * Math.log2(frequency / 440);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function buildTunerReading(frequency: number | null): TunerReading | null {
  if (
    !frequency ||
    !Number.isFinite(frequency) ||
    frequency < TUNER_MIN_HZ ||
    frequency > TUNER_MAX_HZ
  ) {
    return null;
  }

  const nearestMidi = Math.round(frequencyToMidi(frequency));
  const noteName = NOTE_NAMES[((nearestMidi % 12) + 12) % 12];
  const octave = Math.floor(nearestMidi / 12) - 1;
  const nearestNoteFrequency = midiToFrequency(nearestMidi);
  const centsOff = centsBetween(frequency, nearestNoteFrequency);
  const absCents = Math.abs(centsOff);

  return {
    detectedFrequency: frequency,
    noteName,
    octave,
    nearestNoteFrequency,
    centsOff,
    tuningLabel: absCents <= 5 ? "In tune" : centsOff < 0 ? "Tune up" : "Tune down",
    isInTune: absCents <= 5,
  };
}

export function getTunerMeterPercent(centsOff: number) {
  return 50 + clamp(centsOff, -50, 50);
}
