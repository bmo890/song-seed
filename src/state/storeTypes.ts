import type { DataSlice } from "./dataSlice";
import type { PlayerSlice } from "./playerSlice";
import type { RecordingSlice } from "./recordingSlice";
import type { SelectionSlice } from "./selectionSlice";

export type AppStore = DataSlice & SelectionSlice & RecordingSlice & PlayerSlice;

export type PersistedAppStore = Pick<
    AppStore,
    | "workspaces"
    | "activityEvents"
    | "activeWorkspaceId"
    | "primaryWorkspaceId"
    | "primaryCollectionIdByWorkspace"
    | "lastUsedWorkspaceId"
    | "workspaceStartupPreference"
    | "workspaceListOrder"
    | "workspaceLastOpenedAt"
    | "collectionLastOpenedAt"
    | "playlists"
    | "songbooks"
    | "setlists"
    | "preferredRecordingInputId"
    | "bluetoothMonitoringCalibrations"
    | "metronomeBpm"
    | "metronomeMeterId"
    | "metronomeOutputs"
    | "metronomeBeepLevel"
    | "metronomeHapticLevel"
    | "metronomeCountInBars"
    | "globalCustomClipTags"
    | "backupReminderFrequency"
    | "hapticsEnabled"
    | "lastSuccessfulBackupAt"
    | "lastSuccessfulBackupFileName"
    | "notes"
    | "wordLadders"
    | "cutUpSparks"
    | "ideasFilter"
    | "ideasSort"
    | "primaryFilter"
    | "primarySort"
>;
