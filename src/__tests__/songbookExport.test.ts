import { buildSongbookArchive, trimIdeaForSongbook } from "../domain/songbookExport";
import type { Songbook, SongIdea, Workspace } from "../types";

const lyrics = {
  versions: [
    { id: "v1", createdAt: 1, updatedAt: 1, document: { lines: [{ id: "l1", text: "one", chords: [] }] } },
    { id: "v2", createdAt: 2, updatedAt: 2, document: { lines: [{ id: "l2", text: "two", chords: [] }] } },
  ],
};
const chordSheet = {
  updatedAt: 1,
  sections: [{ id: "s1", label: "A", notes: "", measures: [{ id: "m1", chords: ["C"] }] }],
};

function makeIdea(id: string, overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    id,
    title: id,
    notes: "private working notes",
    status: "seed",
    completionPct: 0,
    kind: "project",
    collectionId: "col",
    clips: [{ id: `${id}-c1`, title: "take", notes: "", createdAt: 1, isPrimary: true, audioUri: "file://x.m4a" }],
    createdAt: 1,
    lastActivityAt: 1,
    ...overrides,
  } as SongIdea;
}

const workspace: Workspace = {
  id: "ws",
  title: "WS",
  collections: [],
  ideas: [makeIdea("song-a", { lyrics, chordSheet }), makeIdea("song-b", { chordSheet })],
  isArchived: false,
} as unknown as Workspace;

function makeBook(items: Songbook["items"]): Songbook {
  return { id: "sb", title: "The Blue Book", createdAt: 1, updatedAt: 1, items };
}

describe("trimIdeaForSongbook", () => {
  it("keeps only referenced charts, drops audio/notes/history", () => {
    const trimmed = trimIdeaForSongbook(makeIdea("song-a", { lyrics, chordSheet }), ["v2"], true, "col-x", 99);
    expect(trimmed.clips).toEqual([]);
    expect(trimmed.notes).toBe("");
    expect(trimmed.lyrics?.versions.map((v) => v.id)).toEqual(["v2"]);
    expect(trimmed.chordSheet).toBe(chordSheet);
    expect(trimmed.collectionId).toBe("col-x");
  });

  it("drops the chord sheet when not referenced", () => {
    const trimmed = trimIdeaForSongbook(makeIdea("song-a", { lyrics, chordSheet }), [], false, "col-x", 99);
    expect(trimmed.chordSheet).toBeUndefined();
    expect(trimmed.lyrics).toBeUndefined();
  });
});

describe("buildSongbookArchive", () => {
  it("packages a charts-only workspace plus the remapped songbook", () => {
    const book = makeBook([
      { id: "i1", kind: "lyricChart", workspaceId: "ws", ideaId: "song-a", versionId: "v2", addedAt: 1 },
      { id: "i2", kind: "chordChart", workspaceId: "ws", ideaId: "song-a", addedAt: 2 },
      { id: "i3", kind: "chordChart", workspaceId: "ws", ideaId: "song-b", addedAt: 3 },
    ]);
    const archive = buildSongbookArchive(book, [workspace])!;
    expect(archive).not.toBeNull();
    expect(archive.songCount).toBe(2);
    expect(archive.chartCount).toBe(3);

    const [syntheticWs] = archive.workspaces;
    expect(syntheticWs!.ideas.every((idea) => idea.clips.length === 0)).toBe(true);
    expect(syntheticWs!.ideas[0]!.lyrics?.versions.map((v) => v.id)).toEqual(["v2"]);

    // The manifest songbook references the synthetic workspace and the SAME
    // idea/version ids the trimmed ideas kept — import remaps them together.
    expect(archive.songbook.title).toBe("The Blue Book");
    expect(archive.songbook.items).toHaveLength(3);
    expect(archive.songbook.items.every((item) => item.workspaceId === syntheticWs!.id)).toBe(true);
    expect(archive.songbook.items[0]).toMatchObject({ ideaId: "song-a", versionId: "v2" });
  });

  it("skips vanished songs and dead charts; null when nothing survives", () => {
    const book = makeBook([
      { id: "i1", kind: "lyricChart", workspaceId: "ws", ideaId: "gone", versionId: "vX", addedAt: 1 },
      { id: "i2", kind: "lyricChart", workspaceId: "ws", ideaId: "song-b", versionId: "not-real", addedAt: 2 },
    ]);
    expect(buildSongbookArchive(book, [workspace])).toBeNull();
  });
});
