import {
  buildSetlistQueue,
  getSetlistDurationMs,
  resolveSetlistEntries,
} from "../setlistPlayback";
import type { ClipVersion, Setlist, SongIdea, Workspace } from "../../types";

function makeClip(id: string, overrides: Partial<ClipVersion> = {}): ClipVersion {
  return {
    id,
    title: id,
    notes: "take note",
    createdAt: 1,
    isPrimary: false,
    audioUri: `file://${id}.m4a`,
    durationMs: 60_000,
    sections: [{ id: `${id}-s1`, label: "Verse", startMs: 0, endMs: 10_000 }] as any,
    practiceMarkers: [{ id: `${id}-p1`, label: "Solo", atMs: 5_000 }],
    ...overrides,
  } as ClipVersion;
}

function makeIdea(id: string, clips: ClipVersion[], overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    id,
    title: id,
    notes: "song note",
    status: "seed",
    completionPct: 0,
    kind: "project",
    collectionId: "col",
    clips,
    createdAt: 1,
    lastActivityAt: 1,
    ...overrides,
  } as SongIdea;
}

const workspace: Workspace = {
  id: "ws",
  title: "WS",
  collections: [],
  ideas: [
    makeIdea("song-a", [makeClip("a1", { isPrimary: true }), makeClip("a2")]),
    makeIdea("song-b", [makeClip("b1", { isPrimary: true })]),
  ],
  isArchived: false,
} as unknown as Workspace;

function makeSetlist(entries: Setlist["entries"]): Setlist {
  return { id: "sl", title: "Show", createdAt: 1, updatedAt: 1, entries };
}

describe("resolveSetlistEntries", () => {
  it("resolves parts in chosen order with section/pin counts and durations", () => {
    const setlist = makeSetlist([
      {
        id: "e1",
        workspaceId: "ws",
        ideaId: "song-a",
        clipIds: ["a2", "a1"],
        lyricVersionIds: [],
        includeChordSheet: false,
        includeSongNotes: true,
        addedAt: 1,
      },
    ]);
    const [entry] = resolveSetlistEntries([workspace], setlist);
    expect(entry!.parts.map((part) => part.clipId)).toEqual(["a2", "a1"]);
    expect(entry!.parts[0]).toMatchObject({ sectionCount: 1, pinCount: 1, available: true });
    expect(entry!.durationMs).toBe(120_000);
    expect(entry!.songNotes).toBe("song note");
  });

  it("hides song notes unless packed, and drops stale lyric versions", () => {
    const setlist = makeSetlist([
      {
        id: "e1",
        workspaceId: "ws",
        ideaId: "song-b",
        clipIds: ["b1"],
        lyricVersionIds: ["gone"],
        includeChordSheet: true,
        addedAt: 1,
      },
    ]);
    const [entry] = resolveSetlistEntries([workspace], setlist);
    expect(entry!.songNotes).toBe("");
    expect(entry!.lyricVersionIds).toEqual([]);
    expect(entry!.hasChordChart).toBe(false); // no chordSheet on the idea
  });

  it("falls back to the playable clip when every chosen clip was deleted", () => {
    const setlist = makeSetlist([
      {
        id: "e1",
        workspaceId: "ws",
        ideaId: "song-a",
        clipIds: ["deleted-1", "deleted-2"],
        lyricVersionIds: [],
        includeChordSheet: false,
        addedAt: 1,
      },
    ]);
    const [entry] = resolveSetlistEntries([workspace], setlist);
    expect(entry!.parts).toHaveLength(1);
    expect(entry!.parts[0]!.clipId).toBe("a1"); // the primary
    expect(entry!.available).toBe(true);
  });

  it("marks entries whose song vanished as unavailable", () => {
    const setlist = makeSetlist([
      {
        id: "e1",
        workspaceId: "ws",
        ideaId: "gone",
        clipIds: [],
        lyricVersionIds: [],
        includeChordSheet: false,
        addedAt: 1,
      },
    ]);
    const [entry] = resolveSetlistEntries([workspace], setlist);
    expect(entry!.available).toBe(false);
    expect(entry!.title).toBe("Unavailable song");
  });
});

describe("buildSetlistQueue", () => {
  const setlist = makeSetlist([
    { id: "e1", workspaceId: "ws", ideaId: "song-a", clipIds: ["a1", "a2"], lyricVersionIds: [], includeChordSheet: false, addedAt: 1 },
    { id: "e2", workspaceId: "ws", ideaId: "song-b", clipIds: ["b1"], lyricVersionIds: [], includeChordSheet: false, addedAt: 2 },
  ]);

  it("flattens every entry's parts and honors start entry/clip", () => {
    const entries = resolveSetlistEntries([workspace], setlist);
    const all = buildSetlistQueue(entries);
    expect(all.queue.map((item) => item.clipId)).toEqual(["a1", "a2", "b1"]);
    expect(all.startIndex).toBe(0);

    const fromB = buildSetlistQueue(entries, "e2");
    expect(fromB.startIndex).toBe(2);

    const fromA2 = buildSetlistQueue(entries, "e1", "a2");
    expect(fromA2.startIndex).toBe(1);
  });

  it("sums only known durations", () => {
    const entries = resolveSetlistEntries([workspace], setlist);
    expect(getSetlistDurationMs(entries)).toBe(180_000);
    expect(getSetlistDurationMs([])).toBeNull();
  });
});
