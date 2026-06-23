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
 * the managed `songseed/` root onward (e.g. `songseed/audio/<id>.m4a`). Returns null
 * when `uri` is not a managed path.
 *
 * This is the stable identity of a managed file: the absolute prefix
 * (`FileSystem.documentDirectory`) embeds the app container, which on iOS changes
 * across reinstall/restore. Persist and back up the relative form; reconstruct the
 * absolute form at access time with `resolveManagedUri`.
 *
 * IMPORTANT: the managed root must be anchored to the document directory, not located
 * with a bare `indexOf("songseed/")`. The container path itself can contain the
 * substring "songseed" (e.g. the Android package `com.anonymous.songseed`), and a bare
 * search would match there, mistaking part of the container prefix for the managed root.
 */
export function toRelativeManagedPath(uri: string | undefined | null): string | null {
    if (!uri) return null;
    // Disaster-recovery snapshots intentionally persist canonical relative paths. Accept
    // those directly so hydration can resolve them against the new app container.
    if (uri.startsWith("songseed/")) {
        return uri;
    }
    const base = FileSystem.documentDirectory ?? "";
    // Same container (always true on Android; on iOS until the container UUID changes):
    // strip the live document-directory prefix and confirm it lands in the managed tree.
    if (base && uri.startsWith(base)) {
        const rest = uri.slice(base.length).replace(/^\/+/, "");
        return rest.startsWith("songseed/") ? rest : null;
    }
    // Different container prefix (iOS reinstall/restore, or a restored backup): the stored
    // absolute path starts with a stale container. Anchor on "/songseed/" — note the leading
    // slash — so a "songseed" substring inside the container/package identifier is not
    // mistaken for the managed root.
    const idx = uri.indexOf("/songseed/");
    if (idx === -1) return null;
    return uri.slice(idx + 1);
}

/** Reconstruct an absolute file URI for a managed relative path against the live document directory. */
export function resolveManagedUri(relativePath: string): string {
    const base = FileSystem.documentDirectory ?? "";
    return `${base}${relativePath.replace(/^\/+/, "")}`;
}

/**
 * Repair managed URIs corrupted by an earlier rebase bug. A prior `toRelativeManagedPath`
 * located the managed root with a bare `indexOf("songseed/")`, which on Android matched the
 * "songseed" inside the package name (`com.anonymous.songseed/`) instead of the managed
 * folder. Each hydration then re-prepended the root, accreting a `songseed/files/` segment
 * every app launch — e.g. `…/files/songseed/files/songseed/audio/x.wav`. We collapse those
 * leading `songseed/files/` runs (anchored after the document directory so the package
 * name's own "songseed" is never touched), recovering both managed (`songseed/audio/x.wav`)
 * and non-managed (`recording_x.wav`) originals.
 */
export function repairManagedPathCorruption<T extends string | undefined | null>(uri: T): T {
    if (!uri) return uri;
    const base = FileSystem.documentDirectory ?? "";
    if (!base || !uri.startsWith(base)) return uri;
    const rest = uri.slice(base.length).replace(/^(songseed\/files\/)+/, "");
    return `${base}${rest}` as T;
}

/**
 * Rebase a managed URI onto the live document directory. First repairs any historic
 * `songseed/files/` corruption, then heals managed paths whose stored container prefix
 * differs from the current one. Non-managed or already-correct URIs are returned unchanged
 * (after repair). Makes absolute audio references survive reinstall/restore (notably iOS,
 * where the container UUID changes) and undoes the accreted-path corruption on Android.
 */
export function rebaseManagedUri<T extends string | undefined | null>(uri: T): T {
    const repaired = repairManagedPathCorruption(uri);
    const rel = toRelativeManagedPath(repaired);
    if (!rel) return repaired;
    return resolveManagedUri(rel) as T;
}
