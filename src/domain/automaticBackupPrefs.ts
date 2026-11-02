/**
 * Automatic backup settings and the "is a run due" rule (founder decision C,
 * 2026-11-02). Off by default: the person opts in and picks the folder once.
 */
export type AutomaticBackupFrequency = "off" | "daily" | "weekly";

export type AutomaticBackupError = "folderUnavailable" | "lowSpace" | "failed" | "incomplete";

export type AutomaticBackupPrefs = {
    frequency: AutomaticBackupFrequency;
    /** The picked folder: a bookmark (iOS) or a tree URI (Android), and its name. */
    folder: { handle: string; name: string } | null;
    /** Epoch of the last run that finished with every recording in the folder. */
    lastCompletedAt: number | null;
    /** Epoch of the last run, finished or not (paces retries after a failure). */
    lastAttemptAt: number | null;
    lastError: AutomaticBackupError | null;
};

export const DEFAULT_AUTOMATIC_BACKUP: AutomaticBackupPrefs = {
    frequency: "off",
    folder: null,
    lastCompletedAt: null,
    lastAttemptAt: null,
    lastError: null,
};

const FREQUENCIES: readonly AutomaticBackupFrequency[] = ["off", "daily", "weekly"];
const ERRORS: readonly AutomaticBackupError[] = ["folderUnavailable", "lowSpace", "failed", "incomplete"];
const DAY_MS = 24 * 60 * 60 * 1000;
/** After a run that didn't finish, wait this long before trying again on its own. */
export const AUTOMATIC_BACKUP_RETRY_MS = 60 * 60 * 1000;

function finiteOrNull(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function sanitizeAutomaticBackupPrefs(value: unknown): AutomaticBackupPrefs {
    if (!value || typeof value !== "object") return DEFAULT_AUTOMATIC_BACKUP;
    const raw = value as Record<string, unknown>;
    const folder = raw.folder as Record<string, unknown> | null | undefined;
    return {
        frequency: FREQUENCIES.includes(raw.frequency as AutomaticBackupFrequency)
            ? (raw.frequency as AutomaticBackupFrequency)
            : "off",
        folder:
            folder && typeof folder.handle === "string" && folder.handle && typeof folder.name === "string"
                ? { handle: folder.handle, name: folder.name }
                : null,
        lastCompletedAt: finiteOrNull(raw.lastCompletedAt),
        lastAttemptAt: finiteOrNull(raw.lastAttemptAt),
        lastError: ERRORS.includes(raw.lastError as AutomaticBackupError) ? (raw.lastError as AutomaticBackupError) : null,
    };
}

export function automaticBackupIntervalMs(frequency: AutomaticBackupFrequency) {
    return frequency === "daily" ? DAY_MS : frequency === "weekly" ? 7 * DAY_MS : null;
}

/** On, with a folder, and the interval since the last finished run has passed. */
export function isAutomaticBackupDue(prefs: AutomaticBackupPrefs, now = Date.now()) {
    const interval = automaticBackupIntervalMs(prefs.frequency);
    if (interval == null || !prefs.folder) return false;
    if (prefs.lastCompletedAt != null && now - prefs.lastCompletedAt < interval) return false;
    if (prefs.lastAttemptAt != null && prefs.lastError != null && now - prefs.lastAttemptAt < AUTOMATIC_BACKUP_RETRY_MS) {
        return false;
    }
    return true;
}

export function isAutomaticBackupOn(prefs: AutomaticBackupPrefs) {
    return prefs.frequency !== "off" && prefs.folder != null;
}
