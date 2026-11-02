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
 * Setlist entries and chart-book items carry the workspace of their song. Moves
 * across workspaces never updated it, and deleting the old workspace then pruned
 * the entries by that stale id: "Keep" on a received setlist parcel left the
 * setlist and chart book with 0 entries (data-safety audit 04-H1).
 */

const OLD = Date.now() - 7 * 24 * 60 * 60 * 1000;

const song = (id: string, collectionId: string) => ({
    id,
    title: id,
    notes: "",
    status: "seed",
    completionPct: 0,
    kind: "project",
    collectionId,
    createdAt: OLD,
    lastActivityAt: OLD,
    clips: [{ id: `${id}-take`, title: id, notes: "", createdAt: OLD, isPrimary: true, audioUri: `file:///${id}.m4a` }],
    lyrics: { versions: [] },
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

const received = { senderName: "Dana", transferId: "t1", receivedAt: OLD, shareKind: "setlist", shareTitle: "Gig" };

function seed() {
    useStore.setState({
        activeWorkspaceId: "mine",
        primaryWorkspaceId: "mine",
        workspaces: [
            workspace("pkg", [song("s1", "pkg-col"), song("s2", "pkg-col")], { origin: "received", received }),
            workspace("mine", []),
            workspace("band", [song("b1", "band-col")]),
        ],
        activityEvents: [],
        playlists: [],
        setlists: [
            {
                id: "set",
                title: "Gig",
                createdAt: OLD,
                updatedAt: OLD,
                received,
                entries: [
                    { id: "e1", workspaceId: "pkg", ideaId: "s1", clipIds: ["s1-take"], lyricVersionIds: [], includeChordSheet: true, addedAt: OLD },
                    { id: "e2", workspaceId: "pkg", ideaId: "s2", clipIds: ["s2-take"], lyricVersionIds: [], includeChordSheet: true, addedAt: OLD },
                    { id: "e3", workspaceId: "band", ideaId: "b1", clipIds: [], lyricVersionIds: [], includeChordSheet: false, addedAt: OLD },
                ],
            },
        ],
        songbooks: [
            {
                id: "book",
                title: "Charts",
                createdAt: OLD,
                updatedAt: OLD,
                received,
                items: [
                    { id: "i1", kind: "chordChart", workspaceId: "pkg", ideaId: "s1", addedAt: OLD },
                    { id: "i3", kind: "chordChart", workspaceId: "band", ideaId: "b1", addedAt: OLD },
                ],
            },
        ],
        clipClipboard: null,
        selectedListIdeaIds: [],
    } as never);
}

const set = () => useStore.getState().setlists[0]!;
const book = () => useStore.getState().songbooks[0]!;

beforeAll(() => jest.spyOn(console, "warn").mockImplementation(() => {}));

describe("setlists and chart books follow their songs", () => {
    beforeEach(seed);

    it("Keep on a received setlist parcel keeps the set and the book, pointing at your workspace (04-H1)", () => {
        expect(useStore.getState().adoptReceivedPackageInto("pkg", "mine").ok).toBe(true);
        expect(set().entries.map((entry) => [entry.ideaId, entry.workspaceId])).toEqual([
            ["s1", "mine"],
            ["s2", "mine"],
            ["b1", "band"],
        ]);
        expect(book().items.map((item) => [item.ideaId, item.workspaceId])).toEqual([
            ["s1", "mine"],
            ["b1", "band"],
        ]);
    });

    it("a collection moved to another workspace takes its set entries along; deleting the old one keeps them", () => {
        expect(useStore.getState().moveCollection("band-col", "mine").ok).toBe(true);
        expect(set().entries.find((entry) => entry.ideaId === "b1")!.workspaceId).toBe("mine");
        useStore.getState().deleteWorkspace("band");
        expect(set().entries.map((entry) => entry.ideaId)).toContain("b1");
        expect(book().items.map((item) => item.ideaId)).toContain("b1");
    });

    it("a song pasted (moved) into another workspace takes its entries along", async () => {
        useStore.setState({ selectedListIdeaIds: ["b1"] } as never);
        appActions.startClipboardFromList("move", "band");
        expect(await appActions.pasteClipboardToCollection("mine-col")).toEqual(["b1"]);
        expect(set().entries.find((entry) => entry.ideaId === "b1")!.workspaceId).toBe("mine");
        expect(book().items.find((item) => item.ideaId === "b1")!.workspaceId).toBe("mine");
    });

    it("a deleted workspace still takes the entries of songs that were really in it", () => {
        useStore.getState().deleteWorkspace("band");
        expect(set().entries.map((entry) => entry.ideaId)).toEqual(["s1", "s2"]);
    });
});
