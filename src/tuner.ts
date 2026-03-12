const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

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
  if (!frequency || !Number.isFinite(frequency) || frequency < 40 || frequency > 1500) {
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

export function summarizePitchSamples(samples: number[]) {
  if (samples.length === 0) {
    return null;
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const middleIndex = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middleIndex - 1] + sorted[middleIndex]) / 2;
  }

  return sorted[middleIndex];
}

export function normalizePitchAgainstHistory(pitch: number, history: number[]) {
  const reference = summarizePitchSamples(history);
  if (!reference) {
    return pitch;
  }

  let normalized = pitch;
  while (normalized < reference / 1.6) {
    normalized *= 2;
  }

  while (normalized > reference * 1.6) {
    normalized /= 2;
  }

  return normalized;
}
