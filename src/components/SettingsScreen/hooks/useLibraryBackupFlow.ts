import { useMemo } from "react";
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
    buildExactLibraryBackup,
    discardBuiltLibraryBackup,
    saveBuiltLibraryBackup,
    type BuiltExactBackup,
} from "../../../services/libraryBackup";
import {
    DrRestoreIncompleteError,
    restoreFromDisasterRecoveryBackup,
} from "../../../services/disasterRecoveryRestore";
import { detectPickedArchiveKind } from "../../../services/archiveKind";
import {
    isBackupOperationCancelled,
    type BackupOperationProgress,
} from "../../../services/backupOperation";
import {
    estimateDisasterRecoveryBackup,
    type DrBackupMissingRecord,
} from "../../../services/disasterRecoveryBackup";
import {
    estimateLibraryOperationSeconds,
    formatDurationEstimate,
} from "../../../services/operationPacing";
import { formatBytes } from "../../../utils";
import { buildPersistedAppStoreSnapshot, useStore } from "../../../state/useStore";
import { formatProcessProgress, useProcessStore } from "../../../state/useProcessStore";
import type { BackupReminderFrequency, Workspace } from "../../../types";
import { haptic } from "../../../design/haptics";

const REMINDER_OPTIONS: BackupReminderFrequency[] = ["off", "weekly", "monthly", "quarterly"];

const MISSING_LIST_MAX = 6;

/**
 * Resolve the manifest's critical missing-file refs (`idea:<id>/clip:<id>[/stem:<id>]`,
 * `workspace:<id>`) to song/clip names so the incomplete-backup alert can say WHICH
 * recordings are gone, not just how many.
 */
function describeMissingRecordings(
    missing: DrBackupMissingRecord[],
    workspaces: Workspace[]
): string[] {
    const lines: string[] = [];
    for (const entry of missing) {
        if (!entry.critical) continue;

        const workspaceMatch = entry.ref.match(/^workspace:(.+)$/);
        if (workspaceMatch) {
            const workspace = workspaces.find((item) => item.id === workspaceMatch[1]);
            lines.push(`Archived workspace "${workspace?.title ?? workspaceMatch[1]}"`);
            continue;
        }

        const clipMatch = entry.ref.match(/^idea:([^/]+)\/clip:([^/]+?)(?:\/stem:.+)?$/);
        if (clipMatch) {
            let resolved: string | null = null;
            for (const workspace of workspaces) {
                const idea = workspace.ideas.find((item) => item.id === clipMatch[1]);
                if (!idea) continue;
                const clip = idea.clips.find((item) => item.id === clipMatch[2]);
                const clipLabel = clip?.title?.trim() ? ` · ${clip.title.trim()}` : "";
                const stemLabel = entry.ref.includes("/stem:") ? " (overdub layer)" : "";
                resolved = `"${idea.title}"${clipLabel}${stemLabel}`;
                break;
            }
            lines.push(resolved ?? entry.path.split("/").pop() ?? entry.path);
            continue;
        }

        lines.push(entry.path.split("/").pop() ?? entry.path);
    }
    return lines;
}

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

    const isBackingUp = activeProcess?.kind === "backup" && activeProcess.status === "running";
    const isRestoring = activeProcess?.kind === "restore" && activeProcess.status === "running";

    // Deliberately NO abort-on-unmount: the operation lives in the global process store
    // and must survive this screen unmounting; cancellation is owned by the process host.

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
        const processId = `backup-${Date.now()}`;
        const store = useProcessStore.getState();
        store.start({
            id: processId,
            kind: "backup",
            title: "Your library",
            onCancel: () => controller.abort(),
        });
        const operationOptions = {
            signal: controller.signal,
            onProgress: (progress: BackupOperationProgress) =>
                useProcessStore.getState().update(progress),
        };

        // Save the already-built archive, retrying if the user backs out of the location
        // picker — the expensive build is never repeated, and backing out prompts to save
        // again or explicitly discard instead of silently losing the backup.
        const attemptSave = async (
            built: BuiltExactBackup
        ): Promise<{ saved: true; saveConfirmed: boolean } | { saved: false }> => {
            try {
                const saved = await saveBuiltLibraryBackup(built, operationOptions);
                return { saved: true, saveConfirmed: saved.saveConfirmed };
            } catch (error) {
                if (isBackupOperationCancelled(error)) {
                    // Explicit Cancel — the built archive was already cleaned up by the save step.
                    await discardBuiltLibraryBackup(built.archiveUri).catch(() => {});
                    throw error;
                }
                if (error instanceof Error && error.message === BACKUP_SAVE_CANCELLED_MESSAGE) {
                    return await new Promise((resolve) => {
                        AppAlert.custom(
                            "Save this backup?",
                            `"${built.archiveTitle}" is built and ready, but hasn't been saved yet. ` +
                                "Choose where to save it, or discard it.",
                            [
                                {
                                    label: "Discard Backup",
                                    style: "destructive",
                                    onPress: () => {
                                        void discardBuiltLibraryBackup(built.archiveUri)
                                            .catch(() => {})
                                            .finally(() => resolve({ saved: false }));
                                    },
                                },
                                {
                                    label: "Choose Location",
                                    style: "default",
                                    icon: "folder-outline",
                                    onPress: () => {
                                        void attemptSave(built).then(resolve);
                                    },
                                },
                            ]
                        );
                    });
                }
                throw error;
            }
        };

        try {
            const built = await buildExactLibraryBackup(useStore.getState(), operationOptions);
            const backupFileName = built.archiveTitle;

            const outcome = await attemptSave(built);
            if (!outcome.saved) {
                useProcessStore.getState().dismiss(processId);
                return false;
            }

            if (built.status === "incomplete") {
                useProcessStore.getState().dismiss(processId);
                const missingCritical = built.manifest.missing.filter((entry) => entry.critical);
                const named = describeMissingRecordings(
                    built.manifest.missing,
                    useStore.getState().workspaces
                );
                const shown = named.slice(0, MISSING_LIST_MAX);
                const overflow = named.length - shown.length;
                const listBlock = shown.length
                    ? `\n\n${shown.map((line) => `• ${line}`).join("\n")}${overflow > 0 ? `\n• …and ${overflow} more` : ""}\n\n`
                    : " ";
                AppAlert.info(
                    "Backup saved, but incomplete",
                    `Saved ${backupFileName}, but ${missingCritical.length} recording${missingCritical.length === 1 ? "" : "s"} ` +
                        `${missingCritical.length === 1 ? "is" : "are"} missing from storage:` +
                        listBlock +
                        `Review in Library & Backups → Storage details, then back up again.`
                );
                return false;
            }

            const recordSuccessfulBackup = () => {
                haptic.success();
                setLastSuccessfulBackupAt(Date.now());
                setLastSuccessfulBackupFileName(backupFileName);
                // The alert is the single success surface — clear the process instead of
                // stacking a terminal takeover behind the dialog.
                useProcessStore.getState().dismiss(processId);
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

            if (!outcome.saveConfirmed) {
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

            const message =
                error instanceof Error ? error.message : "The library backup could not be completed.";
            useProcessStore.getState().setStatus("error", message);
            AppAlert.info("Backup failed", message);
            return false;
        }
    };

    const runRestore = async (
        archiveUri: string,
        mode: "replace" | "merge",
        allowIncomplete = false
    ) => {
        if (recorder.isRecording || recorder.isPaused) {
            AppAlert.info(
                "Finish recording first",
                "Save or discard the active recording before replacing the library from a backup."
            );
            return;
        }
        if (useProcessStore.getState().process?.status === "running") {
            return;
        }
        const controller = new AbortController();
        const processId = `restore-${Date.now()}`;
        useProcessStore.getState().start({
            id: processId,
            kind: "restore",
            title: mode === "merge" ? "Merging a backup" : "From a backup",
            onCancel: () => controller.abort(),
        });
        try {
            const result = await restoreFromDisasterRecoveryBackup(archiveUri, {
                signal: controller.signal,
                onProgress: (progress) => {
                    // The committing phase can't be cancelled — reflect that in the process.
                    if (progress.phase === "committing") useProcessStore.getState().setCanCancel(false);
                    useProcessStore.getState().update(progress);
                },
                displacedWorkspaces: useStore.getState().workspaces,
                mode,
                currentSnapshot:
                    mode === "merge"
                        ? buildPersistedAppStoreSnapshot(useStore.getState())
                        : undefined,
                allowIncomplete,
            });
            useProcessStore.getState().setStatus(
                "success",
                result.skipped.length > 0
                    ? `Restored without ${result.skipped.length} missing item${result.skipped.length === 1 ? "" : "s"}. Restarting…`
                    : "Restored. Restarting…"
            );
        } catch (error) {
            if (isBackupOperationCancelled(error)) {
                useProcessStore.getState().dismiss(processId);
                return;
            }
            if (error instanceof DrRestoreIncompleteError && !allowIncomplete) {
                // The backup itself recorded missing recordings. In a disaster this file may
                // be all the user has — offer to salvage everything else instead of a dead end.
                useProcessStore.getState().dismiss(processId);
                const count = error.missingCriticalCount;
                AppAlert.custom(
                    "Backup is incomplete",
                    `This backup recorded ${count} recording${count === 1 ? "" : "s"} as missing when it was created — ` +
                        `${count === 1 ? "it" : "they"} cannot be recovered from this file. ` +
                        `You can still restore everything else it contains.`,
                    [
                        { label: "Cancel", style: "cancel" },
                        {
                            label: "Restore Anyway",
                            style: "default",
                            icon: "medkit-outline",
                            description: `Restore the library without the ${count} missing recording${count === 1 ? "" : "s"}.`,
                            onPress: () => {
                                void runRestore(archiveUri, mode, true);
                            },
                        },
                    ]
                );
                return;
            }
            const message =
                error instanceof Error ? error.message : "The backup could not be restored.";
            useProcessStore.getState().setStatus("error", message);
            AppAlert.info("Restore failed", message);
        }
    };

    const handleRestore = async () => {
        // Generic single-slot guard (like backup/export): a running EXPORT must also block
        // a restore, or start() would clobber its process slot mid-operation.
        if (useProcessStore.getState().process?.status === "running") {
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
                "This file is a Song Seed Archive (an export for sharing), not a full backup. To bring it into your library, use Library & Backups → Import an archive."
            );
            return;
        }

        const sizeLine =
            typeof asset.size === "number" && asset.size > 0
                ? ` Restoring ${formatBytes(asset.size)} takes ${formatDurationEstimate(
                      estimateLibraryOperationSeconds("restore", asset.size)
                  )}.`
                : "";
        AppAlert.custom(
            "Restore from backup?",
            `How should this backup be restored? The app restarts afterward.${sizeLine}`,
            [
                { label: "Cancel", style: "cancel" },
                {
                    label: "Keep Newer Items",
                    style: "default",
                    icon: "git-merge-outline",
                    description:
                        "Merge: bring back everything in the backup while keeping songs, clips, and edits made since it was saved.",
                    onPress: () => {
                        void runRestore(asset.uri, "merge");
                    },
                },
                {
                    label: "Replace Everything",
                    style: "destructive",
                    icon: "swap-horizontal-outline",
                    description:
                        "The backup becomes your entire library. Anything not in it is removed (recordings are kept in the trash for 14 days).",
                    onPress: () => {
                        void runRestore(asset.uri, "replace");
                    },
                },
            ]
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
        backupProgressLabel: isBackingUp && activeProcess ? formatProcessProgress(activeProcess.progress) : null,
        handleBackupNow,
        isRestoring,
        restoreProgressLabel: isRestoring && activeProcess ? formatProcessProgress(activeProcess.progress) : null,
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
