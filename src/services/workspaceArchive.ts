import * as FileSystem from "expo-file-system/legacy";
import { strFromU8, strToU8, unzipSync } from "fflate";
import type { Workspace, WorkspaceArchiveState } from "../types";
import { normalizeWorkspaces } from "../state/dataSlice";
import {
    createZipArchive,
    getArchiveFileExtension,
    sanitizeArchiveSegment,
    type ZipArchiveEntry,
} from "./audioStorage";
import { SONG_SEED_WORKSPACE_ARCHIVE_DIR, isSongSeedManagedUri } from "./storagePaths";

const WORKSPACE_ARCHIVE_SCHEMA_VERSION = 1;

type ArchiveableMediaFile = {
    archivePath: string;
    liveUri: string;
    originalSizeBytes: number;
};

type WorkspaceArchivePackageManifest = {
    schemaVersion: number;
    workspaceId: string;
    workspaceTitle: string;
    archivedAt: string;
    audioFiles: ArchiveableMediaFile[];
    missingFileUris: string[];
};

type ArchiveVerificationResult = {
    zipEntries: Record<string, Uint8Array>;
    manifest: WorkspaceArchivePackageManifest;
    workspaceSnapshot: Workspace;
    packageSizeBytes: number;
};

export type WorkspaceArchiveResult = {
    archivedWorkspace: Workspace;
    archiveState: WorkspaceArchiveState;
    originalAudioUris: string[];
    warnings: string[];
};

export type WorkspaceRestoreResult = {
    restoredWorkspace: Workspace;
    restoredAudioUris: string[];
    warnings: string[];
};

function cloneWorkspace(workspace: Workspace): Workspace {
    return JSON.parse(JSON.stringify(workspace)) as Workspace;
}

function estimateJsonBytes(value: unknown) {
    return strToU8(JSON.stringify(value)).length;
}

function base64ToBytes(base64: string) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const clean = base64.replace(/[^A-Za-z0-9+/=]/g, "");
    let buffer = 0;
    let bits = 0;
    const output: number[] = [];

    for (const char of clean) {
        if (char === "=") break;
        const index = alphabet.indexOf(char);
        if (index < 0) continue;
        buffer = (buffer << 6) | index;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            output.push((buffer >> bits) & 0xff);
        }
    }

    return Uint8Array.from(output);
}

function bytesToBase64(bytes: Uint8Array) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let output = "";

    for (let index = 0; index < bytes.length; index += 3) {
        const a = bytes[index] ?? 0;
        const b = bytes[index + 1] ?? 0;
        const c = bytes[index + 2] ?? 0;
        const chunk = (a << 16) | (b << 8) | c;

        output += alphabet[(chunk >> 18) & 0x3f];
        output += alphabet[(chunk >> 12) & 0x3f];
        output += index + 1 < bytes.length ? alphabet[(chunk >> 6) & 0x3f] : "=";
        output += index + 2 < bytes.length ? alphabet[chunk & 0x3f] : "=";
    }

    return output;
}

async function readFileBytes(fileUri: string) {
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
    });
    return base64ToBytes(base64);
}

async function writeFileBytes(fileUri: string, bytes: Uint8Array) {
    const parentDirectory = fileUri.slice(0, fileUri.lastIndexOf("/"));
    if (parentDirectory) {
        await FileSystem.makeDirectoryAsync(parentDirectory, { intermediates: true });
    }
    await FileSystem.writeAsStringAsync(fileUri, bytesToBase64(bytes), {
        encoding: FileSystem.EncodingType.Base64,
    });
}

function assertManagedRestoreUri(fileUri: string) {
    if (!isSongSeedManagedUri(fileUri)) {
        throw new Error("Archive restore target is outside Song Seed managed storage.");
    }
}

async function ensureWorkspaceArchiveDirectory() {
    if (!FileSystem.documentDirectory) {
        throw new Error("Document directory unavailable.");
    }

    const info = await FileSystem.getInfoAsync(SONG_SEED_WORKSPACE_ARCHIVE_DIR);
    if (!info.exists) {
        await FileSystem.makeDirectoryAsync(SONG_SEED_WORKSPACE_ARCHIVE_DIR, { intermediates: true });
    }
}

function buildWorkspaceArchiveUri(workspace: Workspace) {
    const safeTitle = sanitizeArchiveSegment(workspace.title || "Workspace");
    return `${SONG_SEED_WORKSPACE_ARCHIVE_DIR}/${safeTitle}-${workspace.id}.songseed-workspace.zip`;
}

async function collectWorkspaceMediaFiles(workspace: Workspace) {
    const mediaFiles: ArchiveableMediaFile[] = [];
    const missingFileUris: string[] = [];
    const seenUris = new Set<string>();

    for (const idea of workspace.ideas) {
        for (const clip of idea.clips) {
            for (const liveUri of [clip.audioUri, clip.sourceAudioUri]) {
                if (!liveUri || seenUris.has(liveUri) || liveUri.startsWith("blob:")) {
                    continue;
                }

                seenUris.add(liveUri);
                const info = await FileSystem.getInfoAsync(liveUri);
                if (!info.exists) {
                    missingFileUris.push(liveUri);
                    continue;
                }

                const extension = getArchiveFileExtension(liveUri);
                const originalName = sanitizeArchiveSegment(
                    (liveUri.split("/").pop() ?? "Audio").replace(/\.[^./\\]+$/, "")
                );
                const archivePath = `audio/${String(mediaFiles.length + 1).padStart(4, "0")}-${originalName}.${extension}`;
                mediaFiles.push({
                    archivePath,
                    liveUri,
                    originalSizeBytes: typeof info.size === "number" ? info.size : 0,
                });
            }
        }
    }

    const originalAudioBytes = mediaFiles.reduce((sum, file) => sum + file.originalSizeBytes, 0);
    return {
        mediaFiles,
        missingFileUris,
        originalAudioBytes,
    };
}

function stripWorkspaceMedia(workspace: Workspace, archiveState: WorkspaceArchiveState): Workspace {
    return {
        ...workspace,
        isArchived: true,
        archiveState,
        ideas: workspace.ideas.map((idea) => ({
            ...idea,
            clips: idea.clips.map((clip) => ({
                ...clip,
                audioUri: undefined,
                sourceAudioUri: undefined,
                waveformPeaks: undefined,
            })),
        })),
    };
}

function mergeRestoredWorkspace(currentWorkspace: Workspace, snapshotWorkspace: Workspace): Workspace {
    return {
        ...snapshotWorkspace,
        title: currentWorkspace.title,
        description: currentWorkspace.description,
        isArchived: false,
        archiveState: undefined,
    };
}

function normalizeRestoredWorkspace(workspace: Workspace): Workspace {
    return normalizeWorkspaces([workspace])[0] ?? workspace;
}

async function verifyArchiveFile(
    archiveUri: string,
    expectedWorkspaceId: string,
    expectedAudioFiles?: ArchiveableMediaFile[]
): Promise<ArchiveVerificationResult> {
    const archiveInfo = await FileSystem.getInfoAsync(archiveUri);
    if (!archiveInfo.exists) {
        throw new Error("Archive package is missing.");
    }

    const zipBytes = await readFileBytes(archiveUri);
    const zipEntries = unzipSync(zipBytes);
    const manifestEntry = zipEntries["manifest.json"];
    const workspaceEntry = zipEntries["workspace.json"];

    if (!manifestEntry || !workspaceEntry) {
        throw new Error("Archive package is incomplete.");
    }

    const manifest = JSON.parse(strFromU8(manifestEntry)) as WorkspaceArchivePackageManifest;
    const workspaceSnapshot = JSON.parse(strFromU8(workspaceEntry)) as Workspace;

    if (manifest.workspaceId !== expectedWorkspaceId || workspaceSnapshot.id !== expectedWorkspaceId) {
        throw new Error("Archive package does not match this workspace.");
    }

    for (const audioFile of expectedAudioFiles ?? manifest.audioFiles) {
        const entry = zipEntries[audioFile.archivePath];
        if (!entry) {
            throw new Error(`Archive package is missing ${audioFile.archivePath}.`);
        }
        if (entry.length !== audioFile.originalSizeBytes) {
            throw new Error(`Archive package failed verification for ${audioFile.archivePath}.`);
        }
    }

    return {
        zipEntries,
        manifest,
        workspaceSnapshot,
        packageSizeBytes: typeof archiveInfo.size === "number" ? archiveInfo.size : zipBytes.length,
    };
}

export async function archiveWorkspaceToDevice(workspace: Workspace): Promise<WorkspaceArchiveResult> {
    if (workspace.isArchived) {
        throw new Error("This workspace is already archived.");
    }

    await ensureWorkspaceArchiveDirectory();

    const workspaceSnapshot = cloneWorkspace(workspace);
    const archiveUri = buildWorkspaceArchiveUri(workspace);
    const { mediaFiles, missingFileUris, originalAudioBytes } = await collectWorkspaceMediaFiles(workspaceSnapshot);
    const manifest: WorkspaceArchivePackageManifest = {
        schemaVersion: WORKSPACE_ARCHIVE_SCHEMA_VERSION,
        workspaceId: workspaceSnapshot.id,
        workspaceTitle: workspaceSnapshot.title,
        archivedAt: new Date().toISOString(),
        audioFiles: mediaFiles,
        missingFileUris,
    };

    const archiveEntries: ZipArchiveEntry[] = [
        { archiveName: "manifest.json", data: JSON.stringify(manifest) },
        { archiveName: "workspace.json", data: JSON.stringify(workspaceSnapshot) },
        ...mediaFiles.map((file) => ({
            archiveName: file.archivePath,
            fileUri: file.liveUri,
        })),
    ];

    await createZipArchive(archiveUri, archiveEntries);
    const archiveInfo = await FileSystem.getInfoAsync(archiveUri);
    const packageSizeBytes =
        "size" in archiveInfo && typeof archiveInfo.size === "number" ? archiveInfo.size : 0;
    const provisionalArchiveState: WorkspaceArchiveState = {
        schemaVersion: WORKSPACE_ARCHIVE_SCHEMA_VERSION,
        archivedAt: Date.now(),
        archiveUri,
        packageSizeBytes,
        originalAudioBytes,
        originalMetadataBytes: estimateJsonBytes(workspaceSnapshot),
        archivedMetadataBytes: 0,
        savingsBytes: 0,
        audioFileCount: mediaFiles.length,
        missingFileCount: missingFileUris.length,
    };
    const archivedWorkspacePreview = stripWorkspaceMedia(workspaceSnapshot, provisionalArchiveState);
    const archivedMetadataBytes = estimateJsonBytes(archivedWorkspacePreview);
    const savingsBytes =
        originalAudioBytes +
        provisionalArchiveState.originalMetadataBytes -
        (provisionalArchiveState.packageSizeBytes + archivedMetadataBytes);

    if (savingsBytes <= 0) {
        await FileSystem.deleteAsync(archiveUri, { idempotent: true });
        throw new Error("Archiving would not reduce storage for this workspace.");
    }

    const archiveState: WorkspaceArchiveState = {
        ...provisionalArchiveState,
        archivedMetadataBytes,
        savingsBytes,
    };
    const archivedWorkspace = stripWorkspaceMedia(workspaceSnapshot, archiveState);
    const exactArchivedMetadataBytes = estimateJsonBytes(archivedWorkspace);
    const exactSavingsBytes =
        originalAudioBytes +
        provisionalArchiveState.originalMetadataBytes -
        (provisionalArchiveState.packageSizeBytes + exactArchivedMetadataBytes);

    if (exactSavingsBytes <= 0) {
        await FileSystem.deleteAsync(archiveUri, { idempotent: true });
        throw new Error("Archiving would not reduce storage for this workspace.");
    }

    let finalizedArchiveState: WorkspaceArchiveState = {
        ...archiveState,
        archivedMetadataBytes: exactArchivedMetadataBytes,
        savingsBytes: exactSavingsBytes,
    };
    const finalizedArchivedWorkspace = stripWorkspaceMedia(workspaceSnapshot, finalizedArchiveState);
    const finalArchivedMetadataBytes = estimateJsonBytes(finalizedArchivedWorkspace);
    const finalSavingsBytes =
        originalAudioBytes +
        provisionalArchiveState.originalMetadataBytes -
        (provisionalArchiveState.packageSizeBytes + finalArchivedMetadataBytes);

    if (finalSavingsBytes <= 0) {
        await FileSystem.deleteAsync(archiveUri, { idempotent: true });
        throw new Error("Archiving would not reduce storage for this workspace.");
    }

    finalizedArchiveState = {
        ...finalizedArchiveState,
        archivedMetadataBytes: finalArchivedMetadataBytes,
        savingsBytes: finalSavingsBytes,
    };

    const warnings =
        missingFileUris.length > 0
            ? [
                  `${missingFileUris.length} audio file${missingFileUris.length === 1 ? " was" : "s were"} already missing before archive and could not be packed.`,
              ]
            : [];

    return {
        archivedWorkspace: stripWorkspaceMedia(workspaceSnapshot, finalizedArchiveState),
        archiveState: finalizedArchiveState,
        originalAudioUris: mediaFiles.map((file) => file.liveUri),
        warnings,
    };
}

export async function restoreWorkspaceFromDevice(workspace: Workspace): Promise<WorkspaceRestoreResult> {
    if (!workspace.isArchived || !workspace.archiveState) {
        throw new Error("This workspace does not have a compressed archive package to restore.");
    }

    const verification = await verifyArchiveFile(workspace.archiveState.archiveUri, workspace.id);
    const writtenFiles: ArchiveableMediaFile[] = [];

    try {
        for (const file of verification.manifest.audioFiles) {
            const entryBytes = verification.zipEntries[file.archivePath];
            if (!entryBytes) {
                throw new Error(`Archive package is missing ${file.archivePath}.`);
            }
            assertManagedRestoreUri(file.liveUri);

            await writeFileBytes(file.liveUri, entryBytes);
            const restoredInfo = await FileSystem.getInfoAsync(file.liveUri);
            if (!restoredInfo.exists) {
                throw new Error(`Could not restore ${file.liveUri}.`);
            }
            if (typeof restoredInfo.size === "number" && restoredInfo.size !== file.originalSizeBytes) {
                throw new Error(`Restored file size mismatch for ${file.liveUri}.`);
            }
            writtenFiles.push(file);
        }
    } catch (error) {
        await Promise.all(
            writtenFiles.map(async (file) => {
                try {
                    await FileSystem.deleteAsync(file.liveUri, { idempotent: true });
                } catch {
                    // Ignore rollback cleanup noise here; the user-facing error explains the restore failed.
                }
            })
        );
        throw new Error(
            error instanceof Error ? error.message : "Could not restore the archived workspace audio."
        );
    }

    const warnings =
        verification.manifest.missingFileUris.length > 0
            ? [
                  `${verification.manifest.missingFileUris.length} audio file${verification.manifest.missingFileUris.length === 1 ? " was" : "s were"} already missing when this workspace was archived and remain unavailable after restore.`,
              ]
            : [];

    return {
        restoredWorkspace: normalizeRestoredWorkspace(
            mergeRestoredWorkspace(workspace, verification.workspaceSnapshot)
        ),
        restoredAudioUris: verification.manifest.audioFiles.map((file) => file.liveUri),
        warnings,
    };
}
