import * as FileSystem from "expo-file-system/legacy";

/**
 * On-device crash capture (no telemetry).
 *
 * Songstead ships without a crash-reporting SDK to keep the "nothing leaves this
 * device" privacy story intact. Instead, fatal JS errors and ErrorBoundary catches
 * are appended to a local diagnostic log the user can share from Settings → About
 * when reporting a bug. Release builds strip console.log, so this file is the only
 * durable record of a field crash.
 */

const CRASH_LOG_DIRECTORY = `${FileSystem.documentDirectory}diagnostics/`;
const CRASH_LOG_FILE = `${CRASH_LOG_DIRECTORY}crash-log.json`;

/** Keep the newest N entries so the log cannot grow unbounded. */
const MAX_CRASH_ENTRIES = 20;

export type CrashLogEntry = {
    at: string;
    /** "fatal" = global handler; "boundary" = React ErrorBoundary catch. */
    kind: "fatal" | "boundary";
    message: string;
    stack?: string;
    componentStack?: string;
};

let writeQueue: Promise<unknown> = Promise.resolve();

async function readEntries(): Promise<CrashLogEntry[]> {
    try {
        const info = await FileSystem.getInfoAsync(CRASH_LOG_FILE);
        if (!info.exists) return [];
        const raw = await FileSystem.readAsStringAsync(CRASH_LOG_FILE);
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as CrashLogEntry[]) : [];
    } catch {
        // A corrupt log must never block crash recording — start fresh.
        return [];
    }
}

async function appendEntry(entry: CrashLogEntry): Promise<void> {
    const entries = await readEntries();
    entries.push(entry);
    const trimmed = entries.slice(-MAX_CRASH_ENTRIES);
    await FileSystem.makeDirectoryAsync(CRASH_LOG_DIRECTORY, { intermediates: true }).catch(() => {});
    await FileSystem.writeAsStringAsync(CRASH_LOG_FILE, JSON.stringify(trimmed, null, 2));
}

/** Record a crash. Serialized and swallow-safe: recording must never throw. */
export function recordCrash(
    kind: CrashLogEntry["kind"],
    error: unknown,
    componentStack?: string
): Promise<void> {
    const entry: CrashLogEntry = {
        at: new Date().toISOString(),
        kind,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        componentStack,
    };
    const run = writeQueue.then(() => appendEntry(entry)).catch(() => {});
    writeQueue = run;
    return run;
}

/** Whether any crash has been recorded on this device. */
export async function hasCrashLog(): Promise<boolean> {
    const info = await FileSystem.getInfoAsync(CRASH_LOG_FILE).catch(() => null);
    return !!info?.exists;
}

/** File URI of the diagnostic log for sharing; null when nothing recorded yet. */
export async function getCrashLogUri(): Promise<string | null> {
    return (await hasCrashLog()) ? CRASH_LOG_FILE : null;
}

export async function clearCrashLog(): Promise<void> {
    await FileSystem.deleteAsync(CRASH_LOG_FILE, { idempotent: true }).catch(() => {});
}

type ErrorUtilsLike = {
    getGlobalHandler?: () => ((error: unknown, isFatal?: boolean) => void) | undefined;
    setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
};

let globalHandlerInstalled = false;

/**
 * Chain onto RN's global JS exception handler so fatal errors are recorded
 * before the default handler (which surfaces the redbox in dev / crashes in
 * release). Install once at app start.
 */
export function installGlobalCrashHandler(): void {
    if (globalHandlerInstalled) return;
    const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
    if (!errorUtils?.setGlobalHandler) return;
    const previousHandler = errorUtils.getGlobalHandler?.();
    errorUtils.setGlobalHandler((error, isFatal) => {
        if (isFatal) {
            void recordCrash("fatal", error);
        }
        previousHandler?.(error, isFatal);
    });
    globalHandlerInstalled = true;
}
