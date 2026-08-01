import { MAX_METRONOME_BPM, MIN_METRONOME_BPM } from "./metronome";
import { gridTempoMap } from "./tempoMap";
import { isPlaybackClickAvailable, type PlaybackClickGrid } from "./playbackClick";

/**
 * Step up — the progressive practice looper's pure decisions.
 *
 * While the practice loop repeats a passage, the playback rate climbs on a ladder:
 * start at `startRate`, add `increment` after every `loopsPerStep` completed passes,
 * hold at `targetRate`. The player drills a hard part from slow to full tempo
 * without touching the controls.
 *
 * Everything here derives from (params, completedLoops) — the caller stores only a
 * pass counter and asks for the rate, never accumulates it (repeated addition is
 * float dirt; a counter survives re-renders and restores).
 *
 * The ladder respects two rate ranges up front, at normalization time:
 * the transport's practice-speed range, and — when the playback click is sounding —
 * the click engine's supported range (`clickEngineParamsAt` returns null when the
 * scaled bpm leaves 40–240; the ladder must not climb the click into silence).
 */

export type StepUpParams = {
    /** Rate of the first pass. */
    startRate: number;
    /** Added to the rate at each step. */
    increment: number;
    /** Completed passes before each step up. */
    loopsPerStep: number;
    /** The ladder holds here — 1× by default, deliberately allowed beyond. */
    targetRate: number;
};

export type RateBounds = {
    minRate: number;
    maxRate: number;
};

export const STEP_UP_DEFAULTS: StepUpParams = {
    startRate: 0.5,
    increment: 0.05,
    loopsPerStep: 4,
    targetRate: 1,
};

/** Rates live on a 0.01 lattice — the finest the speed UI distinguishes. */
const RATE_RESOLUTION = 0.01;
const RATE_EPSILON = 1e-9;

const RATE_LATTICE = 1 / RATE_RESOLUTION;

function snapRate(rate: number): number {
    return Math.round(rate * RATE_LATTICE) / RATE_LATTICE;
}

function snapRateUp(rate: number): number {
    return Math.ceil(rate * RATE_LATTICE - RATE_EPSILON) / RATE_LATTICE;
}

function snapRateDown(rate: number): number {
    return Math.floor(rate * RATE_LATTICE + RATE_EPSILON) / RATE_LATTICE;
}

/**
 * Clamp params into a usable ladder: rates snapped and held inside `bounds`,
 * increment positive, loopsPerStep a whole number ≥ 1, and the target never below
 * the start (a lower target degenerates to holding the start rate, honestly).
 */
export function normalizeStepUpParams(
    params: StepUpParams,
    bounds?: RateBounds | null
): StepUpParams {
    const minRate = bounds ? snapRateUp(bounds.minRate) : RATE_RESOLUTION;
    const maxRate = bounds ? Math.max(minRate, snapRateDown(bounds.maxRate)) : Number.POSITIVE_INFINITY;

    const clampRate = (rate: number, fallback: number) => {
        const safe = Number.isFinite(rate) && rate > 0 ? rate : fallback;
        return Math.min(maxRate, Math.max(minRate, snapRate(safe)));
    };

    const startRate = clampRate(params.startRate, STEP_UP_DEFAULTS.startRate);
    const targetRate = Math.max(startRate, clampRate(params.targetRate, STEP_UP_DEFAULTS.targetRate));
    const increment =
        Number.isFinite(params.increment) && params.increment > 0
            ? Math.max(RATE_RESOLUTION, snapRate(params.increment))
            : STEP_UP_DEFAULTS.increment;
    const loopsPerStep =
        Number.isFinite(params.loopsPerStep) && params.loopsPerStep >= 1
            ? Math.round(params.loopsPerStep)
            : STEP_UP_DEFAULTS.loopsPerStep;

    return { startRate, increment, loopsPerStep, targetRate };
}

/** The rate of the pass being played after `completedLoops` finished passes. */
export function stepUpRateAtLoop(params: StepUpParams, completedLoops: number): number {
    const safeLoops = Number.isFinite(completedLoops) ? Math.max(0, Math.floor(completedLoops)) : 0;
    const steps = Math.floor(safeLoops / params.loopsPerStep);
    return snapRate(Math.min(params.targetRate, params.startRate + steps * params.increment));
}

export type StepUpProgress = {
    /** Rate of the pass currently playing. */
    rate: number;
    /** The ladder has finished climbing; the loop holds at `rate`. */
    atTarget: boolean;
    /** 1-based position of the current pass within its step (meaningless at target). */
    loopInStep: number;
    loopsPerStep: number;
    targetRate: number;
};

export function stepUpProgressAtLoop(params: StepUpParams, completedLoops: number): StepUpProgress {
    const safeLoops = Number.isFinite(completedLoops) ? Math.max(0, Math.floor(completedLoops)) : 0;
    const rate = stepUpRateAtLoop(params, safeLoops);
    return {
        rate,
        atTarget: rate >= params.targetRate - RATE_EPSILON,
        loopInStep: (safeLoops % params.loopsPerStep) + 1,
        loopsPerStep: params.loopsPerStep,
        targetRate: params.targetRate,
    };
}

/**
 * A sequence is the general form of the ladder: explicit stages, each holding a
 * rate for a number of passes — "2 passes at 0.6×, 2 at 0.7×, 3 at 0.75×". Rates
 * need no grid and no bpm: they scale the track itself, so a sequence works on any
 * clip. Nothing forces the rates upward — a recovery slow pass mid-drill is legal.
 * When the last stage's passes are done the loop holds its rate; the drill never
 * yanks the speed away mid-practice.
 */
export type StepUpStage = {
    /** Passes to play at this stage's rate — whole number ≥ 1. */
    loops: number;
    rate: number;
};

/** Hygiene bound for the customizer — more steps than this means the drill is a setlist. */
export const MAX_STEP_UP_STAGES = 12;

export const STEP_UP_DEFAULT_SEQUENCE: StepUpStage[] = [
    { loops: 2, rate: 0.6 },
    { loops: 2, rate: 0.7 },
    { loops: 2, rate: 0.8 },
    { loops: 2, rate: 0.9 },
    { loops: 2, rate: 1 },
];

/** Compile ladder params into their equivalent explicit sequence. */
export function stagesFromLadder(params: StepUpParams): StepUpStage[] {
    const stages: StepUpStage[] = [];
    for (let loops = 0; stages.length < MAX_STEP_UP_STAGES; loops += params.loopsPerStep) {
        const rate = stepUpRateAtLoop(params, loops);
        stages.push({ loops: params.loopsPerStep, rate });
        if (rate >= params.targetRate - RATE_EPSILON) {
            break;
        }
    }
    return stages;
}

/**
 * Clamp a sequence into usable stages: rates snapped and held inside `bounds`,
 * loops whole numbers ≥ 1, at most MAX_STEP_UP_STAGES. An empty or fully-junk
 * sequence falls back to the default, clamped the same way.
 */
export function normalizeStepUpSequence(
    stages: StepUpStage[],
    bounds?: RateBounds | null
): StepUpStage[] {
    const minRate = bounds ? snapRateUp(bounds.minRate) : RATE_RESOLUTION;
    const maxRate = bounds ? Math.max(minRate, snapRateDown(bounds.maxRate)) : Number.POSITIVE_INFINITY;

    const normalized = stages
        .filter((stage) => Number.isFinite(stage.rate) && stage.rate > 0)
        .slice(0, MAX_STEP_UP_STAGES)
        .map((stage) => ({
            loops:
                Number.isFinite(stage.loops) && stage.loops >= 1 ? Math.round(stage.loops) : 1,
            rate: Math.min(maxRate, Math.max(minRate, snapRate(stage.rate))),
        }));

    if (normalized.length === 0) {
        return normalizeStepUpSequence(STEP_UP_DEFAULT_SEQUENCE, bounds);
    }
    return normalized;
}

export type StepUpSequenceProgress = {
    /** Rate of the pass currently playing. */
    rate: number;
    /** Every stage's passes are done; the loop holds the last rate. */
    atEnd: boolean;
    /** 0-based index of the current stage (the last stage once at end). */
    stageIndex: number;
    stageCount: number;
    /** 1-based position of the current pass within its stage (= stage loops at end). */
    loopInStage: number;
    /** The current stage's pass count. */
    stageLoops: number;
};

export function stepUpSequenceProgressAtLoop(
    stages: StepUpStage[],
    completedLoops: number
): StepUpSequenceProgress {
    const safeStages = stages.length > 0 ? stages : STEP_UP_DEFAULT_SEQUENCE;
    let remaining = Number.isFinite(completedLoops) ? Math.max(0, Math.floor(completedLoops)) : 0;
    for (let index = 0; index < safeStages.length; index += 1) {
        const stage = safeStages[index];
        if (remaining < stage.loops) {
            return {
                rate: stage.rate,
                atEnd: false,
                stageIndex: index,
                stageCount: safeStages.length,
                loopInStage: remaining + 1,
                stageLoops: stage.loops,
            };
        }
        remaining -= stage.loops;
    }
    const last = safeStages[safeStages.length - 1];
    return {
        rate: last.rate,
        atEnd: true,
        stageIndex: safeStages.length - 1,
        stageCount: safeStages.length,
        loopInStage: last.loops,
        stageLoops: last.loops,
    };
}

/** Total passes before the sequence settles on its final rate. */
export function stepUpSequenceTotalLoops(stages: StepUpStage[]): number {
    return stages.reduce((total, stage) => total + stage.loops, 0);
}

/**
 * The key of the first candidate plan the sequence matches, or null when the plan is
 * the musician's own edit. Callers key their presets however they like (built-in ids,
 * saved-preset ids) and label them themselves — naming is i18n's job, not the domain's.
 */
export function matchStepUpPreset(
    sequence: StepUpStage[],
    candidates: { key: string; stages: StepUpStage[] }[],
    bounds?: RateBounds | null
): string | null {
    for (const candidate of candidates) {
        if (stepUpSequencesEqual(sequence, normalizeStepUpSequence(candidate.stages, bounds))) {
            return candidate.key;
        }
    }
    return null;
}

export function stepUpSequencesEqual(a: StepUpStage[], b: StepUpStage[]): boolean {
    return (
        a.length === b.length &&
        a.every((stage, index) => stage.loops === b[index].loops && stage.rate === b[index].rate)
    );
}

/**
 * Boilerplate drills — varying levels of slowness, all ending at baseline. The point
 * of the tool is always the same (practice slower, build up); the presets differ in
 * how deep below baseline the drill starts and how long it lingers there.
 */
export type StepUpBuiltinPresetId = "slowBuild" | "steadyClimb" | "polish";

export type StepUpBuiltinPreset = {
    id: StepUpBuiltinPresetId;
    stages: StepUpStage[];
};

export const STEP_UP_BUILTIN_PRESETS: StepUpBuiltinPreset[] = [
    // Significantly slower, a nudge faster every single pass — the classic long drill.
    { id: "slowBuild", stages: stagesFromLadder({ startRate: 0.5, increment: 0.05, loopsPerStep: 1, targetRate: 1 }) },
    // Two passes per rung, moderate depth (also the default sequence).
    { id: "steadyClimb", stages: STEP_UP_DEFAULT_SEQUENCE },
    // Just under baseline — for a passage that is nearly there.
    {
        id: "polish",
        stages: [
            { loops: 2, rate: 0.85 },
            { loops: 2, rate: 0.9 },
            { loops: 2, rate: 0.95 },
            { loops: 2, rate: 1 },
        ],
    },
];

/**
 * The rate range at which this take's playback click can sound at all: every
 * tempo-map segment's scaled bpm must stay inside the engine's 40–240. Null when the
 * take has no trustworthy grid (no click to protect — the ladder is unconstrained).
 * Bounds snap inward so any rate on the lattice inside them survives
 * `clickEngineParamsAt`'s own range check.
 */
export function clickRateBounds(grid: PlaybackClickGrid | null | undefined): RateBounds | null {
    if (!isPlaybackClickAvailable(grid)) {
        return null;
    }
    let minRate = 0;
    let maxRate = Number.POSITIVE_INFINITY;
    for (const segment of gridTempoMap(grid!).segments) {
        minRate = Math.max(minRate, MIN_METRONOME_BPM / segment.bpm);
        maxRate = Math.min(maxRate, MAX_METRONOME_BPM / segment.bpm);
    }
    return { minRate: snapRateUp(minRate), maxRate: snapRateDown(maxRate) };
}

/** Null when the ranges don't overlap — the caller decides which constraint yields. */
export function intersectRateBounds(a: RateBounds, b: RateBounds | null): RateBounds | null {
    if (!b) {
        return a;
    }
    const minRate = Math.max(a.minRate, b.minRate);
    const maxRate = Math.min(a.maxRate, b.maxRate);
    return minRate <= maxRate + RATE_EPSILON ? { minRate, maxRate } : null;
}
