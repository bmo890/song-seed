import React from "react";

jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-audio", () => ({ createAudioPlayer: jest.fn(), setAudioModeAsync: jest.fn() }));
jest.mock("expo-document-picker", () => ({}));
jest.mock("expo-file-system/legacy", () => ({
    documentDirectory: "file:///docs/",
    cacheDirectory: "file:///cache/",
    getInfoAsync: jest.fn(async () => ({ exists: false })),
    readDirectoryAsync: jest.fn(async () => []),
    deleteAsync: jest.fn(async () => undefined),
    moveAsync: jest.fn(async () => undefined),
    makeDirectoryAsync: jest.fn(async () => undefined),
}));
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
    createShardedPersistStorage: () => ({ getItem: () => null, setItem: jest.fn(), removeItem: jest.fn(), flushNow: jest.fn(async () => undefined) }),
}));
jest.mock("@react-navigation/native", () => ({
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), getParent: () => null, canGoBack: () => true }),
    useNavigationState: () => null,
    useRoute: () => ({ key: "r", params: {} }),
    useFocusEffect: () => undefined,
}));
jest.mock("react-native-safe-area-context", () => {
    const { View } = require("react-native");
    return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

import { useStore } from "../../../state/useStore";
import { RecentlyDeletedScreen } from "..";
import { actionMenuStore } from "../../common/actionMenuStore";
import { announceDeleted, RECENTLY_DELETED_INTRO_HINT } from "../../common/deleteFeedback";
import { dialogStore, type DialogConfig } from "../../common/dialogStore";
import { i18n } from "../../../i18n";

type Instance = { findAllByProps(props: object): Array<{ props: Record<string, any> }> };
type Rendered = { root: Instance; unmount(): void };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer") as {
    create(element: React.ReactElement): Rendered;
    act(run: () => Promise<void> | void): Promise<void>;
};
const { act } = TestRenderer;

let dialog: DialogConfig | null = null;
beforeAll(() => dialogStore.subscribe((config) => (dialog = config)));

const record = {
    id: "d1",
    kind: "setlist" as const,
    title: "Friday",
    deletedAt: Date.now(),
    setlist: { id: "set", title: "Friday", createdAt: 1, updatedAt: 1, entries: [] },
};

it("lists what was deleted; a row's menu restores it", async () => {
    useStore.setState({ recentlyDeleted: [record], setlists: [] });
    let app!: Rendered;
    await act(async () => {
        app = TestRenderer.create(<RecentlyDeletedScreen />);
    });
    const row = app.root.findAllByProps({ testID: "recently-deleted-d1" })[0]!;
    let menu: { actions: Array<{ key: string; onPress: () => void }> } | null = null;
    const unsubscribe = actionMenuStore.subscribe((config: unknown) => (menu = config as never));
    await act(async () => row.props.onPress());
    unsubscribe();
    expect(menu!.actions.map((action) => action.key)).toEqual(["restore", "delete"]);
    await act(async () => menu!.actions[0]!.onPress());
    expect(useStore.getState().setlists.map((setlist) => setlist.id)).toEqual(["set"]);
    expect(useStore.getState().recentlyDeleted).toHaveLength(0);
    await act(async () => app.unmount());
});

it("Delete permanently asks first, with the founder's words", async () => {
    useStore.setState({ recentlyDeleted: [record] });
    let app!: Rendered;
    await act(async () => {
        app = TestRenderer.create(<RecentlyDeletedScreen />);
    });
    let menu: { actions: Array<{ key: string; onPress: () => void }> } | null = null;
    const unsubscribe = actionMenuStore.subscribe((config: unknown) => (menu = config as never));
    await act(async () => app.root.findAllByProps({ testID: "recently-deleted-d1" })[0]!.props.onPress());
    unsubscribe();
    await act(async () => menu!.actions[1]!.onPress());
    expect(dialog?.title).toBe(i18n.t("recentlyDeleted.confirmTitle"));
    expect(dialog?.message).toBe(i18n.t("recentlyDeleted.confirmBody"));
    expect(useStore.getState().recentlyDeleted).toHaveLength(1);
    await act(async () => app.unmount());
});

it("the first delete ever explains Recently deleted once", () => {
    useStore.setState({ seenHints: [] });
    dialog = null;
    announceDeleted(["x"]);
    expect(dialog?.title).toBe(i18n.t("recentlyDeleted.introTitle"));
    expect(useStore.getState().seenHints).toContain(RECENTLY_DELETED_INTRO_HINT);
    dialogStore.dismiss();
    announceDeleted(["y"]);
    expect(dialog).toBeNull();
});
