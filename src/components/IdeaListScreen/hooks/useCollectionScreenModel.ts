import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStableArray } from "../../../hooks/useStableArray";
import { Animated } from "react-native";
import { useIsFocused, useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharedValue } from "react-native-reanimated";
import { useStore } from "../../../state/useStore";
import { getCollectionAncestors } from "../../../utils";
import { getDateBucket, getDateBucketLabel } from "../../../domain/dateBuckets";
import { compareIdeas, getIdeaCreatedAt, getIdeaSortState, getIdeaSortTimestamp, getIdeaUpdatedAt, usesIdeaTimelineDividers } from "../../../domain/ideaSort";
import { extractSnippet } from "../../../domain/search";
import {
  goBackFromParentStack,
  openCollectionInBrowse,
  openParentCollection,
  openWorkspaceBrowseRoot,
} from "../../../navigation";
import { useOriginLabel } from "../../../hooks/useOriginLabel";
import { getFloatingActionDockBottomOffset, getFloatingActionDockContentClearance } from "../../common/FloatingActionDock";
import { buildIdeaListItemMeta, projectHasLyrics } from "../ideaListItemMeta";
import type { IdeaListEntry, IdeaListItemMeta, SearchMeta } from "../types";
import { stickyDayStore } from "../stickyDayStore";
import type { SongIdea } from "../../../types";
import { useTranslation } from "react-i18next";

export function useCollectionScreenModel() {
  const { t } = useTranslation();
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
  // A VISIT: this collection was pushed on the root stack from Activity / Search /
  // Shelf / Revisit / the player queue. Back pops to that origin and the nav row
  // is labelled with it (navigation law 2026-09-16: back follows history, up
  // follows hierarchy, never label one as the other).
  const isVisit = route.name === "CollectionVisit";
  const showBack = isVisit;
  const originLabel = useOriginLabel(isVisit);

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
  // The page is a picker: a compilation is collecting, or the Lyrics Pad is
  // choosing a song. One footer replaces the selection chrome and the record FAB.
  const pickerMode = useStore((s) => s.libraryCollector != null || s.songTargetPicker != null);
  const recentlyAddedItemIds = useStore((s) => s.recentlyAddedItemIds);
  const clearRecentlyAdded = useStore((s) => s.clearRecentlyAdded);
  const markRecentlyAdded = useStore((s) => s.markRecentlyAdded);
  const markCollectionOpened = useStore((s) => s.markCollectionOpened);
  const clipClipboard = useStore((s) => s.clipClipboard);

  const ideas = useStableArray(
    useMemo(
      () => activeWorkspace?.ideas.filter((idea) => idea.collectionId === collectionId) ?? [],
      [activeWorkspace?.ideas, collectionId]
    )
  );
  const childCollections = useMemo(
    () => activeWorkspace?.collections.filter((collection) => collection.parentCollectionId === collectionId) ?? [],
    [activeWorkspace?.collections, collectionId]
  );

  const [nestedCollectionsExpanded, setNestedCollectionsExpanded] = useState(false);
  // Already settled by the search field (it debounces keystrokes locally).
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProjectStages, setSelectedProjectStages] = useState<Array<"seed" | "sprout" | "stem" | "song">>([]);
  const [lyricsFilterMode, setLyricsFilterMode] = useState<"all" | "with" | "without">("all");
  const [listDensity, setListDensity] = useState<"comfortable" | "compact">("comfortable");
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  // Only one menu open at a time. The filter/sort popover state lives inside
  // FilterSortControls; this nonce is the signal to close it (bumped whenever
  // the overflow menu opens), and openHeaderMenu is the coordinated opener.
  const [filterSortCloseNonce, setFilterSortCloseNonce] = useState(0);
  const openHeaderMenu = useCallback(() => {
    setFilterSortCloseNonce((n) => n + 1);
    setHeaderMenuOpen(true);
  }, []);
  const closeHeaderMenu = useCallback(() => setHeaderMenuOpen(false), []);
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

  const searchNeedle = searchQuery.trim().toLowerCase();

  const searchMetaByIdeaId = useMemo(() => {
    const map = new Map<string, SearchMeta>();
    const hasNeedle = searchNeedle.length > 0;
    for (const idea of ideas) {
      if (!hasNeedle) {
        map.set(idea.id, { matches: true, title: false, notes: false, lyrics: false, snippet: null, snippetField: null });
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
      // Pull the matched line so the card can show WHY it surfaced — lyrics
      // first (most meaningful for a songwriter), then notes. Title matches
      // need no snippet: the highlighted title is the match.
      let snippet: string | null = null;
      let snippetField: "notes" | "lyrics" | null = null;
      if (lyricsMatch && idea.kind === "project" && idea.lyrics?.versions?.length) {
        for (const version of idea.lyrics.versions) {
          const line = version.document.lines.find((l) => l.text.toLowerCase().includes(searchNeedle));
          if (line) {
            snippet = extractSnippet(line.text, searchNeedle);
            snippetField = "lyrics";
            break;
          }
        }
      }
      if (!snippet && notesMatch) {
        const src = idea.notes.toLowerCase().includes(searchNeedle)
          ? idea.notes
          : idea.clips.find((clip) => clip.notes.toLowerCase().includes(searchNeedle))?.notes ?? "";
        if (src) {
          snippet = extractSnippet(src, searchNeedle);
          snippetField = "notes";
        }
      }
      map.set(idea.id, {
        matches: titleMatch || notesMatch || lyricsMatch,
        title: titleMatch,
        notes: notesMatch,
        lyrics: lyricsMatch,
        snippet,
        snippetField,
      });
    }
    return map;
  }, [ideas, searchNeedle]);

  const listIdeas = useStableArray(useMemo(
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
  ));

  // Meta is cached BY IDEA IDENTITY (ideas update immutably, so an untouched idea
  // keeps its object across store writes). Rebuilding fresh meta objects for every
  // idea on any workspaces change broke the row memo for all mounted cards — e.g.
  // during post-import waveform hydration, every per-clip write re-rendered the
  // whole visible list and re-ran the lyric scans/timestamp formatting per idea.
  const ideaMetaCacheRef = useRef(new WeakMap<object, IdeaListItemMeta>());
  const itemMetaByIdeaId = useMemo(() => {
    const map = new Map<string, IdeaListItemMeta>();
    for (const idea of listIdeas) {
      let meta = ideaMetaCacheRef.current.get(idea);
      if (!meta) {
        meta = buildIdeaListItemMeta(idea);
        ideaMetaCacheRef.current.set(idea, meta);
      }
      map.set(idea.id, meta);
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

  // ── "View in collection" highlight flash ──────────────────────────────────
  // Allocate an Animated.Value for every visible row DURING RENDER, so each
  // card's (absolutely-positioned, opacity-0) highlight overlay is bound to a
  // stable value from its first mount. The effect below then animates that same
  // value natively — no re-render needed for the flash to play.
  //
  // Why not create the value lazily inside the effect (the old approach)?
  // IdeaListItem is React.memo'd and reads its highlight value from a ref during
  // its own render; a ref mutation in an effect schedules no re-render, so an
  // already-mounted row stayed bound to `null` and the flash never appeared —
  // it only survived for rows that happened to mount fresh mid-scroll. Mirrors
  // useSongClipHighlights on the song page, which had this exact fix.
  const visibleListIds = useMemo(() => new Set(listIdeas.map((idea) => idea.id)), [listIdeas]);
  for (const id of visibleListIds) {
    if (!highlightMapRef.current[id]) {
      highlightMapRef.current[id] = new Animated.Value(0);
    }
  }
  for (const id of Object.keys(highlightMapRef.current)) {
    if (!visibleListIds.has(id) && !animatingHighlightIdsRef.current.has(id)) {
      delete highlightMapRef.current[id];
    }
  }

  // A batch import highlights 25 rows whose animations all end on the same frame.
  // Clearing them one store write at a time meant 25 notifications back to back —
  // seconds of blocked JS on a large library (2026-09-21). Collect, then clear once.
  const finishedHighlightIdsRef = useRef<string[]>([]);
  const finishedHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearHighlightSoon = useCallback(
    (id: string) => {
      finishedHighlightIdsRef.current.push(id);
      if (finishedHighlightTimerRef.current) return;
      finishedHighlightTimerRef.current = setTimeout(() => {
        finishedHighlightTimerRef.current = null;
        const ids = finishedHighlightIdsRef.current;
        finishedHighlightIdsRef.current = [];
        // Released together with the store clear — freeing an id earlier let the effect
        // re-run in between and flash the same row a second time.
        ids.forEach((finishedId) => animatingHighlightIdsRef.current.delete(finishedId));
        clearRecentlyAdded(ids);
      }, 0);
    },
    [clearRecentlyAdded]
  );

  useEffect(() => {
    const idsToAnimate = recentlyAddedItemIds.filter(
      (id) => visibleListIds.has(id) && !animatingHighlightIdsRef.current.has(id)
    );
    idsToAnimate.forEach((id) => {
      const animatedValue = highlightMapRef.current[id];
      if (!animatedValue) return;
      animatingHighlightIdsRef.current.add(id);
      animatedValue.setValue(0);
      Animated.sequence([
        Animated.timing(animatedValue, { toValue: 0.9, duration: 180, useNativeDriver: true }),
        Animated.timing(animatedValue, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]).start(() => {
        animatedValue.setValue(0);
        clearHighlightSoon(id);
      });
    });
  }, [clearHighlightSoon, visibleListIds, recentlyAddedItemIds]);

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
  };

  // Just the label trail for the header eyebrow (Workspace › Parent › …).
  // Interactive breadcrumbs were removed; only these strings are rendered.
  const breadcrumbs: string[] = [
    ...(activeWorkspace ? [activeWorkspace.title] : []),
    ...collectionAncestors.map((collection) => collection.title),
  ];
  // WHERE · WHAT (2026-09-07): the nav row's eyebrow names the container this
  // collection sits in and is a single up-link to it — the parent collection, or
  // the workspace hub for a top-level one. Not the breadcrumb TRAIL that was
  // retired: one hop, one label.
  const parentCollection = collectionAncestors[collectionAncestors.length - 1] ?? null;
  const upLink =
    parentCollection
      ? {
          label: parentCollection.title,
          onPress: () => {
            openParentCollection(navigation, {
              collectionId: parentCollection.id,
              workspaceId: activeWorkspace?.id,
            });
          },
        }
      : activeWorkspace
        ? {
            label: activeWorkspace.title,
            onPress: () => {
              openWorkspaceBrowseRoot(rootNavigation ?? navigation, activeWorkspace.id);
            },
          }
        : null;

  const hasActivityRangeFilter = typeof activityRangeStartTs === "number" && typeof activityRangeEndTs === "number";
  const visibleIdeasCount = listIdeas.filter((idea) => !hiddenIdeaIdsSet.has(idea.id)).length;
  const ideasHeaderMeta = [
    // Terminology (founder decision 2026-07-23): "idea" is the umbrella term for
    // collection list items — clips AND sketches with mixed media. "Clip" stays
    // the object name for recorded fragments everywhere else.
    t("common.ideaCount", { count: visibleIdeasCount }),
    hasActivityRangeFilter ? t("common.activitySlice") : null,
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

  const playerDockHeight = useStore((s) => s.playerDockHeight);
  const importBannerHeight = useStore((s) => s.importBannerHeight);
  const floatingBaseBottom = getFloatingActionDockBottomOffset(insets.bottom, {
    playerDockHeight,
    importBannerHeight,
  });
  const floatingStripBottom = floatingBaseBottom + 70;
  const selectionDockBottom = 12 + Math.max(insets.bottom, 12) + playerDockHeight;
  const bottomToolbarAllowance = 18;
  const bottomChromeIsDock = listSelectionMode || pickerMode;
  const activeDockHeight = bottomChromeIsDock ? selectionDockHeight : floatingDockHeight;
  // The footer only has to lift the last row clear of whatever floats over the list's
  // bottom edge — nothing more. Both branches derive from the MEASURED dock heights, so
  // the space tracks what's actually on screen (media dock, import bar, selection bar)
  // instead of reserving for the worst case at all times.
  //
  // This used to add a flat 152px "scroll past" pad in normal mode, and to count
  // selectionDockHeight twice in selection mode (once via the clearance, once via
  // activeDockHeight) — together ~300px of dead scroll below the last clip.
  const listFooterSpacerHeight = bottomChromeIsDock
    ? selectionDockBottom + selectionDockHeight + bottomToolbarAllowance
    : getFloatingActionDockContentClearance(insets.bottom, { playerDockHeight, importBannerHeight });

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
    pickerMode,
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
    openHeaderMenu,
    closeHeaderMenu,
    filterSortCloseNonce,
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
    upLink,
    collectionRouteParams,
    scrollY,
    collapsibleHeaderHeight,
    floatingStripBottom,
    listFooterSpacerHeight,
    activityLabel,
    activityRangeStartTs,
    activityRangeEndTs,
    activityMetricFilter,
    isVisit,
    // Where back lands from a visit — the nav row's label. Null on a plain
    // collection page (the hamburger row has no back).
    originLabel,
    onBack: showBack
      ? () => {
          if (!goBackFromParentStack(navigation)) {
            openWorkspaceBrowseRoot(navigation, activeWorkspace?.id);
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
