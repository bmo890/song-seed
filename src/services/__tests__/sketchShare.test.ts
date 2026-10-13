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
import { buildSketchExportArgs, createSketchShareLink, shareSketchFile } from "../sketchShare";

const sketch: SongIdea = {
  id: "idea-1",
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
  lyrics: { versions: [{ id: "lv1", createdAt: 1, updatedAt: 1, document: { lines: [] } }] },
  createdAt: 1,
  lastActivityAt: 2,
};

beforeEach(() => jest.clearAllMocks());

describe("buildSketchExportArgs", () => {
  it("lifts the sketch into its own one-collection workspace, full fidelity, declared a sketch", () => {
    const args = buildSketchExportArgs(sketch, { transferId: "t_1", senderName: "Ben" })!;
    expect(args).not.toBeNull();
    if (args.format !== "songnook-archive") throw new Error("unreachable");
    expect(args.workspaces).toHaveLength(1);
    const [ws] = args.workspaces;
    expect(ws!.collections).toHaveLength(1);
    expect(ws!.collections[0]!.title).toBe("A War In Me");
    expect(ws!.ideas).toHaveLength(1);
    // The sketch is intact — every take, lineage included — just re-homed.
    expect(ws!.ideas[0]!.clips.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(ws!.ideas[0]!.clips[1]!.parentClipId).toBe("c1");
    expect(ws!.ideas[0]!.collectionId).toBe(ws!.collections[0]!.id);
    expect(ws!.ideas[0]!.notes).toBe("bridge needs a lift");
    expect(args.scope).toEqual({ workspaceIds: [ws!.id], collectionIds: [ws!.collections[0]!.id] });
    expect(args.options.preserveAllMetadata).toBe(true);
    expect(args.options.includeFullSongHistory).toBe(true);
    expect(args.share).toMatchObject({ kind: "sketch", title: "A War In Me", transferId: "t_1", sender: { name: "Ben" } });
    expect(args.archiveExtension).toBe("songnook");
  });

  it("a lyrics-only sketch still travels; an empty one and a clip idea do not", () => {
    expect(buildSketchExportArgs({ ...sketch, clips: [] })).not.toBeNull();
    expect(buildSketchExportArgs({ ...sketch, clips: [], lyrics: undefined, notes: "  " })).toBeNull();
    expect(buildSketchExportArgs({ ...sketch, kind: "clip" })).toBeNull();
  });
});

describe("file and link paths", () => {
  it("shareSketchFile exports the built args; false when empty", async () => {
    await expect(shareSketchFile(sketch)).resolves.toBe(true);
    expect(libraryExport.exportLibrary).toHaveBeenCalledWith(expect.objectContaining({ share: expect.objectContaining({ kind: "sketch" }) }));
    await expect(shareSketchFile({ ...sketch, clips: [], lyrics: undefined, notes: "" })).resolves.toBe(false);
  });

  it("createSketchShareLink declares its kind, back-references the sketch, and passes the parcel through", () => {
    void createSketchShareLink(sketch, { title: "Rough, March", senderName: "Ben", message: "listen on headphones" });
    expect(shareLink.createShareLink).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "sketch", entityId: "idea-1", title: "Rough, March", senderName: "Ben", message: "listen on headphones" })
    );
    const args = (shareLink.createShareLink as jest.Mock).mock.calls[0]![0].buildArgs("t_9");
    expect(args.share).toMatchObject({ kind: "sketch", title: "Rough, March", transferId: "t_9" });
  });
});
