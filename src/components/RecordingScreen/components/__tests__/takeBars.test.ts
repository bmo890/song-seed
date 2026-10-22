jest.mock("@shopify/react-native-skia", () => ({}));
jest.mock("../../../common/AudioReel", () => ({ REEL_SURFACE_COLOR: "#F0EBE4" }));
jest.mock("../../../../services/recordingTakeSession", () => ({}));

import { takeBars } from "../TakeRegister";

const point = (startTime: number, dB: number) => ({ startTime, endTime: startTime + 40, dB }) as never;

describe("the take written under the song", () => {
  it("sits its newest bar at the playhead and older bars behind it", () => {
    const bars = takeBars([point(0, -10), point(40, -10), point(240, -10)], 280, 200);
    // Two buckets: 0–200 ms (240 ms ago at its start) and 200–400 ms (80 ms ago).
    expect(bars.map(([age]) => age).sort((a, b) => a - b)).toEqual([80, 280]);
  });

  it("keeps the loudest moment of each bar", () => {
    const [[, height]] = takeBars([point(0, -50), point(40, -5)], 80, 200);
    expect(height).toBeGreaterThan(0.8);
  });

  it("draws nothing before there is audio or a scale", () => {
    expect(takeBars([], 0, 200)).toEqual([]);
    expect(takeBars([point(0, -10)], 40, 0)).toEqual([]);
  });
});
