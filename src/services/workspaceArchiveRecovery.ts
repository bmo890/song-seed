import * as FileSystem from "expo-file-system/legacy";
import { buildPersistedAppStoreSnapshot, useStore } from "../state/useStore";
import { forceManifestWrite } from "./manifestSync";
import { deleteManagedArchiveUri, deleteManagedAudioUris } from "./managedMedia";
import { restoreWorkspaceFromDevice } from "./workspaceArchive";
import { SONG_SEED_ROOT } from "./storagePaths";

const WORKSPACE_ARCHIVE_RECOVERY_PATH = `${SONG_SEED_ROOT}/workspace-archive-ops.json`;

type PendingWorkspaceArchiveOperation =
    | {
          kind: "archive-cleanup";
          workspaceId: string;
          archiveUri: string;
          originalAudioUris: string[];
          createdAt: number;
      }
    | {
          kind: "unarchive-restore";
          workspaceId: string;
          archiveUri: string;
          createdAt: number;
      }
    | {
          kind: "unarchive-cleanup";
          workspaceId: string;
          archiveUri: string;
          createdAt: number;
      };

async function readPendingWorkspaceArchiveOperations() {
    try {
        const info = await FileSystem.getInfoAsync(WORKSPACE_ARCHIVE_RECOVERY_PATH);
        if (!info.exists) {
            return [] as PendingWorkspaceArchiveOperation[];
        }
        const raw = await FileSystem.readAsStringAsync(WORKSPACE_ARCHIVE_RECOVERY_PATH);
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as PendingWorkspaceArchiveOperation[]) : [];
    } catch {
        return [] as PendingWorkspaceArchiveOperation[];
    }
}

async function writePendingWorkspaceArchiveOperations(
    operations: PendingWorkspaceArchiveOperation[]
) {
    const rootInfo = await FileSystem.getInfoAsync(SONG_SEED_ROOT);
    if (!rootInfo.exists) {
        await FileSystem.makeDirectoryAsync(SONG_SEED_ROOT, { intermediates: true });
    }

    if (operations.length === 0) {
        await FileSystem.deleteAsync(WORKSPACE_ARCHIVE_RECOVERY_PATH, { idempotent: true });
        return;
    }

    await FileSystem.writeAsStringAsync(
        WORKSPACE_ARCHIVE_RECOVERY_PATH,
        JSON.stringify(operations)
    );
}

export async function upsertPendingWorkspaceArchiveOperation(
    operation: PendingWorkspaceArchiveOperation
) {
    const existing = await readPendingWorkspaceArchiveOperations();
    const next = existing.filter((candidate) => candidate.workspaceId !== operation.workspaceId);
    next.push(operation);
    await writePendingWorkspaceArchiveOperations(next);
}

export async function clearPendingWorkspaceArchiveOperation(workspaceId: string) {
    const existing = await readPendingWorkspaceArchiveOperations();
    const next = existing.filter((candidate) => candidate.workspaceId !== workspaceId);
    await writePendingWorkspaceArchiveOperations(next);
}

export async function resumePendingWorkspaceArchiveOperations() {
    const operations = await readPendingWorkspaceArchiveOperations();

    for (const operation of operations) {
        try {
            if (operation.kind === "archive-cleanup") {
                const workspace = useStore
                    .getState()
                    .workspaces.find((candidate) => candidate.id === operation.workspaceId);
                if (workspace?.isArchived) {
                    await deleteManagedAudioUris(operation.originalAudioUris);
                }
                await clearPendingWorkspaceArchiveOperation(operation.workspaceId);
                continue;
            }

            if (operation.kind === "unarchive-cleanup") {
                const workspace = useStore
                    .getState()
                    .workspaces.find((candidate) => candidate.id === operation.workspaceId);
                if (!workspace || !workspace.isArchived) {
                    await deleteManagedArchiveUri(operation.archiveUri);
                }
                await clearPendingWorkspaceArchiveOperation(operation.workspaceId);
                continue;
            }

            const workspace = useStore
                .getState()
                .workspaces.find((candidate) => candidate.id === operation.workspaceId);
            if (!workspace || !workspace.isArchived) {
                await clearPendingWorkspaceArchiveOperation(operation.workspaceId);
                continue;
            }

            const result = await restoreWorkspaceFromDevice(workspace);
            useStore.setState((store) => ({
                workspaces: store.workspaces.map((candidate) =>
                    candidate.id === workspace.id ? result.restoredWorkspace : candidate
                ),
                activeWorkspaceId: store.activeWorkspaceId ?? workspace.id,
            }));
            await forceManifestWrite(buildPersistedAppStoreSnapshot(useStore.getState()));
            await upsertPendingWorkspaceArchiveOperation({
                kind: "unarchive-cleanup",
                workspaceId: workspace.id,
                archiveUri: operation.archiveUri,
                createdAt: Date.now(),
            });
            await deleteManagedArchiveUri(operation.archiveUri);
            await clearPendingWorkspaceArchiveOperation(operation.workspaceId);
        } catch (error) {
            console.warn(
                "[WorkspaceArchiveRecovery] Failed to resume pending archive operation",
                operation,
                error
            );
        }
    }
}
