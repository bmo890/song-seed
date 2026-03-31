import { useEffect, useMemo, useRef, useState } from "react";
import { Animated } from "react-native";
import { useIsFocused, useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../../../state/useStore";
import { useScrollCollapseHeader } from "../../../hooks/useScrollCollapseHeader";
import { getCollectionAncestors, getCollectionById } from "../../../utils";
import { getCollectionHierarchyLevel } from "../../../hierarchy";
import { getDateBucket, getDateBucketLabel } from "../../../dateBuckets";
import { compareIdeas, getIdeaCreatedAt, getIdeaSortState, getIdeaSortTimestamp, getIdeaUpdatedAt, usesIdeaTimelineDividers } from "../../../ideaSort";
import { goBackFromParentStack, openCollectionInBrowse, openWorkspaceBrowseRoot } from "../../../navigation";
import { getFloatingActionDockBottomOffset, getFloatingActionDockScrollPastClearance } from "../../common/FloatingActionDock";
import type { IdeaListEntry } from "../types";
import type { AppBreadcrumbItem } from "../../common/AppBreadcrumbs";

export function useCollectionScreenModel() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const route = useRoute<any>();
  const rootNavigation = (navigation as any).getParent?.();
  const navigateRoot = (routeName: string, params?: object) =>
    (rootNavigation ?? navigation).navigate(routeName as never, params as never);
  const insets = useSafeAreaInsets();
  const collectionId = route.params?.collectionId as string | undefined;
  const activityRangeStartTs = route.params?.activityRangeStartTs as number | undefined;
  const activityRangeEndTs = route.params?.activityRangeEndTs as number | undefined;
  const activityMetricFilter = (route.params?.activityMetricFilter as "created" | "updated" | "both" | undefined) ?? "both";
  const activityLabel = route.params?.activityLabel as string | undefined;
  const routeWorkspaceId = route.params?.workspaceId as string | undefined;
  const focusIdeaId = route.params?.focusIdeaId as string | undefined;
  const focusToken = route.params?.focusToken as number | undefined;
  const showBack = route.params?.showBack === true;
  const collectionSource = route.params?.source as "activity" | "detail" | undefined;

  const workspaces = useStore((s) => s.workspaces);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const setActiveWorkspaceId = useStore((s) => s.setActiveWorkspaceId);
  const routeWorkspace = useMemo(
    () =>
      routeWorkspaceId
        ? workspaces.find((workspace) => workspace.id === routeWorkspaceId) ?? null
        : collectionId
          ? workspaces.find((workspace) =>
              workspace.collections.some((collection) => collection.id === collectionId)
            ) ?? null
          : null,
    [collectionId, routeWorkspaceId, workspaces]
  );
  const activeWorkspace = routeWorkspace ?? workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  const currentCollection = activeWorkspace?.collections.find((collection) => collection.id === collectionId) ?? null;
  const recordingIdeaId = useStore((s) => s.recordingIdeaId);
  const ideasFilter = useStore((s) => s.ideasFilter);
  const ideasSort = useStore((s) => s.ideasSort);
  const listSelectionMode = useStore((s) => s.listSelectionMode);
  const selectedListIdeaIds = useStore((s) => s.selectedListIdeaIds);
  const recentlyAddedItemIds = useStore((s) => s.recentlyAddedItemIds);
  const clearRecentlyAdded = useStore((s) => s.clearRecentlyAdded);
  const markRecentlyAdded = useStore((s) => s.markRecentlyAdded);
  const markCollectionOpened = useStore((s) => s.markCollectionOpened);
  const clipClipboard = useStore((s) => s.clipClipboard);
  const inlinePlayerMounted = useStore((s) => s.setInlinePlayerMounted);

  useEffect(() => {
    if (!routeWorkspace?.id) return;
    if (activeWorkspaceId === routeWorkspace.id) return;
    setActiveWorkspaceId(routeWorkspace.id);
  }, [activeWorkspaceId, routeWorkspace?.id, setActiveWorkspaceId]);

  const ideas = useMemo(
    () => activeWorkspace?.ideas.filter((idea) => idea.collectionId === collectionId) ?? [],
    [activeWorkspace?.ideas, collectionId]
  );
  const childCollections = useMemo(
    () => activeWorkspace?.collections.filter((collection) => collection.parentCollectionId === collectionId) ?? [],
    [activeWorkspace?.collections, collectionId]
  );

  const [hoveredIdeaId, setHoveredIdeaId] = useState<string | null>(null);
  const [dropIntent] = useState<"between" | "inside">("between");
  const [nestedCollectionsExpanded, setNestedCollectionsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [selectedProjectStages, setSelectedProjectStages] = useState<Array<"seed" | "sprout" | "semi" | "song">>([]);
  const [lyricsFilterMode, setLyricsFilterMode] = useState<"all" | "with" | "without">("all");
  const [listDensity, setListDensity] = useState<"comfortable" | "compact">("comfortable");
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [ideaSizeMap, setIdeaSizeMap] = useState<Record<string, number>>({});
  const [stickyDayLabel, setStickyDayLabel] = useState<string | null>(null);
  const [stickyDayTop, setStickyDayTop] = useState<number>(0);
  const [floatingDockHeight, setFloatingDockHeight] = useState(62);
  const [selectionDockHeight, setSelectionDockHeight] = useState(120);
  const rowLayoutsRef = useRef<Record<string, { y: number; height: number }>>({});
  const highlightMapRef = useRef<Record<string, Animated.Value>>({});
  const animatingHighlightIdsRef = useRef<Set<string>>(new Set());
  const listRef = useRef<any>(null);
  const handledFocusTokenRef = useRef<number | null>(null);
  const focusScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewabilityConfigRef = useRef({ itemVisiblePercentThreshold: 35 });
  const { handleScroll, scrollEventThrottle, animStyle: headerCollapseAnimStyle } = useScrollCollapseHeader();

  const hiddenIdeaIds = currentCollection?.ideasListState.hiddenIdeaIds ?? [];
  const hiddenDays = currentCollection?.ideasListState.hiddenDays ?? [];
  const hiddenIdeaIdsSet = useMemo(() => new Set(hiddenIdeaIds), [hiddenIdeaIds]);
  const hiddenDayKeySet = useMemo(() => new Set(hiddenDays.map((day) => `${day.metric}:${day.dayStartTs}`)), [hiddenDays]);
  const activeTimelineMetric = useMemo(() => {
    const metric = getIdeaSortState(ideasSort).metric;
    return metric === "created" || metric === "updated" ? metric : null;
  }, [ideasSort]);
  const activeSortMetric = useMemo(() => getIdeaSortState(ideasSort).metric, [ideasSort]);

  useEffect(() => {
    inlinePlayerMounted(isFocused);
    return () => inlinePlayerMounted(false);
  }, [inlinePlayerMounted, isFocused]);

  useEffect(() => {
    if (!collectionId) return;
    markCollectionOpened(collectionId);
  }, [collectionId, markCollectionOpened]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 160);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (listSelectionMode) setHeaderMenuOpen(false);
  }, [listSelectionMode]);

  const filteredIdeas = useMemo(() => {
    const base =
      ideasFilter === "all"
        ? [...ideas]
        : ideasFilter === "clips"
          ? ideas.filter((i) => i.kind === "clip")
          : ideasFilter === "projects"
            ? ideas.filter((i) => i.kind === "project")
            : ideas.filter((i) => !!i.isBookmarked);

    const filteredByActivityRange = base.filter((idea) => {
      if (typeof activityRangeStartTs !== "number" || typeof activityRangeEndTs !== "number") return true;
      const createdAt = getIdeaCreatedAt(idea);
      const updatedAt = getIdeaUpdatedAt(idea);
      const matchesCreated = createdAt >= activityRangeStartTs && createdAt <= activityRangeEndTs;
      const matchesUpdated = updatedAt >= activityRangeStartTs && updatedAt <= activityRangeEndTs;
      if (activityMetricFilter === "created") return matchesCreated;
      if (activityMetricFilter === "updated") return matchesUpdated;
      return matchesCreated || matchesUpdated;
    });

    filteredByActivityRange.sort((a, b) => compareIdeas(a, b, ideasSort));
    return filteredByActivityRange;
  }, [activityMetricFilter, activityRangeEndTs, activityRangeStartTs, ideas, ideasFilter, ideasSort]);

  const searchNeedle = debouncedSearchQuery.trim().toLowerCase();
  const projectHasLyrics = (idea: any) =>
    idea.kind === "project" &&
    (idea.lyrics?.versions ?? []).some((version: any) =>
      version.document.lines.some((line: any) => line.text.trim().length > 0 || line.chords.length > 0)
    );

  const searchMetaByIdeaId = useMemo(() => {
    const map = new Map<string, { matches: boolean; title: boolean; notes: boolean; lyrics: boolean }>();
    const hasNeedle = searchNeedle.length > 0;
    for (const idea of ideas) {
      if (!hasNeedle) {
        map.set(idea.id, { matches: true, title: false, notes: false, lyrics: false });
        continue;
      }
      const titleMatch = idea.title.toLowerCase().includes(searchNeedle);
      const notesMatch =
        idea.notes.toLowerCase().includes(searchNeedle) ||
        idea.clips.some((clip) => clip.notes.toLowerCase().includes(searchNeedle));
      let lyricsMatch = false;
      if (idea.kind === "project" && idea.lyrics?.versions?.length) {
        lyricsMatch = idea.lyrics.versions.some((version) =>
          version.document.lines.some(
            (line) =>
              line.text.toLowerCase().includes(searchNeedle) ||
              line.chords.some((chord) => chord.chord.toLowerCase().includes(searchNeedle))
          )
        );
      }
      map.set(idea.id, { matches: titleMatch || notesMatch || lyricsMatch, title: titleMatch, notes: notesMatch, lyrics: lyricsMatch });
    }
    return map;
  }, [ideas, searchNeedle]);

  const listIdeas = useMemo(
    () =>
      filteredIdeas.filter((idea) => {
        if (idea.id === recordingIdeaId && idea.clips.length === 0) return false;
        if (idea.isDraft) return false;
        if (!(searchMetaByIdeaId.get(idea.id)?.matches ?? true)) return false;
        if (lyricsFilterMode !== "all") {
          if (idea.kind !== "project") return false;
          const hasLyrics = projectHasLyrics(idea);
          if (lyricsFilterMode === "with" && !hasLyrics) return false;
          if (lyricsFilterMode === "without" && hasLyrics) return false;
        }
        if (selectedProjectStages.length > 0) {
          if (idea.kind !== "project") return false;
          if (!selectedProjectStages.includes(idea.status as any)) return false;
        }
        return true;
      }),
    [filteredIdeas, lyricsFilterMode, recordingIdeaId, searchMetaByIdeaId, selectedProjectStages]
  );

  const showDateDividers = usesIdeaTimelineDividers(ideasSort);
  const listEntries = useMemo<IdeaListEntry[]>(() => {
    const buildIdeaEntry = (idea: any, hidden: boolean, dayDividerLabel?: string | null, dayStartTsValue?: number | null): IdeaListEntry => ({
      key: `idea:${idea.id}`,
      type: "idea",
      idea,
      hidden,
      dayDividerLabel,
      dayStartTs: dayStartTsValue ?? null,
    });

    if (!showDateDividers || !activeTimelineMetric) {
      return listIdeas.map((idea) => buildIdeaEntry(idea, hiddenIdeaIdsSet.has(idea.id)));
    }

    const entries: IdeaListEntry[] = [];
    let index = 0;
    while (index < listIdeas.length) {
      const firstIdea = listIdeas[index]!;
      const firstBucket = getDateBucket(getIdeaSortTimestamp(firstIdea, ideasSort));
      const groupIdeas: any[] = [];
      let nextIndex = index;
      while (nextIndex < listIdeas.length) {
        const nextIdea = listIdeas[nextIndex]!;
        const nextBucket = getDateBucket(getIdeaSortTimestamp(nextIdea, ideasSort));
        if (nextBucket.key !== firstBucket.key) break;
        groupIdeas.push(nextIdea);
        nextIndex += 1;
      }
      const dayLabel = firstBucket.label;
      const bucketStartTs = firstBucket.startTs;
      const dayHidden = hiddenDayKeySet.has(`${activeTimelineMetric}:${bucketStartTs}`);
      if (dayHidden) {
        entries.push({
          key: `hidden-day:${activeTimelineMetric}:${bucketStartTs}`,
          type: "hidden-day",
          dayLabel,
          dayDividerLabel: dayLabel,
          dayStartTs: bucketStartTs,
          metric: activeTimelineMetric,
          hiddenCount: groupIdeas.length,
        });
      } else {
        groupIdeas.forEach((idea, groupIndex) => {
          entries.push(buildIdeaEntry(idea, hiddenIdeaIdsSet.has(idea.id), entries.length > 0 && groupIndex === 0 ? dayLabel : null, bucketStartTs));
        });
      }
      index = nextIndex;
    }
    return entries;
  }, [activeTimelineMetric, hiddenDayKeySet, hiddenIdeaIdsSet, ideasSort, listIdeas, showDateDividers]);

  useEffect(() => {
    if (!showDateDividers || listEntries.length === 0) {
      setStickyDayLabel(null);
      return;
    }
    const firstEntry = listEntries[0]!;
    setStickyDayLabel(firstEntry.type === "idea" ? getDateBucketLabel(getIdeaSortTimestamp(firstEntry.idea, ideasSort)) : firstEntry.dayLabel);
  }, [ideasSort, listEntries, showDateDividers]);

  useEffect(() => {
    const visibleIds = new Set(listIdeas.map((idea) => idea.id));
    const idsToAnimate = recentlyAddedItemIds.filter((id) => visibleIds.has(id) && !animatingHighlightIdsRef.current.has(id));
    idsToAnimate.forEach((id) => {
      animatingHighlightIdsRef.current.add(id);
      const animatedValue = new Animated.Value(0);
      highlightMapRef.current[id] = animatedValue;
      Animated.sequence([
        Animated.timing(animatedValue, { toValue: 0.9, duration: 180, useNativeDriver: true }),
        Animated.timing(animatedValue, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]).start(() => {
        delete highlightMapRef.current[id];
        animatingHighlightIdsRef.current.delete(id);
        clearRecentlyAdded([id]);
      });
    });
  }, [clearRecentlyAdded, listIdeas, recentlyAddedItemIds]);

  const collectionAncestors = useMemo(
    () => (activeWorkspace && currentCollection ? getCollectionAncestors(activeWorkspace, currentCollection.id) : []),
    [activeWorkspace, currentCollection]
  );

  const collectionRouteParams = {
    workspaceId: activeWorkspace?.id,
    activityRangeStartTs,
    activityRangeEndTs,
    activityMetricFilter,
    activityLabel,
    showBack: showBack || undefined,
    source: collectionSource,
  };

  const goToBrowse = () => {
    openWorkspaceBrowseRoot(rootNavigation ?? navigation);
  };

  const breadcrumbs: AppBreadcrumbItem[] = [
    ...(activeWorkspace
      ? [{
          key: `workspace-${activeWorkspace.id}`,
          label: activeWorkspace.title,
          level: "workspace" as const,
          onPress: goToBrowse,
        }]
      : []),
    ...collectionAncestors.map((collection) => ({
      key: collection.id,
      label: collection.title,
      level: getCollectionHierarchyLevel(collection),
      onPress: () => openCollectionInBrowse(navigation, { collectionId: collection.id, ...collectionRouteParams }),
    })),
  ];

  const hasActivityRangeFilter = typeof activityRangeStartTs === "number" && typeof activityRangeEndTs === "number";
  const visibleIdeasCount = listIdeas.filter((idea) => !hiddenIdeaIdsSet.has(idea.id)).length;
  const ideasHeaderMeta = [
    `${visibleIdeasCount} idea${visibleIdeasCount === 1 ? "" : "s"}`,
    hasActivityRangeFilter ? "activity slice" : null,
  ].filter(Boolean).join("  •  ");

  const duplicateWarningText = (() => {
    if (!clipClipboard || clipClipboard.sourceWorkspaceId !== activeWorkspaceId) return "";
    const sourceWs = workspaces.find((ws) => ws.id === clipClipboard.sourceWorkspaceId);
    if (!sourceWs) return "";
    const itemNames =
      clipClipboard.from === "list"
        ? sourceWs.ideas.filter((idea) => clipClipboard.clipIds.includes(idea.id)).map((idea) => idea.title)
        : sourceWs.ideas.find((i) => i.id === clipClipboard.sourceIdeaId)?.clips.filter((c) => clipClipboard.clipIds.includes(c.id)).map((c) => c.title) ?? [];
    const displayNames = itemNames.slice(0, 5).map((n) => `"${n}"`).join(", ");
    const remainder = itemNames.length > 5 ? ` and ${itemNames.length - 5} other${itemNames.length - 5 > 1 ? "s" : ""}` : "";
    return `You are copying ${itemNames.length} item${itemNames.length > 1 ? "s" : ""} (${displayNames}${remainder}) into the same collection they already belong to. This will create duplicates. Continue?`;
  })();

  const floatingBaseBottom = getFloatingActionDockBottomOffset(insets.bottom);
  const floatingStripBottom = floatingBaseBottom + 70;
  const selectionDockBottom = 12 + Math.max(insets.bottom, 12);
  const bottomToolbarAllowance = 18;
  const activeDockHeight = listSelectionMode ? selectionDockHeight : floatingDockHeight;
  const activeDockClearance = listSelectionMode ? selectionDockBottom + selectionDockHeight : getFloatingActionDockScrollPastClearance(insets.bottom);
  const listFooterSpacerHeight = activeDockClearance + (listSelectionMode ? activeDockHeight : 0) + bottomToolbarAllowance;

  return {
    navigation,
    navigateRoot,
    collectionId,
    showBack,
    currentCollection,
    activeWorkspace,
    activeWorkspaceId,
    workspaces,
    isFocused,
    childCollections,
    ideas,
    listEntries,
    listIdeas,
    selectedListIdeaIds,
    listSelectionMode,
    searchQuery,
    setSearchQuery,
    selectedProjectStages,
    setSelectedProjectStages,
    lyricsFilterMode,
    setLyricsFilterMode,
    listDensity,
    setListDensity,
    headerMenuOpen,
    setHeaderMenuOpen,
    nestedCollectionsExpanded,
    setNestedCollectionsExpanded,
    ideaSizeMap,
    setIdeaSizeMap,
    stickyDayLabel,
    setStickyDayLabel,
    stickyDayTop,
    setStickyDayTop,
    floatingDockHeight,
    setFloatingDockHeight,
    selectionDockHeight,
    setSelectionDockHeight,
    rowLayoutsRef,
    highlightMapRef,
    animatingHighlightIdsRef,
    viewabilityConfigRef,
    listRef,
    focusIdeaId,
    focusToken,
    handledFocusTokenRef,
    focusScrollTimerRef,
    hoverState: { hoveredIdeaId, setHoveredIdeaId, dropIntent },
    searchMetaByIdeaId,
    hiddenIdeaIds,
    hiddenIdeaIdsSet,
    hiddenDays,
    hiddenDayKeySet,
    showDateDividers,
    activeTimelineMetric,
    activeSortMetric,
    hasActivityRangeFilter,
    ideasHeaderMeta,
    duplicateWarningText,
    clipClipboard,
    searchNeedle,
    breadcrumbs,
    collectionRouteParams,
    handleListScroll: handleScroll,
    listScrollThrottle: scrollEventThrottle,
    headerCollapseAnimStyle,
    floatingStripBottom,
    listFooterSpacerHeight,
    activityLabel,
    activityRangeStartTs,
    activityRangeEndTs,
    activityMetricFilter,
    collectionSource,
    goToBrowse,
    onBack:
      showBack
        ? () => {
            if (!goBackFromParentStack(navigation)) {
              openWorkspaceBrowseRoot(rootNavigation ?? navigation);
            }
          }
        : undefined,
    markRecentlyAdded,
  };
}
