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
jest.mock("../../services/manifestSync", () => ({ forceManifestWrite: jest.fn(async () => {}) }));
jest.mock("../../services/libraryImport", () => ({
    materializeSongNookArchiveMerge: jest.fn(async () => ({
        importedWorkspaces: [],
        importedNotes: [{ id: "their-note", title: "Theirs", body: "x", createdAt: 1, updatedAt: 1, isPinned: true }],
        importedSongbooks: [],
        importedSetlists: [],
        importedPlaylists: [],
        suggestedPrimaryWorkspaceId: null,
        suggestedPrimaryCollectionIdByWorkspace: {},
        bluetoothMonitoringCalibrations: [{ routeKey: "their-headphones", latencyMs: 400, measuredAt: 1 }],
        importedWorkspaceIds: [],
        importedIdeaIds: [],
        warnings: [],
    })),
}));

import { useStore } from "../useStore";
import { appActions } from "../actions";

/**
 * A received parcel lands as a package; it never writes into the person's own
 * spaces (audit 2026-11-02, 06 #6): no Lyric Pad pages, no headphone calibrations.
 * A personal import (Settings) still brings both.
 */
const parsed = { manifest: { share: undefined } } as any;

beforeEach(() => {
    useStore.setState({ notes: [], bluetoothMonitoringCalibrations: [] } as any);
});

it("a received archive adds no Lyric Pad pages and no calibrations", async () => {
    await appActions.importLibraryArchiveIntoLibrary(parsed, { origin: "received" }).catch(() => undefined);
    expect(useStore.getState().notes.map((note) => note.id)).not.toContain("their-note");
    expect(useStore.getState().bluetoothMonitoringCalibrations).toEqual([]);
});

it("a personal import still brings its notes", async () => {
    await appActions.importLibraryArchiveIntoLibrary(parsed).catch(() => undefined);
    expect(useStore.getState().notes.map((note) => note.id)).toContain("their-note");
    expect(useStore.getState().bluetoothMonitoringCalibrations.map((c) => c.routeKey)).toEqual(["their-headphones"]);
});
