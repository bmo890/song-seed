/**
 * Sharing a SELECTION of ideas whole — the cards ticked in a collection, sent
 * with everything they hold (every take, lyrics with chords, chord sheets,
 * notes, marks, sections, tags) rather than as loose audio.
 *
 * One sketch on its own is simply that sketch (`sketchShare`, kind `sketch`).
 * Anything more is lifted into a synthetic one-collection workspace the
 * exporter already understands and declared `share.kind: "collection"`, so it
 * lands on the receiving side as a received collection holding those ideas.
 * The same args feed Export (a file) and SongNook Send (a link): one parcel,
 * the same bytes either way.
 */
import { exportLibrary, type ExportLibraryArgs } from "./libraryExport";
import type { SongNookArchiveOptions } from "./libraryArchiveManifest";
import { createShareLink } from "./shareLink";
import { buildSketchExportArgs } from "./sketchShare";
import type { ShareArgsOverrides, ShareLinkParcel } from "./setlistShare";
import type { Collection, ShareKind, SongIdea, Workspace } from "../types";

const IDEAS_SHARE_OPTIONS: SongNookArchiveOptions = {
  includeFullSongHistory: true,
  includeNotes: true,
  includeLyrics: true,
  includeHiddenItems: true,
  preserveAllMetadata: true,
};

/** An idea worth packing: a take, or (for a sketch) words, a chart or notes. */
function hasSomething(idea: SongIdea): boolean {
  return (
    idea.clips.length > 0 ||
    (idea.lyrics?.versions.length ?? 0) > 0 ||
    !!idea.chordSheet ||
    idea.notes.trim().length > 0
  );
}

/** What the parcel is: a lone sketch is a sketch, anything else a collection. */
export function ideasShareKind(ideas: SongIdea[]): ShareKind {
  return ideas.length === 1 && ideas[0].kind === "project" ? "sketch" : "collection";
}

/** Builds the export args for a whole-idea selection. Null when nothing in it
 *  holds anything to send. */
export function buildIdeasExportArgs(
  ideas: SongIdea[],
  title: string,
  overrides?: ShareArgsOverrides
): ExportLibraryArgs | null {
  const sendable = ideas.filter(hasSomething);
  if (sendable.length === 0) return null;
  if (sendable.length === 1 && sendable[0].kind === "project") {
    return buildSketchExportArgs(sendable[0], overrides);
  }

  const base = Date.now();
  const suffix = Math.random().toString(36).slice(2, 8);
  const workspaceId = `ideas-ws-${base}-${suffix}`;
  const collectionId = `ideas-col-${base}-${suffix}`;
  const parcelTitle = overrides?.title || title;
  const collection: Collection = {
    id: collectionId,
    title: parcelTitle,
    workspaceId,
    parentCollectionId: null,
    createdAt: base,
    updatedAt: base,
    ideasListState: { hiddenIdeaIds: [], hiddenDays: [] },
  };
  const workspace: Workspace = {
    id: workspaceId,
    title: parcelTitle,
    collections: [collection],
    ideas: sendable.map((idea) => ({ ...idea, collectionId })),
    isArchived: false,
  };

  return {
    workspaces: [workspace],
    notes: [],
    format: "songnook-archive",
    scope: { workspaceIds: [workspaceId], collectionIds: [collectionId] },
    share: {
      kind: "collection",
      title: parcelTitle,
      sender: { name: overrides?.senderName ?? null, userId: null },
      transferId: overrides?.transferId ?? null,
      createdAt: base,
    },
    archiveExtension: "songnook",
    options: IDEAS_SHARE_OPTIONS,
    archiveLabel: parcelTitle,
  };
}

/** Exports the selection as one SongNook file and hands it to the OS share
 *  sheet (a folder picker on Android). False when there is nothing to send. */
export async function shareIdeasFile(ideas: SongIdea[], title: string): Promise<boolean> {
  const args = buildIdeasExportArgs(ideas, title);
  if (!args) return false;
  await exportLibrary(args);
  return true;
}

/** Uploads the selection to SongNook Send and returns the link record. */
export function createIdeasShareLink(ideas: SongIdea[], title: string, opts?: ShareLinkParcel) {
  return createShareLink({
    title: opts?.title || title,
    kind: ideasShareKind(ideas.filter(hasSomething)),
    senderName: opts?.senderName,
    message: opts?.message ?? undefined,
    progress: opts?.progress,
    buildArgs: (transferId) =>
      buildIdeasExportArgs(ideas, title, { transferId, senderName: opts?.senderName, title: opts?.title }),
  });
}
