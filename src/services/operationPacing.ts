/**
 * Pre-run duration estimates for long library operations (backup / export / restore).
 *
 * Conservative defaults are refined by in-session measurements: each completed operation
 * records its end-to-end throughput, and later estimates blend toward the measured rate.
 * Estimates are deliberately rough — they feed "about 2 minutes" copy, not progress math
 * (live progress/ETA comes from the process store's actual byte counts).
 */

export type LibraryOperationKind = "backup" | "export" | "restore";

const DEFAULT_BYTES_PER_SECOND: Record<LibraryOperationKind, number> = {
    // Backup reads every byte twice (hash pass + packaging pass).
    backup: 12 * 1024 * 1024,
    export: 24 * 1024 * 1024,
    restore: 12 * 1024 * 1024,
};

/** Picker sheets, directory scans, snapshot serialization, zip bookkeeping. */
const FIXED_OVERHEAD_SECONDS = 4;
const MIN_MEANINGFUL_BYTES = 4 * 1024 * 1024;
const MIN_MEANINGFUL_MS = 1000;

const measuredBytesPerSecond: Partial<Record<LibraryOperationKind, number>> = {};

export function recordLibraryOperationThroughput(
    kind: LibraryOperationKind,
    totalBytes: number,
    elapsedMs: number
) {
    if (totalBytes < MIN_MEANINGFUL_BYTES || elapsedMs < MIN_MEANINGFUL_MS) return;
    const bytesPerSecond = totalBytes / (elapsedMs / 1000);
    if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return;
    const previous = measuredBytesPerSecond[kind];
    measuredBytesPerSecond[kind] = previous
        ? previous * 0.4 + bytesPerSecond * 0.6
        : bytesPerSecond;
}

export function estimateLibraryOperationSeconds(
    kind: LibraryOperationKind,
    totalBytes: number
) {
    const bytesPerSecond = measuredBytesPerSecond[kind] ?? DEFAULT_BYTES_PER_SECOND[kind];
    return FIXED_OVERHEAD_SECONDS + Math.max(0, totalBytes) / bytesPerSecond;
}

/** "under a minute" / "about a minute" / "about N minutes" */
export function formatDurationEstimate(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 50) return "under a minute";
    const minutes = Math.round(seconds / 60);
    if (minutes <= 1) return "about a minute";
    return `about ${minutes} minutes`;
}
