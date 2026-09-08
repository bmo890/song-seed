import { getBackupReminderWindowLabel, isBackupReminderDue } from "../domain/backupPreferences";
import { i18n } from "../i18n/instance";
import type { BackupReminderFrequency, Workspace } from "../types";

function countTotalIdeas(workspaces: Workspace[]) {
    return workspaces.reduce((sum, workspace) => sum + workspace.ideas.length, 0);
}

/**
 * Boot-time decision for the backup nag. Pure over persisted fields — the "shown
 * this session" memory that used to live here reset on every cold start, which is
 * why the prompt came back on every launch (2026-09-07 field report).
 */
export function shouldPromptForBackupReminder(args: {
    workspaces: Workspace[];
    backupReminderFrequency: BackupReminderFrequency;
    lastSuccessfulBackupAt: number | null;
    firstLaunchAt: number | null;
    backupReminderLastPromptedAt: number | null;
    now?: number;
}) {
    if (countTotalIdeas(args.workspaces) === 0) {
        return false;
    }

    return isBackupReminderDue({
        frequency: args.backupReminderFrequency,
        lastSuccessfulBackupAt: args.lastSuccessfulBackupAt,
        firstLaunchAt: args.firstLaunchAt,
        lastPromptedAt: args.backupReminderLastPromptedAt,
        now: args.now,
    });
}

export function buildBackupReminderPromptMessage(args: {
    backupReminderFrequency: BackupReminderFrequency;
    lastSuccessfulBackupAt: number | null;
}) {
    if (!Number.isFinite(args.lastSuccessfulBackupAt)) {
        return i18n.t("backupReminder.bodyNever");
    }

    return i18n.t("backupReminder.bodyOverdue", {
        window: getBackupReminderWindowLabel(args.backupReminderFrequency),
    });
}
