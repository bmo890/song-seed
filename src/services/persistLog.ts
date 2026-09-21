import * as FileSystem from "expo-file-system/legacy";
import { AppState } from "react-native";

/**
 * On-device persistence journal (no telemetry — nothing leaves the phone).
 *
 * 2026-09-07 field report: a take, its title, and its sketch were lost after the app
 * was swiped away, and nothing on the device could say why — release builds strip
 * console.*, and crashLog.ts only records JS crashes. Every hydration and every
 * library write outcome now lands here (bounded ring, cheap, swallow-safe), and the
 * user can share it from Settings → About alongside the crash log.
 *
 * Deliberately file-based and independent of SQLite: this is the record that must
 * survive the store misbehaving.
 */

const DIAGNOSTICS_DIRECTORY = `${FileSystem.documentDirectory ?? ""}diagnostics/`;
const PERSIST_LOG_FILE = `${DIAGNOSTICS_DIRECTORY}persist-log.json`;

/** Keep the newest N entries so the log cannot grow unbounded (~40 KB). */
const MAX_ENTRIES = 400;
/** Ordinary entries flush on a short trailing timer; alarming ones flush at once. */
const FLUSH_DELAY_MS = 2_000;

export type PersistLogEvent =
    // Boot
    | "boot"
    | "hydrate.ok"
    | "hydrate.empty"
    | "hydrate.failed"
    | "hydrate.degraded"
    | "hydrate.replayed"
    | "hydrate.overlay"
    // Store writes
    | "write.sqlite"
    | "write.fallback"
    | "write.failed"
    | "write.timeout"
    | "write.blocked"
    | "write.skipped"
    | "flush.ok"
    | "flush.failed"
    | "fallback.replayed"
    // Gates
    | "guard.locked"
    | "guard.unlocked"
    | "authority.refused"
    // Shadow manifest
    | "manifest.ok"
    | "manifest.blocked"
    | "manifest.failed"
    | "manifest.newer"
    // Recording
    | "recording.attached"
    | "recording.flushFailed"
    | "recording.recovered"
    | "step.slow";

export type PersistLogEntry = {
    at: string;
    event: PersistLogEvent;
    /** Wall time of the operation, when measured. */
    ms?: number;
    /** Free-form, short. Error messages are truncated. */
    detail?: string;
};

const ALARM_EVENTS = new Set<PersistLogEvent>([
    // The boot line lands before anything else can go wrong.
    "boot",
    "hydrate.failed",
    "hydrate.degraded",
    "write.fallback",
    "write.failed",
    "write.timeout",
    "write.blocked",
    "flush.failed",
    "guard.locked",
    "authority.refused",
    "manifest.failed",
    "manifest.newer",
    "recording.flushFailed",
]);

let entries: PersistLogEntry[] | null = null;
// The on-disk history is read exactly once per session. Entries recorded before that
// read completes (the boot line, the hydrate outcome) are kept and appended after it —
// an early `entries` array must never short-circuit the read, or every boot would
// start the journal over.
let historyLoaded = false;
let loadPromise: Promise<PersistLogEntry[]> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let writeChain: Promise<unknown> = Promise.resolve();
let dirty = false;

async function loadEntries(): Promise<PersistLogEntry[]> {
    if (historyLoaded) return entries ?? (entries = []);
    if (!loadPromise) {
        loadPromise = (async () => {
            try {
                const info = await FileSystem.getInfoAsync(PERSIST_LOG_FILE);
                if (!info.exists) return [];
                const raw = await FileSystem.readAsStringAsync(PERSIST_LOG_FILE);
                const parsed = JSON.parse(raw);
                return Array.isArray(parsed) ? (parsed as PersistLogEntry[]) : [];
            } catch {
                // A corrupt log must never block logging — start fresh.
                return [];
            }
        })().then((loaded) => {
            // Entries recorded while the file was loading were appended to `entries`
            // by `persistLog` below; keep them after the loaded history.
            entries = [...loaded, ...(entries ?? [])].slice(-MAX_ENTRIES);
            historyLoaded = true;
            return entries;
        });
    }
    return loadPromise;
}

async function writeEntries(): Promise<void> {
    const current = await loadEntries();
    if (!dirty) return;
    dirty = false;
    try {
        await FileSystem.makeDirectoryAsync(DIAGNOSTICS_DIRECTORY, { intermediates: true }).catch(() => {});
        await FileSystem.writeAsStringAsync(PERSIST_LOG_FILE, JSON.stringify(current));
    } catch {
        // Diagnostics are best-effort; never let them take the app down.
    }
}

function scheduleFlush(immediate: boolean) {
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
    if (immediate) {
        void flushPersistLog();
        return;
    }
    flushTimer = setTimeout(() => {
        flushTimer = null;
        void flushPersistLog();
    }, FLUSH_DELAY_MS);
    // Node timers (tests) must not keep the process alive; RN timers are plain numbers.
    (flushTimer as unknown as { unref?: () => void }).unref?.();
}

/** Record one persistence event. Synchronous and swallow-safe. */
export function persistLog(event: PersistLogEvent, detail?: string | { ms?: number; detail?: string }): void {
    try {
        const entry: PersistLogEntry = { at: new Date().toISOString(), event };
        if (typeof detail === "string") {
            entry.detail = detail.slice(0, 200);
        } else if (detail) {
            if (detail.ms != null) entry.ms = Math.round(detail.ms);
            if (detail.detail) entry.detail = detail.detail.slice(0, 200);
        }
        if (!entries) entries = [];
        entries.push(entry);
        if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
        dirty = true;
        scheduleFlush(ALARM_EVENTS.has(event));
    } catch {
        // ignore
    }
}

/** Shorten an unknown error for the log. */
export function describeError(error: unknown): string {
    if (error instanceof Error) return `${error.name}: ${error.message}`;
    return String(error);
}

/** Write pending entries to disk now (app leaving the foreground, before a share). */
export function flushPersistLog(): Promise<void> {
    const run = writeChain.then(writeEntries, writeEntries).catch(() => undefined);
    writeChain = run;
    return run;
}

/** Everything recorded so far, oldest first. */
export async function readPersistLogEntries(): Promise<PersistLogEntry[]> {
    return [...(await loadEntries())];
}

export function getPersistLogPath(): string {
    return PERSIST_LOG_FILE;
}

// Don't sit on a coalesced log write while the app leaves the foreground — the entry
// written just before a swipe-away is the one that matters.
AppState.addEventListener("change", (nextState) => {
    if (nextState !== "active") void flushPersistLog();
});
