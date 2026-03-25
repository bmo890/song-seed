import { useMemo } from "react";
import {
  buildEvolutionListRows,
  buildTimelineEntries,
  type EvolutionListClipEntry,
  type TimelineClipEntry,
  type SongTimelineSortDirection,
  type SongTimelineSortMetric,
} from "../../../clipGraph";
import { type SongIdea } from "../../../types";
import { type SongClipTagFilter } from "../songClipControls";

type UseSongClipListDataArgs = {
  selectedIdea: SongIdea | null;
  clipTagFilter: SongClipTagFilter;
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

  const filteredIdeaClips = useMemo(() => {
    if (clipTagFilter === "all") return ideaClips;

    return ideaClips.filter((clip) => {
      const tags = (clip.tags ?? [])
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean);

      if (clipTagFilter === "untagged") return tags.length === 0;
      return tags.includes(clipTagFilter);
    });
  }, [clipTagFilter, ideaClips]);

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
        ? buildEvolutionListRows(filteredIdeaClips, expandedLineageIds)
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
      timelineMainTakesOnly,
      timelineSortDirection,
      timelineSortMetric,
    ]
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
    visibleIdeaCount: visibleClipEntries.length,
    footerSpacerHeight,
    isDraftProject: !!selectedIdea?.isDraft,
  };
}
