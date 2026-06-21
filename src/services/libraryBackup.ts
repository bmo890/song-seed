import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import { cleanupShareTempFile } from "./managedMedia";
import { shareFileUri } from "./audioStorage";
import {
    buildDisasterRecoveryBackup,
    type DrBackupManifest,
} from "./disasterRecoveryBackup";
import type { AppStore } from "../state/useStore";

export const BACKUP_SAVE_CANCELLED_MESSAGE = "Backup save was cancelled.";

export type ManualExactBackupResult = {
    archiveTitle: string;
    status: DrBackupManifest["status"];
    manifest: DrBackupManifest;
    savedDirectoryUri?: string;
};

/**
 * Persist a prepared archive to a user-chosen location: a Storage Access Framework
 * folder on Android, or the system share sheet on iOS. Throws
 * `BACKUP_SAVE_CANCELLED_MESSAGE` if the user cancels the Android folder picker.
 */
async function saveArchiveToUserLocation(
    archiveUri: string,
    archiveTitle: string
): Promise<{ savedUri: string; savedDirectoryUri?: string }> {
    if (Platform.OS === "android") {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permissions.granted) {
            throw new Error(BACKUP_SAVE_CANCELLED_MESSAGE);
        }
        const targetUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            archiveTitle,
            "application/zip"
        );
        const zipBase64 = await FileSystem.readAsStringAsync(archiveUri, {
            encoding: FileSystem.EncodingType.Base64,
        });
        await FileSystem.StorageAccessFramework.writeAsStringAsync(targetUri, zipBase64, {
            encoding: FileSystem.EncodingType.Base64,
        });
        return { savedUri: targetUri, savedDirectoryUri: permissions.directoryUri };
    }

    await shareFileUri(archiveUri, archiveTitle, "application/zip");
    return { savedUri: archiveUri };
}

/**
 * The primary backup: an EXACT, checksummed disaster-recovery archive that can fully
 * reconstruct the library on a fresh install. Distinct from the human-readable library
 * export (Export Library flow / `libraryExport.ts`), which is for sharing songs with others.
 */
export async function runExactLibraryBackup(state: AppStore): Promise<ManualExactBackupResult> {
    const result = await buildDisasterRecoveryBackup(state);
    try {
        const saved = await saveArchiveToUserLocation(result.archiveUri, result.archiveTitle);
        return {
            archiveTitle: result.archiveTitle,
            status: result.manifest.status,
            manifest: result.manifest,
            savedDirectoryUri: saved.savedDirectoryUri,
        };
    } finally {
        await cleanupShareTempFile(result.archiveUri);
    }
}
