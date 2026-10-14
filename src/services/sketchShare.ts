/**
 * Sharing one SKETCH — a song idea with every take, all lyric versions (with
 * chords), the chord sheet, notes, marks, sections, tags, groups and grids —
 * as a SongNook file or a SongNook Send link. Built like a setlist share: the
 * sketch is lifted into a synthetic one-collection workspace the exporter
 * already understands, declared `share.kind: "sketch"`, and lands on the
 * receiving side as a received package presenting as that one sketch.
 */
import { exportLibrary, type ExportLibraryArgs } from "./libraryExport";
import type { SongNookArchiveOptions } from "./libraryArchiveManifest";
import { createShareLink } from "./shareLink";
import type { ShareArgsOverrides, ShareLinkParcel } from "./setlistShare";
import type { Collection, SongIdea, Workspace } from "../types";

const SKETCH_SHARE_OPTIONS: SongNookArchiveOptions = {
  includeFullSongHistory: true,
  includeNotes: true,
  includeLyrics: true,
  includeHiddenItems: true,
  preserveAllMetadata: true,
};

/** Lifts the sketch into its own workspace so the archive carries exactly it.
 *  Returns null for a clip idea (those travel as clips) or an idea with nothing
 *  to send — no take, no lyrics, no chart, no notes. */
export function buildSketchExportArgs(idea: SongIdea, overrides?: ShareArgsOverrides): ExportLibraryArgs | null {
  if (idea.kind !== "project") return null;
  const hasSomething =
    idea.clips.length > 0 ||
    (idea.lyrics?.versions.length ?? 0) > 0 ||
    !!idea.chordSheet ||
    idea.notes.trim().length > 0;
  if (!hasSomething) return null;

  const base = Date.now();
  const suffix = Math.random().toString(36).slice(2, 8);
  const workspaceId = `sketch-ws-${base}-${suffix}`;
  const collectionId = `sketch-col-${base}-${suffix}`;
  const collection: Collection = {
    id: collectionId,
    title: idea.title,
    workspaceId,
    parentCollectionId: null,
    createdAt: base,
    updatedAt: base,
    ideasListState: { hiddenIdeaIds: [], hiddenDays: [] },
  };
  const workspace: Workspace = {
    id: workspaceId,
    title: idea.title,
    collections: [collection],
    ideas: [{ ...idea, collectionId }],
    isArchived: false,
  };

  return {
    workspaces: [workspace],
    notes: [],
    format: "songnook-archive",
    scope: { workspaceIds: [workspaceId], collectionIds: [collectionId] },
    share: {
      kind: "sketch",
      title: overrides?.title || idea.title,
      sender: { name: overrides?.senderName ?? null, userId: null },
      transferId: overrides?.transferId ?? null,
      createdAt: base,
    },
    archiveExtension: "songnook",
    options: SKETCH_SHARE_OPTIONS,
    archiveLabel: idea.title,
  };
}

/** Exports the sketch as a SongNook file and hands it to the OS share sheet
 *  (a folder picker on Android). False when there is nothing to send. */
export async function shareSketchFile(idea: SongIdea): Promise<boolean> {
  const args = buildSketchExportArgs(idea);
  if (!args) return false;
  await exportLibrary(args);
  return true;
}

/** Uploads the sketch to SongNook Send and returns the link record. */
export function createSketchShareLink(idea: SongIdea, opts?: ShareLinkParcel) {
  return createShareLink({
    title: opts?.title || idea.title,
    kind: "sketch",
    entityId: idea.id,
    senderName: opts?.senderName,
    message: opts?.message ?? undefined,
    progress: opts?.progress,
    buildArgs: (transferId) =>
      buildSketchExportArgs(idea, { transferId, senderName: opts?.senderName, title: opts?.title }),
  });
}
