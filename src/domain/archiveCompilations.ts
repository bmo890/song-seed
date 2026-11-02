import type { Playlist, Setlist, Songbook } from "../types";

/**
 * The compilations a full Library archive carries: every kind the archive format and
 * its importer understand (audit 2026-11-02 G9: playlists used to be left out, so
 * moving phones by Export silently lost them). The importer keeps only items whose
 * songs are inside the exported scope.
 */
export function libraryCompilationsForArchive(state: {
    songbooks: Songbook[];
    setlists: Setlist[];
    playlists: Playlist[];
}) {
    return { songbooks: state.songbooks, setlists: state.setlists, playlists: state.playlists };
}
