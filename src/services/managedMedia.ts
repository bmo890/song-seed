import * as FileSystem from "expo-file-system/legacy";
import type { ClipVersion, SongIdea, Workspace } from "../types";
import {
    isManagedPreviewAudioUri,
    SONG_SEED_SHARE_DIR,
    SONG_SEED_TRASH_DIR,
    isManagedAudioUri,
    isSongSeedManagedUri,
} from "./storagePaths";

export const SHARE_TEMP_FILE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const MAX_IN_MEMORY_ARCHIVE_BYTES = 150 * 1024 * 1024;
/** How long quarantined (deleted) audio is retained before it is permanently purged. */
export const TRASH_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

function collectManagedClipUris(clip: ClipVersion, target: Set<string>) {
    if (clip.audioUri && isSongSeedManagedUri(clip.audioUri)) {
        target.add(clip.audioUri);
    }
    if (clip.sourceAudioUri && isSongSeedManagedUri(clip.sourceAudioUri)) {
        target.add(clip.sourceAudioUri);
    }
    if (clip.overdub?.renderedMixUri && isSongSeedManagedUri(clip.overdub.renderedMixUri)) {
        target.add(clip.overdub.renderedMixUri);
    }
    for (const stem of clip.overdub?.stems ?? []) {
        if (stem.audioUri && isSongSeedManagedUri(stem.audioUri)) {
            target.add(stem.audioUri);
        }
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
    if (!isSongSeedManagedUri(uri)) {
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
    const info = await FileSystem.getInfoAsync(SONG_SEED_TRASH_DIR);
    if (!info.exists) {
        await FileSystem.makeDirectoryAsync(SONG_SEED_TRASH_DIR, { intermediates: true });
    }
    trashDirEnsured = true;
}

/**
 * Move a managed audio file into the trash instead of unlinking it. This is the safety net
 * for the non-transactional delete window: even if a crash happens before the metadata
 * change is durable, the audio survives in quarantine and can be recovered. Purged after
 * TRASH_RETENTION_MS by `purgeExpiredTrash`.
 */
async function trashFileIfManaged(uri: string) {
    if (!isSongSeedManagedUri(uri)) {
        return;
    }
    try {
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists) return;
        await ensureTrashDir();
        const basename = uri.split("/").pop() || "audio";
        const trashUri = `${SONG_SEED_TRASH_DIR}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${basename}`;
        await FileSystem.moveAsync({ from: uri, to: trashUri });
    } catch (error) {
        console.warn("[ManagedMedia] Failed to move managed file to trash", uri, error);
    }
}

export async function deleteManagedAudioUris(uris: Iterable<string>) {
    await Promise.all(Array.from(new Set(uris)).map((uri) => trashFileIfManaged(uri)));
}

export async function deleteManagedArchiveUri(uri: string | null | undefined) {
    if (!uri) return;
    await trashFileIfManaged(uri);
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
        const trashInfo = await FileSystem.getInfoAsync(SONG_SEED_TRASH_DIR);
        if (!trashInfo.exists) return;

        const now = Date.now();
        const filenames = await FileSystem.readDirectoryAsync(SONG_SEED_TRASH_DIR);
        await Promise.all(
            filenames.map(async (filename) => {
                const uri = `${SONG_SEED_TRASH_DIR}/${filename}`;
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
        const shareDirInfo = await FileSystem.getInfoAsync(SONG_SEED_SHARE_DIR);
        if (!shareDirInfo.exists) {
            return;
        }

        const now = Date.now();
        const filenames = await FileSystem.readDirectoryAsync(SONG_SEED_SHARE_DIR);
        await Promise.all(
            filenames.map(async (filename) => {
                const uri = `${SONG_SEED_SHARE_DIR}/${filename}`;
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

export async function ensureArchiveSizeWithinSafetyLimit(
    fileUris: Iterable<string>,
    label: string
) {
    let totalBytes = 0;

    for (const fileUri of fileUris) {
        const info = await FileSystem.getInfoAsync(fileUri);
        if (!info.exists) {
            continue;
        }
        if (typeof info.size === "number") {
            totalBytes += info.size;
        }
    }

    // Expo's legacy FS writes base64 strings, so large archives can spike memory well above
    // the final file size. Hard-fail before that point rather than crashing the app.
    if (totalBytes > MAX_IN_MEMORY_ARCHIVE_BYTES) {
        throw new Error(
            `${label} is too large to package safely on this device right now. Try a smaller export/share selection.`
        );
    }
}
