import * as FileSystem from "expo-file-system/legacy";
import type { ClipVersion, SongIdea, Workspace } from "../types";
import {
    isManagedPreviewAudioUri,
    SONG_NOOK_SHARE_DIR,
    SONG_NOOK_TRASH_DIR,
    isManagedAudioUri,
    isSongNookManagedUri,
    resolveManagedUri,
    toRelativeManagedPath,
    waveformSidecarUri,
} from "./storagePaths";

export const SHARE_TEMP_FILE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const MAX_IN_MEMORY_ARCHIVE_BYTES = 150 * 1024 * 1024;
/** How long quarantined (deleted) audio is retained before it is permanently purged. */
export const TRASH_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

/** Every file-backed audio URI a clip references — master take, pre-edit source,
 *  rendered overdub mix, and each overdub layer recording — unfiltered (managed or
 *  not). Archive packing, media deletion, and storage accounting must all agree on
 *  this list; extend it here when a new file-backed clip field is added. */
export function collectClipAudioUris(clip: ClipVersion): string[] {
    const uris: string[] = [];
    if (clip.audioUri) uris.push(clip.audioUri);
    if (clip.sourceAudioUri) uris.push(clip.sourceAudioUri);
    if (clip.overdub?.renderedMixUri) uris.push(clip.overdub.renderedMixUri);
    for (const stem of clip.overdub?.stems ?? []) {
        if (stem.audioUri) uris.push(stem.audioUri);
    }
    return uris;
}

function collectManagedClipUris(clip: ClipVersion, target: Set<string>) {
    for (const uri of collectClipAudioUris(clip)) {
        const path = toRelativeManagedPath(uri);
        if (path) target.add(resolveManagedUri(path));
    }
}

export function collectManagedIdeaAudioUris(idea: SongIdea) {
    const uris = new Set<string>();
    idea.clips.forEach((clip) => collectManagedClipUris(clip, uris));
    return uris;
}

export function collectManagedWorkspaceAudioUris(workspace: Workspace) {
    const uris = new Set<string>();
    workspace.ideas.forEach((idea) => {
        collectManagedIdeaAudioUris(idea).forEach((uri) => uris.add(uri));
    });
    return uris;
}

export function collectManagedAudioUrisFromWorkspaces(workspaces: Workspace[]) {
    const uris = new Set<string>();
    workspaces.forEach((workspace) => {
        collectManagedWorkspaceAudioUris(workspace).forEach((uri) => uris.add(uri));
    });
    return uris;
}

export function collectManagedLibraryFilePathsFromWorkspaces(workspaces: Workspace[]) {
    const paths = new Set<string>();
    for (const workspace of workspaces) {
        const archivePath = toRelativeManagedPath(workspace.archiveState?.archiveUri);
        if (archivePath) paths.add(archivePath);
        for (const uri of collectManagedWorkspaceAudioUris(workspace)) {
            const path = toRelativeManagedPath(uri);
            if (path) paths.add(path);
        }
    }
    return paths;
}

export async function listFilesRecursively(rootUri: string): Promise<string[]> {
    const rootInfo = await FileSystem.getInfoAsync(rootUri);
    if (!rootInfo.exists) return [];
    if (!("isDirectory" in rootInfo) || rootInfo.isDirectory !== true) return [rootUri];

    const files: string[] = [];
    const pending = [rootUri];
    while (pending.length > 0) {
        const directory = pending.pop()!;
        const names = await FileSystem.readDirectoryAsync(directory);
        for (const name of names) {
            const uri = `${directory}/${name}`;
            const info = await FileSystem.getInfoAsync(uri);
            if (!info.exists) continue;
            if ("isDirectory" in info && info.isDirectory === true) {
                pending.push(uri);
            } else {
                files.push(uri);
            }
        }
    }
    files.sort();
    return files;
}

export function filterUnreferencedManagedAudioUris(
    candidateUris: Iterable<string>,
    nextWorkspaces: Workspace[]
) {
    const nextReferencedUris = collectManagedAudioUrisFromWorkspaces(nextWorkspaces);
    return Array.from(new Set(candidateUris)).filter(
        (uri) => (isManagedAudioUri(uri) || isManagedPreviewAudioUri(uri)) && !nextReferencedUris.has(uri)
    );
}

/** Permanently remove a managed file. For transient artifacts (share temp files) only. */
async function hardDeleteFileIfManaged(uri: string) {
    if (!isSongNookManagedUri(uri)) {
        return;
    }

    try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch (error) {
        console.warn("[ManagedMedia] Failed to delete managed file", uri, error);
    }
}

let trashDirEnsured = false;
async function ensureTrashDir() {
    if (trashDirEnsured) return;
    const info = await FileSystem.getInfoAsync(SONG_NOOK_TRASH_DIR);
    if (!info.exists) {
        await FileSystem.makeDirectoryAsync(SONG_NOOK_TRASH_DIR, { intermediates: true });
    }
    trashDirEnsured = true;
}

/**
 * Move a managed audio file into the trash instead of unlinking it. This is the safety net
 * for the non-transactional delete window: even if a crash happens before the metadata
 * change is durable, the audio survives in quarantine and can be recovered. Purged after
 * TRASH_RETENTION_MS by `purgeExpiredTrash`.
 */
async function trashFileIfManaged(uri: string): Promise<boolean> {
    if (!isSongNookManagedUri(uri)) {
        return false;
    }
    try {
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists) return true;
        await ensureTrashDir();
        const basename = uri.split("/").pop() || "audio";
        const trashUri = `${SONG_NOOK_TRASH_DIR}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${basename}`;
        await FileSystem.moveAsync({ from: uri, to: trashUri });
        return true;
    } catch (error) {
        console.warn("[ManagedMedia] Failed to move managed file to trash", uri, error);
        return false;
    }
}

export async function deleteManagedAudioUris(uris: Iterable<string>) {
    const unique = Array.from(new Set(uris));
    await Promise.all([
        ...unique.map((uri) => trashFileIfManaged(uri)),
        // Detail-waveform sidecars are derived data (regenerable from audio), so
        // hard-delete them with their clip rather than retaining them in the trash.
        ...unique.map((uri) => hardDeleteFileIfManaged(waveformSidecarUri(uri))),
    ]);
}

export async function deleteManagedArchiveUri(uri: string | null | undefined) {
    if (!uri) return;
    await trashFileIfManaged(uri);
}

export async function quarantineManagedPaths(paths: Iterable<string>) {
    const failedPaths: string[] = [];
    for (const path of new Set(paths)) {
        const relativePath = toRelativeManagedPath(path);
        if (!relativePath || !(await trashFileIfManaged(resolveManagedUri(relativePath)))) {
            failedPaths.push(path);
        }
    }
    return { complete: failedPaths.length === 0, failedPaths };
}

export async function cleanupShareTempFile(fileUri: string) {
    await hardDeleteFileIfManaged(fileUri);
}

/**
 * Permanently purge quarantined files older than `maxAgeMs`. Safe to call at startup; it
 * only touches the trash directory.
 */
export async function purgeExpiredTrash(maxAgeMs = TRASH_RETENTION_MS) {
    try {
        const trashInfo = await FileSystem.getInfoAsync(SONG_NOOK_TRASH_DIR);
        if (!trashInfo.exists) return;

        const now = Date.now();
        const filenames = await FileSystem.readDirectoryAsync(SONG_NOOK_TRASH_DIR);
        await Promise.all(
            filenames.map(async (filename) => {
                const uri = `${SONG_NOOK_TRASH_DIR}/${filename}`;
                try {
                    // Filenames are prefixed with the trash timestamp; prefer it, fall back to mtime.
                    const stampMatch = /^(\d{10,})-/.exec(filename);
                    const trashedAt = stampMatch ? Number(stampMatch[1]) : null;
                    if (trashedAt && now - trashedAt < maxAgeMs) return;

                    if (!trashedAt) {
                        const info = await FileSystem.getInfoAsync(uri);
                        const modifiedAt =
                            info.exists && typeof info.modificationTime === "number"
                                ? info.modificationTime > 1e12
                                    ? info.modificationTime
                                    : info.modificationTime * 1000
                                : null;
                        if (modifiedAt && now - modifiedAt < maxAgeMs) return;
                    }

                    await FileSystem.deleteAsync(uri, { idempotent: true });
                } catch (error) {
                    console.warn("[ManagedMedia] Failed to purge trashed file", uri, error);
                }
            })
        );
    } catch (error) {
        console.warn("[ManagedMedia] Failed to sweep trash", error);
    }
}

export async function cleanupStaleShareTempFiles(maxAgeMs = SHARE_TEMP_FILE_MAX_AGE_MS) {
    try {
        const shareDirInfo = await FileSystem.getInfoAsync(SONG_NOOK_SHARE_DIR);
        if (!shareDirInfo.exists) {
            return;
        }

        const now = Date.now();
        const filenames = await FileSystem.readDirectoryAsync(SONG_NOOK_SHARE_DIR);
        await Promise.all(
            filenames.map(async (filename) => {
                const uri = `${SONG_NOOK_SHARE_DIR}/${filename}`;
                try {
                    const info = await FileSystem.getInfoAsync(uri);
                    if (!info.exists) return;
                    const modifiedAt =
                        "modificationTime" in info && typeof info.modificationTime === "number"
                            ? info.modificationTime > 1e12
                                ? info.modificationTime
                                : info.modificationTime * 1000
                            : null;
                    if (modifiedAt && now - modifiedAt < maxAgeMs) {
                        return;
                    }
                    await cleanupShareTempFile(uri);
                } catch (error) {
                    console.warn("[ManagedMedia] Failed to inspect share temp file", uri, error);
                }
            })
        );
    } catch (error) {
        console.warn("[ManagedMedia] Failed to sweep share temp files", error);
    }
}
