import * as FileSystem from "expo-file-system/legacy";

export const SONG_SEED_ROOT = `${FileSystem.documentDirectory ?? ""}songseed`;
export const SONG_SEED_AUDIO_DIR = `${SONG_SEED_ROOT}/audio`;
export const SONG_SEED_PREVIEW_AUDIO_DIR = `${SONG_SEED_ROOT}/preview-audio`;
export const SONG_SEED_SHARE_DIR = `${SONG_SEED_ROOT}/share`;
export const SONG_SEED_WORKSPACE_ARCHIVE_DIR = `${SONG_SEED_ROOT}/workspace-archives`;
/** Quarantine for deleted audio: files are moved here and purged after a retention window,
 *  so a crash between a metadata delete and its file removal can never permanently lose audio. */
export const SONG_SEED_TRASH_DIR = `${SONG_SEED_ROOT}/trash`;
export const SONG_SEED_MANIFEST_PATH = `${SONG_SEED_ROOT}/manifest.json`;
export const SONG_SEED_MANIFEST_TMP_PATH = `${SONG_SEED_ROOT}/manifest.tmp.json`;

function normalizeDirectoryUri(uri: string) {
    return uri.endsWith("/") ? uri : `${uri}/`;
}

export function isSongSeedManagedUri(uri: string) {
    return uri.startsWith(normalizeDirectoryUri(SONG_SEED_ROOT));
}

export function isManagedAudioUri(uri: string) {
    return uri.startsWith(normalizeDirectoryUri(SONG_SEED_AUDIO_DIR));
}

export function isManagedPreviewAudioUri(uri: string) {
    return uri.startsWith(normalizeDirectoryUri(SONG_SEED_PREVIEW_AUDIO_DIR));
}

/**
 * The container-independent portion of a managed Song Seed URI — everything from
 * the `songseed/` root onward (e.g. `songseed/audio/<id>.m4a`). Returns null when
 * `uri` is not a managed path.
 *
 * This is the stable identity of a managed file: the absolute prefix
 * (`FileSystem.documentDirectory`) embeds the app container, which on iOS changes
 * across reinstall/restore. Persist and back up the relative form; reconstruct the
 * absolute form at access time with `resolveManagedUri`.
 */
export function toRelativeManagedPath(uri: string | undefined | null): string | null {
    if (!uri) return null;
    const marker = "songseed/";
    const idx = uri.indexOf(marker);
    if (idx === -1) return null;
    return uri.slice(idx);
}

/** Reconstruct an absolute file URI for a managed relative path against the live document directory. */
export function resolveManagedUri(relativePath: string): string {
    const base = FileSystem.documentDirectory ?? "";
    return `${base}${relativePath.replace(/^\/+/, "")}`;
}

/**
 * Rebase a managed URI onto the live document directory. Managed paths whose stored
 * container prefix differs from the current one are healed; non-managed or
 * already-correct URIs are returned unchanged. Makes absolute audio references
 * survive reinstall/restore (notably iOS, where the container UUID changes).
 */
export function rebaseManagedUri<T extends string | undefined | null>(uri: T): T {
    const rel = toRelativeManagedPath(uri);
    if (!rel) return uri;
    return resolveManagedUri(rel) as T;
}
