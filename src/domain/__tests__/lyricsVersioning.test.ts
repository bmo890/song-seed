import {
  countLyricsVersionReferences,
  isLyricsVersionSealed,
  resolveClipLyricsVersion,
} from "../lyrics";
import type { LyricsVersion, SongIdea } from "../../types";

function makeVersion(id: string): LyricsVersion {
  return {
    id,
    createdAt: 1,
    updatedAt: 1,
    document: { lines: [{ id: `${id}-line`, text: `words of ${id}`, chords: [] }] },
  };
}

function makeIdea(versionIds: string[], clipStamps: (string | undefined)[]): SongIdea {
  return {
    id: "idea-1",
    title: "Song",
    notes: "",
    status: "seed",
    completionPct: 0,
    kind: "project",
    collectionId: "col-1",
    createdAt: 0,
    lastActivityAt: 0,
    clips: clipStamps.map((stamp, index) => ({
      id: `clip-${index}`,
      title: `Take ${index}`,
      notes: "",
      createdAt: index,
      isPrimary: index === 0,
      lyricsVersionId: stamp,
    })),
    lyrics: { versions: versionIds.map(makeVersion) },
  } as SongIdea;
}

describe("isLyricsVersionSealed", () => {
  it("is sealed only once a take stamps the version", () => {
    const unsealed = makeIdea(["v1", "v2"], [undefined]);
    expect(isLyricsVersionSealed(unsealed, "v2")).toBe(false);

    const sealed = makeIdea(["v1", "v2"], ["v2"]);
    expect(isLyricsVersionSealed(sealed, "v2")).toBe(true);
    // The older, unstamped version stays editable by this rule alone.
    expect(isLyricsVersionSealed(sealed, "v1")).toBe(false);
  });
});

describe("resolveClipLyricsVersion", () => {
  const idea = makeIdea(["v1", "v2", "v3"], []);

  it("resolves a live stamp to its version and 1-based identity", () => {
    const resolved = resolveClipLyricsVersion(idea, "v2");
    expect(resolved.version?.id).toBe("v2");
    expect(resolved.index).toBe(2);
    expect(resolved.total).toBe(3);
    expect(resolved.stampMissing).toBe(false);
  });

  it("falls back to latest for an unstamped take without claiming a missing stamp", () => {
    const resolved = resolveClipLyricsVersion(idea, undefined);
    expect(resolved.version?.id).toBe("v3");
    expect(resolved.index).toBe(3);
    expect(resolved.stampMissing).toBe(false);
  });

  it("marks a deleted stamp missing and falls back to latest", () => {
    const resolved = resolveClipLyricsVersion(idea, "v-deleted");
    expect(resolved.version?.id).toBe("v3");
    expect(resolved.stampMissing).toBe(true);
  });

  it("returns empty for non-project ideas", () => {
    const clipIdea = { ...idea, kind: "clip" } as SongIdea;
    expect(resolveClipLyricsVersion(clipIdea, "v1").version).toBeNull();
  });
});

describe("countLyricsVersionReferences", () => {
  it("counts takes, songbook charts, and setlists that pin the versions", () => {
    const idea = makeIdea(["v1", "v2"], ["v1", "v1", undefined]);
    const songbooks = [
      { items: [{ ideaId: "idea-1", versionId: "v1" }, { ideaId: "other", versionId: "v1" }] },
    ];
    const setlists = [
      { entries: [{ ideaId: "idea-1", lyricVersionIds: ["v1"] }] },
      { entries: [{ ideaId: "idea-1", lyricVersionIds: ["v2"] }] },
      { entries: [{ ideaId: "other", lyricVersionIds: ["v1"] }] },
    ];
    const refs = countLyricsVersionReferences(idea, ["v1"], songbooks, setlists);
    expect(refs).toEqual({ takes: 2, charts: 1, setlists: 1 });
  });
});
