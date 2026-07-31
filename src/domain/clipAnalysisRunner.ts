import { extractAudioData } from "@siteed/audio-studio";
import type { ClipAnalysis } from "../types";
import { createTempoAnalysis } from "./clipAnalysis";
import {
  detectTempoFromSamples,
  TEMPO_ANALYSIS_MAX_MS,
  TEMPO_ANALYSIS_MIN_MS,
  TEMPO_ANALYSIS_SAMPLE_RATE,
} from "./tempoDetection";

function asSamples(value: unknown): ArrayLike<number> | null {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    return value as ArrayLike<number>;
  }
  return null;
}

/**
 * Decode a bounded mono copy and estimate one global tempo across the clip. The detector
 * returns an explicit no-result when rhythmic evidence is weak; it never substitutes a
 * default BPM.
 */
export async function analyzeClipAudio(fileUri: string, durationMs: number): Promise<ClipAnalysis> {
  const boundedDurationMs = Math.min(
    TEMPO_ANALYSIS_MAX_MS,
    Math.max(0, Math.floor(durationMs) - 50)
  );
  if (boundedDurationMs < TEMPO_ANALYSIS_MIN_MS) {
    return createTempoAnalysis({ bpm: null, confidence: 0, steadiness: 0, alternativeBpm: null });
  }

  const result = await extractAudioData({
    fileUri,
    startTimeMs: 0,
    endTimeMs: boundedDurationMs,
    includeNormalizedData: true,
    includeBase64Data: false,
    includeWavHeader: false,
    decodingOptions: {
      targetSampleRate: TEMPO_ANALYSIS_SAMPLE_RATE,
      targetChannels: 1,
      targetBitDepth: 16,
      normalizeAudio: false,
    },
  });

  const samples = asSamples(result?.normalizedData);
  if (!samples || samples.length === 0) {
    throw new Error("Decoded audio did not include samples for tempo analysis.");
  }
  // audio-studio 3.0.2 reports the SOURCE sample rate on iOS even after converting
  // normalizedData to the requested target rate. Derive the effective rate from the
  // returned sample count and requested time span so tempo cannot be scaled by 48k/8k.
  const sampleRate = (samples.length * 1_000) / boundedDurationMs;

  return createTempoAnalysis(detectTempoFromSamples(samples, sampleRate));
}
