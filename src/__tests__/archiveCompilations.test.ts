import { libraryCompilationsForArchive } from "../domain/archiveCompilations";

/** Audit 2026-11-02 G9: the full Library export left playlists out although the format
 *  and the importer carry them. Everything the archive format holds rides along. */
it("a full library archive carries playlists with songbooks and setlists", () => {
    const playlists = [{ id: "pl", title: "Gig", createdAt: 1, updatedAt: 1, items: [] }];
    const songbooks = [{ id: "sb" }];
    const setlists = [{ id: "sl" }];
    expect(libraryCompilationsForArchive({ playlists, songbooks, setlists } as never)).toEqual({
        playlists,
        songbooks,
        setlists,
    });
});
