import { create } from "zustand";
import { haptic } from "../design/haptics";
import { isAutomaticBackupDue, isAutomaticBackupOn, type AutomaticBackupError } from "../domain/automaticBackupPrefs";
import { useStore } from "../state/useStore";
import { useProcessStore } from "../state/useProcessStore";
import { useImportStore } from "../state/useImportStore";
import { useSendJobStore } from "../state/useSendJobStore";
import { isPersistBlocked } from "../state/persistRuntime";
import { getRestoreRestartState } from "../state/restoreRuntime";
import { isBackupOperationCancelled } from "./backupOperation";
import { waitForIdleInteractions } from "./interactionGate";
import { claimLibraryOperation, runningLibraryOperation } from "./libraryOperationGate";
import { AutoBackupError, runFolderBackup } from "./automaticBackup";
import { isBackupFolderAvailable } from "../../modules/songnook-file-io";

/** Whether a run is in flight right now (not persisted; drives the status line). */
export const useAutomaticBackupRunStore = create<{ running: boolean }>(() => ({ running: false }));

let controller: AbortController | null = null;

/** Recording (or a recorder armed for a take or a layer) owns the phone's attention. */
function isRecordingContextOpen() {
    return useStore.getState().recordingIdeaId != null;
}

/**
 * Anything heavy already running, or the library mid-restore: an automatic run waits.
 * The library operation gate answers for import, restore, archive, unarchive, recover
 * and backup; export shares the process slot; clip imports and Send have their own.
 */
export function automaticBackupBlockedReason(): string | null {
    if (!isBackupFolderAvailable()) return "unavailable";
    if (isRecordingContextOpen()) return "recording";
    if (runningLibraryOperation()) return "process";
    if (useProcessStore.getState().process?.status === "running") return "process";
    if (useImportStore.getState().jobs.some((job) => job.status === "running")) return "import";
    if (useSendJobStore.getState().job?.status === "running") return "send";
    if (isPersistBlocked() || getRestoreRestartState()) return "restore";
    return null;
}

function errorCode(error: unknown): AutomaticBackupError {
    if (error instanceof AutoBackupError) return error.code;
    const message = error instanceof Error ? error.message : "";
    if (/enospc|no space left/i.test(message)) return "lowSpace";
    return "failed";
}

/**
 * One automatic run. `userStarted` when the person just turned it on or changed the
 * folder: then success and failure are felt (haptics); a background run is silent and
 * shows only on the status line in Settings.
 */
export async function runAutomaticBackupNow({ userStarted = false }: { userStarted?: boolean } = {}) {
    const prefs = useStore.getState().automaticBackup;
    if (!isAutomaticBackupOn(prefs) || useAutomaticBackupRunStore.getState().running) return;
    if (automaticBackupBlockedReason()) return;

    const own = new AbortController();
    // The run holds the one heavy-operation slot, but steps aside: a take, or an
    // operation the person starts, stops it instead of being refused.
    let release: () => void;
    try {
        release = claimLibraryOperation("backup", { stepAside: () => own.abort() });
    } catch {
        return;
    }
    controller = own;
    useAutomaticBackupRunStore.setState({ running: true });
    const startedAt = Date.now();
    try {
        const result = await runFolderBackup(useStore.getState(), prefs.folder!.handle, {
            signal: own.signal,
            betweenFiles: async () => {
                // Never compete with a take: a recorder opening mid-run stops the run
                // (harmless: the next one continues where this left off).
                if (isRecordingContextOpen()) own.abort();
                await waitForIdleInteractions();
            },
        });
        const complete = result.status === "complete";
        useStore.getState().updateAutomaticBackup({
            lastAttemptAt: startedAt,
            ...(complete ? { lastCompletedAt: startedAt, lastError: null } : { lastError: "incomplete" }),
        });
        if (userStarted) {
            if (complete) haptic.success();
            else haptic.error();
        }
    } catch (error) {
        if (isBackupOperationCancelled(error) || own.signal.aborted) return;
        console.warn("[AutoBackup] run failed", error);
        useStore.getState().updateAutomaticBackup({ lastAttemptAt: startedAt, lastError: errorCode(error) });
        if (userStarted) haptic.error();
    } finally {
        release();
        if (controller === own) controller = null;
        useAutomaticBackupRunStore.setState({ running: false });
    }
}

/** Stop a run in flight (a restore or the person turning it off). */
export function cancelAutomaticBackup() {
    controller?.abort();
}

/** The scheduler's check: due, nothing heavy running, the app idle. */
export async function runAutomaticBackupIfDue(now = Date.now()) {
    if (!isAutomaticBackupDue(useStore.getState().automaticBackup, now)) return;
    await waitForIdleInteractions();
    await runAutomaticBackupNow();
}
