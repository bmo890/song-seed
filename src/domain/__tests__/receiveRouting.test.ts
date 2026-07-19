import { resolveImportedEntityRoute } from "../receiveRouting";

describe("resolveImportedEntityRoute", () => {
  it("opens a declared songbook/setlist straight into Library", () => {
    expect(
      resolveImportedEntityRoute({
        shareKind: "songbook",
        importedSongbookIds: ["sb_1"],
        importedSetlistIds: [],
      })
    ).toEqual({ kind: "songbook", id: "sb_1" });

    expect(
      resolveImportedEntityRoute({
        shareKind: "setlist",
        importedSongbookIds: [],
        importedSetlistIds: ["sl_1"],
      })
    ).toEqual({ kind: "setlist", id: "sl_1" });
  });

  it("a library export containing setlists does NOT masquerade as a setlist", () => {
    // The key regression the share.kind authority prevents.
    expect(
      resolveImportedEntityRoute({
        shareKind: "library",
        importedSongbookIds: ["sb_9"],
        importedSetlistIds: ["sl_9"],
      })
    ).toBeNull();
  });

  it("collection / workspace / clips shares always land as a package", () => {
    for (const shareKind of ["collection", "workspace", "clips"] as const) {
      expect(
        resolveImportedEntityRoute({
          shareKind,
          importedSongbookIds: ["sb_1"],
          importedSetlistIds: ["sl_1"],
        })
      ).toBeNull();
    }
  });

  it("legacy archives (no share block) fall back to inference", () => {
    expect(
      resolveImportedEntityRoute({
        shareKind: undefined,
        importedSongbookIds: [],
        importedSetlistIds: ["sl_2"],
      })
    ).toEqual({ kind: "setlist", id: "sl_2" });
    expect(
      resolveImportedEntityRoute({
        shareKind: undefined,
        importedSongbookIds: [],
        importedSetlistIds: [],
      })
    ).toBeNull();
  });

  it("declared kind with nothing materialized yields no Library jump", () => {
    expect(
      resolveImportedEntityRoute({
        shareKind: "songbook",
        importedSongbookIds: [],
        importedSetlistIds: [],
      })
    ).toBeNull();
  });
});
