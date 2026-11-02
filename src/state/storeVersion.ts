/**
 * The library's data version (11-M1, 2026-11-02). BUMP IT with every persisted-shape
 * change (a new field, a reshaped one, a new enum value) — the key-set test in
 * state/__tests__/storeVersion.test.ts fails until you do. It is what lets a build
 * refuse a backup "made by a newer SongNook", and hydrate newer data read-only instead
 * of stripping it on its next write (useStore migrate).
 *
 *   12  2026-07-10 … 2026-11-01 (frozen while ~13 additive changes shipped)
 *   13  2026-11-02 folded date groups as calendar days (hiddenDays fromDay/toDay)
 */
export const STORE_VERSION = 13;

/** The oldest backup data version Merge accepts: sanitizing on hydrate covers 12 → 13. */
export const MERGE_MIN_STORE_VERSION = 12;

/** Stored data written by a newer build than this one. */
export function isNewerStoreVersion(version: number | undefined, current: number = STORE_VERSION): boolean {
    return typeof version === "number" && Number.isFinite(version) && version > current;
}

/** Whether Merge can fold a backup of this data version into the current library. */
export function canMergeStoreVersion(
    version: number,
    current: number = STORE_VERSION,
    oldest: number = MERGE_MIN_STORE_VERSION
): boolean {
    return version <= current && version >= Math.min(oldest, current);
}
