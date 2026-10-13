import type { Playlist, Setlist, Songbook } from "../types";

/**
 * Which compilations ride along when a collection or a workspace is shared.
 *
 * A setlist, chart book or playlist is a global entity; a share is a snapshot
 * of one place. The honest rule: a compilation travels only when EVERY song it
 * references is inside the shared scope. A partial setlist ("3 of 10 songs")
 * would arrive looking broken, so it stays home. The importer remaps ids and
 * drops dangling references anyway; this keeps the archive from ever carrying
 * a compilation that would arrive partial.
 */
export type ScopedCompilations = {
  setlists: Setlist[];
  songbooks: Songbook[];
  playlists: Playlist[];
};

export function compilationsWithinScope(
  library: { setlists: Setlist[]; songbooks: Songbook[]; playlists: Playlist[] },
  ideaIdsInScope: ReadonlySet<string>
): ScopedCompilations {
  const inside = (ideaId: string) => ideaIdsInScope.has(ideaId);
  return {
    setlists: library.setlists.filter(
      (setlist) => setlist.entries.length > 0 && setlist.entries.every((entry) => inside(entry.ideaId))
    ),
    songbooks: library.songbooks.filter(
      (songbook) => songbook.items.length > 0 && songbook.items.every((item) => inside(item.ideaId))
    ),
    playlists: library.playlists.filter(
      (playlist) => playlist.items.length > 0 && playlist.items.every((item) => inside(item.ideaId))
    ),
  };
}
