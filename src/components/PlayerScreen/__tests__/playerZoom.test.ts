import {
  DEFAULT_PLAYER_ZOOM,
  MIN_OPEN_ZOOM_WINDOW_MS,
  openingZoomForDuration,
} from "../playerZoom";

describe("openingZoomForDuration", () => {
  it("opens a full-length song at the default 8x", () => {
    // Any clip >= 8x the window (64s+) hits the cap exactly.
    expect(openingZoomForDuration(210_000)).toBe(DEFAULT_PLAYER_ZOOM); // 3:30
    expect(openingZoomForDuration(64_000)).toBe(DEFAULT_PLAYER_ZOOM); // exactly at the cap
    // Just under: returns the pre-snap multiple (the reel snaps 7.5 -> 8x on screen).
    expect(openingZoomForDuration(60_000)).toBeCloseTo(7.5, 5);
  });

  it("caps at 8x — never opens more zoomed than the default", () => {
    expect(openingZoomForDuration(30 * 60_000)).toBe(DEFAULT_PLAYER_ZOOM); // 30 min
  });

  it("floors zoom for short clips so at least the window stays visible", () => {
    // 24s clip -> 3x -> ~8s visible instead of 8x's 3s sliver.
    expect(openingZoomForDuration(24_000)).toBeCloseTo(3, 5);
    // 16s -> 2x, 8s -> 1x (whole clip).
    expect(openingZoomForDuration(16_000)).toBeCloseTo(2, 5);
    expect(openingZoomForDuration(MIN_OPEN_ZOOM_WINDOW_MS)).toBe(1);
  });

  it("keeps at least the minimum window visible at the floor", () => {
    for (const durationMs of [10_000, 20_000, 45_000]) {
      const zoom = openingZoomForDuration(durationMs)!;
      expect(durationMs / zoom).toBeGreaterThanOrEqual(MIN_OPEN_ZOOM_WINDOW_MS - 1);
    }
  });

  it("returns undefined for an unknown/zero/invalid duration (reel falls back to 1x)", () => {
    expect(openingZoomForDuration(0)).toBeUndefined();
    expect(openingZoomForDuration(-5)).toBeUndefined();
    expect(openingZoomForDuration(NaN)).toBeUndefined();
  });
});
