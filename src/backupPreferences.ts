import type { BackupReminderFrequency } from "./types";

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
    switch (frequency) {
        case "off":
            return "Off";
        case "weekly":
            return "Weekly";
        case "quarterly":
            return "Every 3 months";
        case "monthly":
        default:
            return "Monthly";
    }
}

export function getBackupReminderWindowLabel(frequency: BackupReminderFrequency) {
    switch (frequency) {
        case "weekly":
            return "week";
        case "quarterly":
            return "3 months";
        case "monthly":
        default:
            return "month";
    }
}

export function getBackupReminderDescription(frequency: BackupReminderFrequency) {
    switch (frequency) {
        case "off":
            return "Do not remind me to create a backup.";
        case "weekly":
            return "Prompt me once a week if I have not saved a backup.";
        case "quarterly":
            return "Prompt me every 3 months if my library has not been backed up.";
        case "monthly":
        default:
            return "Prompt me once a month if I have not saved a backup.";
    }
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

export function isBackupOverdue(
    lastSuccessfulBackupAt: number | null | undefined,
    frequency: BackupReminderFrequency,
    now = Date.now()
) {
    const intervalMs = getBackupReminderIntervalMs(frequency);
    if (intervalMs == null) {
        return false;
    }

    if (!Number.isFinite(lastSuccessfulBackupAt)) {
        return true;
    }

    return now - Number(lastSuccessfulBackupAt) >= intervalMs;
}

export function formatBackupTimestamp(timestamp: number | null | undefined) {
    if (!Number.isFinite(timestamp)) {
        return "Never";
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
