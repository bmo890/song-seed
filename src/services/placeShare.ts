/**
 * Sharing a PLACE — a collection or a whole workspace — as a SongNook file or a
 * SongNook Send link. Mirrors setlistShare / songbookShare: one args builder
 * per kind, shared by the OS-share-sheet path and the transfer-link path so a
 * link and a file are the same bytes.
 *
 * What travels: every idea in scope with every take, lyrics (all versions, with
 * chords), chord sheets, notes, marks, sections, tags, groups, grids, edit
 * regions and overdub stems — full fidelity, nothing lossy. Nested collections
 * keep their parents. Compilations (setlists, chart books, playlists) travel
 * only when they sit entirely inside the shared scope (domain/scopedCompilations).
 *
 * On the receiving side the manifest's `share.kind` is the authority: a
 * collection lands as a received package presenting as that collection; a
 * workspace lands as a workspace-shaped package the receiver can keep as its
 * own workspace or fold into one of theirs.
 */
import { compilationsWithinScope } from "../domain/scopedCompilations";
import { getCollectionScopeIds } from "../utils";
import { exportLibrary, type ExportLibraryArgs } from "./libraryExport";
import type { SongNookArchiveOptions } from "./libraryArchiveManifest";
import { createShareLink } from "./shareLink";
import type { ShareArgsOverrides, ShareLinkParcel } from "./setlistShare";
import type { Collection, Playlist, Setlist, Songbook, Workspace } from "../types";

export type ShareLibrary = {
  setlists: Setlist[];
  songbooks: Songbook[];
  playlists: Playlist[];
};

/** A place share is a true snapshot: everything, as it is. */
const PLACE_SHARE_OPTIONS: SongNookArchiveOptions = {
  includeFullSongHistory: true,
  includeNotes: true,
  includeLyrics: true,
  includeHiddenItems: true,
  preserveAllMetadata: true,
};

function shareBlock(kind: "collection" | "workspace", title: string, overrides?: ShareArgsOverrides) {
  return {
    kind,
    title: overrides?.title || title,
    sender: { name: overrides?.senderName ?? null, userId: null },
    transferId: overrides?.transferId ?? null,
    createdAt: Date.now(),
  };
}

/** Builds the library-export args for one collection (with its nested
 *  collections). Returns null when nothing in scope has an idea to share. */
export function buildCollectionExportArgs(
  collection: Collection,
  workspace: Workspace,
  library: ShareLibrary,
  overrides?: ShareArgsOverrides
): ExportLibraryArgs | null {
  if (workspace.id !== collection.workspaceId) return null;
  const scopeIds = getCollectionScopeIds(workspace, collection.id);
  const ideaIds = new Set(
    workspace.ideas.filter((idea) => scopeIds.has(idea.collectionId)).map((idea) => idea.id)
  );
  if (ideaIds.size === 0) return null;

  const compilations = compilationsWithinScope(library, ideaIds);
  return {
    workspaces: [workspace],
    notes: [],
    format: "songnook-archive",
    scope: { workspaceIds: [], collectionIds: [collection.id] },
    setlists: compilations.setlists,
    songbooks: compilations.songbooks,
    playlists: compilations.playlists,
    share: shareBlock("collection", collection.title, overrides),
    archiveExtension: "songnook",
    options: PLACE_SHARE_OPTIONS,
    archiveLabel: collection.title,
  };
}

/** Builds the library-export args for a whole workspace. Returns null when the
 *  workspace holds no ideas, or when its audio is packed away (archived). */
export function buildWorkspaceExportArgs(
  workspace: Workspace,
  library: ShareLibrary,
  overrides?: ShareArgsOverrides
): ExportLibraryArgs | null {
  if (workspace.isArchived || workspace.ideas.length === 0) return null;
  const ideaIds = new Set(workspace.ideas.map((idea) => idea.id));
  const compilations = compilationsWithinScope(library, ideaIds);
  return {
    workspaces: [workspace],
    notes: [],
    format: "songnook-archive",
    scope: { workspaceIds: [workspace.id], collectionIds: [] },
    setlists: compilations.setlists,
    songbooks: compilations.songbooks,
    playlists: compilations.playlists,
    share: shareBlock("workspace", workspace.title, overrides),
    archiveExtension: "songnook",
    options: PLACE_SHARE_OPTIONS,
    archiveLabel: workspace.title,
  };
}

/** Exports a collection as a SongNook file and hands it to the OS share sheet.
 *  Returns false when there is nothing to share. */
export async function shareCollectionFile(
  collection: Collection,
  workspace: Workspace,
  library: ShareLibrary
): Promise<boolean> {
  const args = buildCollectionExportArgs(collection, workspace, library);
  if (!args) return false;
  await exportLibrary(args);
  return true;
}

/** Exports a workspace as a SongNook file and hands it to the OS share sheet. */
export async function shareWorkspaceFile(workspace: Workspace, library: ShareLibrary): Promise<boolean> {
  const args = buildWorkspaceExportArgs(workspace, library);
  if (!args) return false;
  await exportLibrary(args);
  return true;
}

/** Uploads a collection to SongNook Send and returns the link record. Throws
 *  EmptyShareError when nothing is shareable, TooLargeShareError past the
 *  service cap, SendTransferError on network. */
export function createCollectionShareLink(
  collection: Collection,
  workspace: Workspace,
  library: ShareLibrary,
  opts?: ShareLinkParcel
) {
  return createShareLink({
    title: opts?.title || collection.title,
    kind: "collection",
    entityId: collection.id,
    senderName: opts?.senderName,
    message: opts?.message ?? undefined,
    buildArgs: (transferId) =>
      buildCollectionExportArgs(collection, workspace, library, {
        transferId,
        senderName: opts?.senderName,
        title: opts?.title,
      }),
  });
}

/** Uploads a whole workspace to SongNook Send and returns the link record. */
export function createWorkspaceShareLink(workspace: Workspace, library: ShareLibrary, opts?: ShareLinkParcel) {
  return createShareLink({
    title: opts?.title || workspace.title,
    kind: "workspace",
    entityId: workspace.id,
    senderName: opts?.senderName,
    message: opts?.message ?? undefined,
    buildArgs: (transferId) =>
      buildWorkspaceExportArgs(workspace, library, { transferId, senderName: opts?.senderName, title: opts?.title }),
  });
}
