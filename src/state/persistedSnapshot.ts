import { persistRawSnapshot } from "./db/storage";
import { isPersistBlocked } from "./persistRuntime";
import type { AppStore, PersistedAppStore } from "./storeTypes";

export const STORE_NAME = "song-seed-store";
export const STORE_VERSION = 11;

export function buildPersistedAppStoreSnapshot(state: AppStore): PersistedAppStore {
    return {
        workspaces: state.workspaces,
        activityEvents: state.activityEvents,
        activeWorkspaceId: state.activeWorkspaceId,
        primaryWorkspaceId: state.primaryWorkspaceId,
        primaryCollectionIdByWorkspace: state.primaryCollectionIdByWorkspace,
        lastUsedWorkspaceId: state.lastUsedWorkspaceId,
        workspaceStartupPreference: state.workspaceStartupPreference,
        workspaceListOrder: state.workspaceListOrder,
        workspaceLastOpenedAt: state.workspaceLastOpenedAt,
        collectionLastOpenedAt: state.collectionLastOpenedAt,
        playlists: state.playlists,
        songbooks: state.songbooks,
        setlists: state.setlists,
        preferredRecordingInputId: state.preferredRecordingInputId,
        bluetoothMonitoringCalibrations: state.bluetoothMonitoringCalibrations,
        metronomeBpm: state.metronomeBpm,
        metronomeMeterId: state.metronomeMeterId,
        metronomeOutputs: state.metronomeOutputs,
        metronomeBeepLevel: state.metronomeBeepLevel,
        metronomeHapticLevel: state.metronomeHapticLevel,
        metronomeCountInBars: state.metronomeCountInBars,
        globalCustomClipTags: state.globalCustomClipTags,
        backupReminderFrequency: state.backupReminderFrequency,
        lastSuccessfulBackupAt: state.lastSuccessfulBackupAt,
        lastSuccessfulBackupFileName: state.lastSuccessfulBackupFileName,
        notes: state.notes,
        wordLadders: state.wordLadders,
        cutUpSparks: state.cutUpSparks,
        ideasFilter: state.ideasFilter,
        ideasSort: state.ideasSort,
        primaryFilter: state.primaryFilter,
        primarySort: state.primarySort,
    };
}

export async function persistAppStoreSnapshot(state: AppStore): Promise<void> {
    if (isPersistBlocked()) return;
    const snapshot = buildPersistedAppStoreSnapshot(state);
    await persistRawSnapshot(STORE_NAME, JSON.stringify({ state: snapshot, version: STORE_VERSION }));
}
