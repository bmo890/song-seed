import { buildWorkspaceBrowseEntries } from "../domain/libraryNavigation";
import type { ClipVersion, Collection, SongIdea, Workspace } from "../types";

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

function collection(id: string, title: string, over: Partial<Collection> = {}): Collection {
  return {
    id,
    title,
    description: "",
    parentCollectionId: null,
    createdAt: 1,
    updatedAt: 1,
    ...over,
  } as Collection;
}

function project(over: Partial<SongIdea> = {}): SongIdea {
  return {
    id: "song1",
    title: "Ocean Song",
    notes: "",
    status: "song",
    completionPct: 0,
    kind: "project",
    collectionId: "c0",
    clips: [clip("main", { isPrimary: true })],
    createdAt: 1,
    lastActivityAt: 1,
    ...over,
  } as SongIdea;
}

function workspaceWith(idea: SongIdea): Workspace {
  return {
    id: "w1",
    title: "Workspace",
    collections: [collection("c0", "Songs")],
    ideas: [idea],
  } as unknown as Workspace;
}

function findMatchKinds(workspace: Workspace, query: string) {
  const entries = buildWorkspaceBrowseEntries(workspace, query);
  return entries.flatMap((entry) => entry.matches.map((match) => match.kind));
}

describe("buildWorkspaceBrowseEntries content search parity", () => {
  it("matches idea notes", () => {
    const workspace = workspaceWith(project({ notes: "remember the crimson bridge idea" }));
    const entries = buildWorkspaceBrowseEntries(workspace, "crimson");
    expect(entries).toHaveLength(1);
    const notesMatch = entries[0].matches.find((m) => m.kind === "notes");
    expect(notesMatch).toBeDefined();
    expect(notesMatch?.label.toLowerCase()).toContain("crimson");
  });

  it("matches clip notes", () => {
    const workspace = workspaceWith(
      project({ clips: [clip("main", { isPrimary: true, notes: "double-tracked harmonies here" })] })
    );
    expect(findMatchKinds(workspace, "harmonies")).toContain("notes");
  });

  it("matches lyric lines", () => {
    const workspace = workspaceWith(
      project({
        lyrics: {
          versions: [
            {
              id: "v1",
              createdAt: 1,
              updatedAt: 1,
              document: { lines: [{ id: "l1", text: "under the pale moonlight", chords: [] }] },
            },
          ],
        },
      })
    );
    const entries = buildWorkspaceBrowseEntries(workspace, "moonlight");
    const lyricMatch = entries[0]?.matches.find((m) => m.kind === "lyrics");
    expect(lyricMatch?.label.toLowerCase()).toContain("moonlight");
  });

  it("matches chords", () => {
    const workspace = workspaceWith(
      project({
        lyrics: {
          versions: [
            {
              id: "v1",
              createdAt: 1,
              updatedAt: 1,
              document: {
                lines: [{ id: "l1", text: "intro", chords: [{ id: "ch1", at: 0, chord: "Gmaj7" }] }],
              },
            },
          ],
        },
      })
    );
    expect(findMatchKinds(workspace, "gmaj7")).toContain("chords");
  });

  it("does not surface a collection when nothing matches", () => {
    const workspace = workspaceWith(project({ notes: "nothing relevant" }));
    expect(buildWorkspaceBrowseEntries(workspace, "moonlight")).toHaveLength(0);
  });
});
