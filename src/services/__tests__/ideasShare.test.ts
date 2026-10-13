import type { SongIdea } from "../../types";

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
import { buildIdeasExportArgs, createIdeasShareLink, ideasShareKind, shareIdeasFile } from "../ideasShare";

const sketch: SongIdea = {
  id: "idea-sketch",
  title: "A War In Me",
  notes: "bridge needs a lift",
  status: "stem",
  completionPct: 40,
  kind: "project",
  collectionId: "col-songs",
  clips: [
    { id: "c1", title: "Take 1", notes: "", createdAt: 1, isPrimary: true, audioUri: "file:///a.m4a" },
    { id: "c2", title: "Take 2", notes: "", createdAt: 2, isPrimary: false, parentClipId: "c1", audioUri: "file:///b.m4a" },
  ],
  createdAt: 1,
  lastActivityAt: 2,
};
const clipIdea: SongIdea = {
  id: "idea-clip",
  title: "Riff in D",
  notes: "",
  status: "seed",
  completionPct: 0,
  kind: "clip",
  collectionId: "col-songs",
  clips: [{ id: "c9", title: "Riff in D", notes: "", createdAt: 3, isPrimary: true, audioUri: "file:///c.m4a" }],
  createdAt: 3,
  lastActivityAt: 3,
};
const empty: SongIdea = { ...sketch, id: "idea-empty", clips: [], notes: "  " };

beforeEach(() => jest.clearAllMocks());

describe("ideasShareKind", () => {
  it("a lone sketch is a sketch; anything else travels as a collection", () => {
    expect(ideasShareKind([sketch])).toBe("sketch");
    expect(ideasShareKind([clipIdea])).toBe("collection");
    expect(ideasShareKind([sketch, clipIdea])).toBe("collection");
  });
});

describe("buildIdeasExportArgs", () => {
  it("packs a mixed selection whole into one collection, every take kept", () => {
    const args = buildIdeasExportArgs([sketch, clipIdea], "Ideas Selection", { transferId: "t_1", senderName: "Ben" })!;
    expect(args).not.toBeNull();
    if (args.format !== "songnook-archive") throw new Error("unreachable");
    const [ws] = args.workspaces;
    expect(ws!.collections).toHaveLength(1);
    expect(ws!.collections[0]!.title).toBe("Ideas Selection");
    expect(ws!.ideas.map((idea) => idea.id)).toEqual(["idea-sketch", "idea-clip"]);
    // The sketch arrives intact — both takes and the lineage between them.
    expect(ws!.ideas[0]!.clips.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(ws!.ideas[0]!.clips[1]!.parentClipId).toBe("c1");
    expect(ws!.ideas.every((idea) => idea.collectionId === ws!.collections[0]!.id)).toBe(true);
    expect(args.options.includeFullSongHistory).toBe(true);
    expect(args.share).toMatchObject({ kind: "collection", title: "Ideas Selection", transferId: "t_1", sender: { name: "Ben" } });
    expect(args.archiveExtension).toBe("songnook");
  });

  it("a lone sketch is handed to the sketch builder, declared a sketch", () => {
    const args = buildIdeasExportArgs([sketch], "ignored")!;
    if (args.format !== "songnook-archive") throw new Error("unreachable");
    expect(args.share).toMatchObject({ kind: "sketch", title: "A War In Me" });
  });

  it("drops ideas with nothing in them, and is null when nothing is left", () => {
    const args = buildIdeasExportArgs([sketch, empty, clipIdea], "Sel")!;
    if (args.format !== "songnook-archive") throw new Error("unreachable");
    expect(args.workspaces[0]!.ideas.map((idea) => idea.id)).toEqual(["idea-sketch", "idea-clip"]);
    expect(buildIdeasExportArgs([empty], "Sel")).toBeNull();
  });

  it("the sender's title from the Send sheet names the parcel and the collection", () => {
    const args = buildIdeasExportArgs([sketch, clipIdea], "Ideas Selection", { title: "For Friday" })!;
    if (args.format !== "songnook-archive") throw new Error("unreachable");
    expect(args.share?.title).toBe("For Friday");
    expect(args.workspaces[0]!.collections[0]!.title).toBe("For Friday");
  });
});

describe("the two exits", () => {
  it("Export writes the file; nothing to send reports false and writes nothing", async () => {
    await expect(shareIdeasFile([sketch, clipIdea], "Sel")).resolves.toBe(true);
    expect(libraryExport.exportLibrary).toHaveBeenCalledTimes(1);
    await expect(shareIdeasFile([empty], "Sel")).resolves.toBe(false);
    expect(libraryExport.exportLibrary).toHaveBeenCalledTimes(1);
  });

  it("SongNook Send declares the kind and builds the same args with the transfer id", () => {
    createIdeasShareLink([sketch, clipIdea], "Sel", { senderName: "Ben", message: "learn two first" });
    const input = (shareLink.createShareLink as jest.Mock).mock.calls[0][0];
    expect(input).toMatchObject({ title: "Sel", kind: "collection", senderName: "Ben", message: "learn two first" });
    const args = input.buildArgs("t_9");
    expect(args.share).toMatchObject({ kind: "collection", transferId: "t_9", sender: { name: "Ben" } });
  });
});
