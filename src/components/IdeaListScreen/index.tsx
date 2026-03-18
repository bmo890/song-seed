import { useEffect, useMemo, useRef, useState } from "react";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { Text, View, Alert, Animated, BackHandler, Pressable, Platform } from "react-native";
import ReAnimated from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused, useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { SongIdea, ClipVersion, PlaybackQueueItem, IdeasTimelineMetric, WorkspaceHiddenDay } from "../../types";
import { ScreenHeader } from "../common/ScreenHeader";
import { AppBreadcrumbs } from "../common/AppBreadcrumbs";
import { QuickNameModal } from "../modals/QuickNameModal";
import { CollectionMoveModal } from "../modals/CollectionMoveModal";
import { CollectionActionsModal } from "../modals/CollectionActionsModal";
import { IdeaActionsSheet } from "../modals/IdeaActionsSheet";
import { IdeaListHeaderSection } from "./IdeaListHeaderSection";
import { IdeaListFilterSection } from "./IdeaListFilterSection";
import { IdeaListNestedCollectionsSection } from "./IdeaListNestedCollectionsSection";
import { IdeaListSelectionZone } from "./IdeaListSelectionZone";
import { IdeaListContent } from "./IdeaListContent";
import { IdeaListEntry } from "./types";
import {
  getFloatingActionDockBottomOffset,
  getFloatingActionDockScrollPastClearance,
} from "../common/FloatingActionDock";

import { useStore } from "../../state/useStore";
import { useScrollCollapseHeader } from "../../hooks/useScrollCollapseHeader";
import { appActions } from "../../state/actions";
import { createEmptyProjectLyrics } from "../../state/dataSlice";
import { useInlinePlayer } from "../../hooks/useInlinePlayer";
import {
  buildImportedTitle,
  importAudioAssets,
  importAudioAsset,
  pickAudioFiles,
  shareAudioFile,
  type ImportedAudioAsset,
} from "../../services/audioStorage";
import {
  buildDefaultIdeaTitle,
  ensureUniqueIdeaTitle,
  getCollectionAncestors,
  getCollectionById,
  getIdeaSizeBytes,
} from "../../utils";
import { buildCollectionMoveDestinations, getCollectionDeleteScope } from "../../collectionManagement";
import { getCollectionHierarchyLevel } from "../../hierarchy";
import {
  compareIdeas,
  getIdeaCreatedAt,
  getIdeaSortState,
  getIdeaSortTimestamp,
  getIdeaUpdatedAt,
  usesIdeaTimelineDividers,
} from "../../ideaSort";

function buildImportedProjectTitle(assets: ImportedAudioAsset[]) {
  return buildImportedTitle(assets[0]?.name);
}

export function IdeaListScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const route = useRoute<any>();
  const rootNavigation = (navigation as any).getParent?.();
  const navigateRoot = (route: string, params?: object) =>
    (rootNavigation ?? navigation).navigate(route as never, params as never);
  const insets = useSafeAreaInsets();
  const collectionId = route.params?.collectionId as string | undefined;
  const activityRangeStartTs = route.params?.activityRangeStartTs as number | undefined;
  const activityRangeEndTs = route.params?.activityRangeEndTs as number | undefined;
  const activityMetricFilter = (route.params?.activityMetricFilter as "created" | "updated" | "both" | undefined) ?? "both";
  const activityLabel = route.params?.activityLabel as string | undefined;
  const focusIdeaId = route.params?.focusIdeaId as string | undefined;
  const focusToken = route.params?.focusToken as number | undefined;

  const workspaces = useStore((s) => s.workspaces);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const currentCollection = activeWorkspace?.collections.find((collection) => collection.id === collectionId) ?? null;
  const ideas = useMemo(
    () => activeWorkspace?.ideas.filter((idea) => idea.collectionId === collectionId) ?? [],
    [activeWorkspace?.ideas, collectionId]
  );
  const childCollections = useMemo(
    () =>
      activeWorkspace?.collections.filter(
        (collection) => collection.parentCollectionId === collectionId
      ) ?? [],
    [activeWorkspace?.collections, collectionId]
  );
  const recordingIdeaId = useStore((s) => s.recordingIdeaId);

  const ideasFilter = useStore((s) => s.ideasFilter);
  const ideasSort = useStore((s) => s.ideasSort);
  const setIdeasFilter = useStore((s) => s.setIdeasFilter);
  const setIdeasHidden = useStore((s) => s.setIdeasHidden);
  const setTimelineDaysHidden = useStore((s) => s.setTimelineDaysHidden);
  const updateCollection = useStore((s) => s.updateCollection);
  const moveCollection = useStore((s) => s.moveCollection);
  const deleteCollection = useStore((s) => s.deleteCollection);
  const markCollectionOpened = useStore((s) => s.markCollectionOpened);

  const listSelectionMode = useStore((s) => s.listSelectionMode);
  const selectedListIdeaIds = useStore((s) => s.selectedListIdeaIds);
  const replaceListSelection = useStore((s) => s.replaceListSelection);

  const cancelClipboard = () => useStore.getState().setClipClipboard(null);

  const clipClipboard = useStore((s) => s.clipClipboard);
  const recentlyAddedItemIds = useStore((s) => s.recentlyAddedItemIds);
  const clearRecentlyAdded = useStore((s) => s.clearRecentlyAdded);
  const markRecentlyAdded = useStore((s) => s.markRecentlyAdded);

  const setSelectedIdeaId = useStore((s) => s.setSelectedIdeaId);

  const inlinePlayer = useInlinePlayer();
  const listRef = useRef<any>(null);
  const handledFocusTokenRef = useRef<number | null>(null);
  const focusScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the inline player visibility flag tied to screen focus so returning
  // from song detail restores inline ownership and does not leave the global
  // dock thinking the inline UI is hidden.
  useEffect(() => {
    useStore.getState().setInlinePlayerMounted(isFocused);
    return () => useStore.getState().setInlinePlayerMounted(false);
  }, [isFocused]);

  useEffect(() => {
    if (!inlinePlayer.inlineTarget) return;
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      void inlinePlayer.resetInlinePlayer();
      return true;
    });
    return () => handler.remove();
  }, [inlinePlayer, inlinePlayer.inlineTarget]);

  useEffect(() => {
    if (!collectionId) return;
    markCollectionOpened(collectionId);
  }, [collectionId, markCollectionOpened]);

  useEffect(() => {
    return () => {
      if (focusScrollTimerRef.current) {
        clearTimeout(focusScrollTimerRef.current);
      }
    };
  }, []);

  const hiddenIdeaIds = currentCollection?.ideasListState.hiddenIdeaIds ?? [];
  const hiddenDays = currentCollection?.ideasListState.hiddenDays ?? [];

  const [hoveredIdeaId, setHoveredIdeaId] = useState<string | null>(null);
  const [dropIntent] = useState<"between" | "inside">("between");
  const rowLayoutsRef = useRef<Record<string, { y: number; height: number }>>({});
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editClipId, setEditClipId] = useState<string | null>(null);
  const [editClipDraft, setEditClipDraft] = useState("");
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importAssets, setImportAssets] = useState<ImportedAudioAsset[]>([]);
  const [importMode, setImportMode] = useState<"single-clip" | "song-project" | null>(null);
  const [importDraft, setImportDraft] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [managedCollectionId, setManagedCollectionId] = useState<string | null>(null);
  const [collectionActionsOpen, setCollectionActionsOpen] = useState(false);
  const [collectionRenameModalOpen, setCollectionRenameModalOpen] = useState(false);
  const [collectionDraft, setCollectionDraft] = useState("");
  const [collectionMoveModalOpen, setCollectionMoveModalOpen] = useState(false);
  const [selectedMoveWorkspaceId, setSelectedMoveWorkspaceId] = useState<string | null>(null);
  const [selectedMoveParentCollectionId, setSelectedMoveParentCollectionId] = useState<string | null>(null);
  const [nestedCollectionsExpanded, setNestedCollectionsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [selectedProjectStages, setSelectedProjectStages] = useState<Array<"seed" | "sprout" | "semi" | "song">>([]);
  const [lyricsFilterMode, setLyricsFilterMode] = useState<"all" | "with" | "without">("all");
  const [listDensity, setListDensity] = useState<"comfortable" | "compact">("comfortable");
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const {
    handleScroll: handleListScroll,
    scrollEventThrottle: listScrollThrottle,
    animStyle: headerCollapseAnimStyle,
  } = useScrollCollapseHeader();
  const [ideaSizeMap, setIdeaSizeMap] = useState<Record<string, number>>({});
  const [stickyDayLabel, setStickyDayLabel] = useState<string | null>(null);
  const [stickyDayTop, setStickyDayTop] = useState<number>(0);
  const [floatingDockHeight, setFloatingDockHeight] = useState(62);
  const [selectionDockHeight, setSelectionDockHeight] = useState(120);
  const [undoState, setUndoState] = useState<{
    id: string;
    message: string;
    undo: () => void;
  } | null>(null);
  const highlightMapRef = useRef<Record<string, Animated.Value>>({});
  const animatingHighlightIdsRef = useRef<Set<string>>(new Set());
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const floatingBaseBottom = getFloatingActionDockBottomOffset(insets.bottom);
  const floatingStripBottom = floatingBaseBottom + 70;
  const selectionDockBottom = 12 + Math.max(insets.bottom, 12);
  const bottomToolbarAllowance = Platform.OS === "android" ? 18 : 0;
  const activeDockHeight = listSelectionMode ? selectionDockHeight : floatingDockHeight;
  const activeDockClearance = listSelectionMode
    ? selectionDockBottom + selectionDockHeight
    : getFloatingActionDockScrollPastClearance(insets.bottom);
  const listFooterSpacerHeight =
    activeDockClearance + (listSelectionMode ? activeDockHeight : 0) + bottomToolbarAllowance;
  const viewabilityConfigRef = useRef({ itemVisiblePercentThreshold: 35 });
  const ideasSortRef = useRef(ideasSort);
  const hiddenIdeaIdsSet = useMemo(() => new Set(hiddenIdeaIds), [hiddenIdeaIds]);
  const hiddenDayKeySet = useMemo(
    () => new Set(hiddenDays.map((day) => `${day.metric}:${day.dayStartTs}`)),
    [hiddenDays]
  );
  const activeTimelineMetric = useMemo<IdeasTimelineMetric | null>(() => {
    const metric = getIdeaSortState(ideasSort).metric;
    return metric === "created" || metric === "updated" ? metric : null;
  }, [ideasSort]);
  const activeSortMetric = useMemo(() => getIdeaSortState(ideasSort).metric, [ideasSort]);

  const filteredIdeas = useMemo(() => {
    const base = ideasFilter === "all"
      ? [...ideas]
      : ideasFilter === "clips"
        ? ideas.filter((i) => i.kind === "clip")
        : ideas.filter((i) => i.kind === "project");

    const filteredByActivityRange = base.filter((idea) => {
      if (
        typeof activityRangeStartTs !== "number" ||
        typeof activityRangeEndTs !== "number"
      ) {
        return true;
      }

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

  const editTargetIdea = editClipId ? ideas.find((idea) => idea.id === editClipId) ?? null : null;
  const selectedIdeasInList = ideas.filter((idea) => selectedListIdeaIds.includes(idea.id));
  const searchNeedle = debouncedSearchQuery.trim().toLowerCase();
  const projectHasLyrics = (idea: SongIdea) =>
    idea.kind === "project" &&
    (idea.lyrics?.versions ?? []).some((version) =>
      version.document.lines.some(
        (line) => line.text.trim().length > 0 || line.chords.length > 0
      )
    );

  const searchMetaByIdeaId = useMemo(() => {
    const map = new Map<
      string,
      { matches: boolean; title: boolean; notes: boolean; lyrics: boolean }
    >();
    const hasNeedle = searchNeedle.length > 0;

    for (const idea of ideas) {
      if (!hasNeedle) {
        map.set(idea.id, { matches: true, title: false, notes: false, lyrics: false });
        continue;
      }

      const titleMatch = idea.title.toLowerCase().includes(searchNeedle);
      const notesMatch =
        idea.notes.toLowerCase().includes(searchNeedle) ||
        idea.clips.some(
          (clip) =>
            clip.notes.toLowerCase().includes(searchNeedle)
        );

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

      map.set(idea.id, {
        matches: titleMatch || notesMatch || lyricsMatch,
        title: titleMatch,
        notes: notesMatch,
        lyrics: lyricsMatch,
      });
    }

    return map;
  }, [ideas, searchNeedle]);

  const clipboardNames = (() => {
    if (!clipClipboard) return [] as string[];
    const sourceWs = workspaces.find((ws) => ws.id === clipClipboard.sourceWorkspaceId);
    if (!sourceWs) return [];
    if (clipClipboard.from === "list") {
      return sourceWs.ideas
        .filter((idea) => clipClipboard.clipIds.includes(idea.id))
        .map((idea) => idea.title);
    }
    const sourceIdea = sourceWs.ideas.find((i) => i.id === clipClipboard.sourceIdeaId);
    return sourceIdea?.clips.filter((c) => clipClipboard.clipIds.includes(c.id)).map((c) => c.title) ?? [];
  })();

  const listIdeas = useMemo(() => filteredIdeas.filter((idea) => {
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
      if (!selectedProjectStages.includes(idea.status as "seed" | "sprout" | "semi" | "song")) return false;
    }

    return true;
  }), [filteredIdeas, lyricsFilterMode, recordingIdeaId, searchMetaByIdeaId, selectedProjectStages]);
  const showDateDividers = usesIdeaTimelineDividers(ideasSort);
  const listEntries = useMemo<IdeaListEntry[]>(() => {
    const buildIdeaEntry = (
      idea: SongIdea,
      hidden: boolean,
      dayDividerLabel?: string | null,
      dayStartTsValue?: number | null
    ): IdeaListEntry => ({
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
      const firstDayStartTs = dayStartTs(getIdeaSortTimestamp(firstIdea, ideasSort));
      const groupIdeas: SongIdea[] = [];
      let nextIndex = index;

      while (nextIndex < listIdeas.length) {
        const nextIdea = listIdeas[nextIndex]!;
        const nextDayStartTs = dayStartTs(getIdeaSortTimestamp(nextIdea, ideasSort));
        if (nextDayStartTs !== firstDayStartTs) break;
        groupIdeas.push(nextIdea);
        nextIndex += 1;
      }

      const dayLabel = getDateDividerLabel(firstDayStartTs);
      const dayHidden = hiddenDayKeySet.has(`${activeTimelineMetric}:${firstDayStartTs}`);

      if (dayHidden) {
        entries.push({
          key: `hidden-day:${activeTimelineMetric}:${firstDayStartTs}`,
          type: "hidden-day",
          dayLabel,
          dayDividerLabel: dayLabel,
          dayStartTs: firstDayStartTs,
          metric: activeTimelineMetric,
          hiddenCount: groupIdeas.length,
        });
      } else {
        groupIdeas.forEach((idea, groupIndex) => {
          entries.push(
            buildIdeaEntry(
              idea,
              hiddenIdeaIdsSet.has(idea.id),
              entries.length > 0 && groupIndex === 0 ? dayLabel : null,
              firstDayStartTs
            )
          );
        });
      }

      index = nextIndex;
    }

    return entries;
  }, [activeTimelineMetric, hiddenDayKeySet, hiddenIdeaIdsSet, ideasSort, listIdeas, showDateDividers]);
  const playableIdeas = useMemo(
    () =>
      listEntries
        .filter((entry): entry is Extract<IdeaListEntry, { type: "idea" }> => entry.type === "idea" && !entry.hidden)
        .map((entry) => entry.idea),
    [listEntries]
  );
  const isIdeaHiddenByDay = (idea: SongIdea) =>
    activeTimelineMetric
      ? hiddenDayKeySet.has(`${activeTimelineMetric}:${dayStartTs(getIdeaSortTimestamp(idea, ideasSort))}`)
      : false;
  const isIdeaEffectivelyHidden = (idea: SongIdea) =>
    hiddenIdeaIdsSet.has(idea.id) || isIdeaHiddenByDay(idea);
  const selectableIdeaIds = listEntries
    .filter((entry): entry is Extract<IdeaListEntry, { type: "idea" }> => entry.type === "idea")
    .map((entry) => entry.idea.id);
  const listIdeaIdsKey = listIdeas.map((idea) => idea.id).join("|");
  const ideaSizeKey = listIdeas
    .map((idea) => `${idea.id}:${idea.clips.map((clip) => `${clip.id}:${clip.audioUri ?? ""}`).join(",")}`)
    .join("|");
  const selectedHiddenIdeaIds = selectedIdeasInList
    .filter((idea) => hiddenIdeaIdsSet.has(idea.id))
    .map((idea) => idea.id);
  const selectedInteractiveIdeas = selectedIdeasInList.filter((idea) => !isIdeaEffectivelyHidden(idea));
  const selectedClipIdeasInList = selectedInteractiveIdeas.filter((idea) => idea.kind === "clip");
  const selectedProjectsInList = selectedIdeasInList.filter((idea) => idea.kind === "project");
  const selectedHiddenOnly = selectedIdeasInList.length > 0 && selectedIdeasInList.every((idea) => hiddenIdeaIdsSet.has(idea.id));

  useEffect(() => {
    if (!focusIdeaId || !focusToken || handledFocusTokenRef.current === focusToken) return;
    if (!ideas.some((idea) => idea.id === focusIdeaId)) {
      handledFocusTokenRef.current = focusToken;
      (navigation as any).setParams({ focusIdeaId: undefined, focusToken: undefined });
      return;
    }

    const targetIndex = listEntries.findIndex(
      (entry) => entry.type === "idea" && entry.idea.id === focusIdeaId
    );

    if (targetIndex === -1) {
      let changed = false;
      if (searchQuery.length > 0 || debouncedSearchQuery.length > 0) {
        setSearchQuery("");
        setDebouncedSearchQuery("");
        changed = true;
      }
      if (selectedProjectStages.length > 0) {
        setSelectedProjectStages([]);
        changed = true;
      }
      if (lyricsFilterMode !== "all") {
        setLyricsFilterMode("all");
        changed = true;
      }
      if (ideasFilter !== "all") {
        setIdeasFilter("all");
        changed = true;
      }
      if (!changed) {
        handledFocusTokenRef.current = focusToken;
        (navigation as any).setParams({ focusIdeaId: undefined, focusToken: undefined });
      }
      return;
    }

    handledFocusTokenRef.current = focusToken;
    markRecentlyAdded([focusIdeaId]);
    if (focusScrollTimerRef.current) {
      clearTimeout(focusScrollTimerRef.current);
      focusScrollTimerRef.current = null;
    }

    const scrollToFocusedIdea = (attempt: number) => {
      const layout = rowLayoutsRef.current[focusIdeaId];
      if (layout) {
        const topInset = 112;
        listRef.current?.scrollToOffset?.({
          offset: Math.max(0, layout.y - topInset),
          animated: attempt > 0,
        });
        return;
      }

      if (attempt === 0) {
        listRef.current?.scrollToIndex?.({
          index: targetIndex,
          animated: false,
          viewPosition: 0.35,
        });
      }

      if (attempt >= 3) {
        return;
      }

      focusScrollTimerRef.current = setTimeout(() => {
        scrollToFocusedIdea(attempt + 1);
      }, 90);
    };

    scrollToFocusedIdea(0);
    (navigation as any).setParams({ focusIdeaId: undefined, focusToken: undefined });
  }, [
    debouncedSearchQuery,
    focusIdeaId,
    focusToken,
    ideas,
    ideasFilter,
    listEntries,
    lyricsFilterMode,
    markRecentlyAdded,
    navigation,
    searchQuery,
    selectedProjectStages,
    setIdeasFilter,
  ]);
  const hiddenDayGroupsInView = useMemo(() => {
    if (!activeTimelineMetric) return [] as WorkspaceHiddenDay[];
    const groupMap = new Map<string, WorkspaceHiddenDay>();

    for (const idea of listIdeas) {
      const nextDayStartTs = dayStartTs(getIdeaSortTimestamp(idea, ideasSort));
      const nextKey = `${activeTimelineMetric}:${nextDayStartTs}`;
      if (!hiddenDayKeySet.has(nextKey)) continue;
      groupMap.set(nextKey, { metric: activeTimelineMetric, dayStartTs: nextDayStartTs });
    }

    return Array.from(groupMap.values());
  }, [activeTimelineMetric, hiddenDayKeySet, ideasSort, listIdeas]);
  const hiddenIdeaIdsInView = useMemo(
    () => listIdeas.filter((idea) => hiddenIdeaIdsSet.has(idea.id)).map((idea) => idea.id),
    [hiddenIdeaIdsSet, listIdeas]
  );
  const hiddenItemsCount = useMemo(
    () => listIdeas.filter((idea) => isIdeaEffectivelyHidden(idea)).length,
    [listIdeas, hiddenDayKeySet, hiddenIdeaIdsSet, ideasSort, activeTimelineMetric]
  );
  const hasActivityRangeFilter =
    typeof activityRangeStartTs === "number" && typeof activityRangeEndTs === "number";
  const visibleIdeasCount = listIdeas.filter((idea) => !isIdeaEffectivelyHidden(idea)).length;
  const ideasHeaderMeta = [
    `${visibleIdeasCount} idea${visibleIdeasCount === 1 ? "" : "s"}`,
    hasActivityRangeFilter ? "activity slice" : null,
  ]
    .filter((value): value is string => !!value)
    .join("  •  ");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 160);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    ideasSortRef.current = ideasSort;
  }, [ideasSort]);

  useEffect(() => {
    if (listSelectionMode) {
      setHeaderMenuOpen(false);
    }
  }, [listSelectionMode]);

  useEffect(() => {
    if (!showDateDividers || listEntries.length === 0) {
      setStickyDayLabel(null);
      return;
    }
    const firstEntry = listEntries[0]!;
    setStickyDayLabel(
      firstEntry.type === "idea"
        ? getDateDividerLabel(getIdeaSortTimestamp(firstEntry.idea, ideasSort))
        : firstEntry.dayLabel
    );
  }, [ideasSort, listEntries, showDateDividers]);

  useEffect(() => {
    const visibleIds = new Set(listIdeas.map((idea) => idea.id));
    const idsToAnimate = recentlyAddedItemIds.filter(
      (id) => visibleIds.has(id) && !animatingHighlightIdsRef.current.has(id)
    );

    idsToAnimate.forEach((id) => {
      animatingHighlightIdsRef.current.add(id);
      const animatedValue = new Animated.Value(0);
      highlightMapRef.current[id] = animatedValue;

      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 0.9,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]).start(() => {
        delete highlightMapRef.current[id];
        animatingHighlightIdsRef.current.delete(id);
        clearRecentlyAdded([id]);
      });
    });
  }, [clearRecentlyAdded, listIdeaIdsKey, recentlyAddedItemIds, listIdeas]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isFocused) return;
    void inlinePlayer.resetInlinePlayer();
  }, [inlinePlayer, isFocused]);

  const showUndo = (message: string, undo: () => void) => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setUndoState({ id, message, undo });
    undoTimerRef.current = setTimeout(() => {
      setUndoState((prev) => (prev?.id === id ? null : prev));
      undoTimerRef.current = null;
    }, 5000);
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const entries = await Promise.all(
        listIdeas.map(async (idea) => {
          const bytes = await getIdeaSizeBytes(idea);
          return [idea.id, bytes] as const;
        })
      );

      if (cancelled) return;

      setIdeaSizeMap((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [ideaId, sizeBytes] of entries) {
          if (next[ideaId] !== sizeBytes) {
            next[ideaId] = sizeBytes;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [ideaSizeKey, listIdeas]);

  const buildPlayableQueue = (sourceIdeas: SongIdea[]): PlaybackQueueItem[] =>
    sourceIdeas
      .map((idea) => {
        const playClip =
          idea.kind === "clip"
            ? idea.clips.find((clip) => !!clip.audioUri) ?? null
            : idea.clips.find((clip) => clip.isPrimary && !!clip.audioUri) ?? idea.clips.find((clip) => !!clip.audioUri) ?? null;
        if (!playClip) return null;
        return { ideaId: idea.id, clipId: playClip.id };
      })
      .filter((item): item is PlaybackQueueItem => !!item);

  const playQueueInPlayer = async (queue: PlaybackQueueItem[], startIndex: number) => {
    if (queue.length === 0) {
      Alert.alert("Nothing to play", "None of the selected items have playable audio yet.");
      return;
    }
    await inlinePlayer.resetInlinePlayer();
    useStore.getState().setPlayerQueue(queue, startIndex, true);
    navigateRoot("Player");
  };

  const openIdeaFromList = async (ideaId: string, clip: ClipVersion) => {
    await inlinePlayer.resetInlinePlayer();
    useStore.getState().setPlayerQueue([{ ideaId, clipId: clip.id }], 0);
    navigateRoot("Player");
  };

  const playIdeaFromList = async (ideaId: string, clip: ClipVersion) => {
    await inlinePlayer.toggleInlinePlayback(ideaId, clip);
  };

  const playAllIdeas = async () => {
    const queue = buildPlayableQueue(playableIdeas);
    await playQueueInPlayer(queue, 0);
  };

  const playSelectedIdeas = async () => {
    const selectedIdeas = playableIdeas.filter((idea) => selectedListIdeaIds.includes(idea.id));
    const queue = buildPlayableQueue(selectedIdeas);
    await playQueueInPlayer(queue, 0);
  };

  const getShareableClip = (idea: SongIdea) =>
    idea.kind === "clip"
      ? idea.clips.find((clip) => !!clip.audioUri) ?? null
      : idea.clips.find((clip) => clip.isPrimary && !!clip.audioUri) ??
        idea.clips.find((clip) => !!clip.audioUri) ??
        null;

  const quickShareIdea = async (idea: SongIdea) => {
    const clip = getShareableClip(idea);
    if (!clip?.audioUri) {
      Alert.alert("Nothing to share", "This item does not have playable audio yet.");
      return;
    }

    try {
      await shareAudioFile(clip.audioUri, clip.title || idea.title);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not share this item.";
      Alert.alert("Share failed", message);
    }
  };

  const quickClipboardIdea = (idea: SongIdea, mode: "copy" | "move") => {
    useStore.getState().replaceListSelection([idea.id]);
    appActions.startClipboardFromList(mode);
  };

  const quickDeleteIdea = (idea: SongIdea) => {
    const title = idea.title || (idea.kind === "project" ? "this song" : "this clip");
    const message =
      idea.kind === "project"
        ? `Delete "${title}" and all its clips?`
        : `Delete "${title}"?`;

    Alert.alert("Delete item?", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          const previousIdeas = ideas;
          useStore.getState().replaceListSelection([idea.id]);
          appActions.deleteSelectedIdeasFromList();
          showUndo(`Deleted ${idea.kind === "project" ? "song" : "clip"} "${title}"`, () => {
            useStore.getState().updateIdeas(() => previousIdeas);
          });
        },
      },
    ]);
  };

  const quickEditIdea = (idea: SongIdea) => {
    if (idea.kind === "project") {
      setSelectedIdeaId(idea.id);
      (rootNavigation ?? navigation).navigate(
        "IdeaDetail" as never,
        { ideaId: idea.id, startInEdit: true } as never
      );
      return;
    }

    setEditClipId(idea.id);
    setEditClipDraft(idea.title);
    setEditModalOpen(true);
  };

  const maybeResetInlineForIdeaIds = async (ideaIds: string[]) => {
    const activeIdeaId = inlinePlayer.inlineTarget?.ideaId;
    if (!activeIdeaId || !ideaIds.includes(activeIdeaId)) return;
    await inlinePlayer.resetInlinePlayer();
  };

  const hideIdeasFromList = async (ideaIds: string[]) => {
    const nextIdeaIds = Array.from(new Set(ideaIds));
    if (nextIdeaIds.length === 0) return;
    if (!collectionId) return;
    await maybeResetInlineForIdeaIds(nextIdeaIds);
    setIdeasHidden(collectionId, nextIdeaIds, true);
  };

  const unhideIdeasFromList = (ideaIds: string[]) => {
    const nextIdeaIds = Array.from(new Set(ideaIds));
    if (nextIdeaIds.length === 0) return;
    if (!collectionId) return;
    setIdeasHidden(collectionId, nextIdeaIds, false);
  };

  const hideTimelineDay = async (metric: IdeasTimelineMetric, dayStartTsValue: number) => {
    if (!collectionId) return;
    const ideaIdsInDay = listIdeas
      .filter((idea) => dayStartTs(getIdeaSortTimestamp(idea, ideasSort)) === dayStartTsValue)
      .map((idea) => idea.id);
    await maybeResetInlineForIdeaIds(ideaIdsInDay);
    setTimelineDaysHidden(collectionId, [{ metric, dayStartTs: dayStartTsValue }], true);
  };

  const unhideTimelineDay = (metric: IdeasTimelineMetric, dayStartTsValue: number) => {
    if (!collectionId) return;
    setTimelineDaysHidden(collectionId, [{ metric, dayStartTs: dayStartTsValue }], false);
  };

  const toggleHiddenSelection = async () => {
    if (selectedHiddenOnly) {
      unhideIdeasFromList(selectedHiddenIdeaIds);
      useStore.getState().cancelListSelection();
      return;
    }

    const ideaIdsToHide = selectedInteractiveIdeas.map((idea) => idea.id);
    if (ideaIdsToHide.length === 0) return;
    await hideIdeasFromList(ideaIdsToHide);
    useStore.getState().cancelListSelection();
  };

  const unhideAllInCurrentView = () => {
    if (hiddenIdeaIdsInView.length > 0) {
      unhideIdeasFromList(hiddenIdeaIdsInView);
    }
    if (hiddenDayGroupsInView.length > 0) {
      if (collectionId) {
        setTimelineDaysHidden(collectionId, hiddenDayGroupsInView, false);
      }
    }
    setHeaderMenuOpen(false);
  };

  const [actionSheetIdea, setActionSheetIdea] = useState<SongIdea | null>(null);

  const openIdeaActions = (idea: SongIdea) => {
    setActionSheetIdea(idea);
  };
  const closeIdeaActions = () => {
    setActionSheetIdea(null);
  };

  function updateIdeaTitle(id: string, newName: string) {
    useStore.getState().renameIdeaPreservingActivity(id, newName);
  }

  function createProjectFromSelection() {
    const selectedIdeas = selectedInteractiveIdeas;
    const selectedClipIdeas = selectedClipIdeasInList;
    const selectedProjects = selectedIdeas.filter((idea) => idea.kind === "project");

    if (selectedClipIdeas.length === 0) {
      Alert.alert("Select clips", "Select at least one clip to turn into a new song.");
      return;
    }

    if (selectedProjects.length > 0) {
      const projectNames = selectedProjects.slice(0, 4).map((project) => project.title);
      Alert.alert(
        "Can't add songs to a song",
        `Songs can't be added inside a new song from this collection. Selected songs: ${projectNames.join(", ")}${selectedProjects.length > 4 ? "…" : ""}`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unselect songs",
            onPress: () => {
              const clipIdeaIds = selectedClipIdeas.map((idea) => idea.id);
              replaceListSelection(clipIdeaIds);
              createProjectFromClipIdeas(selectedClipIdeas);
            },
          },
        ]
      );
      return;
    }

    createProjectFromClipIdeas(selectedClipIdeas);
  }

  function createProjectFromClipIdeas(targetClips: SongIdea[]) {
    if (targetClips.length === 0 || !collectionId) return;

    const previousIdeas = ideas;
    const projectId = `idea-${Date.now()}`;
    const generatedTitle = ensureUniqueIdeaTitle(
      buildDefaultIdeaTitle(),
      ideas.map((idea) => idea.title)
    );
    const allClips = targetClips.flatMap((i) => i.clips);
    allClips.sort((a, b) => b.createdAt - a.createdAt);
    const now = Date.now();

    const mergedProject: SongIdea = {
      id: projectId,
      title: generatedTitle,
      notes: "",
      status: "seed",
      completionPct: 0,
      kind: "project",
      collectionId,
      clips: allClips.map((c, idx) => ({ ...c, isPrimary: idx === 0 })),
      lyrics: createEmptyProjectLyrics(),
      createdAt: now,
      lastActivityAt: now,
      isDraft: true,
    };

    const selectedClipIds = targetClips.map((idea) => idea.id);
    useStore.getState().updateIdeas((prev) => [mergedProject, ...prev.filter((i) => !selectedClipIds.includes(i.id))]);
    useStore.getState().cancelListSelection();
    showUndo(`Created song "${generatedTitle}"`, () => {
      useStore.getState().updateIdeas(() => previousIdeas);
    });
    setSelectedIdeaId(projectId);
    navigateRoot("IdeaDetail");
  }

  const deleteSelectedIdeasWithUndo = () => {
    if (selectedListIdeaIds.length === 0) return;
    const previousIdeas = ideas;
    const deletedCount = selectedListIdeaIds.length;
    appActions.deleteSelectedIdeasFromList();
    showUndo(`Deleted ${deletedCount} item${deletedCount === 1 ? "" : "s"}`, () => {
      useStore.getState().updateIdeas(() => previousIdeas);
    });
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ item: IdeaListEntry }> }) => {
    const first = viewableItems?.[0]?.item;
    if (!first) return;
    if (first.type === "hidden-day") {
      setStickyDayLabel(first.dayLabel);
      return;
    }
    const ts = getIdeaSortTimestamp(first.idea, ideasSortRef.current);
    setStickyDayLabel(getDateDividerLabel(ts));
  }).current;

  function onReorderIdeas(opts: { items: SongIdea[], from: number, to: number, sourceId?: string, targetId?: string, intent: "between" }) {
    if (!collectionId) return;
    useStore.getState().updateIdeas((prev) => {
      const map = new Map(prev.map((idea) => [idea.id, idea]));
      const reorderedIdeas = opts.items.map((idea) => map.get(idea.id)!).filter(Boolean);
      let reorderIndex = 0;
      return prev.map((idea) => {
        if (idea.collectionId !== collectionId) return idea;
        const nextIdea = reorderedIdeas[reorderIndex];
        reorderIndex += 1;
        return nextIdea ?? idea;
      });
    });
  }

  function resetImportModal() {
    if (isImporting) return;
    setImportModalOpen(false);
    setImportAssets([]);
    setImportMode(null);
    setImportDraft("");
  }

  async function openImportAudioFlow() {
    if (!collectionId || !currentCollection) {
      Alert.alert("Choose a collection", "Open a collection before importing audio.");
      return;
    }

    const assets = await pickAudioFiles({ multiple: true });
    if (assets.length === 0) return;

    if (assets.length === 1) {
      setImportAssets(assets);
      setImportMode("single-clip");
      setImportDraft("");
      setImportModalOpen(true);
      return;
    }

    Alert.alert(
      "Import audio",
      `Choose how to add ${assets.length} files into ${currentCollection.title}.`,
      [
        {
          text: "Import as individual clips",
          onPress: () => {
            void importAssetsAsIndividualClips(assets);
          },
        },
        {
          text: "Import as song project",
          onPress: () => {
            setImportAssets(assets);
            setImportMode("song-project");
            setImportDraft("");
            setImportModalOpen(true);
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  }

  async function importAssetsAsIndividualClips(assets: ImportedAudioAsset[]) {
    if (!collectionId || assets.length === 0 || isImporting) return;

    try {
      setIsImporting(true);
      const { imported, failed } = await importAudioAssets(
        assets,
        (_asset, index) => `audio-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`
      );

      imported.forEach((asset) => {
        appActions.importClipToCollection(collectionId, {
          title: buildImportedTitle(asset.name),
          audioUri: asset.audioUri,
          durationMs: asset.durationMs,
          waveformPeaks: asset.waveformPeaks,
        });
      });

      if (failed.length > 0) {
        Alert.alert(
          imported.length > 0 ? "Import finished with issues" : "Import failed",
          imported.length > 0
            ? `${imported.length} file${imported.length === 1 ? "" : "s"} imported as individual clips. ${failed.length} file${failed.length === 1 ? "" : "s"} could not be imported.`
            : "None of the selected files could be imported."
        );
      }
    } catch (error) {
      console.warn("Import audio error", error);
      Alert.alert("Import failed", "Could not import those audio files.");
    } finally {
      setIsImporting(false);
    }
  }

  async function saveImportedAudio() {
    if (!collectionId || importAssets.length === 0 || !importMode || isImporting) return;

    try {
      setIsImporting(true);
      if (importMode === "single-clip") {
        const importAsset = importAssets[0]!;
        const importedAudio = await importAudioAsset(
          importAsset,
          `audio-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        );
        const fallbackTitle = buildImportedTitle(importAsset.name);
        const finalTitle = importDraft.trim() || fallbackTitle;

        appActions.importClipToCollection(collectionId, {
          title: finalTitle,
          audioUri: importedAudio.audioUri,
          durationMs: importedAudio.durationMs,
          waveformPeaks: importedAudio.waveformPeaks,
        });
      } else {
        const { imported, failed } = await importAudioAssets(
          importAssets,
          (_asset, index) => `audio-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`
        );
        const projectTitle = importDraft.trim() || buildImportedProjectTitle(importAssets);

        if (imported.length === 0) {
          Alert.alert("Import failed", "None of the selected files could be imported.");
          return;
        }

        appActions.importProjectToCollection(collectionId, {
          title: projectTitle,
          clips: imported.map((asset) => ({
            title: buildImportedTitle(asset.name),
            audioUri: asset.audioUri,
            durationMs: asset.durationMs,
            waveformPeaks: asset.waveformPeaks,
          })),
        });

        if (failed.length > 0) {
          Alert.alert(
            "Import finished with issues",
            `${imported.length} file${imported.length === 1 ? "" : "s"} imported into the song project. ${failed.length} file${failed.length === 1 ? "" : "s"} could not be imported.`
          );
        }
      }

      resetImportModal();
    } catch (error) {
      console.warn("Import audio error", error);
      Alert.alert("Import failed", "Could not import that audio.");
    } finally {
      setIsImporting(false);
    }
  }

  const duplicateWarningText = (() => {
    if (!clipClipboard || clipClipboard.sourceWorkspaceId !== activeWorkspaceId) return "";
    let itemNames: string[] = [];
    const sourceWs = workspaces.find(w => w.id === clipClipboard.sourceWorkspaceId);
    if (!sourceWs) return "";

    if (clipClipboard.from === "list") {
      itemNames = sourceWs.ideas
        .filter(i => clipClipboard.clipIds.includes(i.id))
        .map(i => i.title);
    } else if (clipClipboard.from === "project" && clipClipboard.sourceIdeaId) {
      const sourceIdea = sourceWs.ideas.find((i) => i.id === clipClipboard.sourceIdeaId);
      itemNames = sourceIdea?.clips.filter((c) => clipClipboard.clipIds.includes(c.id)).map((c) => c.title) ?? [];
    }
    const displayNames = itemNames.slice(0, 5).map(n => `"${n}"`).join(", ");
    const remainder = itemNames.length > 5 ? ` and ${itemNames.length - 5} other${itemNames.length - 5 > 1 ? "s" : ""}` : "";
    return `You are copying ${itemNames.length} item${itemNames.length > 1 ? "s" : ""} (${displayNames}${remainder}) into the same collection they already belong to. This will create duplicates. Continue?`;
  })();

  const collectionAncestors = useMemo(
    () =>
      activeWorkspace && currentCollection
        ? getCollectionAncestors(activeWorkspace, currentCollection.id)
        : [],
    [activeWorkspace, currentCollection]
  );
  const managedCollection =
    activeWorkspace?.collections.find((collection) => collection.id === managedCollectionId) ?? null;
  const managedCollectionHasChildren = useMemo(
    () =>
      managedCollection
        ? activeWorkspace?.collections.some(
            (collection) => collection.parentCollectionId === managedCollection.id
          ) ?? false
        : false,
    [activeWorkspace?.collections, managedCollection]
  );
  const moveDestinations = useMemo(() => {
    return buildCollectionMoveDestinations(workspaces, managedCollection, activeWorkspaceId);
  }, [activeWorkspaceId, managedCollection, workspaces]);

  useEffect(() => {
    if (!collectionMoveModalOpen) return;
    const firstDestination = moveDestinations[0] ?? null;
    setSelectedMoveWorkspaceId(firstDestination?.workspaceId ?? null);
    setSelectedMoveParentCollectionId(firstDestination?.parentCollectionId ?? null);
  }, [collectionMoveModalOpen, moveDestinations]);

  const goToBrowse = () => {
    (rootNavigation ?? navigation).navigate("Home" as never, { screen: "Browse" } as never);
  };

  const openCollectionActions = (targetCollectionId: string) => {
    setManagedCollectionId(targetCollectionId);
    setCollectionActionsOpen(true);
  };

  const openRenameCollection = () => {
    if (!managedCollection) return;
    setHeaderMenuOpen(false);
    setCollectionActionsOpen(false);
    setCollectionDraft(managedCollection.title);
    setCollectionRenameModalOpen(true);
  };

  const openMoveCollection = () => {
    if (!managedCollection) return;
    setHeaderMenuOpen(false);
    setCollectionActionsOpen(false);
    if (moveDestinations.length === 0) {
      Alert.alert(
        "No move targets",
        managedCollectionHasChildren
          ? "This collection already has subcollections, so it can only stay at the top level."
          : "There are no valid collection destinations available right now."
      );
      return;
    }
    setCollectionMoveModalOpen(true);
  };

  const confirmDeleteCollection = () => {
    if (!activeWorkspace || !managedCollection) return;
    const { childCollectionCount, itemCount } = getCollectionDeleteScope(
      activeWorkspace,
      managedCollection.id
    );
    setHeaderMenuOpen(false);
    setCollectionActionsOpen(false);
    Alert.alert(
      "Delete collection?",
      `${managedCollection.title} will be removed${childCollectionCount > 0 ? ` along with ${childCollectionCount} subcollection${childCollectionCount === 1 ? "" : "s"}` : ""} and ${itemCount} item${itemCount === 1 ? "" : "s"}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteCollection(managedCollection.id);
            setManagedCollectionId(null);
          },
        },
      ]
    );
  };

  const submitCollectionMove = () => {
    if (!managedCollection || !selectedMoveWorkspaceId) return;

    const result = moveCollection(
      managedCollection.id,
      selectedMoveWorkspaceId,
      selectedMoveParentCollectionId
    );

    if (!result.ok) {
      Alert.alert("Move failed", result.error ?? "Could not move this collection.");
      return;
    }

    setCollectionMoveModalOpen(false);
    setManagedCollectionId(null);
  };

  if (!activeWorkspace || !collectionId || !currentCollection) {
    return (
      <SafeAreaView style={styles.screen}>
        <ScreenHeader title="Collection" leftIcon="hamburger" />
        <Text style={styles.subtitle}>This collection could not be found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, styles.screenIdeas]}>
      <ScreenHeader
        title="Ideas"
        leftIcon="hamburger"
        rightElement={
          !listSelectionMode ? (
            <Pressable
              style={({ pressed }) => [styles.ideasHeaderMenuBtn, pressed ? styles.pressDown : null]}
              onPress={() => setHeaderMenuOpen((prev) => !prev)}
            >
              <Ionicons name="ellipsis-horizontal" size={16} color="#334155" />
            </Pressable>
          ) : (
            <View style={styles.ideasHeaderMenuBtnPlaceholder} />
          )
        }
      />

      <ReAnimated.View style={headerCollapseAnimStyle}>
        <AppBreadcrumbs
          items={[
            {
              key: "home",
              label: "Home",
              level: "home",
              iconOnly: true,
              onPress: () => navigateRoot("Home", { screen: "Workspaces" }),
            },
            {
              key: `workspace-${activeWorkspace.id}`,
              label: activeWorkspace.title,
              level: "workspace",
              onPress: goToBrowse,
            },
            ...collectionAncestors.map((collection) => ({
              key: collection.id,
              label: collection.title,
              level: getCollectionHierarchyLevel(collection),
              onPress: () => navigateRoot("CollectionDetail", { collectionId: collection.id }),
            })),
            {
              key: currentCollection.id,
              label: currentCollection.title,
              level: getCollectionHierarchyLevel(currentCollection),
              active: true,
            },
          ]}
        />

        <IdeaListHeaderSection
          currentCollection={currentCollection}
          ideasHeaderMeta={ideasHeaderMeta}
          searchQuery={searchQuery}
          hasActivityRangeFilter={hasActivityRangeFilter}
          activityLabel={activityLabel}
          collectionId={collectionId}
          clipClipboard={clipClipboard}
          duplicateWarningText={duplicateWarningText}
          onSearchQueryChange={setSearchQuery}
          onClearActivityRange={() => {
            (navigation as any).setParams({
              activityRangeStartTs: undefined,
              activityRangeEndTs: undefined,
              activityMetricFilter: undefined,
              activityLabel: undefined,
            });
          }}
          onPasteClipboard={() => {
            void appActions.pasteClipboardToCollection(collectionId);
          }}
          onCancelClipboard={cancelClipboard}
        />
      </ReAnimated.View>

      <IdeaListFilterSection
        selectedProjectStages={selectedProjectStages}
        lyricsFilterMode={lyricsFilterMode}
        showDateDividers={showDateDividers}
        stickyDayLabel={stickyDayLabel}
        stickyDayTop={stickyDayTop}
        onLayout={(nextTop) =>
          setStickyDayTop((prev) => (Math.abs(prev - nextTop) < 1 ? prev : nextTop))
        }
        onToggleProjectStage={(stage) => {
          setSelectedProjectStages((prev) =>
            prev.includes(stage) ? prev.filter((item) => item !== stage) : [...prev, stage]
          );
        }}
        onClearProjectStages={() => setSelectedProjectStages([])}
        onLyricsFilterModeChange={setLyricsFilterMode}
      />
      <IdeaListNestedCollectionsSection
        childCollections={childCollections}
        expanded={nestedCollectionsExpanded}
        onToggleExpanded={() => setNestedCollectionsExpanded((prev) => !prev)}
        onOpenCollection={(nextCollectionId) =>
          navigateRoot("CollectionDetail", { collectionId: nextCollectionId })
        }
        onOpenCollectionActions={openCollectionActions}
      />
      <IdeaListSelectionZone
        listSelectionMode={listSelectionMode}
        selectedHiddenIdeaIds={selectedHiddenIdeaIds}
        selectedClipIdeasCount={selectedClipIdeasInList.length}
        selectedProjectsCount={selectedProjectsInList.length}
        selectableIdeaIds={selectableIdeaIds}
        selectedHiddenOnly={selectedHiddenOnly}
        selectedInteractiveIdeasCount={selectedInteractiveIdeas.length}
        onCreateProjectFromSelection={createProjectFromSelection}
        onPlaySelected={() => {
          void playSelectedIdeas();
        }}
        onToggleHideSelected={() => {
          void toggleHiddenSelection();
        }}
        onDeleteSelected={deleteSelectedIdeasWithUndo}
        onAddProject={() => {
          appActions.addIdea(collectionId);
          navigateRoot("IdeaDetail");
        }}
        onQuickRecord={() => {
          appActions.quickRecordIdea(collectionId);
          navigateRoot("Recording");
        }}
        onImportAudio={() => {
          void openImportAudioFlow();
        }}
        onFloatingDockLayout={(height) => {
          setFloatingDockHeight((prev) => (Math.abs(prev - height) < 1 ? prev : height));
        }}
        onSelectionDockLayout={(height) => {
          setSelectionDockHeight((prev) => (Math.abs(prev - height) < 1 ? prev : height));
        }}
      />

      <CollectionActionsModal
        visible={collectionActionsOpen}
        title={managedCollection?.title ?? "Collection"}
        onRename={openRenameCollection}
        onMove={openMoveCollection}
        onDelete={confirmDeleteCollection}
        onCancel={() => {
          setCollectionActionsOpen(false);
          setManagedCollectionId(null);
        }}
      />

      <QuickNameModal
        visible={collectionRenameModalOpen}
        title={managedCollection?.parentCollectionId ? "Rename subcollection" : "Rename collection"}
        draftValue={collectionDraft}
        placeholderValue={managedCollection?.title ?? "Collection"}
        onChangeDraft={setCollectionDraft}
        onCancel={() => {
          setCollectionRenameModalOpen(false);
          setCollectionDraft("");
        }}
        onSave={() => {
          if (!activeWorkspaceId || !managedCollection) return;
          const nextTitle = collectionDraft.trim();
          if (!nextTitle) return;
          updateCollection(activeWorkspaceId, managedCollection.id, { title: nextTitle });
          setCollectionRenameModalOpen(false);
          setCollectionDraft("");
          setManagedCollectionId(null);
        }}
        disableSaveWhenEmpty
      />

      <QuickNameModal
        visible={editModalOpen}
        title={editTargetIdea?.kind === "project" ? "Edit song" : "Edit clip"}
        draftValue={editClipDraft}
        placeholderValue={editTargetIdea?.title ?? "Title"}
        onChangeDraft={setEditClipDraft}
        onCancel={() => setEditModalOpen(false)}
        onSave={() => {
          const nextTitle = editClipDraft.trim();
          if (!nextTitle || !editClipId) return;
          updateIdeaTitle(editClipId, nextTitle);
          setEditModalOpen(false);
        }}
        disableSaveWhenEmpty
      />

      <QuickNameModal
        visible={importModalOpen}
        title={importMode === "song-project" ? "Import as Song Project" : "Import Audio"}
        draftValue={importDraft}
        placeholderValue={
          importMode === "song-project"
            ? buildImportedProjectTitle(importAssets)
            : importAssets[0]
              ? buildImportedTitle(importAssets[0].name)
              : ""
        }
        onChangeDraft={setImportDraft}
        onCancel={resetImportModal}
        onSave={() => {
          void saveImportedAudio();
        }}
        helperText={
          importMode === "song-project"
            ? `Destination: ${currentCollection.title} as one new song.\nFiles: ${importAssets.length} selected audio file${importAssets.length === 1 ? "" : "s"}`
            : `Destination: ${currentCollection.title} as a new clip card.\nFile: ${importAssets[0]?.name ?? "Selected audio"}`
        }
        saveLabel={isImporting ? "Importing..." : "Import"}
        saveDisabled={isImporting}
        cancelDisabled={isImporting}
      />

      <CollectionMoveModal
        visible={collectionMoveModalOpen}
        title={managedCollection?.parentCollectionId ? "Move Subcollection" : "Move Collection"}
        helperText={
          managedCollectionHasChildren
            ? "Collections that already contain subcollections can only be moved to the top level."
            : "Choose the destination for this collection."
        }
        destinations={moveDestinations}
        selectedWorkspaceId={selectedMoveWorkspaceId}
        selectedParentCollectionId={selectedMoveParentCollectionId}
        onSelectDestination={(workspaceId, parentCollectionId) => {
          setSelectedMoveWorkspaceId(workspaceId);
          setSelectedMoveParentCollectionId(parentCollectionId);
        }}
        onCancel={() => {
          setCollectionMoveModalOpen(false);
          setSelectedMoveWorkspaceId(null);
          setSelectedMoveParentCollectionId(null);
          setManagedCollectionId(null);
        }}
        onConfirm={submitCollectionMove}
      />



      <IdeaListContent
        listRef={listRef}
        onScroll={handleListScroll}
        scrollEventThrottle={listScrollThrottle}
        listSelectionMode={listSelectionMode}
        allowReorder={!listSelectionMode && ideasFilter === "all" && !searchNeedle}
        listEntries={listEntries}
        listDensity={listDensity}
        showDateDividers={showDateDividers}
        listFooterSpacerHeight={listFooterSpacerHeight}
        searchNeedle={searchNeedle}
        ideasSort={ideasSort}
        activeTimelineMetric={activeTimelineMetric}
        activeSortMetric={activeSortMetric}
        hoveredIdeaId={hoveredIdeaId}
        dropIntent={dropIntent}
        ideaSizeMap={ideaSizeMap}
        lyricsFilterMode={lyricsFilterMode}
        inlinePlayer={inlinePlayer}
        rowLayoutsRef={rowLayoutsRef}
        highlightMapRef={highlightMapRef}
        viewabilityConfig={viewabilityConfigRef.current}
        searchMetaByIdeaId={searchMetaByIdeaId}
        onViewableItemsChanged={onViewableItemsChanged}
        playIdeaFromList={playIdeaFromList}
        openIdeaFromList={openIdeaFromList}
        onLongPressActions={openIdeaActions}
        unhideIdeasFromList={unhideIdeasFromList}
        hideTimelineDay={hideTimelineDay}
        unhideTimelineDay={unhideTimelineDay}
        setHoveredIdeaId={setHoveredIdeaId}
        onReorderIdeas={onReorderIdeas}
      />

      {undoState ? (
        <View style={[styles.ideasUndoWrap, { bottom: floatingStripBottom }]}>
          <View style={styles.ideasUndoCard}>
            <Text style={styles.ideasUndoText} numberOfLines={1}>
              {undoState.message}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.ideasUndoBtn, pressed ? styles.pressDown : null]}
              onPress={() => {
                if (undoTimerRef.current) {
                  clearTimeout(undoTimerRef.current);
                  undoTimerRef.current = null;
                }
                undoState.undo();
                setUndoState(null);
              }}
            >
              <Text style={styles.ideasUndoBtnText}>Undo</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {headerMenuOpen ? (
        <View style={styles.ideasHeaderMenuLayer} pointerEvents="box-none">
          <Pressable
            style={styles.ideasHeaderMenuBackdrop}
            onPress={() => setHeaderMenuOpen(false)}
          />
          <View style={[styles.ideasSortMenu, styles.ideasHeaderOverflowMenu]}>
            <Pressable
              style={({ pressed }) => [
                styles.ideasToggleRow,
                buildPlayableQueue(playableIdeas).length === 0 ? styles.btnDisabled : null,
                pressed ? styles.pressDown : null,
              ]}
              onPress={() => {
                setHeaderMenuOpen(false);
                void playAllIdeas();
              }}
              disabled={buildPlayableQueue(playableIdeas).length === 0}
            >
              <Text style={styles.ideasSortMenuItemText}>Play all</Text>
              <Ionicons name="play" size={15} color="#334155" />
            </Pressable>
            <View style={styles.ideasDropdownDivider} />
            <Pressable
              style={({ pressed }) => [styles.ideasToggleRow, pressed ? styles.pressDown : null]}
              onPress={() => {
                setListDensity((prev) => (prev === "compact" ? "comfortable" : "compact"));
                setHeaderMenuOpen(false);
              }}
            >
              <Text style={styles.ideasSortMenuItemText}>Compact view</Text>
              <View
                style={[
                  styles.ideasSwitch,
                  listDensity === "compact" ? styles.ideasSwitchActive : null,
                ]}
              >
                <View
                  style={[
                    styles.ideasSwitchThumb,
                    listDensity === "compact" ? styles.ideasSwitchThumbActive : null,
                  ]}
                />
              </View>
            </Pressable>
            {hiddenItemsCount > 0 ? (
              <>
                <View style={styles.ideasDropdownDivider} />
                <Pressable
                  style={({ pressed }) => [styles.ideasToggleRow, pressed ? styles.pressDown : null]}
                  onPress={unhideAllInCurrentView}
                >
                  <Text style={styles.ideasSortMenuItemText}>{`Unhide all (${hiddenItemsCount})`}</Text>
                  <Ionicons name="eye-outline" size={15} color="#334155" />
                </Pressable>
              </>
            ) : null}
            <View style={styles.ideasDropdownDivider} />
            <Pressable
              style={({ pressed }) => [styles.ideasToggleRow, pressed ? styles.pressDown : null]}
              onPress={() => {
                setHeaderMenuOpen(false);
                navigateRoot("Activity", {
                  workspaceId: activeWorkspace?.id,
                  collectionId: currentCollection?.id,
                });
              }}
            >
              <Text style={styles.ideasSortMenuItemText}>View activity</Text>
              <Ionicons name="grid-outline" size={15} color="#334155" />
            </Pressable>
          </View>
        </View>
      ) : null}

      <IdeaActionsSheet
        visible={!!actionSheetIdea}
        idea={actionSheetIdea}
        hidden={actionSheetIdea ? hiddenIdeaIdsSet.has(actionSheetIdea.id) : false}
        onEdit={(idea) => quickEditIdea(idea)}
        onHide={(idea) => hideIdeasFromList([idea.id])}
        onUnhide={(idea) => unhideIdeasFromList([idea.id])}
        onShare={(idea) => quickShareIdea(idea)}
        onCopy={(idea) => quickClipboardIdea(idea, "copy")}
        onMove={(idea) => quickClipboardIdea(idea, "move")}
        onSelect={(idea) => useStore.getState().startListSelection(idea.id)}
        onDelete={(idea) => quickDeleteIdea(idea)}
        onCancel={closeIdeaActions}
      />

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}
  const dayStartTs = (ts: number) => {
    const date = new Date(ts);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  };

  const getDateDividerLabel = (ts: number) => {
    const todayStart = dayStartTs(Date.now());
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
    const targetStart = dayStartTs(ts);

    if (targetStart === todayStart) {
      return "Today";
    }

    if (targetStart === yesterdayStart) {
      return "Yesterday";
    }

    return new Date(ts).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };
