import { strFromU8 } from "fflate";
import { indexStoredZipArchive, readStoredZipEntryBytes } from "./storedZipArchive";

/**
 * Song Seed writes two unrelated ZIP files that both end in `.zip`:
 *  - "song-seed-archive": the human-readable Export Library / Import Song Seed Archive format
 *    (merge-friendly, remapped IDs, optional full-fidelity metadata).
 *  - "song-seed-backup":  the exact, checksummed disaster-recovery Back Up / Restore format
 *    (snapshot.json + per-file SHA-256 + media/, replaces the whole library on restore).
 *
 * They are NOT interchangeable, and feeding one into the other flow used to fail with a
 * confusing "not a valid …" message. Detecting which one the user picked lets each flow
 * redirect them to the correct menu instead. Platform-agnostic: works the same on iOS and
 * Android (both go through the document picker + this reader).
 */
export type PickedArchiveKind = "song-seed-archive" | "song-seed-backup" | "unknown";

const MANIFEST_ENTRY = "manifest.json";
const DR_SNAPSHOT_ENTRY = "snapshot.json";

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object";
}

/**
 * Inspect a picked ZIP and classify it WITHOUT loading the whole file into memory — a backup
 * can be gigabytes. Reads only the central directory and the small `manifest.json` entry via
 * the streaming indexer. Never throws: an unreadable, empty, or foreign file is reported as
 * "unknown" and the caller decides how to message it.
 */
export async function detectPickedArchiveKind(fileUri: string): Promise<PickedArchiveKind> {
    try {
        const index = await indexStoredZipArchive(fileUri);
        const manifestEntry = index.entries.get(MANIFEST_ENTRY);
        if (!manifestEntry) {
            return "unknown";
        }

        let manifest: unknown;
        try {
            manifest = JSON.parse(strFromU8(await readStoredZipEntryBytes(index, manifestEntry)));
        } catch {
            return "unknown";
        }

        if (isRecord(manifest)) {
            if (manifest.format === "song-seed-archive" && Array.isArray(manifest.workspaces)) {
                return "song-seed-archive";
            }
            // Disaster-recovery backup: formatVersion + snapshot checksum + file list, paired
            // with the snapshot.json entry. See disasterRecoveryBackup.ts (DrBackupManifest).
            if (
                typeof manifest.formatVersion === "number" &&
                typeof manifest.snapshotSha256 === "string" &&
                Array.isArray(manifest.files) &&
                index.entries.has(DR_SNAPSHOT_ENTRY)
            ) {
                return "song-seed-backup";
            }
        }
        return "unknown";
    } catch {
        return "unknown";
    }
}
