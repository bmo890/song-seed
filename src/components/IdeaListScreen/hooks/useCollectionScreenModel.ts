import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated } from "react-native";
import { useIsFocused, useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharedValue } from "react-native-reanimated";
import { useStore } from "../../../state/useStore";
import { fmtDuration, getCollectionAncestors } from "../../../utils";
import { getDateBucket, getDateBucketLabel } from "../../../dateBuckets";
import { compareIdeas, getIdeaCreatedAt, getIdeaSortState, getIdeaSortTimestamp, getIdeaUpdatedAt, usesIdeaTimelineDividers } from "../../../ideaSort";
import { getRootNavigation, goBackFromParentStack, openWorkspaceBrowseRoot } from "../../../navigation";
import { getFloatingActionDockBottomOffset, getFloatingActionDockScrollPastClearance } from "../../common/FloatingActionDock";
import { getPlayableClipForIdea } from "../../../clipPresentation";
import type { IdeaListEntry, IdeaListItemMeta } from "../types";
import { stickyDayStore } from "../stickyDayStore";
import type { SongIdea } from "../../../types";

const formatIdeaTimestamp = (timestamp: number) => {
  const dateValue = new Date(timestamp);
  const date = dateValue.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = dateValue.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} • ${time}`;
};

const projectHasLyrics = (idea: SongIdea) =>
  idea.kind === "project" &&
  (idea.lyrics?.versions ?? []).some((version) =>
    version.document.lines.some((line) => line.text.trim().length > 0 || line.chords.length > 0)
  );

const buildIdeaListItemMeta = (idea: SongIdea): IdeaListItemMeta => {
  const primaryClip = idea.clips.find((clip) => clip.isPrimary) ?? null;
  const playClip = getPlayableClipForIdea(idea) ?? null;
  const hasProjectLyrics = projectHasLyrics(idea);
  const hasProjectClipCount = idea.kind === "project" && idea.clips.length > 0;
  const projectProgressPct =
    idea.kind === "project" ? Math.max(0, Math.min(100, Math.round(idea.completionPct))) : null;

  return {
    playClip,
    clipDurationLabel: playClip?.durationMs ? fmtDuration(playClip.durationMs) : "0:00",
    projectPrimaryDurationLabel: primaryClip?.durationMs ? fmtDuration(primaryClip.durationMs) : "0:00",
    projectClipCount: idea.kind === "project" ? idea.clips.length : 0,
    hasProjectLyrics,
    hasProjectClipCount,
    hasExpandedProjectIndicators: idea.kind === "project" && (hasProjectLyrics || hasProjectClipCount),
    createdAtLabel: formatIdeaTimestamp(getIdeaCreatedAt(idea)),
    updatedAtLabel: formatIdeaTimestamp(getIdeaUpdatedAt(idea)),
    projectProgressPct,
  };
};

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
  const collectionSource = route.params?.source as "activity" | "detail" | "search" | undefined;
  const backLabel = route.params?.backLabel as string | undefined;
  // A "contextual" open (view-in-collection from Activity/Revisit) carries a
  // source. Those are pushed as a fresh Home over the origin, so "back" should
  // return to that origin — not fall through to the Browse root beneath this
  // WorkspaceStack.
  const isContextualOpen = collectionSource != null;

  // Pop the whole pushed Home off the ROOT stack to land back on the origin
  // (Activity/Revisit) with its scroll and selection intact. The ref guards
  // against re-entrancy when our own root pop unmounts this screen.
  const originBackHandledRef = useRef(false);
  const popBackToOrigin = useCallback(() => {
    if (originBackHandledRef.current) return;
    originBackHandledRef.current = true;
    const root = getRootNavigation(navigation);
    if (root?.canGoBack?.()) {
      root.goBack();
    } else if (!goBackFromParentStack(navigation)) {
      (root ?? navigation).navigate("Home" as never);
    }
  }, [navigation]);

  // Contextual opens no longer hijack the back button — back always steps up the
  // hierarchy (to Browse), same as a normal collection. The jump back to the origin
  // (Search/Activity/Revisit) lives in a dismissible chip instead. Dismissing it
  // clears the source/backLabel params so the chip stays gone for this screen.
  const dismissContextualReturn = useCallback(() => {
    (navigation as any).setParams({ source: undefined, backLabel: undefined });
  }, [navigation]);

  const workspaces = useStore((s) => s.workspaces);
  const storeActiveWorkspaceId = useStore((s) => s.activeWorkspaceId);
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
  const activeWorkspaceId = routeWorkspace?.id ?? storeActiveWorkspaceId;
  const activeWorkspace = routeWorkspace ?? workspaces.find((w) => w.id === storeActiveWorkspaceId) ?? null;
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

  const ideas = useMemo(
    () => activeWorkspace?.ideas.filter((idea) => idea.collectionId === collectionId) ?? [],
    [activeWorkspace?.ideas, collectionId]
  );
  const childCollections = useMemo(
    () => activeWorkspace?.collections.filter((collection) => collection.parentCollectionId === collectionId) ?? [],
    [activeWorkspace?.collections, collectionId]
  );

  const [nestedCollectionsExpanded, setNestedCollectionsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [selectedProjectStages, setSelectedProjectStages] = useState<Array<"seed" | "sprout" | "stem" | "song">>([]);
  const [lyricsFilterMode, setLyricsFilterMode] = useState<"all" | "with" | "without">("all");
  const [listDensity, setListDensity] = useState<"comfortable" | "compact">("comfortable");
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [floatingDockHeight, setFloatingDockHeight] = useState(62);
  const [selectionDockHeight, setSelectionDockHeight] = useState(120);
  const rowLayoutsRef = useRef<Record<string, { y: number; height: number }>>({});
  const highlightMapRef = useRef<Record<string, Animated.Value>>({});
  const animatingHighlightIdsRef = useRef<Set<string>>(new Set());
  const listRef = useRef<any>(null);
  const handledFocusTokenRef = useRef<number | null>(null);
  const focusScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Low threshold so the sticky day chip swaps labels the instant a new
  // cohort's divider/row crosses under it at the top of the list — not after
  // it's already well into view.
  const viewabilityConfigRef = useRef({ itemVisiblePercentThreshold: 1 });

  // Collapsing header (same mechanism as the song page): the list's UI-thread
  // scroll offset drives an absolute overlay that translates up via transform.
  // collapsibleHeaderHeight is measured by the overlay.
  const scrollY = useSharedValue(0);
  const collapsibleHeaderHeight = useSharedValue(0);

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
    if (!collectionId) return;
    markCollectionOpened(collectionId);
  }, [collectionId, markCollectionOpened]);

  // Navigating to a different collection starts at the top — header expanded.
  useEffect(() => {
    scrollY.value = 0;
  }, [collectionId, scrollY]);

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

  const itemMetaByIdeaId = useMemo(() => {
    const map = new Map<string, IdeaListItemMeta>();
    for (const idea of listIdeas) {
      map.set(idea.id, buildIdeaListItemMeta(idea));
    }
    return map;
  }, [listIdeas]);

  // Hidden state is split into two gestures that share one count:
  //   • one-off hidden items (hiddenIdeaIds) — collapse out of the list silently.
  //   • collapsed day groups (hiddenDays)    — render a labelled marker you tap to expand.
  // Both persist; "Show all" (showAllHidden) is the single bulk reset.
  const effectivelyHiddenCount = useMemo(
    () =>
      listIdeas.filter((idea) => {
        if (hiddenIdeaIdsSet.has(idea.id)) return true;
        if (!activeTimelineMetric) return false;
        const dayTs = getDateBucket(getIdeaSortTimestamp(idea, ideasSort)).startTs;
        return hiddenDayKeySet.has(`${activeTimelineMetric}:${dayTs}`);
      }).length,
    [activeTimelineMetric, hiddenDayKeySet, hiddenIdeaIdsSet, ideasSort, listIdeas]
  );

  const showDateDividers = usesIdeaTimelineDividers(ideasSort);
  const listEntries = useMemo<IdeaListEntry[]>(() => {
    const buildIdeaEntry = (idea: any, dayDividerLabel?: string | null, dayStartTsValue?: number | null): IdeaListEntry => ({
      key: `idea:${idea.id}`,
      type: "idea",
      idea,
      dayDividerLabel,
      dayStartTs: dayStartTsValue ?? null,
    });

    if (!showDateDividers || !activeTimelineMetric) {
      const out: IdeaListEntry[] = [];
      for (const idea of listIdeas) {
        if (hiddenIdeaIdsSet.has(idea.id)) continue; // one-off hidden
        out.push(buildIdeaEntry(idea));
      }
      return out;
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
      index = nextIndex;

      // A collapsed day folds to a single labelled marker (atomic — expand the
      // whole day to get its items back). The marker always carries its label,
      // even as the topmost group.
      if (hiddenDayKeySet.has(`${activeTimelineMetric}:${bucketStartTs}`)) {
        entries.push({
          key: `collapsedDay:${activeTimelineMetric}:${bucketStartTs}`,
          type: "collapsedDay",
          label: dayLabel,
          dayStartTs: bucketStartTs,
          count: groupIdeas.length,
        });
        continue;
      }

      // Visible day: drop one-off hidden items; the label rides the first
      // remaining item (suppressed on the very first group — the sticky chip
      // covers the top).
      let pushedInGroup = false;
      groupIdeas.forEach((idea) => {
        if (hiddenIdeaIdsSet.has(idea.id)) return;
        const label = !pushedInGroup && entries.length > 0 ? dayLabel : null;
        entries.push(buildIdeaEntry(idea, label, bucketStartTs));
        pushedInGroup = true;
      });
    }
    return entries;
  }, [activeTimelineMetric, hiddenDayKeySet, hiddenIdeaIdsSet, ideasSort, listIdeas, showDateDividers]);

  useEffect(() => {
    if (!showDateDividers || listEntries.length === 0) {
      stickyDayStore.set(null);
      stickyDayStore.setTopLabel(null);
      return;
    }
    const firstEntry = listEntries[0]!;
    const firstLabel =
      firstEntry.type === "collapsedDay"
        ? firstEntry.label
        : getDateBucketLabel(getIdeaSortTimestamp(firstEntry.idea, ideasSort));
    stickyDayStore.set(firstLabel);
    stickyDayStore.setTopLabel(firstLabel);
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

  // Just the label trail for the header eyebrow (Workspace › Parent › …).
  // Interactive breadcrumbs were removed; only these strings are rendered.
  const breadcrumbs: string[] = [
    ...(activeWorkspace ? [activeWorkspace.title] : []),
    ...collectionAncestors.map((collection) => collection.title),
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
  const playerDockHeight = useStore((s) => s.playerDockHeight);
  const selectionDockBottom = 12 + Math.max(insets.bottom, 12) + playerDockHeight;
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
    itemMetaByIdeaId,
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
    floatingDockHeight,
    setFloatingDockHeight,
    selectionDockHeight,
    setSelectionDockHeight,
    rowLayoutsRef,
    highlightMapRef,
    viewabilityConfigRef,
    listRef,
    focusIdeaId,
    focusToken,
    handledFocusTokenRef,
    focusScrollTimerRef,
    searchMetaByIdeaId,
    hiddenIdeaIds,
    hiddenIdeaIdsSet,
    hiddenDays,
    hiddenDayKeySet,
    effectivelyHiddenCount,
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
    scrollY,
    collapsibleHeaderHeight,
    floatingStripBottom,
    listFooterSpacerHeight,
    activityLabel,
    activityRangeStartTs,
    activityRangeEndTs,
    activityMetricFilter,
    collectionSource,
    backLabel,
    // The dismissible "‹ Back to {origin}" chip, shown only for a contextual open.
    // Tapping it jumps back to where you came from; ✕ dismisses it. Back stays normal.
    contextualReturn: isContextualOpen
      ? {
          label: backLabel ?? "results",
          onReturn: popBackToOrigin,
          onDismiss: dismissContextualReturn,
        }
      : null,
    onBack:
      showBack
        ? () => {
            if (!goBackFromParentStack(navigation)) {
              openWorkspaceBrowseRoot(rootNavigation ?? navigation, activeWorkspace?.id);
            }
          }
        : undefined,
    // Root of the collection screen shows the hamburger — walk up to the drawer
    // navigator and open it (same pattern as the other drawer-root screens).
    openDrawer: () => {
      let nav: any = navigation;
      while (nav) {
        if (typeof nav.openDrawer === "function") {
          nav.openDrawer();
          return;
        }
        nav = nav.getParent?.();
      }
    },
    markRecentlyAdded,
  };
}
