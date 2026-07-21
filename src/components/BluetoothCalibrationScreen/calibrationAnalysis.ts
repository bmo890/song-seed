import { MAX_BLUETOOTH_MONITORING_AUTO_OFFSET_MS } from "../../domain/bluetoothMonitoring";

export const CALIBRATION_BPM = 90;
export const CALIBRATION_BEAT_INTERVAL_MS = Math.round(60000 / CALIBRATION_BPM);
export const AUDIO_MIN_VALID_BEAT_TAPS = 7;
export const IGNORED_LEAD_IN_BEATS = 2;
export const AUDIO_TAP_OUTLIER_WINDOW_MS = MAX_BLUETOOTH_MONITORING_AUTO_OFFSET_MS;
export const AUDIO_MAX_ALLOWED_MAD_MS = 130;
export const TAP_DEDUPE_WINDOW_MS = 120;

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
