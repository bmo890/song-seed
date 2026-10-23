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
import { appActions } from "../actions";

/**
 * A visited received package is never the active workspace, so Copy / Move
 * from its list must read the page's workspace, not the active one (final
 * sweep 2026-10-22, #1). Without the workspace id the action keeps reading
 * the active workspace, as every in-workspace list does.
 */

const OLD = Date.now() - 7 * 24 * 60 * 60 * 1000;

const clipIdea = (id: string, collectionId: string) => ({
    id,
    title: id,
    notes: "",
    status: "clip",
    completionPct: 0,
    kind: "clip",
    collectionId,
    createdAt: OLD,
    lastActivityAt: OLD,
    clips: [
        {
            id: `${id}-take`,
            title: id,
            notes: "",
            createdAt: OLD,
            isPrimary: true,
            audioUri: `file:///${id}.m4a`,
            durationMs: 1000,
        },
    ],
});

const workspace = (id: string, ideaId: string) => ({
    id,
    title: id,
    collections: [
        {
            id: `${id}-col`,
            title: "Ideas",
            workspaceId: id,
            parentCollectionId: null,
            createdAt: OLD,
            updatedAt: OLD,
            ideasListState: { hiddenIdeaIds: [], hiddenDays: [] },
        },
    ],
    ideas: [clipIdea(ideaId, `${id}-col`)],
});

function seed(selectedListIdeaIds: string[]) {
    useStore.setState({
        activeWorkspaceId: "mine",
        workspaces: [workspace("mine", "porch"), workspace("package", "demo")],
        listSelectionMode: true,
        selectedListIdeaIds,
        clipClipboard: null,
    } as never);
}

describe("startClipboardFromList reads the page's workspace", () => {
    it("names the visited package as the clipboard's source when told which page it is", () => {
        seed(["demo"]);
        appActions.startClipboardFromList("copy", "package");
        const clipboard = useStore.getState().clipClipboard;
        expect(clipboard?.sourceWorkspaceId).toBe("package");
        expect(clipboard?.sourceCollectionId).toBe("package-col");
        expect(clipboard?.clipIds).toEqual(["demo"]);
    });

    it("falls back to the active workspace when no page is named", () => {
        seed(["porch"]);
        appActions.startClipboardFromList("move");
        const clipboard = useStore.getState().clipClipboard;
        expect(clipboard?.sourceWorkspaceId).toBe("mine");
        expect(clipboard?.sourceCollectionId).toBe("mine-col");
    });
});
