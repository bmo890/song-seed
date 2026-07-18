import {
  availableViewsForSong,
  buildDefaultSongbookItemsForIdea,
  flattenGroupedOrder,
  groupSongbookItems,
} from "../songbookGrouping";
import type { Songbook, SongIdea, Workspace } from "../../types";

function makeIdea(overrides: Partial<SongIdea> & { id: string }): SongIdea {
  return {
    title: overrides.id,
    notes: "",
    status: "seed",
    completionPct: 0,
    kind: "project",
    collectionId: "col-1",
    clips: [],
    createdAt: 1,
    lastActivityAt: 1,
    ...overrides,
  } as SongIdea;
}

const lyrics = {
  versions: [
    { id: "v1", createdAt: 1, updatedAt: 1, document: { lines: [{ id: "l1", text: "la", chords: [] }] } },
    {
      id: "v2",
      createdAt: 2,
      updatedAt: 2,
      document: { lines: [{ id: "l2", text: "la", chords: [{ id: "c1", chord: "C", at: 0 }] }] },
    },
  ],
};

const chordSheet = { updatedAt: 1, sections: [{ id: "s1", label: "A", notes: "", measures: [{ id: "m1", chords: ["C"] }] }] };

const workspace: Workspace = {
  id: "ws-1",
  title: "Field Notes",
  collections: [],
  ideas: [
    makeIdea({ id: "song-a", title: "Hollow Moon", lyrics, chordSheet }),
    makeIdea({ id: "song-b", title: "Slow Water", chordSheet }),
  ],
  isArchived: false,
} as unknown as Workspace;

function makeBook(items: Songbook["items"]): Songbook {
  return { id: "sb-1", title: "The Blue Book", createdAt: 1, updatedAt: 1, items };
}

describe("groupSongbookItems", () => {
  it("groups items per song in first-appearance order", () => {
    const book = makeBook([
      { id: "i1", kind: "lyricChart", workspaceId: "ws-1", ideaId: "song-a", versionId: "v2", addedAt: 1 },
      { id: "i2", kind: "chordChart", workspaceId: "ws-1", ideaId: "song-b", addedAt: 2 },
      { id: "i3", kind: "chordChart", workspaceId: "ws-1", ideaId: "song-a", addedAt: 3 },
    ]);
    const groups = groupSongbookItems(book, [workspace]);
    expect(groups.map((group) => group.ideaId)).toEqual(["song-a", "song-b"]);
    expect(groups[0]!.charts.map((chart) => chart.itemId)).toEqual(["i1", "i3"]);
    expect(groups[0]!.hasLyricChart).toBe(true);
    expect(groups[0]!.hasChordChart).toBe(true);
    expect(groups[1]!.hasLyricChart).toBe(false);
  });

  it("keeps deleted-song groups as unavailable rows", () => {
    const book = makeBook([
      { id: "i1", kind: "lyricChart", workspaceId: "ws-1", ideaId: "gone", versionId: "vX", addedAt: 1 },
    ]);
    const groups = groupSongbookItems(book, [workspace]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.available).toBe(false);
    expect(groups[0]!.title).toBe("Unavailable song");
  });

  it("marks charts whose version vanished as unavailable", () => {
    const book = makeBook([
      { id: "i1", kind: "lyricChart", workspaceId: "ws-1", ideaId: "song-a", versionId: "deleted", addedAt: 1 },
    ]);
    const groups = groupSongbookItems(book, [workspace]);
    expect(groups[0]!.available).toBe(true);
    expect(groups[0]!.charts[0]!.available).toBe(false);
    expect(groups[0]!.hasLyricChart).toBe(false);
  });
});

describe("flattenGroupedOrder", () => {
  it("round-trips a group reorder back to contiguous flat item ids", () => {
    const book = makeBook([
      { id: "i1", kind: "lyricChart", workspaceId: "ws-1", ideaId: "song-a", versionId: "v2", addedAt: 1 },
      { id: "i2", kind: "chordChart", workspaceId: "ws-1", ideaId: "song-b", addedAt: 2 },
      { id: "i3", kind: "chordChart", workspaceId: "ws-1", ideaId: "song-a", addedAt: 3 },
    ]);
    const groups = groupSongbookItems(book, [workspace]);
    // Move song-b first (a user drag).
    const reordered = [groups[1]!, groups[0]!];
    expect(flattenGroupedOrder(reordered)).toEqual(["i2", "i1", "i3"]);
    // Identity order preserves every id exactly once.
    expect(flattenGroupedOrder(groups).sort()).toEqual(["i1", "i2", "i3"]);
  });
});

describe("buildDefaultSongbookItemsForIdea", () => {
  it("picks the latest lyric version + chord chart when present", () => {
    const idea = makeIdea({ id: "song-a", lyrics, chordSheet });
    expect(buildDefaultSongbookItemsForIdea(idea)).toEqual([
      { kind: "lyricChart", versionId: "v2" },
      { kind: "chordChart" },
    ]);
  });

  it("returns only what exists", () => {
    expect(buildDefaultSongbookItemsForIdea(makeIdea({ id: "x", chordSheet }))).toEqual([
      { kind: "chordChart" },
    ]);
    expect(buildDefaultSongbookItemsForIdea(makeIdea({ id: "y" }))).toEqual([]);
  });
});

describe("availableViewsForSong", () => {
  it("derives views from what the book holds for the song", () => {
    const both = groupSongbookItems(
      makeBook([
        { id: "i1", kind: "lyricChart", workspaceId: "ws-1", ideaId: "song-a", versionId: "v2", addedAt: 1 },
        { id: "i2", kind: "chordChart", workspaceId: "ws-1", ideaId: "song-a", addedAt: 2 },
      ]),
      [workspace]
    )[0]!;
    expect(availableViewsForSong(both)).toEqual(["lyrics", "chart", "grid"]);

    // v1 has no chords → no "chart" view, just plain lyrics.
    const plain = groupSongbookItems(
      makeBook([
        { id: "i1", kind: "lyricChart", workspaceId: "ws-1", ideaId: "song-a", versionId: "v1", addedAt: 1 },
      ]),
      [workspace]
    )[0]!;
    expect(availableViewsForSong(plain)).toEqual(["lyrics"]);
  });
});
