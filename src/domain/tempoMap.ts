import {
    clampMetronomeBpm,
    getMetronomeBeatIntervalMs,
    getMetronomeMeterPreset,
    isMetronomeMeterId,
    type MetronomeMeterId,
} from "./metronome";

/**
 * TempoMap — the musical timebase for a take, sketch, or received song.
 *
 * One map = an ordered list of constant-tempo stretches, each taking effect at a BAR
 * boundary. Grid zero is the downbeat of bar 1 (= `RecordingGrid.firstDownbeatMs` in the
 * audio file). A single-segment map is exactly today's constant bpm/meter grid; every
 * `RecordingGrid` without an explicit map is bridged through `gridTempoMap()`.
 *
 * Design decisions (see docs/product-plan/metronome-grid-and-transport.md §2):
 *  - Changes anchor at bar boundaries only; no mid-bar changes, no time-anchored changes.
 *  - Step changes only in v1. The segment shape may gain `rampToBpm?` later — nothing
 *    here may assume segments can never carry extra fields.
 *  - Positions before grid zero (count-in, retained pre-roll) extrapolate segment 1
 *    backwards: bars ≤ 0, negative ms, negative pulses are all well-defined.
 *  - A "beat"/pulse is one metronome click: pulse length = 60000/bpm, bar length =
 *    pulse × the meter's pulsesPerBar (6/8 = six pulses, matching the engine).
 *
 * All math is pure double-precision ms — sub-nanosecond error over any real song length.
 * Sample-exact click placement stays the native engine's job; this module is the single
 * source of truth for WHERE beats and bars are, never for latency (latencyModel.ts) or
 * scheduling.
 */

export const TEMPO_MAP_SCHEMA_VERSION = 1;

/** Hard cap on segments a map may carry — hygiene bound for imported archives. */
export const MAX_TEMPO_MAP_SEGMENTS = 128;

/** One constant-tempo stretch, in effect from the downbeat of `atBar` until the next
 *  segment (or forever). The first segment of a normalized map is always at bar 1. */
export type TempoSegment = {
    /** 1-based bar at which this segment takes effect. */
    atBar: number;
    bpm: number;
    meterId: MetronomeMeterId;
};

export type TempoMap = {
    schemaVersion: typeof TEMPO_MAP_SCHEMA_VERSION;
    /** Normalized: sorted by atBar, unique bars, first at bar 1, no no-op segments. */
    segments: TempoSegment[];
};

/** A musical position. `beat` is 1-based and may be fractional (1.5 = halfway through
 *  the first pulse). `bar` may be ≤ 0 for positions before grid zero. */
export type BeatPosition = {
    bar: number;
    beat: number;
};

/** Everything the grid knows about one instant, resolved from a map + ms position. */
export type GridPoint = {
    /** 1-based; ≤ 0 before grid zero. */
    bar: number;
    /** 1-based integer pulse within the bar. */
    beatInBar: number;
    /** 0..1 progress through the current pulse. */
    beatFraction: number;
    /** 0-based pulse index from grid zero; negative before it. */
    absolutePulse: number;
    /** ms of this pulse's start, relative to grid zero. */
    pulseStartMs: number;
    /** ms of this bar's downbeat, relative to grid zero. */
    barStartMs: number;
    pulseMs: number;
    pulsesPerBar: number;
    bpm: number;
    meterId: MetronomeMeterId;
};

/** Guards float noise at pulse/bar boundaries: msAtBeat's exact result must floor back
 *  into the pulse it came from, never the one before. Musically invisible (1ns). */
const BOUNDARY_EPSILON_MS = 1e-6;

type SegmentSpan = {
    atBar: number;
    bpm: number;
    meterId: MetronomeMeterId;
    pulsesPerBar: number;
    pulseMs: number;
    barMs: number;
    /** ms of this segment's first downbeat, relative to grid zero. */
    startMs: number;
    /** Absolute pulse index at that downbeat. */
    startPulse: number;
};

function buildSpans(map: TempoMap): SegmentSpan[] {
    const spans: SegmentSpan[] = [];
    for (const segment of map.segments) {
        const preset = getMetronomeMeterPreset(segment.meterId);
        const pulseMs = getMetronomeBeatIntervalMs(segment.bpm);
        const barMs = pulseMs * preset.pulsesPerBar;
        const previous = spans[spans.length - 1];
        const barsInPrevious = previous ? segment.atBar - previous.atBar : 0;
        spans.push({
            atBar: segment.atBar,
            bpm: segment.bpm,
            meterId: segment.meterId,
            pulsesPerBar: preset.pulsesPerBar,
            pulseMs,
            barMs,
            startMs: previous ? previous.startMs + barsInPrevious * previous.barMs : 0,
            startPulse: previous ? previous.startPulse + barsInPrevious * previous.pulsesPerBar : 0,
        });
    }
    return spans;
}

/** Span in effect at `ms` (segment 1 extrapolates backwards before grid zero). */
function spanAtMs(spans: SegmentSpan[], ms: number): SegmentSpan {
    let active = spans[0];
    for (const span of spans) {
        if (span.startMs <= ms + BOUNDARY_EPSILON_MS) {
            active = span;
        } else {
            break;
        }
    }
    return active;
}

/** Span in effect at `bar` (segment 1 extrapolates backwards before bar 1). */
function spanAtBar(spans: SegmentSpan[], bar: number): SegmentSpan {
    let active = spans[0];
    for (const span of spans) {
        if (span.atBar <= bar) {
            active = span;
        } else {
            break;
        }
    }
    return active;
}

export function singleSegmentMap(bpm: number, meterId: MetronomeMeterId): TempoMap {
    return {
        schemaVersion: TEMPO_MAP_SCHEMA_VERSION,
        segments: [{ atBar: 1, bpm: clampMetronomeBpm(bpm), meterId }],
    };
}

/**
 * Data hygiene for a map of trusted shape: sort by bar, last-edit-wins on duplicate
 * bars, clamp bpm, re-anchor the earliest segment to bar 1, drop segments that change
 * nothing. Defensive fallback: an effectively empty map normalizes to a single default
 * segment rather than throwing — callers that care use `sanitizeTempoMap`.
 */
export function normalizeTempoMap(map: TempoMap): TempoMap {
    const byBar = new Map<number, TempoSegment>();
    for (const segment of map.segments) {
        if (!Number.isFinite(segment.atBar) || !Number.isFinite(segment.bpm)) {
            continue;
        }
        if (!isMetronomeMeterId(segment.meterId)) {
            continue;
        }
        const atBar = Math.max(1, Math.round(segment.atBar));
        byBar.set(atBar, {
            atBar,
            bpm: clampMetronomeBpm(segment.bpm),
            meterId: segment.meterId,
        });
    }

    const sorted = [...byBar.values()].sort((left, right) => left.atBar - right.atBar);
    if (sorted.length === 0) {
        return singleSegmentMap(clampMetronomeBpm(Number.NaN), "4/4");
    }

    const segments: TempoSegment[] = [];
    for (const segment of sorted.slice(0, MAX_TEMPO_MAP_SEGMENTS)) {
        const previous = segments[segments.length - 1];
        if (!previous) {
            // The earliest segment defines the grid from the top, wherever it was typed.
            segments.push(segment.atBar === 1 ? segment : { ...segment, atBar: 1 });
            continue;
        }
        if (previous.bpm === segment.bpm && previous.meterId === segment.meterId) {
            continue;
        }
        segments.push(segment);
    }

    return { schemaVersion: TEMPO_MAP_SCHEMA_VERSION, segments };
}

/** The map a RecordingGrid (or anything grid-shaped) plays to: its own map when it
 *  carries one, else a single segment from its bpm/meter. Never returns undefined —
 *  every grid has a timebase. */
export function gridTempoMap(grid: {
    bpm: number;
    meterId: MetronomeMeterId;
    tempoMap?: TempoMap;
}): TempoMap {
    if (grid.tempoMap && grid.tempoMap.segments.length > 0) {
        return normalizeTempoMap(grid.tempoMap);
    }
    return singleSegmentMap(grid.bpm, grid.meterId);
}

/** ms of `bar`'s downbeat relative to grid zero. Bars ≤ 0 extrapolate segment 1. */
export function barStartMs(map: TempoMap, bar: number): number {
    const spans = buildSpans(map);
    const span = spanAtBar(spans, bar);
    return span.startMs + (bar - span.atBar) * span.barMs;
}

/** ms of a musical position relative to grid zero. `beat` may be fractional. */
export function msAtBeat(map: TempoMap, position: BeatPosition): number {
    const spans = buildSpans(map);
    const span = spanAtBar(spans, position.bar);
    return (
        span.startMs +
        (position.bar - span.atBar) * span.barMs +
        (position.beat - 1) * span.pulseMs
    );
}

/** ms of an absolute pulse (0 = grid zero's downbeat; negative = count-in territory). */
export function msAtPulse(map: TempoMap, absolutePulse: number): number {
    const spans = buildSpans(map);
    let span = spans[0];
    for (const candidate of spans) {
        if (candidate.startPulse <= absolutePulse) {
            span = candidate;
        } else {
            break;
        }
    }
    return span.startMs + (absolutePulse - span.startPulse) * span.pulseMs;
}

/** Resolve everything the grid knows about the instant `ms` (relative to grid zero). */
export function beatAtMs(map: TempoMap, ms: number): GridPoint {
    const spans = buildSpans(map);
    const span = spanAtMs(spans, ms);

    const msIntoSpan = ms - span.startMs;
    const barsIntoSpan = Math.floor((msIntoSpan + BOUNDARY_EPSILON_MS) / span.barMs);
    const bar = span.atBar + barsIntoSpan;
    const barStart = span.startMs + barsIntoSpan * span.barMs;
    const msIntoBar = ms - barStart;
    const pulseIntoBar = Math.min(
        span.pulsesPerBar - 1,
        Math.max(0, Math.floor((msIntoBar + BOUNDARY_EPSILON_MS) / span.pulseMs))
    );
    const pulseStart = barStart + pulseIntoBar * span.pulseMs;

    return {
        bar,
        beatInBar: pulseIntoBar + 1,
        beatFraction: Math.min(1, Math.max(0, (ms - pulseStart) / span.pulseMs)),
        absolutePulse: span.startPulse + barsIntoSpan * span.pulsesPerBar + pulseIntoBar,
        pulseStartMs: pulseStart,
        barStartMs: barStart,
        pulseMs: span.pulseMs,
        pulsesPerBar: span.pulsesPerBar,
        bpm: span.bpm,
        meterId: span.meterId,
    };
}

/** The segment in effect at `bar` — what the grid editor shows for "tempo here". */
export function segmentAtBar(map: TempoMap, bar: number): TempoSegment {
    let active = map.segments[0];
    for (const segment of map.segments) {
        if (segment.atBar <= bar) {
            active = segment;
        } else {
            break;
        }
    }
    return active;
}

export function tempoMapEquals(left: TempoMap | undefined, right: TempoMap | undefined): boolean {
    if (!left || !right) {
        return left === right;
    }
    if (left.segments.length !== right.segments.length) {
        return false;
    }
    return left.segments.every((segment, index) => {
        const other = right.segments[index];
        return (
            segment.atBar === other.atBar &&
            segment.bpm === other.bpm &&
            segment.meterId === other.meterId
        );
    });
}

/** True when the map is just one segment — the simple single-tempo state. */
export function isSingleTempo(map: TempoMap): boolean {
    return map.segments.length <= 1;
}

/**
 * Validate an UNTRUSTED value (imported archive, persisted snapshot from a future or
 * hostile build) into a normalized TempoMap, or undefined when it isn't one. Unknown
 * extra fields are dropped, not preserved — the archive keeps the original JSON.
 */
export function sanitizeTempoMap(value: unknown): TempoMap | undefined {
    if (!value || typeof value !== "object") {
        return undefined;
    }
    const candidate = value as { schemaVersion?: unknown; segments?: unknown };
    if (!Array.isArray(candidate.segments) || candidate.segments.length === 0) {
        return undefined;
    }

    const segments: TempoSegment[] = [];
    for (const raw of candidate.segments.slice(0, MAX_TEMPO_MAP_SEGMENTS)) {
        if (!raw || typeof raw !== "object") {
            continue;
        }
        const segment = raw as { atBar?: unknown; bpm?: unknown; meterId?: unknown };
        if (
            typeof segment.atBar !== "number" ||
            !Number.isFinite(segment.atBar) ||
            typeof segment.bpm !== "number" ||
            !Number.isFinite(segment.bpm) ||
            !isMetronomeMeterId(segment.meterId)
        ) {
            continue;
        }
        segments.push({
            atBar: segment.atBar,
            bpm: segment.bpm,
            meterId: segment.meterId,
        });
    }

    if (segments.length === 0) {
        return undefined;
    }

    return normalizeTempoMap({ schemaVersion: TEMPO_MAP_SCHEMA_VERSION, segments });
}
