/**
 * Where a recorded layer really sits, measured from the song it heard.
 *
 * A layer recorded with the guide coming out of the speaker carries a copy of the song:
 * the microphone heard it. Line that copy up with the song itself and the distance left
 * over is exactly how far the layer was misplaced: whatever the phone's latency reports
 * said, whatever the speaker, the room or the Bluetooth link added. This is the method of
 * `scripts/layer-truth.py`, which measured every layer in the simulator 45–49 ms late
 * (2026-10-22) while the latency model believed it had nothing to correct.
 *
 * On headphones the microphone hears no song and there is nothing to line up: the
 * measurement says so (low confidence) and the layer keeps its modelled place.
 *
 * Both signals are onset envelopes (`onsetEnvelope.ts`): the rising edges of high-passed
 * energy, which a speaker-and-room copy and the original share even when the room has
 * coloured the copy.
 */

/** How far either way to look. A Bluetooth speaker can add a few hundred ms. */
export const LAYER_ALIGN_SEARCH_MS = 600;
/** The peak must stand this far above the rest of the lags (in standard deviations). */
export const MIN_LAYER_ALIGN_CONFIDENCE = 8;
/** Each half of the layer must agree with the other this closely, in ms. */
export const MAX_LAYER_ALIGN_HALF_DISAGREEMENT_MS = 4;
/** Shorter than this and the halves cannot each be trusted. */
export const MIN_LAYER_ALIGN_MS = 4000;
/** Corrections smaller than this are measurement noise, not misplacement. */
export const MIN_LAYER_CORRECTION_MS = 2;

export type LayerAlignment = {
  /** ms the layer is LATE (negative: early). Move it by minus this. */
  residualMs: number;
  confidence: number;
  halvesMs: [number, number];
};

/** Resample an envelope with `binMs`-wide bins onto an exact 1 ms grid. */
export function toMillisecondGrid(bins: ArrayLike<number>, binMs: number): Float64Array {
  const lengthMs = Math.floor(bins.length * binMs);
  const out = new Float64Array(Math.max(0, lengthMs));
  for (let ms = 0; ms < lengthMs; ms += 1) {
    const position = ms / binMs;
    const index = Math.floor(position);
    const fraction = position - index;
    const a = bins[index] ?? 0;
    const b = bins[index + 1] ?? a;
    out[ms] = a + (b - a) * fraction;
  }
  return out;
}

/** Rising edges, mean-removed and unit-length, so a dot product is a correlation. */
export function normalizedFlux(grid: Float64Array): Float64Array {
  const flux = new Float64Array(grid.length);
  let mean = 0;
  for (let i = 1; i < grid.length; i += 1) {
    flux[i] = Math.max(0, grid[i] - grid[i - 1]);
    mean += flux[i];
  }
  mean /= Math.max(1, grid.length);
  let norm = 0;
  for (let i = 0; i < flux.length; i += 1) {
    flux[i] -= mean;
    norm += flux[i] * flux[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < flux.length; i += 1) flux[i] /= norm;
  return flux;
}

function sumDown(signal: Float64Array, factor: number): Float64Array {
  const out = new Float64Array(Math.floor(signal.length / factor));
  for (let i = 0; i < out.length; i += 1) {
    let sum = 0;
    for (let j = 0; j < factor; j += 1) sum += signal[i * factor + j];
    out[i] = sum;
  }
  return out;
}

/** Score of `layer` placed so that its sample k meets guide sample k + shift. */
function score(layer: Float64Array, guide: Float64Array, shift: number): number | null {
  const lo = Math.max(0, -shift);
  const hi = Math.min(layer.length, guide.length - shift);
  if (hi - lo < layer.length * 0.5) return null;
  let sum = 0;
  for (let k = lo; k < hi; k += 1) sum += layer[k] * guide[k + shift];
  return sum;
}

/**
 * Best lag of `layer` against `guide`, where lag 0 means layer ms k meets guide ms
 * `baseShift + k` and a positive lag means the layer's content is that many ms late.
 */
function bestLag(
  layer: Float64Array,
  guide: Float64Array,
  baseShift: number,
  searchMs: number
): { lagMs: number; confidence: number } | null {
  // Coarse: 4 ms resolution across the whole search.
  const factor = 4;
  const layerCoarse = sumDown(layer, factor);
  const guideCoarse = sumDown(guide, factor);
  const coarseSearch = Math.ceil(searchMs / factor);
  const scores: number[] = [];
  const lags: number[] = [];
  for (let lag = -coarseSearch; lag <= coarseSearch; lag += 1) {
    const value = score(layerCoarse, guideCoarse, Math.round(baseShift / factor) - lag);
    if (value != null) {
      scores.push(value);
      lags.push(lag * factor);
    }
  }
  if (scores.length < 10) return null;
  let best = 0;
  for (let i = 1; i < scores.length; i += 1) if (scores[i] > scores[best]) best = i;

  // Confidence: the peak against everything further than 40 ms from it.
  let mean = 0;
  let count = 0;
  for (let i = 0; i < scores.length; i += 1) {
    if (Math.abs(lags[i] - lags[best]) > 40) {
      mean += scores[i];
      count += 1;
    }
  }
  mean /= Math.max(1, count);
  let variance = 0;
  for (let i = 0; i < scores.length; i += 1) {
    if (Math.abs(lags[i] - lags[best]) > 40) variance += (scores[i] - mean) ** 2;
  }
  const deviation = Math.sqrt(variance / Math.max(1, count));
  const confidence = deviation > 0 ? (scores[best] - mean) / deviation : 0;

  // Fine: 1 ms around the coarse peak, then parabolic interpolation.
  const fine: { lag: number; value: number }[] = [];
  for (let lag = lags[best] - 6; lag <= lags[best] + 6; lag += 1) {
    const value = score(layer, guide, baseShift - lag);
    if (value != null) fine.push({ lag, value });
  }
  if (fine.length < 3) return { lagMs: lags[best], confidence };
  let peak = 0;
  for (let i = 1; i < fine.length; i += 1) if (fine[i].value > fine[peak].value) peak = i;
  let lagMs = fine[peak].lag;
  if (peak > 0 && peak < fine.length - 1) {
    const a = fine[peak - 1].value;
    const b = fine[peak].value;
    const c = fine[peak + 1].value;
    const denom = a - 2 * b + c;
    if (denom !== 0) lagMs += (0.5 * (a - c)) / denom;
  }
  return { lagMs, confidence };
}

/**
 * Measure a layer against the guide it was recorded to.
 *
 * `layer` is the layer's envelope in FILE ms (head already trimmed); `guide` is the
 * guide's envelope starting at `guideStartMs` on the song; the layer is placed at
 * `offsetMs`. Returns null when the layer carries no audible copy of the song, or the
 * two halves of the take disagree (a measurement that cannot be trusted moves nothing).
 */
export function measureLayerAgainstGuide(args: {
  layer: { bins: ArrayLike<number>; binMs: number };
  guide: { bins: ArrayLike<number>; binMs: number };
  guideStartMs: number;
  offsetMs: number;
  searchMs?: number;
}): LayerAlignment | null {
  const searchMs = args.searchMs ?? LAYER_ALIGN_SEARCH_MS;
  const layer = normalizedFlux(toMillisecondGrid(args.layer.bins, args.layer.binMs));
  const guide = normalizedFlux(toMillisecondGrid(args.guide.bins, args.guide.binMs));
  if (layer.length < MIN_LAYER_ALIGN_MS) return null;
  const baseShift = Math.round(args.offsetMs - args.guideStartMs);

  const whole = bestLag(layer, guide, baseShift, searchMs);
  if (!whole || whole.confidence < MIN_LAYER_ALIGN_CONFIDENCE) return null;
  const half = Math.floor(layer.length / 2);
  const first = bestLag(normalizedFlux(toMillisecondGrid(args.layer.bins, args.layer.binMs).slice(0, half)), guide, baseShift, searchMs);
  const second = bestLag(
    normalizedFlux(toMillisecondGrid(args.layer.bins, args.layer.binMs).slice(half)),
    guide,
    baseShift + half,
    searchMs
  );
  if (!first || !second) return null;
  if (Math.abs(first.lagMs - second.lagMs) > MAX_LAYER_ALIGN_HALF_DISAGREEMENT_MS) return null;
  if (Math.abs(whole.lagMs) > searchMs - 20) return null;
  return { residualMs: whole.lagMs, confidence: whole.confidence, halvesMs: [first.lagMs, second.lagMs] };
}
