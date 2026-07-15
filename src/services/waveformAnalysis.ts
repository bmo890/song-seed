import { extractPreview } from "@siteed/audio-studio";
import SongseedPitchShiftModule from "../../modules/songseed-pitch-shift";
import { isForegroundAudioBusy, waitForForegroundAudioIdle } from "./audioForegroundActivity";
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

// Cancellation epoch — the single source of truth for preemption, shared with the
// native decoder. Every BACKGROUND decode carries the epoch it started under into
// its native request; play-initiation bumps the epoch and forwards it to native,
// which aborts any decode holding an older token (including one whose native body
// hadn't started when the cancel landed — the token travels with the request, so
// there is no check-then-dispatch race). Queued background decodes are NOT flushed:
// they re-gate on foreground idleness when their turn comes, so idle-time work
// still happens instead of being discarded by a long-past play press.
let cancelEpoch = 1;

const WAVEFORM_CANCELLED = "WAVEFORM_CANCELLED";

function isWaveformCancellation(error: unknown): boolean {
  return error instanceof Error && error.message.includes(WAVEFORM_CANCELLED);
}

/**
 * Decode scheduling mode.
 *  - "background": derived-data work (hydration queue, idle sidecar generation).
 *    Waits for foreground playback to go idle before starting, and is flushed or
 *    aborted when playback begins. Callers MUST treat an empty result as
 *    "skipped — retry later", never as a final answer to persist.
 *  - "interactive": the user is waiting on this decode (editor save/export, the
 *    stem-alignment overlay, player-open hydration). Serialized with everything
 *    else but never idle-gated and never flushed/aborted by play — decoding
 *    alongside playback is the deliberate trade these flows make.
 */
export type WaveformDecodeMode = "background" | "interactive";

/** Mode of the decode currently inside the native decoder (null when none). Lets
 *  cancelActiveWaveformDecode abort background work without killing a decode the
 *  user is actively waiting on. */
let activeDecodeMode: WaveformDecodeMode | null = null;

/**
 * Preempt BACKGROUND waveform decoding because foreground playback is starting.
 * Aborts an in-flight background decode (if the build supports it); background
 * decodes still queued simply wait for playback to go idle before running.
 * Cancelled decodes return empty and retry when idle — nothing partial is ever
 * persisted. Interactive decodes are left alone: the user asked for them.
 */
export function cancelActiveWaveformDecode(): void {
  cancelEpoch += 1;
  if (activeDecodeMode !== "background") return;
  try {
    SongseedPitchShiftModule?.cancelActiveWaveform?.(cancelEpoch);
  } catch {
    // Best-effort: an older native build without the cancel hook just finishes its decode.
  }
}

/** Current cancellation epoch. Callers that need to classify an empty decode result
 *  can snapshot this before the decode and compare after: a bump in between means a
 *  play press preempted the work (retry when idle), not that the decode failed. */
export function getWaveformCancelEpoch(): number {
  return cancelEpoch;
}

type DecodeOptions = { mode?: WaveformDecodeMode };

export function computeWaveformPeaks(
  audioUri: string,
  numberOfPoints: number,
  durationMs: number,
  options?: DecodeOptions
): Promise<number[]> {
  return enqueueDecode(
    (epoch) => computeWaveformPeaksUnserialized(audioUri, numberOfPoints, durationMs, epoch),
    [],
    options?.mode ?? "background"
  );
}

/**
 * Like computeWaveformPeaks, but lets the NATIVE decoder supply the duration when the
 * caller doesn't know it (the decoder reads it from the container for free). Used by
 * metadata hydration so a clip whose expo-audio duration probe timed out still gets a
 * real duration instead of staying "0:00" forever.
 */
export function computeWaveformWithNativeDuration(
  audioUri: string,
  numberOfPoints: number,
  options?: DecodeOptions
): Promise<{ peaks: number[]; durationMs?: number }> {
  return enqueueDecode(
    (epoch) => computeWaveformWithNativeDurationUnserialized(audioUri, numberOfPoints, epoch),
    { peaks: [] },
    options?.mode ?? "background"
  );
}

/** Epoch passed for decodes that must never be preempted (native treats a missing
 *  request epoch the same way; this is the explicit spelling for interactive work). */
const UNCANCELLABLE_EPOCH = undefined;

function enqueueDecode<T>(
  task: (epoch: number | undefined) => Promise<T>,
  emptyResult: T,
  mode: WaveformDecodeMode
): Promise<T> {
  const gatedTask = async (): Promise<T> => {
    let epoch: number | undefined = UNCANCELLABLE_EPOCH;
    if (mode === "background") {
      // Gate at START, not enqueue: never begin a background decode while the
      // foreground player is loading or playing (the enqueue-time state can be
      // minutes stale by the time the queue reaches this job). If the idle wait
      // capped out while playback continues, skip — callers treat empty as
      // "retry later", which beats contending with the player.
      await waitForForegroundAudioIdle();
      if (isForegroundAudioBusy()) return emptyResult;
      // Snapshot the epoch NOW (post-wait): only a play press AFTER this decode
      // starts should abort it. The token rides in the native request, so a cancel
      // landing during dispatch still catches it.
      epoch = cancelEpoch;
    }
    activeDecodeMode = mode;
    try {
      return await task(epoch);
    } finally {
      activeDecodeMode = null;
    }
  };
  const run = decodeQueue.then(gatedTask, gatedTask);
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
  durationMs: number,
  epoch?: number
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
        epoch,
      });
      if (result?.peaks?.length) {
        console.log("[waveform] decoder=native", { rawPoints: result.peaks.length, requested: numberOfPoints });
        return result.peaks.map(clamp01);
      }
      console.warn("[waveform] native computeWaveform returned no points; falling back to @siteed");
    } catch (error) {
      if (isWaveformCancellation(error)) {
        // Preempted by play — return empty WITHOUT falling back to the @siteed
        // decoder (which would recreate the very contention the cancel cleared).
        console.log("[waveform] decode cancelled by playback");
        return [];
      }
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

/** Native-decoder path that also reports the container duration (endTimeMs 0 = whole
 *  file; the decoder reads the real duration from the container). No @siteed fallback:
 *  this is a metadata-repair path and the fallback decoder can't supply a duration —
 *  callers treat an empty result as "retry later". */
async function computeWaveformWithNativeDurationUnserialized(
  audioUri: string,
  numberOfPoints: number,
  epoch?: number
): Promise<{ peaks: number[]; durationMs?: number }> {
  const native = SongseedPitchShiftModule;
  if (!native?.computeWaveform) {
    return { peaks: [] };
  }

  try {
    const result = await native.computeWaveform({
      inputUri: audioUri,
      numberOfPoints,
      startTimeMs: 0,
      endTimeMs: 0,
      epoch,
    });
    const nativeDurationMs =
      typeof result?.durationMs === "number" && result.durationMs > 0
        ? Math.round(result.durationMs)
        : undefined;
    return {
      peaks: result?.peaks?.length ? result.peaks.map(clamp01) : [],
      durationMs: nativeDurationMs,
    };
  } catch (error) {
    if (isWaveformCancellation(error)) {
      console.log("[waveform] duration-probe decode cancelled by playback");
      return { peaks: [] };
    }
    console.warn("[waveform] native duration-probe decode failed", error);
    return { peaks: [] };
  }
}

/**
 * Cheap native duration probe: reads the container's declared duration via a
 * metadata-only native call (Android MediaExtractor KEY_DURATION, iOS
 * AVURLAsset.duration) — NO PCM decode and NO AVPlayer/MediaPlayer item load. Costs
 * ~milliseconds per file, so bulk import can fill every clip's length up front.
 *
 * Deliberately NOT routed through the decode serializer: a metadata read touches
 * neither the MediaCodec pool nor audio focus, so it's safe to run concurrently with
 * playback and decodes and must not queue behind slow waveform work.
 *
 * Returns undefined when the native method is absent (older build / web) or the probe
 * fails — callers then leave the duration for background hydration, exactly as before
 * this method existed.
 */
export async function getNativeAudioDurationMs(audioUri: string): Promise<number | undefined> {
  const native = SongseedPitchShiftModule;
  if (!native?.getAudioDurationMs) return undefined;
  try {
    const result = await native.getAudioDurationMs({ inputUri: audioUri });
    return typeof result?.durationMs === "number" && result.durationMs > 0
      ? Math.round(result.durationMs)
      : undefined;
  } catch (error) {
    console.warn("[waveform] native duration probe failed", error);
    return undefined;
  }
}
