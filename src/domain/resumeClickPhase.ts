/**
 * Where the click has to come back in when a paused take resumes.
 *
 * A take's beat grid is anchored once, at its downbeat, in CAPTURE ms — milliseconds of audio
 * recorded. Pausing does not advance capture ms (no audio is being captured), but it does
 * advance the wall clock. So the two come apart across a pause, and a click that restarts
 * from pulse 0 on resume lands at an arbitrary phase against the grid the first half of the
 * take was played to: up to a full bar out, different every time. That is the "off beat after
 * restarting" — and it is worse than cosmetic, because the grid model has one downbeat and no
 * way to express a phase change partway through. Either the click continues the grid, or the
 * take's second half is off it.
 *
 * So compute where the grid says we are at the capture position the click will re-enter at,
 * and start it there. Pure, because the only way to be sure about a thing like this is a test.
 */

import { beatAtMs } from "./tempoMap";
import type { TempoMap } from "./tempoMap";

export type ResumeClickPhase = {
    /** What to hand `startAtPhase`. */
    offsetMs: number;
    /** `bar` = ms into the current bar (single tempo). `grid` = ms from grid zero, which is
     *  what the native engine wants while a tempo map is installed. */
    unit: "bar" | "grid";
};

export function resolveResumeClickPhase(args: {
    /** Capture position the click will re-enter at, in ms. */
    captureMs: number;
    /** The take's downbeat, in capture ms. */
    firstBeatCaptureMs: number;
    beatMs: number;
    pulsesPerBar: number;
    /** Present when the take is running a programmed tempo map (native map mode). */
    tempoMap?: TempoMap | null;
    /**
     * How long before capture resumes the click is started. On a monitored (Bluetooth) route
     * the click is deliberately started early so what the performer hears lines up with what
     * the mic takes; the phase has to be rolled back by the same amount or the compensation
     * would put the click off the grid by exactly the compensation.
     */
    startsEarlyByMs?: number;
}): ResumeClickPhase | null {
    const { captureMs, firstBeatCaptureMs, beatMs, pulsesPerBar } = args;
    if (!Number.isFinite(captureMs) || !Number.isFinite(firstBeatCaptureMs)) return null;
    if (!(beatMs > 0) || !(pulsesPerBar > 0)) return null;

    const startsEarlyByMs = Math.max(0, args.startsEarlyByMs ?? 0);
    const elapsedMs = captureMs - startsEarlyByMs - firstBeatCaptureMs;
    // Paused before the take musically started: there is no grid behind us to continue, so a
    // fresh downbeat is the right answer and the caller should start normally.
    if (elapsedMs < 0) return null;

    const map = args.tempoMap;
    if (map && map.segments.length > 1) {
        // Map mode: the engine positions along the whole grid, not within a bar, so hand it
        // the elapsed grid time directly. The map itself carries the meter changes.
        return { offsetMs: elapsedMs, unit: "grid" };
    }

    // Single tempo: ms into the current bar.
    const barMs = beatMs * pulsesPerBar;
    const intoBar = ((elapsedMs % barMs) + barMs) % barMs;
    return { offsetMs: intoBar, unit: "bar" };
}

/**
 * Which beat of which bar a capture position falls on — for the "resumed at bar 5 beat 2"
 * logging that makes a misalignment complaint answerable instead of a guess.
 */
export function describeGridPosition(args: {
    captureMs: number;
    firstBeatCaptureMs: number;
    beatMs: number;
    pulsesPerBar: number;
    tempoMap?: TempoMap | null;
}): { bar: number; beat: number } | null {
    const { captureMs, firstBeatCaptureMs, beatMs, pulsesPerBar } = args;
    if (!(beatMs > 0) || !(pulsesPerBar > 0)) return null;
    const elapsedMs = captureMs - firstBeatCaptureMs;
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return null;

    const map = args.tempoMap;
    if (map && map.segments.length > 1) {
        const point = beatAtMs(map, elapsedMs);
        return { bar: point.bar, beat: point.beatInBar };
    }
    const pulses = Math.floor(elapsedMs / beatMs);
    return {
        bar: Math.floor(pulses / pulsesPerBar) + 1,
        beat: (pulses % pulsesPerBar) + 1,
    };
}
