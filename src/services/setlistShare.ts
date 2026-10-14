import { buildSetlistArchive } from "../domain/setlistExport";
import { exportLibrary, type ExportLibraryArgs } from "./libraryExport";
import { createShareLink } from "./shareLink";
import type { Setlist, Workspace } from "../types";

/** Optional share-block overrides — set by the transfer-link path so the manifest
 *  carries the transferId (stamped at create), the sender's name and the parcel
 *  title they typed (falls back to the entity's own title). */
export type ShareArgsOverrides = { transferId?: string | null; senderName?: string | null; title?: string };

/** What the Send sheet collects: the same three lines as the desktop page. */
import type { SendProgressOptions } from "../domain/sendProgress";

/** What the Send sheet hands a creator: the parcel's three lines, and the
 *  progress/cancel hooks of the seal running behind the pill. */
export type ShareLinkParcel = {
  title?: string;
  senderName?: string | null;
  message?: string | null;
  progress?: SendProgressOptions;
};

/** Builds the library-export args for a setlist share (selected clips + chosen
 *  charts per song, ordered, no version history). Returns null if nothing is
 *  exportable. Shared by the OS-share-sheet path and the transfer-link path so
 *  the archive definition lives in one place. */
export function buildSetlistExportArgs(
  setlist: Setlist,
  workspaces: Workspace[],
  overrides?: ShareArgsOverrides
): ExportLibraryArgs | null {
  const built = buildSetlistArchive(setlist, workspaces);
  if (!built) return null;

  return {
    workspaces: built.workspaces,
    notes: [],
    format: "songnook-archive",
    scope: built.scope,
    // The setlist entity itself (remapped onto the synthetic workspace) — the
    // receiver imports a real Setlist, not just loose songs.
    setlists: [built.setlist],
    share: {
      kind: "setlist",
      title: overrides?.title || setlist.title,
      sender: { name: overrides?.senderName ?? null, userId: null },
      transferId: overrides?.transferId ?? null,
      createdAt: Date.now(),
    },
    archiveExtension: "songnook",
    options: {
      includeFullSongHistory: true, // we already trimmed to the chosen clips
      // The trim already zeroes notes for entries that didn't pack them, so
      // this only carries the notes the packer explicitly chose.
      includeNotes: true,
      includeLyrics: true,
      includeHiddenItems: true,
      preserveAllMetadata: true, // keep lyric versions + chords + chord sheet
    },
    archiveLabel: setlist.title,
  };
}

/** Exports a setlist as a playable SongNook archive and hands it to the OS share
 * sheet. Returns false if the setlist has nothing exportable. */
export async function shareSetlist(setlist: Setlist, workspaces: Workspace[]): Promise<boolean> {
  const args = buildSetlistExportArgs(setlist, workspaces);
  if (!args) return false;
  await exportLibrary(args);
  return true;
}

/** Uploads a setlist to SongNook Send and returns the hosted share link record.
 *  Throws EmptyShareError if nothing is exportable, SendTransferError on network. */
export function createSetlistShareLink(setlist: Setlist, workspaces: Workspace[], opts?: ShareLinkParcel) {
  return createShareLink({
    title: opts?.title || setlist.title,
    kind: "setlist",
    entityId: setlist.id,
    senderName: opts?.senderName,
    message: opts?.message ?? undefined,
    progress: opts?.progress,
    buildArgs: (transferId) =>
      buildSetlistExportArgs(setlist, workspaces, { transferId, senderName: opts?.senderName, title: opts?.title }),
  });
}
