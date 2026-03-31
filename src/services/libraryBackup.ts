import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import {
    prepareLibraryExportArchive,
    type LibraryExportResult,
    type SongSeedArchiveLibraryPreferences,
} from "./libraryExport";
import { cleanupShareTempFile } from "./managedMedia";
import { shareFileUri } from "./audioStorage";
import type { Workspace } from "../types";

export const BACKUP_SAVE_CANCELLED_MESSAGE = "Backup save was cancelled.";

export type ManualLibraryBackupResult = LibraryExportResult & {
    savedDirectoryUri?: string;
};

function countTotalIdeas(workspaces: Workspace[]) {
    return workspaces.reduce((sum, workspace) => sum + workspace.ideas.length, 0);
}

export async function runManualLibraryBackup(
    workspaces: Workspace[],
    libraryPreferences?: SongSeedArchiveLibraryPreferences
): Promise<ManualLibraryBackupResult> {
    if (countTotalIdeas(workspaces) === 0) {
        throw new Error("There is no library data to back up yet.");
    }

    const prepared = await prepareLibraryExportArchive({
        workspaces,
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
        if (Platform.OS === "android") {
            const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

            if (!permissions.granted) {
                throw new Error(BACKUP_SAVE_CANCELLED_MESSAGE);
            }

            const targetUri = await FileSystem.StorageAccessFramework.createFileAsync(
                permissions.directoryUri,
                prepared.archiveTitle,
                "application/zip"
            );

            const zipBase64 = await FileSystem.readAsStringAsync(prepared.archiveUri, {
                encoding: FileSystem.EncodingType.Base64,
            });
            await FileSystem.StorageAccessFramework.writeAsStringAsync(targetUri, zipBase64, {
                encoding: FileSystem.EncodingType.Base64,
            });

            return {
                ...prepared,
                archiveUri: targetUri,
                savedDirectoryUri: permissions.directoryUri,
            };
        }

        await shareFileUri(prepared.archiveUri, prepared.archiveTitle, "application/zip");
        return prepared;
    } finally {
        await cleanupShareTempFile(prepared.archiveUri);
    }
}
