import { canSnapToGrid, snapResolutionForZoom, snapToGrid } from "../editSnap";
import { complementSpans, remapClipForSpans } from "../clipEditRemap";
import type { RecordingGrid } from "../../types";

/** 120bpm 4/4: pulse 500ms, bar 2000ms, grid zero at file t=0. */
const GRID: RecordingGrid = {
  bpm: 120,
  meterId: "4/4",
  tempoMap: undefined,
  grouping: undefined,
  countInBars: 0,
  clickThroughTake: true,
  firstDownbeatMs: 0,
  gridValidToMs: undefined,
  source: "metronome",
};

const DURATION = 60_000;

function snap(timeMs: number, zoomMultiple = 1, grid: RecordingGrid | null = GRID) {
  return snapToGrid({ timeMs, grid, zoomMultiple, durationMs: DURATION });
}

describe("snap resolution", () => {
  it("chooses bars when looking at the whole clip and beats once magnified", () => {
    expect(snapResolutionForZoom(1)).toBe("bar");
    expect(snapResolutionForZoom(3.9)).toBe("bar");
    expect(snapResolutionForZoom(4)).toBe("beat");
    expect(snapResolutionForZoom(12)).toBe("beat");
  });
});

describe("snapping to the grid", () => {
  it("pulls a near miss onto the bar line", () => {
    expect(snap(4120)).toBe(4000);
    expect(snap(5900)).toBe(6000);
  });

  it("leaves a deliberate mid-bar drag alone", () => {
    // 5000 is beat 3 — a whole bar away from either line, well past the window.
    expect(snap(5000)).toBe(5000);
  });

  it("snaps to beats once zoomed in, where bars would be too coarse", () => {
    expect(snap(5080, 8)).toBe(5000);
    // The same position at low zoom is nowhere near a bar line, so it stays put.
    expect(snap(5080, 1)).toBe(5080);
  });

  it("does nothing without a usable grid", () => {
    expect(snap(4120, 1, null)).toBe(4120);
    expect(snap(4120, 1, { ...GRID, firstDownbeatMs: null })).toBe(4120);
  });

  it("respects a grid whose downbeat is offset from the file start", () => {
    const offset = { ...GRID, firstDownbeatMs: 350 };
    expect(snapToGrid({ timeMs: 4300, grid: offset, zoomMultiple: 1, durationMs: DURATION })).toBe(4350);
  });

  it("never snaps outside the clip", () => {
    expect(snapToGrid({ timeMs: 120, grid: GRID, zoomMultiple: 1, durationMs: 60_000 })).toBe(0);
    // Past the end there is no candidate to reach for, so the value survives.
    const nearEnd = snapToGrid({ timeMs: 59_900, grid: GRID, zoomMultiple: 1, durationMs: 59_950 });
    expect(nearEnd).toBeLessThanOrEqual(59_950);
  });

  it("recognises which grids can position anything", () => {
    expect(canSnapToGrid(GRID)).toBe(true);
    expect(canSnapToGrid(null)).toBe(false);
    expect(canSnapToGrid({ ...GRID, firstDownbeatMs: null })).toBe(false);
  });
});

describe("snapping and the grid remap agree", () => {
  it("makes an interior cut grid-transparent, where the freehand version was not", () => {
    // A musician drags a cut roughly over bars 3-4 and misses by a few ms each side.
    const looseStart = 4118;
    const looseEnd = 8043;

    const loose = remapClipForSpans(
      { recordingGrid: GRID },
      complementSpans([{ startMs: looseStart, endMs: looseEnd }], DURATION),
      DURATION
    );
    expect(loose.gridOutcome.kind).toBe("partial");

    const snapped = remapClipForSpans(
      { recordingGrid: GRID },
      complementSpans(
        [{ startMs: snap(looseStart), endMs: snap(looseEnd) }],
        DURATION
      ),
      DURATION
    );
    expect(snapped.gridOutcome).toEqual({ kind: "kept" });
  });
});
