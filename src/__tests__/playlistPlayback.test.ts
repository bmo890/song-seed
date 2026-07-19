import { buildPlaylistQueue, getPlaylistDurationMs, resolvePlaylistTracks } from "../domain/playlistPlayback";
import type { ClipVersion, Playlist, SongIdea, Workspace } from "../types";

function clip(id: string, over: Partial<ClipVersion> = {}): ClipVersion {
  return {
    id,
    title: id,
    notes: "",
    createdAt: 1,
    isPrimary: false,
    audioUri: `file:///doc/songnook/audio/${id}.m4a`,
    durationMs: 60_000,
    ...over,
  } as ClipVersion;
}

function idea(id: string, kind: "project" | "clip", clips: ClipVersion[], over: Partial<SongIdea> = {}): SongIdea {
  return {
    id,
    title: `${id} title`,
    notes: "",
    status: "song",
    completionPct: 0,
    kind,
    collectionId: "col-1",
    clips,
    createdAt: 1,
    lastActivityAt: 1,
    ...over,
  } as SongIdea;
}

function workspace(ideas: SongIdea[]): Workspace {
  return {
    id: "ws-1",
    title: "Ocean",
    collections: [
      {
        id: "col-1",
        title: "Demos",
        workspaceId: "ws-1",
        parentCollectionId: null,
        createdAt: 1,
        updatedAt: 1,
        ideasListState: { hiddenIdeaIds: [], hiddenDays: [] },
      },
    ],
    ideas,
  } as unknown as Workspace;
}

function playlist(items: Playlist["items"]): Playlist {
  return { id: "pl-1", title: "Mix", createdAt: 1, updatedAt: 1, items };
}

const baseItem = { workspaceId: "ws-1", collectionId: "col-1", addedAt: 1 };

describe("resolvePlaylistTracks", () => {
  it("resolves song items to their primary playable clip", () => {
    const workspaces = [
      workspace([idea("song-1", "project", [clip("c1"), clip("c2", { isPrimary: true })])]),
    ];
    const tracks = resolvePlaylistTracks(workspaces, playlist([
      { ...baseItem, id: "i1", kind: "song", ideaId: "song-1" },
    ]));

    expect(tracks).toHaveLength(1);
    expect(tracks[0].available).toBe(true);
    expect(tracks[0].queueItem).toEqual({ ideaId: "song-1", clipId: "c2" });
    expect(tracks[0].context).toContain("Ocean");
  });

  it("resolves clip items to their exact clip, falling back if the clip is gone", () => {
    const workspaces = [workspace([idea("idea-1", "clip", [clip("keep"), clip("gone-was-here")])])];
    const exact = resolvePlaylistTracks(workspaces, playlist([
      { ...baseItem, id: "i1", kind: "clip", ideaId: "idea-1", clipId: "gone-was-here" },
    ]));
    expect(exact[0].queueItem?.clipId).toBe("gone-was-here");

    const fallback = resolvePlaylistTracks(workspaces, playlist([
      { ...baseItem, id: "i2", kind: "clip", ideaId: "idea-1", clipId: "deleted-clip" },
    ]));
    expect(fallback[0].available).toBe(true);
    expect(fallback[0].queueItem?.clipId).toBe("keep");
  });

  it("marks items whose idea no longer exists as unavailable", () => {
    const tracks = resolvePlaylistTracks([workspace([])], playlist([
      { ...baseItem, id: "i1", kind: "clip", ideaId: "vanished" },
    ]));
    expect(tracks[0].available).toBe(false);
    expect(tracks[0].queueItem).toBeNull();
  });

  it("marks clips without a playback source as unavailable", () => {
    const workspaces = [
      workspace([idea("idea-1", "clip", [clip("silent", { audioUri: undefined })])]),
    ];
    const tracks = resolvePlaylistTracks(workspaces, playlist([
      { ...baseItem, id: "i1", kind: "clip", ideaId: "idea-1", clipId: "silent" },
    ]));
    expect(tracks[0].available).toBe(false);
  });
});

describe("buildPlaylistQueue", () => {
  const workspaces = [
    workspace([
      idea("a", "clip", [clip("ca")]),
      idea("b", "clip", [clip("cb", { audioUri: undefined })]),
      idea("c", "clip", [clip("cc")]),
    ]),
  ];
  const tracks = resolvePlaylistTracks(workspaces, playlist([
    { ...baseItem, id: "i-a", kind: "clip", ideaId: "a", clipId: "ca" },
    { ...baseItem, id: "i-b", kind: "clip", ideaId: "b", clipId: "cb" },
    { ...baseItem, id: "i-c", kind: "clip", ideaId: "c", clipId: "cc" },
  ]));

  it("skips unavailable tracks and starts from the requested item", () => {
    const { queue, startIndex } = buildPlaylistQueue(tracks, "i-c");
    expect(queue).toEqual([
      { ideaId: "a", clipId: "ca" },
      { ideaId: "c", clipId: "cc" },
    ]);
    expect(startIndex).toBe(1);
  });

  it("falls back to the first playable track when the start item is unavailable", () => {
    const { startIndex } = buildPlaylistQueue(tracks, "i-b");
    expect(startIndex).toBe(0);
  });

  it("returns an empty queue for a playlist with no playable tracks", () => {
    const empty = resolvePlaylistTracks([workspace([])], playlist([
      { ...baseItem, id: "i1", kind: "clip", ideaId: "vanished" },
    ]));
    expect(buildPlaylistQueue(empty).queue).toEqual([]);
  });
});

describe("getPlaylistDurationMs", () => {
  it("sums known durations and returns null when nothing is measured", () => {
    const workspaces = [
      workspace([
        idea("a", "clip", [clip("ca", { durationMs: 90_000 })]),
        idea("b", "clip", [clip("cb", { durationMs: 30_000 })]),
      ]),
    ];
    const tracks = resolvePlaylistTracks(workspaces, playlist([
      { ...baseItem, id: "i-a", kind: "clip", ideaId: "a", clipId: "ca" },
      { ...baseItem, id: "i-b", kind: "clip", ideaId: "b", clipId: "cb" },
    ]));
    expect(getPlaylistDurationMs(tracks)).toBe(120_000);

    const unmeasured = resolvePlaylistTracks(
      [workspace([idea("a", "clip", [clip("ca", { durationMs: undefined })])])],
      playlist([{ ...baseItem, id: "i-a", kind: "clip", ideaId: "a", clipId: "ca" }])
    );
    expect(getPlaylistDurationMs(unmeasured)).toBeNull();
  });
});
