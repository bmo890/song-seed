/**
 * Opening-zoom math for the player reel — pure, so it's testable without the reel
 * or reanimated. Every song opens at a fixed 8x (best waveform detail + the rolling
 * "tape" motion), floored so a short clip isn't over-zoomed into a sliver.
 */

/** Fixed default opening zoom for the player reel. */
export const DEFAULT_PLAYER_ZOOM = 8;

/** Never open so zoomed that less than this much time is on screen: 8x on a 12s hum
 *  would show a ~1.5s sliver. Longer clips (~48s+) are unaffected and stay at 8x. */
export const MIN_OPEN_ZOOM_WINDOW_MS = 8000;

/**
 * Opening zoom multiple for a clip of `durationMs`: DEFAULT_PLAYER_ZOOM, capped so at
 * least MIN_OPEN_ZOOM_WINDOW_MS of audio is visible. Returns undefined for an unknown
 * duration (the reel then falls back to 1x). AudioReel snaps the result to its nearest
 * supported zoom step, so fractional values are fine.
 */
export function openingZoomForDuration(durationMs: number): number | undefined {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return undefined;
  return Math.min(DEFAULT_PLAYER_ZOOM, durationMs / MIN_OPEN_ZOOM_WINDOW_MS);
}
