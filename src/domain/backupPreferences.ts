import type { BackupReminderFrequency } from "../types";
import { i18n } from "../i18n/instance";

export const DEFAULT_BACKUP_REMINDER_FREQUENCY: BackupReminderFrequency = "monthly";

const VALID_BACKUP_REMINDER_FREQUENCIES: readonly BackupReminderFrequency[] = [
    "off",
    "weekly",
    "monthly",
    "quarterly",
];

export function isBackupReminderFrequency(value: unknown): value is BackupReminderFrequency {
    return (
        typeof value === "string" &&
        VALID_BACKUP_REMINDER_FREQUENCIES.includes(value as BackupReminderFrequency)
    );
}

export function getBackupReminderLabel(frequency: BackupReminderFrequency) {
    return i18n.t(`backupReminder.frequency.${frequency}.label`);
}

export function getBackupReminderWindowLabel(frequency: BackupReminderFrequency) {
    return i18n.t(`backupReminder.frequency.${frequency === "off" ? "monthly" : frequency}.window`);
}

export function getBackupReminderDescription(frequency: BackupReminderFrequency) {
    return i18n.t(`backupReminder.frequency.${frequency}.description`);
}

export function getBackupReminderIntervalMs(frequency: BackupReminderFrequency) {
    switch (frequency) {
        case "off":
            return null;
        case "weekly":
            return 7 * 24 * 60 * 60 * 1000;
        case "quarterly":
            return 90 * 24 * 60 * 60 * 1000;
        case "monthly":
        default:
            return 30 * 24 * 60 * 60 * 1000;
    }
}

export type BackupReminderInputs = {
    frequency: BackupReminderFrequency;
    /** Epoch of the last completed backup (null = never). */
    lastSuccessfulBackupAt: number | null | undefined;
    /** Epoch of the very first launch (null until recorded). */
    firstLaunchAt: number | null | undefined;
    /** Epoch the reminder was last shown, whichever button was tapped. */
    lastPromptedAt: number | null | undefined;
    now?: number;
};

/**
 * Whether the backup reminder is due. The setting reads "prompt me once a
 * week/month/quarter if I haven't backed up", so that is literally the rule:
 *
 * - the clock starts at the last backup, or at install for a library that was
 *   never backed up (never on day one — 2026-09-07 field report: it used to fire on
 *   every cold launch from the moment the app was installed);
 * - once shown, it waits a full interval before asking again, "Later" included.
 */
export function isBackupReminderDue({
    frequency,
    lastSuccessfulBackupAt,
    firstLaunchAt,
    lastPromptedAt,
    now = Date.now(),
}: BackupReminderInputs) {
    const intervalMs = getBackupReminderIntervalMs(frequency);
    if (intervalMs == null) return false;

    const anchor = Number.isFinite(lastSuccessfulBackupAt)
        ? Number(lastSuccessfulBackupAt)
        : Number.isFinite(firstLaunchAt)
            ? Number(firstLaunchAt)
            : null;
    if (anchor == null) return false;
    if (now - anchor < intervalMs) return false;

    if (Number.isFinite(lastPromptedAt) && now - Number(lastPromptedAt) < intervalMs) return false;
    return true;
}

export function formatBackupTimestamp(timestamp: number | null | undefined) {
    if (!Number.isFinite(timestamp)) {
        return i18n.t("backupReminder.never");
    }

    try {
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(new Date(Number(timestamp)));
    } catch {
        return new Date(Number(timestamp)).toLocaleString();
    }
}
