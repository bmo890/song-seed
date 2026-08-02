import type { ClipAnalysis, ClipSection, ClipVersion, PracticeMarker, RecordingGrid } from "../types";
import { MAX_METRONOME_BPM, MIN_METRONOME_BPM } from "./metronome";
import { MIN_SECTION_LENGTH_MS, normalizeSections } from "./playerSections";
import {
    barStartMs,
    beatAtMs,
    gridTempoMap,
    normalizeTempoMap,
    segmentAtBar,
    TEMPO_MAP_SCHEMA_VERSION,
    type TempoMap,
    type TempoSegment,
} from "./tempoMap";

/**
 * Carry a clip's musical metadata across a destructive edit.
 *
 * Every editor output (extract, cut, speed/pitch bake) is a NEW clip whose timeline
 * differs from its source, so pins, sections, the detected tempo and — hardest — the
 * recording grid all have to be re-expressed against the new timeline. Before this
 * module the editor cloned pins verbatim onto a shorter file (silently pointing at the
 * wrong moment) and dropped sections and the grid entirely.
 *
 * The whole module is pure: `(source metadata, edit description) → new metadata`. It
 * never touches audio, storage or state.
 *
 * ## What "the grid survives" means
 *
 * A `RecordingGrid` is an anchor (`firstDownbeatMs`, file t=0 → the downbeat of bar 1)
 * plus a bar-anchored `TempoMap`. An edit that changes the timeline can preserve that
 * only when the surviving audio still lines up with a single coherent bar grid:
 *
 *  - **Extract** always survives exactly. We re-anchor bar 1 onto the first downbeat
 *    inside the extract; the partial bar before it is covered by the map's backward
 *    extrapolation (tempo only ever changes at bar lines, so this is exact — an extract
 *    that starts on beat 3 keeps a perfect grid).
 *  - **Head/tail cuts** are just a rebase and a clamp. Exact.
 *  - **Interior cuts** are exact when the seam is *grid-transparent*: the removed span
 *    is a whole number of bars, and — when the cut edges sit mid-bar — the tempo and
 *    meter match on both sides, so the two halves reassemble into one correctly-sized
 *    bar. Bars downstream simply renumber.
 *  - **Any other interior cut** genuinely voids the grid past the seam (the classic
 *    case: a cut that lands mid-bar so the music re-enters on beat 3 while the grid
 *    still says beat 1). We do not pretend otherwise — the grid is kept and
 *    `gridValidToMs` is set to the seam, which is exactly the "trustworthy only up to
 *    here" semantics the recorder already uses for mid-take interruptions.
 *
 * Alignment is decided by construction (the editor snaps region edges to the grid),
 * never by a generous tolerance. `SEAM_ALIGNMENT_TOLERANCE_MS` only absorbs the
 * sub-millisecond error of storing edges as whole ms — a freehand cut 30ms off a bar
 * line is off the bar line, and is treated as such.
 *
 * See docs/product-plan/clip-editor-flows.md §3.
 */

/** A stretch of source audio that survives into the output, in source-file ms. */
export type KeptSpan = { startMs: number; endMs: number };

/**
 * What the musician asked for when the two goals collide — cutting exactly where they
 * want, versus keeping the take's metronome grid.
 *
 * `preserve` is the snapping mode: edges stick to bars, so seams stay transparent and
 * the grid comes through whole. If something still breaks it (a nudge off the grid, or
 * an invalidation inherited from the source take) the grid is kept up to the break.
 *
 * `free` is reach-over-grid: cut anywhere. An edit that breaks the grid produces a clip
 * with NO grid rather than one whose click dies partway through — a half-valid grid is
 * the worst of both, and a musician who turned snapping off has said they don't want it.
 *
 * Either way pins and sections always survive: they are positions in time, not bar
 * positions, so nothing about them depends on alignment.
 */
export type GridPolicy = "preserve" | "free";

/** What became of the source's recording grid — drives the save sheet's honesty line. */
export type GridOutcome =
    /** The source had no usable grid to begin with. */
    | { kind: "none" }
    /** The grid survives across the whole output. */
    | { kind: "kept" }
    /** The grid is trustworthy up to `validToMs` in the OUTPUT and untrusted after. */
    | { kind: "partial"; validToMs: number }
    /** The source had a grid, but nothing coherent survives (no downbeat, or an
     *  unrepresentable tempo after a rate change). */
    | { kind: "dropped" };

/** The clip fields this module re-expresses. Everything else the editor carries verbatim. */
export type RemappableClipFacts = Pick<
    ClipVersion,
    "practiceMarkers" | "sections" | "recordingGrid" | "analysis"
>;

export type ClipEditRemap = RemappableClipFacts & { gridOutcome: GridOutcome };

/**
 * How far a seam may sit from a bar line and still count as bar-aligned. This is
 * float/rounding hygiene only — region edges are stored as whole ms, so a snapped edge
 * can miss the true downbeat by up to half a millisecond at each end. It is NOT a
 * musical tolerance: at 1.5ms nothing audible passes that shouldn't.
 */
const SEAM_ALIGNMENT_TOLERANCE_MS = 1.5;

/**
 * How far the click may drift from the audio before we stop trusting the grid. Baking a
 * speed change scales every tempo, and tempos are stored as whole bpm — so an inexact
 * scale (102 bpm × 1.1 = 112.2 → 112) accumulates error. ~25ms is where a click starts
 * to audibly flam against the recording.
 */
const GRID_DRIFT_TOLERANCE_MS = 25;

/** Guards float noise when comparing ms/bar positions. */
const EPSILON_MS = 1e-6;

// ---------------------------------------------------------------- span algebra

/** One kept stretch, paired with where it lands in the output. */
type SpanRun = {
    sourceStartMs: number;
    sourceEndMs: number;
    outputStartMs: number;
    /** `sourceMs − outputMs` for any instant inside this run. */
    offsetMs: number;
};

/**
 * Kept ranges = the complement of the removed ranges over [0, durationMs]. Shared with
 * the audio renderer (`services/audioTrim`) so the rendered file and the remapped
 * metadata can never disagree about which material survived.
 */
export function complementSpans(removed: KeptSpan[], durationMs: number): KeptSpan[] {
    const clamped = removed
        .map((span) => ({
            startMs: Math.max(0, Math.min(durationMs, span.startMs)),
            endMs: Math.max(0, Math.min(durationMs, span.endMs)),
        }))
        .filter((span) => span.endMs > span.startMs)
        .sort((left, right) => left.startMs - right.startMs);

    const kept: KeptSpan[] = [];
    let cursor = 0;
    for (const span of clamped) {
        if (span.startMs > cursor) {
            kept.push({ startMs: cursor, endMs: span.startMs });
        }
        cursor = Math.max(cursor, span.endMs);
    }
    if (cursor < durationMs) {
        kept.push({ startMs: cursor, endMs: durationMs });
    }
    return kept;
}

/**
 * Sort, clamp and merge kept spans, then lay them out end-to-end on the output
 * timeline. Touching spans merge: two adjacent keeps are one continuous stretch, not a
 * seam, and must not be treated as one.
 */
export function buildSpanRuns(spans: KeptSpan[], sourceDurationMs: number): SpanRun[] {
    const ceiling = sourceDurationMs > 0 ? sourceDurationMs : Number.MAX_SAFE_INTEGER;
    const clamped = spans
        .map((span) => ({
            startMs: Math.max(0, Math.min(ceiling, span.startMs)),
            endMs: Math.max(0, Math.min(ceiling, span.endMs)),
        }))
        .filter((span) => span.endMs > span.startMs)
        .sort((left, right) => left.startMs - right.startMs);

    const merged: KeptSpan[] = [];
    for (const span of clamped) {
        const previous = merged[merged.length - 1];
        if (previous && span.startMs <= previous.endMs + EPSILON_MS) {
            previous.endMs = Math.max(previous.endMs, span.endMs);
            continue;
        }
        merged.push({ ...span });
    }

    const runs: SpanRun[] = [];
    let outputCursor = 0;
    for (const span of merged) {
        runs.push({
            sourceStartMs: span.startMs,
            sourceEndMs: span.endMs,
            outputStartMs: outputCursor,
            offsetMs: span.startMs - outputCursor,
        });
        outputCursor += span.endMs - span.startMs;
    }
    return runs;
}

export function spanRunsOutputDurationMs(runs: SpanRun[]): number {
    return runs.reduce((total, run) => total + (run.sourceEndMs - run.sourceStartMs), 0);
}

/** Output ms of a source instant, or null when that instant was removed. */
function mapInstant(runs: SpanRun[], sourceMs: number): number | null {
    for (const run of runs) {
        // Inclusive at both edges: an instant landing exactly on a seam still exists in
        // the output (it IS the seam), and the earliest matching run wins so it can't
        // resolve twice.
        if (sourceMs >= run.sourceStartMs - EPSILON_MS && sourceMs <= run.sourceEndMs + EPSILON_MS) {
            return sourceMs - run.offsetMs;
        }
    }
    return null;
}

/** Output ms of the first surviving instant at or after `sourceMs`, or null when none. */
function mapForward(runs: SpanRun[], sourceMs: number): number | null {
    for (const run of runs) {
        if (sourceMs <= run.sourceStartMs) return run.outputStartMs;
        if (sourceMs <= run.sourceEndMs + EPSILON_MS) return sourceMs - run.offsetMs;
    }
    return null;
}

/** How much of [startMs, endMs) survives the edit. */
function survivingMs(runs: SpanRun[], startMs: number, endMs: number): number {
    let total = 0;
    for (const run of runs) {
        total += Math.max(
            0,
            Math.min(endMs, run.sourceEndMs) - Math.max(startMs, run.sourceStartMs)
        );
    }
    return total;
}

// ---------------------------------------------------------------- grid: spans

/** Fractional bar index of a grid-relative instant, plus the local bar length. */
function fractionalBar(map: TempoMap, gridMs: number): { bar: number; barMs: number } {
    const point = beatAtMs(map, gridMs);
    const barMs = point.pulseMs * point.pulsesPerBar;
    return { bar: point.bar + (gridMs - point.barStartMs) / barMs, barMs };
}

/** True when a fractional bar index sits on a bar line (within storage rounding). */
function sitsOnBarLine(bar: number, barMs: number): boolean {
    const fraction = bar - Math.floor(bar);
    return (
        fraction * barMs <= SEAM_ALIGNMENT_TOLERANCE_MS ||
        (1 - fraction) * barMs <= SEAM_ALIGNMENT_TOLERANCE_MS
    );
}

type SeamAnalysis = {
    /** Whole bars the seam removes — the amount downstream bars renumber by. */
    removedBars: number;
    /** True when the output still lines up with one coherent grid across this seam. */
    transparent: boolean;
    /** Where the seam lands on the output timeline. */
    outputMs: number;
};

function analyzeSeam(map: TempoMap, before: SpanRun, after: SpanRun, downbeatMs: number): SeamAnalysis {
    const left = fractionalBar(map, before.sourceEndMs - downbeatMs);
    const right = fractionalBar(map, after.sourceStartMs - downbeatMs);
    const deltaBars = right.bar - left.bar;
    const removedBars = Math.round(deltaBars);
    const barMs = Math.min(left.barMs, right.barMs);

    const wholeBars =
        removedBars >= 0 && Math.abs(deltaBars - removedBars) * barMs <= SEAM_ALIGNMENT_TOLERANCE_MS;

    // Cutting between two bar lines always reassembles. Cutting mid-bar only works when
    // the two halves belong to bars of the same shape — otherwise the joined bar is a
    // musical chimera whose length matches neither tempo.
    const onBarLines = sitsOnBarLine(left.bar, left.barMs) && sitsOnBarLine(right.bar, right.barMs);
    const leftSegment = segmentAtBar(map, Math.floor(left.bar));
    const rightSegment = segmentAtBar(map, Math.floor(right.bar));
    const sameTempo =
        leftSegment.bpm === rightSegment.bpm && leftSegment.meterId === rightSegment.meterId;

    return {
        removedBars,
        transparent: wholeBars && (onBarLines || sameTempo),
        outputMs: after.outputStartMs,
    };
}

function remapGridForSpans(
    grid: RecordingGrid,
    runs: SpanRun[],
    outputDurationMs: number,
    policy: GridPolicy
): { grid?: RecordingGrid; outcome: GridOutcome } {
    const downbeatMs = grid.firstDownbeatMs;
    if (downbeatMs == null || !Number.isFinite(downbeatMs) || !Number.isFinite(grid.bpm)) {
        return { outcome: { kind: "none" } };
    }
    if (runs.length === 0) {
        return { outcome: { kind: "dropped" } };
    }

    const map = gridTempoMap(grid);

    const seams = runs
        .slice(1)
        .map((run, index) => analyzeSeam(map, runs[index], run, downbeatMs));

    const firstBadSeam = seams.find((seam) => !seam.transparent);
    if (firstBadSeam && policy === "free") {
        // Free editing: this cut broke the grid, and the musician has already said they
        // would rather have the cut. Hand back a plain audio clip instead of one whose
        // click stops halfway with no explanation.
        return { outcome: { kind: "dropped" } };
    }

    // The grid is trustworthy until whichever comes first: a seam that breaks it, or the
    // source's own existing invalidation point carried onto the new timeline. Note the
    // latter is inherited truth about the audio, not something this edit did — so it
    // limits the grid under either policy.
    let validToMs = Number.POSITIVE_INFINITY;
    if (firstBadSeam) {
        validToMs = firstBadSeam.outputMs;
    }
    if (grid.gridValidToMs != null && Number.isFinite(grid.gridValidToMs)) {
        const carried = mapForward(runs, grid.gridValidToMs);
        if (carried != null) {
            validToMs = Math.min(validToMs, carried);
        }
    }

    // Bar 1 of the output is the first source downbeat that survives into trusted
    // material. Everything before it extrapolates backwards, exactly.
    let anchorBar = 0;
    let anchorOutputMs = 0;
    let anchorRunIndex = -1;
    for (let index = 0; index < runs.length; index += 1) {
        const run = runs[index];
        if (run.outputStartMs >= validToMs) break;

        const pointAtStart = beatAtMs(map, run.sourceStartMs - downbeatMs);
        let bar = pointAtStart.bar;
        if (barStartMs(map, bar) + downbeatMs < run.sourceStartMs - EPSILON_MS) {
            bar += 1;
        }
        const downbeatSourceMs = barStartMs(map, bar) + downbeatMs;
        if (downbeatSourceMs > run.sourceEndMs + EPSILON_MS) continue; // no downbeat in this run

        const downbeatOutputMs = downbeatSourceMs - run.offsetMs;
        if (downbeatOutputMs >= validToMs) break;

        anchorBar = bar;
        anchorOutputMs = Math.max(0, downbeatOutputMs);
        anchorRunIndex = index;
        break;
    }
    if (anchorRunIndex < 0) {
        return { outcome: { kind: "dropped" } };
    }

    // Output bar = source bar − shift. Constant within a run; each transparent seam adds
    // the bars it removed.
    const shifts = new Array<number>(runs.length).fill(0);
    shifts[anchorRunIndex] = anchorBar - 1;
    for (let index = anchorRunIndex + 1; index < runs.length; index += 1) {
        shifts[index] = shifts[index - 1] + seams[index - 1].removedBars;
    }
    for (let index = anchorRunIndex - 1; index >= 0; index -= 1) {
        shifts[index] = shifts[index + 1] - seams[index].removedBars;
    }

    const collected: TempoSegment[] = [];
    for (let index = 0; index < runs.length; index += 1) {
        const run = runs[index];
        if (run.outputStartMs >= validToMs) break;

        const startBar = beatAtMs(map, run.sourceStartMs - downbeatMs).bar;
        const endBar = beatAtMs(map, run.sourceEndMs - downbeatMs).bar;

        // Whatever tempo is in force as this run opens, restated at the run's own first
        // bar — this is what keeps a tempo change that began inside removed material.
        const active = segmentAtBar(map, startBar);
        collected.push({ atBar: startBar - shifts[index], bpm: active.bpm, meterId: active.meterId });

        for (const segment of map.segments) {
            if (segment.atBar > startBar && segment.atBar <= endBar) {
                collected.push({
                    atBar: segment.atBar - shifts[index],
                    bpm: segment.bpm,
                    meterId: segment.meterId,
                });
            }
        }
    }

    // Bars at or below zero all clamp to bar 1, last one winning — which is precisely the
    // tempo in force at the output's first downbeat.
    const outputMap = normalizeTempoMap({
        schemaVersion: TEMPO_MAP_SCHEMA_VERSION,
        segments: collected,
    });
    const head = outputMap.segments[0];

    const boundedValidTo =
        Number.isFinite(validToMs) && validToMs < outputDurationMs - EPSILON_MS
            ? Math.max(0, Math.round(validToMs))
            : undefined;

    // The count-in only still describes this clip when the head is untouched.
    const headIntact = anchorRunIndex === 0 && runs[0].sourceStartMs <= EPSILON_MS && anchorBar === 1;

    return {
        grid: {
            bpm: head.bpm,
            meterId: head.meterId,
            tempoMap: outputMap.segments.length > 1 ? outputMap : undefined,
            grouping: grid.grouping ? [...grid.grouping] : undefined,
            countInBars: headIntact ? grid.countInBars : 0,
            clickThroughTake: grid.clickThroughTake,
            firstDownbeatMs: anchorOutputMs,
            gridValidToMs: boundedValidTo,
            source: grid.source,
        },
        outcome:
            boundedValidTo != null ? { kind: "partial", validToMs: boundedValidTo } : { kind: "kept" },
    };
}

// ---------------------------------------------------------------- grid: rate

function remapGridForRate(
    grid: RecordingGrid,
    rate: number,
    outputDurationMs: number
): { grid?: RecordingGrid; outcome: GridOutcome } {
    if (grid.firstDownbeatMs == null || !Number.isFinite(grid.firstDownbeatMs) || !Number.isFinite(grid.bpm)) {
        return { outcome: { kind: "none" } };
    }
    if (!Number.isFinite(rate) || rate <= 0) {
        return { outcome: { kind: "dropped" } };
    }
    if (Math.abs(rate - 1) <= 1e-9) {
        return { grid: { ...grid }, outcome: { kind: "kept" } };
    }

    const map = gridTempoMap(grid);
    const scaled: TempoSegment[] = [];
    let worstRelativeError = 0;
    for (const segment of map.segments) {
        const exact = segment.bpm * rate;
        const stored = Math.round(exact);
        if (stored < MIN_METRONOME_BPM || stored > MAX_METRONOME_BPM) {
            // The new tempo can't be expressed, so no honest grid can be written.
            return { outcome: { kind: "dropped" } };
        }
        worstRelativeError = Math.max(worstRelativeError, Math.abs(exact - stored) / stored);
        scaled.push({ atBar: segment.atBar, bpm: stored, meterId: segment.meterId });
    }

    const outputMap = normalizeTempoMap({ schemaVersion: TEMPO_MAP_SCHEMA_VERSION, segments: scaled });
    const head = outputMap.segments[0];

    // Rounding to whole bpm means the stored grid creeps away from the audio. Say so
    // rather than letting the click drift into nonsense late in a long take.
    const driftHorizonMs =
        worstRelativeError > 0 ? GRID_DRIFT_TOLERANCE_MS / worstRelativeError : Number.POSITIVE_INFINITY;
    const carriedValidToMs =
        grid.gridValidToMs != null && Number.isFinite(grid.gridValidToMs)
            ? grid.gridValidToMs / rate
            : Number.POSITIVE_INFINITY;
    const validToMs = Math.min(driftHorizonMs, carriedValidToMs);
    const boundedValidTo =
        Number.isFinite(validToMs) && validToMs < outputDurationMs - EPSILON_MS
            ? Math.max(0, Math.round(validToMs))
            : undefined;

    return {
        grid: {
            bpm: head.bpm,
            meterId: head.meterId,
            tempoMap: outputMap.segments.length > 1 ? outputMap : undefined,
            grouping: grid.grouping ? [...grid.grouping] : undefined,
            countInBars: grid.countInBars,
            clickThroughTake: grid.clickThroughTake,
            firstDownbeatMs: Math.max(0, grid.firstDownbeatMs / rate),
            gridValidToMs: boundedValidTo,
            source: grid.source,
        },
        outcome:
            boundedValidTo != null ? { kind: "partial", validToMs: boundedValidTo } : { kind: "kept" },
    };
}

// ---------------------------------------------------------------- pins & sections

function remapMarkersForSpans(
    markers: PracticeMarker[] | undefined,
    runs: SpanRun[]
): PracticeMarker[] | undefined {
    if (!markers?.length) return undefined;
    const remapped: PracticeMarker[] = [];
    for (const marker of markers) {
        const atMs = mapInstant(runs, marker.atMs);
        if (atMs == null) continue; // the moment it marked no longer exists
        remapped.push({ ...marker, atMs: Math.max(0, Math.round(atMs)) });
    }
    return remapped.length > 0 ? remapped : undefined;
}

function remapSectionsForSpans(
    sections: ClipSection[] | undefined,
    runs: SpanRun[],
    outputDurationMs: number
): ClipSection[] | undefined {
    if (!sections?.length) return undefined;
    const remapped: ClipSection[] = [];
    for (const section of sections) {
        // A section straddling a cut stays ONE section: the surviving material is joined,
        // so the result is simply shorter.
        const survivingLengthMs = survivingMs(runs, section.startMs, section.endMs);
        if (survivingLengthMs < MIN_SECTION_LENGTH_MS) continue;
        const startMs = mapForward(runs, section.startMs);
        if (startMs == null) continue;
        remapped.push({
            ...section,
            startMs: Math.max(0, Math.round(startMs)),
            endMs: Math.max(0, Math.round(startMs + survivingLengthMs)),
        });
    }
    if (remapped.length === 0) return undefined;
    return normalizeSections(remapped, outputDurationMs);
}

function scaleMarkers(markers: PracticeMarker[] | undefined, rate: number): PracticeMarker[] | undefined {
    if (!markers?.length) return undefined;
    return markers.map((marker) => ({ ...marker, atMs: Math.max(0, Math.round(marker.atMs / rate)) }));
}

function scaleSections(
    sections: ClipSection[] | undefined,
    rate: number,
    outputDurationMs: number
): ClipSection[] | undefined {
    if (!sections?.length) return undefined;
    return normalizeSections(
        sections.map((section) => ({
            ...section,
            startMs: Math.max(0, Math.round(section.startMs / rate)),
            endMs: Math.max(0, Math.round(section.endMs / rate)),
        })),
        outputDurationMs
    );
}

/** A detected tempo is only carried where the pulse it describes is still continuous. */
function carryAnalysis(analysis: ClipAnalysis | undefined, rate = 1): ClipAnalysis | undefined {
    if (!analysis) return undefined;
    const scale = (bpm: number | null | undefined) =>
        bpm != null && Number.isFinite(bpm) ? Math.round(bpm * rate) : bpm ?? null;
    return {
        ...analysis,
        bpm: scale(analysis.bpm),
        bpmAlternative: analysis.bpmAlternative != null ? scale(analysis.bpmAlternative) : analysis.bpmAlternative,
        // The musician confirmed a tempo for the SOURCE; the derived clip has to earn it.
        confirmed: false,
    };
}

// ---------------------------------------------------------------- public API

/**
 * Re-express a clip's metadata for an edit that keeps `spans` of the source and joins
 * them in order. Extract passes one span; a cut passes the complement of what it
 * removes (see `complementSpans`) — the same list the renderer concatenates.
 *
 * `gridPolicy` decides what happens when the edit breaks the take's bar grid; it has no
 * effect on an edit that can't break it. Notably every extract and every head/tail cut
 * keeps its grid under both policies — only an interior seam can break alignment, so
 * free editing costs the grid exactly when it has to and never merely as a punishment.
 */
export function remapClipForSpans(
    source: RemappableClipFacts,
    spans: KeptSpan[],
    sourceDurationMs: number,
    options: { gridPolicy?: GridPolicy } = {}
): ClipEditRemap {
    const gridPolicy = options.gridPolicy ?? "preserve";
    const runs = buildSpanRuns(spans, sourceDurationMs);
    const outputDurationMs = spanRunsOutputDurationMs(runs);
    if (runs.length === 0 || outputDurationMs <= 0) {
        return { gridOutcome: source.recordingGrid ? { kind: "dropped" } : { kind: "none" } };
    }

    const gridResult = source.recordingGrid
        ? remapGridForSpans(source.recordingGrid, runs, outputDurationMs, gridPolicy)
        : { grid: undefined, outcome: { kind: "none" } as GridOutcome };

    return {
        practiceMarkers: remapMarkersForSpans(source.practiceMarkers, runs),
        sections: remapSectionsForSpans(source.sections, runs, outputDurationMs),
        recordingGrid: gridResult.grid,
        // Seams break the pulse the detector measured; a single kept span doesn't.
        analysis: runs.length === 1 ? carryAnalysis(source.analysis) : undefined,
        gridOutcome: gridResult.outcome,
    };
}

/**
 * Re-express a clip's metadata for a baked speed/pitch change. `playbackRate` 1 means
 * pitch-only, which leaves every timeline untouched.
 */
export function remapClipForRate(
    source: RemappableClipFacts,
    playbackRate: number,
    outputDurationMs: number
): ClipEditRemap {
    const rate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;
    const gridResult = source.recordingGrid
        ? remapGridForRate(source.recordingGrid, rate, outputDurationMs)
        : { grid: undefined, outcome: { kind: "none" } as GridOutcome };

    return {
        practiceMarkers: scaleMarkers(source.practiceMarkers, rate),
        sections: scaleSections(source.sections, rate, outputDurationMs),
        recordingGrid: gridResult.grid,
        analysis: carryAnalysis(source.analysis, rate),
        gridOutcome: gridResult.outcome,
    };
}
