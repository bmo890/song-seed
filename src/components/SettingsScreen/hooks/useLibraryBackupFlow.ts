import { useMemo, useState } from "react";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import { AppAlert } from "../../common/AppAlert";
import {
    formatBackupTimestamp,
    getBackupReminderDescription,
    getBackupReminderLabel,
} from "../../../backupPreferences";
import {
    BACKUP_SAVE_CANCELLED_MESSAGE,
    runExactLibraryBackup,
} from "../../../services/libraryBackup";
import { restoreFromDisasterRecoveryBackup } from "../../../services/disasterRecoveryRestore";
import { useStore } from "../../../state/useStore";
import type { BackupReminderFrequency } from "../../../types";

const REMINDER_OPTIONS: BackupReminderFrequency[] = ["off", "weekly", "monthly", "quarterly"];

export function useLibraryBackupFlow() {
    const backupReminderFrequency = useStore((state) => state.backupReminderFrequency);
    const setBackupReminderFrequency = useStore((state) => state.setBackupReminderFrequency);
    const lastSuccessfulBackupAt = useStore((state) => state.lastSuccessfulBackupAt);
    const lastSuccessfulBackupFileName = useStore((state) => state.lastSuccessfulBackupFileName);
    const setLastSuccessfulBackupAt = useStore((state) => state.setLastSuccessfulBackupAt);
    const setLastSuccessfulBackupFileName = useStore((state) => state.setLastSuccessfulBackupFileName);
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);

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
            const result = await runExactLibraryBackup(useStore.getState());
            const backupFileName = result.archiveTitle;
            setLastSuccessfulBackupAt(Date.now());
            setLastSuccessfulBackupFileName(backupFileName);

            if (result.status === "incomplete") {
                const missingCritical = result.manifest.missing.filter((entry) => entry.critical);
                AppAlert.info(
                    "Backup saved, but incomplete",
                    `Saved ${backupFileName}, but ${missingCritical.length} recording${missingCritical.length === 1 ? "" : "s"} ` +
                        `could not be found and ${missingCritical.length === 1 ? "is" : "are"} missing from this backup. ` +
                        `Your audio storage may be damaged — check it and back up again.`
                );
                return false;
            }

            AppAlert.custom(
                "Backup ready",
                `Saved ${backupFileName} to the location you chose.`,
                [
                    {
                        label: "Copy Name",
                        style: "default",
                        icon: "copy-outline",
                        onPress: () => {
                            void Clipboard.setStringAsync(backupFileName);
                        },
                    },
                    { label: "OK", style: "default" },
                ]
            );
            return true;
        } catch (error) {
            if (error instanceof Error && error.message === BACKUP_SAVE_CANCELLED_MESSAGE) {
                return false;
            }

            const message =
                error instanceof Error ? error.message : "The library backup could not be completed.";
            AppAlert.info("Backup failed", message);
            return false;
        } finally {
            setIsBackingUp(false);
        }
    };

    const runRestore = async (archiveUri: string) => {
        setIsRestoring(true);
        try {
            const result = await restoreFromDisasterRecoveryBackup(archiveUri);
            const { ideas, workspaces } = result.counts;
            const summary =
                `${ideas} item${ideas === 1 ? "" : "s"} across ${workspaces} workspace${workspaces === 1 ? "" : "s"} restored.`;
            const missingNote =
                result.missing.length > 0
                    ? ` Note: ${result.missing.length} optional file${result.missing.length === 1 ? "" : "s"} from the ` +
                      `original backup ${result.missing.length === 1 ? "was" : "were"} not included.`
                    : "";
            AppAlert.info(
                "Restore complete — restart required",
                `${summary}${missingNote}\n\nFully close and reopen Song Seed to finish loading your restored library.`
            );
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "The backup could not be restored.";
            AppAlert.info("Restore failed", message);
        } finally {
            setIsRestoring(false);
        }
    };

    const handleRestore = async () => {
        if (isRestoring || isBackingUp) {
            return;
        }

        let picked: DocumentPicker.DocumentPickerResult;
        try {
            picked = await DocumentPicker.getDocumentAsync({
                type: ["application/zip", "application/x-zip-compressed", "*/*"],
                multiple: false,
                copyToCacheDirectory: true,
            });
        } catch {
            AppAlert.info("Restore failed", "Could not open the file picker.");
            return;
        }

        if (picked.canceled || picked.assets.length === 0) {
            return;
        }

        const asset = picked.assets[0]!;
        AppAlert.destructive(
            "Restore from backup?",
            "This replaces your entire current library with the contents of this backup. Anything not in the backup will be lost, and the app will need to restart afterward.",
            () => {
                void runRestore(asset.uri);
            },
            { confirmLabel: "Restore" }
        );
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
        isRestoring,
        handleRestore,
        copyLastBackupFileName: async () => {
            if (!lastSuccessfulBackupFileName) {
                return false;
            }

            await Clipboard.setStringAsync(lastSuccessfulBackupFileName);
            AppAlert.info("Copied", "Backup file name copied to clipboard.");
            return true;
        },
    };
}
