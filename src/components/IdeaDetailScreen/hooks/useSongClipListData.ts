import { useMemo } from "react";
import {
  buildEvolutionListRows,
  buildClipLineages,
  buildTimelineEntries,
  type EvolutionListClipEntry,
  type TimelineClipEntry,
  type SongTimelineSortDirection,
  type SongTimelineSortMetric,
} from "../../../clipGraph";
import { type SongIdea } from "../../../types";
import { type SongClipTagFilter } from "../songClipControls";
import type { SongClipGroupFilter } from "../songClipControls";

type UseSongClipListDataArgs = {
  selectedIdea: SongIdea | null;
  clipTagFilter: SongClipTagFilter;
  clipGroupFilter: SongClipGroupFilter;
  clipBookmarkedOnly: boolean;
  clipViewMode: "timeline" | "evolution";
  timelineSortMetric: SongTimelineSortMetric;
  timelineSortDirection: SongTimelineSortDirection;
  timelineMainTakesOnly: boolean;
  expandedLineageIds: Record<string, boolean>;
  pendingPrimaryClipId: string | null;
  isProject: boolean;
  isEditMode: boolean;
  clipSelectionMode: boolean;
  isParentPicking: boolean;
  clipListFooterSpacerHeight: number;
  clipSelectionFooterSpacerHeight: number;
  songPageBaseBottomPadding: number;
};

export function useSongClipListData({
  selectedIdea,
  clipTagFilter,
  clipGroupFilter,
  clipBookmarkedOnly,
  clipViewMode,
  timelineSortMetric,
  timelineSortDirection,
  timelineMainTakesOnly,
  expandedLineageIds,
  pendingPrimaryClipId,
  isProject,
  isEditMode,
  clipSelectionMode,
  isParentPicking,
  clipListFooterSpacerHeight,
  clipSelectionFooterSpacerHeight,
  songPageBaseBottomPadding,
}: UseSongClipListDataArgs) {
  const ideaClips = useMemo(() => selectedIdea?.clips ?? [], [selectedIdea]);
  const rootIdByClipId = useMemo(() => {
    const map = new Map<string, string>();
    buildClipLineages(ideaClips).forEach((lineage) => {
      lineage.clipsOldestToNewest.forEach((clip) => {
        map.set(clip.id, lineage.root.id);
      });
    });
    return map;
  }, [ideaClips]);

  const filteredIdeaClips = useMemo(() => {
    if (clipTagFilter.length === 0 && clipGroupFilter.length === 0 && !clipBookmarkedOnly) {
      return ideaClips;
    }

    return ideaClips.filter((clip) => {
      if (clipBookmarkedOnly && !clip.isBookmarked) return false;

      if (clipGroupFilter.length > 0) {
        const rootId = rootIdByClipId.get(clip.id);
        if (!rootId) return false;
        const assignedGroupId = selectedIdea?.clipGroupAssignments?.[rootId];
        if (!assignedGroupId || !clipGroupFilter.includes(assignedGroupId)) return false;
      }

      if (clipTagFilter.length === 0) return true;

      const clipTags = (clip.tags ?? [])
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean);

      return clipTagFilter.some((filterKey) => {
        if (filterKey === "untagged") return clipTags.length === 0;
        return clipTags.includes(filterKey);
      });
    });
  }, [
    clipBookmarkedOnly,
    clipGroupFilter,
    clipTagFilter,
    ideaClips,
    rootIdByClipId,
    selectedIdea?.clipGroupAssignments,
  ]);

  const displayPrimaryId = useMemo(
    () => pendingPrimaryClipId ?? selectedIdea?.clips.find((clip) => clip.isPrimary)?.id ?? null,
    [pendingPrimaryClipId, selectedIdea?.clips]
  );

  const primaryClip = useMemo(
    () =>
      selectedIdea?.kind === "project" && displayPrimaryId
        ? selectedIdea.clips.find((clip) => clip.id === displayPrimaryId) ?? null
        : null,
    [displayPrimaryId, selectedIdea]
  );

  const primaryEntry: TimelineClipEntry | null = primaryClip
    ? {
        kind: "timeline",
        clip: primaryClip,
        depth: 0,
        childCount: 0,
        hasChildren: false,
      }
    : null;

  const visibleClipEntries = useMemo<Array<TimelineClipEntry | EvolutionListClipEntry>>(
    () =>
      clipViewMode === "evolution"
        ? buildEvolutionListRows(
            filteredIdeaClips,
            expandedLineageIds,
            timelineSortDirection,
            selectedIdea?.clipGroups ?? [],
            selectedIdea?.clipGroupAssignments ?? {}
          )
            .filter(
              (row): row is { kind: "clip"; entry: EvolutionListClipEntry } => row.kind === "clip"
            )
            .map((row) => row.entry)
        : buildTimelineEntries(filteredIdeaClips, {
            metric: timelineSortMetric,
            direction: timelineSortDirection,
            mainTakesOnly: timelineMainTakesOnly,
          }),
    [
      clipViewMode,
      expandedLineageIds,
      filteredIdeaClips,
      selectedIdea?.clipGroupAssignments,
      selectedIdea?.clipGroups,
      timelineMainTakesOnly,
      timelineSortDirection,
      timelineSortMetric,
    ]
  );

  // "Ideas" count = number of distinct lineages (each lineage is one idea), not the
  // number of visible clip rows — so it stays constant when threads expand/collapse
  // or the view mode changes. Respects active filters via filteredIdeaClips.
  const ideaLineageCount = useMemo(
    () => buildClipLineages(filteredIdeaClips).length,
    [filteredIdeaClips]
  );

  const footerSpacerHeight =
    isProject && !isEditMode && !clipSelectionMode && !isParentPicking
      ? clipListFooterSpacerHeight
      : clipSelectionMode
        ? clipSelectionFooterSpacerHeight
        : songPageBaseBottomPadding;

  return {
    ideaClips,
    filteredIdeaClips,
    displayPrimaryId,
    primaryEntry,
    visibleClipEntries,
    visibleIdeaCount: ideaLineageCount,
    footerSpacerHeight,
    isDraftProject: !!selectedIdea?.isDraft,
  };
}
