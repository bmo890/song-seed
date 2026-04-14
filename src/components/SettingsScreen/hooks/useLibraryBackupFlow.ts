import { useMemo, useState } from "react";
import { Alert } from "react-native";
import * as Clipboard from "expo-clipboard";
import {
    formatBackupTimestamp,
    getBackupReminderDescription,
    getBackupReminderLabel,
} from "../../../backupPreferences";
import {
    BACKUP_SAVE_CANCELLED_MESSAGE,
    runManualLibraryBackup,
} from "../../../services/libraryBackup";
import { useStore } from "../../../state/useStore";
import type { BackupReminderFrequency } from "../../../types";

const REMINDER_OPTIONS: BackupReminderFrequency[] = ["off", "weekly", "monthly", "quarterly"];

export function useLibraryBackupFlow() {
    const workspaces = useStore((state) => state.workspaces);
    const notes = useStore((state) => state.notes);
    const primaryWorkspaceId = useStore((state) => state.primaryWorkspaceId);
    const primaryCollectionIdByWorkspace = useStore((state) => state.primaryCollectionIdByWorkspace);
    const backupReminderFrequency = useStore((state) => state.backupReminderFrequency);
    const setBackupReminderFrequency = useStore((state) => state.setBackupReminderFrequency);
    const lastSuccessfulBackupAt = useStore((state) => state.lastSuccessfulBackupAt);
    const lastSuccessfulBackupFileName = useStore((state) => state.lastSuccessfulBackupFileName);
    const setLastSuccessfulBackupAt = useStore((state) => state.setLastSuccessfulBackupAt);
    const setLastSuccessfulBackupFileName = useStore((state) => state.setLastSuccessfulBackupFileName);
    const [isBackingUp, setIsBackingUp] = useState(false);

    const reminderOptions = useMemo(
        () =>
            REMINDER_OPTIONS.map((value) => ({
                value,
                title: getBackupReminderLabel(value),
                subtitle: getBackupReminderDescription(value),
            })),
        []
    );

    const handleBackupNow = async () => {
        if (isBackingUp) {
            return false;
        }

        setIsBackingUp(true);
        try {
            const result = await runManualLibraryBackup(workspaces, notes, {
                primaryWorkspaceId,
                primaryCollectionIdByWorkspace: Object.fromEntries(
                    Object.entries(primaryCollectionIdByWorkspace).flatMap(([workspaceId, collectionId]) =>
                        typeof collectionId === "string" ? [[workspaceId, collectionId] as const] : []
                    )
                ),
            });
            const backupFileName = `${result.archiveTitle}.zip`;
            setLastSuccessfulBackupAt(Date.now());
            setLastSuccessfulBackupFileName(backupFileName);
            Alert.alert(
                "Backup ready",
                `Saved ${backupFileName} to the folder you selected.`,
                [
                    {
                        text: "Copy Name",
                        onPress: () => {
                            void Clipboard.setStringAsync(backupFileName);
                        },
                    },
                    { text: "OK" },
                ]
            );
            return true;
        } catch (error) {
            if (error instanceof Error && error.message === BACKUP_SAVE_CANCELLED_MESSAGE) {
                return false;
            }

            const message =
                error instanceof Error ? error.message : "The library backup could not be completed.";
            Alert.alert("Backup failed", message);
            return false;
        } finally {
            setIsBackingUp(false);
        }
    };

    return {
        backupReminderFrequency,
        setBackupReminderFrequency,
        lastSuccessfulBackupAt,
        lastSuccessfulBackupFileName,
        lastSuccessfulBackupLabel: formatBackupTimestamp(lastSuccessfulBackupAt),
        reminderOptions,
        isBackingUp,
        handleBackupNow,
        copyLastBackupFileName: async () => {
            if (!lastSuccessfulBackupFileName) {
                return false;
            }

            await Clipboard.setStringAsync(lastSuccessfulBackupFileName);
            Alert.alert("Copied", "Backup file name copied to clipboard.");
            return true;
        },
    };
}
