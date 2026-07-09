import { extractPreview } from "@siteed/audio-studio";
import SongseedPitchShiftModule from "../../modules/songseed-pitch-shift";
import { metersToWaveformPeaks, quantizeWaveformPeak } from "../utils";

function clamp01(value: number) {
  return quantizeWaveformPeak(Math.max(0, Math.min(1, value)));
}

function analysisToPeaks(
  analysis: { dataPoints?: Array<{ dB: number; amplitude: number; rms?: number }> },
  numberOfPoints: number
): number[] {
  const dataPoints = analysis.dataPoints ?? [];
  if (!dataPoints.length) return [];
  const levelsAsDb = dataPoints.map((point) => {
    // Prefer RMS energy → dB. It traces the loudness envelope (a song's verse/
    // chorus dynamics). Peak dB sits near 0 dBFS for almost every bin of a loud or
    // mastered track, so a peak waveform renders as a featureless solid block.
    if (typeof point.rms === "number" && point.rms > 0) {
      return 20 * Math.log10(point.rms);
    }
    if (Number.isFinite(point.dB)) return point.dB;
    return point.amplitude > 0 ? 20 * Math.log10(point.amplitude) : -60;
  });
  return metersToWaveformPeaks(levelsAsDb, numberOfPoints);
}

// Serialize native waveform decodes app-wide. On Android the decoder shares the
// MediaCodec pool with the audio player, so running several at once — multiple reels
// mounting during a fast scroll, or a reel decode racing a clip load — starves the
// player and stalls playback (the full-player-won't-start-on-long-clips freeze). One at a
// time keeps a codec free for playback; non-critical reels just wait their turn behind the
// low-res thumbnail.
let decodeQueue: Promise<unknown> = Promise.resolve();

export function computeWaveformPeaks(
  audioUri: string,
  numberOfPoints: number,
  durationMs: number
): Promise<number[]> {
  const run = decodeQueue.then(
    () => computeWaveformPeaksUnserialized(audioUri, numberOfPoints, durationMs),
    () => computeWaveformPeaksUnserialized(audioUri, numberOfPoints, durationMs)
  );
  // Keep the chain alive regardless of this decode's outcome.
  decodeQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/**
 * Compute `numberOfPoints` peak values (0..1) for an audio file. Prefers the
 * in-house media3 / AVFoundation decoder; falls back to @siteed `extractPreview`
 * if it's unavailable or fails. `durationMs` must be > 0 (callers resolve it) so
 * the analysis window is bounded. Returns [] when no analysis could be produced.
 */
async function computeWaveformPeaksUnserialized(
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
      hasRms: analysis.dataPoints?.some((p) => typeof (p as { rms?: number }).rms === "number" && (p as { rms?: number }).rms! > 0) ?? false,
    });
    return analysisToPeaks(analysis, numberOfPoints);
  } catch (error) {
    console.warn("[waveform] extractPreview fallback failed", error);
    return [];
  }
}
