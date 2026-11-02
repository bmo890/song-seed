import {
    AUTOMATIC_BACKUP_RETRY_MS,
    DEFAULT_AUTOMATIC_BACKUP,
    isAutomaticBackupDue,
    sanitizeAutomaticBackupPrefs,
} from "../domain/automaticBackupPrefs";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;
const on = { ...DEFAULT_AUTOMATIC_BACKUP, frequency: "daily" as const, folder: { handle: "h", name: "iCloud Drive" } };

describe("automatic backup due rule (decision C)", () => {
    it("is off by default and never due without a folder", () => {
        expect(DEFAULT_AUTOMATIC_BACKUP.frequency).toBe("off");
        expect(isAutomaticBackupDue(DEFAULT_AUTOMATIC_BACKUP, NOW)).toBe(false);
        expect(isAutomaticBackupDue({ ...on, folder: null }, NOW)).toBe(false);
    });

    it("runs once per interval", () => {
        expect(isAutomaticBackupDue(on, NOW)).toBe(true);
        expect(isAutomaticBackupDue({ ...on, lastCompletedAt: NOW - DAY / 2 }, NOW)).toBe(false);
        expect(isAutomaticBackupDue({ ...on, lastCompletedAt: NOW - DAY }, NOW)).toBe(true);
        expect(isAutomaticBackupDue({ ...on, frequency: "weekly", lastCompletedAt: NOW - 3 * DAY }, NOW)).toBe(false);
    });

    it("paces retries after a run that didn't finish", () => {
        const failed = { ...on, lastAttemptAt: NOW - 1000, lastError: "folderUnavailable" as const };
        expect(isAutomaticBackupDue(failed, NOW)).toBe(false);
        expect(isAutomaticBackupDue(failed, NOW - 1000 + AUTOMATIC_BACKUP_RETRY_MS)).toBe(true);
    });

    it("sanitizes whatever hydration hands it", () => {
        expect(sanitizeAutomaticBackupPrefs(undefined)).toEqual(DEFAULT_AUTOMATIC_BACKUP);
        expect(sanitizeAutomaticBackupPrefs({ frequency: "hourly", folder: { handle: 3 } })).toEqual(DEFAULT_AUTOMATIC_BACKUP);
        expect(sanitizeAutomaticBackupPrefs({ ...on, lastError: "failed" })).toEqual({ ...on, lastError: "failed" });
    });
});
