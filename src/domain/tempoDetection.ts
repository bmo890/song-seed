export const TEMPO_ANALYSIS_SAMPLE_RATE = 8_000;
export const TEMPO_ANALYSIS_MAX_MS = 30_000;
export const TEMPO_ANALYSIS_MIN_MS = 3_500;
export const MIN_DETECTED_BPM = 40;
export const MAX_DETECTED_BPM = 240;
export const MIN_TEMPO_CONFIDENCE = 0.55;

const ENVELOPE_HZ = 100;

export type TempoEstimate = {
  bpm: number | null;
  confidence: number;
  steadiness: number;
  alternativeBpm: number | null;
};

type TempoCandidate = {
  lag: number;
  score: number;
  correlation: number;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * fraction)))] ?? 0;
}

/**
 * A compact onset-strength envelope suitable for running over decoded phone audio in JS.
 * It combines broadband and first-difference energy, then keeps only rises above a short
 * local baseline. Unlike the old analyzer, tempo is measured across the whole clip rather
 * than guessed independently inside sub-beat slices.
 */
export function buildTempoOnsetEnvelope(samples: ArrayLike<number>, sampleRate: number): number[] {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || samples.length === 0) return [];

  const hop = Math.max(1, Math.round(sampleRate / ENVELOPE_HZ));
  const frame = Math.max(hop, Math.round(sampleRate * 0.03));
  const features: number[] = [];

  for (let start = 0; start + frame <= samples.length; start += hop) {
    let energy = 0;
    let differenceEnergy = 0;
    let previous = Number(samples[start] ?? 0);
    for (let index = start; index < start + frame; index += 1) {
      const sample = Number(samples[index] ?? 0);
      const difference = sample - previous;
      energy += sample * sample;
      differenceEnergy += difference * difference;
      previous = sample;
    }
    const rms = Math.sqrt(energy / frame);
    const differenceRms = Math.sqrt(differenceEnergy / frame);
    features.push(Math.log1p(rms * 20) + Math.log1p(differenceRms * 40) * 1.5);
  }

  if (features.length === 0) return [];

  const novelty = features.map((feature, index) => {
    const baselineStart = Math.max(0, index - 8);
    let baseline = 0;
    for (let cursor = baselineStart; cursor < index; cursor += 1) baseline += features[cursor] ?? 0;
    const baselineCount = index - baselineStart;
    const localBaseline = baselineCount > 0 ? baseline / baselineCount : feature;
    return Math.max(0, feature - localBaseline);
  });

  const floor = percentile(novelty, 0.5) * 1.5;
  const ceiling = percentile(novelty, 0.98);
  if (ceiling <= floor + Number.EPSILON) return novelty.map(() => 0);
  return novelty.map((value) => clamp01((value - floor) / (ceiling - floor)));
}

function autocorrelations(envelope: number[], minLag: number, maxLag: number): number[] {
  const mean = envelope.reduce((sum, value) => sum + value, 0) / Math.max(1, envelope.length);
  const centered = envelope.map((value) => value - mean);
  const result = new Array(maxLag + 1).fill(0);

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let numerator = 0;
    let leftEnergy = 0;
    let rightEnergy = 0;
    for (let index = lag; index < centered.length; index += 1) {
      const left = centered[index] ?? 0;
      const right = centered[index - lag] ?? 0;
      numerator += left * right;
      leftEnergy += left * left;
      rightEnergy += right * right;
    }
    const denominator = Math.sqrt(leftEnergy * rightEnergy);
    result[lag] = denominator > 0 ? numerator / denominator : 0;
  }
  return result;
}

function candidateScore(correlations: number[], lag: number, maxLag: number): number {
  let score = Math.max(0, correlations[lag] ?? 0);
  let weight = 1;
  if (lag * 2 <= maxLag) {
    score += Math.max(0, correlations[lag * 2] ?? 0) * 0.45;
    weight += 0.45;
  }
  if (lag * 3 <= maxLag) {
    score += Math.max(0, correlations[lag * 3] ?? 0) * 0.2;
    weight += 0.2;
  }

  // If a candidate's half-period is already strongly periodic, prefer that faster pulse.
  // This prevents a strong bar/downbeat accent from turning 120 BPM into 60 BPM.
  const halfLag = Math.round(lag / 2);
  const halfPenalty = halfLag >= 1 ? Math.max(0, correlations[halfLag] ?? 0) * 0.32 : 0;
  const thirdLag = Math.round(lag / 3);
  const thirdPenalty = thirdLag >= 1 ? Math.max(0, correlations[thirdLag] ?? 0) * 0.24 : 0;
  return score / weight - halfPenalty - thirdPenalty;
}

function findCandidates(envelope: number[]): TempoCandidate[] {
  const minLag = Math.max(1, Math.floor((60 * ENVELOPE_HZ) / MAX_DETECTED_BPM));
  const maxLag = Math.min(
    Math.ceil((60 * ENVELOPE_HZ) / MIN_DETECTED_BPM),
    Math.max(minLag, Math.floor(envelope.length / 2))
  );
  if (maxLag <= minLag) return [];

  const correlations = autocorrelations(envelope, minLag, maxLag);
  const scores = new Array(maxLag + 1).fill(-Infinity);
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    scores[lag] = candidateScore(correlations, lag, maxLag);
  }

  const candidates: TempoCandidate[] = [];
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    const score = scores[lag] ?? -Infinity;
    if (score < (scores[lag - 1] ?? -Infinity) || score < (scores[lag + 1] ?? -Infinity)) continue;

    const leftValue = scores[lag - 1];
    const rightValue = scores[lag + 1];
    const left = Number.isFinite(leftValue) ? leftValue : score;
    const right = Number.isFinite(rightValue) ? rightValue : score;
    const curvature = left - 2 * score + right;
    const offset =
      lag === minLag || lag === maxLag || Math.abs(curvature) <= 1e-9
        ? 0
        : Math.max(-0.5, Math.min(0.5, (left - right) / (2 * curvature)));
    candidates.push({
      lag: lag + offset,
      score,
      correlation: correlations[lag] ?? 0,
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function countStrongOnsets(envelope: number[]): number {
  const threshold = Math.max(0.18, percentile(envelope, 0.85));
  let count = 0;
  for (let index = 1; index < envelope.length - 1; index += 1) {
    const value = envelope[index] ?? 0;
    if (value >= threshold && value >= (envelope[index - 1] ?? 0) && value > (envelope[index + 1] ?? 0)) {
      count += 1;
    }
  }
  return count;
}

function bpmForLag(lag: number): number {
  return (60 * ENVELOPE_HZ) / lag;
}

function isSameCandidateFamily(left: TempoCandidate, right: TempoCandidate): boolean {
  const ratio = left.lag / right.lag;
  return Math.abs(ratio - 1) < 0.06;
}

/**
 * Estimate one steady global tempo. Low-evidence audio deliberately returns null:
 * abstaining is part of the accuracy contract, not an error condition.
 */
export function detectTempoFromSamples(samples: ArrayLike<number>, sampleRate: number): TempoEstimate {
  const durationMs = sampleRate > 0 ? (samples.length / sampleRate) * 1_000 : 0;
  if (durationMs < TEMPO_ANALYSIS_MIN_MS) {
    return { bpm: null, confidence: 0, steadiness: 0, alternativeBpm: null };
  }

  const envelope = buildTempoOnsetEnvelope(samples, sampleRate);
  const onsetCount = countStrongOnsets(envelope);
  const candidates = findCandidates(envelope);
  const best = candidates[0];
  if (!best || onsetCount < 4) {
    return { bpm: null, confidence: 0, steadiness: 0, alternativeBpm: null };
  }

  const second = candidates.find((candidate) => !isSameCandidateFamily(best, candidate));
  const periodicity = clamp01((best.score - 0.1) / 0.65);
  const separation = clamp01((best.score - (second?.score ?? 0)) / 0.18);
  const evidence = clamp01((onsetCount - 3) / 10);
  const durationEvidence = clamp01((durationMs - TEMPO_ANALYSIS_MIN_MS) / 8_000);
  const confidence = clamp01(
    periodicity * 0.58 + separation * 0.17 + evidence * 0.15 + durationEvidence * 0.1
  );
  const steadiness = clamp01((best.correlation - 0.05) / 0.7);

  const detectedBpm = bpmForLag(best.lag);
  const roundedBpm = Math.round(detectedBpm);
  const validBpm =
    confidence >= MIN_TEMPO_CONFIDENCE &&
    roundedBpm >= MIN_DETECTED_BPM - 1 &&
    roundedBpm <= MAX_DETECTED_BPM + 1;

  return {
    bpm: validBpm ? Math.max(MIN_DETECTED_BPM, Math.min(MAX_DETECTED_BPM, roundedBpm)) : null,
    confidence,
    steadiness,
    alternativeBpm: second ? Math.round(bpmForLag(second.lag)) : null,
  };
}
