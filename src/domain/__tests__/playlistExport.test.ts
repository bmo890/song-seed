import { buildPlaylistArchive } from "../playlistExport";
import type { Playlist, Workspace } from "../../types";

const clip = (id: string, isPrimary = false) =>
  ({ id, title: id, audioUri: `file:///${id}.wav`, durationMs: 1000, isPrimary, createdAt: 1 }) as never;

const workspaces = [
  {
    id: "ws",
    title: "Mine",
    collections: [],
    ideas: [
      { id: "song", kind: "project", title: "Song", collectionId: "c", clips: [clip("take1", true), clip("take2")], lyrics: { versions: [{ id: "v1" }] }, notes: "secret", createdAt: 1 },
      { id: "riff", kind: "clip", title: "Riff", collectionId: "c", clips: [clip("riffclip", true)], notes: "", createdAt: 1 },
    ],
  },
] as unknown as Workspace[];

const playlist: Playlist = {
  id: "pl",
  title: "Friday",
  createdAt: 1,
  updatedAt: 1,
  items: [
    { id: "i1", kind: "clip", workspaceId: "ws", collectionId: "c", ideaId: "riff", clipId: "riffclip", addedAt: 1 },
    { id: "i2", kind: "song", workspaceId: "ws", collectionId: "c", ideaId: "song", clipId: null, addedAt: 2 },
    { id: "i3", kind: "clip", workspaceId: "ws", collectionId: "c", ideaId: "gone", clipId: "x", addedAt: 3 },
  ],
};

describe("buildPlaylistArchive", () => {
  it("ships one trimmed idea per row, in order, as projects, audio only", () => {
    const built = buildPlaylistArchive(playlist, workspaces)!;
    const ideas = built.workspaces[0].ideas;
    expect(ideas.map((i) => i.title)).toEqual(["Riff", "Song"]);
    expect(ideas.every((i) => i.kind === "project")).toBe(true);
    expect(ideas[1].clips.map((c) => c.id)).toEqual(["take1"]);
    expect(ideas[1].lyrics).toBeUndefined();
    expect(ideas[1].notes).toBe("");
    expect(ideas[0].createdAt).toBeLessThan(ideas[1].createdAt);
  });

  it("remaps the playlist onto the synthetic workspace and drops missing rows", () => {
    const built = buildPlaylistArchive(playlist, workspaces)!;
    expect(built.playlist.items).toHaveLength(2);
    expect(built.playlist.items.every((item) => item.workspaceId === built.workspaces[0].id)).toBe(true);
    expect(built.playlist.items[1].clipId).toBe("take1");
  });

  it("returns null when nothing resolves", () => {
    expect(buildPlaylistArchive({ ...playlist, items: [playlist.items[2]] }, workspaces)).toBeNull();
  });
});
