/**
 * The mark inspector's slider spans what the reel SHOWS, not everything the
 * edge could legally reach (founder, 2026-10-12). Mapping the whole remaining
 * clip onto a 200 pt track put a section end a few seconds from its start at
 * the far left with no room to move, while the zoomed reel had plenty.
 *
 * The window is the reel's visible range at the current zoom; when the edge
 * sits outside it (the reel was scrubbed away), a window of the same width is
 * centred on the edge instead, so the thumb always starts mid-track with room
 * both ways. The result is then kept inside the edge's legal bounds.
 */
export function windowedSliderBounds(
  legalMin: number,
  legalMax: number,
  currentMs: number,
  visibleStartMs: number,
  visibleEndMs: number
): { min: number; max: number } {
  const width = Math.max(1, visibleEndMs - visibleStartMs);
  let start = visibleStartMs;
  let end = visibleEndMs;
  if (currentMs < start || currentMs > end) {
    start = currentMs - width / 2;
    end = currentMs + width / 2;
  }
  const min = Math.max(legalMin, start);
  const max = Math.min(legalMax, end);
  if (max - min < 1) {
    // The window and the legal range barely meet: fall back to the legal range.
    return { min: legalMin, max: Math.max(legalMin + 1, legalMax) };
  }
  return { min, max };
}
