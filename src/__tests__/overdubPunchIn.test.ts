import { getRecordingGridBarMs, snapPunchInMsToGrid } from "../overdub";
import type { RecordingGrid } from "../types";

// 120 BPM 4/4 → 500ms beats, 2000ms bars; grid anchored at a measured 250ms downbeat.
const grid: RecordingGrid = {
  bpm: 120,
  meterId: "4/4",
  countInBars: 0,
  clickThroughTake: false,
  firstDownbeatMs: 250,
  source: "metronome",
};

describe("getRecordingGridBarMs", () => {
  it("computes the bar length from bpm and meter", () => {
    expect(getRecordingGridBarMs(grid)).toBe(2000);
  });

  it("returns null without a usable grid", () => {
    expect(getRecordingGridBarMs(null)).toBeNull();
    expect(getRecordingGridBarMs({ ...grid, bpm: 0 })).toBeNull();
  });
});

describe("snapPunchInMsToGrid", () => {
  it("snaps to the nearest bar line anchored at the measured downbeat", () => {
    // Bars at 250, 2250, 4250, … — 5100 is nearest to 4250.
    expect(snapPunchInMsToGrid(5100, grid, 60000)).toBe(4250);
    // 5400 rounds up to 6250.
    expect(snapPunchInMsToGrid(5400, grid, 60000)).toBe(6250);
  });

  it("passes the raw position through when the clip has no grid", () => {
    expect(snapPunchInMsToGrid(5123, null, 60000)).toBe(5123);
  });

  it("treats near-the-top punches as a classic full-length layer", () => {
    expect(snapPunchInMsToGrid(0, grid, 60000)).toBe(0);
    expect(snapPunchInMsToGrid(400, grid, 60000)).toBe(0); // snaps to bar 0 (250) → < 1s → 0
    expect(snapPunchInMsToGrid(700, null, 60000)).toBe(0);
  });

  it("pulls an end-of-song punch back inside the master", () => {
    expect(snapPunchInMsToGrid(59900, grid, 60000)).toBeLessThanOrEqual(59000);
    expect(snapPunchInMsToGrid(120000, grid, 60000)).toBeLessThanOrEqual(59000);
  });

  it("clamps negatives and non-finite input to 0", () => {
    expect(snapPunchInMsToGrid(-500, grid, 60000)).toBe(0);
    expect(snapPunchInMsToGrid(Number.NaN, grid, 60000)).toBe(0);
  });
});
