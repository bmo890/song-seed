import { buildSongbookArchive } from "../domain/songbookExport";
import { exportLibrary, type ExportLibraryArgs } from "./libraryExport";
import { createShareLink } from "./shareLink";
import type { ShareArgsOverrides } from "./setlistShare";
import type { Songbook, Workspace } from "../types";

/** Builds the library-export args for a songbook share (charts-only, no audio,
 *  tiny). Returns null when the book has no resolvable charts. Shared by the OS
 *  share-sheet path and the transfer-link path. */
export function buildSongbookExportArgs(
  songbook: Songbook,
  workspaces: Workspace[],
  overrides?: ShareArgsOverrides
): ExportLibraryArgs | null {
  const built = buildSongbookArchive(songbook, workspaces);
  if (!built) return null;

  return {
    workspaces: built.workspaces,
    notes: [],
    format: "songstead-archive",
    scope: built.scope,
    songbooks: [built.songbook],
    share: {
      kind: "songbook",
      title: songbook.title,
      sender: { name: overrides?.senderName ?? null, userId: null },
      transferId: overrides?.transferId ?? null,
      createdAt: Date.now(),
    },
    archiveExtension: "songstead",
    options: {
      includeFullSongHistory: true, // already trimmed to the referenced charts
      includeNotes: false,
      includeLyrics: true,
      includeHiddenItems: true,
      preserveAllMetadata: true, // keep lyric versions + chord sheets intact
    },
    archiveLabel: songbook.title,
  };
}

/** Exports a songbook as a charts-only Songstead archive and hands it to the OS
 *  share sheet. The receiver imports a real Songbook. Returns false when the book
 *  has no resolvable charts. */
export async function shareSongbookFile(songbook: Songbook, workspaces: Workspace[]): Promise<boolean> {
  const args = buildSongbookExportArgs(songbook, workspaces);
  if (!args) return false;
  await exportLibrary(args);
  return true;
}

/** Uploads a songbook to Songstead Send and returns the hosted share link record.
 *  Throws EmptyShareError if nothing is exportable, SendTransferError on network. */
export function createSongbookShareLink(
  songbook: Songbook,
  workspaces: Workspace[],
  opts?: { senderName?: string | null }
) {
  return createShareLink({
    title: songbook.title,
    kind: "songbook",
    entityId: songbook.id,
    senderName: opts?.senderName,
    buildArgs: (transferId) =>
      buildSongbookExportArgs(songbook, workspaces, { transferId, senderName: opts?.senderName }),
  });
}
