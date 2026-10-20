import * as FileSystem from "expo-file-system/legacy";

/**
 * Picked files are COPIES the system pickers made inside the app's own cache: the Files
 * picker into Caches/DocumentPicker, the Photos picker into Caches/ImagePicker. A video
 * copy can be gigabytes on a phone that is short of space, so it goes the moment it is
 * no longer needed: imported, skipped as a duplicate, or cancelled (founder, 2026-10-20).
 *
 * The original never comes near this: it stays in Photos or Files, outside the app.
 * Only a file inside the app's cache that the pickers handed over is ever deleted.
 */

const PICKER_CACHE_FOLDERS = ["DocumentPicker", "ImagePicker"] as const;

/** True only for a file inside this app's own cache folder. */
export function isInAppCache(uri: string | undefined | null): boolean {
    const cache = FileSystem.cacheDirectory;
    return !!uri && !!cache && uri.startsWith(cache);
}

/** The pickers' copies, tagged when picked (`discardSourceAfterImport`), are deleted. */
export async function discardPickedCopies(
    assets: ReadonlyArray<{ uri: string; discardSourceAfterImport?: boolean }> | null | undefined
): Promise<void> {
    if (!assets?.length) return;
    await Promise.all(
        assets
            .filter((asset) => asset.discardSourceAfterImport && isInAppCache(asset.uri))
            .map((asset) => FileSystem.deleteAsync(asset.uri, { idempotent: true }).catch(() => {}))
    );
}

/**
 * At launch nothing is mid-import, so whatever the pickers left behind (a crash or a
 * kill during an import) is cleared. Only the two picker folders inside the app's cache.
 */
export async function sweepPickerCache(): Promise<void> {
    const cache = FileSystem.cacheDirectory;
    if (!cache) return;
    await Promise.all(
        PICKER_CACHE_FOLDERS.map((folder) =>
            FileSystem.deleteAsync(`${cache}${folder}`, { idempotent: true }).catch(() => {})
        )
    );
}
