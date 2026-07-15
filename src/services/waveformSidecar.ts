import * as FileSystem from "expo-file-system/legacy";
import { MAX_DETAILED_AUDIO_ANALYSIS_DURATION_MS, loadAudioDurationMs } from "./audioStorage";
import { isForegroundAudioBusy } from "./audioForegroundActivity";
import { computeWaveformPeaks, type WaveformDecodeMode } from "./waveformAnalysis";
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

/**
 * In-memory cache of decoded sidecars, keyed by audio uri.
 *
 * Reading one costs two async FS round-trips plus a 2048-number JSON parse — and
 * that lands on a JS thread already busy opening the player, so the reel's first
 * frames render from the low-res thumbnail and then visibly upgrade. Sidecars are
 * immutable for a given audio file (a new take is a new uri), so caching is safe;
 * invalidated explicitly on write/delete.
 *
 * Bounded: a few hundred KB at the cap, and entries are plain number[].
 */
const sidecarCache = new Map<string, number[]>();
const SIDECAR_CACHE_LIMIT = 24;

function cacheSidecar(audioUri: string, peaks: number[]) {
  // Cheap LRU: re-inserting moves the key to the end of Map iteration order, so the
  // oldest untouched entry is always the first one out.
  sidecarCache.delete(audioUri);
  sidecarCache.set(audioUri, peaks);
  if (sidecarCache.size > SIDECAR_CACHE_LIMIT) {
    const oldest = sidecarCache.keys().next();
    if (!oldest.done) sidecarCache.delete(oldest.value);
  }
}

/** Cached sidecar for `audioUri`, or null. Synchronous — lets a surface render the
 *  real waveform on its FIRST frame instead of upgrading into it a beat later. */
export function peekWaveformSidecar(audioUri: string): number[] | null {
  const cached = sidecarCache.get(audioUri);
  if (!cached) return null;
  cacheSidecar(audioUri, cached); // touch for LRU
  return cached;
}

export async function readWaveformSidecar(audioUri: string): Promise<number[] | null> {
  const cached = peekWaveformSidecar(audioUri);
  if (cached) return cached;
  try {
    const path = waveformSidecarUri(audioUri);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const peaks = decode(await FileSystem.readAsStringAsync(path));
    if (peaks) cacheSidecar(audioUri, peaks);
    return peaks;
  } catch {
    return null;
  }
}

export async function writeWaveformSidecar(audioUri: string, peaks: number[]): Promise<void> {
  if (!peaks.length) return;
  try {
    await FileSystem.writeAsStringAsync(waveformSidecarUri(audioUri), encode(peaks));
    // Warm the cache with what we just wrote: background hydration pre-builds
    // sidecars, so a clip analyzed this session opens at full resolution on its
    // first frame — no disk read at all.
    cacheSidecar(audioUri, peaks);
  } catch (error) {
    console.warn("[waveform] sidecar write failed", error);
  }
}

export async function deleteWaveformSidecar(audioUri: string): Promise<void> {
  sidecarCache.delete(audioUri);
  try {
    await FileSystem.deleteAsync(waveformSidecarUri(audioUri), { idempotent: true });
  } catch {
    // Best-effort: a leftover/locked sidecar is harmless — it regenerates on demand.
  }
}

/** Decode the audio once (downsampled, memory-safe) into the detail waveform and
 *  persist it next to the audio. Returns the peaks, or null on failure/skip —
 *  background-mode callers treat null as "retry when idle". */
export async function generateWaveformSidecar(
  audioUri: string,
  durationMs?: number,
  options?: { mode?: WaveformDecodeMode }
): Promise<number[] | null> {
  const mode = options?.mode ?? "background";
  try {
    // The duration probe spins up a second native player — background work must not
    // run it against active playback (the decode itself is gated inside the decode
    // queue, but this probe isn't).
    if (mode === "background" && !(durationMs && durationMs > 0) && isForegroundAudioBusy()) {
      return null;
    }
    const resolvedDurationMs =
      durationMs && durationMs > 0 ? durationMs : await loadAudioDurationMs(audioUri);
    if (!resolvedDurationMs || resolvedDurationMs <= 0) return null;
    // Very long files (30 min+ voice memos/lessons) would decode for many seconds and
    // contend with playback for little visual gain — the reel shows the inline thumbnail
    // instead, matching the metadata path's cap.
    if (resolvedDurationMs > MAX_DETAILED_AUDIO_ANALYSIS_DURATION_MS) return null;
    const peaks = await computeWaveformPeaks(audioUri, WAVEFORM_DETAIL_BINS, resolvedDurationMs, { mode });
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
  durationMs?: number,
  options?: { mode?: WaveformDecodeMode }
): Promise<number[] | null> {
  const existing = await readWaveformSidecar(audioUri);
  if (existing) return existing;
  return generateWaveformSidecar(audioUri, durationMs, options);
}
