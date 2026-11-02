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

import { buildPersistedAppStoreSnapshot, sanitizePersistedState, useStore } from "../useStore";
import {
    deleteRecentlyDeletedPermanently,
    purgeExpiredRecentlyDeleted,
    restoreRecentlyDeleted,
} from "../recentlyDeletedActions";
import { deletedItemDaysLeft, RECENTLY_DELETED_MS } from "../recentlyDeleted";
import { planShardedWrite, assembleShardedSnapshot, parseMetaRow } from "../persistSharding";
import { setHydrationReadOutcome } from "../persistRuntime";

/**
 * Decision A (founder, 2026-11-02): a delete keeps the thing whole for 30 days in
 * Recently deleted, and Restore puts it back where it was, ids intact, with what
 * pointed at it. 04-H6 / 03-10: the "Trash" the copy promised could not be opened.
 */

const OLD = Date.now() - 7 * 24 * 60 * 60 * 1000;

const sketch = (id: string, collectionId: string) => ({
    id,
    title: `Song ${id}`,
    notes: "sketch notes",
    status: "seed",
    completionPct: 0,
    kind: "project",
    collectionId,
    createdAt: OLD,
    lastActivityAt: OLD,
    clips: [
        { id: `${id}-t1`, title: "Take 1", notes: "", createdAt: OLD, isPrimary: true, audioUri: `file:///docs/songnook/audio/${id}-t1.m4a` },
        { id: `${id}-t2`, title: "Take 2", notes: "", createdAt: OLD, isPrimary: false, parentClipId: `${id}-t1`, audioUri: `file:///docs/songnook/audio/${id}-t2.m4a` },
    ],
    lyrics: { versions: [{ id: `${id}-v1`, createdAt: OLD, updatedAt: OLD, document: { lines: [] } }] },
    chordSheet: { sections: [] },
});

const collection = (id: string, workspaceId: string, parentCollectionId: string | null = null) => ({
    id,
    title: id,
    workspaceId,
    parentCollectionId,
    createdAt: OLD,
    updatedAt: OLD,
    ideasListState: { hiddenIdeaIds: [], hiddenDays: [] },
});

function seed() {
    useStore.setState({
        activeWorkspaceId: "mine",
        primaryWorkspaceId: "mine",
        primaryCollectionIdByWorkspace: { mine: "ideas" },
        workspaces: [
            {
                id: "mine",
                title: "Mine",
                collections: [collection("ideas", "mine"), collection("demos", "mine"), collection("old", "mine", "demos")],
                ideas: [sketch("s1", "ideas"), sketch("s2", "demos"), sketch("s3", "old")],
            },
            { id: "band", title: "Band", collections: [collection("band-col", "band")], ideas: [sketch("b1", "band-col")] },
        ] as never,
        activityEvents: [
            { id: "ev1", at: OLD, workspaceId: "mine", collectionId: "ideas", ideaId: "s1", ideaKind: "song", metric: "created", source: "song-save", ideaTitle: "Song s1" },
        ] as never,
        playlists: [],
        songbooks: [],
        setlists: [
            {
                id: "set",
                title: "Gig",
                createdAt: OLD,
                updatedAt: OLD,
                entries: [
                    { id: "e0", workspaceId: "band", ideaId: "b1", clipIds: [], lyricVersionIds: [], includeChordSheet: false, addedAt: OLD },
                    { id: "e1", workspaceId: "mine", ideaId: "s1", clipIds: ["s1-t1"], lyricVersionIds: ["s1-v1"], includeChordSheet: true, addedAt: OLD },
                    { id: "e2", workspaceId: "band", ideaId: "b1", clipIds: [], lyricVersionIds: [], includeChordSheet: false, addedAt: OLD },
                ],
            },
        ],
        notes: [{ id: "n1", title: "Verse", body: "words", createdAt: OLD, updatedAt: OLD, isPinned: false }],
        recentlyDeleted: [],
    });
}

const idea = (id: string) =>
    useStore.getState().workspaces.flatMap((workspace) => workspace.ideas).find((candidate) => candidate.id === id);

beforeAll(() => setHydrationReadOutcome("data"));
beforeEach(seed);

describe("Recently deleted", () => {
    it("keeps a deleted sketch whole and Restore puts it back where it was, links included", async () => {
        const ids = useStore.getState().deleteIdea("s1");
        expect(ids).toHaveLength(1);
        expect(idea("s1")).toBeUndefined();
        expect(useStore.getState().setlists[0]!.entries.map((entry) => entry.id)).toEqual(["e0", "e2"]);
        const record = useStore.getState().recentlyDeleted[0]!;
        expect(record.kind).toBe("idea");
        expect(record.ideas![0]!.lyrics!.versions).toHaveLength(1);
        expect(record.ideas![0]!.clips).toHaveLength(2);

        const outcomes = await restoreRecentlyDeleted(ids);
        expect(outcomes[0]!.status).toBe("restored");
        const back = idea("s1")!;
        expect(back.collectionId).toBe("ideas");
        expect(back.clips.map((clip) => clip.id)).toEqual(["s1-t1", "s1-t2"]);
        expect(back.clips[1]!.parentClipId).toBe("s1-t1");
        expect(back.notes).toBe("sketch notes");
        // The setlist entry is back in its old place, and the activity with it.
        expect(useStore.getState().setlists[0]!.entries.map((entry) => entry.id)).toEqual(["e0", "e1", "e2"]);
        expect(useStore.getState().activityEvents.map((event) => event.id)).toContain("ev1");
        expect(useStore.getState().recentlyDeleted).toHaveLength(0);
    });

    it("keeps a collection with its child collections and ideas", async () => {
        const ids = useStore.getState().deleteCollection("demos");
        expect(idea("s2")).toBeUndefined();
        expect(idea("s3")).toBeUndefined();
        const record = useStore.getState().recentlyDeleted[0]!;
        expect(record.kind).toBe("collection");
        expect(record.collections!.map((c) => c.id).sort()).toEqual(["demos", "old"]);

        await restoreRecentlyDeleted(ids);
        const mine = useStore.getState().workspaces.find((workspace) => workspace.id === "mine")!;
        expect(mine.collections.map((c) => c.id)).toEqual(expect.arrayContaining(["demos", "old"]));
        expect(mine.collections.find((c) => c.id === "old")!.parentCollectionId).toBe("demos");
        expect(idea("s2")!.collectionId).toBe("demos");
        expect(idea("s3")!.collectionId).toBe("old");
    });

    it("an idea whose workspace is gone comes back to your primary workspace's top, said plainly", async () => {
        const [ideaRecord] = useStore.getState().deleteIdea("b1");
        useStore.getState().deleteWorkspace("band");
        const outcomes = await restoreRecentlyDeleted([ideaRecord!]);
        expect(outcomes[0]).toEqual(expect.objectContaining({ status: "moved", placeTitle: "Mine" }));
        expect(idea("b1")!.collectionId).toBe("ideas");
    });

    it("keeps a whole workspace and restores it in its place", async () => {
        const ids = useStore.getState().deleteWorkspace("band");
        expect(useStore.getState().workspaces.map((workspace) => workspace.id)).toEqual(["mine"]);
        // The band song's setlist entries went with it, and come back.
        expect(useStore.getState().setlists[0]!.entries.map((entry) => entry.id)).toEqual(["e1"]);
        await restoreRecentlyDeleted(ids);
        expect(useStore.getState().workspaces.map((workspace) => workspace.id)).toEqual(["mine", "band"]);
        expect(useStore.getState().setlists[0]!.entries.map((entry) => entry.id)).toEqual(["e0", "e1", "e2"]);
    });

    it("keeps setlists, Lyric Pad pages and sparks", async () => {
        const setIds = useStore.getState().deleteSetlist("set");
        const noteIds = useStore.getState().deleteNote("n1");
        expect(useStore.getState().setlists).toHaveLength(0);
        expect(useStore.getState().notes).toHaveLength(0);
        await restoreRecentlyDeleted([...setIds, ...noteIds]);
        expect(useStore.getState().setlists[0]!.entries).toHaveLength(3);
        expect(useStore.getState().notes[0]!.body).toBe("words");
    });

    it("an internal clean-up can opt out", () => {
        expect(useStore.getState().deleteCollection("demos", { recentlyDeleted: false })).toEqual([]);
        expect(useStore.getState().recentlyDeleted).toHaveLength(0);
    });

    it("Delete permanently drops the record; restoring it afterwards does nothing", async () => {
        const ids = useStore.getState().deleteIdea("s1");
        await deleteRecentlyDeletedPermanently(ids);
        expect(useStore.getState().recentlyDeleted).toHaveLength(0);
        expect(await restoreRecentlyDeleted(ids)).toEqual([]);
        expect(idea("s1")).toBeUndefined();
    });

    it("purges records past 30 days and keeps younger ones", async () => {
        useStore.getState().deleteIdea("s1");
        useStore.getState().deleteIdea("s2");
        const [newer, older] = useStore.getState().recentlyDeleted;
        useStore.setState({
            recentlyDeleted: [newer!, { ...older!, deletedAt: Date.now() - RECENTLY_DELETED_MS - 1000 }],
        });
        await purgeExpiredRecentlyDeleted();
        expect(useStore.getState().recentlyDeleted.map((item) => item.id)).toEqual([newer!.id]);
        expect(deletedItemDaysLeft(newer!)).toBe(30);
    });

    it("is part of the library: persisted, sanitized, and in its own row", () => {
        useStore.getState().deleteIdea("s1");
        const snapshot = buildPersistedAppStoreSnapshot(useStore.getState());
        expect(snapshot.recentlyDeleted).toHaveLength(1);
        const clean = sanitizePersistedState({ ...snapshot, recentlyDeleted: [...snapshot.recentlyDeleted, { junk: true } as never] });
        expect(clean.recentlyDeleted).toHaveLength(1);

        const plan = planShardedWrite("store", { state: snapshot, version: 13 }, new Map(), null, null);
        expect(plan.deletedRow).not.toBeNull();
        expect(JSON.parse(plan.metaRow.value).state.recentlyDeleted).toBeUndefined();
        const meta = parseMetaRow(plan.metaRow.value);
        if (meta.format !== "sharded") throw new Error("expected sharded");
        const rows = new Map(plan.dirtyWorkspaceRows.map((row) => [row.key, row.value]));
        const assembled = assembleShardedSnapshot("store", meta, rows, plan.activityRow?.value, plan.deletedRow!.value);
        expect(assembled.value.state.recentlyDeleted).toHaveLength(1);
        // Unchanged list: not rewritten.
        const next = planShardedWrite("store", { state: snapshot, version: 13 }, plan.nextWorkspaceRefs, plan.nextActivityRef, plan.nextDeletedRef);
        expect(next.deletedRow).toBeNull();
    });
});
