import {
    MAX_METRONOME_BPM,
    MIN_METRONOME_BPM,
    getMetronomeAccentPattern,
    getMetronomeBeatIntervalMs,
    getMetronomeMeterPreset,
} from "./metronome";
import { beatAtMs, gridTempoMap, segmentAtBar, type TempoMap } from "./tempoMap";
import type { RecordingGrid } from "../types";

/**
 * Playback click — pure decisions for clicking along with an existing take.
 *
 * The grid is read-only here: the take was recorded against it, and the click's only
 * job is to reproduce it at the current playhead and practice rate. All positions are
 * FILE (content) milliseconds; the engine runs in wall-clock, so rate conversion
 * happens exactly once, in `clickEngineParamsAt`.
 *
 * Honesty gates mirror the reel ruler (gridRuler.ts): no grid or unknown downbeat →
 * no click, and the click never sounds past `gridValidToMs`. A practice rate that
 * pushes the scaled tempo outside the engine's 40–240 range makes the click
 * unavailable at that speed rather than quietly wrong (v1 — subdivision fallback is
 * a Phase E candidate).
 */

export type PlaybackClickGrid = Pick<
    RecordingGrid,
    "bpm" | "meterId" | "tempoMap" | "firstDownbeatMs" | "gridValidToMs" | "grouping"
>;

export type PlaybackClickEngineParams = {
    /** Wall-clock tempo for the engine: segment bpm × rate, rounded (int engine API). */
    bpm: number;
    meterId: RecordingGrid["meterId"];
    pulsesPerBar: number;
    denominator: number;
    accentPattern: number[];
    /** Wall-clock ms into the engine's bar loop at which to start (0 = downbeat). */
    phaseOffsetWallMs: number;
    /** Wall-clock ms of one engine bar at this rate (loop length). */
    barWallMs: number;
    /** Content-ms where the click must re-sync (next tempo segment), null when none. */
    nextBoundaryContentMs: number | null;
    /** Content-ms where the click must STOP (untrusted grid / gridValidToMs), null = never. */
    stopAtContentMs: number | null;
};

/** True when this grid can drive a playback click at all (rate-independent part). */
export function isPlaybackClickAvailable(grid: PlaybackClickGrid | null | undefined): boolean {
    return (
        !!grid &&
        grid.firstDownbeatMs != null &&
        Number.isFinite(grid.firstDownbeatMs) &&
        Number.isFinite(grid.bpm)
    );
}

/**
 * Engine parameters for a click starting at `positionMs` (content) with playback rate
 * `rate`. Returns null when unavailable: no trustworthy grid, position past
 * `gridValidToMs`, or the scaled tempo leaves the engine's range at this rate.
 */
export function clickEngineParamsAt(args: {
    grid: PlaybackClickGrid | null | undefined;
    positionMs: number;
    rate: number;
}): PlaybackClickEngineParams | null {
    const { grid, positionMs, rate } = args;
    if (!isPlaybackClickAvailable(grid) || !Number.isFinite(rate) || rate <= 0) {
        return null;
    }

    const offsetMs = Math.max(0, grid!.firstDownbeatMs as number);
    const stopAtContentMs =
        typeof grid!.gridValidToMs === "number" && Number.isFinite(grid!.gridValidToMs)
            ? grid!.gridValidToMs
            : null;
    if (stopAtContentMs != null && positionMs >= stopAtContentMs) {
        return null;
    }

    const map: TempoMap = gridTempoMap(grid!);
    const gridMs = positionMs - offsetMs;
    const point = beatAtMs(map, gridMs);
    const segment = segmentAtBar(map, Math.max(1, point.bar));

    const scaledBpm = Math.round(segment.bpm * rate);
    if (scaledBpm < MIN_METRONOME_BPM || scaledBpm > MAX_METRONOME_BPM) {
        return null;
    }

    const preset = getMetronomeMeterPreset(segment.meterId);
    const barWallMs = getMetronomeBeatIntervalMs(scaledBpm) * preset.pulsesPerBar;
    // The click reproduces the take's FEEL: its stored grouping drives the accents in
    // the segment that shares the take's meter; other segments use their meter's default.
    const accentPattern =
        segment.meterId === grid!.meterId
            ? getMetronomeAccentPattern(segment.meterId, grid!.grouping ?? null)
            : getMetronomeAccentPattern(segment.meterId);

    // Phase within the CURRENT bar, converted content → wall. Positions before the
    // downbeat (retained pre-roll) behave as "no phase yet": start clean at 0 so the
    // click enters on the one.
    const contentPhaseMs = gridMs < 0 ? 0 : positionMs - (point.barStartMs + offsetMs);
    const contentBarMs = point.pulseMs * point.pulsesPerBar;
    const phaseFraction = Math.min(0.999999, Math.max(0, contentPhaseMs / contentBarMs));
    const phaseOffsetWallMs = phaseFraction * barWallMs;

    // Where the click must break phase: the next tempo segment's first downbeat.
    const segmentIndex = map.segments.findIndex((candidate) => candidate.atBar === segment.atBar);
    const nextSegment = segmentIndex >= 0 ? map.segments[segmentIndex + 1] : undefined;
    let nextBoundaryContentMs: number | null = null;
    if (nextSegment) {
        // Sum bar lengths segment by segment up to the boundary (mirrors gridRuler).
        let boundaryGridMs = 0;
        for (let index = 0; index <= segmentIndex; index += 1) {
            const current = map.segments[index];
            const following = map.segments[index + 1];
            if (!following) break;
            const currentPreset = getMetronomeMeterPreset(current.meterId);
            boundaryGridMs +=
                getMetronomeBeatIntervalMs(current.bpm) *
                currentPreset.pulsesPerBar *
                (following.atBar - current.atBar);
        }
        nextBoundaryContentMs = offsetMs + boundaryGridMs;
        if (nextBoundaryContentMs <= positionMs) {
            nextBoundaryContentMs = null;
        }
    }

    return {
        bpm: scaledBpm,
        meterId: segment.meterId,
        pulsesPerBar: preset.pulsesPerBar,
        denominator: preset.denominator,
        accentPattern,
        phaseOffsetWallMs,
        barWallMs,
        nextBoundaryContentMs,
        stopAtContentMs,
    };
}

/** Wall-clock ms until a content position is reached from `positionMs` at `rate`. */
export function wallMsUntil(positionMs: number, targetContentMs: number, rate: number): number {
    if (!Number.isFinite(rate) || rate <= 0) {
        return Number.POSITIVE_INFINITY;
    }
    return Math.max(0, (targetContentMs - positionMs) / rate);
}

/** One segment in the native map-engine wire format. */
export type NativeMapSegmentShape = {
    atBar: number;
    bpm: number;
    meterId: string;
    pulsesPerBar: number;
    denominator: number;
    accentPattern: number[];
};

/**
 * The grid's full map in the native engines' wire format, optionally rate-scaled
 * (map engines run wall-clock 1:1, so practice speed scales every segment's tempo).
 * Returns null when any scaled segment leaves the engine's range — same refusal rule
 * as `clickEngineParamsAt`, applied map-wide. Accents follow the take's stored
 * grouping in segments sharing its meter; other segments use their meter's default.
 */
export function nativeTempoMapSegments(
    grid: PlaybackClickGrid,
    rate = 1
): NativeMapSegmentShape[] | null {
    if (!Number.isFinite(rate) || rate <= 0) {
        return null;
    }
    const map = gridTempoMap(grid);
    const segments: NativeMapSegmentShape[] = [];
    for (const segment of map.segments) {
        const scaledBpm = Math.round(segment.bpm * rate);
        if (scaledBpm < MIN_METRONOME_BPM || scaledBpm > MAX_METRONOME_BPM) {
            return null;
        }
        const preset = getMetronomeMeterPreset(segment.meterId);
        segments.push({
            atBar: segment.atBar,
            bpm: scaledBpm,
            meterId: segment.meterId,
            pulsesPerBar: preset.pulsesPerBar,
            denominator: preset.denominator,
            accentPattern:
                segment.meterId === grid.meterId
                    ? getMetronomeAccentPattern(segment.meterId, grid.grouping ?? null)
                    : getMetronomeAccentPattern(segment.meterId),
        });
    }
    return segments;
}
