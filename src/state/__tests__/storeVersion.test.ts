jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-audio", () => ({ createAudioPlayer: jest.fn(), setAudioModeAsync: jest.fn() }));
jest.mock("expo-document-picker", () => ({}));
jest.mock("expo-file-system/legacy", () => ({ documentDirectory: "file:///docs/", cacheDirectory: "file:///cache/" }));
jest.mock("expo-file-system", () => ({ documentDirectory: "file:///docs/", cacheDirectory: "file:///cache/" }));
jest.mock("expo-sharing", () => ({}));
jest.mock("expo-haptics", () => ({}));
jest.mock("../../services/waveformAnalysis", () => ({}));
jest.mock("../../services/audioStorage", () => ({}));
jest.mock("../../services/manifestSync", () => ({ startManifestSync: jest.fn() }));
jest.mock("../shardedPersistStorage", () => ({
    createShardedPersistStorage: () => ({
        getItem: () => null,
        setItem: jest.fn(),
        removeItem: jest.fn(),
        flushNow: jest.fn(async () => undefined),
    }),
}));

import { buildPersistedAppStoreSnapshot, useStore } from "../useStore";
import { canMergeStoreVersion, isNewerStoreVersion, STORE_VERSION } from "../storeVersion";
import { clearPersistBlockedSignal, getPersistHealth, isPersistBlocked, setPersistBlocked } from "../persistRuntime";
import { validateDisasterRecoveryManifest } from "../../services/disasterRecoveryValidation";

/**
 * 11-M1: the data version sat at 12 from July through ~13 persisted-shape changes, so
 * "made by a newer SongNook" could never fire. These pin the version to the shape.
 */
describe("the library's data version", () => {
    it("is bumped with the persisted shape (update both together)", () => {
        // A persisted-shape change bumps STORE_VERSION (state/storeVersion.ts) and this
        // pin. Nested reshapes count too (13: hiddenDays as calendar days, automaticBackup,
        // recentlyDeleted — all unshipped).
        expect(STORE_VERSION).toBe(13);
        expect(Object.keys(buildPersistedAppStoreSnapshot(useStore.getState())).sort()).toEqual([
            "activeWorkspaceId", "activityEvents", "automaticBackup", "backupReminderFrequency", "backupReminderLastPromptedAt",
            "bluetoothMonitoringCalibrations", "classicReel", "collectionLastOpenedAt", "cutUpSparks",
            "firstLaunchAt", "globalCustomClipTags", "hapticsEnabled", "hasSeenWelcome", "ideasFilter",
            "ideasSort", "ideasTagFilter", "lastSuccessfulBackupAt", "lastSuccessfulBackupFileName",
            "lastUsedWorkspaceId", "magpieSparks", "metronomeBeepLevel", "metronomeBpm", "metronomeClickVoice",
            "metronomeCountInBars", "metronomeCustomPatternByMeterId", "metronomeFeelByMeterId",
            "metronomeGroupingByMeterId", "metronomeHapticLevel", "metronomeMeterId", "metronomeOutputs",
            "metronomeSubdivision", "nameLanguage", "notes", "playbackClickHaptic", "playbackClickLevel",
            "playlists", "preferredRecordingInputId", "primaryCollectionIdByWorkspace", "primaryFilter",
            "primarySort", "primaryWorkspaceId", "promptForClipName", "recentlyDeleted", "reviewPromptShownAt", "seenHints",
            "setlists", "songbooks", "wordLadders", "wordLanguage", "workspaceLastOpenedAt",
            "workspaceListOrder", "workspaceStartupPreference", "workspaces",
        ]);
    });

    it("refuses a backup from a newer SongNook, merges this and the previous version", () => {
        const manifest = (storeVersion: number) => ({
            formatVersion: 1,
            storeVersion,
            createdAt: "2026-11-02T10:00:00.000Z",
            status: "complete",
            counts: { workspaces: 1, collections: 1, ideas: 1, clips: 1 },
            snapshotSha256: "0".repeat(64),
            files: [],
            missing: [],
        });
        expect(() => validateDisasterRecoveryManifest(manifest(STORE_VERSION + 1), 1, STORE_VERSION)).toThrow(/newer/);
        expect(() => validateDisasterRecoveryManifest(manifest(STORE_VERSION), 1, STORE_VERSION)).not.toThrow();
        expect(canMergeStoreVersion(12)).toBe(true);
        expect(canMergeStoreVersion(13)).toBe(true);
        expect(canMergeStoreVersion(14)).toBe(false);
        expect(canMergeStoreVersion(11)).toBe(false);
    });

    it("hydrates newer data read-only: nothing is written back, and the bar says why", () => {
        expect(isNewerStoreVersion(STORE_VERSION)).toBe(false);
        expect(isNewerStoreVersion(STORE_VERSION + 1)).toBe(true);
        const migrate = useStore.persist.getOptions().migrate!;
        try {
            migrate({ workspaces: [] }, STORE_VERSION - 1);
            expect(isPersistBlocked()).toBe(false);
            migrate({ workspaces: [] }, STORE_VERSION + 1);
            expect(isPersistBlocked()).toBe(true);
            expect(getPersistHealth()).toBe("newer");
        } finally {
            setPersistBlocked(false);
            clearPersistBlockedSignal();
        }
    });
});
