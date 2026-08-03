import { MAX_BLUETOOTH_MONITORING_AUTO_OFFSET_MS } from "../../domain/bluetoothMonitoring";

export const CALIBRATION_BPM = 90;
export const CALIBRATION_BEAT_INTERVAL_MS = Math.round(60000 / CALIBRATION_BPM);
export const CALIBRATION_BEAT_COUNT = 16;
export const AUDIO_MIN_VALID_BEAT_TAPS = 7;
export const IGNORED_LEAD_IN_BEATS = 2;
export const AUDIO_TAP_OUTLIER_WINDOW_MS = MAX_BLUETOOTH_MONITORING_AUTO_OFFSET_MS;
export const AUDIO_MAX_ALLOWED_MAD_MS = 130;
export const TAP_DEDUPE_WINDOW_MS = 120;

/** Gap-pattern constants. The pass stays a steady grid (so taps are PREDICTIVE — the
 *  performer's prediction cancels their reaction time, which a random "hearing test"
 *  beep cannot), but a few beats are silenced at random each run. The app knows the
 *  gaps; the tapper can't fake them — matching taps against the gap fingerprint pins
 *  every tap to its true beat, so "tapped 50 ms early" is no longer confusable with
 *  "tapped 617 ms late" (the aliasing that poisoned consistent early tappers). */
export const PATTERN_LOCK_IN_BEATS = 3;
export const PATTERN_SILENT_BEAT_COUNT = 4;
/** How far ahead of the perceived beat a tap may land and still be recovered. */
export const MAX_EARLY_TAP_MS = 160;
/** A tap farther than this from every played beat belongs to none of them. */
const PATTERN_MATCH_WINDOW_MS = 240;
const LAG_SEARCH_STEP_MS = 5;

export type PhaseAnalysis = {
  medianMs: number;
  madMs: number;
  tapCount: number;
};

export function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function medianAbsoluteDeviation(values: number[], center: number) {
  return median(values.map((value) => Math.abs(value - center)));
}

export function analyzeAudioPhaseTaps(taps: number[], totalBeats: number): PhaseAnalysis | null {
  const sortedTaps = [...taps].sort((a, b) => a - b);
  const dedupedTaps: number[] = [];
  sortedTaps.forEach((tapTime) => {
    const previousTap = dedupedTaps[dedupedTaps.length - 1];
    if (previousTap != null && tapTime - previousTap < TAP_DEDUPE_WINDOW_MS) {
      return;
    }
    dedupedTaps.push(tapTime);
  });

  const residualByBeat = new Map<number, number>();

  dedupedTaps.forEach((tapTime) => {
    const beatIndex = Math.floor(tapTime / CALIBRATION_BEAT_INTERVAL_MS);
    if (beatIndex < 0 || beatIndex >= totalBeats || beatIndex < IGNORED_LEAD_IN_BEATS) {
      return;
    }

    const expectedTime = beatIndex * CALIBRATION_BEAT_INTERVAL_MS;
    const residual = tapTime - expectedTime;
    if (Math.abs(residual) > AUDIO_TAP_OUTLIER_WINDOW_MS) {
      return;
    }

    // First tap per beat wins. Keeping the closest-to-zero tap (the old rule) biased the
    // median LOW whenever a beat window caught a stray second tap.
    if (!residualByBeat.has(beatIndex)) {
      residualByBeat.set(beatIndex, residual);
    }
  });

  const residuals = Array.from(residualByBeat.values());
  if (residuals.length < AUDIO_MIN_VALID_BEAT_TAPS) {
    return null;
  }

  const center = median(residuals);
  const mad = medianAbsoluteDeviation(residuals, center);
  if (mad > AUDIO_MAX_ALLOWED_MAD_MS) {
    return null;
  }

  return {
    medianMs: center,
    madMs: mad,
    tapCount: residuals.length,
  };
}

/** One gap pattern per calibration run: the lock-in beats and the final beat always
 *  play (the tapper needs a few beats to find the tempo, and the pass must not end on
 *  silence); the silent beats land among the rest, never two in a row (two consecutive
 *  gaps breaks the tapper's internal pulse). */
export function buildCalibrationGapPattern(
  beatCount = CALIBRATION_BEAT_COUNT,
  rng: () => number = Math.random
): boolean[] {
  const pattern: boolean[] = new Array(beatCount).fill(true);
  let placed = 0;
  let attempts = 0;
  while (placed < PATTERN_SILENT_BEAT_COUNT && attempts < 200) {
    attempts += 1;
    const index =
      PATTERN_LOCK_IN_BEATS +
      Math.floor(rng() * Math.max(1, beatCount - 1 - PATTERN_LOCK_IN_BEATS));
    if (index >= beatCount - 1 || !pattern[index]) {
      continue;
    }
    if (!pattern[index - 1] || !pattern[index + 1]) {
      continue;
    }
    pattern[index] = false;
    placed += 1;
  }
  return pattern;
}

/**
 * Analyze taps against a gap pattern by finding the lag that best aligns the tap train
 * with the PLAYED beats. Searching a range that extends BELOW zero is the point: a
 * consistent early tapper produces a genuine negative center, which the plain
 * beat-bucket analysis (analyzeAudioPhaseTaps) aliases into a huge late one. A wrong
 * whole-beat shift loses the score because taps then land on silent slots.
 */
export function analyzePatternPhaseTaps(taps: number[], pattern: boolean[]): PhaseAnalysis | null {
  const interval = CALIBRATION_BEAT_INTERVAL_MS;
  const sortedTaps = [...taps].sort((a, b) => a - b);
  const dedupedTaps: number[] = [];
  sortedTaps.forEach((tapTime) => {
    const previousTap = dedupedTaps[dedupedTaps.length - 1];
    if (previousTap != null && tapTime - previousTap < TAP_DEDUPE_WINDOW_MS) {
      return;
    }
    dedupedTaps.push(tapTime);
  });

  const playedSlots = pattern
    .map((isPlayed, slotIndex) => (isPlayed ? slotIndex : -1))
    .filter((slotIndex) => slotIndex >= IGNORED_LEAD_IN_BEATS);
  if (playedSlots.length < AUDIO_MIN_VALID_BEAT_TAPS || dedupedTaps.length === 0) {
    return null;
  }
  const playedTimes = playedSlots.map((slotIndex) => slotIndex * interval);

  const nearestPlayedIndex = (relativeTime: number) => {
    // playedTimes is sorted; binary search for the closest entry.
    let low = 0;
    let high = playedTimes.length - 1;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (playedTimes[mid] < relativeTime) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    if (low > 0 && Math.abs(playedTimes[low - 1] - relativeTime) <= Math.abs(playedTimes[low] - relativeTime)) {
      return low - 1;
    }
    return low;
  };

  let bestLagMs = 0;
  let bestScore = -1;
  for (
    let lagMs = -MAX_EARLY_TAP_MS;
    lagMs <= MAX_BLUETOOTH_MONITORING_AUTO_OFFSET_MS;
    lagMs += LAG_SEARCH_STEP_MS
  ) {
    let score = 0;
    for (const tapTime of dedupedTaps) {
      const distance = Math.abs(playedTimes[nearestPlayedIndex(tapTime - lagMs)] - (tapTime - lagMs));
      if (distance <= PATTERN_MATCH_WINDOW_MS) {
        score += 1 - distance / PATTERN_MATCH_WINDOW_MS;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestLagMs = lagMs;
    }
  }

  // Residuals at the winning alignment — first tap per played beat wins, same as the
  // steady analysis.
  const residualBySlot = new Map<number, number>();
  dedupedTaps.forEach((tapTime) => {
    const playedIndex = nearestPlayedIndex(tapTime - bestLagMs);
    if (Math.abs(playedTimes[playedIndex] - (tapTime - bestLagMs)) > PATTERN_MATCH_WINDOW_MS) {
      return;
    }
    const slotIndex = playedSlots[playedIndex];
    if (!residualBySlot.has(slotIndex)) {
      residualBySlot.set(slotIndex, tapTime - playedTimes[playedIndex]);
    }
  });

  const residuals = Array.from(residualBySlot.values());
  if (residuals.length < AUDIO_MIN_VALID_BEAT_TAPS) {
    return null;
  }
  const center = median(residuals);
  const mad = medianAbsoluteDeviation(residuals, center);
  if (mad > AUDIO_MAX_ALLOWED_MAD_MS) {
    return null;
  }
  return {
    medianMs: center,
    madMs: mad,
    tapCount: residuals.length,
  };
}

/** Cross-check the two ear passes against each other and the OS report. Both passes share
 *  the same ears and tap reflexes, so their difference is purely the pipeline delta — a
 *  gap beyond these bounds means one pass measured wrong, and a single bad pass silently
 *  poisons every Bluetooth take until the user thinks to recalibrate (observed on device:
 *  a 600ms music outlier against a real ~340ms started the master a quarter-second early
 *  on every overdub). Warn, don't block: the numbers stay the user's call. */
export function buildResultWarning(
  playerMs: number | null,
  clickMs: number | null,
  reportedMs: number | null,
  translate?: (key: string, options?: Record<string, unknown>) => string
): string | null {
  if (playerMs == null || clickMs == null) {
    return null;
  }
  const pipelineGapMs = playerMs - clickMs;
  if (pipelineGapMs > 250 || pipelineGapMs < -80) {
    if (translate) return translate("bluetoothCalibrationWarnings.unusualGap", { gap: Math.abs(Math.round(pipelineGapMs)), direction: translate(pipelineGapMs > 0 ? "bluetoothCalibrationWarnings.above" : "bluetoothCalibrationWarnings.below") });
    return `The music pass came out ${Math.abs(Math.round(pipelineGapMs))} ms ${pipelineGapMs > 0 ? "above" : "below"} the click pass — that gap is unusual for one set of headphones. One of the passes likely measured wrong; a retry is recommended before saving.`;
  }
  if (reportedMs != null && Math.abs(playerMs - reportedMs) > 300) {
    if (translate) return translate("bluetoothCalibrationWarnings.farFromReported", { music: Math.round(playerMs), reported: reportedMs });
    return `The music pass (${Math.round(playerMs)} ms) is far from the OS-reported route latency (~${reportedMs} ms). That can be real, but a retry is recommended before saving.`;
  }
  return null;
}
