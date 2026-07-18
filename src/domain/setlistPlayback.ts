import {
  getClipPlaybackDurationMs,
  getPlayableClipForIdea,
  hasClipPlaybackSource,
} from "./clipPresentation";
import type {
  ClipVersion,
  PlaybackQueueItem,
  Setlist,
  SetlistEntry,
  SongIdea,
  Workspace,
} from "../types";

/**
 * Resolves a setlist's packaged songs against the live library. Each entry is a
 * "song folder": its chosen takes/parts (clips), charts, and notes — mirrors
 * playlistPlayback.ts so the two tabs share one mental model in code.
 */

export type SetlistPart = {
  clipId: string;
  title: string;
  durationMs: number | null;
  sectionCount: number;
  pinCount: number;
  available: boolean;
  queueItem: PlaybackQueueItem | null;
};

export type ResolvedSetlistEntry = {
  entryId: string;
  entry: SetlistEntry;
  idea: SongIdea | null;
  workspaceId: string | null;
  title: string;
  available: boolean;
  parts: SetlistPart[];
  /** Lyric versions from the entry that still resolve. */
  lyricVersionIds: string[];
  hasChordChart: boolean;
  includeSongNotes: boolean;
  songNotes: string;
  durationMs: number | null;
};

function findIdea(workspaces: Workspace[], ideaId: string): SongIdea | null {
  for (const workspace of workspaces) {
    const idea = workspace.ideas.find((candidate) => candidate.id === ideaId);
    if (idea) return idea;
  }
  return null;
}

function findWorkspaceId(workspaces: Workspace[], ideaId: string): string | null {
  for (const workspace of workspaces) {
    if (workspace.ideas.some((candidate) => candidate.id === ideaId)) return workspace.id;
  }
  return null;
}

function toPart(idea: SongIdea, clip: ClipVersion): SetlistPart {
  const playable = hasClipPlaybackSource(clip);
  return {
    clipId: clip.id,
    title: clip.title || idea.title,
    durationMs: getClipPlaybackDurationMs(clip) ?? null,
    sectionCount: clip.sections?.length ?? 0,
    pinCount: clip.practiceMarkers?.length ?? 0,
    available: playable,
    queueItem: playable ? { ideaId: idea.id, clipId: clip.id } : null,
  };
}

/** Resolves every entry to its live song folder. Chosen clips that were deleted
 *  are dropped; an entry whose clips ALL vanished falls back to the song's
 *  playable clip so the folder still plays. */
export function resolveSetlistEntries(workspaces: Workspace[], setlist: Setlist): ResolvedSetlistEntry[] {
  return setlist.entries.map((entry) => {
    const idea = findIdea(workspaces, entry.ideaId);
    if (!idea) {
      return {
        entryId: entry.id,
        entry,
        idea: null,
        workspaceId: null,
        title: "Unavailable song",
        available: false,
        parts: [],
        lyricVersionIds: [],
        hasChordChart: false,
        includeSongNotes: !!entry.includeSongNotes,
        songNotes: "",
        durationMs: null,
      };
    }

    let chosen = entry.clipIds
      .map((clipId) => idea.clips.find((clip) => clip.id === clipId))
      .filter((clip): clip is ClipVersion => !!clip);
    if (chosen.length === 0) {
      const fallback = getPlayableClipForIdea(idea);
      chosen = fallback ? [fallback] : [];
    }
    const parts = chosen.map((clip) => toPart(idea, clip));

    const liveVersionIds = new Set((idea.lyrics?.versions ?? []).map((version) => version.id));
    const lyricVersionIds = entry.lyricVersionIds.filter((id) => liveVersionIds.has(id));

    const knownDurations = parts.filter((part) => part.available && part.durationMs != null);

    return {
      entryId: entry.id,
      entry,
      idea,
      workspaceId: findWorkspaceId(workspaces, entry.ideaId),
      title: idea.title,
      available: parts.some((part) => part.available),
      parts,
      lyricVersionIds,
      hasChordChart:
        entry.includeChordSheet && !!idea.chordSheet && idea.chordSheet.sections.length > 0,
      includeSongNotes: !!entry.includeSongNotes,
      songNotes: entry.includeSongNotes ? idea.notes : "",
      durationMs:
        knownDurations.length > 0
          ? knownDurations.reduce((sum, part) => sum + (part.durationMs ?? 0), 0)
          : null,
    };
  });
}

/** Queue over the whole set (each entry's parts in order, unavailable skipped).
 *  `startEntryId`/`startClipId` choose where playback begins; fall back to the
 *  first playable item. */
export function buildSetlistQueue(
  entries: ResolvedSetlistEntry[],
  startEntryId?: string,
  startClipId?: string
): { queue: PlaybackQueueItem[]; startIndex: number } {
  const flat: Array<{ entryId: string; clipId: string; queueItem: PlaybackQueueItem }> = [];
  for (const entry of entries) {
    for (const part of entry.parts) {
      if (part.queueItem) flat.push({ entryId: entry.entryId, clipId: part.clipId, queueItem: part.queueItem });
    }
  }
  const startIndex = startEntryId
    ? Math.max(
        0,
        flat.findIndex(
          (item) =>
            item.entryId === startEntryId && (startClipId ? item.clipId === startClipId : true)
        )
      )
    : 0;
  return { queue: flat.map((item) => item.queueItem), startIndex };
}

/** Sum of known entry durations — null when nothing is measured, so callers can
 *  hide the stat instead of showing a misleading zero. */
export function getSetlistDurationMs(entries: ResolvedSetlistEntry[]): number | null {
  const known = entries.filter((entry) => entry.durationMs != null);
  if (known.length === 0) return null;
  return known.reduce((sum, entry) => sum + (entry.durationMs ?? 0), 0);
}
