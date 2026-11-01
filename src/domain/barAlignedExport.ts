/**
 * Exports that start on a bar line (founder, 2026-10-30), for a DAW. Opt-in since
 * 2026-11-01: "Export for DAW" beside Share audio, which sends the take as recorded.
 *
 * A take recorded to the click knows where its first downbeat is, so inside SongNook
 * it sits on the grid. A file handed to a DAW knows nothing: the DAW puts its first
 * sample on a bar line. A take without a count-in starts wherever record was pressed,
 * part-way through a bar, and lands off the DAW's grid at the same tempo.
 *
 * The exported copy is moved onto a bar line; the take in the library never changes:
 *  - nothing played before the first bar line → that lead-in is cut, and the file
 *    starts on beat 1, like a count-in take;
 *  - anything played there (a pickup) → nothing is cut; silence goes in front so the
 *    file starts at the bar line before it. In the DAW the pickup plays in bar 1 and
 *    the downbeat lands on bar 2.
 * When unsure the lead-in is empty, pad: padding never loses a note.
 */
import type { RecordingGrid } from "../types";
import { getMetronomeBeatIntervalMs, getMetronomeMeterPreset } from "./metronome";

/** A lead-in this short already starts on the bar line, to well under a sample block. */
const ON_THE_BAR_MS = 1;
/** Louder than this, outside the clicks, and the lead-in holds playing. */
export const QUIET_LEAD_IN_DBFS = -40;
/** A recorded click, measured from its onset: a little early for jitter, then its ring. */
const CLICK_GUARD_BEFORE_MS = 10;
const CLICK_RING_MS = 150;

export type BarLeadIn = {
    /** ms from file t=0 to the first bar line in the file. */
    leadMs: number;
    barMs: number;
    beatMs: number;
    /** One tempo and meter throughout, so every later bar is `barMs` long too. */
    steady: boolean;
};

/** Where the first bar line falls in a take recorded to the click, or null for a take
 *  that wasn't (a memo, a detected or hand-set tempo) or doesn't know its downbeat. */
export function barLeadIn(grid: RecordingGrid | null | undefined): BarLeadIn | null {
    if (!grid || grid.source !== "metronome") return null;
    const downbeatMs = grid.firstDownbeatMs;
    if (downbeatMs == null || !Number.isFinite(downbeatMs) || downbeatMs < 0) return null;
    // Before the first downbeat the grid runs at the first segment's tempo.
    const first = grid.tempoMap?.segments[0] ?? { bpm: grid.bpm, meterId: grid.meterId };
    const beatMs = getMetronomeBeatIntervalMs(first.bpm);
    const barMs = beatMs * getMetronomeMeterPreset(first.meterId).pulsesPerBar;
    if (!(barMs > 0)) return null;
    const leadMs = downbeatMs % barMs;
    if (grid.gridValidToMs != null && grid.gridValidToMs <= leadMs) return null;
    const steady = (grid.tempoMap?.segments.length ?? 1) <= 1;
    return { leadMs, barMs, beatMs, steady };
}

/**
 * Is the lead-in empty of playing? `levels` holds each frame's loudest channel as
 * |sample| in 0..1, from t=0 to the first bar line. The clicks the mic picked up
 * before the bar line (a running preview) are skipped: they sit on the grid's own
 * beats, counted back from the bar line.
 */
export function isLeadInQuiet(levels: ArrayLike<number>, sampleRate: number, lead: BarLeadIn): boolean {
    const threshold = 10 ** (QUIET_LEAD_IN_DBFS / 20);
    const framesPerMs = sampleRate / 1000;
    const end = Math.min(levels.length, Math.floor((lead.leadMs - CLICK_GUARD_BEFORE_MS) * framesPerMs));
    const clicks: number[] = [];
    for (let clickMs = lead.leadMs - lead.beatMs; clickMs > -CLICK_RING_MS; clickMs -= lead.beatMs) {
        clicks.push(clickMs);
    }
    for (let frame = 0; frame < end; frame += 1) {
        if (levels[frame] < threshold) continue;
        const ms = frame / framesPerMs;
        const inClick = clicks.some((clickMs) => ms >= clickMs - CLICK_GUARD_BEFORE_MS && ms < clickMs + CLICK_RING_MS);
        if (!inClick) return false;
    }
    return true;
}

export type BarAlignPlan =
    | { kind: "asIs" }
    /** Drop this many frames from the head. */
    | { kind: "cut"; frames: number }
    /** Put this many frames of silence in front. */
    | { kind: "pad"; frames: number };

export function planBarAlignedExport(args: { lead: BarLeadIn; sampleRate: number; quiet: boolean }): BarAlignPlan {
    const { lead, sampleRate, quiet } = args;
    if (lead.leadMs < ON_THE_BAR_MS) return { kind: "asIs" };
    const leadFrames = Math.round((lead.leadMs * sampleRate) / 1000);
    if (leadFrames <= 0) return { kind: "asIs" };
    if (quiet) return { kind: "cut", frames: leadFrames };
    const barFrames = Math.round((lead.barMs * sampleRate) / 1000);
    return { kind: "pad", frames: Math.max(0, barFrames - leadFrames) };
}

/** Each frame's loudest channel as |sample| in 0..1, from raw little-endian PCM. */
export function frameLevels(
    bytes: Uint8Array,
    format: { channels: number; bitsPerSample: number; sampleFormat: "int" | "float" }
): Float32Array {
    const bytesPerSample = format.bitsPerSample / 8;
    const blockAlign = bytesPerSample * format.channels;
    const frames = Math.floor(bytes.length / blockAlign);
    const view = new DataView(bytes.buffer, bytes.byteOffset, frames * blockAlign);
    const levels = new Float32Array(frames);
    for (let frame = 0; frame < frames; frame += 1) {
        let loudest = 0;
        for (let channel = 0; channel < format.channels; channel += 1) {
            const at = frame * blockAlign + channel * bytesPerSample;
            let value: number;
            if (format.sampleFormat === "float") {
                value = view.getFloat32(at, true);
            } else if (format.bitsPerSample === 16) {
                value = view.getInt16(at, true) / 32768;
            } else if (format.bitsPerSample === 24) {
                const raw = view.getUint8(at) | (view.getUint8(at + 1) << 8) | (view.getInt8(at + 2) << 16);
                value = raw / 8388608;
            } else {
                value = view.getInt32(at, true) / 2147483648;
            }
            loudest = Math.max(loudest, Math.abs(value));
        }
        levels[frame] = loudest;
    }
    return levels;
}

/**
 * Silence that carries a file whose first frame sits on a bar line to the end of its
 * last bar, so the region ends on the grid too. Bar lines rarely fall on whole frames
 * (97 bpm at 48 kHz: 118 762.9 frames a bar), so each is placed by rounding its own
 * time, never by adding a rounded bar. A take that changes tempo isn't padded.
 */
export function barTailFrames(args: { frames: number; sampleRate: number; lead: BarLeadIn }): number {
    const { frames, sampleRate, lead } = args;
    if (!lead.steady || frames <= 0) return 0;
    const exactBarFrames = (lead.barMs * sampleRate) / 1000;
    if (!(exactBarFrames > 0)) return 0;
    let bars = Math.floor(frames / exactBarFrames);
    while (Math.round(bars * exactBarFrames) < frames) bars += 1;
    return Math.round(bars * exactBarFrames) - frames;
}

/** "Idea 3 · 100 bpm", with the meter when it isn't 4/4 ("· 6-8"): the tempo a DAW
 *  project needs, readable in Finder. Before its first downbeat a take runs at its first
 *  tempo, so that is the one named. */
export function dawExportBaseName(title: string, grid: RecordingGrid): string {
    const first = grid.tempoMap?.segments[0] ?? { bpm: grid.bpm, meterId: grid.meterId };
    const bpm = Math.round(first.bpm * 100) / 100;
    const meter = first.meterId === "4/4" ? "" : ` · ${first.meterId.replace("/", "-")}`;
    return `${title} · ${bpm} bpm${meter}`;
}
