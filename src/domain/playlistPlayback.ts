import {
  getClipPlaybackDurationMs,
  getPlayableClipForIdea,
  hasClipPlaybackSource,
} from "./clipPresentation";
import {
  buildCollectionPathLabel,
  resolvePlaylistClip,
  resolvePlaylistIdea,
} from "./libraryNavigation";
import type { PlaybackQueueItem, Playlist, Workspace } from "../types";

/** One playlist row resolved against the live library — everything the playlist
 *  player page needs: display copy, availability, duration, the queue entry to
 *  play, and where the item lives (for "open in" navigation). */
export type PlaylistTrack = {
  itemId: string;
  kind: "song" | "clip";
  title: string;
  context: string;
  available: boolean;
  durationMs: number | null;
  queueItem: PlaybackQueueItem | null;
  workspaceId: string | null;
  collectionId: string | null;
  ideaId: string | null;
};

function buildTrackContext(workspace: Workspace, collectionId: string) {
  const pathLabel = buildCollectionPathLabel(workspace, collectionId);
  return pathLabel ? `${workspace.title} · ${pathLabel}` : workspace.title;
}

/** Resolves every playlist item to a playable track. A track is available when
 *  its idea still exists AND a clip with a playback source resolves: song items
 *  play the song's primary/playable clip; clip items play their exact clip and
 *  fall back to the idea's playable clip if that clip was deleted. */
export function resolvePlaylistTracks(workspaces: Workspace[], playlist: Playlist): PlaylistTrack[] {
  return playlist.items.map((item) => {
    const resolvedIdea = resolvePlaylistIdea(workspaces, item);
    if (!resolvedIdea) {
      return {
        itemId: item.id,
        kind: item.kind,
        title: item.kind === "song" ? "Unavailable song" : "Unavailable clip",
        context: "No longer in the library",
        available: false,
        durationMs: null,
        queueItem: null,
        workspaceId: null,
        collectionId: null,
        ideaId: null,
      };
    }

    const { workspace, idea } = resolvedIdea;
    const resolvedClip =
      item.kind === "clip"
        ? resolvePlaylistClip(workspaces, item)?.clip ?? getPlayableClipForIdea(idea)
        : getPlayableClipForIdea(idea);
    const playable = !!resolvedClip && hasClipPlaybackSource(resolvedClip);

    return {
      itemId: item.id,
      kind: item.kind,
      title:
        item.kind === "clip" && resolvedClip
          ? resolvedClip.title || idea.title
          : idea.title,
      context: buildTrackContext(workspace, idea.collectionId),
      available: playable,
      durationMs: resolvedClip ? getClipPlaybackDurationMs(resolvedClip) ?? null : null,
      queueItem: playable && resolvedClip ? { ideaId: idea.id, clipId: resolvedClip.id } : null,
      workspaceId: workspace.id,
      collectionId: idea.collectionId,
      ideaId: idea.id,
    };
  });
}

/** Builds the playback queue from resolved tracks, skipping unavailable rows.
 *  `startItemId` picks where playback begins; if that row is unavailable (or
 *  omitted) the queue starts at its first playable track. */
export function buildPlaylistQueue(
  tracks: PlaylistTrack[],
  startItemId?: string
): { queue: PlaybackQueueItem[]; startIndex: number } {
  const playable = tracks.filter(
    (track): track is PlaylistTrack & { queueItem: PlaybackQueueItem } => !!track.queueItem
  );
  const startIndex = startItemId
    ? Math.max(
        0,
        playable.findIndex((track) => track.itemId === startItemId)
      )
    : 0;

  return { queue: playable.map((track) => track.queueItem), startIndex };
}

/** Sum of the known track durations. Null when nothing has a measured duration
 *  (callers hide the stat rather than showing a misleading zero). */
export function getPlaylistDurationMs(tracks: PlaylistTrack[]): number | null {
  const known = tracks.filter((track) => track.available && track.durationMs != null);
  if (known.length === 0) return null;
  return known.reduce((sum, track) => sum + (track.durationMs ?? 0), 0);
}
