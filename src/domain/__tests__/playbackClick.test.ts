import {
  clickEngineParamsAt,
  isPlaybackClickAvailable,
  wallMsUntil,
  type PlaybackClickGrid,
} from "../playbackClick";

const BASE_GRID: PlaybackClickGrid = {
  bpm: 120, // pulse 500ms, 4/4 bar 2000ms
  meterId: "4/4",
  firstDownbeatMs: 0,
  tempoMap: undefined,
  gridValidToMs: undefined,
};

describe("isPlaybackClickAvailable", () => {
  it("requires a grid with a known downbeat", () => {
    expect(isPlaybackClickAvailable(null)).toBe(false);
    expect(isPlaybackClickAvailable({ ...BASE_GRID, firstDownbeatMs: null })).toBe(false);
    expect(isPlaybackClickAvailable(BASE_GRID)).toBe(true);
  });
});

describe("clickEngineParamsAt", () => {
  it("computes phase within the bar at 1x", () => {
    const params = clickEngineParamsAt({ grid: BASE_GRID, positionMs: 4700, rate: 1 })!;
    expect(params.bpm).toBe(120);
    expect(params.barWallMs).toBe(2000);
    // 4700ms = bar 3 + 700ms in.
    expect(params.phaseOffsetWallMs).toBeCloseTo(700, 6);
    expect(params.nextBoundaryContentMs).toBeNull();
    expect(params.stopAtContentMs).toBeNull();
  });

  it("scales tempo and phase into the wall clock at practice rates", () => {
    const params = clickEngineParamsAt({ grid: BASE_GRID, positionMs: 4700, rate: 0.5 })!;
    expect(params.bpm).toBe(60);
    expect(params.barWallMs).toBe(4000);
    // Same musical phase (35% into the bar), twice the wall time.
    expect(params.phaseOffsetWallMs).toBeCloseTo(1400, 6);
  });

  it("refuses rates that push the tempo outside the engine range", () => {
    expect(clickEngineParamsAt({ grid: BASE_GRID, positionMs: 0, rate: 0.3 })).toBeNull(); // 36bpm
    expect(clickEngineParamsAt({ grid: { ...BASE_GRID, bpm: 200 }, positionMs: 0, rate: 1.5 })).toBeNull(); // 300bpm
  });

  it("honours the downbeat offset and treats pre-roll as phase 0", () => {
    const grid = { ...BASE_GRID, firstDownbeatMs: 1500 };
    const inPreRoll = clickEngineParamsAt({ grid, positionMs: 800, rate: 1 })!;
    expect(inPreRoll.phaseOffsetWallMs).toBe(0);
    const inBarTwo = clickEngineParamsAt({ grid, positionMs: 1500 + 2000 + 300, rate: 1 })!;
    expect(inBarTwo.phaseOffsetWallMs).toBeCloseTo(300, 6);
  });

  it("stops being available past gridValidToMs and reports the stop point", () => {
    const grid = { ...BASE_GRID, gridValidToMs: 6000 };
    expect(clickEngineParamsAt({ grid, positionMs: 6200, rate: 1 })).toBeNull();
    const params = clickEngineParamsAt({ grid, positionMs: 1000, rate: 1 })!;
    expect(params.stopAtContentMs).toBe(6000);
  });

  it("uses the segment at the playhead and reports the next boundary", () => {
    const grid: PlaybackClickGrid = {
      ...BASE_GRID,
      tempoMap: {
        schemaVersion: 1,
        segments: [
          { atBar: 1, bpm: 120, meterId: "4/4" }, // bars 1-4 → 8000ms
          { atBar: 5, bpm: 60, meterId: "3/4" },
        ],
      },
    };
    const before = clickEngineParamsAt({ grid, positionMs: 3000, rate: 1 })!;
    expect(before.bpm).toBe(120);
    expect(before.nextBoundaryContentMs).toBe(8000);

    const after = clickEngineParamsAt({ grid, positionMs: 9500, rate: 1 })!;
    expect(after.bpm).toBe(60);
    expect(after.meterId).toBe("3/4");
    expect(after.nextBoundaryContentMs).toBeNull();
    // 9500 is 1500ms into the 3000ms bar at bar 5.
    expect(after.phaseOffsetWallMs).toBeCloseTo(1500, 6);
  });
});

describe("wallMsUntil", () => {
  it("converts content distance to wall time by rate", () => {
    expect(wallMsUntil(1000, 4000, 1)).toBe(3000);
    expect(wallMsUntil(1000, 4000, 0.5)).toBe(6000);
    expect(wallMsUntil(5000, 4000, 1)).toBe(0);
  });
});
