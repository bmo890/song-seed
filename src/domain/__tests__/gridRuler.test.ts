import { buildGridRulerModel, snapToGrid, type GridRulerGrid } from "../gridRuler";

const BASE_GRID: GridRulerGrid = {
  bpm: 120, // pulse 500ms, 4/4 bar 2000ms
  meterId: "4/4",
  firstDownbeatMs: 0,
  tempoMap: undefined,
  gridValidToMs: undefined,
};

// 0.1 px/ms → a 2000ms bar spans 200px: bars drawn every bar, beats have room.
const ZOOMED_IN_PX_PER_MS = 0.1;
// 0.005 px/ms → a bar spans 10px: bars must thin, beats must vanish.
const ZOOMED_OUT_PX_PER_MS = 0.005;

describe("buildGridRulerModel honesty gates", () => {
  it("returns null without a grid, or with an unknown downbeat", () => {
    expect(buildGridRulerModel({ grid: null, durationMs: 10000, pixelsPerMs: 0.1 })).toBeNull();
    expect(
      buildGridRulerModel({
        grid: { ...BASE_GRID, firstDownbeatMs: null },
        durationMs: 10000,
        pixelsPerMs: 0.1,
      })
    ).toBeNull();
    expect(buildGridRulerModel({ grid: BASE_GRID, durationMs: 0, pixelsPerMs: 0.1 })).toBeNull();
  });

  it("stops the ruler at gridValidToMs and reports the early stop", () => {
    const model = buildGridRulerModel({
      grid: { ...BASE_GRID, gridValidToMs: 5000 },
      durationMs: 20000,
      pixelsPerMs: ZOOMED_IN_PX_PER_MS,
    })!;
    expect(model.validToMs).toBe(5000);
    expect(model.barLines.every((line) => line.ms <= 5000)).toBe(true);
    expect(model.beatTicks.every((tick) => tick <= 5000)).toBe(true);
  });

  it("reports retained pre-roll and starts bar 1 at the downbeat", () => {
    const model = buildGridRulerModel({
      grid: { ...BASE_GRID, firstDownbeatMs: 1500 },
      durationMs: 10000,
      pixelsPerMs: ZOOMED_IN_PX_PER_MS,
    })!;
    expect(model.preRollEndMs).toBe(1500);
    expect(model.barLines[0]).toEqual({ ms: 1500, bar: 1 });
  });
});

describe("buildGridRulerModel density", () => {
  it("draws every bar and beat ticks when zoomed in", () => {
    const model = buildGridRulerModel({
      grid: BASE_GRID,
      durationMs: 8000, // 4 bars
      pixelsPerMs: ZOOMED_IN_PX_PER_MS,
    })!;
    expect(model.barLines.map((line) => line.bar)).toEqual([1, 2, 3, 4]);
    // 3 non-downbeat ticks per full bar; the 4th bar ends exactly at the file end.
    expect(model.beatTicks.length).toBe(12);
    expect(model.beatTicks[0]).toBe(500);
  });

  it("thins bar lines and drops beat ticks when zoomed out", () => {
    const model = buildGridRulerModel({
      grid: BASE_GRID,
      durationMs: 8 * 60 * 1000, // 240 bars
      pixelsPerMs: ZOOMED_OUT_PX_PER_MS,
    })!;
    expect(model.beatTicks).toHaveLength(0);
    const bars = model.barLines.map((line) => line.bar);
    // 10px/bar with a 24px minimum → every 4th bar.
    expect(bars.slice(0, 3)).toEqual([1, 5, 9]);
    expect(model.barLabels.length).toBeLessThanOrEqual(28);
  });
});

describe("snapToGrid", () => {
  it("pulls near misses onto the line and leaves far drops alone", () => {
    // 120bpm 4/4: beats every 500ms, bars every 2000ms.
    expect(snapToGrid({ grid: BASE_GRID, ms: 2040, toleranceMs: 80, unit: "bar" })).toBe(2000);
    expect(snapToGrid({ grid: BASE_GRID, ms: 3960, toleranceMs: 80, unit: "bar" })).toBe(4000);
    expect(snapToGrid({ grid: BASE_GRID, ms: 2500, toleranceMs: 80, unit: "bar" })).toBeNull();
    expect(snapToGrid({ grid: BASE_GRID, ms: 2540, toleranceMs: 80, unit: "beat" })).toBe(2500);
  });

  it("respects the downbeat offset and the honesty gates", () => {
    const offsetGrid = { ...BASE_GRID, firstDownbeatMs: 300 };
    expect(snapToGrid({ grid: offsetGrid, ms: 2330, toleranceMs: 80, unit: "bar" })).toBe(2300);
    expect(snapToGrid({ grid: { ...BASE_GRID, firstDownbeatMs: null }, ms: 2040, toleranceMs: 80, unit: "bar" })).toBeNull();
    // Past gridValidToMs the grid is untrusted — no snapping to a lie.
    expect(
      snapToGrid({ grid: { ...BASE_GRID, gridValidToMs: 3000 }, ms: 3960, toleranceMs: 80, unit: "bar" })
    ).toBeNull();
  });

  it("snaps across a tempo change using the map", () => {
    const grid: GridRulerGrid = {
      ...BASE_GRID,
      tempoMap: {
        schemaVersion: 1,
        segments: [
          { atBar: 1, bpm: 120, meterId: "4/4" }, // bars 1-4 → 8000ms
          { atBar: 5, bpm: 60, meterId: "3/4" }, // 3000ms bars
        ],
      },
    };
    expect(snapToGrid({ grid, ms: 11050, toleranceMs: 100, unit: "bar" })).toBe(11000); // bar 6
    expect(snapToGrid({ grid, ms: 9950, toleranceMs: 100, unit: "beat" })).toBe(10000); // beat in bar 5
  });
});

describe("buildGridRulerModel tempo changes", () => {
  const CHANGING_GRID: GridRulerGrid = {
    bpm: 120,
    meterId: "4/4",
    firstDownbeatMs: 0,
    gridValidToMs: undefined,
    tempoMap: {
      schemaVersion: 1,
      segments: [
        { atBar: 1, bpm: 120, meterId: "4/4" }, // bars 1-4: 2000ms each
        { atBar: 5, bpm: 60, meterId: "3/4" }, // from 8000ms: 3000ms bars
      ],
    },
  };

  it("marks the change at its bar line and keeps positions exact across it", () => {
    const model = buildGridRulerModel({
      grid: CHANGING_GRID,
      durationMs: 20000,
      pixelsPerMs: ZOOMED_IN_PX_PER_MS,
    })!;
    expect(model.changeMarkers).toEqual([{ ms: 8000, bar: 5, label: "3/4 · 60" }]);
    const bar6 = model.barLines.find((line) => line.bar === 6);
    expect(bar6?.ms).toBe(11000);
    // The change bar keeps its line but cedes its number to the marker label.
    expect(model.barLines.some((line) => line.bar === 5)).toBe(true);
    expect(model.barLabels.some((label) => label.bar === 5)).toBe(false);
  });

  it("honours the downbeat offset in front of a tempo map", () => {
    const model = buildGridRulerModel({
      grid: { ...CHANGING_GRID, firstDownbeatMs: 700 },
      durationMs: 20000,
      pixelsPerMs: ZOOMED_IN_PX_PER_MS,
    })!;
    expect(model.changeMarkers[0].ms).toBe(8700);
    expect(model.preRollEndMs).toBe(700);
  });
});
