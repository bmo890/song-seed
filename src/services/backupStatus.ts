import { getBackupReminderWindowLabel, isBackupOverdue } from "../backupPreferences";
import type { BackupReminderFrequency, Workspace } from "../types";

let hasShownBackupReminderThisSession = false;

function countTotalIdeas(workspaces: Workspace[]) {
    return workspaces.reduce((sum, workspace) => sum + workspace.ideas.length, 0);
}

export function shouldPromptForBackupReminder(args: {
    workspaces: Workspace[];
    backupReminderFrequency: BackupReminderFrequency;
    lastSuccessfulBackupAt: number | null;
    now?: number;
}) {
    if (hasShownBackupReminderThisSession) {
        return false;
    }

    if (countTotalIdeas(args.workspaces) === 0) {
        return false;
    }

    return isBackupOverdue(
        args.lastSuccessfulBackupAt,
        args.backupReminderFrequency,
        args.now
    );
}

export function markBackupReminderPromptShown() {
    hasShownBackupReminderThisSession = true;
}

export function buildBackupReminderPromptMessage(args: {
    backupReminderFrequency: BackupReminderFrequency;
    lastSuccessfulBackupAt: number | null;
}) {
    if (!Number.isFinite(args.lastSuccessfulBackupAt)) {
        return "You haven’t backed up this library yet. Back up now?";
    }

    return `It’s been over a ${getBackupReminderWindowLabel(
        args.backupReminderFrequency
    )} since your last backup. Back up now?`;
}
