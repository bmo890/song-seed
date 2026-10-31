import { gridTempoMap } from "./tempoMap";
import { isPlaybackClickAvailable, type PlaybackClickGrid } from "./playbackClick";

/**
 * Speed counted in BPM (founder, 2026-10-31): on a take recorded with the
 * metronome the practice speed can be read and set as a tempo ("80 bpm")
 * instead of a rate ("0.8×"). It is the same rate underneath: every transport,
 * the click, step up and the per-clip memory still hold a plain rate. BPM is
 * only how the number is shown and how far one step moves it.
 *
 * The tempo it counts from is the take's own: the first tempo-map segment of a
 * grid the click trusts. A take with no trustworthy grid has no BPM unit at all.
 */

export type SpeedUnit = "rate" | "bpm";

/** Rates set from a BPM sit on this lattice: fine enough that any whole bpm
 *  from 20 to 300 survives the round trip (bpm → rate → bpm). */
const BPM_RATE_LATTICE = 1000;
const EPSILON = 1e-9;

/** The take's own tempo, or null when it has none the click trusts. */
export function speedBaseBpm(grid: PlaybackClickGrid | null | undefined): number | null {
    if (!grid || !isPlaybackClickAvailable(grid)) {
        return null;
    }
    const bpm = gridTempoMap(grid).segments[0]?.bpm;
    return bpm != null && Number.isFinite(bpm) && bpm > 0 ? bpm : null;
}

/** The tempo heard at `rate`, as a whole bpm. */
export function bpmAtRate(baseBpm: number, rate: number): number {
    return Math.round(baseBpm * rate);
}

/** The rate that plays the take at `bpm`. */
export function rateAtBpm(baseBpm: number, bpm: number): number {
    return Math.round((bpm / baseBpm) * BPM_RATE_LATTICE) / BPM_RATE_LATTICE;
}

/** Whole bpms reachable inside a rate range. */
export function bpmRange(baseBpm: number, minRate: number, maxRate: number): { minBpm: number; maxBpm: number } {
    const minBpm = Math.ceil(baseBpm * minRate - EPSILON);
    const maxBpm = Math.max(minBpm, Math.floor(baseBpm * maxRate + EPSILON));
    return { minBpm, maxBpm };
}

/**
 * One step of `stepBpm` from `rate`, landing on a multiple of it ("80 → 85 → 90"
 * rather than "82 → 87"), held inside the rate range.
 */
export function stepRateByBpm(args: {
    baseBpm: number;
    rate: number;
    direction: -1 | 1;
    stepBpm: number;
    minRate: number;
    maxRate: number;
}): number {
    const { baseBpm, rate, direction, stepBpm, minRate, maxRate } = args;
    const { minBpm, maxBpm } = bpmRange(baseBpm, minRate, maxRate);
    // From the bpm the musician reads, not the rate's float tail (0.667 × 120 = 80.04).
    const heard = bpmAtRate(baseBpm, rate);
    const next =
        direction > 0
            ? Math.floor(heard / stepBpm) * stepBpm + stepBpm
            : Math.ceil(heard / stepBpm) * stepBpm - stepBpm;
    return rateAtBpm(baseBpm, Math.min(maxBpm, Math.max(minBpm, next)));
}
