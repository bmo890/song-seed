import React from "react";

jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-audio", () => ({ createAudioPlayer: jest.fn(), setAudioModeAsync: jest.fn() }));
jest.mock("expo-document-picker", () => ({}));
jest.mock("expo-file-system/legacy", () => ({ documentDirectory: "file:///docs/", cacheDirectory: "file:///cache/" }));
jest.mock("expo-file-system", () => ({ documentDirectory: "file:///docs/", cacheDirectory: "file:///cache/" }));
jest.mock("expo-sharing", () => ({}));
jest.mock("expo-haptics", () => ({}));
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
jest.mock("../../../hooks/FullPlayerProvider", () => {
    const anything = () => new Proxy({}, { get: () => jest.fn() });
    return new Proxy({}, { get: (_target, key) => (key === "__esModule" ? true : anything) });
});
jest.mock("@react-navigation/native", () => ({
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), getParent: () => null, setParams: jest.fn() }),
    useRoute: () => ({ params: {} }),
    useFocusEffect: () => undefined,
    useIsFocused: () => true,
}));

import { useStore } from "../../../state/useStore";
import { useSetlistModel } from "../hooks/useSetlistModel";
import { useSongbookModel } from "../hooks/useSongbookModel";
import { dialogStore, type DialogConfig } from "../../common/dialogStore";

type Rendered = { unmount(): void };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer") as {
    create(element: React.ReactElement): Rendered;
    act(run: () => Promise<void> | void): Promise<void>;
};
const { act } = TestRenderer;

/**
 * 12e E-H2: "Delete book" and "Delete set" deleted in one tap, with no confirm and
 * no undo. Now they ask, by name, and the set or book waits in Recently deleted.
 */

let setlistModel!: ReturnType<typeof useSetlistModel>;
let songbookModel!: ReturnType<typeof useSongbookModel>;
function Host() {
    setlistModel = useSetlistModel();
    songbookModel = useSongbookModel();
    return null;
}

let dialog: DialogConfig | null = null;
beforeAll(() => dialogStore.subscribe((config) => (dialog = config)));

beforeEach(() => {
    dialog = null;
    useStore.setState({
        setlists: [{ id: "set", title: "Friday", createdAt: 1, updatedAt: 1, entries: [] }],
        songbooks: [{ id: "book", title: "Charts", createdAt: 1, updatedAt: 1, items: [] }],
        recentlyDeleted: [],
        seenHints: ["recentlyDeletedIntro"],
    });
});

async function confirmDialog() {
    expect(dialog).not.toBeNull();
    const destructive = dialog!.buttons.find((button) => button.style === "destructive");
    await act(async () => destructive!.onPress?.());
}

it("Delete set asks first, then keeps the set in Recently deleted", async () => {
    let app!: Rendered;
    await act(async () => {
        app = TestRenderer.create(<Host />);
    });
    await act(async () => setlistModel.openSetlist("set"));
    await act(async () => setlistModel.deleteActiveSetlist());
    expect(useStore.getState().setlists).toHaveLength(1);
    expect(dialog?.message).toContain("Friday");
    await confirmDialog();
    expect(useStore.getState().setlists).toHaveLength(0);
    expect(useStore.getState().recentlyDeleted[0]?.setlist?.id).toBe("set");
    await act(async () => app.unmount());
});

it("Delete book asks first, then keeps the book in Recently deleted", async () => {
    let app!: Rendered;
    await act(async () => {
        app = TestRenderer.create(<Host />);
    });
    await act(async () => songbookModel.openSongbook("book"));
    await act(async () => songbookModel.deleteActiveSongbook());
    expect(useStore.getState().songbooks).toHaveLength(1);
    await confirmDialog();
    expect(useStore.getState().songbooks).toHaveLength(0);
    expect(useStore.getState().recentlyDeleted[0]?.songbook?.id).toBe("book");
    await act(async () => app.unmount());
});
