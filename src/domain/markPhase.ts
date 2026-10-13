/**
 * Where a mark stands against the playhead, for the Marks list's timeline cue
 * (founder, 2026-10-13): the list should show at a glance where you are in the
 * song. The convention is a transit line's: what you have passed recedes, where
 * you are is lit, what is ahead waits in plain ink.
 */
export type MarkPhase = "past" | "now" | "ahead";

/** A pin has no length, so it is "now" for a moment either side of the playhead. */
export const PIN_NOW_WINDOW_MS = 1000;

/** A section is "now" from its start up to, not including, its end — so two
 *  touching sections are never both lit. */
export function sectionPhase(startMs: number, endMs: number, playheadMs: number): MarkPhase {
  if (playheadMs >= endMs) return "past";
  return playheadMs >= startMs ? "now" : "ahead";
}

export function pinPhase(atMs: number, playheadMs: number): MarkPhase {
  if (Math.abs(playheadMs - atMs) <= PIN_NOW_WINDOW_MS) return "now";
  return playheadMs > atMs ? "past" : "ahead";
}
