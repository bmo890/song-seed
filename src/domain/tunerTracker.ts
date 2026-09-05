import { TUNER_MAX_HZ, TUNER_MIN_HZ, buildTunerReading } from "./tuner";

/**
 * Pure note-tracking state machine behind the tuner screen.
 *
 * The native detector delivers one frame per audio buffer (~100 ms on iOS,
 * ~46 ms on Android) carrying a pitch and a periodicity `clarity` (0..1).
 * This tracker turns that stream into a stable display with as little lag as
 * a phone tuner can honestly have:
 *
 *  - a confident frame is shown immediately (no warm-up window);
 *  - a shakier frame needs one agreeing neighbour before it can move the note;
 *  - the note only switches when the pitch has clearly left the current note
 *    (Schmitt hysteresis around the ±50 cent boundary), so a string tuned to
 *    the edge doesn't flicker between names;
 *  - an isolated octave slip on the held note is folded back onto it;
 *  - the needle follows a median-of-3 of recent cents (kills single-frame
 *    glitches, one frame of lag) through a fast exponential smoother.
 */

export type PitchFrame = {
  pitch: number;
  /** 0..1 periodicity; undefined when the native module predates clarity. */
  clarity?: number;
  /** Input level in dBFS; informational. */
  level?: number;
  /** ms timestamp of the frame. */
  timestamp: number;
};

export type TrackerState = {
  activeNoteKey: string | null;
  /** Equal-tempered frequency of the active note. */
  referenceFrequency: number | null;
  /** Smoothed cents shown on the needle, relative to `referenceFrequency`. */
  displayCents: number | null;
  /** Recent raw cents on the active note (median input). */
  centsHistory: number[];
  /** Pending frame for a note that has not yet earned the display. */
  pending: { noteKey: string; count: number } | null;
  /** Timestamp of the last frame that updated the display. */
  lastUpdateAt: number;
};

export type TrackerOutput = {
  frequency: number;
  noteName: string;
  octave: number;
  referenceFrequency: number;
  centsOff: number;
  clarity: number;
};

export const TRACKER_CONFIG = {
  minFrequency: TUNER_MIN_HZ,
  maxFrequency: TUNER_MAX_HZ,
  /** Frames below this periodicity are ignored outright (noise, transients). */
  minClarity: 0.8,
  /** Frames at or above this periodicity may move the note on their own. */
  lockClarity: 0.92,
  /** Frames between min and lock clarity need this many in a row to move the note. */
  agreementFrames: 2,
  /** Pitch must be this far beyond the ±50 cent boundary before the note switches. */
  switchHysteresisCents: 8,
  /** An off-note frame within this many cents of an octave of the held note is folded back. */
  octaveFoldCents: 30,
  /** Median window over raw cents; odd, small — each extra frame is a frame of lag. */
  medianWindow: 3,
  /** Needle smoothing per frame; higher follows faster. */
  smoothing: {
    base: 0.5,
    /** Calmer needle once both the needle and the target sit inside the in-tune band. */
    inTune: 0.35,
    /** Big honest moves (a bend, a tuning peg turn) should not lag. */
    dramatic: 0.75,
    dramaticCents: 18,
  },
  inTuneCents: 5,
  /** Last reading stays up this long after the string stops sounding. */
  holdMs: 700,
} as const;

export function createTrackerState(): TrackerState {
  return {
    activeNoteKey: null,
    referenceFrequency: null,
    displayCents: null,
    centsHistory: [],
    pending: null,
    lastUpdateAt: 0,
  };
}

export function centsBetween(frequency: number, referenceFrequency: number) {
  return 1200 * Math.log2(frequency / referenceFrequency);
}

export function frequencyFromCents(referenceFrequency: number, centsOff: number) {
  return referenceFrequency * Math.pow(2, centsOff / 1200);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

/**
 * When the held note's detector output slips by an octave for a frame (a
 * common attack artifact on plucked strings), pull it back onto the held
 * note. Returns the folded pitch, or null when the frame is not an octave slip.
 */
export function foldOctaveTowardReference(
  pitch: number,
  referenceFrequency: number,
  toleranceCents = TRACKER_CONFIG.octaveFoldCents
) {
  for (const factor of [2, 0.5]) {
    const folded = pitch * factor;
    if (Math.abs(centsBetween(folded, referenceFrequency)) <= toleranceCents) {
      return folded;
    }
  }
  return null;
}

export function smoothCents(current: number | null, target: number) {
  const clampedTarget = clamp(target, -50, 50);
  if (current === null) {
    return clampedTarget;
  }

  const { base, inTune, dramatic, dramaticCents } = TRACKER_CONFIG.smoothing;
  const delta = Math.abs(clampedTarget - current);
  let alpha: number = base;
  if (delta > dramaticCents) {
    alpha = dramatic;
  } else if (
    Math.abs(current) <= TRACKER_CONFIG.inTuneCents &&
    Math.abs(clampedTarget) <= TRACKER_CONFIG.inTuneCents
  ) {
    alpha = inTune;
  }

  const next = current + (clampedTarget - current) * alpha;
  return Math.abs(clampedTarget - next) <= 0.15 ? clampedTarget : next;
}

function isFrameUsable(frame: PitchFrame) {
  if (!Number.isFinite(frame.pitch)) return false;
  if (frame.pitch < TRACKER_CONFIG.minFrequency || frame.pitch > TRACKER_CONFIG.maxFrequency) {
    return false;
  }
  const clarity = frame.clarity ?? 1;
  return clarity >= TRACKER_CONFIG.minClarity;
}

function outputFor(state: TrackerState, clarity: number): TrackerOutput | null {
  if (
    state.activeNoteKey === null ||
    state.referenceFrequency === null ||
    state.displayCents === null
  ) {
    return null;
  }
  const reading = buildTunerReading(state.referenceFrequency);
  if (!reading) return null;
  return {
    frequency: frequencyFromCents(state.referenceFrequency, state.displayCents),
    noteName: reading.noteName,
    octave: reading.octave,
    referenceFrequency: state.referenceFrequency,
    centsOff: state.displayCents,
    clarity,
  };
}

function adoptNote(
  state: TrackerState,
  noteKey: string,
  referenceFrequency: number,
  cents: number,
  timestamp: number
): TrackerState {
  return {
    activeNoteKey: noteKey,
    referenceFrequency,
    displayCents: smoothCents(null, cents),
    centsHistory: [cents],
    pending: null,
    lastUpdateAt: timestamp,
  };
}

function followNote(state: TrackerState, cents: number, timestamp: number): TrackerState {
  const history = [
    ...state.centsHistory.slice(-(TRACKER_CONFIG.medianWindow - 1)),
    cents,
  ];
  const target = median(history);
  return {
    ...state,
    centsHistory: history,
    displayCents: smoothCents(state.displayCents, target),
    pending: null,
    lastUpdateAt: timestamp,
  };
}

/**
 * Feed one detector frame. Returns the next state and what the screen should
 * show (null while nothing has earned the display).
 */
export function trackPitchFrame(
  state: TrackerState,
  frame: PitchFrame
): { state: TrackerState; output: TrackerOutput | null } {
  const clarity = frame.clarity ?? 1;

  if (!isFrameUsable(frame)) {
    return { state, output: outputFor(state, clarity) };
  }

  const confident = clarity >= TRACKER_CONFIG.lockClarity;

  // Holding a note: stay on it unless the pitch has clearly left it.
  if (state.activeNoteKey !== null && state.referenceFrequency !== null) {
    let cents = centsBetween(frame.pitch, state.referenceFrequency);
    const boundary = 50 + TRACKER_CONFIG.switchHysteresisCents;

    if (Math.abs(cents) > boundary) {
      const folded = foldOctaveTowardReference(frame.pitch, state.referenceFrequency);
      if (folded !== null && !confident) {
        cents = centsBetween(folded, state.referenceFrequency);
      }
    }

    if (Math.abs(cents) <= boundary) {
      const next = followNote(state, cents, frame.timestamp);
      return { state: next, output: outputFor(next, clarity) };
    }
  }

  // Not holding this note yet (or at all): decide whether this frame earns it.
  const reading = buildTunerReading(frame.pitch);
  if (!reading) {
    return { state, output: outputFor(state, clarity) };
  }
  const noteKey = `${reading.noteName}${reading.octave}`;
  const pendingCount =
    state.pending?.noteKey === noteKey ? state.pending.count + 1 : 1;

  if (confident || pendingCount >= TRACKER_CONFIG.agreementFrames) {
    const next = adoptNote(
      state,
      noteKey,
      reading.nearestNoteFrequency,
      reading.centsOff,
      frame.timestamp
    );
    return { state: next, output: outputFor(next, clarity) };
  }

  const next: TrackerState = {
    ...state,
    pending: { noteKey, count: pendingCount },
  };
  return { state: next, output: outputFor(next, clarity) };
}

/** True when the last display update is older than the hold window. */
export function isTrackerStale(state: TrackerState, now: number) {
  return state.lastUpdateAt === 0 || now - state.lastUpdateAt > TRACKER_CONFIG.holdMs;
}
