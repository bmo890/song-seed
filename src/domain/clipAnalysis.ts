import type { ClipAnalysis } from "../types";
import type { TempoEstimate } from "./tempoDetection";

// Schema 1 used @siteed's per-500ms tempo value, including its hard-coded 120 BPM
// failure sentinel. Schema 2 is the first full-clip, confidence-gated tempo result.
export const ANALYSIS_SCHEMA_VERSION = 2;

/** Above this steadiness, a fixed click / count-in is likely to follow the take. */
export const STEADY_TEMPO_THRESHOLD = 0.7;

export function createTempoAnalysis(estimate: TempoEstimate): ClipAnalysis {
  return {
    schemaVersion: ANALYSIS_SCHEMA_VERSION,
    analyzedAt: Date.now(),
    // Schema compatibility: key detection was removed because the old 21ms chroma
    // snapshots could not distinguish tonal music from clicks or noise.
    key: null,
    mode: null,
    keyConfidence: 0,
    bpm: estimate.bpm,
    bpmConfidence: estimate.confidence,
    bpmSteadiness: estimate.steadiness,
    bpmAlternative: estimate.alternativeBpm,
  };
}

export function formatBpmLabel(analysis: ClipAnalysis | null | undefined): string {
  if (!hasAnalysisResult(analysis)) return "—";
  return `${Math.round(analysis.bpm!)} BPM`;
}

/** True when a steady click / count-in is likely to line up with the take. */
export function isTempoSteady(analysis: ClipAnalysis | null | undefined): boolean {
  return hasAnalysisResult(analysis) && analysis.bpmSteadiness >= STEADY_TEMPO_THRESHOLD;
}

/** Schema-1 values are intentionally invalidated: many are the dependency's 120 fallback. */
export function hasAnalysisResult(
  analysis: ClipAnalysis | null | undefined
): analysis is ClipAnalysis & { bpm: number } {
  return !!analysis && analysis.schemaVersion === ANALYSIS_SCHEMA_VERSION && analysis.bpm != null;
}
