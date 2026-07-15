import { useEffect, useMemo, useRef, useState } from "react";
import { AppAlert } from "../../common/AppAlert";
import { useIsFocused, useNavigation, useRoute } from "@react-navigation/native";
import { useStore } from "../../../state/useStore";
import { useMiniPlayerContext } from "../../../hooks/FullPlayerProvider";
import {
  buildActivityCountsByDay,
  buildActivityHeatmapMatrix,
  buildActivityRangeEntries,
  filterActivityEvents,
  getActivityEventsWithHistory,
  startOfActivityDay,
} from "../../../domain/activity";
import { getCollectionById, getCollectionScopeIds, getCollectionAncestors } from "../../../utils";
import { buildCollectionPathLabel } from "../../../domain/libraryNavigation";
import { useActivityStore } from "../../../state/useActivityStore";
import {
  buildActivityItemResults,
  formatSelectedRangeLabel,
  getActivityCellBackground,
} from "../helpers";
import { getDateBucketLabel } from "../../../domain/dateBuckets";
import { openCollectionFromContext } from "../../../navigation";
import { getPlayableClipForIdea } from "../../../domain/clipPresentation";

type ActivityItemRef = { workspaceId: string; ideaId: string; ideaKind: "song" | "clip" };
type ActivityCollectionRef = ActivityItemRef & { collectionId: string };

export function useActivityScreenModel() {
  const metricFilter = "both" as const;
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const rootNavigation = navigation.getParent?.();
  const navigateRoot = (routeName: string, params?: object) =>
    (rootNavigation ?? navigation).navigate(routeName as never, params as never);
  const route = useRoute<any>();
  const routeParams = route.params ?? {};
  const scopedCollectionId = routeParams.collectionId as string | undefined;
  const scopedWorkspaceId = routeParams.workspaceId as string | undefined;
  const routeYear = typeof routeParams.year === "number" ? routeParams.year : undefined;
  const routeRangeStartTs =
    typeof routeParams.rangeStartTs === "number"
      ? startOfActivityDay(routeParams.rangeStartTs)
      : undefined;
  const routeRangeEndTs =
    typeof routeParams.rangeEndTs === "number"
      ? startOfActivityDay(routeParams.rangeEndTs)
      : routeRangeStartTs;
  const routeHasPrefilledRange =
    typeof routeYear === "number" &&
    typeof routeRangeStartTs === "number" &&
    typeof routeRangeEndTs === "number";

  const workspaces = useStore((state) => state.workspaces);
  const primaryWorkspaceId = useStore((state) => state.primaryWorkspaceId);
  const primaryCollectionIdByWorkspace = useStore((state) => state.primaryCollectionIdByWorkspace);
  const activityEvents = useStore((state) => state.activityEvents);
  const excludedWorkspaceIds = useActivityStore((state) => state.excludedWorkspaceIds);
  const excludedCollectionIds = useActivityStore((state) => state.excludedCollectionIds);
  const setWorkspaceIncluded = useActivityStore((state) => state.setWorkspaceIncluded);
  const setCollectionIncluded = useActivityStore((state) => state.setCollectionIncluded);
  const resetSourceFilters = useActivityStore((state) => state.resetSourceFilters);
  const activeWorkspaceId = useStore((state) => state.activeWorkspaceId);
  const setActiveWorkspaceId = useStore((state) => state.setActiveWorkspaceId);
  const setSelectedIdeaId = useStore((state) => state.setSelectedIdeaId);
  const inlinePlayer = useMiniPlayerContext();
  const resetInlineRef = useRef(inlinePlayer.resetInlinePlayer);
  const inlineTarget = useStore((state) => state.inlineTarget);
  const isInlinePlaying = useStore((state) => state.inlineIsPlaying);

  useEffect(() => {
    resetInlineRef.current = inlinePlayer.resetInlinePlayer;
  }, [inlinePlayer.resetInlinePlayer]);

  useEffect(() => {
    if (isFocused) return;
    void resetInlineRef.current();
  }, [isFocused]);

  const collectionScopeWorkspace = useMemo(() => {
    if (!scopedCollectionId) return null;
    if (scopedWorkspaceId) {
      return workspaces.find((workspace) => workspace.id === scopedWorkspaceId) ?? null;
    }
    return (
      workspaces.find((workspace) =>
        workspace.collections.some((collection) => collection.id === scopedCollectionId)
      ) ?? null
    );
  }, [scopedCollectionId, scopedWorkspaceId, workspaces]);

  const collectionScope = useMemo(() => {
    if (!scopedCollectionId || !collectionScopeWorkspace) return null;
    return getCollectionById(collectionScopeWorkspace, scopedCollectionId);
  }, [collectionScopeWorkspace, scopedCollectionId]);
  const [expandedWorkspaceId, setExpandedWorkspaceId] = useState<string | null>(null);
  const [stickyDayLabel, setStickyDayLabel] = useState<string | null>(null);
  const [stickyDayTop, setStickyDayTop] = useState(0);
  const [resultsSectionTop, setResultsSectionTop] = useState(0);
  // Whether the timeline has scrolled past its first day. Stored as a boolean (flipped only
  // on threshold crossings) rather than the raw scroll offset, so scrolling doesn't re-render
  // the whole screen — and the non-virtualized result list — on every frame.
  const [scrolledPastFirstDay, setScrolledPastFirstDay] = useState(false);
  const activityDayLayoutsRef = useRef<Record<string, { y: number; height: number }>>({});

  const allActivityEvents = useMemo(
    () => getActivityEventsWithHistory(workspaces, activityEvents),
    [activityEvents, workspaces]
  );
  const currentYear = new Date().getFullYear();
  const today = startOfActivityDay(Date.now());
  const [year, setYear] = useState(routeYear ?? currentYear);
  const [rangeStartTs, setRangeStartTs] = useState<number | null>(routeRangeStartTs ?? today);
  const [rangeEndTs, setRangeEndTs] = useState<number | null>(routeRangeEndTs ?? today);
  const [isRouteRangeActive, setIsRouteRangeActive] = useState(routeHasPrefilledRange);

  useEffect(() => {
    if (!routeHasPrefilledRange || routeYear == null || routeRangeStartTs == null || routeRangeEndTs == null) {
      setIsRouteRangeActive(false);
      return;
    }

    setYear(routeYear);
    setRangeStartTs(routeRangeStartTs);
    setRangeEndTs(routeRangeEndTs);
    setIsRouteRangeActive(true);
  }, [routeHasPrefilledRange, routeRangeEndTs, routeRangeStartTs, routeYear]);

  // Collection-level page keeps single-scope; the global page uses the
  // multi-exclude source filter from the Customize sheet.
  const isCollectionScoped = !!scopedCollectionId;
  const effectiveWorkspaceId = isCollectionScoped ? collectionScopeWorkspace?.id ?? null : null;
  const effectiveCollectionFilterId = scopedCollectionId ?? null;

  const filteredEvents = useMemo(
    () =>
      isCollectionScoped
        ? filterActivityEvents(allActivityEvents, workspaces, {
            workspaceId: effectiveWorkspaceId,
            collectionId: effectiveCollectionFilterId,
            metric: metricFilter,
            year,
          })
        : filterActivityEvents(allActivityEvents, workspaces, {
            excludedWorkspaceIds: new Set(excludedWorkspaceIds),
            excludedCollectionIds: new Set(excludedCollectionIds),
            metric: metricFilter,
            year,
          }),
    [
      allActivityEvents,
      workspaces,
      isCollectionScoped,
      effectiveCollectionFilterId,
      effectiveWorkspaceId,
      excludedWorkspaceIds,
      excludedCollectionIds,
      year,
    ]
  );

  const workspaceFilterGroups = useMemo(() => {
    const sortedWorkspaces = workspaces
      .filter((workspace) => !workspace.isArchived)
      .sort((a, b) => a.title.localeCompare(b.title));

    return sortedWorkspaces.map((workspace) => {
      const workspaceIncluded = !excludedWorkspaceIds.includes(workspace.id);
      const collections = workspace.collections
        .map((collection) => {
          const scopeIds = getCollectionScopeIds(workspace, collection.id);
          const count = workspace.ideas.filter((idea) => scopeIds.has(idea.collectionId)).length;
          const excludedByAncestor =
            excludedCollectionIds.includes(collection.id) ||
            getCollectionAncestors(workspace, collection.id).some((ancestor) =>
              excludedCollectionIds.includes(ancestor.id)
            );
          return {
            id: collection.id,
            workspaceId: workspace.id,
            label: `${workspace.title} • ${buildCollectionPathLabel(workspace, collection.id)}`,
            count,
            included: workspaceIncluded && !excludedByAncestor,
            isPrimary: primaryCollectionIdByWorkspace[workspace.id] === collection.id,
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label));

      return {
        workspace: {
          id: workspace.id,
          label: workspace.title,
          count: workspace.ideas.length,
          included: workspaceIncluded,
          color: workspace.color,
          avatarKey: workspace.avatarKey,
          isPrimary: workspace.id === primaryWorkspaceId,
        },
        collections,
      };
    });
  }, [
    workspaces,
    excludedWorkspaceIds,
    excludedCollectionIds,
    primaryWorkspaceId,
    primaryCollectionIdByWorkspace,
  ]);

  const hasSourceOverrides =
    excludedWorkspaceIds.length > 0 || excludedCollectionIds.length > 0;

  useEffect(() => {
    if (isRouteRangeActive) {
      return;
    }
    const fallbackTs = year === currentYear
      ? Date.now()
      : filteredEvents[0]?.at ?? new Date(year, 0, 1).getTime();
    const fallbackDay = startOfActivityDay(fallbackTs);
    setRangeStartTs(fallbackDay);
    setRangeEndTs(fallbackDay);
  }, [currentYear, effectiveCollectionFilterId, effectiveWorkspaceId, filteredEvents, isRouteRangeActive, year]);

  const countsByDay = useMemo(() => buildActivityCountsByDay(filteredEvents), [filteredEvents]);
  const maxDailyCount = useMemo(() => Math.max(0, ...Array.from(countsByDay.values())), [countsByDay]);
  const { weeks, monthMarkers } = useMemo(() => buildActivityHeatmapMatrix(year), [year]);

  const normalizedRange = useMemo(() => {
    if (rangeStartTs == null) return null;
    const normalizedStart = startOfActivityDay(Math.min(rangeStartTs, rangeEndTs ?? rangeStartTs));
    const normalizedEnd = startOfActivityDay(Math.max(rangeStartTs, rangeEndTs ?? rangeStartTs));
    return {
      startTs: normalizedStart,
      endTs: normalizedEnd,
    };
  }, [rangeEndTs, rangeStartTs]);
  const selectedRangeEntries = useMemo(
    () =>
      normalizedRange == null
        ? []
        : buildActivityRangeEntries(filteredEvents, normalizedRange.startTs, normalizedRange.endTs),
    [filteredEvents, normalizedRange]
  );
  const itemResults = useMemo(
    () => buildActivityItemResults(selectedRangeEntries, workspaces),
    [selectedRangeEntries, workspaces]
  );
  const selectedRangeLabel = useMemo(
    () =>
      normalizedRange == null
        ? null
        : formatSelectedRangeLabel(normalizedRange.startTs, normalizedRange.endTs, metricFilter),
    [metricFilter, normalizedRange]
  );
  const legendSwatches = useMemo(
    () =>
      [0.25, 0.5, 0.75, 1].map((ratio) =>
        getActivityCellBackground(
          Math.max(1, Math.round(maxDailyCount * ratio)),
          Math.max(1, maxDailyCount),
          true
        )
      ),
    [maxDailyCount]
  );
  const scopeLabel = useMemo(() => {
    if (collectionScope && collectionScopeWorkspace) {
      return `${collectionScopeWorkspace.title} / ${collectionScope.title}`;
    }
    if (excludedWorkspaceIds.length === 0 && excludedCollectionIds.length === 0) {
      return "All workspaces";
    }
    const liveWorkspaces = workspaces.filter((workspace) => !workspace.isArchived);
    const activeCount = liveWorkspaces.filter(
      (workspace) => !excludedWorkspaceIds.includes(workspace.id)
    ).length;
    if (excludedCollectionIds.length === 0) {
      return `${activeCount} of ${liveWorkspaces.length} workspaces`;
    }
    return "Filtered sources";
  }, [collectionScope, collectionScopeWorkspace, excludedWorkspaceIds, excludedCollectionIds, workspaces]);

  useEffect(() => {
    activityDayLayoutsRef.current = {};
    if (itemResults.length === 0) {
      setStickyDayLabel(null);
      return;
    }
    setStickyDayLabel(getDateBucketLabel(itemResults[0]!.latestAt));
  }, [itemResults]);

  const getPlayableClipForItem = (item: ActivityItemRef) => {
    const workspace = workspaces.find((candidate) => candidate.id === item.workspaceId);
    const idea = workspace?.ideas.find((candidate) => candidate.id === item.ideaId);
    if (!idea) return null;
    return getPlayableClipForIdea(idea);
  };

  const openIdea = (ideaId: string, workspaceId: string) => {
    if (activeWorkspaceId !== workspaceId) {
      setActiveWorkspaceId(workspaceId);
    }
    setSelectedIdeaId(ideaId);
    navigateRoot("IdeaDetail", { ideaId });
  };

  const openItem = async (item: ActivityItemRef) => {
    if (item.ideaKind === "clip") {
      const clip = getPlayableClipForItem(item);
      if (!clip) {
        AppAlert.info("Nothing to open", "This clip does not have playable audio yet.");
        return;
      }
      await inlinePlayer.resetInlinePlayer();
      useStore.getState().setPlayerQueueForScreen(
        [{ ideaId: item.ideaId, clipId: clip.id }],
        0,
        true
      );
      return;
    }

    await inlinePlayer.resetInlinePlayer();
    openIdea(item.ideaId, item.workspaceId);
  };

  function openCollectionFromActivityContext(collectionId: string, focusIdeaId?: string) {
    // Open the clip in its full collection context — scrolled to and highlighted,
    // surrounded by its neighbors — rather than filtering the collection down to
    // the clip's activity date (which just re-shows what Activity already did).
    openCollectionFromContext(navigation, {
      collectionId,
      focusIdeaId,
      focusToken: focusIdeaId ? Date.now() : undefined,
      source: "activity",
      backLabel: "Activity",
    });
  }

  const viewItemInCollection = async (item: ActivityCollectionRef) => {
    if (activeWorkspaceId !== item.workspaceId) {
      setActiveWorkspaceId(item.workspaceId);
    }
    await inlinePlayer.resetInlinePlayer();
    openCollectionFromActivityContext(item.collectionId, item.ideaId);
  };

  const updateStickyDayLabel = (scrollY: number) => {
    if (itemResults.length === 0) {
      setStickyDayLabel(null);
      return;
    }

    const threshold = scrollY + 2;
    let nextLabel = getDateBucketLabel(itemResults[0]!.latestAt);
    const seenDayLabels = new Set<string>();

    for (const item of itemResults) {
      const dayLabel = getDateBucketLabel(item.latestAt);
      if (seenDayLabels.has(dayLabel)) continue;
      seenDayLabels.add(dayLabel);
      const layout = activityDayLayoutsRef.current[dayLabel];
      if (!layout) continue;
      if (resultsSectionTop + layout.y <= threshold) {
        nextLabel = dayLabel;
      } else {
        break;
      }
    }

    setStickyDayLabel((prev) => (prev === nextLabel ? prev : nextLabel));
  };

  const showStickyDayChip =
    itemResults.length > 0 && stickyDayLabel != null && scrolledPastFirstDay;

  return {
    workspaces,
    collectionScope,
    isCollectionScoped,
    workspaceFilterGroups,
    expandedWorkspaceId,
    setExpandedWorkspaceId,
    setWorkspaceIncluded,
    setCollectionIncluded,
    resetSourceFilters,
    hasSourceOverrides,
    metricFilter,
    stickyDayLabel,
    showStickyDayChip,
    stickyDayTop,
    setStickyDayTop,
    year,
    currentYear,
    scopeLabel,
    normalizedRange,
    selectedRangeLabel,
    monthMarkers,
    weeks,
    countsByDay,
    maxDailyCount,
    legendSwatches,
    selectedRangeEntries,
    itemResults,
    onChangeYear: (nextYear: number) => {
      setIsRouteRangeActive(false);
      setYear(Math.min(nextYear, currentYear));
    },
    onJumpToToday: () => {
      setIsRouteRangeActive(false);
      const today = startOfActivityDay(Date.now());
      setYear(new Date(today).getFullYear());
      setRangeStartTs(today);
      setRangeEndTs(today);
    },
    onPressMonth: (month: number) => {
      setIsRouteRangeActive(false);
      const monthStart = startOfActivityDay(new Date(year, month, 1).getTime());
      const monthEnd = startOfActivityDay(new Date(year, month + 1, 0).getTime());
      setRangeStartTs(monthStart);
      setRangeEndTs(monthEnd);
    },
    onPressDay: (dayTs: number) => {
      setIsRouteRangeActive(false);
      const normalizedDay = startOfActivityDay(dayTs);
      if (rangeStartTs == null || rangeEndTs != null) {
        setRangeStartTs(normalizedDay);
        setRangeEndTs(null);
        return;
      }
      setRangeEndTs(normalizedDay);
    },
    onHeaderScroll: (event: any) => {
      const nextScrollY = event.nativeEvent.contentOffset.y;
      const firstDayLabel =
        itemResults.length > 0 ? getDateBucketLabel(itemResults[0]!.latestAt) : null;
      const firstDayLayout = firstDayLabel ? activityDayLayoutsRef.current[firstDayLabel] : null;
      const pastFirstDay =
        firstDayLayout != null && nextScrollY >= resultsSectionTop + firstDayLayout.y;
      setScrolledPastFirstDay((prev) => (prev === pastFirstDay ? prev : pastFirstDay));
      updateStickyDayLabel(nextScrollY);
    },
    onResultsLayout: (y: number) => {
      setResultsSectionTop((prev) => (Math.abs(prev - y) < 1 ? prev : y));
    },
    onItemLayout: () => {},
    onDayLayout: (dayLabel: string, y: number, height: number) => {
      activityDayLayoutsRef.current[dayLabel] = { y, height };
    },
    canPlayItem: (item: ActivityItemRef) => !!getPlayableClipForItem(item),
    isItemPlaying: (item: ActivityItemRef) => {
      const clip = getPlayableClipForItem(item);
      return !!clip &&
        inlineTarget?.ideaId === item.ideaId &&
        inlineTarget.clipId === clip.id &&
        isInlinePlaying;
    },
    getItemDurationMs: (item: ActivityItemRef) => getPlayableClipForItem(item)?.durationMs ?? 0,
    activeInlineItemId: inlineTarget?.ideaId ?? null,
    onTogglePlayItem: (item: ActivityItemRef) => {
      const clip = getPlayableClipForItem(item);
      if (!clip) return;
      void inlinePlayer.toggleInlinePlayback(item.ideaId, clip);
    },
    onStopPlayItem: () => {
      void inlinePlayer.resetInlinePlayer();
    },
    onSeekInline: (ms: number) => {
      void inlinePlayer.endInlineScrub(ms);
    },
    onSeekInlineStart: () => {
      void inlinePlayer.beginInlineScrub();
    },
    onSeekInlineCancel: () => {
      void inlinePlayer.cancelInlineScrub();
    },
    onOpenItem: (item: ActivityItemRef) => {
      void openItem(item);
    },
    onViewInCollection: (item: ActivityCollectionRef) => {
      void viewItemInCollection(item);
    },
  };
}
