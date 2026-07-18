import { groupSongbookItems } from "./songbookGrouping";
import type { Collection, Songbook, SongbookItem, SongIdea, Workspace } from "../types";

/**
 * Packages a songbook as a charts-only archive: a synthetic workspace holding
 * one trimmed idea per song (referenced lyric versions + chord sheet, NO audio,
 * no history) plus the remapped Songbook entity for the manifest — so the
 * receiver gets a real book, not loose songs. Mirrors setlistExport.ts.
 */

export type SongbookArchiveInput = {
  workspaces: Workspace[];
  scope: { workspaceIds: string[]; collectionIds: string[] };
  chartCount: number;
  songCount: number;
  songbook: Songbook;
};

/** A song trimmed to just the charts this book references. Charts only: clips
 *  are dropped entirely, so the archive stays tiny and shares instantly. */
export function trimIdeaForSongbook(
  idea: SongIdea,
  lyricVersionIds: string[],
  includeChordSheet: boolean,
  collectionId: string,
  createdAt: number
): SongIdea {
  const versions = (idea.lyrics?.versions ?? []).filter((version) =>
    lyricVersionIds.includes(version.id)
  );
  return {
    ...idea,
    collectionId,
    createdAt,
    lastActivityAt: createdAt,
    clips: [],
    lyrics: versions.length > 0 ? { versions } : undefined,
    chordSheet: includeChordSheet ? idea.chordSheet : undefined,
    notes: "",
    clipGroups: undefined,
    clipGroupAssignments: undefined,
  };
}

export function buildSongbookArchive(
  songbook: Songbook,
  workspaces: Workspace[]
): SongbookArchiveInput | null {
  const base = Date.now();
  const suffix = Math.random().toString(36).slice(2, 8);
  const workspaceId = `songbook-ws-${base}-${suffix}`;
  const collectionId = `songbook-col-${base}-${suffix}`;

  const groups = groupSongbookItems(songbook, workspaces);
  const ideas: SongIdea[] = [];
  const remappedItems: SongbookItem[] = [];

  groups.forEach((group, index) => {
    if (!group.idea) return;
    const liveCharts = group.charts.filter((chart) => chart.available);
    if (liveCharts.length === 0) return;

    const lyricVersionIds = liveCharts
      .filter((chart) => chart.kind === "lyricChart" && chart.versionId)
      .map((chart) => chart.versionId!);
    const includeChordSheet = liveCharts.some((chart) => chart.kind === "chordChart");

    ideas.push(
      trimIdeaForSongbook(group.idea, lyricVersionIds, includeChordSheet, collectionId, base + index)
    );
    for (const chart of liveCharts) {
      remappedItems.push({
        id: chart.itemId,
        kind: chart.kind,
        workspaceId,
        ideaId: group.ideaId,
        versionId: chart.versionId,
        addedAt: base + index,
      });
    }
  });

  if (ideas.length === 0) return null;

  const collection: Collection = {
    id: collectionId,
    title: songbook.title,
    workspaceId,
    parentCollectionId: null,
    createdAt: base,
    updatedAt: base,
    ideasListState: { hiddenIdeaIds: [], hiddenDays: [] },
  };

  const workspace: Workspace = {
    id: workspaceId,
    title: songbook.title,
    collections: [collection],
    ideas,
    isArchived: false,
  };

  return {
    workspaces: [workspace],
    scope: { workspaceIds: [workspaceId], collectionIds: [collectionId] },
    chartCount: remappedItems.length,
    songCount: ideas.length,
    songbook: {
      id: `songbook-${base}-${suffix}`,
      title: songbook.title,
      createdAt: base,
      updatedAt: base,
      items: remappedItems,
    },
  };
}
