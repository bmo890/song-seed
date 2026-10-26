jest.mock("@shopify/react-native-skia", () => ({}));
jest.mock("../../../common/AudioReel", () => ({ REEL_SURFACE_COLOR: "#F0EBE4" }));
jest.mock("../../../../services/recordingTakeSession", () => ({}));

import { createTakeHistory, foldIntoTakeHistory, songMsOfCapture, takeBars } from "../TakeRegister";

const point = (startTime: number, dB: number) => ({ startTime, endTime: startTime + 40, dB }) as never;

function historyOf(points: never[], nowMs: number) {
  const history = createTakeHistory(40);
  foldIntoTakeHistory(history, points, nowMs);
  return history;
}

describe("the take written under the song", () => {
  it("cuts the take into bars on the capture clock", () => {
    const bars = takeBars(historyOf([point(0, -10), point(40, -10), point(240, -10)], 280), 200);
    // Two buckets: 0–200 ms and 200–400 ms.
    expect(bars.map(([at]) => at).sort((a, b) => a - b)).toEqual([0, 200]);
  });

  it("never moves a written bar as more audio arrives", () => {
    // The founder's "very jumpy" take: bars placed by age shook with every delivery.
    const history = createTakeHistory(40);
    foldIntoTakeHistory(history, [point(0, -10), point(40, -10)], 80);
    const before = takeBars(history, 200).find(([at]) => at === 0);
    foldIntoTakeHistory(history, [point(80, -10), point(120, -10), point(160, -10)], 200);
    const after = takeBars(history, 200).find(([at]) => at === 0);
    expect(after?.[0]).toBe(before?.[0]);
  });

  it("puts the layer's first audio on its start point", () => {
    // A punch at 0:30 with a 2.4 s run-up: capture 2400 is the song's 30 000.
    expect(songMsOfCapture(2400, 2400, 30_000)).toBe(30_000);
    expect(songMsOfCapture(3400, 2400, 30_000)).toBe(31_000);
  });

  it("keeps the loudest moment of each bar", () => {
    const [[, height]] = takeBars(historyOf([point(0, -50), point(40, -5)], 80), 200);
    expect(height).toBeGreaterThan(0.8);
  });

  it("draws nothing before there is audio or a scale", () => {
    expect(takeBars(historyOf([], 0), 200)).toEqual([]);
    expect(takeBars(historyOf([point(0, -10)], 40), 0)).toEqual([]);
  });

  it("keeps the start of the take after the live window has dropped it", () => {
    const history = createTakeHistory(40);
    foldIntoTakeHistory(history, [point(0, -10)], 40);
    // 20 s later the 12 s window no longer carries the first segment.
    foldIntoTakeHistory(history, [point(19_960, -10)], 20_000);
    expect(takeBars(history, 200).map(([at]) => at)).toContain(0);
  });

  it("starts clean when the capture clock goes back (a Redo)", () => {
    const history = createTakeHistory(40);
    foldIntoTakeHistory(history, [point(0, -10), point(5_000, -10)], 5_040);
    foldIntoTakeHistory(history, [point(0, -10)], 40);
    expect(takeBars(history, 200)).toHaveLength(1);
  });

  it("skips what is off the register's left edge", () => {
    const history = historyOf([point(0, -10), point(9_960, -10)], 10_000);
    expect(takeBars(history, 200, 9_000)).toHaveLength(1);
  });
});
