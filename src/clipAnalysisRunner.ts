import { extractAudioAnalysis } from "@siteed/audio-studio";
import type { ClipAnalysis } from "./types";
import { analyzeFromDataPoints, type ChromaPoint } from "./clipAnalysis";

/**
 * Run the offline analysis for a saved clip. The native library does the heavy DSP
 * (chromagram + tempo per segment); we aggregate and run key detection in JS. Throws
 * if the platform/format can't be decoded — callers should treat that as "unavailable".
 */
export async function analyzeClipAudio(fileUri: string): Promise<ClipAnalysis> {
  const result = await extractAudioAnalysis({
    fileUri,
    segmentDurationMs: 500,
    features: { chromagram: true, tempo: true, energy: true, rms: true },
  });

  const points = (result?.dataPoints ?? []) as ChromaPoint[];
  return analyzeFromDataPoints(points);
}
