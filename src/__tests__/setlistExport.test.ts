import { buildSetlistArchive, trimIdeaForSetlistEntry } from "../setlistExport";
import type { ClipVersion, Setlist, SongIdea, Workspace } from "../types";

function clip(id: string, over: Partial<ClipVersion> = {}): ClipVersion {
  return {
    id,
    title: id,
    notes: "",
    createdAt: 1,
    isPrimary: false,
    audioUri: `file://${id}.m4a`,
    ...over,
  } as ClipVersion;
}

function song(): SongIdea {
  return {
    id: "song1",
    title: "Wildfire",
    notes: "",
    status: "song",
    completionPct: 0,
    kind: "project",
    collectionId: "c0",
    clips: [
      clip("main", { isPrimary: true }),
      clip("bass", { parentClipId: "main" }),
      clip("draft", { parentClipId: "main" }),
    ],
    lyrics: {
      versions: [
        { id: "v1", createdAt: 1, updatedAt: 1, document: { lines: [{ id: "l", text: "hi", chords: [] }] } },
        { id: "v2", createdAt: 2, updatedAt: 2, document: { lines: [] } },
      ],
    },
    chordSheet: { updatedAt: 1, sections: [{ id: "s", label: "Verse", measures: [], notes: "" }] },
    clipGroups: [{ id: "g" }] as unknown as SongIdea["clipGroups"],
    createdAt: 1,
    lastActivityAt: 1,
  };
}

const entry = {
  id: "e1",
  workspaceId: "w1",
  ideaId: "song1",
  clipIds: ["main", "bass"],
  lyricVersionIds: ["v1"],
  includeChordSheet: true,
  addedAt: 1,
};

describe("trimIdeaForSetlistEntry", () => {
  it("keeps only chosen clips, one primary, and strips lineage + groups", () => {
    const trimmed = trimIdeaForSetlistEntry(song(), entry, "newCol", 100);
    expect(trimmed.clips.map((c) => c.id)).toEqual(["main", "bass"]);
    expect(trimmed.clips.filter((c) => c.isPrimary)).toHaveLength(1);
    expect(trimmed.clips[0].isPrimary).toBe(true);
    expect(trimmed.collectionId).toBe("newCol");
    expect(trimmed.clipGroups).toBeUndefined();
  });

  it("keeps only chosen lyric versions and the chord sheet when requested", () => {
    const trimmed = trimIdeaForSetlistEntry(song(), entry, "newCol", 100);
    expect(trimmed.lyrics?.versions.map((v) => v.id)).toEqual(["v1"]);
    expect(trimmed.chordSheet).toBeDefined();
  });

  it("drops the chord sheet when not requested and falls back to a clip when none chosen", () => {
    const trimmed = trimIdeaForSetlistEntry(
      song(),
      { ...entry, clipIds: [], includeChordSheet: false, lyricVersionIds: [] },
      "newCol",
      100
    );
    expect(trimmed.chordSheet).toBeUndefined();
    expect(trimmed.lyrics).toBeUndefined();
    expect(trimmed.clips).toHaveLength(1); // fallback to primary
    expect(trimmed.clips[0].id).toBe("main");
  });
});

describe("buildSetlistArchive", () => {
  const workspaces: Workspace[] = [{ id: "w1", title: "WS", collections: [], ideas: [song()] }];

  it("builds a synthetic workspace + scope from resolvable entries", () => {
    const setlist: Setlist = {
      id: "sl",
      title: "Gig",
      createdAt: 1,
      updatedAt: 1,
      entries: [entry],
    };
    const built = buildSetlistArchive(setlist, workspaces)!;
    expect(built.songCount).toBe(1);
    expect(built.workspaces).toHaveLength(1);
    expect(built.workspaces[0].ideas[0].clips.map((c) => c.id)).toEqual(["main", "bass"]);
    expect(built.scope.workspaceIds[0]).toBe(built.workspaces[0].id);
    expect(built.scope.collectionIds[0]).toBe(built.workspaces[0].collections[0].id);
  });

  it("returns null when no entries resolve", () => {
    const setlist: Setlist = {
      id: "sl",
      title: "Gig",
      createdAt: 1,
      updatedAt: 1,
      entries: [{ ...entry, ideaId: "missing" }],
    };
    expect(buildSetlistArchive(setlist, workspaces)).toBeNull();
  });
});
