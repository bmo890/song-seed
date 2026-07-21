import { useMemo } from "react";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import { useSharedAudioRecorder } from "@siteed/audio-studio";
import { AppAlert } from "../../common/AppAlert";
import {
    formatBackupTimestamp,
    getBackupReminderDescription,
    getBackupReminderLabel,
} from "../../../domain/backupPreferences";
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
import { toast } from "../../common/toastStore";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

const REMINDER_OPTIONS: BackupReminderFrequency[] = ["off", "weekly", "monthly", "quarterly"];

const MISSING_LIST_MAX = 6;

/**
 * Resolve the manifest's critical missing-file refs (`idea:<id>/clip:<id>[/stem:<id>]`,
 * `workspace:<id>`) to song/clip names so the incomplete-backup alert can say WHICH
 * recordings are gone, not just how many.
 */
function describeMissingRecordings(
    missing: DrBackupMissingRecord[],
    workspaces: Workspace[],
    t: TFunction
): string[] {
    const lines: string[] = [];
    for (const entry of missing) {
        if (!entry.critical) continue;

        const workspaceMatch = entry.ref.match(/^workspace:(.+)$/);
        if (workspaceMatch) {
            const workspace = workspaces.find((item) => item.id === workspaceMatch[1]);
            lines.push(t("settingsBackup.archivedWorkspace", { title: workspace?.title ?? workspaceMatch[1] }));
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
                const stemLabel = entry.ref.includes("/stem:") ? t("settingsBackup.overdubLayer") : "";
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
    const { t } = useTranslation();
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
                estimateLine = t("settingsBackup.estimate", { count: estimate.fileCount, size: formatBytes(estimate.totalBytes), duration });
            }
        } catch {
            // Estimation is best-effort; the backup itself re-checks everything.
        }

        return await new Promise<boolean>((resolve) => {
            AppAlert.custom(
                t("settingsBackup.confirmTitle"),
                t("settingsBackup.confirmBody", { estimate: estimateLine ? `${estimateLine}.\n\n` : "" }),
                [
                    { label: t("settingsBackup.notNow"), style: "cancel", onPress: () => resolve(false) },
                    {
                        label: t("settingsBackup.backUp"),
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
            title: t("settingsBackup.yourLibrary"),
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
                            t("settingsBackup.saveTitle"),
                            t("settingsBackup.saveBody", { title: built.archiveTitle }),
                            [
                                {
                                    label: t("settingsBackup.discard"),
                                    style: "destructive",
                                    onPress: () => {
                                        void discardBuiltLibraryBackup(built.archiveUri)
                                            .catch(() => {})
                                            .finally(() => resolve({ saved: false }));
                                    },
                                },
                                {
                                    label: t("settingsBackup.chooseLocation"),
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
                    useStore.getState().workspaces,
                    t
                );
                const shown = named.slice(0, MISSING_LIST_MAX);
                const overflow = named.length - shown.length;
                const listBlock = shown.length
                    ? `\n\n${shown.map((line) => `• ${line}`).join("\n")}${overflow > 0 ? `\n• ${t("settingsBackup.moreMissing", { count: overflow })}` : ""}\n\n`
                    : " ";
                AppAlert.info(
                    t("settingsBackup.incompleteTitle"),
                    t("settingsBackup.incompleteBody", { name: backupFileName, count: missingCritical.length, list: listBlock })
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
                    t("settingsBackup.ready"),
                    t("settingsBackup.readyBody", { name: backupFileName }),
                    [
                        {
                            label: t("settingsBackup.copyName"),
                            style: "default",
                            icon: "copy-outline",
                            onPress: () => {
                                void Clipboard.setStringAsync(backupFileName);
                            },
                        },
                        { label: t("common.done"), style: "default" },
                    ]
                );
            };

            if (!outcome.saveConfirmed) {
                // We can't confirm the share-sheet save, so don't flash "done" — clear the
                // process and let the confirm dialog record success if the user did save.
                useProcessStore.getState().dismiss(processId);
                AppAlert.custom(
                    t("settingsBackup.confirmSaved"),
                    t("settingsBackup.confirmSavedBody"),
                    [
                        { label: t("settingsBackup.notSaved"), style: "cancel" },
                        {
                            label: t("settingsBackup.savedIt"),
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

            // Keep the raw error in the diagnostic log. Our own guards (e.g.
            // ensureBackupDiskSpace) already throw clear, specific messages — including the
            // exact free-space figures — so show the message as-is; only the cryptic
            // low-level out-of-space string gets rewritten to friendly copy.
            console.warn("[backup] failed", error);
            const raw = error instanceof Error ? error.message : "";
            const message = /enospc|no space left on device/i.test(raw)
                ? t("settingsBackup.lowStorage")
                : raw || t("settingsBackup.failedBody");
            useProcessStore.getState().setStatus("error", message);
            AppAlert.info(t("settingsBackup.failed"), message);
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
                t("settingsBackup.finishRecording"),
                t("settingsBackup.finishRecordingBody")
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
            title: mode === "merge" ? t("settingsBackup.merging") : t("settingsBackup.fromBackup"),
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
                    ? t("settingsBackup.restoredMissing", { count: result.skipped.length })
                    : t("settingsBackup.restored")
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
                    t("settingsBackup.incompleteRestore"),
                    t("settingsBackup.incompleteRestoreBody", { count }),
                    [
                        { label: t("common.cancel"), style: "cancel" },
                        {
                            label: t("settingsBackup.restoreAnyway"),
                            style: "default",
                            icon: "medkit-outline",
                            description: t("settingsBackup.restoreAnywayDesc", { count }),
                            onPress: () => {
                                void runRestore(archiveUri, mode, true);
                            },
                        },
                    ]
                );
                return;
            }
            const message =
                error instanceof Error ? error.message : t("settingsBackup.restoreFailedBody");
            useProcessStore.getState().setStatus("error", message);
            AppAlert.info(t("settingsBackup.restoreFailed"), message);
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
                t("settingsBackup.finishRecording"),
                t("settingsBackup.finishRecordingBody")
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
            AppAlert.info(t("settingsBackup.restoreFailed"), t("settingsBackup.pickerFailed"));
            return;
        }

        if (picked.canceled || picked.assets.length === 0) {
            return;
        }

        const asset = picked.assets[0]!;

        // A shareable SongNook Archive is a different format and belongs in the Import flow.
        // Catch it before the destructive confirm so the user isn't told their backup is corrupt.
        if ((await detectPickedArchiveKind(asset.uri)) === "songnook-archive") {
            AppAlert.info(
                t("settingsBackup.shareArchiveTitle"),
                t("settingsBackup.shareArchiveBody")
            );
            return;
        }

        const sizeLine =
            typeof asset.size === "number" && asset.size > 0
                ? t("settingsBackup.restoreSize", { size: formatBytes(asset.size), duration: formatDurationEstimate(estimateLibraryOperationSeconds("restore", asset.size)) })
                : "";
        AppAlert.custom(
            t("settingsBackup.restoreTitle"),
            t("settingsBackup.restoreBody", { size: sizeLine }),
            [
                { label: t("common.cancel"), style: "cancel" },
                {
                    label: t("settingsBackup.keepNewer"),
                    style: "default",
                    icon: "git-merge-outline",
                    description: t("settingsBackup.keepNewerDesc"),
                    onPress: () => {
                        void runRestore(asset.uri, "merge");
                    },
                },
                {
                    label: t("settingsBackup.replaceEverything"),
                    style: "destructive",
                    icon: "swap-horizontal-outline",
                    description: t("settingsBackup.replaceDesc"),
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
            toast(t("settingsBackup.copied"), "copy-outline");
            return true;
        },
    };
}
