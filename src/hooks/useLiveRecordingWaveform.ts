import { useCallback, useRef, useState } from "react";
import { AudioAnalysis, AudioDataEvent, DataPoint } from "@siteed/audio-studio";

type Args = {
  channels: number;
  sampleRate: number;
  segmentDurationMs: number;
  windowDurationMs?: number;
};

const DEFAULT_WINDOW_DURATION_MS = 12000;
const SILENCE_DB_THRESHOLD = -55;

function concatFloat32(a: Float32Array<ArrayBufferLike>, b: Float32Array<ArrayBufferLike>) {
  if (a.length === 0) {
    return b;
  }
  if (b.length === 0) {
    return a;
  }

  const merged = new Float32Array(a.length + b.length) as Float32Array<ArrayBufferLike>;
  merged.set(a, 0);
  merged.set(b, a.length);
  return merged;
}

function emptyAnalysis(segmentDurationMs: number, channels: number, sampleRate: number): AudioAnalysis {
  return {
    segmentDurationMs,
    durationMs: 0,
    bitDepth: 32,
    samples: 0,
    numberOfChannels: channels,
    sampleRate,
    dataPoints: [],
    amplitudeRange: { min: 0, max: 0 },
    rmsRange: { min: 0, max: 0 },
    extractionTimeMs: 0,
  };
}

export function useLiveRecordingWaveform({
  channels,
  sampleRate,
  segmentDurationMs,
  windowDurationMs = DEFAULT_WINDOW_DURATION_MS,
}: Args) {
  const [waveform, setWaveform] = useState<AudioAnalysis>(() =>
    emptyAnalysis(segmentDurationMs, channels, sampleRate)
  );
  const pendingSamplesRef = useRef<Float32Array<ArrayBufferLike>>(new Float32Array(0));
  const nextPointIdRef = useRef(1);
  const streamDurationMsRef = useRef(0);
  const pointsRef = useRef<DataPoint[]>([]);

  const reset = useCallback(() => {
    pendingSamplesRef.current = new Float32Array(0);
    nextPointIdRef.current = 1;
    streamDurationMsRef.current = 0;
    pointsRef.current = [];
    setWaveform(emptyAnalysis(segmentDurationMs, channels, sampleRate));
  }, [channels, sampleRate, segmentDurationMs]);

  const appendAudioStream = useCallback(
    (event: AudioDataEvent) => {
      if (event.streamFormat !== "float32" || !(event.data instanceof Float32Array)) {
        return;
      }

      const framesPerSegment = Math.max(1, Math.round((sampleRate * segmentDurationMs) / 1000));
      const samplesPerSegment = framesPerSegment * channels;
      const mergedSamples = concatFloat32(pendingSamplesRef.current, event.data);
      const completeSegmentCount = Math.floor(mergedSamples.length / samplesPerSegment);

      if (completeSegmentCount <= 0) {
        pendingSamplesRef.current = mergedSamples;
        return;
      }

      const nextPoints: DataPoint[] = [];
      let amplitudeMin = Number.POSITIVE_INFINITY;
      let amplitudeMax = Number.NEGATIVE_INFINITY;
      let rmsMin = Number.POSITIVE_INFINITY;
      let rmsMax = Number.NEGATIVE_INFINITY;

      for (let segmentIndex = 0; segmentIndex < completeSegmentCount; segmentIndex += 1) {
        const startSample = segmentIndex * samplesPerSegment;
        const endSample = startSample + samplesPerSegment;

        let peakAmplitude = 0;
        let sumSquares = 0;
        for (let sampleIndex = startSample; sampleIndex < endSample; sampleIndex += 1) {
          const amplitude = Math.abs(mergedSamples[sampleIndex] ?? 0);
          if (amplitude > peakAmplitude) {
            peakAmplitude = amplitude;
          }
          sumSquares += amplitude * amplitude;
        }

        const sampleCount = Math.max(1, endSample - startSample);
        const rms = Math.sqrt(sumSquares / sampleCount);
        const dB = 20 * Math.log10(Math.max(rms, 0.00001));
        const startTime = streamDurationMsRef.current;
        const exactDurationMs = (framesPerSegment / sampleRate) * 1000;
        const endTime = startTime + exactDurationMs;

        amplitudeMin = Math.min(amplitudeMin, peakAmplitude);
        amplitudeMax = Math.max(amplitudeMax, peakAmplitude);
        rmsMin = Math.min(rmsMin, rms);
        rmsMax = Math.max(rmsMax, rms);

        nextPoints.push({
          id: nextPointIdRef.current,
          amplitude: peakAmplitude,
          rms,
          dB,
          silent: dB <= SILENCE_DB_THRESHOLD,
          startTime,
          endTime,
          samples: sampleCount,
        });

        nextPointIdRef.current += 1;
        streamDurationMsRef.current = endTime;
      }

      const consumedSampleCount = completeSegmentCount * samplesPerSegment;
      pendingSamplesRef.current = mergedSamples.slice(consumedSampleCount);

      const visiblePoints = [...pointsRef.current, ...nextPoints].filter((point) => {
        const pointEndTime = point.endTime ?? 0;
        return pointEndTime >= streamDurationMsRef.current - windowDurationMs;
      });

      pointsRef.current = visiblePoints;

      const amplitudeRange =
        visiblePoints.length > 0
          ? visiblePoints.reduce(
              (range, point) => ({
                min: Math.min(range.min, point.amplitude),
                max: Math.max(range.max, point.amplitude),
              }),
              { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY }
            )
          : { min: 0, max: 0 };

      const rmsRange =
        visiblePoints.length > 0
          ? visiblePoints.reduce(
              (range, point) => ({
                min: Math.min(range.min, point.rms),
                max: Math.max(range.max, point.rms),
              }),
              { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY }
            )
          : { min: 0, max: 0 };

      setWaveform({
        segmentDurationMs,
        durationMs: streamDurationMsRef.current,
        bitDepth: 32,
        samples: 0,
        numberOfChannels: channels,
        sampleRate,
        dataPoints: visiblePoints,
        amplitudeRange:
          Number.isFinite(amplitudeRange.min) && Number.isFinite(amplitudeRange.max)
            ? amplitudeRange
            : { min: 0, max: 0 },
        rmsRange:
          Number.isFinite(rmsRange.min) && Number.isFinite(rmsRange.max)
            ? rmsRange
            : { min: 0, max: 0 },
        extractionTimeMs: 0,
      });
    },
    [channels, sampleRate, segmentDurationMs, windowDurationMs]
  );

  return {
    waveform,
    appendAudioStream,
    reset,
  };
}
