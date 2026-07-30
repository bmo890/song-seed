import {
  appendLiveWaveform,
  emptyLiveWaveformState,
  type LiveWaveformState,
} from "../liveWaveform";

const SHAPE = {
  channels: 1,
  sampleRate: 44100,
  segmentDurationMs: 40,
  windowDurationMs: 12000,
};

/** One segment's worth of samples at a constant level. */
function segment(level = 0.5, count = 1) {
  const framesPerSegment = Math.round((SHAPE.sampleRate * SHAPE.segmentDurationMs) / 1000);
  return new Float32Array(framesPerSegment * count).fill(level);
}

const SEGMENT_MS = (Math.round((SHAPE.sampleRate * SHAPE.segmentDurationMs) / 1000) / SHAPE.sampleRate) * 1000;

function feed(
  state: LiveWaveformState,
  samples: Float32Array,
  retainPoints = true
): LiveWaveformState {
  return appendLiveWaveform(state, samples, SHAPE, { retainPoints }).state;
}

describe("appendLiveWaveform", () => {
  it("emits a point per complete segment and carries the remainder", () => {
    const framesPerSegment = Math.round((SHAPE.sampleRate * SHAPE.segmentDurationMs) / 1000);
    const partial = new Float32Array(framesPerSegment + 100).fill(0.2);
    const result = appendLiveWaveform(emptyLiveWaveformState(), partial, SHAPE);

    expect(result.changed).toBe(true);
    expect(result.state.points).toHaveLength(1);
    expect(result.state.pendingSamples).toHaveLength(100);
  });

  it("reports no change when the delivery does not complete a segment", () => {
    const result = appendLiveWaveform(emptyLiveWaveformState(), new Float32Array(64), SHAPE);
    expect(result.changed).toBe(false);
    expect(result.state.points).toHaveLength(0);
  });

  it("dates every point from capture ms, contiguously", () => {
    const state = feed(emptyLiveWaveformState(), segment(0.5, 3));
    expect(state.points.map((point) => point.startTime)).toEqual([
      0,
      SEGMENT_MS,
      SEGMENT_MS * 2,
    ]);
    expect(state.streamDurationMs).toBeCloseTo(SEGMENT_MS * 3, 6);
  });

  // The regression that made the live beat grid decorative. A record-through count-in
  // hides its audio; if hiding it also stops (or rewinds) the clock, every candle drawn
  // afterwards is dated from the downbeat while the grid is still dated from sample 0.
  it("keeps the clock running through audio it does not draw", () => {
    let state = feed(emptyLiveWaveformState(), segment(0.01, 25), false); // 1s count-in
    expect(state.points).toHaveLength(0);
    expect(state.streamDurationMs).toBeCloseTo(SEGMENT_MS * 25, 6);

    state = feed(state, segment(0.5, 2)); // the take begins
    expect(state.points).toHaveLength(2);
    expect(state.points[0].startTime).toBeCloseTo(SEGMENT_MS * 25, 6);
  });

  it("puts the first drawn candle at the same capture ms whether or not a count-in was hidden", () => {
    const hidden = feed(feed(emptyLiveWaveformState(), segment(0.01, 25), false), segment(0.5));
    const shown = feed(emptyLiveWaveformState(), segment(0.5, 26));

    expect(hidden.points[0].startTime).toBeCloseTo(
      shown.points[shown.points.length - 1].startTime as number,
      6
    );
  });

  it("prunes points older than the window without disturbing the clock", () => {
    const segmentsPerWindow = Math.ceil(SHAPE.windowDurationMs / SEGMENT_MS);
    const state = feed(emptyLiveWaveformState(), segment(0.5, segmentsPerWindow + 50));

    expect(state.streamDurationMs).toBeCloseTo(SEGMENT_MS * (segmentsPerWindow + 50), 6);
    expect(state.points.length).toBeLessThanOrEqual(segmentsPerWindow + 1);
    const oldest = state.points[0].endTime as number;
    expect(oldest).toBeGreaterThanOrEqual(state.streamDurationMs - SHAPE.windowDurationMs);
  });

  it("marks a silent segment silent and a loud one not", () => {
    const quiet = feed(emptyLiveWaveformState(), segment(0.0001));
    const loud = feed(emptyLiveWaveformState(), segment(0.5));
    expect(quiet.points[0].silent).toBe(true);
    expect(loud.points[0].silent).toBe(false);
  });
});
