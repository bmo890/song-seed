import { cleanupShareTempFile } from "./managedMedia";
import {
    buildDisasterRecoveryBackup,
    type DrBackupManifest,
} from "./disasterRecoveryBackup";
import type { AppStore } from "../state/useStore";
import {
    isBackupOperationCancelled,
    type BackupOperationOptions,
} from "./backupOperation";
import { BACKUP_SAVE_CANCELLED_MESSAGE, saveArchiveToUserLocation } from "./archiveSave";

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

/** A built-but-not-yet-saved backup archive. The caller MUST later save it or discard it. */
export type BuiltExactBackup = {
    archiveUri: string;
    archiveTitle: string;
    status: DrBackupManifest["status"];
    manifest: DrBackupManifest;
};

export type SavedExactBackup = {
    savedDirectoryUri?: string;
    saveConfirmed: boolean;
};

/**
 * The primary backup: an EXACT, checksummed disaster-recovery archive that can fully
 * reconstruct the library on a fresh install. Distinct from the human-readable library
 * export (Export Library flow / `libraryExport.ts`), which is for sharing songs with others.
 *
 * Building (the expensive hash + package passes) is deliberately split from saving so a
 * back-out of the location picker can retry the save without rebuilding. Callers that don't
 * need retry can use `runExactLibraryBackup`.
 */
export async function buildExactLibraryBackup(
    state: AppStore,
    options?: BackupOperationOptions
): Promise<BuiltExactBackup> {
    const result = await buildDisasterRecoveryBackup(state, options);
    return {
        archiveUri: result.archiveUri,
        archiveTitle: result.archiveTitle,
        status: result.manifest.status,
        manifest: result.manifest,
    };
}

/**
 * Save a built archive to a user-chosen location. On success — or on any hard failure — the
 * temporary archive is cleaned up. On a picker back-out (`BACKUP_SAVE_CANCELLED_MESSAGE`) or an
 * explicit cancel, the temp archive is KEPT and the error is rethrown, so the caller can retry
 * the save without repeating the expensive build.
 */
export async function saveBuiltLibraryBackup(
    built: BuiltExactBackup,
    options?: BackupOperationOptions
): Promise<SavedExactBackup> {
    try {
        const saved = await saveArchiveToUserLocation(built.archiveUri, built.archiveTitle, options);
        await cleanupShareTempFile(built.archiveUri);
        return { savedDirectoryUri: saved.savedDirectoryUri, saveConfirmed: saved.saveConfirmed };
    } catch (error) {
        const backedOut =
            isBackupOperationCancelled(error) ||
            (error instanceof Error && error.message === BACKUP_SAVE_CANCELLED_MESSAGE);
        if (!backedOut) {
            await cleanupShareTempFile(built.archiveUri);
        }
        throw error;
    }
}

/** Delete a built-but-unsaved archive (the user chose to discard it). */
export async function discardBuiltLibraryBackup(archiveUri: string) {
    await cleanupShareTempFile(archiveUri);
}
