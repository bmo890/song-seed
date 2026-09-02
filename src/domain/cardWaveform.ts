/**
 * Bar amplitudes for the clip card's waveform strip.
 *
 * Stored peaks are per-bin RMS on a dB-linear 0..1 curve (metersToWaveformPeaks). That
 * curve is right for the tall reel, but at card height every real performance collapses
 * into the same ~2px band — so the strip remaps each clip against ITSELF: its loudest
 * bar fills the height, its quiet floor sits at the minimum tick. The card shows the
 * clip's SHAPE; the reel keeps the true level.
 *
 * Pure so the guards are testable: synthetic peaks (a pending placeholder, a clip past
 * the analysis cap) are never stretched — seeded jitter would become a convincing fake
 * performance — and neither is a clip with nothing to show (silence, room tone, a held
 * drone), which would otherwise expand into full-height noise.
 */

/** Floor = this percentile of bars, so pauses read as pauses. */
export const STRIP_STRETCH_FLOOR_PERCENTILE = 0.1;
/** Below this floor→ceiling span the clip is flat — draw it as-is. */
export const STRIP_STRETCH_MIN_RANGE = 0.05;
/** A loudest bar under this (≈ -45 dBFS RMS) is room tone, not music — draw it as-is. */
export const STRIP_STRETCH_MIN_CEILING = 0.25;
/** >1 pushes mids down so only the loudest phrases reach full height and the envelope
 *  keeps its hills and valleys. */
export const STRIP_STRETCH_GAMMA = 1.2;

/**
 * Downsample `peaks` to `barCount` bars by MEAN per bucket (not the max the reel uses —
 * at ~5 bins per bar, max picks the loudest bin every time and flattens the envelope
 * into a solid band), then contrast-stretch real peaks per clip. Returns 0..1 values.
 */
export function computeStripBarAmps(
  peaks: readonly number[],
  barCount: number,
  synthetic: boolean
): number[] {
  const numBars = Math.min(barCount, peaks.length);
  if (numBars <= 0) return [];
  const peaksPerBar = peaks.length / numBars;
  const amps = new Array<number>(numBars);
  for (let i = 0; i < numBars; i++) {
    const startIdx = Math.floor(i * peaksPerBar);
    const endIdx = Math.min(Math.floor((i + 1) * peaksPerBar), peaks.length);
    let sum = 0;
    for (let j = startIdx; j < endIdx; j++) sum += peaks[j];
    const mean = endIdx > startIdx ? sum / (endIdx - startIdx) : 0;
    amps[i] = Math.max(0, Math.min(1, mean));
  }
  if (synthetic) return amps;

  const sorted = [...amps].sort((a, b) => a - b);
  const floor = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * STRIP_STRETCH_FLOOR_PERCENTILE))];
  const ceiling = sorted[sorted.length - 1];
  const range = ceiling - floor;
  if (range < STRIP_STRETCH_MIN_RANGE || ceiling < STRIP_STRETCH_MIN_CEILING) return amps;
  return amps.map((amp) =>
    Math.pow(Math.max(0, Math.min(1, (amp - floor) / range)), STRIP_STRETCH_GAMMA)
  );
}
