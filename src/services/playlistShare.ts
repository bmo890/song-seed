import { buildPlaylistArchive } from "../domain/playlistExport";
import { exportLibrary, type ExportLibraryArgs } from "./libraryExport";
import { createShareLink } from "./shareLink";
import type { ShareArgsOverrides, ShareLinkParcel } from "./setlistShare";
import type { Playlist, Workspace } from "../types";

/** Builds the library-export args for a playlist share (one clip per row, in
 *  order, no lyrics or charts). Returns null if nothing is exportable. Shared
 *  by the OS-share-sheet path and the transfer-link path. */
export function buildPlaylistExportArgs(
  playlist: Playlist,
  workspaces: Workspace[],
  overrides?: ShareArgsOverrides
): ExportLibraryArgs | null {
  const built = buildPlaylistArchive(playlist, workspaces);
  if (!built) return null;

  return {
    workspaces: built.workspaces,
    notes: [],
    format: "songnook-archive",
    scope: built.scope,
    playlists: [built.playlist],
    share: {
      kind: "playlist",
      title: overrides?.title || playlist.title,
      sender: { name: overrides?.senderName ?? null, userId: null },
      transferId: overrides?.transferId ?? null,
      createdAt: Date.now(),
    },
    archiveExtension: "songnook",
    options: {
      includeFullSongHistory: true, // already trimmed to one clip per row
      includeNotes: false,
      includeLyrics: false,
      includeHiddenItems: true,
      preserveAllMetadata: true,
    },
    archiveLabel: playlist.title,
  };
}

/** Exports a playlist as a playable SongNook archive and hands it to the OS
 *  share sheet. Returns false if the playlist has nothing exportable. */
export async function sharePlaylist(playlist: Playlist, workspaces: Workspace[]): Promise<boolean> {
  const args = buildPlaylistExportArgs(playlist, workspaces);
  if (!args) return false;
  await exportLibrary(args);
  return true;
}

/** Uploads a playlist to SongNook Send and returns the hosted share link record. */
export function createPlaylistShareLink(playlist: Playlist, workspaces: Workspace[], opts?: ShareLinkParcel) {
  return createShareLink({
    title: opts?.title || playlist.title,
    kind: "playlist",
    entityId: playlist.id,
    senderName: opts?.senderName,
    message: opts?.message ?? undefined,
    progress: opts?.progress,
    buildArgs: (transferId) =>
      buildPlaylistExportArgs(playlist, workspaces, { transferId, senderName: opts?.senderName, title: opts?.title }),
  });
}
