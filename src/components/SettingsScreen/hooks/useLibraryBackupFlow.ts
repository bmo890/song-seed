import { useEffect, useMemo, useRef, useState } from "react";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import { useSharedAudioRecorder } from "@siteed/audio-studio";
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
import {
    isBackupOperationCancelled,
    type BackupOperationProgress,
} from "../../../services/backupOperation";
import { useStore } from "../../../state/useStore";
import type { BackupReminderFrequency } from "../../../types";

const REMINDER_OPTIONS: BackupReminderFrequency[] = ["off", "weekly", "monthly", "quarterly"];

export function useLibraryBackupFlow() {
    const recorder = useSharedAudioRecorder();
    const backupReminderFrequency = useStore((state) => state.backupReminderFrequency);
    const setBackupReminderFrequency = useStore((state) => state.setBackupReminderFrequency);
    const lastSuccessfulBackupAt = useStore((state) => state.lastSuccessfulBackupAt);
    const lastSuccessfulBackupFileName = useStore((state) => state.lastSuccessfulBackupFileName);
    const setLastSuccessfulBackupAt = useStore((state) => state.setLastSuccessfulBackupAt);
    const setLastSuccessfulBackupFileName = useStore((state) => state.setLastSuccessfulBackupFileName);
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [backupProgress, setBackupProgress] = useState<BackupOperationProgress | null>(null);
    const [restoreProgress, setRestoreProgress] = useState<BackupOperationProgress | null>(null);
    const backupAbortRef = useRef<AbortController | null>(null);
    const restoreAbortRef = useRef<AbortController | null>(null);

    useEffect(
        () => () => {
            backupAbortRef.current?.abort();
            restoreAbortRef.current?.abort();
        },
        []
    );

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

        const controller = new AbortController();
        backupAbortRef.current = controller;
        setIsBackingUp(true);
        setBackupProgress({
            phase: "preparing",
            completedBytes: 0,
            totalBytes: 0,
            message: "Preparing library backup",
        });
        try {
            const result = await runExactLibraryBackup(useStore.getState(), {
                signal: controller.signal,
                onProgress: setBackupProgress,
            });
            const backupFileName = result.archiveTitle;

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

            const recordSuccessfulBackup = () => {
                setLastSuccessfulBackupAt(Date.now());
                setLastSuccessfulBackupFileName(backupFileName);
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
            };

            if (!result.saveConfirmed) {
                AppAlert.custom(
                    "Confirm backup saved",
                    "The system share sheet cannot tell Song Seed whether you completed Save to Files. " +
                        "Only confirm if the backup now appears in Files, iCloud Drive, or another location.",
                    [
                        { label: "Not Saved", style: "cancel" },
                        {
                            label: "I Saved It",
                            style: "default",
                            onPress: recordSuccessfulBackup,
                        },
                    ]
                );
                return false;
            }

            recordSuccessfulBackup();
            return true;
        } catch (error) {
            if (isBackupOperationCancelled(error)) {
                return false;
            }
            if (error instanceof Error && error.message === BACKUP_SAVE_CANCELLED_MESSAGE) {
                return false;
            }

            const message =
                error instanceof Error ? error.message : "The library backup could not be completed.";
            AppAlert.info("Backup failed", message);
            return false;
        } finally {
            if (backupAbortRef.current === controller) {
                backupAbortRef.current = null;
            }
            setIsBackingUp(false);
            setBackupProgress(null);
        }
    };

    const runRestore = async (archiveUri: string) => {
        if (recorder.isRecording || recorder.isPaused) {
            AppAlert.info(
                "Finish recording first",
                "Save or discard the active recording before replacing the library from a backup."
            );
            return;
        }
        const controller = new AbortController();
        restoreAbortRef.current = controller;
        setIsRestoring(true);
        setRestoreProgress({
            phase: "inspecting",
            completedBytes: 0,
            totalBytes: 0,
            message: "Inspecting backup",
        });
        try {
            await restoreFromDisasterRecoveryBackup(archiveUri, {
                signal: controller.signal,
                onProgress: setRestoreProgress,
                displacedWorkspaces: useStore.getState().workspaces,
            });
        } catch (error) {
            if (isBackupOperationCancelled(error)) {
                return;
            }
            const message =
                error instanceof Error ? error.message : "The backup could not be restored.";
            AppAlert.info("Restore failed", message);
        } finally {
            if (restoreAbortRef.current === controller) {
                restoreAbortRef.current = null;
            }
            setIsRestoring(false);
            setRestoreProgress(null);
        }
    };

    const handleRestore = async () => {
        if (isRestoring || isBackingUp) {
            return;
        }
        if (recorder.isRecording || recorder.isPaused) {
            AppAlert.info(
                "Finish recording first",
                "Save or discard the active recording before replacing the library from a backup."
            );
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
        backupProgressLabel: formatOperationProgress(backupProgress),
        handleBackupNow,
        cancelBackup: () => backupAbortRef.current?.abort(),
        isRestoring,
        restoreProgressLabel: formatOperationProgress(restoreProgress),
        canCancelRestore: isRestoring && restoreProgress?.phase !== "committing",
        handleRestore,
        cancelRestore: () => restoreAbortRef.current?.abort(),
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

function formatOperationProgress(progress: BackupOperationProgress | null) {
    if (!progress) return null;
    if (progress.totalBytes <= 0) return progress.message;
    const percent = Math.min(
        100,
        Math.max(0, Math.round((progress.completedBytes / progress.totalBytes) * 100))
    );
    return `${progress.message} · ${percent}%`;
}
