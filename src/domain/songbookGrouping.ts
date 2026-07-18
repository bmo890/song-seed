import { getPlayableClipForIdea } from "./clipPresentation";
import type {
  ClipVersion,
  Songbook,
  SongbookItem,
  SongbookItemKind,
  SongIdea,
  Workspace,
} from "../types";

/**
 * The songbook's display model: ONE row per song (the "book of my songs"),
 * grouped from the flat SongbookItem list — no data migration. Which views a
 * song offers (lyrics / chart / grid) is derived from the chart kinds the book
 * holds for it.
 */

export type SongbookSongChart = {
  itemId: string;
  kind: SongbookItemKind;
  versionId?: string;
  available: boolean;
};

export type SongbookSong = {
  ideaId: string;
  workspaceId: string;
  /** Live idea when it still exists — display + reader render from this. */
  idea: SongIdea | null;
  title: string;
  workspaceTitle: string;
  available: boolean;
  charts: SongbookSongChart[];
  hasLyricChart: boolean;
  hasChordChart: boolean;
  playableClip: ClipVersion | null;
};

export type SongbookReaderView = "lyrics" | "chart" | "grid";

function findIdea(
  workspaces: Workspace[],
  ideaId: string
): { workspace: Workspace; idea: SongIdea } | null {
  for (const workspace of workspaces) {
    const idea = workspace.ideas.find((candidate) => candidate.id === ideaId);
    if (idea) return { workspace, idea };
  }
  return null;
}

/** Groups the flat item list into per-song rows, in order of each song's first
 *  appearance. Items whose song was deleted still group (as unavailable rows). */
export function groupSongbookItems(songbook: Songbook, workspaces: Workspace[]): SongbookSong[] {
  const groups: SongbookSong[] = [];
  const byIdeaId = new Map<string, SongbookSong>();

  for (const item of songbook.items) {
    let group = byIdeaId.get(item.ideaId);
    if (!group) {
      const resolved = findIdea(workspaces, item.ideaId);
      group = {
        ideaId: item.ideaId,
        workspaceId: resolved?.workspace.id ?? item.workspaceId,
        idea: resolved?.idea ?? null,
        title: resolved?.idea.title ?? "Unavailable song",
        workspaceTitle: resolved?.workspace.title ?? "No longer in the library",
        available: !!resolved,
        charts: [],
        hasLyricChart: false,
        hasChordChart: false,
        playableClip: resolved ? getPlayableClipForIdea(resolved.idea) : null,
      };
      byIdeaId.set(item.ideaId, group);
      groups.push(group);
    }

    const chartAvailable =
      !!group.idea &&
      (item.kind === "chordChart"
        ? !!group.idea.chordSheet && group.idea.chordSheet.sections.length > 0
        : (group.idea.lyrics?.versions ?? []).some((version) => version.id === item.versionId));

    group.charts.push({
      itemId: item.id,
      kind: item.kind,
      versionId: item.versionId,
      available: chartAvailable,
    });
    if (item.kind === "lyricChart" && chartAvailable) group.hasLyricChart = true;
    if (item.kind === "chordChart" && chartAvailable) group.hasChordChart = true;
  }

  return groups;
}

/** Maps a group ordering back to the flat item-id order the store expects —
 *  each group's items stay contiguous, in their original relative order. */
export function flattenGroupedOrder(groups: SongbookSong[]): string[] {
  return groups.flatMap((group) => group.charts.map((chart) => chart.itemId));
}

/** The default charts to add for a song: its latest lyric version (if any) plus
 *  its chord chart (if non-empty). Used by the collector's one-tap add. */
export function buildDefaultSongbookItemsForIdea(
  idea: SongIdea
): Array<{ kind: SongbookItemKind; versionId?: string }> {
  const items: Array<{ kind: SongbookItemKind; versionId?: string }> = [];
  const versions = idea.lyrics?.versions ?? [];
  const latest = versions[versions.length - 1];
  if (latest) items.push({ kind: "lyricChart", versionId: latest.id });
  if (idea.chordSheet && idea.chordSheet.sections.length > 0) items.push({ kind: "chordChart" });
  return items;
}

/** Which reader views this song offers. "chart" (chords over lyrics) only when
 *  the referenced lyric version actually carries chords — otherwise it would
 *  duplicate the lyrics view. */
export function availableViewsForSong(song: SongbookSong): SongbookReaderView[] {
  const views: SongbookReaderView[] = [];
  const lyricChart = song.charts.find((chart) => chart.kind === "lyricChart" && chart.available);
  if (lyricChart && song.idea) {
    views.push("lyrics");
    const version = song.idea.lyrics?.versions.find((v) => v.id === lyricChart.versionId);
    if (version?.document.lines.some((line) => line.chords.length > 0)) views.push("chart");
  }
  if (song.hasChordChart) views.push("grid");
  return views;
}
