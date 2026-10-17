import { Platform } from "react-native";
import { persistLog } from "./persistLog";

/**
 * One diagnostic-log line per record tap, Redo, Discard and recorder warm-up
 * (2026-10-17). The simulator measured ~110 ms from tap to recording where the
 * founder's phone took seconds; this names, on the phone itself, every awaited
 * step and how long the screen froze while it ran.
 *
 * `uiGap` is the longest gap between animation frames while the trace was open.
 * Frames are driven by the main thread, so a large gap means native work held
 * the screen (a frozen screen, not just a slow promise).
 */
type Trace = {
    startedAt: number;
    parts: string[];
    maxFrameGap: number;
    lastFrameAt: number;
    frame: number | null;
};

const open = new Map<string, Trace>();

function watchFrames(trace: Trace) {
    const tick = () => {
        const now = Date.now();
        trace.maxFrameGap = Math.max(trace.maxFrameGap, now - trace.lastFrameAt);
        trace.lastFrameAt = now;
        trace.frame = requestAnimationFrame(tick);
    };
    trace.frame = requestAnimationFrame(tick);
}

export function beginRecordTrace(kind: string, context?: string) {
    if (open.has(kind)) endRecordTrace(kind, "superseded");
    const now = Date.now();
    const trace: Trace = { startedAt: now, parts: context ? [context] : [], maxFrameGap: 0, lastFrameAt: now, frame: null };
    open.set(kind, trace);
    watchFrames(trace);
}

/** Adds a step to every open trace (timedStep calls this for each awaited hop). */
export function noteRecordTrace(part: string) {
    for (const trace of open.values()) trace.parts.push(part);
}

export function endRecordTrace(kind: string, outcome?: string) {
    const trace = open.get(kind);
    if (!trace) return;
    open.delete(kind);
    if (trace.frame != null) cancelAnimationFrame(trace.frame);
    const ms = Date.now() - trace.startedAt;
    const detail = [
        `${kind} ${Platform.OS}${outcome ? ` ${outcome}` : ""} uiGap ${trace.maxFrameGap}`,
        ...trace.parts,
    ].join(" · ");
    persistLog("record.trace", { ms, detail });
    if (__DEV__) console.log(`[trace] ${ms}ms ${detail}`);
}
