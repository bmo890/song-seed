import * as FileSystem from "expo-file-system/legacy";
import type { ClipVersion, SongIdea, Workspace } from "../types";
import {
    SONG_SEED_SHARE_DIR,
    isManagedAudioUri,
    isSongSeedManagedUri,
} from "./storagePaths";

export const SHARE_TEMP_FILE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const MAX_IN_MEMORY_ARCHIVE_BYTES = 150 * 1024 * 1024;

function collectManagedClipUris(clip: ClipVersion, target: Set<string>) {
    if (clip.audioUri && isManagedAudioUri(clip.audioUri)) {
        target.add(clip.audioUri);
    }
    if (clip.sourceAudioUri && isManagedAudioUri(clip.sourceAudioUri)) {
        target.add(clip.sourceAudioUri);
    }
    if (clip.overdub?.renderedMixUri && isManagedAudioUri(clip.overdub.renderedMixUri)) {
        target.add(clip.overdub.renderedMixUri);
    }
    for (const stem of clip.overdub?.stems ?? []) {
        if (stem.audioUri && isManagedAudioUri(stem.audioUri)) {
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
        (uri) => isManagedAudioUri(uri) && !nextReferencedUris.has(uri)
    );
}

async function deleteFileIfManaged(uri: string) {
    if (!isSongSeedManagedUri(uri)) {
        return;
    }

    try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch (error) {
        console.warn("[ManagedMedia] Failed to delete managed file", uri, error);
    }
}

export async function deleteManagedAudioUris(uris: Iterable<string>) {
    await Promise.all(Array.from(new Set(uris)).map((uri) => deleteFileIfManaged(uri)));
}

export async function deleteManagedArchiveUri(uri: string | null | undefined) {
    if (!uri) return;
    await deleteFileIfManaged(uri);
}

export async function cleanupShareTempFile(fileUri: string) {
    await deleteFileIfManaged(fileUri);
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
