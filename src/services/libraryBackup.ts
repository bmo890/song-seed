import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import {
    prepareLibraryExportArchive,
    type LibraryExportResult,
    type SongSeedArchiveLibraryPreferences,
} from "./libraryExport";
import { cleanupShareTempFile } from "./managedMedia";
import { shareFileUri } from "./audioStorage";
import {
    buildDisasterRecoveryBackup,
    type DrBackupManifest,
} from "./disasterRecoveryBackup";
import type { AppStore } from "../state/useStore";
import type { Note, Workspace } from "../types";

export const BACKUP_SAVE_CANCELLED_MESSAGE = "Backup save was cancelled.";

export type ManualLibraryBackupResult = LibraryExportResult & {
    savedDirectoryUri?: string;
};

export type ManualExactBackupResult = {
    archiveTitle: string;
    status: DrBackupManifest["status"];
    manifest: DrBackupManifest;
    savedDirectoryUri?: string;
};

function countTotalEntries(workspaces: Workspace[], notes: Note[]) {
    return workspaces.reduce((sum, workspace) => sum + workspace.ideas.length, 0) + notes.length;
}

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
 * reconstruct the library on a fresh install. Distinct from the human-readable
 * `runManualLibraryBackup` export below, which exists for sharing songs with others.
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

export async function runManualLibraryBackup(
    workspaces: Workspace[],
    notes: Note[],
    libraryPreferences?: SongSeedArchiveLibraryPreferences
): Promise<ManualLibraryBackupResult> {
    if (countTotalEntries(workspaces, notes) === 0) {
        throw new Error("There is no library data to back up yet.");
    }

    const prepared = await prepareLibraryExportArchive({
        workspaces,
        notes,
        format: "song-seed-archive",
        archiveLabel: "Song Seed Backup",
        libraryPreferences,
        scope: {
            workspaceIds: workspaces.map((workspace) => workspace.id),
            collectionIds: [],
            excludedCollectionIds: [],
        },
        options: {
            includeFullSongHistory: true,
            includeNotes: true,
            includeLyrics: true,
            includeHiddenItems: true,
        },
    });

    try {
        const saved = await saveArchiveToUserLocation(prepared.archiveUri, prepared.archiveTitle);
        return {
            ...prepared,
            archiveUri: saved.savedUri,
            savedDirectoryUri: saved.savedDirectoryUri,
        };
    } finally {
        await cleanupShareTempFile(prepared.archiveUri);
    }
}
