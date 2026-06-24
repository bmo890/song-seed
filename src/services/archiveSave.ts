import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import { shareFileUri } from "./audioStorage";
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

export type SavedArchiveLocation = {
    savedUri: string;
    savedDirectoryUri?: string;
    /** False when the platform share sheet cannot report whether the user completed the save. */
    saveConfirmed: boolean;
};

/**
 * Persist a prepared archive to a user-chosen location: a Storage Access Framework folder on
 * Android, or the system share sheet on iOS. Throws `BACKUP_SAVE_CANCELLED_MESSAGE` if the
 * user cancels the Android folder picker.
 *
 * On Android the file is streamed into the chosen folder by us and the copy is awaited, so the
 * caller can safely delete the temporary source afterward. (Sharing via an Intent instead would
 * hand the temp file to another app that copies it asynchronously, racing the cleanup delete —
 * that race is exactly why both backup and export save through this helper.) On iOS the system
 * share sheet performs the copy synchronously before it resolves.
 */
export async function saveArchiveToUserLocation(
    archiveUri: string,
    archiveTitle: string,
    options?: BackupOperationOptions
): Promise<SavedArchiveLocation> {
    throwIfBackupCancelled(options?.signal);
    if (Platform.OS === "android") {
        if (!isSongseedFileIOAvailable()) {
            throw new Error(
                "This Android build is missing Song Seed's streaming file module. Rebuild the app before saving."
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
                        message: "Saving",
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
        message: "Choose where to save",
    });
    await shareFileUri(archiveUri, archiveTitle, "application/zip");
    reportBackupProgress(options, {
        phase: "saving",
        completedBytes: 0,
        totalBytes: 0,
        message: "Saved",
    });
    return { savedUri: archiveUri, saveConfirmed: false };
}
