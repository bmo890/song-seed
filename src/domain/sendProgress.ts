/**
 * Progress of one SongNook Send seal (2026-10-14): pack the parcel, upload
 * it, seal it. Pure arithmetic for the pill and the sheet; the store owns the
 * state, the services report into it.
 */

export type SendPhase = "packing" | "uploading" | "sealing";

export type SendProgress = {
    phase: SendPhase;
    /** Bytes done within the phase (packing: media packed; uploading: sent). */
    completedBytes: number;
    totalBytes: number;
    /** While packing: the take being encoded, 1-based, and how many there are.
     *  The bar only moves per take, so this is what tells the sender it is
     *  alive during a long song (founder, 2026-10-14: "sitting at 7%"). */
    encoding?: { index: number; count: number };
};

export type SendProgressOptions = {
    signal?: AbortSignal;
    onProgress?: (progress: SendProgress) => void;
};

/** Share of the whole seal that packing takes when the parcel needs packing.
 *  Since links encode WAV takes to AAC (2026-10-14), packing is the slow half
 *  on a phone: nine songs took minutes to encode and seconds to upload. */
export const PACKING_SHARE = 0.6;

function within(progress: SendProgress): number {
    if (progress.totalBytes <= 0) return 0;
    return Math.min(1, Math.max(0, progress.completedBytes / progress.totalBytes));
}

/**
 * 0–1 across the whole seal. Raw-file parcels (clips) have no packing step,
 * so their upload is the whole bar. Sealing (the finalize call) is the last
 * sliver; it reads as "almost done", never as 100 until the link exists.
 */
export function sendOverallFraction(progress: SendProgress, hasPacking: boolean): number {
    const packShare = hasPacking ? PACKING_SHARE : 0;
    if (progress.phase === "packing") return packShare * within(progress);
    if (progress.phase === "uploading") return packShare + (1 - packShare) * within(progress);
    return 0.98;
}

/**
 * Seconds left, from the upload's own rate. Packing is local and quick, and
 * sealing is one request, so neither earns an estimate: null means "no
 * number", not "zero".
 */
export function sendEtaSeconds(
    progress: SendProgress,
    uploadStartedAt: number | null,
    now: number
): number | null {
    if (progress.phase !== "uploading" || uploadStartedAt == null) return null;
    const elapsed = (now - uploadStartedAt) / 1000;
    if (elapsed < 1 || progress.completedBytes <= 0 || progress.totalBytes <= 0) return null;
    const rate = progress.completedBytes / elapsed;
    const remaining = Math.max(0, progress.totalBytes - progress.completedBytes);
    return Math.round(remaining / rate);
}

/** "~45s" / "~3 min" for a supporting line. */
export function formatEta(seconds: number): string {
    return seconds >= 60 ? `~${Math.ceil(seconds / 60)} min` : `~${Math.max(1, seconds)}s`;
}
