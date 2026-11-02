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

let releaseMaterialize: () => void = () => {};
jest.mock("../../services/libraryImport", () => ({
    materializeSongNookArchiveMerge: jest.fn(
        () =>
            new Promise((resolve) => {
                releaseMaterialize = () =>
                    resolve({
                        importedWorkspaces: [
                            {
                                id: "imported-ws",
                                title: "Imported",
                                collections: [],
                                ideas: [],
                                isArchived: false,
                            },
                        ],
                        importedNotes: [],
                        importedSongbooks: [],
                        importedSetlists: [],
                        importedPlaylists: [],
                        suggestedPrimaryWorkspaceId: null,
                        suggestedPrimaryCollectionIdByWorkspace: {},
                        bluetoothMonitoringCalibrations: [],
                        importedWorkspaceIds: ["imported-ws"],
                        importedIdeaIds: [],
                        warnings: [],
                    });
            })
    ),
}));

import { useStore } from "../useStore";
import { appActions } from "../actions";
import { libraryOperationBlockedReason, recordingBlockedBy } from "../../services/libraryOperationGate";

/**
 * Audit 2026-11-02, 12e E-H1 / 12f F-H2: an archive import read the library, spent
 * seconds extracting audio, then wrote back that old copy plus the parcel. A take
 * recorded and a Lyric Pad line written while it ran were erased.
 */
const parsed = { manifest: { share: undefined } } as any;

function idea(id: string) {
    return {
        id,
        title: id,
        notes: "",
        status: "seed",
        completionPct: 0,
        kind: "clip",
        collectionId: "col",
        clips: [],
        createdAt: 1,
        lastActivityAt: 1,
    } as any;
}

beforeEach(() => {
    useStore.setState({
        workspaces: [
            {
                id: "mine",
                title: "Mine",
                collections: [{ id: "col", title: "Ideas", workspaceId: "mine", parentCollectionId: null, createdAt: 1, updatedAt: 1, ideasListState: { hiddenIdeaIds: [], hiddenDays: [] } }],
                ideas: [idea("old")],
                isArchived: false,
            },
        ],
        notes: [{ id: "page", title: "Page", body: "first", createdAt: 1, updatedAt: 1, isPinned: false }],
    } as any);
});

it("keeps a take recorded and a page written while the import ran", async () => {
    const running = appActions.importLibraryArchiveIntoLibrary(parsed).catch((error) => error);
    await Promise.resolve();

    // While the files are being extracted: a take lands, and a Lyric Pad line is written.
    useStore.setState((s) => ({
        workspaces: s.workspaces.map((ws) =>
            ws.id === "mine" ? { ...ws, ideas: [idea("new-take"), ...ws.ideas] } : ws
        ),
        notes: s.notes.map((note) => (note.id === "page" ? { ...note, body: "first + new lines" } : note)),
    }));

    releaseMaterialize();
    await running;

    const state = useStore.getState();
    const mine = state.workspaces.find((ws) => ws.id === "mine")!;
    expect(mine.ideas.map((item) => item.id)).toEqual(["new-take", "old"]);
    expect(state.notes.find((note) => note.id === "page")!.body).toBe("first + new lines");
    expect(state.workspaces.map((ws) => ws.id)).toContain("imported-ws");
});

it("holds the one heavy-operation slot while it runs: a take waits, a second import is refused", async () => {
    const running = appActions.importLibraryArchiveIntoLibrary(parsed).catch((error) => error);
    await Promise.resolve();

    expect(libraryOperationBlockedReason()).toBe("import");
    expect(recordingBlockedBy()).toBe("import");
    await expect(appActions.importLibraryArchiveIntoLibrary(parsed)).rejects.toMatchObject({ name: "LibraryBusyError" });

    releaseMaterialize();
    await running;
    expect(libraryOperationBlockedReason()).toBeNull();
});
