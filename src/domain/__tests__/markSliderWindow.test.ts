import { windowedSliderBounds } from "../markSliderWindow";

describe("windowedSliderBounds (2026-10-12)", () => {
  const CLIP = 385_000; // 6:25

  it("at rest zoom the slider spans the whole legal range, as before", () => {
    expect(windowedSliderBounds(215_000, CLIP, 225_000, 0, CLIP)).toEqual({ min: 215_000, max: CLIP });
  });

  it("zoomed in, the slider spans the reel's window, clipped to the legal range", () => {
    // Section 3:35 → 3:45, editing the end; reel shows 3:00 → 4:20.
    expect(windowedSliderBounds(215_000, CLIP, 225_000, 180_000, 260_000)).toEqual({
      min: 215_000,
      max: 260_000,
    });
  });

  it("an edge outside the window gets a window of the same width centred on it", () => {
    expect(windowedSliderBounds(0, CLIP, 300_000, 100_000, 140_000)).toEqual({ min: 280_000, max: 320_000 });
  });

  it("falls back to the legal range when the window and the legal range do not meet", () => {
    // Legal range for a start edge is 0 → 10 s, window is 200 → 240 s with the edge inside the window.
    expect(windowedSliderBounds(0, 10_000, 220_000, 200_000, 240_000)).toEqual({ min: 0, max: 10_000 });
  });
});
