import * as FileSystem from "expo-file-system/legacy";
import { strFromU8, strToU8 } from "fflate";
import type { ClipVersion, Workspace, WorkspaceArchiveState } from "../types";
import {
    extractStoredZipEntryToFile,
    indexStoredZipArchive,
    readStoredZipEntryBytes,
    verifyStoredZipEntryReadable,
    type StoredZipIndex,
} from "./storedZipArchive";
import { normalizeWorkspaces } from "../state/dataSlice";
import { collectClipAudioUris } from "./managedMedia";
import {
    getArchiveFileExtension,
    sanitizeArchiveSegment,
} from "./audioStorage";
import { createZipArchive, type ZipArchiveEntry } from "./zipArchive";
import {
    SONG_NOOK_WORKSPACE_ARCHIVE_DIR,
    isSongNookManagedUri,
    rebaseManagedUri,
} from "./storagePaths";
import { rebaseWorkspacesManagedMedia } from "../state/rebaseManagedMedia";
import { ensureBackupDiskSpace } from "./backupOperation";

/** v1 packed only clip.audioUri/sourceAudioUri. v2 also packs overdub layer
 *  recordings (stem audio) and rendered mixes, and strips their URIs from the
 *  archived metadata. Restore is manifest-driven, so v1 packages restore
 *  unchanged under v2 code (their overdub media was never packed or deleted —
 *  the files are still loose on disk and still referenced). */
const WORKSPACE_ARCHIVE_SCHEMA_VERSION = 2;

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
    /** Streaming index into the archive; audio payloads are extracted on demand. */
    archiveIndex: StoredZipIndex;
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

function assertManagedRestoreUri(fileUri: string) {
    const path = fileUri.split("?")[0];
    const escapes =
        path.includes("\\") ||
        path.includes("\0") ||
        path.split("/").some((segment) => segment === "." || segment === "..");
    if (escapes || !isSongNookManagedUri(fileUri)) {
        throw new Error("Archive restore target is outside SongNook managed storage.");
    }
}

async function ensureWorkspaceArchiveDirectory() {
    if (!FileSystem.documentDirectory) {
        throw new Error("Document directory unavailable.");
    }

    const info = await FileSystem.getInfoAsync(SONG_NOOK_WORKSPACE_ARCHIVE_DIR);
    if (!info.exists) {
        await FileSystem.makeDirectoryAsync(SONG_NOOK_WORKSPACE_ARCHIVE_DIR, { intermediates: true });
    }
}

function buildWorkspaceArchiveUri(workspace: Workspace) {
    const safeTitle = sanitizeArchiveSegment(workspace.title || "Workspace");
    return `${SONG_NOOK_WORKSPACE_ARCHIVE_DIR}/${safeTitle}-${workspace.id}.songnook-workspace.zip`;
}

async function collectWorkspaceMediaFiles(workspace: Workspace) {
    const mediaFiles: ArchiveableMediaFile[] = [];
    const missingFileUris: string[] = [];
    const seenUris = new Set<string>();

    for (const idea of workspace.ideas) {
        for (const clip of idea.clips) {
            // Every file-backed URI the clip references — master + source take,
            // overdub layer recordings, and the rendered mix. Anything skipped
            // here would survive on disk unpacked, silently voiding the archive's
            // "complete copy" promise.
            for (const liveUri of collectClipAudioUris(clip)) {
                if (seenUris.has(liveUri) || liveUri.startsWith("blob:")) {
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

/** Removes every file-backed URI (all packed into the archive zip) plus derived
 *  waveform peaks from a clip. Non-file overdub metadata (titles, gains, offsets,
 *  colors, grids) stays — the full snapshot lives in the zip's workspace.json and
 *  replaces this on restore, so stripping here only affects the archived stub. */
function stripClipMedia(clip: ClipVersion): ClipVersion {
    return {
        ...clip,
        audioUri: undefined,
        sourceAudioUri: undefined,
        waveformPeaks: undefined,
        ...(clip.overdub
            ? {
                  overdub: {
                      ...clip.overdub,
                      renderedMixUri: undefined,
                      renderedMixWaveformPeaks: undefined,
                      stems: clip.overdub.stems.map((stem) => ({
                          ...stem,
                          audioUri: undefined,
                          waveformPeaks: undefined,
                      })),
                  },
              }
            : null),
    };
}

function stripWorkspaceMedia(workspace: Workspace, archiveState: WorkspaceArchiveState): Workspace {
    return {
        ...workspace,
        isArchived: true,
        archiveState,
        ideas: workspace.ideas.map((idea) => ({
            ...idea,
            clips: idea.clips.map(stripClipMedia),
        })),
    };
}

/**
 * The package's snapshot comes back, with the stub's name. Anything the stub holds that
 * the package lacks (an idea or a take that reached the workspace after it was packed,
 * by any path) stays: unarchive never drops what the person can see
 * (audit 2026-11-02, 10-M2). Its audio was never stripped, so it plays as it did.
 */
export function mergeRestoredWorkspace(currentWorkspace: Workspace, snapshotWorkspace: Workspace): Workspace {
    const packedIdeaIds = new Set(snapshotWorkspace.ideas.map((idea) => idea.id));
    const packedCollectionIds = new Set(snapshotWorkspace.collections.map((collection) => collection.id));
    const stubIdeasById = new Map(currentWorkspace.ideas.map((idea) => [idea.id, idea]));
    const ideas = snapshotWorkspace.ideas.map((idea) => {
        const stub = stubIdeasById.get(idea.id);
        if (!stub) return idea;
        const packedClipIds = new Set(idea.clips.map((clip) => clip.id));
        const laterClips = stub.clips.filter((clip) => !packedClipIds.has(clip.id));
        return laterClips.length > 0 ? { ...idea, clips: [...idea.clips, ...laterClips] } : idea;
    });
    const laterIdeas = currentWorkspace.ideas.filter((idea) => !packedIdeaIds.has(idea.id));
    const laterCollections = currentWorkspace.collections.filter(
        (collection) => !packedCollectionIds.has(collection.id)
    );
    return {
        ...snapshotWorkspace,
        collections: [...snapshotWorkspace.collections, ...laterCollections],
        ideas: [...laterIdeas, ...ideas],
        title: currentWorkspace.title,
        description: currentWorkspace.description,
        isArchived: false,
        archiveState: undefined,
    };
}

function normalizeRestoredWorkspace(workspace: Workspace): Workspace {
    const rebased = rebaseWorkspacesManagedMedia([workspace])[0] ?? workspace;
    return normalizeWorkspaces([rebased])[0] ?? rebased;
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

    // Streaming index: entries are verified from the ZIP directory (name + size here;
    // CRC checked in-stream when each file is extracted) without loading payloads —
    // reading the whole package into memory OOM'd Hermes on large workspaces.
    const archiveIndex = await indexStoredZipArchive(archiveUri);
    const manifestEntry = archiveIndex.entries.get("manifest.json");
    const workspaceEntry = archiveIndex.entries.get("workspace.json");

    if (!manifestEntry || !workspaceEntry) {
        throw new Error("Archive package is incomplete.");
    }

    const manifest = JSON.parse(
        strFromU8(await readStoredZipEntryBytes(archiveIndex, manifestEntry))
    ) as WorkspaceArchivePackageManifest;
    const workspaceSnapshot = JSON.parse(
        strFromU8(await readStoredZipEntryBytes(archiveIndex, workspaceEntry))
    ) as Workspace;

    if (manifest.workspaceId !== expectedWorkspaceId || workspaceSnapshot.id !== expectedWorkspaceId) {
        throw new Error("Archive package does not match this workspace.");
    }

    for (const audioFile of expectedAudioFiles ?? manifest.audioFiles) {
        const entry = archiveIndex.entries.get(audioFile.archivePath);
        if (!entry) {
            throw new Error(`Archive package is missing ${audioFile.archivePath}.`);
        }
        if (entry.sizeBytes !== audioFile.originalSizeBytes) {
            throw new Error(`Archive package failed verification for ${audioFile.archivePath}.`);
        }
    }

    return {
        archiveIndex,
        manifest,
        workspaceSnapshot,
        packageSizeBytes:
            typeof archiveInfo.size === "number" ? archiveInfo.size : archiveIndex.archiveSizeBytes,
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

    // Fail early with a friendly storage message instead of a raw native write error
    // partway through packaging (mirrors the disaster-recovery backup guard).
    await ensureBackupDiskSpace(originalAudioBytes, "archive");
    await createZipArchive(archiveUri, archiveEntries);
    // The live audio is trashed on the strength of this package, and after 14 days the
    // package is the only copy: read every entry back before anyone relies on it
    // (audit 2026-11-02, 03 #7). A package that fails is removed, nothing is stripped.
    try {
        const verification = await verifyArchiveFile(archiveUri, workspaceSnapshot.id, mediaFiles);
        for (const file of mediaFiles) {
            await verifyStoredZipEntryReadable(
                verification.archiveIndex,
                verification.archiveIndex.entries.get(file.archivePath)!
            );
        }
    } catch (error) {
        await FileSystem.deleteAsync(archiveUri, { idempotent: true }).catch(() => {});
        throw error;
    }
    const archiveInfo = await FileSystem.getInfoAsync(archiveUri);
    const packageSizeBytes =
        "size" in archiveInfo && typeof archiveInfo.size === "number" ? archiveInfo.size : 0;
    const originalMetadataBytes = estimateJsonBytes(workspaceSnapshot);

    // No disk-savings gate. Recordings are already compressed (m4a), so the stored
    // package is necessarily about as large as the audio it holds — a "must free disk
    // space" gate can never pass and blocked the feature entirely. Archiving's real
    // value is tucking the workspace away without deleting anything and trimming its
    // heavy metadata (waveform peaks, etc.) out of the ACTIVE persisted store, which
    // `savingsBytes` now reports. True disk savings belong to a future "offload the
    // package to Files/Drive" flow.
    const provisionalArchiveState: WorkspaceArchiveState = {
        schemaVersion: WORKSPACE_ARCHIVE_SCHEMA_VERSION,
        archivedAt: Date.now(),
        archiveUri,
        packageSizeBytes,
        originalAudioBytes,
        originalMetadataBytes,
        archivedMetadataBytes: 0,
        savingsBytes: 0,
        audioFileCount: mediaFiles.length,
        missingFileCount: missingFileUris.length,
    };
    // The archived stub embeds this state, so measure the stub once with provisional
    // numbers and finalize with the (few-bytes-different) real ones.
    const archivedMetadataBytes = estimateJsonBytes(
        stripWorkspaceMedia(workspaceSnapshot, provisionalArchiveState)
    );
    const archiveState: WorkspaceArchiveState = {
        ...provisionalArchiveState,
        archivedMetadataBytes,
        savingsBytes: Math.max(0, originalMetadataBytes - archivedMetadataBytes),
    };

    const warnings =
        missingFileUris.length > 0
            ? [
                  `${missingFileUris.length} audio file${missingFileUris.length === 1 ? " was" : "s were"} already missing before archive and could not be packed.`,
              ]
            : [];

    return {
        archivedWorkspace: stripWorkspaceMedia(workspaceSnapshot, archiveState),
        archiveState,
        originalAudioUris: mediaFiles.map((file) => file.liveUri),
        warnings,
    };
}

export async function restoreWorkspaceFromDevice(
    workspace: Workspace,
    /** Restore from a user-picked package (offloaded workspaces) instead of the local one. */
    overrideArchiveUri?: string
): Promise<WorkspaceRestoreResult> {
    if (!workspace.isArchived || !workspace.archiveState) {
        throw new Error("This workspace does not have an archive package to restore.");
    }

    // verifyArchiveFile checks the package's manifest + snapshot workspace id, so a
    // picked file that belongs to a different workspace is rejected before any write.
    const verification = await verifyArchiveFile(
        overrideArchiveUri ?? workspace.archiveState.archiveUri,
        workspace.id
    );
    // Files this restore created. Only these are rolled back on a failure: a file that
    // was already there belongs to someone (an idea copied into another workspace shares
    // its audio) and must never be truncated or deleted here (audit 2026-11-02, 03 #5).
    const writtenFiles: ArchiveableMediaFile[] = [];
    const restoredUris: string[] = [];

    try {
        for (const file of verification.manifest.audioFiles) {
            const entry = verification.archiveIndex.entries.get(file.archivePath);
            if (!entry) {
                throw new Error(`Archive package is missing ${file.archivePath}.`);
            }
            const targetUri = rebaseManagedUri(file.liveUri);
            assertManagedRestoreUri(targetUri);

            const existing = await FileSystem.getInfoAsync(targetUri);
            if (existing.exists && typeof existing.size === "number" && existing.size === file.originalSizeBytes) {
                // Still on disk (shared with a copy elsewhere): nothing to write.
                restoredUris.push(targetUri);
                continue;
            }

            // Extract beside the target, then move into place: the extractor truncates
            // its destination and deletes it on any error, which must never happen to a
            // file that is already there.
            const stagingUri = `${targetUri}.restoring`;
            try {
                // Streams in bounded chunks and verifies the entry's CRC in-flight.
                await extractStoredZipEntryToFile(verification.archiveIndex, entry, stagingUri);
                const restoredInfo = await FileSystem.getInfoAsync(stagingUri);
                if (!restoredInfo.exists) {
                    throw new Error(`Could not restore ${targetUri}.`);
                }
                if (typeof restoredInfo.size === "number" && restoredInfo.size !== file.originalSizeBytes) {
                    throw new Error(`Restored file size mismatch for ${targetUri}.`);
                }
                if (existing.exists) await FileSystem.deleteAsync(targetUri, { idempotent: true });
                await FileSystem.moveAsync({ from: stagingUri, to: targetUri });
            } finally {
                await FileSystem.deleteAsync(stagingUri, { idempotent: true }).catch(() => {});
            }
            if (!existing.exists) writtenFiles.push({ ...file, liveUri: targetUri });
            restoredUris.push(targetUri);
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
        restoredAudioUris: restoredUris,
        warnings,
    };
}
