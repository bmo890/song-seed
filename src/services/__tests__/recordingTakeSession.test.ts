import { createRecordingTakeSession } from "../recordingTakeSession";

/**
 * The take session is what survives the recorder screen being minimized: any reader
 * — the reopened screen, the dock — must see the same tape, the same head trim and
 * the same onset envelope the stream callback has been feeding since the take began.
 */
const SHAPE = { channels: 1, sampleRate: 44100, segmentDurationMs: 40, windowDurationMs: 12000 };

function segment(level = 0.5, count = 1) {
  const framesPerSegment = Math.round((SHAPE.sampleRate * SHAPE.segmentDurationMs) / 1000);
  return new Float32Array(framesPerSegment * count).fill(level);
}

const stream = (data: Float32Array) => ({ streamFormat: "float32", data }) as never;

describe("recording take session", () => {
  it("publishes the live tape to every subscriber, whoever fed it", () => {
    const take = createRecordingTakeSession(SHAPE);
    const seen: number[] = [];
    const stop = take.liveWaveform.subscribe(() => seen.push(take.liveWaveform.get().dataPoints.length));

    take.appendAudioStream(stream(segment(0.5, 3)));

    expect(seen).toEqual([3]);
    // A reader that arrives later (a remounted screen) gets the same picture.
    expect(take.liveWaveform.get().dataPoints).toHaveLength(3);
    expect(take.liveWaveform.get().durationMs).toBeGreaterThan(0);
    stop();
  });

  it("keeps the clock running while a count-in head is not drawn", () => {
    const take = createRecordingTakeSession(SHAPE);
    take.headTrim.set({ pending: true, ms: 0 });
    take.appendAudioStream(stream(segment(0.5, 2)), { retainPoints: false });
    expect(take.liveWaveform.get().dataPoints).toHaveLength(0);
    expect(take.liveWaveform.get().durationMs).toBeGreaterThan(0);
  });

  it("accumulates the onset envelope across deliveries", () => {
    const take = createRecordingTakeSession(SHAPE);
    take.appendOnset(segment(0.4, 2));
    const afterFirst = take.getOnsetEnvelope().bins.length;
    take.appendOnset(segment(0.4, 2));
    expect(afterFirst).toBeGreaterThan(0);
    expect(take.getOnsetEnvelope().bins.length).toBeGreaterThan(afterFirst);
  });

  it("beginTake clears everything a previous take left behind", () => {
    const take = createRecordingTakeSession(SHAPE);
    take.appendAudioStream(stream(segment(0.5, 2)));
    take.appendOnset(segment(0.4));
    take.headTrim.set({ pending: false, ms: 320 });
    take.facts.recordingStartedAt = 123;
    take.facts.sessionPersisted = true;
    take.facts.captureStartNative = { epochMs: 1, source: "test" };

    take.beginTake();

    expect(take.liveWaveform.get().dataPoints).toHaveLength(0);
    expect(take.getOnsetEnvelope().bins).toHaveLength(0);
    expect(take.headTrim.get()).toEqual({ pending: false, ms: 0 });
    expect(take.facts.recordingStartedAt).toBeNull();
    expect(take.facts.sessionPersisted).toBe(false);
    expect(take.getCaptureStartEpochMs()).toBeNull();
  });

  it("prefers the native capture start, then the estimate, then the JS stamp", () => {
    const take = createRecordingTakeSession(SHAPE);
    take.facts.recordingStartedAt = 1_000;
    expect(take.getCaptureStartEpochMs()).toBe(1_000);
    take.observeDuration(200);
    const estimate = take.getCaptureStartEpochMs()!;
    expect(estimate).toBeGreaterThan(1_000);
    take.facts.captureStartNative = { epochMs: 5, source: "test" };
    expect(take.getCaptureStartEpochMs()).toBe(5);
  });

  it("counts interruptions for whoever is listening now", () => {
    const take = createRecordingTakeSession(SHAPE);
    take.noteInterruption("audioFocusLoss");
    take.noteInterruption("recordingStopped");
    expect(take.interruption.get()).toEqual({ token: 2, reason: "recordingStopped" });
  });
});
