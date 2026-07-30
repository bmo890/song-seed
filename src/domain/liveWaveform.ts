/**
 * The live tape's time axis.
 *
 * Every candle on the recording tape, and every line of the beat grid drawn over it, is
 * addressed in CAPTURE MS — milliseconds since the recorder's sample 0. That single origin
 * is the whole contract: the grid is stamped from the metronome anchor as
 * `downbeatEpoch − captureStartEpoch`, so the moment the wave starts measuring from a
 * different zero, the ruler becomes decoration.
 *
 * It became decoration once. A record-through count-in dropped its audio deliveries and
 * re-zeroed the clock when the head trim was committed, so the wave counted from the
 * downbeat while the grid still counted from sample 0 — an offset of the whole count-in,
 * arbitrary modulo the beat, different every take. Hiding the count-in is a drawing
 * decision (`retainPoints: false`); it must never be a clock decision.
 */

import type { DataPoint } from "@siteed/audio-studio";

export type LiveWaveformState = {
  /** Samples carried over from the last delivery: a segment is only emitted when full. */
  pendingSamples: Float32Array;
  /** Capture ms of the end of the newest complete segment. THE axis. */
  streamDurationMs: number;
  nextPointId: number;
  points: DataPoint[];
};

export type LiveWaveformShape = {
  channels: number;
  sampleRate: number;
  segmentDurationMs: number;
  windowDurationMs: number;
};

const SILENCE_DB_THRESHOLD = -55;

export function emptyLiveWaveformState(): LiveWaveformState {
  return {
    pendingSamples: new Float32Array(0),
    streamDurationMs: 0,
    nextPointId: 1,
    points: [],
  };
}

function concatFloat32(a: Float32Array, b: Float32Array): Float32Array {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  const merged = new Float32Array(a.length + b.length);
  merged.set(a, 0);
  merged.set(b, a.length);
  return merged;
}

/**
 * Fold one delivery into the tape.
 *
 * `retainPoints: false` advances the clock and discards the picture — the count-in case.
 * The returned state is always a new object when anything changed, and `changed` is false
 * when the delivery did not complete a segment (so a caller can skip a render).
 */
export function appendLiveWaveform(
  state: LiveWaveformState,
  samples: Float32Array,
  shape: LiveWaveformShape,
  { retainPoints = true }: { retainPoints?: boolean } = {}
): { state: LiveWaveformState; changed: boolean } {
  const { channels, sampleRate, segmentDurationMs, windowDurationMs } = shape;
  const framesPerSegment = Math.max(1, Math.round((sampleRate * segmentDurationMs) / 1000));
  const samplesPerSegment = framesPerSegment * channels;
  const merged = concatFloat32(state.pendingSamples, samples);
  const completeSegmentCount = Math.floor(merged.length / samplesPerSegment);

  if (completeSegmentCount <= 0) {
    return { state: { ...state, pendingSamples: merged }, changed: false };
  }

  const exactDurationMs = (framesPerSegment / sampleRate) * 1000;
  const nextPoints: DataPoint[] = [];
  let streamDurationMs = state.streamDurationMs;
  let nextPointId = state.nextPointId;

  for (let segmentIndex = 0; segmentIndex < completeSegmentCount; segmentIndex += 1) {
    const startSample = segmentIndex * samplesPerSegment;
    const endSample = startSample + samplesPerSegment;

    let peakAmplitude = 0;
    let sumSquares = 0;
    for (let sampleIndex = startSample; sampleIndex < endSample; sampleIndex += 1) {
      const amplitude = Math.abs(merged[sampleIndex] ?? 0);
      if (amplitude > peakAmplitude) peakAmplitude = amplitude;
      sumSquares += amplitude * amplitude;
    }

    const sampleCount = Math.max(1, endSample - startSample);
    const rms = Math.sqrt(sumSquares / sampleCount);
    const dB = 20 * Math.log10(Math.max(rms, 0.00001));
    const startTime = streamDurationMs;
    const endTime = startTime + exactDurationMs;

    nextPoints.push({
      id: nextPointId,
      amplitude: peakAmplitude,
      rms,
      dB,
      silent: dB <= SILENCE_DB_THRESHOLD,
      startTime,
      endTime,
      samples: sampleCount,
    });

    nextPointId += 1;
    // The clock advances for hidden audio exactly as it does for drawn audio. This line is
    // the invariant the beat grid rests on.
    streamDurationMs = endTime;
  }

  const kept = (retainPoints ? [...state.points, ...nextPoints] : []).filter(
    (point) => (point.endTime ?? 0) >= streamDurationMs - windowDurationMs
  );

  return {
    state: {
      pendingSamples: merged.slice(completeSegmentCount * samplesPerSegment),
      streamDurationMs,
      nextPointId,
      points: kept,
    },
    changed: true,
  };
}

export function liveWaveformRange(points: DataPoint[], key: "amplitude" | "rms") {
  if (points.length === 0) return { min: 0, max: 0 };
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    const value = point[key];
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : { min: 0, max: 0 };
}
