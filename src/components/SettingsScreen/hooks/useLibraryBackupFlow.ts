import { useEffect, useMemo, useRef } from "react";
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
import { detectPickedArchiveKind } from "../../../services/archiveKind";
import {
    isBackupOperationCancelled,
    type BackupOperationProgress,
} from "../../../services/backupOperation";
import { estimateDisasterRecoveryBackup } from "../../../services/disasterRecoveryBackup";
import {
    estimateLibraryOperationSeconds,
    formatDurationEstimate,
} from "../../../services/operationPacing";
import { formatBytes } from "../../../utils";
import { useStore } from "../../../state/useStore";
import { useProcessStore } from "../../../state/useProcessStore";
import type { BackupReminderFrequency } from "../../../types";
import { haptic } from "../../../design/haptics";

const REMINDER_OPTIONS: BackupReminderFrequency[] = ["off", "weekly", "monthly", "quarterly"];

export function useLibraryBackupFlow() {
    const recorder = useSharedAudioRecorder();
    const backupReminderFrequency = useStore((state) => state.backupReminderFrequency);
    const setBackupReminderFrequency = useStore((state) => state.setBackupReminderFrequency);
    const lastSuccessfulBackupAt = useStore((state) => state.lastSuccessfulBackupAt);
    const lastSuccessfulBackupFileName = useStore((state) => state.lastSuccessfulBackupFileName);
    const setLastSuccessfulBackupAt = useStore((state) => state.setLastSuccessfulBackupAt);
    const setLastSuccessfulBackupFileName = useStore((state) => state.setLastSuccessfulBackupFileName);
    // The running operation lives in the global process store so it survives leaving
    // Settings and shows in the minimizable process host; this screen just reflects it.
    const activeProcess = useProcessStore((s) => s.process);
    const backupAbortRef = useRef<AbortController | null>(null);
    const restoreAbortRef = useRef<AbortController | null>(null);

    const isBackingUp = activeProcess?.kind === "backup" && activeProcess.status === "running";
    const isRestoring = activeProcess?.kind === "restore" && activeProcess.status === "running";

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
        if (useProcessStore.getState().process?.status === "running") {
            return false;
        }

        // Cheap size scan (no reads) so the user can decide with a real number in hand.
        let estimateLine: string | null = null;
        try {
            const estimate = await estimateDisasterRecoveryBackup(useStore.getState());
            if (estimate.fileCount > 0) {
                const duration = formatDurationEstimate(
                    estimateLibraryOperationSeconds("backup", estimate.totalBytes)
                );
                estimateLine = `${estimate.fileCount} recording${estimate.fileCount === 1 ? "" : "s"} · ${formatBytes(estimate.totalBytes)} · ${duration}`;
            }
        } catch {
            // Estimation is best-effort; the backup itself re-checks everything.
        }

        return await new Promise<boolean>((resolve) => {
            AppAlert.custom(
                "Back up your library?",
                `${estimateLine ? `${estimateLine}.\n\n` : ""}You can minimize the backup and keep using the app while it runs.`,
                [
                    { label: "Not Now", style: "cancel", onPress: () => resolve(false) },
                    {
                        label: "Back Up",
                        style: "default",
                        icon: "cloud-upload-outline",
                        onPress: () => {
                            void runBackup().then(resolve);
                        },
                    },
                ]
            );
        });
    };

    const runBackup = async () => {
        if (useProcessStore.getState().process?.status === "running") {
            return false;
        }

        const controller = new AbortController();
        backupAbortRef.current = controller;
        const processId = `backup-${Date.now()}`;
        const store = useProcessStore.getState();
        store.start({
            id: processId,
            kind: "backup",
            title: "Your library",
            onCancel: () => controller.abort(),
        });
        try {
            const result = await runExactLibraryBackup(useStore.getState(), {
                signal: controller.signal,
                onProgress: (progress) => useProcessStore.getState().update(progress),
            });
            const backupFileName = result.archiveTitle;

            if (result.status === "incomplete") {
                useProcessStore.getState().dismiss(processId);
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
                haptic.success();
                setLastSuccessfulBackupAt(Date.now());
                setLastSuccessfulBackupFileName(backupFileName);
                useProcessStore.getState().setStatus("success", `Saved ${backupFileName}`);
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
                // We can't confirm the share-sheet save, so don't flash "done" — clear the
                // process and let the confirm dialog record success if the user did save.
                useProcessStore.getState().dismiss(processId);
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
                useProcessStore.getState().dismiss(processId);
                return false;
            }
            if (error instanceof Error && error.message === BACKUP_SAVE_CANCELLED_MESSAGE) {
                useProcessStore.getState().dismiss(processId);
                return false;
            }

            const message =
                error instanceof Error ? error.message : "The library backup could not be completed.";
            useProcessStore.getState().setStatus("error", message);
            AppAlert.info("Backup failed", message);
            return false;
        } finally {
            if (backupAbortRef.current === controller) {
                backupAbortRef.current = null;
            }
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
        const processId = `restore-${Date.now()}`;
        useProcessStore.getState().start({
            id: processId,
            kind: "restore",
            title: "From a backup",
            onCancel: () => controller.abort(),
        });
        try {
            await restoreFromDisasterRecoveryBackup(archiveUri, {
                signal: controller.signal,
                onProgress: (progress) => {
                    // The committing phase can't be cancelled — reflect that in the process.
                    if (progress.phase === "committing") useProcessStore.getState().setCanCancel(false);
                    useProcessStore.getState().update(progress);
                },
                displacedWorkspaces: useStore.getState().workspaces,
            });
            useProcessStore.getState().setStatus("success", "Restored. Restarting…");
        } catch (error) {
            if (isBackupOperationCancelled(error)) {
                useProcessStore.getState().dismiss(processId);
                return;
            }
            const message =
                error instanceof Error ? error.message : "The backup could not be restored.";
            useProcessStore.getState().setStatus("error", message);
            AppAlert.info("Restore failed", message);
        } finally {
            if (restoreAbortRef.current === controller) {
                restoreAbortRef.current = null;
            }
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

        // A shareable Song Seed Archive is a different format and belongs in the Import flow.
        // Catch it before the destructive confirm so the user isn't told their backup is corrupt.
        if ((await detectPickedArchiveKind(asset.uri)) === "song-seed-archive") {
            AppAlert.info(
                "That's a shareable archive",
                "This file is a Song Seed Archive (an export for sharing or merging), not a full backup. To bring it into your library, use Settings → Import Song Seed Archive."
            );
            return;
        }

        const sizeLine =
            typeof asset.size === "number" && asset.size > 0
                ? ` Restoring ${formatBytes(asset.size)} takes ${formatDurationEstimate(
                      estimateLibraryOperationSeconds("restore", asset.size)
                  )}.`
                : "";
        AppAlert.destructive(
            "Restore from backup?",
            "This replaces your entire current library with the contents of this backup. Anything not in the backup will be lost, and the app will need to restart afterward." +
                sizeLine,
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
        backupProgressLabel: isBackingUp && activeProcess ? formatOperationProgress(activeProcess.progress) : null,
        handleBackupNow,
        cancelBackup: () => backupAbortRef.current?.abort(),
        isRestoring,
        restoreProgressLabel: isRestoring && activeProcess ? formatOperationProgress(activeProcess.progress) : null,
        canCancelRestore: isRestoring && !!activeProcess?.canCancel,
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
