import type { PracticeMarker } from "../types";

/**
 * Where the pins dropped during a take belong once it is saved (2026-10-17).
 *
 * The recorder stamps a pin in CAPTURE ms: time since the first sample, which
 * includes any count-in or lead-in that the save then trims off the head. Saved
 * as stamped, every pin on a count-in take landed late by the whole count-in.
 * A layer's pins belong on the take it rides, at the layer's place on it.
 *
 * - `headTrimmedMs`: the pre-roll cut from the saved file.
 * - `offsetMs`: where the saved audio starts on the timeline the pins land on
 *   (0 for a take of its own; the punch point for a layer on its master).
 * - `durationMs`: that timeline's length, when known; pins past it are clamped.
 *
 * A pin before the timeline's start (dropped in the trimmed pre-roll) lands at 0.
 */
export function placeLivePins(
  pins: readonly PracticeMarker[],
  { headTrimmedMs = 0, offsetMs = 0, durationMs }: { headTrimmedMs?: number; offsetMs?: number; durationMs?: number }
): PracticeMarker[] {
  const limit = durationMs && durationMs > 0 ? durationMs : Number.POSITIVE_INFINITY;
  return pins.map((pin) => ({
    ...pin,
    atMs: Math.round(Math.min(limit, Math.max(0, pin.atMs - headTrimmedMs + offsetMs))),
  }));
}
