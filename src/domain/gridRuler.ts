import { getMetronomeBeatIntervalMs, getMetronomeMeterPreset } from "./metronome";
import { beatAtMs, gridTempoMap, type TempoMap } from "./tempoMap";
import type { RecordingGrid } from "../types";

/**
 * Grid ruler — turns a take's beat grid into render-ready primitives for the reel:
 * bar lines, beat ticks, sparse bar numbers, and tempo/meter change markers, all in
 * FILE milliseconds (the overlay multiplies by px/ms). Pure geometry: no timing, no
 * latency, no scheduling — the manuscript lines under the waveform, nothing more.
 *
 * Honesty rules (docs/product-plan/metronome-grid-and-transport.md §3):
 *  - No grid, or `firstDownbeatMs` unknown → NO ruler. We never draw a guessed grid.
 *  - Past `gridValidToMs` (route change mid-take) the ruler stops — absence is the
 *    honest signal that the grid can't be trusted there.
 *  - Pre-roll (file audio before the first downbeat) is reported for quiet shading,
 *    not ruled — there are no trustworthy bar lines before the one.
 *
 * Density adapts to zoom via `pixelsPerMs` (base-content px/ms, which already carries
 * the reel's zoom): bar lines thin to every 2nd/4th/8th… bar when tight, beat ticks
 * appear only once a beat has real room, labels stay sparse and capped.
 */

export type GridRulerBarLine = {
    ms: number;
    bar: number;
};

export type GridRulerLabel = {
    ms: number;
    bar: number;
};

export type GridRulerChangeMarker = {
    ms: number;
    bar: number;
    /** e.g. "6/8 · 70" — meter and tempo taking effect at this bar line. */
    label: string;
};

export type GridRulerModel = {
    barLines: GridRulerBarLine[];
    /** Non-downbeat pulse positions (downbeats already have bar lines). */
    beatTicks: number[];
    barLabels: GridRulerLabel[];
    changeMarkers: GridRulerChangeMarker[];
    /** File-ms end of retained pre-roll (audio before the one), null when none. */
    preRollEndMs: number | null;
    /** File-ms where the ruler stops early because the grid became untrustworthy
     *  (`gridValidToMs`); null when the grid holds to the end of the file. */
    validToMs: number | null;
};

export type GridRulerGrid = Pick<
    RecordingGrid,
    "bpm" | "meterId" | "tempoMap" | "firstDownbeatMs" | "gridValidToMs"
>;

/** Minimum on-screen px between drawn bar lines before thinning to every Nth bar. */
const MIN_BAR_LINE_PX = 24;
/** Beat ticks appear only once one beat spans at least this many px. */
const MIN_BEAT_TICK_PX = 14;
/** Minimum px between bar-number labels. */
const MIN_LABEL_PX = 64;
/** Hard cap on label count — labels are React views, lines are cheap Skia rects. */
const MAX_BAR_LABELS = 28;
const BAR_STEP_SERIES = [1, 2, 4, 8, 16, 32, 64, 128] as const;

function pickStep(unitPx: number, minPx: number): number {
    for (const step of BAR_STEP_SERIES) {
        if (unitPx * step >= minPx) {
            return step;
        }
    }
    return BAR_STEP_SERIES[BAR_STEP_SERIES.length - 1];
}

/**
 * Assistive magnet: the nearest grid line (bar or beat) to `ms`, or null when `ms`
 * is not within `toleranceMs` of one — a scrub or a slid stem lands anywhere it
 * likes, and only CLOSE misses get pulled onto the line. Same honesty gates as the
 * ruler: no trustworthy grid (or past `gridValidToMs`) → never snaps.
 */
export function snapToGrid(args: {
    grid: GridRulerGrid | null | undefined;
    ms: number;
    toleranceMs: number;
    unit: "bar" | "beat";
}): number | null {
    const { grid, ms, toleranceMs, unit } = args;
    if (!grid || !Number.isFinite(ms) || toleranceMs <= 0) {
        return null;
    }
    if (grid.firstDownbeatMs == null || !Number.isFinite(grid.firstDownbeatMs)) {
        return null;
    }
    const offsetMs = Math.max(0, grid.firstDownbeatMs);
    if (ms < offsetMs - toleranceMs) {
        return null;
    }

    const point = beatAtMs(gridTempoMap(grid), ms - offsetMs);
    const lineStartMs = unit === "bar" ? point.barStartMs : point.pulseStartMs;
    const lineLengthMs = unit === "bar" ? point.pulseMs * point.pulsesPerBar : point.pulseMs;
    // A magnet wider than ~40% of the spacing would capture EVERYTHING between two
    // lines — cap it so free placement always keeps a dead zone in the middle.
    const effectiveToleranceMs = Math.min(toleranceMs, lineLengthMs * 0.4);
    const previous = offsetMs + lineStartMs;
    const next = previous + lineLengthMs;
    const candidate = ms - previous <= next - ms ? previous : next;
    if (Math.abs(ms - candidate) > effectiveToleranceMs || candidate < offsetMs - 1) {
        return null;
    }
    if (
        typeof grid.gridValidToMs === "number" &&
        Number.isFinite(grid.gridValidToMs) &&
        candidate > grid.gridValidToMs
    ) {
        return null;
    }
    return candidate;
}

/**
 * Build the ruler for one clip, or null when there is nothing trustworthy to draw.
 * `pixelsPerMs` is the reel's base-content px/ms (zoom already baked in); the model
 * must be rebuilt when it changes — it only affects density choices, all positions
 * stay in file ms.
 */
export function buildGridRulerModel(args: {
    grid: GridRulerGrid | null | undefined;
    durationMs: number;
    pixelsPerMs: number;
}): GridRulerModel | null {
    const { grid, durationMs, pixelsPerMs } = args;
    if (!grid || durationMs <= 0 || pixelsPerMs <= 0) {
        return null;
    }
    // Unknown downbeat position = unknown grid placement. Never draw a guess.
    if (grid.firstDownbeatMs == null || !Number.isFinite(grid.firstDownbeatMs)) {
        return null;
    }

    const offsetMs = Math.max(0, grid.firstDownbeatMs);
    const hasEarlyStop =
        typeof grid.gridValidToMs === "number" &&
        Number.isFinite(grid.gridValidToMs) &&
        grid.gridValidToMs < durationMs;
    const endMs = hasEarlyStop ? Math.max(offsetMs, grid.gridValidToMs as number) : durationMs;
    if (endMs <= offsetMs) {
        return null;
    }

    const map: TempoMap = gridTempoMap(grid);

    const barLines: GridRulerBarLine[] = [];
    const beatTicks: number[] = [];
    const barLabels: GridRulerLabel[] = [];
    const changeMarkers: GridRulerChangeMarker[] = [];

    // Walk segments in file time, carrying the running bar cursor. Each segment picks
    // its own densities from its own bar/pulse length — a slow 6/8 stretch may show
    // beats while a fast 4/4 stretch shows only bars.
    for (let index = 0; index < map.segments.length; index += 1) {
        const segment = map.segments[index];
        const next = map.segments[index + 1];
        const pulseMs = getMetronomeBeatIntervalMs(segment.bpm);
        const pulsesPerBar = getMetronomeMeterPreset(segment.meterId).pulsesPerBar;
        const barMs = pulseMs * pulsesPerBar;

        // File-ms of this segment's first downbeat: sum of the preceding segments.
        let segmentStartMs = offsetMs;
        for (let prior = 0; prior < index; prior += 1) {
            const priorSegment = map.segments[prior];
            const priorBars = map.segments[prior + 1].atBar - priorSegment.atBar;
            segmentStartMs +=
                getMetronomeBeatIntervalMs(priorSegment.bpm) *
                getMetronomeMeterPreset(priorSegment.meterId).pulsesPerBar *
                priorBars;
        }
        if (segmentStartMs >= endMs) {
            break;
        }

        if (index > 0) {
            changeMarkers.push({
                ms: segmentStartMs,
                bar: segment.atBar,
                label: `${segment.meterId} · ${segment.bpm}`,
            });
        }

        const barStep = pickStep(barMs * pixelsPerMs, MIN_BAR_LINE_PX);
        const labelStep = Math.max(barStep, pickStep(barMs * pixelsPerMs, MIN_LABEL_PX));
        const drawBeats = pulseMs * pixelsPerMs >= MIN_BEAT_TICK_PX;

        const lastBarExclusive = next
            ? next.atBar
            : segment.atBar + Math.ceil((endMs - segmentStartMs) / barMs);

        for (let bar = segment.atBar; bar < lastBarExclusive; bar += 1) {
            const barStartMs = segmentStartMs + (bar - segment.atBar) * barMs;
            if (barStartMs > endMs) {
                break;
            }
            const barsIntoSegment = bar - segment.atBar;
            if (barsIntoSegment % barStep === 0) {
                barLines.push({ ms: barStartMs, bar });
                if (barsIntoSegment % labelStep === 0) {
                    barLabels.push({ ms: barStartMs, bar });
                }
            }
            if (drawBeats) {
                for (let beat = 1; beat < pulsesPerBar; beat += 1) {
                    const tickMs = barStartMs + beat * pulseMs;
                    if (tickMs > endMs) {
                        break;
                    }
                    beatTicks.push(tickMs);
                }
            }
        }
    }

    // Labels are the only per-item React views — keep them countable no matter how
    // long the clip is. Thinning keeps every kept label on its original bar line.
    let labels = barLabels;
    while (labels.length > MAX_BAR_LABELS) {
        labels = labels.filter((_, labelIndex) => labelIndex % 2 === 0);
    }

    // A change marker owns its bar line's annotation — drop the plain number there.
    const changeBars = new Set(changeMarkers.map((marker) => marker.bar));
    labels = labels.filter((label) => !changeBars.has(label.bar));

    return {
        barLines,
        beatTicks,
        barLabels: labels,
        changeMarkers,
        preRollEndMs: offsetMs > 0 ? offsetMs : null,
        validToMs: hasEarlyStop ? endMs : null,
    };
}
