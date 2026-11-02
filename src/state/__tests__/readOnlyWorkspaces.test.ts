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
import { sanitizePersistedState } from "../useStore";

/**
 * Founder decision B (2026-11-02): a received parcel is read-only until Keep, and an
 * archived workspace is read-only (anything written into its stub is lost on
 * unarchive). The store refuses writes there and says so; it never falls through to
 * a delete; neither ever becomes the active or primary workspace (12c C-M1, C-M2,
 * 12e E-M3, 12f F-H1).
 */

const OLD = Date.now() - 7 * 24 * 60 * 60 * 1000;

const clip = (id: string) => ({
    id,
    title: id,
    notes: "",
    createdAt: OLD,
    isPrimary: true,
    audioUri: `file:///${id}.m4a`,
    durationMs: 1000,
});

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
    clips: [clip(`${id}-take`)],
});

const workspace = (id: string, ideas: unknown[], extra: Record<string, unknown> = {}) => ({
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
    ideas,
    ...extra,
});

const received = { senderName: "Dana", transferId: "t1", receivedAt: OLD, shareKind: "ideas", shareTitle: "Demos" };

function seed() {
    useStore.setState({
        activeWorkspaceId: "mine",
        primaryWorkspaceId: "mine",
        lastUsedWorkspaceId: "mine",
        workspaces: [
            workspace("pkg", [clipIdea("theirs", "pkg-col")], { origin: "received", received }),
            workspace("mine", [clipIdea("ours", "mine-col")]),
            workspace("old", [clipIdea("archived", "old-col")], { isArchived: true }),
        ],
        selectedIdeaId: null,
        selectedClipIds: [],
        activityEvents: [],
        playlists: [],
        setlists: [],
        songbooks: [],
        clipClipboard: null,
    } as never);
}

const ws = (id: string) => useStore.getState().workspaces.find((w) => w.id === id);
const idea = (wsId: string, ideaId: string) => ws(wsId)?.ideas.find((i) => i.id === ideaId);

beforeAll(() => jest.spyOn(console, "warn").mockImplementation(() => {}));

describe("the store refuses edits in read-only workspaces", () => {
    beforeEach(seed);

    it("updateIdeas says no and leaves the parcel and the archive untouched", () => {
        const pkgBefore = ws("pkg");
        expect(
            useStore.getState().updateIdeas((ideas) => ideas.map((i) => ({ ...i, notes: "x" })), { workspaceId: "pkg" })
        ).toBe(false);
        expect(
            useStore.getState().updateIdeas((ideas) => ideas.map((i) => ({ ...i, notes: "x" })), { workspaceId: "old" })
        ).toBe(false);
        expect(ws("pkg")).toBe(pkgBefore);
        expect(idea("old", "archived")!.notes).toBe("");
        expect(
            useStore.getState().updateIdeas((ideas) => ideas.map((i) => ({ ...i, notes: "x" })), { workspaceId: "mine" })
        ).toBe(true);
    });

    it("rename, bookmark and marks are refused; how you keep the speed is not", () => {
        expect(useStore.getState().renameIdea("theirs", "Mine now")).toBe(false);
        useStore.getState().toggleIdeaBookmark("theirs");
        useStore.getState().addClipPracticeMarker("theirs", "theirs-take", { id: "m", atMs: 10, label: "" } as never);
        expect(idea("pkg", "theirs")!.title).toBe("theirs");
        expect(idea("pkg", "theirs")!.isBookmarked).toBeFalsy();
        expect(idea("pkg", "theirs")!.clips[0]!.practiceMarkers ?? []).toHaveLength(0);
        useStore.getState().setClipKeptPractice("theirs", "theirs-take", { rate: 0.8 } as never);
        expect(idea("pkg", "theirs")!.clips[0]!.keptPractice).toEqual({ rate: 0.8 });
    });

    it("nothing new lands in a parcel or an archive", () => {
        expect(useStore.getState().addIdea("x", "pkg-col")).toBeNull();
        expect(appActions.quickRecordIdea("old-col")).toBe(false);
        expect(useStore.getState().addCollection("pkg", "New")).toBeNull();
        expect(() => appActions.importClipToCollection("old-col", { title: "memo", audioUri: "file:///m.m4a" })).toThrow();
        expect(ws("pkg")!.ideas).toHaveLength(1);
        expect(ws("old")!.ideas).toHaveLength(1);
        expect(ws("pkg")!.collections).toHaveLength(1);
    });

    it("a parcel import may still fill its own parcel", () => {
        const created = appActions.importClipsToCollection(
            "pkg-col",
            [{ title: "song", audioUri: "file:///s.m4a" }],
            { intoReceivedParcel: true }
        );
        expect(created).toHaveLength(1);
        expect(ws("pkg")!.ideas).toHaveLength(2);
    });

    it("Make sketch is refused, and Discard / delete in a parcel never deletes", () => {
        expect(appActions.convertClipIdeaToProject("theirs")).toBe(false);
        useStore.getState().setSelectedIdeaId("theirs");
        appActions.deleteSelectedIdea(true);
        useStore.getState().deleteIdea("theirs");
        appActions.deleteClipFromIdea("theirs", "theirs-take");
        expect(idea("pkg", "theirs")!.clips).toHaveLength(1);
    });

    it("moves and pastes never target a parcel or an archive", async () => {
        expect(useStore.getState().moveCollection("mine-col", "pkg").ok).toBe(false);
        expect(appActions.copyCollection("mine-col", "old").ok).toBe(false);
        useStore.setState({ selectedListIdeaIds: ["ours"] } as never);
        appActions.startClipboardFromList("move", "mine");
        expect(await appActions.pasteClipboardToCollection("pkg-col")).toEqual([]);
        expect(idea("mine", "ours")).toBeDefined();
    });

    it("Keep (moving the parcel's collection out) still works", () => {
        const result = useStore.getState().adoptReceivedPackageInto("pkg", "mine");
        expect(result.ok).toBe(true);
        expect(idea("mine", "theirs")).toBeDefined();
        expect(ws("pkg")).toBeUndefined();
    });
});

describe("a parcel or an archive never becomes where you work", () => {
    beforeEach(seed);

    it("setActiveWorkspaceId and setPrimaryWorkspaceId refuse them", () => {
        useStore.getState().setActiveWorkspaceId("pkg");
        useStore.getState().setActiveWorkspaceId("old");
        useStore.getState().setPrimaryWorkspaceId("pkg");
        expect(useStore.getState().activeWorkspaceId).toBe("mine");
        expect(useStore.getState().primaryWorkspaceId).toBe("mine");
    });

    it("deleting your only workspace gives you a fresh empty one, not the parcel (C-M1)", () => {
        useStore.getState().deleteWorkspace("mine");
        const state = useStore.getState();
        const active = state.workspaces.find((w) => w.id === state.activeWorkspaceId)!;
        expect(active).toBeDefined();
        expect(active.origin).toBeUndefined();
        expect(active.isArchived).toBeFalsy();
        expect(active.ideas).toHaveLength(0);
        expect(state.primaryWorkspaceId).toBe(active.id);
        expect(state.lastUsedWorkspaceId).toBe(active.id);
    });

    it("deleting the active one of two falls back to the other personal one", () => {
        useStore.setState({
            workspaces: [...useStore.getState().workspaces, workspace("band", [])],
        } as never);
        useStore.getState().deleteWorkspace("mine");
        expect(useStore.getState().activeWorkspaceId).toBe("band");
        expect(useStore.getState().primaryWorkspaceId).toBe("band");
    });

    it("hydration never lands in a parcel", () => {
        const sanitized = sanitizePersistedState({
            workspaces: [
                workspace("pkg", [], { origin: "received", received }),
                workspace("mine", []),
            ] as never,
            activeWorkspaceId: "pkg",
            primaryWorkspaceId: "pkg",
        } as never);
        expect(sanitized.activeWorkspaceId).toBe("mine");
        expect(sanitized.primaryWorkspaceId).toBe("mine");
    });
});
