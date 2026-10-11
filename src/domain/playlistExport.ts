import type { Collection, Playlist, PlaylistItem, SongIdea, Workspace } from "../types";
import { getPlayableClipForIdea } from "./clipPresentation";

export type PlaylistArchiveInput = {
  workspaces: Workspace[];
  scope: { workspaceIds: string[]; collectionIds: string[] };
  songCount: number;
  /** The playlist entity itself, remapped onto the synthetic workspace, so the
   *  receiver gets a real Playlist — in this order — not just loose clips. */
  playlist: Playlist;
};

/** The one clip a playlist row plays — a clip item plays its clip, a song item
 *  its playable (primary) take. Null when nothing plays. */
function playlistClipFor(idea: SongIdea, item: PlaylistItem) {
  if (item.kind === "clip" && item.clipId) {
    const exact = idea.clips.find((clip) => clip.id === item.clipId);
    if (exact) return exact;
  }
  return getPlayableClipForIdea(idea) ?? null;
}

/**
 * Builds a synthetic, ordered workspace from a playlist for the archive
 * exporter: one idea per row, trimmed to the clip it plays (a playlist is
 * listening — lyrics, charts and notes stay home). Returns null if nothing
 * resolvable remains. Mirrors `buildSetlistArchive`.
 */
export function buildPlaylistArchive(playlist: Playlist, workspaces: Workspace[]): PlaylistArchiveInput | null {
  const findIdea = (ideaId: string): SongIdea | null => {
    for (const workspace of workspaces) {
      const idea = workspace.ideas.find((candidate) => candidate.id === ideaId);
      if (idea) return idea;
    }
    return null;
  };

  const base = Date.now();
  const suffix = Math.random().toString(36).slice(2, 8);
  const workspaceId = `playlist-ws-${base}-${suffix}`;
  const collectionId = `playlist-col-${base}-${suffix}`;

  const ideas: SongIdea[] = [];
  const remappedItems: PlaylistItem[] = [];
  const shippedIdeaIds = new Set<string>();
  playlist.items.forEach((item, index) => {
    const idea = findIdea(item.ideaId);
    if (!idea) return;
    const clip = playlistClipFor(idea, item);
    if (!clip) return;
    // The same song twice in a playlist ships once; both rows point at it.
    if (!shippedIdeaIds.has(idea.id)) {
      shippedIdeaIds.add(idea.id);
      ideas.push({
        ...idea,
        // Clip-kind ideas must ship as projects: the exporter routes clip-kind
        // ideas into standaloneClips, whose import path registers no id remap.
        kind: "project",
        collectionId,
        createdAt: base + index,
        lastActivityAt: base + index,
        clips: [{ ...clip, isPrimary: true, parentClipId: undefined, parentAssignedAt: undefined }],
        lyrics: undefined,
        chordSheet: undefined,
        notes: "",
        clipGroups: undefined,
        clipGroupAssignments: undefined,
      });
    }
    remappedItems.push({ ...item, workspaceId, collectionId, clipId: clip.id });
  });

  if (ideas.length === 0) return null;

  const collection: Collection = {
    id: collectionId,
    title: playlist.title,
    workspaceId,
    parentCollectionId: null,
    createdAt: base,
    updatedAt: base,
    ideasListState: { hiddenIdeaIds: [], hiddenDays: [] },
  };
  const workspace: Workspace = {
    id: workspaceId,
    title: playlist.title,
    collections: [collection],
    ideas,
    isArchived: false,
  };

  return {
    workspaces: [workspace],
    scope: { workspaceIds: [workspaceId], collectionIds: [collectionId] },
    songCount: ideas.length,
    playlist: {
      id: `playlist-${base}-${suffix}`,
      title: playlist.title,
      createdAt: base,
      updatedAt: base,
      items: remappedItems,
    },
  };
}
