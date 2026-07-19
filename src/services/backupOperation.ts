import * as FileSystem from "expo-file-system/legacy";

export const BACKUP_OPERATION_CANCELLED_MESSAGE = "Backup operation was cancelled.";

export type BackupOperationPhase =
    | "preparing"
    | "hashing"
    | "packaging"
    | "saving"
    | "inspecting"
    | "verifying"
    | "restoring"
    | "committing";

export type BackupOperationProgress = {
    phase: BackupOperationPhase;
    completedBytes: number;
    totalBytes: number;
    message: string;
};

export type BackupOperationOptions = {
    signal?: AbortSignal;
    onProgress?: (progress: BackupOperationProgress) => void;
};

export class BackupOperationCancelledError extends Error {
    constructor() {
        super(BACKUP_OPERATION_CANCELLED_MESSAGE);
        this.name = "BackupOperationCancelledError";
    }
}

export function throwIfBackupCancelled(signal?: AbortSignal) {
    if (signal?.aborted) {
        throw new BackupOperationCancelledError();
    }
}

export function isBackupOperationCancelled(error: unknown) {
    return (
        error instanceof BackupOperationCancelledError ||
        (error instanceof Error && error.message === BACKUP_OPERATION_CANCELLED_MESSAGE)
    );
}

export function reportBackupProgress(
    options: BackupOperationOptions | undefined,
    progress: BackupOperationProgress
) {
    options?.onProgress?.({
        ...progress,
        completedBytes: Math.max(0, Math.min(progress.completedBytes, progress.totalBytes)),
        totalBytes: Math.max(0, progress.totalBytes),
    });
}

export async function yieldToBackupUi(signal?: AbortSignal) {
    throwIfBackupCancelled(signal);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    throwIfBackupCancelled(signal);
}

const MIN_FREE_SPACE_RESERVE_BYTES = 64 * 1024 * 1024;

export async function ensureBackupDiskSpace(requiredBytes: number, operationLabel: string) {
    if (!Number.isFinite(requiredBytes) || requiredBytes < 0) {
        throw new Error(`Could not calculate storage required to ${operationLabel}.`);
    }

    const availableBytes = await FileSystem.getFreeDiskStorageAsync();
    if (!Number.isFinite(availableBytes) || availableBytes < 0) {
        throw new Error(`Could not determine free device storage to ${operationLabel}.`);
    }
    const reserveBytes = Math.max(
        MIN_FREE_SPACE_RESERVE_BYTES,
        Math.ceil(requiredBytes * 0.1)
    );
    const totalRequiredBytes = requiredBytes + reserveBytes;

    if (availableBytes < totalRequiredBytes) {
        const requiredMb = Math.ceil(totalRequiredBytes / (1024 * 1024));
        const availableMb = Math.floor(availableBytes / (1024 * 1024));
        throw new Error(
            `Not enough free device storage to ${operationLabel}. ` +
                `SongNook needs about ${requiredMb} MB available, but only ${availableMb} MB is free.`
        );
    }
}
