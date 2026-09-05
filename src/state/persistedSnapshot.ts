import { persistRawSnapshot } from "./db/storage";
import {
    isHydrationReadAuthoritative,
    isPersistBlocked,
    setHydrationReadOutcome,
} from "./persistRuntime";
import type { AppStore, PersistedAppStore } from "./storeTypes";

export const STORE_NAME = "songnook-store";
export const STORE_VERSION = 12;

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
        metronomeGroupingByMeterId: state.metronomeGroupingByMeterId,
        metronomeOutputs: state.metronomeOutputs,
        metronomeBeepLevel: state.metronomeBeepLevel,
        playbackClickLevel: state.playbackClickLevel,
        metronomeHapticLevel: state.metronomeHapticLevel,
        metronomeCountInBars: state.metronomeCountInBars,
        metronomeSubdivision: state.metronomeSubdivision,
        metronomeClickVoice: state.metronomeClickVoice,
        playbackClickHaptic: state.playbackClickHaptic,
        globalCustomClipTags: state.globalCustomClipTags,
        backupReminderFrequency: state.backupReminderFrequency,
        hapticsEnabled: state.hapticsEnabled,
        promptForClipName: state.promptForClipName,
        nameLanguage: state.nameLanguage,
        hasSeenWelcome: state.hasSeenWelcome,
        seenHints: state.seenHints,
        firstLaunchAt: state.firstLaunchAt,
        reviewPromptShownAt: state.reviewPromptShownAt,
        lastSuccessfulBackupAt: state.lastSuccessfulBackupAt,
        lastSuccessfulBackupFileName: state.lastSuccessfulBackupFileName,
        notes: state.notes,
        wordLadders: state.wordLadders,
        cutUpSparks: state.cutUpSparks,
        magpieSparks: state.magpieSparks,
        ideasFilter: state.ideasFilter,
        ideasSort: state.ideasSort,
        primaryFilter: state.primaryFilter,
        primarySort: state.primarySort,
    };
}

/**
 * Thrown when a requested snapshot write was refused by a safety gate (persist lock or
 * missing hydration authority). Callers that flush BECAUSE they need durability before a
 * destructive follow-up (trashing audio, reporting success) must treat this as "not
 * durable" and skip the follow-up — a resolved skip used to let media get trashed while
 * metadata was frozen (2026-08-26 audit F3).
 */
export class PersistSkippedError extends Error {
    constructor(reason: string) {
        super(`snapshot write skipped: ${reason}`);
        this.name = "PersistSkippedError";
    }
}

export async function persistAppStoreSnapshot(state: AppStore): Promise<void> {
    if (isPersistBlocked()) throw new PersistSkippedError("persist is blocked");
    // Raw writes bypass the sharded adapter's write-authority gate — apply the same
    // rule here: state not derived from a successful disk read must never land.
    if (!isHydrationReadAuthoritative()) {
        console.warn("[PersistAuthority] skipped raw snapshot write — hydration never read the disk");
        throw new PersistSkippedError("hydration never read the disk");
    }
    const snapshot = buildPersistedAppStoreSnapshot(state);
    await persistRawSnapshot(STORE_NAME, JSON.stringify({ state: snapshot, version: STORE_VERSION }));
}

/**
 * Restore-only: commit a snapshot the user explicitly chose to restore (disaster-recovery
 * prompt). Deliberately skips the persist lock and the hydration-authority check — the
 * restored snapshot IS the new authoritative disk state, and committing it re-arms the
 * write-authority gate for the rest of the session.
 */
export async function persistRestoredAppStoreSnapshot(state: AppStore): Promise<void> {
    const snapshot = buildPersistedAppStoreSnapshot(state);
    await persistRawSnapshot(STORE_NAME, JSON.stringify({ state: snapshot, version: STORE_VERSION }));
    setHydrationReadOutcome("data");
}
