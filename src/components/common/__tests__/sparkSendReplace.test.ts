jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-audio", () => ({ createAudioPlayer: jest.fn(), setAudioModeAsync: jest.fn() }));
jest.mock("expo-document-picker", () => ({}));
jest.mock("expo-file-system/legacy", () => ({ documentDirectory: "file:///docs/", cacheDirectory: "file:///cache/" }));
jest.mock("expo-file-system", () => ({ documentDirectory: "file:///docs/", cacheDirectory: "file:///cache/" }));
jest.mock("expo-sharing", () => ({}));
jest.mock("expo-haptics", () => ({}));
jest.mock("../../../design/haptics", () => ({
    setHapticsEnabled: () => undefined,
    haptic: new Proxy({}, { get: () => () => undefined }),
}));
jest.mock("../../../services/waveformAnalysis", () => ({}));
jest.mock("../../../services/audioStorage", () => ({}));
jest.mock("../../../services/manifestSync", () => ({ startManifestSync: jest.fn() }));
jest.mock("../../../state/shardedPersistStorage", () => ({
    createShardedPersistStorage: () => ({
        getItem: () => null,
        setItem: jest.fn(),
        removeItem: jest.fn(),
        flushNow: jest.fn(async () => undefined),
    }),
}));

import { useStore } from "../../../state/useStore";
import { replacePadPageKeepingOld, sendSparkToPad } from "../sparkSend";
import { dialogStore, type DialogConfig } from "../dialogStore";

/**
 * 12f F-M1 / 12g G-H1: "Update page" replaced a Lyric Pad page's whole body with the
 * spark's text; words written on that page since the first send were gone.
 */

const page = { id: "p1", title: "Doctor", body: "the spark\nplus a verse I wrote in the Pad", createdAt: 1, updatedAt: 1, isPinned: true };

beforeEach(() => useStore.setState({ notes: [page], recentlyDeleted: [] }));

it("sending again to a page keeps the words it replaces in Recently deleted", () => {
    let dialog: DialogConfig | null = null;
    const unsubscribe = dialogStore.subscribe((config) => (dialog = config));
    sendSparkToPad({
        text: "the spark, revised",
        title: "Doctor",
        methodName: "Word Ladder",
        savedLyricId: "p1",
        link: jest.fn(),
        navigation: { navigate: jest.fn() } as never,
    });
    unsubscribe();
    const replace = dialog!.buttons.find((button) => button.label !== "New page" && button.style !== "cancel")!;
    replace.onPress?.();
    expect(useStore.getState().notes[0]!.body).toBe("the spark, revised");
    const kept = useStore.getState().recentlyDeleted[0]!;
    expect(kept.kind).toBe("note");
    expect(kept.note!.body).toBe(page.body);
    expect(kept.note!.id).not.toBe("p1");
});

it("Undo puts the page's words back and drops the record", () => {
    const replaced = replacePadPageKeepingOld("p1", "new words")!;
    replaced.undo();
    expect(useStore.getState().notes[0]!.body).toBe(page.body);
    expect(useStore.getState().recentlyDeleted).toHaveLength(0);
});

it("nothing is kept when nothing is lost", () => {
    expect(replacePadPageKeepingOld("p1", page.body)).toBeNull();
    expect(useStore.getState().recentlyDeleted).toHaveLength(0);
});
