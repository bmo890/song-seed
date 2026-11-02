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
const mockNavigate = jest.fn();
let mockRouteParams: Record<string, unknown> = {};
jest.mock("../../../hooks/useWordLanguage", () => ({ useWordLanguage: () => "en" }));
jest.mock("@react-navigation/native", () => ({
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), getParent: () => null, setParams: jest.fn() }),
    useRoute: () => ({ params: mockRouteParams }),
    useFocusEffect: () => undefined,
    useIsFocused: () => true,
}));

import { useStore } from "../../../state/useStore";
import { useWordLadderScreenModel } from "../hooks/useWordLadderScreenModel";
import { dialogStore, type DialogConfig } from "../../common/dialogStore";

type Rendered = { unmount(): void };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer") as {
    create(element: React.ReactElement): Rendered;
    act(run: () => Promise<void> | void): Promise<void>;
};
const { act } = TestRenderer;

/**
 * 12f F-H3: Back on any unfinished spark asked Save / Discard, and Discard deleted the
 * whole spark, one saved last week included. Edits autosave, so a spark you came back
 * to just leaves; a new one's Discard keeps it in Recently deleted.
 */

let model!: ReturnType<typeof useWordLadderScreenModel>;
function Host() {
    model = useWordLadderScreenModel();
    return null;
}

let dialog: DialogConfig | null = null;
beforeAll(() => dialogStore.subscribe((config) => (dialog = config)));

const ladder = (createdAt: number) => ({
    id: "ladder",
    title: "The doctor",
    createdAt,
    updatedAt: createdAt,
    step: "pair",
    roleSeed: "doctor",
    placeSeed: "kitchen",
    columnA: [{ id: "a1", text: "heal" }],
    columnB: [{ id: "b1", text: "window" }],
    pairings: [],
    seenHelpSteps: [],
    draft: "",
    revision: "",
});

async function renderWith(createdAt: number) {
    dialog = null;
    mockNavigate.mockClear();
    mockRouteParams = { exerciseId: "ladder" };
    useStore.setState({ wordLadders: [ladder(createdAt) as never], recentlyDeleted: [], seenHints: ["recentlyDeletedIntro"] });
    let app!: Rendered;
    await act(async () => {
        app = TestRenderer.create(<Host />);
    });
    return app;
}

it("Back on a spark from an earlier visit just leaves, and keeps it", async () => {
    const app = await renderWith(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await act(async () => model.goBack());
    expect(dialog).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("SparkHome");
    expect(useStore.getState().wordLadders).toHaveLength(1);
    await act(async () => app.unmount());
});

it("Discard on a spark started this visit keeps it in Recently deleted", async () => {
    const app = await renderWith(Date.now());
    await act(async () => model.goBack());
    const discard = dialog!.buttons.find((button) => button.style === "destructive")!;
    await act(async () => discard.onPress?.());
    expect(useStore.getState().wordLadders).toHaveLength(0);
    expect(useStore.getState().recentlyDeleted[0]?.spark?.record.id).toBe("ladder");
    await act(async () => app.unmount());
});
