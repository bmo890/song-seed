import { beatAtMs, barStartMs, gridTempoMap, msAtPulse } from "./tempoMap";
import type { RecordingGrid } from "../types";

/**
 * Snapping a trim edge to the take's bar grid.
 *
 * This is what makes a grid-preserving cut the normal case instead of a lucky one: an
 * interior cut only keeps the metronome grid when the seam removes whole bars (see
 * `clipEditRemap`), and a freehand drag never lands there. With snapping on, it always
 * does.
 *
 * Zoom decides the resolution. Looking at the whole clip you are choosing *sections*, so
 * edges land on bar lines; zoomed in you are choosing *moments*, so they land on beats.
 * The inspector's nudge carets deliberately bypass this for surgical work.
 */

/** Below this magnification an edge snaps to bar lines; at or above it, to beats. */
const BEAT_RESOLUTION_ZOOM = 4;

/** How close a drag must come before it is pulled in — about a fingertip on the reel. */
const SNAP_WINDOW_FRACTION = 0.25;

export type SnapResolution = "bar" | "beat";

export function snapResolutionForZoom(zoomMultiple: number): SnapResolution {
  return zoomMultiple >= BEAT_RESOLUTION_ZOOM ? "beat" : "bar";
}

/** True when this grid can position anything at all. */
export function canSnapToGrid(grid: RecordingGrid | null | undefined): grid is RecordingGrid {
  return (
    !!grid &&
    grid.firstDownbeatMs != null &&
    Number.isFinite(grid.firstDownbeatMs) &&
    Number.isFinite(grid.bpm)
  );
}

/**
 * Pull `timeMs` onto the nearest bar (or beat) line, if one is close enough. Returns the
 * input unchanged when there is no usable grid, or when the nearest line is further away
 * than the snap window — so a deliberate drag into the middle of a bar still lands there.
 */
export function snapToGrid(args: {
  timeMs: number;
  grid: RecordingGrid | null | undefined;
  zoomMultiple: number;
  durationMs: number;
}): number {
  const { timeMs, grid, zoomMultiple, durationMs } = args;
  if (!canSnapToGrid(grid)) return timeMs;

  const downbeatMs = grid.firstDownbeatMs as number;
  const map = gridTempoMap(grid);
  const gridMs = timeMs - downbeatMs;
  const point = beatAtMs(map, gridMs);
  const resolution = snapResolutionForZoom(zoomMultiple);

  let candidates: number[];
  if (resolution === "bar") {
    candidates = [barStartMs(map, point.bar), barStartMs(map, point.bar + 1)];
  } else {
    candidates = [
      msAtPulse(map, point.absolutePulse),
      msAtPulse(map, point.absolutePulse + 1),
    ];
  }

  const window = (resolution === "bar" ? point.pulseMs * point.pulsesPerBar : point.pulseMs) *
    SNAP_WINDOW_FRACTION;

  let best: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const absolute = candidate + downbeatMs;
    if (absolute < 0 || absolute > durationMs) continue;
    const distance = Math.abs(absolute - timeMs);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = absolute;
    }
  }

  if (best == null || bestDistance > window) return timeMs;
  // Whole ms: edges are stored as integers, and `clipEditRemap` allows for exactly that
  // rounding when it decides whether a seam is bar-aligned.
  return Math.round(best);
}
