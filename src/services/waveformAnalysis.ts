import { extractPreview } from "@siteed/audio-studio";
import SongseedPitchShiftModule from "../../modules/songseed-pitch-shift";
import { metersToWaveformPeaks } from "../utils";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function analysisToPeaks(
  analysis: { dataPoints?: Array<{ dB: number; amplitude: number }> },
  numberOfPoints: number
): number[] {
  const dataPoints = analysis.dataPoints ?? [];
  if (!dataPoints.length) return [];
  const levelsAsDb = dataPoints.map((point) =>
    Number.isFinite(point.dB) ? point.dB : point.amplitude > 0 ? 20 * Math.log10(point.amplitude) : -60
  );
  return metersToWaveformPeaks(levelsAsDb, numberOfPoints);
}

/**
 * Compute `numberOfPoints` peak values (0..1) for an audio file. Prefers the
 * in-house media3 / AVFoundation decoder; falls back to @siteed `extractPreview`
 * if it's unavailable or fails. `durationMs` must be > 0 (callers resolve it) so
 * the analysis window is bounded. Returns [] when no analysis could be produced.
 */
export async function computeWaveformPeaks(
  audioUri: string,
  numberOfPoints: number,
  durationMs: number
): Promise<number[]> {
  if (!durationMs || durationMs <= 0) return [];

  const native = SongseedPitchShiftModule;
  if (native?.computeWaveform) {
    try {
      const result = await native.computeWaveform({
        inputUri: audioUri,
        numberOfPoints,
        startTimeMs: 0,
        endTimeMs: durationMs,
      });
      if (result?.peaks?.length) {
        console.log("[waveform] decoder=native", { rawPoints: result.peaks.length, requested: numberOfPoints });
        return result.peaks.map(clamp01);
      }
      console.warn("[waveform] native computeWaveform returned no points; falling back to @siteed");
    } catch (error) {
      console.warn("[waveform] native computeWaveform failed; falling back to @siteed", error);
    }
  } else {
    console.log("[waveform] decoder=extractPreview (native computeWaveform unavailable in this build)");
  }

  try {
    const analysis = await extractPreview({
      fileUri: audioUri,
      numberOfPoints,
      startTimeMs: 0,
      endTimeMs: durationMs,
    });
    console.log("[waveform] decoder=extractPreview", {
      rawPoints: analysis.dataPoints?.length ?? 0,
      requested: numberOfPoints,
    });
    return analysisToPeaks(analysis, numberOfPoints);
  } catch (error) {
    console.warn("[waveform] extractPreview fallback failed", error);
    return [];
  }
}
