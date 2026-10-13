import { compilationsWithinScope } from "../scopedCompilations";
import type { Playlist, Setlist, Songbook } from "../../types";

const setlist = (id: string, ideaIds: string[]): Setlist => ({
  id,
  title: id,
  createdAt: 1,
  updatedAt: 1,
  entries: ideaIds.map((ideaId, i) => ({
    id: `${id}-e${i}`,
    workspaceId: "ws",
    ideaId,
    clipIds: [],
    lyricVersionIds: [],
    includeChordSheet: false,
    addedAt: 1,
  })),
});

const songbook = (id: string, ideaIds: string[]): Songbook => ({
  id,
  title: id,
  createdAt: 1,
  updatedAt: 1,
  items: ideaIds.map((ideaId, i) => ({ id: `${id}-i${i}`, kind: "chordChart", workspaceId: "ws", ideaId, addedAt: 1 })),
});

const playlist = (id: string, ideaIds: string[]): Playlist => ({
  id,
  title: id,
  createdAt: 1,
  updatedAt: 1,
  items: ideaIds.map((ideaId, i) => ({
    id: `${id}-p${i}`,
    kind: "song",
    workspaceId: "ws",
    collectionId: "col",
    ideaId,
    addedAt: 1,
  })),
});

describe("compilationsWithinScope", () => {
  const library = {
    setlists: [setlist("inside", ["a", "b"]), setlist("straddles", ["a", "z"]), setlist("empty", [])],
    songbooks: [songbook("book-in", ["b"]), songbook("book-out", ["z"])],
    playlists: [playlist("mix-in", ["a", "a"]), playlist("mix-out", ["q"])],
  };
  const scope = new Set(["a", "b", "c"]);

  it("keeps only compilations whose every song is inside the shared scope", () => {
    const out = compilationsWithinScope(library, scope);
    expect(out.setlists.map((s) => s.id)).toEqual(["inside"]);
    expect(out.songbooks.map((s) => s.id)).toEqual(["book-in"]);
    expect(out.playlists.map((p) => p.id)).toEqual(["mix-in"]);
  });

  it("a partial compilation never travels — it would arrive looking broken", () => {
    const out = compilationsWithinScope(library, new Set(["a"]));
    expect(out.setlists).toEqual([]);
    expect(out.songbooks).toEqual([]);
    expect(out.playlists.map((p) => p.id)).toEqual(["mix-in"]);
  });

  it("an empty compilation never travels", () => {
    const out = compilationsWithinScope({ setlists: [setlist("empty", [])], songbooks: [], playlists: [] }, scope);
    expect(out.setlists).toEqual([]);
  });
});
