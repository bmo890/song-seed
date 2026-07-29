import type { RecordingGrid } from "../types";

/**
 * Align a take's beat grid to the metronome clicks the microphone actually recorded.
 *
 * The grid stamped at record time is built from SCHEDULED click epochs. The click the
 * performer heard — and played to, and the mic captured — lands later than its schedule
 * by the route's output+input latency. When the OS reports that latency it is corrected;
 * when it doesn't (common on Android and Bluetooth routes) the whole take sits audibly
 * "a half beat off the grid lines". The recorded click bleed is ground truth by
 * definition: it IS the beat as the performer experienced it. So when the click ran
 * through the take, measure its phase in the saved audio and shift the grid onto it.
 *
 * The measurement is a comb filter over the detail-waveform sidecar (~16–30ms per bin):
 * for each candidate phase, sum the peak energy at grid-spaced positions; the true click
 * phase scores far above the median. Pure and RN-free so every decision is testable.
 */

export type ClickPhaseEstimate = {
    /** Click phase in file ms, in [0, beatMs). */
    phaseMs: number;
    /** Peak comb score over the median score. Below ~1.3 the "clicks" are noise. */
    contrast: number;
};

/** Comb score contrast below which the estimate is noise and must not touch the grid. */
export const MIN_CLICK_CONTRAST = 1.35;
/** Never move the grid more than this fraction of a beat — past it, phase is ambiguous. */
export const MAX_CORRECTION_BEAT_FRACTION = 0.45;
/** Corrections smaller than this are within measurement noise — leave the grid alone. */
export const MIN_CORRECTION_MS = 30;
/** The two halves of the take must agree on the click phase to within this. Music is
 *  periodic too (a comb finds rhythm in any song), but only a click is PHASE-LOCKED for
 *  the whole take — validated against real takes, where songs score high contrast but
 *  their halves disagree by hundreds of ms. */
export const MAX_HALF_PHASE_DISAGREEMENT_MS = 45;

export function estimateClickPhase(args: {
    bins: number[];
    durationMs: number;
    beatMs: number;
    /** Search step in ms. Default 4ms — well under a sidecar bin. */
    stepMs?: number;
    /** Restrict the comb to a window of the take (for the split-half stability gate). */
    windowMs?: [number, number];
}): ClickPhaseEstimate | null {
    const { bins, durationMs, beatMs, stepMs = 4 } = args;
    const [windowStart, windowEnd] = args.windowMs ?? [0, durationMs];
    if (!bins.length || durationMs <= 0 || beatMs <= 0) return null;
    // Need enough beats for the comb to separate clicks from noise.
    if ((windowEnd - windowStart) / beatMs < 6) return null;

    const msPerBin = durationMs / bins.length;
    // Positive deviation from the noise floor — clicks are spikes above it.
    const sorted = [...bins].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const spikes = bins.map((v) => Math.max(0, v - median));

    const phases: number[] = [];
    const scores: number[] = [];
    for (let phase = 0; phase < beatMs; phase += stepMs) {
        let sum = 0;
        let count = 0;
        for (let t = phase + Math.ceil(Math.max(0, windowStart - phase) / beatMs) * beatMs; t < windowEnd; t += beatMs) {
            const bin = Math.floor(t / msPerBin);
            if (bin >= 0 && bin < spikes.length) {
                sum += spikes[bin];
                count += 1;
            }
        }
        phases.push(phase);
        scores.push(count > 0 ? sum / count : 0);
    }

    let bestIndex = 0;
    for (let index = 1; index < scores.length; index += 1) {
        if (scores[index] > scores[bestIndex]) bestIndex = index;
    }
    const sortedScores = [...scores].sort((a, b) => a - b);
    const medianScore = sortedScores[Math.floor(sortedScores.length / 2)] ?? 0;
    if (medianScore <= 0 || scores[bestIndex] <= 0) return null;

    // Parabolic refinement around the peak (phases wrap around the beat).
    const previous = scores[(bestIndex - 1 + scores.length) % scores.length];
    const next = scores[(bestIndex + 1) % scores.length];
    const peak = scores[bestIndex];
    const denominator = previous - 2 * peak + next;
    const shift = denominator !== 0 ? (0.5 * (previous - next)) / denominator : 0;
    const refined =
        (phases[bestIndex] + Math.max(-1, Math.min(1, shift)) * stepMs + beatMs) % beatMs;

    return { phaseMs: refined, contrast: peak / medianScore };
}

export type GridAlignmentResult =
    | { kind: "corrected"; grid: RecordingGrid; correctionMs: number; contrast: number }
    | { kind: "stamped"; grid: RecordingGrid; contrast: number }
    | { kind: "unchanged"; reason: string };

/**
 * Decide what the recorded clicks say about this grid.
 *
 * - A grid WITH a stamped downbeat gets a small phase correction (device latency),
 *   capped well under half a beat so the bar phase can never flip.
 * - A grid with a NULL downbeat (the record-time measurement failed) gets stamped from
 *   the audio: bar lines land on real clicks. Which click is beat 1 is not knowable from
 *   phase alone, so the stamp is beat-aligned — honest lines, possibly renumbered bars —
 *   which beats drawing nothing.
 * - Tempo-mapped takes are left alone: one comb phase cannot describe a tempo change.
 */
export function alignGridToRecordedClicks(args: {
    grid: RecordingGrid;
    bins: number[];
    durationMs: number;
}): GridAlignmentResult {
    const { grid, bins, durationMs } = args;
    if (!grid.clickThroughTake) return { kind: "unchanged", reason: "no click in take" };
    if (grid.tempoMap) return { kind: "unchanged", reason: "tempo-mapped take" };
    if (!(grid.bpm > 0)) return { kind: "unchanged", reason: "no bpm" };

    const beatMs = 60000 / grid.bpm;
    const estimate = estimateClickPhase({ bins, durationMs, beatMs });
    if (!estimate) return { kind: "unchanged", reason: "no estimate" };
    if (estimate.contrast < MIN_CLICK_CONTRAST) {
        return { kind: "unchanged", reason: `contrast ${estimate.contrast.toFixed(2)}` };
    }

    // Phase-lock gate: both halves of the take must hear the click at the same phase.
    const firstHalf = estimateClickPhase({ bins, durationMs, beatMs, windowMs: [0, durationMs / 2] });
    const secondHalf = estimateClickPhase({
        bins,
        durationMs,
        beatMs,
        windowMs: [durationMs / 2, durationMs],
    });
    if (!firstHalf || !secondHalf) return { kind: "unchanged", reason: "too short to verify" };
    let halfDelta = Math.abs(firstHalf.phaseMs - secondHalf.phaseMs);
    if (halfDelta > beatMs / 2) halfDelta = beatMs - halfDelta;
    if (halfDelta > MAX_HALF_PHASE_DISAGREEMENT_MS) {
        return { kind: "unchanged", reason: `not phase-locked (${Math.round(halfDelta)}ms)` };
    }

    if (grid.firstDownbeatMs == null) {
        return {
            kind: "stamped",
            grid: { ...grid, firstDownbeatMs: estimate.phaseMs },
            contrast: estimate.contrast,
        };
    }

    // Signed distance from the stamped phase to the measured phase, wrapped to ±beat/2.
    const stampedPhase = ((grid.firstDownbeatMs % beatMs) + beatMs) % beatMs;
    let correction = estimate.phaseMs - stampedPhase;
    if (correction > beatMs / 2) correction -= beatMs;
    if (correction < -beatMs / 2) correction += beatMs;

    if (Math.abs(correction) < MIN_CORRECTION_MS) {
        return { kind: "unchanged", reason: `within noise (${Math.round(correction)}ms)` };
    }
    if (Math.abs(correction) > beatMs * MAX_CORRECTION_BEAT_FRACTION) {
        return { kind: "unchanged", reason: `ambiguous (${Math.round(correction)}ms)` };
    }

    let corrected = grid.firstDownbeatMs + correction;
    if (corrected < 0) corrected += beatMs;
    return {
        kind: "corrected",
        grid: { ...grid, firstDownbeatMs: corrected },
        correctionMs: correction,
        contrast: estimate.contrast,
    };
}
