jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import { createStore } from "zustand/vanilla";
import { createDataSlice, type DataSlice } from "../dataSlice";

/**
 * Pins the Playlist / Songbook / Setlist CRUD behavior — including the deliberate
 * per-entity guard differences — so the shared updateEntityList/reorderByIds helpers
 * can't drift from what shipped:
 *  - renamePlaylist with an empty title is a full no-op (updatedAt untouched);
 *    renameSongbook/renameSetlist keep the old title but DO bump updatedAt.
 *  - addItemsTo* skips empty batches entirely.
 *  - reorder drops unknown ids and appends any items the caller omitted, in
 *    their original order — nothing is ever lost by a partial reorder.
 */

function makeStore() {
    // The CRUD under test only touches playlists/songbooks/setlists, so the data
    // slice alone (without the player/recording/selection slices) is sufficient.
    return createStore<DataSlice>()((set, get, api) =>
        createDataSlice(set as never, get as never, api as never)
    );
}

const itemInput = (n: number) => ({
    kind: "clip" as const,
    workspaceId: "ws-1",
    collectionId: "col-1",
    ideaId: `idea-${n}`,
    clipId: `clip-${n}`,
});

describe("playlists", () => {
    it("addPlaylist trims the title, defaults when blank, prepends, and returns the id", () => {
        const store = makeStore();
        const first = store.getState().addPlaylist("  Road Trip  ");
        const second = store.getState().addPlaylist("   ");

        const playlists = store.getState().playlists;
        expect(playlists.map((p) => p.id)).toEqual([second, first]);
        expect(playlists[1]?.title).toBe("Road Trip");
        expect(playlists[0]?.title).toBe("Untitled Playlist");
        expect(playlists[0]?.items).toEqual([]);
    });

    it("addItemsToPlaylist appends with unique ids and staggered addedAt; empty batch is a no-op", () => {
        const store = makeStore();
        const id = store.getState().addPlaylist("Mix");
        const before = store.getState().playlists[0]!;

        store.getState().addItemsToPlaylist(id, []);
        expect(store.getState().playlists[0]).toBe(before); // no-op keeps the same object

        store.getState().addItemsToPlaylist(id, [itemInput(1), itemInput(2)]);
        const playlist = store.getState().playlists[0]!;
        expect(playlist.items).toHaveLength(2);
        expect(playlist.items[0]?.ideaId).toBe("idea-1");
        expect(new Set(playlist.items.map((i) => i.id)).size).toBe(2);
        expect(playlist.items[1]!.addedAt).toBeGreaterThan(playlist.items[0]!.addedAt);
        expect(playlist.updatedAt).toBeGreaterThanOrEqual(before.updatedAt);
    });

    it("renamePlaylist with a blank title is a FULL no-op (state object unchanged)", () => {
        const store = makeStore();
        const id = store.getState().addPlaylist("Keep Me");
        const before = store.getState().playlists[0]!;

        store.getState().renamePlaylist(id, "   ");
        expect(store.getState().playlists[0]).toBe(before);

        store.getState().renamePlaylist(id, " New Name ");
        expect(store.getState().playlists[0]?.title).toBe("New Name");
    });

    it("removePlaylistItem and deletePlaylist", () => {
        const store = makeStore();
        const id = store.getState().addPlaylist("Mix");
        store.getState().addItemsToPlaylist(id, [itemInput(1), itemInput(2)]);
        const [a] = store.getState().playlists[0]!.items;

        store.getState().removePlaylistItem(id, a!.id);
        expect(store.getState().playlists[0]?.items.map((i) => i.ideaId)).toEqual(["idea-2"]);

        store.getState().deletePlaylist(id);
        expect(store.getState().playlists).toEqual([]);
    });
});

describe("reorder semantics (shared by playlists, songbooks, setlists)", () => {
    it("reorders to the requested order and drops unknown ids", () => {
        const store = makeStore();
        const id = store.getState().addPlaylist("Mix");
        store.getState().addItemsToPlaylist(id, [itemInput(1), itemInput(2), itemInput(3)]);
        const ids = store.getState().playlists[0]!.items.map((i) => i.id);

        store.getState().reorderPlaylistItems(id, [ids[2]!, "ghost-id", ids[0]!, ids[1]!]);
        expect(store.getState().playlists[0]!.items.map((i) => i.ideaId)).toEqual([
            "idea-3",
            "idea-1",
            "idea-2",
        ]);
    });

    it("appends items the caller omitted instead of losing them", () => {
        const store = makeStore();
        const id = store.getState().addPlaylist("Mix");
        store.getState().addItemsToPlaylist(id, [itemInput(1), itemInput(2), itemInput(3)]);
        const ids = store.getState().playlists[0]!.items.map((i) => i.id);

        store.getState().reorderPlaylistItems(id, [ids[1]!]);
        expect(store.getState().playlists[0]!.items.map((i) => i.ideaId)).toEqual([
            "idea-2",
            "idea-1",
            "idea-3",
        ]);
    });

    it("never drops an omitted item even when the ordering repeats an id", () => {
        // A repeated id makes the reordered list the same LENGTH as the original,
        // which used to satisfy the playlist implementation's length guard and
        // silently drop the omitted item. All three entities now share the safe
        // append-missing behavior that songbooks/setlists always had.
        const store = makeStore();
        const id = store.getState().addPlaylist("Mix");
        store.getState().addItemsToPlaylist(id, [itemInput(1), itemInput(2)]);
        const ids = store.getState().playlists[0]!.items.map((i) => i.id);

        store.getState().reorderPlaylistItems(id, [ids[0]!, ids[0]!]);
        const ideaIds = store.getState().playlists[0]!.items.map((i) => i.ideaId);
        expect(ideaIds).toContain("idea-2");
    });
});

describe("songbooks", () => {
    it("full CRUD round-trip with the songbook rename semantics (blank keeps title, bumps updatedAt)", () => {
        const store = makeStore();
        const id = store.getState().addSongbook("   ");
        expect(store.getState().songbooks[0]?.title).toBe("Untitled Songbook");

        store.getState().addItemsToSongbook(id, [{ ideaId: "idea-1" } as never, { ideaId: "idea-2" } as never]);
        const before = store.getState().songbooks[0]!;
        expect(before.items).toHaveLength(2);

        store.getState().renameSongbook(id, "   ");
        const after = store.getState().songbooks[0]!;
        expect(after.title).toBe("Untitled Songbook");
        expect(after).not.toBe(before); // songbook rename always rewrites (bumps updatedAt)

        const ids = after.items.map((i) => i.id);
        store.getState().reorderSongbookItems(id, [ids[1]!, ids[0]!]);
        expect(store.getState().songbooks[0]!.items.map((i) => i.ideaId)).toEqual(["idea-2", "idea-1"]);

        store.getState().removeSongbookItem(id, ids[0]!);
        expect(store.getState().songbooks[0]!.items).toHaveLength(1);

        store.getState().deleteSongbook(id);
        expect(store.getState().songbooks).toEqual([]);
    });
});

describe("setlists", () => {
    it("addSetlistEntry appends one entry; updateSetlistEntry patches in place", () => {
        const store = makeStore();
        const id = store.getState().addSetlist("Gig");

        store.getState().addSetlistEntry(id, { ideaId: "idea-1" } as never);
        store.getState().addSetlistEntry(id, { ideaId: "idea-2" } as never);
        const entries = store.getState().setlists[0]!.entries;
        expect(entries.map((e) => (e as { ideaId?: string }).ideaId)).toEqual(["idea-1", "idea-2"]);
        expect(new Set(entries.map((e) => e.id)).size).toBe(2);

        store.getState().updateSetlistEntry(id, entries[0]!.id, { note: "capo 2" } as never);
        expect((store.getState().setlists[0]!.entries[0] as { note?: string }).note).toBe("capo 2");
    });

    it("rename/reorder/remove/delete mirror the songbook semantics", () => {
        const store = makeStore();
        const id = store.getState().addSetlist("   ");
        expect(store.getState().setlists[0]?.title).toBe("Untitled Setlist");

        store.getState().addSetlistEntry(id, { ideaId: "idea-1" } as never);
        store.getState().addSetlistEntry(id, { ideaId: "idea-2" } as never);
        const ids = store.getState().setlists[0]!.entries.map((e) => e.id);

        store.getState().reorderSetlistEntries(id, [ids[1]!]);
        expect(
            store.getState().setlists[0]!.entries.map((e) => (e as { ideaId?: string }).ideaId)
        ).toEqual(["idea-2", "idea-1"]);

        store.getState().renameSetlist(id, "  Encore  ");
        expect(store.getState().setlists[0]?.title).toBe("Encore");

        store.getState().removeSetlistEntry(id, ids[0]!);
        expect(store.getState().setlists[0]!.entries).toHaveLength(1);

        store.getState().deleteSetlist(id);
        expect(store.getState().setlists).toEqual([]);
    });
});
