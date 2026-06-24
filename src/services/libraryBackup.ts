import { cleanupShareTempFile } from "./managedMedia";
import {
    buildDisasterRecoveryBackup,
    type DrBackupManifest,
} from "./disasterRecoveryBackup";
import type { AppStore } from "../state/useStore";
import {
    throwIfBackupCancelled,
    type BackupOperationOptions,
} from "./backupOperation";
import { saveArchiveToUserLocation } from "./archiveSave";

// Re-exported for existing importers (e.g. useLibraryBackupFlow); the save logic now lives in
// archiveSave.ts so the human-readable export can reuse the same crash-safe save path.
export { BACKUP_SAVE_CANCELLED_MESSAGE } from "./archiveSave";

export type ManualExactBackupResult = {
    archiveTitle: string;
    status: DrBackupManifest["status"];
    manifest: DrBackupManifest;
    savedDirectoryUri?: string;
    /** False when the platform share sheet cannot report whether the user completed Save to Files. */
    saveConfirmed: boolean;
};

/**
 * The primary backup: an EXACT, checksummed disaster-recovery archive that can fully
 * reconstruct the library on a fresh install. Distinct from the human-readable library
 * export (Export Library flow / `libraryExport.ts`), which is for sharing songs with others.
 */
export async function runExactLibraryBackup(
    state: AppStore,
    options?: BackupOperationOptions
): Promise<ManualExactBackupResult> {
    const result = await buildDisasterRecoveryBackup(state, options);
    try {
        throwIfBackupCancelled(options?.signal);
        const saved = await saveArchiveToUserLocation(
            result.archiveUri,
            result.archiveTitle,
            options
        );
        return {
            archiveTitle: result.archiveTitle,
            status: result.manifest.status,
            manifest: result.manifest,
            savedDirectoryUri: saved.savedDirectoryUri,
            saveConfirmed: saved.saveConfirmed,
        };
    } finally {
        await cleanupShareTempFile(result.archiveUri);
    }
}
