import * as FileSystem from "expo-file-system/legacy";

export const SONG_SEED_ROOT = `${FileSystem.documentDirectory ?? ""}songseed`;
export const SONG_SEED_AUDIO_DIR = `${SONG_SEED_ROOT}/audio`;
export const SONG_SEED_SHARE_DIR = `${SONG_SEED_ROOT}/share`;
export const SONG_SEED_WORKSPACE_ARCHIVE_DIR = `${SONG_SEED_ROOT}/workspace-archives`;

function normalizeDirectoryUri(uri: string) {
    return uri.endsWith("/") ? uri : `${uri}/`;
}

export function isSongSeedManagedUri(uri: string) {
    return uri.startsWith(normalizeDirectoryUri(SONG_SEED_ROOT));
}

export function isManagedAudioUri(uri: string) {
    return uri.startsWith(normalizeDirectoryUri(SONG_SEED_AUDIO_DIR));
}
