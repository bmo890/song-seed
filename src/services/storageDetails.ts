import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import type { PersistedAppStore } from "../state/useStore";
import { STORE_NAME, STORE_VERSION } from "../state/useStore";
import type { Workspace } from "../types";
import {
    SONG_SEED_AUDIO_DIR,
    SONG_SEED_ROOT,
    SONG_SEED_SHARE_DIR,
    SONG_SEED_WORKSPACE_ARCHIVE_DIR,
    isManagedAudioUri,
} from "./storagePaths";

type DirectoryUsage = {
    bytes: number;
    fileCount: number;
};

type AudioReferenceSummary = {
    totalReferences: number;
    totalMeasuredBytes: number;
    missingCount: number;
};

export type StorageDetailsReport = {
    generatedAt: number;
    storageLabel: string;
    totalLibraryBytes: number;
    totalManagedBytes: number;
    activeWorkspaceCount: number;
    archivedWorkspaceCount: number;
    activeLibraryBytes: number;
    archivedLibraryBytes: number;
    supportingDataBytes: number;
    metadataBytes: number;
    activeWorkspaceMetadataBytes: number;
    archivedWorkspaceMetadataBytes: number;
    managedAudio: DirectoryUsage;
    archivePackages: DirectoryUsage;
    temporaryExports: DirectoryUsage;
    unmanagedAudioReferences: AudioReferenceSummary;
    limitations: string[];
    advanced: {
        appStorageRootUri: string;
        audioDirectoryUri: string;
        archiveDirectoryUri: string;
        shareDirectoryUri: string;
    };
};

function measureUtf8Bytes(value: string) {
    return new TextEncoder().encode(value).length;
}

function measureJsonBytes(value: unknown) {
    return measureUtf8Bytes(JSON.stringify(value));
}

async function getDirectoryUsage(directoryUri: string): Promise<DirectoryUsage> {
    if (!directoryUri) {
        return { bytes: 0, fileCount: 0 };
    }

    try {
        const info = await FileSystem.getInfoAsync(directoryUri);
        if (!info.exists) {
            return { bytes: 0, fileCount: 0 };
        }
    } catch {
        return { bytes: 0, fileCount: 0 };
    }

    let bytes = 0;
    let fileCount = 0;
    const childNames = await FileSystem.readDirectoryAsync(directoryUri);

    for (const childName of childNames) {
        const childUri = `${directoryUri}/${childName}`;
        const info = await FileSystem.getInfoAsync(childUri);
        if (!info.exists) {
            continue;
        }

        if (info.isDirectory) {
            const childUsage = await getDirectoryUsage(childUri);
            bytes += childUsage.bytes;
            fileCount += childUsage.fileCount;
            continue;
        }

        bytes += typeof info.size === "number" ? info.size : 0;
        fileCount += 1;
    }

    return { bytes, fileCount };
}

async function getPersistedMetadataBytes(snapshot: PersistedAppStore) {
    try {
        const rawPersistedStore = await AsyncStorage.getItem(STORE_NAME);
        if (typeof rawPersistedStore === "string") {
            return measureUtf8Bytes(rawPersistedStore);
        }
    } catch {
        // Fall back to a local measurement if storage cannot be read directly.
    }

    return measureJsonBytes({
        state: snapshot,
        version: STORE_VERSION,
    });
}

async function measureUnmanagedAudioReferences(workspaces: Workspace[]): Promise<AudioReferenceSummary> {
    const seenUris = new Set<string>();
    let totalMeasuredBytes = 0;
    let totalReferences = 0;
    let missingCount = 0;

    for (const workspace of workspaces) {
        for (const idea of workspace.ideas) {
            for (const clip of idea.clips) {
                for (const uri of [clip.audioUri, clip.sourceAudioUri]) {
                    if (!uri || seenUris.has(uri) || uri.startsWith("blob:") || isManagedAudioUri(uri)) {
                        continue;
                    }

                    seenUris.add(uri);
                    totalReferences += 1;

                    try {
                        const info = await FileSystem.getInfoAsync(uri);
                        if (!info.exists) {
                            missingCount += 1;
                            continue;
                        }

                        totalMeasuredBytes += typeof info.size === "number" ? info.size : 0;
                    } catch {
                        missingCount += 1;
                    }
                }
            }
        }
    }

    return {
        totalReferences,
        totalMeasuredBytes,
        missingCount,
    };
}

export async function getStorageDetailsReport(snapshot: PersistedAppStore): Promise<StorageDetailsReport> {
    const activeWorkspaces = snapshot.workspaces.filter((workspace) => !workspace.isArchived);
    const archivedWorkspaces = snapshot.workspaces.filter((workspace) => workspace.isArchived);
    const [
        managedAudio,
        archivePackages,
        temporaryExports,
        metadataBytes,
        unmanagedAudioReferences,
    ] = await Promise.all([
        getDirectoryUsage(SONG_SEED_AUDIO_DIR),
        getDirectoryUsage(SONG_SEED_WORKSPACE_ARCHIVE_DIR),
        getDirectoryUsage(SONG_SEED_SHARE_DIR),
        getPersistedMetadataBytes(snapshot),
        measureUnmanagedAudioReferences(activeWorkspaces),
    ]);

    const activeWorkspaceMetadataBytes = activeWorkspaces.reduce(
        (sum, workspace) => sum + measureJsonBytes(workspace),
        0
    );
    const archivedWorkspaceMetadataBytes = archivedWorkspaces.reduce(
        (sum, workspace) => sum + measureJsonBytes(workspace),
        0
    );
    const supportingDataBytes = Math.max(
        0,
        metadataBytes - activeWorkspaceMetadataBytes - archivedWorkspaceMetadataBytes
    );
    const activeLibraryBytes = managedAudio.bytes + activeWorkspaceMetadataBytes;
    const archivedLibraryBytes = archivePackages.bytes + archivedWorkspaceMetadataBytes;
    const totalLibraryBytes = metadataBytes + managedAudio.bytes + archivePackages.bytes;
    const totalManagedBytes = totalLibraryBytes + temporaryExports.bytes;
    const limitations: string[] = [];

    if (unmanagedAudioReferences.totalReferences > 0) {
        limitations.push(
            `${unmanagedAudioReferences.totalReferences} audio reference${unmanagedAudioReferences.totalReferences === 1 ? " points" : "s point"} outside Song Seed's managed live-library storage and ${unmanagedAudioReferences.totalReferences === 1 ? "is" : "are"} excluded from the total library storage figure.`
        );
    }

    if (unmanagedAudioReferences.missingCount > 0) {
        limitations.push(
            `${unmanagedAudioReferences.missingCount} external audio reference${unmanagedAudioReferences.missingCount === 1 ? " could" : "s could"} not be measured because the file is unavailable or inaccessible.`
        );
    }

    if (supportingDataBytes > 0) {
        limitations.push(
            "Workspace metadata is separated from shared library state where possible. Supporting data such as activity history and preferences is included under library data."
        );
    }

    return {
        generatedAt: Date.now(),
        storageLabel: "Stored locally in Song Seed app storage on this device.",
        totalLibraryBytes,
        totalManagedBytes,
        activeWorkspaceCount: activeWorkspaces.length,
        archivedWorkspaceCount: archivedWorkspaces.length,
        activeLibraryBytes,
        archivedLibraryBytes,
        supportingDataBytes,
        metadataBytes,
        activeWorkspaceMetadataBytes,
        archivedWorkspaceMetadataBytes,
        managedAudio,
        archivePackages,
        temporaryExports,
        unmanagedAudioReferences,
        limitations,
        advanced: {
            appStorageRootUri: SONG_SEED_ROOT,
            audioDirectoryUri: SONG_SEED_AUDIO_DIR,
            archiveDirectoryUri: SONG_SEED_WORKSPACE_ARCHIVE_DIR,
            shareDirectoryUri: SONG_SEED_SHARE_DIR,
        },
    };
}
