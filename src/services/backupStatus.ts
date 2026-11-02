import { getBackupReminderWindowLabel, isBackupReminderDue } from "../domain/backupPreferences";
import { i18n } from "../i18n/instance";
import type { BackupReminderFrequency, Workspace } from "../types";

function countTotalIdeas(workspaces: Workspace[]) {
    return workspaces.reduce((sum, workspace) => sum + workspace.ideas.length, 0);
}

function newestBackupAt(...times: Array<number | null | undefined>) {
    const finite = times.filter((time): time is number => typeof time === "number" && Number.isFinite(time));
    return finite.length > 0 ? Math.max(...finite) : null;
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
    /** The last automatic-backup run that finished (decision C): it counts as a backup,
     *  so the reminder stays quiet while the folder is kept current and only speaks
     *  if automatic backup has stopped finishing for a whole reminder interval. */
    automaticBackupLastCompletedAt?: number | null;
    firstLaunchAt: number | null;
    backupReminderLastPromptedAt: number | null;
    now?: number;
}) {
    if (countTotalIdeas(args.workspaces) === 0) {
        return false;
    }

    return isBackupReminderDue({
        frequency: args.backupReminderFrequency,
        lastSuccessfulBackupAt: newestBackupAt(args.lastSuccessfulBackupAt, args.automaticBackupLastCompletedAt),
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
