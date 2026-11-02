jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-audio", () => ({ createAudioPlayer: jest.fn(), setAudioModeAsync: jest.fn() }));
jest.mock("expo-document-picker", () => ({}));
const mockFiles = new Set<string>();
jest.mock("expo-file-system/legacy", () => ({
    documentDirectory: "file:///docs/",
    cacheDirectory: "file:///cache/",
    getInfoAsync: jest.fn(async (uri: string) => ({ exists: mockFiles.has(uri) || uri.endsWith("/trash"), size: 1000 })),
    readDirectoryAsync: jest.fn(async (dir: string) =>
        [...mockFiles].filter((uri) => uri.startsWith(`${dir}/`)).map((uri) => uri.slice(dir.length + 1))
    ),
    moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
        mockFiles.delete(from);
        mockFiles.add(to);
    }),
    copyAsync: jest.fn(),
    deleteAsync: jest.fn(async (uri: string) => {
        mockFiles.delete(uri);
    }),
    makeDirectoryAsync: jest.fn(async () => undefined),
}));
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

import { useStore } from "../useStore";
import { keepDiscardedTake } from "../discardedTake";
import { restoreRecentlyDeleted } from "../recentlyDeletedActions";
import { setHydrationReadOutcome } from "../persistRuntime";

/**
 * 03-9: Discard and Redo in the recorder deleted the take for good. A take longer
 * than a false start now waits in Recently deleted, audio included.
 */

const OLD = Date.now() - 1000;
beforeAll(() => setHydrationReadOutcome("data"));
beforeEach(() => {
    mockFiles.clear();
    useStore.setState({
        primaryWorkspaceId: "mine",
        workspaces: [
            {
                id: "mine",
                title: "Mine",
                collections: [{ id: "ideas", title: "Ideas", workspaceId: "mine", parentCollectionId: null, createdAt: OLD, updatedAt: OLD, ideasListState: { hiddenIdeaIds: [], hiddenDays: [] } }],
                ideas: [],
            },
        ] as never,
        recentlyDeleted: [],
    });
});

it("keeps a discarded take and Restore brings it back as a clip with its audio", async () => {
    mockFiles.add("file:///docs/take-1.m4a");
    const ids = await keepDiscardedTake("file:///docs/take-1.m4a", {
        workspaceId: "mine",
        collectionId: "ideas",
        ideaId: "placeholder-gone",
        ideaTitle: "",
        durationMs: 3 * 60 * 1000,
    });
    expect(ids).toHaveLength(1);
    expect(mockFiles.has("file:///docs/take-1.m4a")).toBe(false);
    const clip = useStore.getState().recentlyDeleted[0]!.clips![0]!;
    expect(clip.audioUri).toMatch(/^file:\/\/\/docs\/songnook\/audio\/discarded-/);

    await restoreRecentlyDeleted(ids);
    const restored = useStore.getState().workspaces[0]!.ideas[0]!;
    expect(restored.collectionId).toBe("ideas");
    expect(restored.clips[0]!.audioUri).toBe(clip.audioUri);
    expect(mockFiles.has(clip.audioUri!)).toBe(true);
});

it("lets a false start go", async () => {
    mockFiles.add("file:///docs/take-2.m4a");
    const ids = await keepDiscardedTake("file:///docs/take-2.m4a", {
        workspaceId: "mine",
        collectionId: "ideas",
        ideaId: null,
        ideaTitle: "",
        durationMs: 1200,
    });
    expect(ids).toEqual([]);
    expect(useStore.getState().recentlyDeleted).toHaveLength(0);
});
