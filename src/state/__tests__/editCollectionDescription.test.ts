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

import { useStore } from "../useStore";

/**
 * Data-safety audit 2026-11-02, 12c C-H2: the workspace hub's "Edit collection"
 * passed the description on, the store kept only the title, and the sheet closed
 * as if both were saved.
 */
const OLD = Date.now() - 1000;

function seed() {
    useStore.setState({
        activeWorkspaceId: "here",
        workspaces: [
            {
                id: "here",
                title: "Here",
                ideas: [],
                collections: [
                    {
                        id: "col",
                        title: "Ideas",
                        description: "old",
                        workspaceId: "here",
                        parentCollectionId: null,
                        createdAt: OLD,
                        updatedAt: OLD,
                        ideasListState: { hiddenIdeaIds: [], hiddenDays: [] },
                    },
                ],
            },
            {
                id: "band",
                title: "Band",
                ideas: [],
                collections: [
                    {
                        id: "band-col",
                        title: "Riffs",
                        workspaceId: "band",
                        parentCollectionId: null,
                        createdAt: OLD,
                        updatedAt: OLD,
                        ideasListState: { hiddenIdeaIds: [], hiddenDays: [] },
                    },
                ],
            },
        ],
    } as never);
}

const collection = (id: string) =>
    useStore
        .getState()
        .workspaces.flatMap((ws) => ws.collections)
        .find((c) => c.id === id)!;

describe("Edit collection", () => {
    beforeEach(seed);

    it("keeps the title and the description typed together", () => {
        useStore.getState().updateCollection("here", "col", { title: "Renamed", description: "new words" });
        expect(collection("col").title).toBe("Renamed");
        expect(collection("col").description).toBe("new words");
    });

    it("clears the description when it is emptied", () => {
        useStore.getState().updateCollection("here", "col", { title: "Ideas", description: undefined });
        expect(collection("col").description).toBeUndefined();
    });

    it("leaves the description alone on a title-only rename", () => {
        useStore.getState().updateCollection("here", "col", { title: "Renamed" });
        expect(collection("col").description).toBe("old");
    });

    it("never takes an empty title", () => {
        useStore.getState().updateCollection("here", "col", { title: "  ", description: "x" });
        expect(collection("col").title).toBe("Ideas");
    });

    it("lands in the workspace that owns the collection", () => {
        useStore.getState().updateCollection("here", "band-col", { title: "Riffs", description: "loud" });
        expect(collection("band-col").description).toBe("loud");
    });
});
