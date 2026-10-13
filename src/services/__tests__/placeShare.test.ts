import type { Collection, Setlist, SongIdea, Workspace } from "../../types";

jest.mock("../libraryExport", () => ({
  __esModule: true,
  exportLibrary: jest.fn(),
  prepareLibraryExportArchive: jest.fn(),
}));
jest.mock("../shareLink", () => ({
  __esModule: true,
  createShareLink: jest.fn(),
}));

import * as libraryExport from "../libraryExport";
import * as shareLink from "../shareLink";
import {
  buildCollectionExportArgs,
  buildWorkspaceExportArgs,
  createCollectionShareLink,
  createWorkspaceShareLink,
  shareCollectionFile,
  shareWorkspaceFile,
} from "../placeShare";

const idea = (id: string, collectionId: string): SongIdea => ({
  id,
  title: id,
  notes: "",
  status: "stem",
  completionPct: 0,
  kind: "project",
  collectionId,
  clips: [],
  createdAt: 1,
  lastActivityAt: 1,
});

const collection = (id: string, parentCollectionId: string | null = null): Collection => ({
  id,
  title: id,
  workspaceId: "ws",
  parentCollectionId,
  createdAt: 1,
  updatedAt: 1,
  ideasListState: { hiddenIdeaIds: [], hiddenDays: [] },
});

const setlistOf = (id: string, ideaIds: string[]): Setlist => ({
  id,
  title: id,
  createdAt: 1,
  updatedAt: 1,
  entries: ideaIds.map((ideaId, i) => ({
    id: `${id}-${i}`,
    workspaceId: "ws",
    ideaId,
    clipIds: [],
    lyricVersionIds: [],
    includeChordSheet: false,
    addedAt: 1,
  })),
});

/** Songs ⟶ Songs/Demos (nested) ⟶ plus a sibling Loose collection. */
const workspace: Workspace = {
  id: "ws",
  title: "Band",
  collections: [collection("songs"), collection("demos", "songs"), collection("loose"), collection("empty")],
  ideas: [idea("s1", "songs"), idea("d1", "demos"), idea("l1", "loose")],
};

const library = {
  setlists: [setlistOf("songs-set", ["s1", "d1"]), setlistOf("whole-band", ["s1", "l1"])],
  songbooks: [],
  playlists: [],
};

beforeEach(() => jest.clearAllMocks());

describe("buildCollectionExportArgs", () => {
  it("scopes to the collection and its nested collections, full fidelity, declared as a collection", () => {
    const args = buildCollectionExportArgs(workspace.collections[0]!, workspace, library)!;
    expect(args).not.toBeNull();
    expect(args.scope).toEqual({ workspaceIds: [], collectionIds: ["songs"] });
    expect(args.format).toBe("songnook-archive");
    if (args.format !== "songnook-archive") throw new Error("unreachable");
    expect(args.archiveExtension).toBe("songnook");
    expect(args.options.preserveAllMetadata).toBe(true);
    expect(args.options.includeFullSongHistory).toBe(true);
    expect(args.options.includeLyrics).toBe(true);
    expect(args.options.includeNotes).toBe(true);
    expect(args.share?.kind).toBe("collection");
    expect(args.share?.title).toBe("songs");
    // The setlist inside Songs (+ its nested Demos) travels; the one that
    // reaches into Loose stays home.
    expect(args.setlists?.map((s) => s.id)).toEqual(["songs-set"]);
  });

  it("stamps the transferId and sender when the link path supplies them", () => {
    const args = buildCollectionExportArgs(workspace.collections[0]!, workspace, library, {
      transferId: "t_1",
      senderName: "Ben",
    })!;
    expect(args.format === "songnook-archive" && args.share?.transferId).toBe("t_1");
    expect(args.format === "songnook-archive" && args.share?.sender.name).toBe("Ben");
  });

  it("the title typed on the Send sheet becomes the parcel's title; the file keeps the place's name", () => {
    const args = buildCollectionExportArgs(workspace.collections[0]!, workspace, library, {
      transferId: "t_2",
      title: "Spring show stems",
    })!;
    if (args.format !== "songnook-archive") throw new Error("unreachable");
    expect(args.share?.title).toBe("Spring show stems");
    expect(args.archiveLabel).toBe("songs");
  });

  it("returns null for a collection with nothing in it, or one from another workspace", () => {
    expect(buildCollectionExportArgs(workspace.collections[3]!, workspace, library)).toBeNull();
    expect(buildCollectionExportArgs(collection("foreign"), workspace, library)).toBeNull();
  });
});

describe("buildWorkspaceExportArgs", () => {
  it("scopes to the whole workspace and carries every compilation inside it", () => {
    const args = buildWorkspaceExportArgs(workspace, library)!;
    expect(args.scope).toEqual({ workspaceIds: ["ws"], collectionIds: [] });
    if (args.format !== "songnook-archive") throw new Error("unreachable");
    expect(args.share?.kind).toBe("workspace");
    expect(args.share?.title).toBe("Band");
    expect(args.setlists?.map((s) => s.id).sort()).toEqual(["songs-set", "whole-band"]);
  });

  it("returns null for an empty or an archived workspace (its audio is packed away)", () => {
    expect(buildWorkspaceExportArgs({ ...workspace, ideas: [] }, library)).toBeNull();
    expect(buildWorkspaceExportArgs({ ...workspace, isArchived: true }, library)).toBeNull();
  });
});

describe("file and link paths share one definition", () => {
  it("shareCollectionFile exports the built args; false when nothing to share", async () => {
    await expect(shareCollectionFile(workspace.collections[0]!, workspace, library)).resolves.toBe(true);
    expect(libraryExport.exportLibrary).toHaveBeenCalledWith(expect.objectContaining({ share: expect.objectContaining({ kind: "collection" }) }));
    await expect(shareCollectionFile(workspace.collections[3]!, workspace, library)).resolves.toBe(false);
  });

  it("shareWorkspaceFile exports the built args", async () => {
    await expect(shareWorkspaceFile(workspace, library)).resolves.toBe(true);
    expect(libraryExport.exportLibrary).toHaveBeenCalledWith(expect.objectContaining({ share: expect.objectContaining({ kind: "workspace" }) }));
  });

  it("the link paths declare their kind and back-reference the place", () => {
    void createCollectionShareLink(workspace.collections[0]!, workspace, library);
    expect(shareLink.createShareLink).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "collection", entityId: "songs", title: "songs" })
    );
    void createWorkspaceShareLink(workspace, library);
    expect(shareLink.createShareLink).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "workspace", entityId: "ws", title: "Band" })
    );
    // buildArgs gets the transferId once the service hands it back.
    const call = (shareLink.createShareLink as jest.Mock).mock.calls[1]![0];
    const args = call.buildArgs("t_9");
    expect(args.share.transferId).toBe("t_9");
    // The Send sheet's parcel (title / from / note) rides through to the link.
    void createWorkspaceShareLink(workspace, library, { title: "Band, March", senderName: "Ben", message: "Rough mixes" });
    expect(shareLink.createShareLink).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Band, March", senderName: "Ben", message: "Rough mixes" })
    );
    const parcelArgs = (shareLink.createShareLink as jest.Mock).mock.calls[2]![0].buildArgs("t_10");
    expect(parcelArgs.share).toMatchObject({ title: "Band, March", sender: { name: "Ben", userId: null } });
  });
});
