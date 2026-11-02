import * as FileSystem from "expo-file-system/legacy";
import { Paths } from "expo-file-system";

/**
 * Files shared INTO SongNook arrive as copies the share intake made (audit 06-3):
 * iOS's share extension copies each one into the App Group container as
 * `<UUID>.<ext>` (videos also leave a `<…>.jpg` thumbnail there); Android's patched
 * intake copies into `cache/share-intake/`. Nothing deleted them, so every clip or
 * video ever shared in stayed on the phone after import, after the clip was deleted,
 * and after Erase everything.
 *
 * Only those copies are ever touched: a direct child of one of the two folders, never
 * a path with `..` in it, never anything inside the container's own subfolders.
 */

const SHARE_INTAKE_FOLDER = "share-intake/";
/** A copy this old was never going to be imported: the share was abandoned or killed. */
const LEFTOVER_AGE_MS = 24 * 60 * 60 * 1000;
/** What the share extension writes at the container's root: `<UUID>.<ext>` copies, a
 *  video's thumbnail (its copy's name in base64, `.jpg`), a `screenshot_<UUID>.png`. */
const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const SHARE_EXTENSION_NAMES = [
    new RegExp(`^${UUID_PATTERN}\\.[a-z0-9]{1,8}$`, "i"),
    /^[A-Za-z0-9+]{40,}=?\.jpg$/,
    new RegExp(`^screenshot_${UUID_PATTERN}\\.png$`, "i"),
];
/** A content:// archive copied for reading (useShareImportScreenModel). */
const SHARED_ARCHIVE_NAME = /^shared-archive-\d+\.zip$/;

/** A path with no scheme, no `/private` (iOS hands out both spellings), no `//`. */
function plainPath(uri: string): string {
    let path = uri.replace(/^file:\/\//, "");
    try {
        path = decodeURI(path);
    } catch {
        // Keep it as it is.
    }
    return path.replace(/^\/private\//, "/").replace(/\/{2,}/g, "/");
}

function withSlash(uri: string) {
    return uri.endsWith("/") ? uri : `${uri}/`;
}

/** The App Group containers this app can see (iOS); none elsewhere or on an old build. */
function appGroupFolders(): string[] {
    try {
        const containers = Paths.appleSharedContainers ?? {};
        return Object.values(containers)
            .map((directory) => directory?.uri)
            .filter((uri): uri is string => typeof uri === "string" && uri.length > 0)
            .map(withSlash);
    } catch {
        return [];
    }
}

function shareIntakeFolder(): string | null {
    return FileSystem.cacheDirectory ? `${withSlash(FileSystem.cacheDirectory)}${SHARE_INTAKE_FOLDER}` : null;
}

function sharedInFolders(): string[] {
    const intake = shareIntakeFolder();
    return [...appGroupFolders(), ...(intake ? [intake] : [])];
}

/** The root of an App Group container, which only this app's own groups can be: the
 *  sandbox lets it see no one else's. For a build whose entitlements list is empty. */
const APP_GROUP_ROOT_CHILD = /^\/var\/mobile\/Containers\/Shared\/AppGroup\/[0-9a-f-]{36}\/[^/]+$/i;

/** True only for a copy the share intake made: a direct child of its folder. */
export function isSharedInCopy(uri: string | null | undefined): boolean {
    if (!uri || /(^|\/)\.\.?(\/|$)/.test(uri)) return false;
    const path = plainPath(uri);
    if (APP_GROUP_ROOT_CHILD.test(path)) return true;
    return sharedInFolders().some((folder) => {
        const root = plainPath(folder);
        if (!path.startsWith(root)) return false;
        const name = path.slice(root.length);
        return name.length > 0 && !name.includes("/");
    });
}

/** Delete these, where they are the share intake's own copies; anything else is left. */
export async function discardSharedInCopies(uris: ReadonlyArray<string | null | undefined>): Promise<void> {
    await Promise.all(
        uris
            .filter((uri): uri is string => isSharedInCopy(uri))
            .map((uri) => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {}))
    );
}

async function isOldFile(uri: string, olderThanMs: number): Promise<boolean> {
    try {
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists || info.isDirectory) return false;
        if (olderThanMs <= 0) return true;
        const modified = typeof info.modificationTime === "number" ? info.modificationTime : null;
        if (modified == null) return false;
        const modifiedMs = modified > 1e12 ? modified : modified * 1000;
        return Date.now() - modifiedMs >= olderThanMs;
    } catch {
        return false;
    }
}

async function sweepFolder(folder: string, matches: (name: string) => boolean, olderThanMs: number) {
    let names: string[];
    try {
        names = await FileSystem.readDirectoryAsync(folder);
    } catch {
        return;
    }
    for (const name of names) {
        if (!matches(name)) continue;
        const uri = `${folder}${name}`;
        if (await isOldFile(uri, olderThanMs)) {
            await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        }
    }
}

/**
 * Launch: shared-in copies a day old were abandoned (a cancelled or killed share, a
 * skipped duplicate, a file that wasn't audio). A fresh one may belong to the share
 * that opened the app, so it stays. Erase everything passes `olderThanMs: 0`.
 */
export async function sweepSharedInCopies({ olderThanMs = LEFTOVER_AGE_MS }: { olderThanMs?: number } = {}) {
    for (const folder of appGroupFolders()) {
        await sweepFolder(folder, (name) => SHARE_EXTENSION_NAMES.some((pattern) => pattern.test(name)), olderThanMs);
    }
    const intake = shareIntakeFolder();
    if (intake) await sweepFolder(intake, () => true, olderThanMs);
    if (FileSystem.cacheDirectory) {
        await sweepFolder(withSlash(FileSystem.cacheDirectory), (name) => SHARED_ARCHIVE_NAME.test(name), olderThanMs);
    }
}
