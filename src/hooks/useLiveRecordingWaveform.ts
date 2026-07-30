import { useCallback, useRef, useState } from "react";
import { AudioAnalysis, AudioDataEvent } from "@siteed/audio-studio";
import {
  appendLiveWaveform,
  emptyLiveWaveformState,
  liveWaveformRange,
  type LiveWaveformState,
} from "../domain/liveWaveform";

type Args = {
  channels: number;
  sampleRate: number;
  segmentDurationMs: number;
  windowDurationMs?: number;
};

const DEFAULT_WINDOW_DURATION_MS = 12000;

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
  const stateRef = useRef<LiveWaveformState>(emptyLiveWaveformState());

  const reset = useCallback(() => {
    stateRef.current = emptyLiveWaveformState();
    setWaveform(emptyAnalysis(segmentDurationMs, channels, sampleRate));
  }, [channels, sampleRate, segmentDurationMs]);

  /**
   * `retainPoints: false` keeps the CLOCK running while dropping the picture — used for a
   * record-through count-in, where capture is rolling but the audio will be trimmed off at
   * save. See `domain/liveWaveform.ts` for why the clock must not stop: the tape's axis and
   * the beat grid's axis are both capture ms, and they only agree if nothing re-zeroes one
   * of them mid-take.
   */
  const appendAudioStream = useCallback(
    (event: AudioDataEvent, { retainPoints = true }: { retainPoints?: boolean } = {}) => {
      if (event.streamFormat !== "float32" || !(event.data instanceof Float32Array)) {
        return;
      }

      const { state, changed } = appendLiveWaveform(
        stateRef.current,
        event.data,
        { channels, sampleRate, segmentDurationMs, windowDurationMs },
        { retainPoints }
      );
      stateRef.current = state;
      if (!changed) return;

      setWaveform({
        segmentDurationMs,
        durationMs: state.streamDurationMs,
        bitDepth: 32,
        samples: 0,
        numberOfChannels: channels,
        sampleRate,
        dataPoints: state.points,
        amplitudeRange: liveWaveformRange(state.points, "amplitude"),
        rmsRange: liveWaveformRange(state.points, "rms"),
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
