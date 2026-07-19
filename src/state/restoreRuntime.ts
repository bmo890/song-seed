import type { DrBackupManifest } from "../services/disasterRecoveryBackup";

export type RestoreRestartState = {
    counts: DrBackupManifest["counts"];
    missingCount: number;
    reloadStatus: "pending" | "reloading" | "failed";
    reloadError: string | null;
};

type Listener = () => void;

let state: RestoreRestartState | null = null;
const listeners = new Set<Listener>();

function publish(next: RestoreRestartState | null) {
    state = next;
    listeners.forEach((listener) => listener());
}

export function requireRestoreRestart(
    counts: DrBackupManifest["counts"],
    missingCount: number
) {
    publish({
        counts,
        missingCount,
        reloadStatus: "pending",
        reloadError: null,
    });
}

export function markRestoreReloading() {
    if (!state) return;
    publish({ ...state, reloadStatus: "reloading", reloadError: null });
}

export function markRestoreReloadFailed(error: unknown) {
    if (!state) return;
    publish({
        ...state,
        reloadStatus: "failed",
        reloadError: error instanceof Error ? error.message : "SongNook could not restart automatically.",
    });
}

export function getRestoreRestartState() {
    return state;
}

export function subscribeRestoreRestart(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function resetRestoreRuntimeForTests() {
    publish(null);
}
