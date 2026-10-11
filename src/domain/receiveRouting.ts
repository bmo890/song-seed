/**
 * Where an imported SongNook archive should land the user.
 *
 * The manifest's declared `share.kind` is the authority (sharing architecture
 * §3a): a full library export that happens to contain setlists must NOT
 * masquerade as a setlist share. Only a bundle that DECLARES itself a
 * songbook/setlist opens straight into Library; anything else lands as a
 * Received package. Archives with no `share` block (older exports) fall back to
 * inferring the kind from what actually materialized.
 */
import type { ShareKind } from "../types";

export type ImportedEntityRoute = { kind: "songbook" | "setlist" | "playlist"; id: string } | null;

export function resolveImportedEntityRoute(input: {
  shareKind: ShareKind | undefined;
  importedSongbookIds: string[];
  importedSetlistIds: string[];
  importedPlaylistIds?: string[];
}): ImportedEntityRoute {
  const { shareKind, importedSongbookIds, importedSetlistIds, importedPlaylistIds = [] } = input;

  const asSongbook = (): ImportedEntityRoute =>
    importedSongbookIds[0] ? { kind: "songbook", id: importedSongbookIds[0] } : null;
  const asSetlist = (): ImportedEntityRoute =>
    importedSetlistIds[0] ? { kind: "setlist", id: importedSetlistIds[0] } : null;
  const asPlaylist = (): ImportedEntityRoute =>
    importedPlaylistIds[0] ? { kind: "playlist", id: importedPlaylistIds[0] } : null;

  switch (shareKind) {
    case "songbook":
      return asSongbook();
    case "setlist":
      return asSetlist();
    case "playlist":
      return asPlaylist();
    case undefined:
      // Legacy archive, no declared kind → infer from side effects.
      return asSongbook() ?? asSetlist() ?? asPlaylist();
    default:
      // Declared collection / workspace / clips / library → Received package.
      return null;
  }
}
