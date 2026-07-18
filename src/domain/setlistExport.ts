import type { Collection, Setlist, SetlistEntry, SongIdea, Workspace } from "../types";

/** A song trimmed for a setlist share: only the chosen clips (lineage stripped)
 * and the chosen charts. Keeps real audioUris so the archive bundles them. */
export function trimIdeaForSetlistEntry(
  idea: SongIdea,
  entry: SetlistEntry,
  collectionId: string,
  createdAt: number
): SongIdea {
  let clips = idea.clips.filter((clip) => entry.clipIds.includes(clip.id));
  if (clips.length === 0) {
    const fallback = idea.clips.find((clip) => clip.isPrimary) ?? idea.clips[0];
    clips = fallback ? [fallback] : [];
  }
  const keptIds = new Set(clips.map((clip) => clip.id));
  const trimmedClips = clips.map((clip) => ({
    ...clip,
    isPrimary: false,
    // Drop lineage links to clips that aren't part of this setlist entry.
    parentClipId: clip.parentClipId && keptIds.has(clip.parentClipId) ? clip.parentClipId : undefined,
    parentAssignedAt:
      clip.parentClipId && keptIds.has(clip.parentClipId) ? clip.parentAssignedAt : undefined,
  }));
  if (trimmedClips.length > 0) trimmedClips[0] = { ...trimmedClips[0], isPrimary: true };

  const versions = (idea.lyrics?.versions ?? []).filter((v) => entry.lyricVersionIds.includes(v.id));

  return {
    ...idea,
    collectionId,
    createdAt,
    lastActivityAt: createdAt,
    clips: trimmedClips,
    lyrics: versions.length > 0 ? { versions } : undefined,
    chordSheet: entry.includeChordSheet ? idea.chordSheet : undefined,
    // Song notes travel only when the packer chose them.
    notes: entry.includeSongNotes ? idea.notes : "",
    // Lineage groupings reference the full clip set; drop them from the share.
    clipGroups: undefined,
    clipGroupAssignments: undefined,
  };
}

export type SetlistArchiveInput = {
  workspaces: Workspace[];
  scope: { workspaceIds: string[]; collectionIds: string[] };
  songCount: number;
  /** The setlist entity itself, remapped onto the synthetic workspace, so the
   *  archive manifest carries it and the receiver gets a real Setlist — not
   *  just loose songs. */
  setlist: Setlist;
};

/** Builds a synthetic, ordered, trimmed workspace from a setlist that can be fed
 * straight to the existing library archive exporter. Returns null if nothing
 * resolvable remains. */
export function buildSetlistArchive(setlist: Setlist, workspaces: Workspace[]): SetlistArchiveInput | null {
  const findIdea = (ideaId: string): SongIdea | null => {
    for (const workspace of workspaces) {
      const idea = workspace.ideas.find((candidate) => candidate.id === ideaId);
      if (idea) return idea;
    }
    return null;
  };

  const base = Date.now();
  const suffix = Math.random().toString(36).slice(2, 8);
  const workspaceId = `setlist-ws-${base}-${suffix}`;
  const collectionId = `setlist-col-${base}-${suffix}`;

  const ideas: SongIdea[] = [];
  const remappedEntries: SetlistEntry[] = [];
  setlist.entries.forEach((entry, index) => {
    const idea = findIdea(entry.ideaId);
    // Raw clip ideas are legal setlist songs too ("just a clip, technically").
    if (!idea) return;
    const trimmed = trimIdeaForSetlistEntry(idea, entry, collectionId, base + index);
    ideas.push(trimmed);
    remappedEntries.push({
      ...entry,
      workspaceId,
      // Only reference what actually shipped: the trim may have swapped in a
      // fallback clip or dropped stale lyric versions.
      clipIds: trimmed.clips.map((clip) => clip.id),
      lyricVersionIds: (trimmed.lyrics?.versions ?? []).map((version) => version.id),
      includeChordSheet: entry.includeChordSheet && !!trimmed.chordSheet,
    });
  });

  if (ideas.length === 0) return null;

  const collection: Collection = {
    id: collectionId,
    title: setlist.title,
    workspaceId,
    parentCollectionId: null,
    createdAt: base,
    updatedAt: base,
    ideasListState: { hiddenIdeaIds: [], hiddenDays: [] },
  };

  const workspace: Workspace = {
    id: workspaceId,
    title: setlist.title,
    collections: [collection],
    ideas,
    isArchived: false,
  };

  return {
    workspaces: [workspace],
    scope: { workspaceIds: [workspaceId], collectionIds: [collectionId] },
    songCount: ideas.length,
    setlist: {
      id: `setlist-${base}-${suffix}`,
      title: setlist.title,
      createdAt: base,
      updatedAt: base,
      entries: remappedEntries,
    },
  };
}
