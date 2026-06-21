import { useMemo } from "react";
import {
  buildClipLineages,
  buildTimelineEntriesFromLineages,
  filterClipLineagesByVisibleClipIds,
  type ClipLineage,
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
  timelineSortMetric: SongTimelineSortMetric;
  timelineSortDirection: SongTimelineSortDirection;
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
  timelineSortMetric,
  timelineSortDirection,
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
  const allLineages = useMemo(() => buildClipLineages(ideaClips), [ideaClips]);
  const rootIdByClipId = useMemo(() => {
    const map = new Map<string, string>();
    allLineages.forEach((lineage) => {
      lineage.clipsOldestToNewest.forEach((clip) => {
        map.set(clip.id, lineage.root.id);
      });
    });
    return map;
  }, [allLineages]);

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

  const filteredLineages = useMemo<ClipLineage[]>(() => {
    if (filteredIdeaClips.length === ideaClips.length) return allLineages;
    return filterClipLineagesByVisibleClipIds(
      allLineages,
      new Set(filteredIdeaClips.map((clip) => clip.id))
    );
  }, [allLineages, filteredIdeaClips, ideaClips.length]);

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

  const visibleClipEntries = useMemo<TimelineClipEntry[]>(
    () =>
      buildTimelineEntriesFromLineages(filteredLineages, {
        metric: timelineSortMetric,
        direction: timelineSortDirection,
        mainTakesOnly: false,
      }),
    [
      filteredLineages,
      timelineSortDirection,
      timelineSortMetric,
    ]
  );

  // "Ideas" count = number of distinct lineages (each lineage is one idea), not the
  // number of visible clip rows — so it stays constant when threads expand/collapse
  // or the view mode changes. Respects active filters via filteredIdeaClips.
  const ideaLineageCount = filteredLineages.length;

  const footerSpacerHeight =
    isProject && !isEditMode && !clipSelectionMode && !isParentPicking
      ? clipListFooterSpacerHeight
      : clipSelectionMode
        ? clipSelectionFooterSpacerHeight
        : songPageBaseBottomPadding;

  return {
    ideaClips,
    filteredLineages,
    rootIdByClipId,
    displayPrimaryId,
    primaryEntry,
    visibleClipEntries,
    visibleIdeaCount: ideaLineageCount,
    footerSpacerHeight,
    isDraftProject: !!selectedIdea?.isDraft,
  };
}
