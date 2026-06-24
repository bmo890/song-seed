import type { ClipAnalysis, MusicalMode } from "./types";

// Pure key/tempo analysis core — no native dependency, so it's unit-testable and safe to
// import anywhere. The native file decode + feature extraction lives in clipAnalysisRunner.

export const ANALYSIS_SCHEMA_VERSION = 1;

/** Above this steadiness, a fixed click / count-in will line up with the take. */
export const STEADY_TEMPO_THRESHOLD = 0.7;

/**
 * Krumhansl–Schmuckler key profiles — perceptual weights for the 12 scale degrees
 * relative to the tonic. Correlating the clip's average chromagram against all 24
 * rotations (12 major + 12 minor) yields the most likely tonal centre. Robust because
 * it works on the *aggregate* pitch-class distribution, not the chord progression.
 */
const KRUMHANSL_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KRUMHANSL_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/** Common-key spelling for each pitch class (mixed sharps/flats, musician-friendly). */
const PITCH_CLASS_LABELS = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

export type ChromaPoint = { features?: { chromagram?: number[]; tempo?: number }; silent?: boolean };

export type KeyEstimate = {
  keyIndex: number;
  mode: MusicalMode;
  /** 0..1 — how far the winner beat the runner-up. */
  confidence: number;
};

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < n; i += 1) {
    meanA += a[i];
    meanB += b[i];
  }
  meanA /= n;
  meanB /= n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i += 1) {
    const x = a[i] - meanA;
    const y = b[i] - meanB;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  const den = Math.sqrt(da * db);
  return den === 0 ? 0 : num / den;
}

/**
 * Estimate the key from a 12-bin chromagram. Tries every tonic against both the major
 * and minor profile and keeps the best correlation. Confidence is the normalised margin
 * over the runner-up, so an ambiguous clip (e.g. relative major/minor) reads as low.
 */
export function detectKeyFromChroma(chroma: number[]): KeyEstimate | null {
  if (!chroma || chroma.length < 12) return null;

  let bestScore = -Infinity;
  let secondScore = -Infinity;
  let bestIndex = 0;
  let bestMode: MusicalMode = "major";

  const consider = (score: number, keyIndex: number, mode: MusicalMode) => {
    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      bestIndex = keyIndex;
      bestMode = mode;
    } else if (score > secondScore) {
      secondScore = score;
    }
  };

  for (let tonic = 0; tonic < 12; tonic += 1) {
    const rotated = chroma.map((_, i) => chroma[(tonic + i) % 12]);
    consider(pearson(rotated, KRUMHANSL_MAJOR), tonic, "major");
    consider(pearson(rotated, KRUMHANSL_MINOR), tonic, "minor");
  }

  if (bestScore <= 0) return null;
  const margin = Number.isFinite(secondScore) ? bestScore - Math.max(0, secondScore) : bestScore;
  const confidence = Math.max(0, Math.min(1, margin / bestScore));
  return { keyIndex: bestIndex, mode: bestMode, confidence };
}

/** Average the per-segment chromagrams into one normalised 12-vector. */
export function aggregateChroma(points: ChromaPoint[]): number[] | null {
  const sum = new Array(12).fill(0);
  let count = 0;
  for (const point of points) {
    const chroma = point.features?.chromagram;
    if (!chroma || chroma.length < 12 || point.silent) continue;
    for (let i = 0; i < 12; i += 1) sum[i] += chroma[i];
    count += 1;
  }
  if (count === 0) return null;
  const avg = sum.map((value) => value / count);
  const max = Math.max(...avg);
  return max > 0 ? avg.map((value) => value / max) : null;
}

/** Median tempo + a steadiness score from the coefficient of variation. */
export function aggregateTempo(tempos: number[]): { bpm: number | null; steadiness: number } {
  const valid = tempos.filter((t) => Number.isFinite(t) && t >= 40 && t <= 240);
  if (valid.length === 0) return { bpm: null, steadiness: 0 };
  const sorted = [...valid].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const mean = valid.reduce((s, t) => s + t, 0) / valid.length;
  const variance = valid.reduce((s, t) => s + (t - mean) ** 2, 0) / valid.length;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
  // cv ~0 → rock steady; cv ~0.5 → very loose. Scale so cv 0.1 ≈ 0.8 steadiness.
  const steadiness = Math.max(0, Math.min(1, 1 - cv * 2));
  return { bpm: Math.round(median), steadiness };
}

/** Assemble a ClipAnalysis from the library's per-segment data points (pure, no native call). */
export function analyzeFromDataPoints(points: ChromaPoint[]): ClipAnalysis {
  const chroma = aggregateChroma(points);
  const keyEstimate = chroma ? detectKeyFromChroma(chroma) : null;
  const tempos = points
    .map((point) => point.features?.tempo)
    .filter((tempo): tempo is number => typeof tempo === "number" && tempo > 0);
  const { bpm, steadiness } = aggregateTempo(tempos);

  return {
    schemaVersion: ANALYSIS_SCHEMA_VERSION,
    analyzedAt: Date.now(),
    key: keyEstimate ? PITCH_CLASS_LABELS[keyEstimate.keyIndex] : null,
    mode: keyEstimate ? keyEstimate.mode : null,
    keyConfidence: keyEstimate ? keyEstimate.confidence : 0,
    bpm,
    bpmSteadiness: steadiness,
  };
}

export function formatKeyLabel(analysis: ClipAnalysis | null | undefined): string {
  if (!analysis || !analysis.key || !analysis.mode) return "—";
  return `${analysis.key} ${analysis.mode === "minor" ? "min" : "maj"}`;
}

export function formatBpmLabel(analysis: ClipAnalysis | null | undefined): string {
  if (!analysis || analysis.bpm == null) return "—";
  return `${Math.round(analysis.bpm)} BPM`;
}

/** True when a steady click / count-in will actually line up with the take. */
export function isTempoSteady(analysis: ClipAnalysis | null | undefined): boolean {
  return !!analysis && analysis.bpm != null && analysis.bpmSteadiness >= STEADY_TEMPO_THRESHOLD;
}

export function hasAnalysisResult(analysis: ClipAnalysis | null | undefined): boolean {
  return !!analysis && (analysis.key != null || analysis.bpm != null);
}
