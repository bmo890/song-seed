import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import { cleanupShareTempFile } from "./managedMedia";
import { shareFileUri } from "./audioStorage";
import {
    buildDisasterRecoveryBackup,
    type DrBackupManifest,
} from "./disasterRecoveryBackup";
import type { AppStore } from "../state/useStore";
import {
    BackupOperationCancelledError,
    reportBackupProgress,
    throwIfBackupCancelled,
    type BackupOperationOptions,
} from "./backupOperation";
import {
    copyLocalFileToContentUri,
    deleteContentUri,
    isSongseedFileIOAvailable,
} from "../../modules/songseed-file-io";

export const BACKUP_SAVE_CANCELLED_MESSAGE = "Backup save was cancelled.";

export type ManualExactBackupResult = {
    archiveTitle: string;
    status: DrBackupManifest["status"];
    manifest: DrBackupManifest;
    savedDirectoryUri?: string;
    /** False when the platform share sheet cannot report whether the user completed Save to Files. */
    saveConfirmed: boolean;
};

/**
 * Persist a prepared archive to a user-chosen location: a Storage Access Framework
 * folder on Android, or the system share sheet on iOS. Throws
 * `BACKUP_SAVE_CANCELLED_MESSAGE` if the user cancels the Android folder picker.
 */
async function saveArchiveToUserLocation(
    archiveUri: string,
    archiveTitle: string,
    options?: BackupOperationOptions
): Promise<{ savedUri: string; savedDirectoryUri?: string; saveConfirmed: boolean }> {
    throwIfBackupCancelled(options?.signal);
    if (Platform.OS === "android") {
        if (!isSongseedFileIOAvailable()) {
            throw new Error(
                "This Android build is missing Song Seed's streaming backup module. Rebuild the app before saving a backup."
            );
        }
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permissions.granted) {
            throw new Error(BACKUP_SAVE_CANCELLED_MESSAGE);
        }
        throwIfBackupCancelled(options?.signal);
        const targetUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            archiveTitle,
            "application/zip"
        );
        try {
            await copyLocalFileToContentUri(archiveUri, targetUri, {
                signal: options?.signal,
                onProgress: ({ completedBytes, totalBytes }) => {
                    reportBackupProgress(options, {
                        phase: "saving",
                        completedBytes,
                        totalBytes,
                        message: "Saving backup",
                    });
                },
            });
            return {
                savedUri: targetUri,
                savedDirectoryUri: permissions.directoryUri,
                saveConfirmed: true,
            };
        } catch (error) {
            await deleteContentUri(targetUri).catch(() => {});
            if (options?.signal?.aborted) {
                throw new BackupOperationCancelledError();
            }
            throw error;
        }
    }

    reportBackupProgress(options, {
        phase: "saving",
        completedBytes: 0,
        totalBytes: 0,
        message: "Choose where to save the backup",
    });
    await shareFileUri(archiveUri, archiveTitle, "application/zip");
    reportBackupProgress(options, {
        phase: "saving",
        completedBytes: 0,
        totalBytes: 0,
        message: "Backup saved",
    });
    return { savedUri: archiveUri, saveConfirmed: false };
}

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
