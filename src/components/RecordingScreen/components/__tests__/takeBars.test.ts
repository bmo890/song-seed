jest.mock("@shopify/react-native-skia", () => ({}));
jest.mock("../../../common/AudioReel", () => ({ REEL_SURFACE_COLOR: "#F0EBE4" }));
jest.mock("../../../../services/recordingTakeSession", () => ({}));

import { createTakeHistory, foldIntoTakeHistory, takeBars } from "../TakeRegister";

const point = (startTime: number, dB: number) => ({ startTime, endTime: startTime + 40, dB }) as never;

function historyOf(points: never[], nowMs: number) {
  const history = createTakeHistory(40);
  foldIntoTakeHistory(history, points, nowMs);
  return history;
}

describe("the take written under the song", () => {
  it("sits its newest bar at the playhead and older bars behind it", () => {
    const bars = takeBars(historyOf([point(0, -10), point(40, -10), point(240, -10)], 280), 280, 200);
    // Two buckets: 0–200 ms (240 ms ago at its start) and 200–400 ms (80 ms ago).
    expect(bars.map(([age]) => age).sort((a, b) => a - b)).toEqual([80, 280]);
  });

  it("keeps the loudest moment of each bar", () => {
    const [[, height]] = takeBars(historyOf([point(0, -50), point(40, -5)], 80), 80, 200);
    expect(height).toBeGreaterThan(0.8);
  });

  it("draws nothing before there is audio or a scale", () => {
    expect(takeBars(historyOf([], 0), 0, 200)).toEqual([]);
    expect(takeBars(historyOf([point(0, -10)], 40), 40, 0)).toEqual([]);
  });

  it("keeps the start of the take after the live window has dropped it", () => {
    const history = createTakeHistory(40);
    foldIntoTakeHistory(history, [point(0, -10)], 40);
    // 20 s later the 12 s window no longer carries the first segment.
    foldIntoTakeHistory(history, [point(19_960, -10)], 20_000);
    const ages = takeBars(history, 20_000, 200).map(([age]) => age);
    expect(ages).toContain(20_000);
  });

  it("starts clean when the capture clock goes back (a Redo)", () => {
    const history = createTakeHistory(40);
    foldIntoTakeHistory(history, [point(0, -10), point(5_000, -10)], 5_040);
    foldIntoTakeHistory(history, [point(0, -10)], 40);
    expect(takeBars(history, 40, 200)).toHaveLength(1);
  });

  it("skips what is off the register's left edge", () => {
    const history = historyOf([point(0, -10), point(9_960, -10)], 10_000);
    expect(takeBars(history, 10_000, 200, 1_000)).toHaveLength(1);
  });
});
