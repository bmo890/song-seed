import { useSyncExternalStore } from "react";
import type { AudioAnalysis, AudioDataEvent } from "@siteed/audio-studio";
import {
  appendLiveWaveform,
  emptyLiveWaveformState,
  liveWaveformRange,
  type LiveWaveformShape,
  type LiveWaveformState,
} from "../domain/liveWaveform";
import {
  appendOnsetSamples,
  createOnsetEnvelopeState,
  type OnsetEnvelopeState,
} from "../domain/onsetEnvelope";
import type { TempoMap } from "../domain/tempoMap";
import type { PracticeMarker, RecordingGrid } from "../types";

/**
 * The take being captured, as one object that outlives any screen.
 *
 * The native recorder is shared app-wide, but everything the app KNEW about the take —
 * the live tape, the onset envelope the beat grid is verified against, the count-in
 * head to cut at save, when capture started — used to live in React state inside the
 * recorder screen's hook instance, fed by a stream callback closed over that instance.
 * Minimizing the recorder unmounted it: the reopened screen showed an empty tape, and a
 * take saved from there lost its head trim and its grid envelope (2026-09-23).
 *
 * Every hook instance now reads and writes this one session. Subscribable fields go
 * through useSyncExternalStore so the screen re-renders from wherever the data lands.
 */

/**
 * Where a take lands, fixed when it starts (audit 2026-11-02, 12d D-H2). Every record
 * button used to re-arm the store's recording context, so pressing one while a take was
 * minimised re-aimed the running take: a sketch take saved as a clip elsewhere, a layer
 * as a plain clip.
 */
export type RecordingDestination = {
  ideaId: string | null;
  parentClipId: string | null;
  overdubClipId: string | null;
  guideMixUri: string | null;
  punchInMs: number | null;
};

/** The running take's measured beat grid, in capture-file ms (drives the live ruler). */
export type LiveTakeGrid = {
  firstBeatCaptureMs: number;
  beatMs: number;
  pulsesPerBar: number;
  /** Programmed tempo/meter changes. Without it the live ruler drew the FIRST segment's
   *  spacing for the whole take, so from the first change onward it was measuring the
   *  performance against a beat length the click had stopped playing. */
  tempoMap?: TempoMap | null;
  /** The correction the grid was stamped with in the CLICK's domain (click output delay
   *  + mic delay): how far the engine's render grid runs ahead of the capture. Resume
   *  needs it to pick the click back up where it left off. */
  clickLeadMs?: number;
};

export type HeadTrim = { pending: boolean; ms: number };
export type Interruption = { token: number; reason: string | null };
export type CaptureStart = { epochMs: number; source: string };

type Listener = () => void;

function createChannel<T>(initial: T) {
  let value = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => value,
    set: (next: T) => {
      if (Object.is(next, value)) return;
      value = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function emptyAnalysis(shape: LiveWaveformShape): AudioAnalysis {
  return {
    segmentDurationMs: shape.segmentDurationMs,
    durationMs: 0,
    bitDepth: 32,
    samples: 0,
    numberOfChannels: shape.channels,
    sampleRate: shape.sampleRate,
    dataPoints: [],
    amplitudeRange: { min: 0, max: 0 },
    rmsRange: { min: 0, max: 0 },
    extractionTimeMs: 0,
  };
}

export function createRecordingTakeSession(shape: LiveWaveformShape) {
  let liveState: LiveWaveformState = emptyLiveWaveformState();
  const liveWaveform = createChannel<AudioAnalysis>(emptyAnalysis(shape));
  const headTrim = createChannel<HeadTrim>({ pending: false, ms: 0 });
  const interruption = createChannel<Interruption>({ token: 0, reason: null });
  // What the musician added to the take while it rolls. These lived in the recorder
  // screen, so minimise-and-reopen dropped the pins and the beat grid without a word
  // (audit 2026-11-02, 12d D-M1).
  const livePins = createChannel<PracticeMarker[]>([]);
  const liveTakeGrid = createChannel<LiveTakeGrid | null>(null);

  let onsetEnvelope: OnsetEnvelopeState = createOnsetEnvelopeState(shape.sampleRate, shape.channels);

  // Plain facts about the take in flight. Not subscribable: read at decision points only.
  const facts = {
    /** JS-side stamp taken just before the native start call. */
    recordingStartedAt: null as number | null,
    /** Exact capture start reported by the patched native recorder; null on unpatched binaries. */
    captureStartNative: null as CaptureStart | null,
    /** Estimate of capture start from early duration reports (min over the first ~2 s). */
    captureStartEstimate: { epochMs: null as number | null, samples: 0 },
    /** The pending-take recovery marker has been written for this take. */
    sessionPersisted: false,
    /**
     * The file this take is being written to, from the moment the recorder names it until
     * the take is settled (saved into the library, kept for recovery, or thrown away).
     * Take recovery never touches it: on Android an activity rebuild reran the launch
     * recovery inside a live take and deleted the file the recorder was still writing
     * (audit 2026-11-02, 03-3 / 10-H1).
     */
    fileUri: null as string | null,
    /** Where this take lands, fixed when it starts. */
    destination: null as RecordingDestination | null,
    /** The beat grid the take is recorded against (snapshotted at the downbeat). */
    takeGrid: null as RecordingGrid | null,
    /** The punch-in the take was armed with (a layer's place on the master). */
    punchInMs: null as number | null,
    /** The take uses the metronome (the toggle is locked while it rolls). */
    metronomeEnabled: false,
    /** prepareRecording ran and the native recorder is armed but not started. */
    prepared: false,
    /** The next "recordingStopped" event is one we asked for, not an interruption. */
    expectedStop: false,
  };

  function resetLiveWaveform() {
    liveState = emptyLiveWaveformState();
    liveWaveform.set(emptyAnalysis(shape));
  }

  function resetOnsetEnvelope() {
    onsetEnvelope = createOnsetEnvelopeState(shape.sampleRate, shape.channels);
  }

  function resetCaptureStart() {
    facts.captureStartNative = null;
    facts.captureStartEstimate = { epochMs: null, samples: 0 };
  }

  /** Everything a new take starts from. Called before every start/prepare. */
  function beginTake() {
    facts.recordingStartedAt = null;
    facts.sessionPersisted = false;
    resetCaptureStart();
    headTrim.set({ pending: false, ms: 0 });
    resetLiveWaveform();
    resetOnsetEnvelope();
  }

  /**
   * `retainPoints: false` keeps the CLOCK running while dropping the picture — used for a
   * record-through count-in, where capture is rolling but the audio will be trimmed off
   * at save. See `domain/liveWaveform.ts` for why the clock must not stop.
   */
  function appendAudioStream(
    event: AudioDataEvent,
    { retainPoints = true, hideBeforeMs = 0 }: { retainPoints?: boolean; hideBeforeMs?: number } = {}
  ) {
    if (event.streamFormat !== "float32" || !(event.data instanceof Float32Array)) return;
    const { state, changed } = appendLiveWaveform(liveState, event.data, shape, { retainPoints, hideBeforeMs });
    liveState = state;
    if (!changed) return;
    liveWaveform.set({
      segmentDurationMs: shape.segmentDurationMs,
      durationMs: state.streamDurationMs,
      bitDepth: 32,
      samples: 0,
      numberOfChannels: shape.channels,
      sampleRate: shape.sampleRate,
      dataPoints: state.points,
      amplitudeRange: liveWaveformRange(state.points, "amplitude"),
      rmsRange: liveWaveformRange(state.points, "rms"),
      extractionTimeMs: 0,
    });
  }

  function appendOnset(samples: Float32Array) {
    appendOnsetSamples(onsetEnvelope, samples);
  }

  /** Feed one early duration report into the capture-start estimator. */
  function observeDuration(durationMs: number) {
    const estimate = facts.captureStartEstimate;
    // Only the first ~2 s of updates matter; freeze afterwards so pauses can't skew it.
    if (estimate.samples >= 50) return;
    if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 2500) return;
    const candidate = Date.now() - durationMs;
    estimate.epochMs = estimate.epochMs === null ? candidate : Math.min(estimate.epochMs, candidate);
    estimate.samples += 1;
  }

  /** When capture began (epoch ms): native measurement, else the estimate, else the JS
   *  stamp. Null when nothing is recording. */
  function getCaptureStartEpochMs() {
    return facts.captureStartNative?.epochMs ?? facts.captureStartEstimate.epochMs ?? facts.recordingStartedAt;
  }

  /** The take is settled (saved, kept for recovery, or thrown away): it no longer holds
   *  its file or its destination, and recovery may look at its file again. */
  function releaseTake() {
    facts.fileUri = null;
    facts.destination = null;
  }

  return {
    shape,
    facts,
    liveWaveform,
    headTrim,
    interruption,
    livePins,
    liveTakeGrid,
    releaseTake,
    getOnsetEnvelope: () => onsetEnvelope,
    beginTake,
    resetLiveWaveform,
    resetOnsetEnvelope,
    resetCaptureStart,
    appendAudioStream,
    appendOnset,
    observeDuration,
    getCaptureStartEpochMs,
    noteInterruption: (reason: string) =>
      interruption.set({ token: interruption.get().token + 1, reason }),
  };
}

export type RecordingTakeSession = ReturnType<typeof createRecordingTakeSession>;

let activeSession: RecordingTakeSession | null = null;

/** The one take session the app records through. Created on first use with the capture shape. */
export function getRecordingTakeSession(shape: LiveWaveformShape): RecordingTakeSession {
  if (!activeSession) activeSession = createRecordingTakeSession(shape);
  return activeSession;
}

/** The capture format every take uses (mono 44.1k, 40 ms tape segments, 12 s window). */
export const RECORDING_TAKE_SHAPE: LiveWaveformShape = {
  channels: 1,
  sampleRate: 44100,
  segmentDurationMs: 40,
  windowDurationMs: 12000,
};

/** The app-wide take session, for leaves that draw it (the live tape) without going
 *  through the recorder hook. */
export function getActiveRecordingTakeSession(): RecordingTakeSession {
  return getRecordingTakeSession(RECORDING_TAKE_SHAPE);
}

/**
 * A take holds the recorder from the moment it starts until it is settled — minimised,
 * paused or rolling, and across a screen (or Android activity) rebuild. While it does,
 * no record button may start or re-aim a take: they bring this one back instead.
 */
export function takeHoldsRecorder(): boolean {
  const facts = activeSession?.facts;
  return !!facts && (facts.fileUri !== null || facts.recordingStartedAt !== null);
}

/** The destination the running take was started with, or null. */
export function heldTakeDestination(): RecordingDestination | null {
  return takeHoldsRecorder() ? activeSession?.facts.destination ?? null : null;
}

export function useTakeLivePins(session: RecordingTakeSession): PracticeMarker[] {
  return useSyncExternalStore(session.livePins.subscribe, session.livePins.get, session.livePins.get);
}

export function useTakeLiveGrid(session: RecordingTakeSession): LiveTakeGrid | null {
  return useSyncExternalStore(session.liveTakeGrid.subscribe, session.liveTakeGrid.get, session.liveTakeGrid.get);
}

export function useTakeLiveWaveform(session: RecordingTakeSession): AudioAnalysis {
  return useSyncExternalStore(session.liveWaveform.subscribe, session.liveWaveform.get, session.liveWaveform.get);
}

export function useTakeHeadTrim(session: RecordingTakeSession): HeadTrim {
  return useSyncExternalStore(session.headTrim.subscribe, session.headTrim.get, session.headTrim.get);
}

export function useTakeInterruption(session: RecordingTakeSession): Interruption {
  return useSyncExternalStore(session.interruption.subscribe, session.interruption.get, session.interruption.get);
}
