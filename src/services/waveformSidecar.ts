import * as FileSystem from "expo-file-system/legacy";
import { MAX_DETAILED_AUDIO_ANALYSIS_DURATION_MS, loadAudioDurationMs } from "./audioStorage";
import { computeWaveformPeaks } from "./waveformAnalysis";
import { waveformSidecarUri } from "./storagePaths";

/**
 * High-resolution detail waveform stored as a sidecar file next to each clip's
 * audio (`<audioUri>.waveform`). The persisted Zustand state only carries a small
 * inline thumbnail; this keeps the one-blob persistence lean while the editor and
 * player reels get a crisp, accurate envelope. The sidecar is derived data —
 * regenerable from the audio at any time — so it is loaded lazily, cached on first
 * access, and self-heals if ever deleted or missing.
 */

/** Detail bin count. The reel draws the whole clip with (canvasWidth / 3px) × maxZoom(10)
 *  bars — bounded by zoom, not clip length — so a fixed count keeps every clip sharp
 *  from 1× to 10× on phones and large tablets alike. */
export const WAVEFORM_DETAIL_BINS = 2048;

type SidecarFile = { v: number; bins: number[] };

/** 8-bit quantized JSON — visually lossless for an envelope, ~a few KB on disk. */
function encode(peaks: number[]): string {
  const bins = peaks.map((peak) => Math.max(0, Math.min(255, Math.round(peak * 255))));
  return JSON.stringify({ v: 1, bins } satisfies SidecarFile);
}

function decode(raw: string): number[] | null {
  try {
    const parsed = JSON.parse(raw) as SidecarFile;
    if (!parsed || !Array.isArray(parsed.bins) || parsed.bins.length === 0) return null;
    return parsed.bins.map((bin) => Math.max(0, Math.min(1, bin / 255)));
  } catch {
    return null;
  }
}

export async function readWaveformSidecar(audioUri: string): Promise<number[] | null> {
  try {
    const path = waveformSidecarUri(audioUri);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    return decode(await FileSystem.readAsStringAsync(path));
  } catch {
    return null;
  }
}

export async function writeWaveformSidecar(audioUri: string, peaks: number[]): Promise<void> {
  if (!peaks.length) return;
  try {
    await FileSystem.writeAsStringAsync(waveformSidecarUri(audioUri), encode(peaks));
  } catch (error) {
    console.warn("[waveform] sidecar write failed", error);
  }
}

export async function deleteWaveformSidecar(audioUri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(waveformSidecarUri(audioUri), { idempotent: true });
  } catch {
    // Best-effort: a leftover/locked sidecar is harmless — it regenerates on demand.
  }
}

/** Decode the audio once (downsampled, memory-safe) into the detail waveform and
 *  persist it next to the audio. Returns the peaks, or null on failure. */
export async function generateWaveformSidecar(
  audioUri: string,
  durationMs?: number
): Promise<number[] | null> {
  try {
    const resolvedDurationMs =
      durationMs && durationMs > 0 ? durationMs : await loadAudioDurationMs(audioUri);
    if (!resolvedDurationMs || resolvedDurationMs <= 0) return null;
    // Very long files (30 min+ voice memos/lessons) would decode for many seconds and
    // contend with playback for little visual gain — the reel shows the inline thumbnail
    // instead, matching the metadata path's cap.
    if (resolvedDurationMs > MAX_DETAILED_AUDIO_ANALYSIS_DURATION_MS) return null;
    const peaks = await computeWaveformPeaks(audioUri, WAVEFORM_DETAIL_BINS, resolvedDurationMs);
    if (peaks.length) await writeWaveformSidecar(audioUri, peaks);
    return peaks.length ? peaks : null;
  } catch (error) {
    console.warn("[waveform] sidecar generation failed", error);
    return null;
  }
}

/** Read the detail waveform, generating + caching it on first access. */
export async function ensureWaveformSidecar(
  audioUri: string,
  durationMs?: number
): Promise<number[] | null> {
  const existing = await readWaveformSidecar(audioUri);
  if (existing) return existing;
  return generateWaveformSidecar(audioUri, durationMs);
}
