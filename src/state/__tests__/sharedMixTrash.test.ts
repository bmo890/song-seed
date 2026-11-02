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
    createShardedPersistStorage: () => ({ getItem: () => null, setItem: jest.fn(), removeItem: jest.fn(), flushNow: jest.fn() }),
}));
jest.mock("../../services/managedMedia", () => {
    const actual = jest.requireActual("../../services/managedMedia");
    return { ...actual, deleteManagedAudioUris: jest.fn(async () => undefined) };
});

import { useStore } from "../useStore";
import { deleteManagedAudioUrisAfterGrace } from "../actions";
import { deleteManagedAudioUris } from "../../services/managedMedia";

/**
 * 03-12: a branch shares its source clip's rendered mix; clearing one clip's mix
 * trashed the file with no reference check, and the other clip lost its mix.
 */
it("a mix another clip still uses is not trashed when the grace ends", () => {
    jest.useFakeTimers();
    const mix = "file:///docs/songnook/audio/mix-1.m4a";
    useStore.setState({
        workspaces: [
            {
                id: "w",
                title: "W",
                collections: [],
                ideas: [
                    {
                        id: "s",
                        title: "S",
                        notes: "",
                        status: "seed",
                        completionPct: 0,
                        kind: "project",
                        collectionId: "c",
                        createdAt: 1,
                        lastActivityAt: 1,
                        clips: [
                            { id: "branch", title: "b", notes: "", createdAt: 1, isPrimary: true, audioUri: "file:///docs/songnook/audio/b.m4a", overdub: { renderedMixUri: mix, stems: [] } },
                        ],
                    },
                ],
            },
        ] as never,
    });
    deleteManagedAudioUrisAfterGrace([mix, "file:///docs/songnook/audio/unused.m4a"]);
    jest.runAllTimers();
    expect(deleteManagedAudioUris).toHaveBeenCalledWith(["file:///docs/songnook/audio/unused.m4a"]);
    jest.useRealTimers();
});
