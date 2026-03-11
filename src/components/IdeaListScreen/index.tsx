import { useEffect, useMemo, useRef, useState } from "react";
import DraggableFlatList from "react-native-draggable-flatlist";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { Text, View, Alert, Animated, Pressable, TextInput, Platform } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { ClipboardBanner } from "../ClipboardBanner";
import { SongIdea, ClipVersion, PlaybackQueueItem, IdeasTimelineMetric, WorkspaceHiddenDay } from "../../types";
import { ScreenHeader } from "../common/ScreenHeader";
import { ActionButtons } from "./ActionButtons";
import { FilterSortBar } from "./FilterSortBar";
import { IdeaSelectionBar } from "./IdeaSelectionBar";
import { QuickNameModal } from "../modals/QuickNameModal";
import { CollectionMoveModal } from "../modals/CollectionMoveModal";
import { CollectionActionsModal } from "../modals/CollectionActionsModal";
import { IdeaListItem } from "./IdeaListItem";

import { useStore } from "../../state/useStore";
import { appActions } from "../../state/actions";
import { createEmptyProjectLyrics } from "../../state/dataSlice";
import { useInlinePlayer } from "../../hooks/useInlinePlayer";
import { buildImportedTitle, importAudioAsset, pickSingleAudioFile, shareAudioFile, type ImportedAudioAsset } from "../../services/audioStorage";
import {
  buildDefaultIdeaTitle,
  ensureUniqueIdeaTitle,
  formatBytes,
  fmtDuration,
  getCollectionAncestors,
  getCollectionById,
  getIdeaSizeBytes,
} from "../../utils";
import { buildCollectionMoveDestinations, getCollectionDeleteScope } from "../../collectionManagement";
import { getCollectionHierarchyLevel, getHierarchyIconColor, getHierarchyIconName } from "../../hierarchy";
import {
  compareIdeas,
  getIdeaCreatedAt,
  getIdeaSortState,
  getIdeaSortTimestamp,
  getIdeaUpdatedAt,
  usesIdeaTimelineDividers,
} from "../../ideaSort";

function buildDefaultSubcollectionTitle(count: number) {
  return `Subcollection ${count + 1}`;
}

type IdeaListEntry =
  | {
      key: string;
      type: "idea";
      idea: SongIdea;
      hidden: boolean;
      dayDividerLabel?: string | null;
      dayStartTs?: number | null;
    }
  | {
      key: string;
      type: "hidden-day";
      dayLabel: string;
      dayDividerLabel: string;
      dayStartTs: number;
      metric: IdeasTimelineMetric;
      hiddenCount: number;
    };

export function IdeaListScreen() {
  const navigation = useNavigation();
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
  const setIdeasHidden = useStore((s) => s.setIdeasHidden);
  const setTimelineDaysHidden = useStore((s) => s.setTimelineDaysHidden);
  const addCollection = useStore((s) => s.addCollection);
  const updateCollection = useStore((s) => s.updateCollection);
  const moveCollection = useStore((s) => s.moveCollection);
  const deleteCollection = useStore((s) => s.deleteCollection);

  const listSelectionMode = useStore((s) => s.listSelectionMode);
  const selectedListIdeaIds = useStore((s) => s.selectedListIdeaIds);
  const replaceListSelection = useStore((s) => s.replaceListSelection);

  const cancelClipboard = () => useStore.getState().setClipClipboard(null);

  const clipClipboard = useStore((s) => s.clipClipboard);
  const recentlyAddedItemIds = useStore((s) => s.recentlyAddedItemIds);
  const clearRecentlyAdded = useStore((s) => s.clearRecentlyAdded);

  const setSelectedIdeaId = useStore((s) => s.setSelectedIdeaId);

  const inlinePlayer = useInlinePlayer();
  const hiddenIdeaIds = currentCollection?.ideasListState.hiddenIdeaIds ?? [];
  const hiddenDays = currentCollection?.ideasListState.hiddenDays ?? [];

  const [hoveredIdeaId, setHoveredIdeaId] = useState<string | null>(null);
  const [dropIntent] = useState<"between" | "inside">("between");
  const rowLayoutsRef = useRef<Record<string, { y: number; height: number }>>({});
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editClipId, setEditClipId] = useState<string | null>(null);
  const [editClipDraft, setEditClipDraft] = useState("");
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importAsset, setImportAsset] = useState<ImportedAudioAsset | null>(null);
  const [importDraft, setImportDraft] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [managedCollectionId, setManagedCollectionId] = useState<string | null>(null);
  const [collectionActionsOpen, setCollectionActionsOpen] = useState(false);
  const [collectionRenameModalOpen, setCollectionRenameModalOpen] = useState(false);
  const [collectionDraft, setCollectionDraft] = useState("");
  const [collectionMoveModalOpen, setCollectionMoveModalOpen] = useState(false);
  const [selectedMoveWorkspaceId, setSelectedMoveWorkspaceId] = useState<string | null>(null);
  const [selectedMoveParentCollectionId, setSelectedMoveParentCollectionId] = useState<string | null>(null);
  const [subcollectionModalOpen, setSubcollectionModalOpen] = useState(false);
  const [subcollectionDraft, setSubcollectionDraft] = useState("");
  const [subcollectionsExpanded, setSubcollectionsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [selectedProjectStages, setSelectedProjectStages] = useState<Array<"seed" | "sprout" | "semi" | "song">>([]);
  const [lyricsFilterMode, setLyricsFilterMode] = useState<"all" | "with" | "without">("all");
  const [listDensity, setListDensity] = useState<"comfortable" | "compact">("comfortable");
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [ideaSizeMap, setIdeaSizeMap] = useState<Record<string, number>>({});
  const [stickyDayLabel, setStickyDayLabel] = useState<string | null>(null);
  const [stickyDayTop, setStickyDayTop] = useState<number>(0);
  const [visibleIdeaIds, setVisibleIdeaIds] = useState<string[]>([]);
  const [hasViewabilitySnapshot, setHasViewabilitySnapshot] = useState(false);
  const [undoState, setUndoState] = useState<{
    id: string;
    message: string;
    undo: () => void;
  } | null>(null);
  const highlightMapRef = useRef<Record<string, Animated.Value>>({});
  const animatingHighlightIdsRef = useRef<Set<string>>(new Set());
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const floatingBaseBottom = 12 + Math.max(insets.bottom, 16);
  const floatingStripBottom = floatingBaseBottom + 70;
  const bottomToolbarAllowance = Platform.OS === "android" ? 18 : 0;
  const listFooterSpacerHeight = listSelectionMode
    ? Math.max(140, floatingBaseBottom + 104 + bottomToolbarAllowance)
    : Math.max(220, floatingBaseBottom + 174 + bottomToolbarAllowance);
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

  const openSwipeIdRef = useRef<string | null>(null);
  const openSwipeCloseRef = useRef<(() => void) | null>(null);

  const handleSwipeWillOpen = (ideaId: string, close: () => void) => {
    if (openSwipeIdRef.current && openSwipeIdRef.current !== ideaId) {
      openSwipeCloseRef.current?.();
    }
    openSwipeIdRef.current = ideaId;
    openSwipeCloseRef.current = close;
  };

  const handleSwipeClose = (ideaId: string) => {
    if (openSwipeIdRef.current === ideaId) {
      openSwipeIdRef.current = null;
      openSwipeCloseRef.current = null;
    }
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

  const nowPlayingState = useMemo(() => {
    const target = inlinePlayer.inlineTarget;
    if (!target) return null;
    const idea = ideas.find((candidate) => candidate.id === target.ideaId);
    if (!idea) return null;
    const clip = idea.clips.find((candidate) => candidate.id === target.clipId);
    if (!clip) return null;
    return { idea, clip };
  }, [ideas, inlinePlayer.inlineTarget]);
  const nowPlayingDurationMs = nowPlayingState
    ? inlinePlayer.inlineDuration || nowPlayingState.clip.durationMs || 0
    : 0;
  const nowPlayingProgressPct = nowPlayingState
    ? Math.max(
        0,
        Math.min(
          100,
          ((nowPlayingDurationMs > 0 ? inlinePlayer.inlinePosition / nowPlayingDurationMs : 0) * 100)
        )
      )
    : 0;
  const nowPlayingIdeaVisible = nowPlayingState
    ? visibleIdeaIds.includes(nowPlayingState.idea.id)
    : false;
  const showStickyNowPlaying =
    hasViewabilitySnapshot && !listSelectionMode && !!nowPlayingState && !nowPlayingIdeaVisible;

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ item: IdeaListEntry }> }) => {
    setHasViewabilitySnapshot(true);
    const nextVisibleIds = (viewableItems ?? [])
      .map((entry) => (entry.item?.type === "idea" ? entry.item.idea.id : null))
      .filter((id): id is string => !!id);
    setVisibleIdeaIds((prev) => {
      if (prev.length === nextVisibleIds.length && prev.every((id, idx) => id === nextVisibleIds[idx])) {
        return prev;
      }
      return nextVisibleIds;
    });

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
    setImportAsset(null);
    setImportDraft("");
  }

  async function openImportAudioFlow() {
    if (!collectionId || !currentCollection) {
      Alert.alert("Choose a collection", "Open a collection before importing audio.");
      return;
    }

    const asset = await pickSingleAudioFile();
    if (!asset) return;

    setImportAsset(asset);
    setImportDraft("");
    setImportModalOpen(true);
  }

  async function saveImportedAudio() {
    if (!collectionId || !importAsset || isImporting) return;

    try {
      setIsImporting(true);
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

      setImportModalOpen(false);
      setImportAsset(null);
      setImportDraft("");
    } catch (error) {
      console.warn("Import audio error", error);
      Alert.alert("Import failed", "Could not import that audio file.");
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

  const canCreateSubcollection = !currentCollection?.parentCollectionId;
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
      <View style={styles.ideasPageHeader}>
        <View style={styles.ideasPageHeaderRow}>
          <Pressable
            style={({ pressed }) => [styles.hamburgerBtn, pressed ? styles.pressDown : null]}
            onPress={() => ((rootNavigation ?? (navigation as any)) as any).openDrawer?.()}
          >
            <Text style={styles.sideNavLabel}>☰</Text>
          </Pressable>

          <View style={styles.ideasPageHeaderTitleBlock}>
            <View style={styles.ideasPageHeaderBreadcrumbRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.ideasPageHeaderBreadcrumbItem,
                  pressed ? styles.pressDown : null,
                ]}
                onPress={() => navigateRoot("Home", { screen: "Workspaces" })}
              >
                <Ionicons
                  name={getHierarchyIconName("home")}
                  size={12}
                  color={getHierarchyIconColor("home")}
                />
              </Pressable>

              <Ionicons name="chevron-forward" size={12} color="#94a3b8" />

              <Pressable
                style={({ pressed }) => [
                  styles.ideasPageHeaderBreadcrumbItem,
                  pressed ? styles.pressDown : null,
                ]}
                onPress={goToBrowse}
              >
                <View style={styles.ideasPageHeaderBreadcrumbContent}>
                  <Ionicons
                    name={getHierarchyIconName("workspace")}
                    size={12}
                    color={getHierarchyIconColor("workspace")}
                  />
                  <Text style={styles.ideasPageHeaderBreadcrumbText} numberOfLines={1}>
                    {activeWorkspace.title}
                  </Text>
                </View>
              </Pressable>

              {collectionAncestors.map((collection) => (
                <View key={`crumb-${collection.id}`} style={styles.ideasPageHeaderBreadcrumbChunk}>
                  <Ionicons name="chevron-forward" size={12} color="#94a3b8" />
                  <Pressable
                    style={({ pressed }) => [
                      styles.ideasPageHeaderBreadcrumbItem,
                      pressed ? styles.pressDown : null,
                    ]}
                    onPress={() => navigateRoot("CollectionDetail", { collectionId: collection.id })}
                  >
                    <View style={styles.ideasPageHeaderBreadcrumbContent}>
                      <Ionicons
                        name={getHierarchyIconName(getCollectionHierarchyLevel(collection))}
                        size={12}
                        color={getHierarchyIconColor(getCollectionHierarchyLevel(collection))}
                      />
                      <Text style={styles.ideasPageHeaderBreadcrumbText} numberOfLines={1}>
                        {collection.title}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              ))}
            </View>

            <Text style={styles.title} numberOfLines={1}>
              {currentCollection.title}
            </Text>
          </View>

          {!listSelectionMode ? (
            <View style={styles.ideasHeaderActions}>
              <Pressable
                style={({ pressed }) => [styles.ideasHeaderMenuBtn, pressed ? styles.pressDown : null]}
                onPress={() => setHeaderMenuOpen((prev) => !prev)}
              >
                <Ionicons name="ellipsis-horizontal" size={16} color="#334155" />
              </Pressable>
            </View>
          ) : (
            <View style={styles.ideasHeaderMenuBtnPlaceholder} />
          )}
        </View>
      </View>

      <View style={styles.ideasSearchUtilityRow}>
        {childCollections.length > 0 ? (
          <View style={styles.subcollectionDisclosureInlineWrap}>
            <Pressable
              style={({ pressed }) => [
                styles.subcollectionDisclosureBtn,
                styles.subcollectionDisclosureBtnInline,
                subcollectionsExpanded ? styles.subcollectionDisclosureBtnOpen : null,
                pressed ? styles.pressDown : null,
              ]}
              onPress={() => setSubcollectionsExpanded((prev) => !prev)}
            >
              <View style={styles.subcollectionDisclosureLead}>
                <Ionicons
                  name={getHierarchyIconName("subcollection")}
                  size={14}
                  color={getHierarchyIconColor("subcollection")}
                />
                <Text style={styles.subcollectionDisclosureTitle}>
                  {childCollections.length} subcollection{childCollections.length === 1 ? "" : "s"}
                </Text>
              </View>
              <Ionicons
                name={subcollectionsExpanded ? "chevron-up" : "chevron-down"}
                size={14}
                color="#64748b"
              />
            </Pressable>

            {subcollectionsExpanded ? (
              <View style={styles.subcollectionDisclosureDropdown}>
                {childCollections.map((collection) => (
                  <View key={collection.id} style={styles.subcollectionDisclosureItem}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.subcollectionDisclosureItemLead,
                        styles.subcollectionDisclosureItemMain,
                        pressed ? styles.pressDown : null,
                      ]}
                      onPress={() => navigateRoot("CollectionDetail", { collectionId: collection.id })}
                    >
                      <Ionicons
                        name={getHierarchyIconName("subcollection")}
                        size={14}
                        color={getHierarchyIconColor("subcollection")}
                      />
                      <Text style={styles.subcollectionDisclosureItemText} numberOfLines={1}>
                        {collection.title}
                      </Text>
                    </Pressable>
                    <View style={styles.subcollectionDisclosureItemActions}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.collectionInlineActionBtn,
                          pressed ? styles.pressDown : null,
                        ]}
                        onPress={() => openCollectionActions(collection.id)}
                      >
                        <Ionicons name="ellipsis-horizontal" size={14} color="#64748b" />
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [
                          styles.subcollectionDisclosureChevronBtn,
                          pressed ? styles.pressDown : null,
                        ]}
                        onPress={() => navigateRoot("CollectionDetail", { collectionId: collection.id })}
                      >
                        <Ionicons name="chevron-forward" size={13} color="#94a3b8" />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <View
          style={[
            styles.ideasSearchWrap,
            childCollections.length > 0 ? styles.ideasSearchWrapInline : null,
          ]}
        >
          <Ionicons name="search" size={16} color="#64748b" />
          <TextInput
            style={styles.ideasSearchInput}
            placeholder="Search titles, notes, lyrics..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onFocus={() => {
              if (subcollectionsExpanded) {
                setSubcollectionsExpanded(false);
              }
            }}
            onChangeText={(value) => {
              if (subcollectionsExpanded) {
                setSubcollectionsExpanded(false);
              }
              setSearchQuery(value);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery ? (
            <Pressable
              style={({ pressed }) => [styles.ideasSearchClear, pressed ? styles.pressDown : null]}
              onPress={() => setSearchQuery("")}
            >
              <Ionicons name="close" size={14} color="#64748b" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {hasActivityRangeFilter ? (
        <View style={styles.activityRangeBanner}>
          <View style={styles.activityRangeBannerCopy}>
            <Ionicons name="calendar-outline" size={15} color="#475569" />
            <Text style={styles.activityRangeBannerText} numberOfLines={1}>
              {activityLabel ?? "Activity range"}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.activityRangeBannerClear, pressed ? styles.pressDown : null]}
            onPress={() => {
              (navigation as any).setParams({
                activityRangeStartTs: undefined,
                activityRangeEndTs: undefined,
                activityMetricFilter: undefined,
                activityLabel: undefined,
              });
            }}
          >
            <Ionicons name="close" size={14} color="#64748b" />
          </Pressable>
        </View>
      ) : null}

      {clipClipboard ? (
        <ClipboardBanner
          count={clipClipboard.clipIds.length}
          mode={clipClipboard.mode}
          actionLabel="Paste to collection"
          onAction={() => {
            if (clipClipboard.sourceCollectionId === collectionId) {
              if (clipClipboard.mode === "move") {
                Alert.alert("Cannot move here", "You cannot move items into the same collection they are already in. To duplicate them, cancel and use Copy instead.");
                return;
              } else {
                Alert.alert(
                  "Duplicate items?",
                  duplicateWarningText,
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Duplicate", onPress: () => appActions.pasteClipboardToCollection(collectionId) }
                  ]
                );
                return;
              }
            }
            Alert.alert(
              `${clipClipboard.mode === "move" ? "Move" : "Copy"} items here?`,
              `Are you sure you want to ${clipClipboard.mode} these items into this collection?`,
              [
                { text: "Cancel", style: "cancel" },
                { text: "Yes", style: "default", onPress: () => appActions.pasteClipboardToCollection(collectionId) }
              ]
            );
          }}
          onCancel={cancelClipboard}
        />
      ) : null}

      <View
        onLayout={(evt) => {
          const { y, height } = evt.nativeEvent.layout;
          const nextTop = y + height + 2;
          setStickyDayTop((prev) => (Math.abs(prev - nextTop) < 1 ? prev : nextTop));
        }}
      >
        <FilterSortBar
          selectedProjectStages={selectedProjectStages}
          onToggleProjectStage={(stage) => {
            setSelectedProjectStages((prev) =>
              prev.includes(stage) ? prev.filter((item) => item !== stage) : [...prev, stage]
            );
          }}
          onClearProjectStages={() => setSelectedProjectStages([])}
          lyricsFilterMode={lyricsFilterMode}
          onLyricsFilterModeChange={setLyricsFilterMode}
        />
      </View>

      {showDateDividers && stickyDayLabel ? (
        <View style={[styles.ideasStickyDayWrap, { top: stickyDayTop }]} pointerEvents="none">
          <View style={styles.ideasStickyDayChip}>
            <Text style={styles.ideasStickyDayChipText}>{stickyDayLabel}</Text>
          </View>
        </View>
      ) : null}
      {showStickyNowPlaying && nowPlayingState ? (
        <View style={styles.ideasNowPlayingDock}>
          <Pressable
            style={({ pressed }) => [styles.ideasNowPlayingCard, pressed ? styles.pressDown : null]}
            onPress={() => {
              useStore
                .getState()
                .setPlayerQueue(
                  [{ ideaId: nowPlayingState.idea.id, clipId: nowPlayingState.clip.id }],
                  0,
                  inlinePlayer.isInlinePlaying
                );
              navigateRoot("Player");
            }}
          >
            <View style={styles.ideasNowPlayingTopRow}>
              <View style={styles.ideasNowPlayingCopy}>
                <Text style={styles.ideasNowPlayingTitle} numberOfLines={1}>
                  {nowPlayingState.idea.title}
                </Text>
                <Text style={styles.ideasNowPlayingSubtitle} numberOfLines={1}>
                  {nowPlayingState.clip.title}
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.ideasNowPlayingBtn, pressed ? styles.pressDownStrong : null]}
                onPress={(evt) => {
                  evt.stopPropagation();
                  void inlinePlayer.toggleInlinePlayback(
                    nowPlayingState.idea.id,
                    nowPlayingState.clip
                  );
                }}
              >
                <Ionicons
                  name={inlinePlayer.isInlinePlaying ? "pause" : "play"}
                  size={16}
                  color="#0f172a"
                />
              </Pressable>
            </View>
            <View style={styles.ideasNowPlayingProgressRow}>
              <Text style={styles.ideasNowPlayingTimeText}>{fmtDuration(inlinePlayer.inlinePosition)}</Text>
              <View style={styles.ideasNowPlayingProgressTrack}>
                <View style={[styles.ideasNowPlayingProgressFill, { width: `${nowPlayingProgressPct}%` }]} />
              </View>
              <Text style={styles.ideasNowPlayingTimeText}>{fmtDuration(nowPlayingDurationMs)}</Text>
            </View>
          </Pressable>
        </View>
      ) : null}

      {listSelectionMode && selectedHiddenIdeaIds.length === 0 && selectedClipIdeasInList.length > 0 ? (
        <View style={styles.listRowWrap}>
          <Pressable
            style={({ pressed }) => [
              styles.cardFlex,
              styles.ideasGhostProjectRow,
              pressed ? styles.pressDown : null,
            ]}
            onPress={createProjectFromSelection}
          >
            <View style={styles.ideasListCardRow}>
              <View style={[styles.ideasInlinePlayBtn, styles.ideasGhostProjectIcon]}>
                <Ionicons name={getHierarchyIconName("song")} size={14} color="#166534" />
              </View>
              <View style={styles.ideasListCardMain}>
                <View style={styles.ideasListCardTop}>
                  <View style={styles.ideasListCardTitleRow}>
                    <Ionicons name={getHierarchyIconName("song")} size={14} color="#166534" />
                    <Text style={styles.ideasListCardTitle}>New Song</Text>
                  </View>
                  <Text style={[styles.badge, styles.badgeGhostProject]}>NEW</Text>
                </View>
                <Text style={styles.ideasListCardMeta}>
                  Create a song from {selectedClipIdeasInList.length} selected clip{selectedClipIdeasInList.length === 1 ? "" : "s"}.
                  {selectedProjectsInList.length > 0 ? " Selected songs will be unselected first." : ""}
                </Text>
              </View>
            </View>
          </Pressable>
        </View>
      ) : null}

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
        title="Import audio"
        draftValue={importDraft}
        placeholderValue={importAsset ? buildImportedTitle(importAsset.name) : ""}
        onChangeDraft={setImportDraft}
        onCancel={resetImportModal}
        onSave={() => {
          void saveImportedAudio();
        }}
        helperText={`Destination: ${currentCollection.title} as a new clip card.\nFile: ${importAsset?.name ?? "Selected audio"}`}
        saveLabel={isImporting ? "Importing..." : "Import"}
        saveDisabled={isImporting}
        cancelDisabled={isImporting}
      />

      <QuickNameModal
        visible={subcollectionModalOpen}
        title="New Subcollection"
        draftValue={subcollectionDraft}
        placeholderValue={buildDefaultSubcollectionTitle(childCollections.length)}
        onChangeDraft={setSubcollectionDraft}
        onCancel={() => {
          setSubcollectionModalOpen(false);
          setSubcollectionDraft("");
        }}
        onSave={() => {
          if (!activeWorkspaceId || !collectionId) return;
          const title = subcollectionDraft.trim() || buildDefaultSubcollectionTitle(childCollections.length);
          const nextCollectionId = addCollection(activeWorkspaceId, title, collectionId);
          setSubcollectionModalOpen(false);
          setSubcollectionDraft("");
          navigateRoot("CollectionDetail", { collectionId: nextCollectionId });
        }}
        helperText={`Subcollections help separate ideas inside ${currentCollection.title} without mixing them into the main list.`}
        saveLabel="Create"
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



      <DraggableFlatList<IdeaListEntry>
        data={listEntries}
        keyExtractor={(item) => item.key}
        contentContainerStyle={[
          styles.listContent,
          listDensity === "compact" ? styles.listContentCompact : null,
          showDateDividers ? styles.listContentTimeline : null,
          { paddingBottom: 12 },
        ]}
        ListFooterComponent={<View style={{ height: listFooterSpacerHeight }} />}
        ListEmptyComponent={
          listEntries.length === 0 ? (
            <Text style={styles.emptyText}>
              {searchNeedle
                ? "No matching songs or clips."
                : "No songs or clips yet. Add your first one."}
            </Text>
          ) : null
        }
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfigRef.current}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
        renderItem={(props) => {
          const entry = props.item;

          if (entry.type === "hidden-day") {
            return (
              <View style={styles.ideasListItemWrap}>
                <View style={styles.ideasDayDividerRow}>
                  <View style={styles.ideasDayDividerLine} />
                  <Text style={styles.ideasDayDividerText}>{entry.dayDividerLabel}</Text>
                  <View style={styles.ideasDayDividerLine} />
                </View>

                <View style={styles.listRowWrap}>
                  <View style={styles.ideasHiddenDayCard}>
                    <View style={styles.ideasHiddenDayCopy}>
                      <Text style={styles.ideasHiddenDayTitle}>
                        {`${entry.hiddenCount} item${entry.hiddenCount === 1 ? "" : "s"} hidden`}
                      </Text>
                    </View>
                    <Pressable
                      style={({ pressed }) => [styles.ideasHiddenUnhideBtn, pressed ? styles.pressDown : null]}
                      onPress={() => unhideTimelineDay(entry.metric, entry.dayStartTs)}
                    >
                      <Ionicons name="eye-outline" size={13} color="#334155" />
                      <Text style={styles.ideasHiddenUnhideBtnText}>Unhide</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          }

          const searchMeta = searchMetaByIdeaId.get(entry.idea.id) ?? {
            matches: true,
            title: false,
            notes: false,
            lyrics: false,
          };

          return (
            <IdeaListItem
              {...props}
              item={entry.idea}
              hoveredIdeaId={hoveredIdeaId}
              dropIntent={dropIntent}
              rowLayoutsRef={rowLayoutsRef}
              highlightMapRef={highlightMapRef}
              inlinePlayer={inlinePlayer}
              playIdeaFromList={playIdeaFromList}
              openIdeaFromList={openIdeaFromList}
              onSwipeEdit={quickEditIdea}
              onSwipeHide={(idea) => {
                void hideIdeasFromList([idea.id]);
              }}
              onSwipeShare={quickShareIdea}
              onSwipeCopy={(idea) => quickClipboardIdea(idea, "copy")}
              onSwipeMove={(idea) => quickClipboardIdea(idea, "move")}
              onSwipeDelete={quickDeleteIdea}
              onSwipeWillOpen={handleSwipeWillOpen}
              onSwipeClose={handleSwipeClose}
              onUnhide={(idea) => unhideIdeasFromList([idea.id])}
              onHideDay={
                !listSelectionMode && showDateDividers && activeTimelineMetric && entry.dayDividerLabel
                  ? () => {
                      void hideTimelineDay(
                        activeTimelineMetric,
                        entry.dayStartTs ?? dayStartTs(getIdeaSortTimestamp(entry.idea, ideasSort))
                      );
                    }
                  : undefined
              }
              hidden={entry.hidden}
              ideaSizeLabel={formatBytes(ideaSizeMap[entry.idea.id] ?? 0)}
              dayDividerLabel={entry.dayDividerLabel}
              searchNeedle={searchNeedle}
              notesMatched={!!searchMeta.notes}
              lyricsMatched={!!searchMeta.lyrics}
              listDensity={listDensity}
              sortMetric={activeSortMetric}
              lyricsFilterMode={lyricsFilterMode}
            />
          );
        }}
        onDragBegin={(index) => {
          if (listSelectionMode) return;
          const hoveredEntry = listEntries[index];
          if (hoveredEntry?.type === "idea") {
            setHoveredIdeaId(hoveredEntry.idea.id);
          }
        }}
        onPlaceholderIndexChange={(index) => {
          if (listSelectionMode) return;
          const hoveredEntry = listEntries[index];
          if (hoveredEntry?.type === "idea") {
            setHoveredIdeaId(hoveredEntry.idea.id);
          }
        }}
        onDragEnd={({ data, from, to }) => {
          if (!listSelectionMode && ideasFilter === "all" && !searchNeedle) {
            onReorderIdeas({
              items: data
                .filter((entry): entry is Extract<IdeaListEntry, { type: "idea" }> => entry.type === "idea")
                .map((entry) => entry.idea),
              from,
              to,
              sourceId: listEntries[from]?.type === "idea" ? listEntries[from].idea.id : undefined,
              targetId:
                hoveredIdeaId ??
                (listEntries[to]?.type === "idea" ? listEntries[to].idea.id : undefined),
              intent: "between",
            });
          }
          setHoveredIdeaId(null);
        }}
      />

      {listSelectionMode ? (
        <IdeaSelectionBar
          selectableIdeaIds={selectableIdeaIds}
          disabledIdeaIds={selectedHiddenIdeaIds}
          onPlaySelected={() => {
            void playSelectedIdeas();
          }}
          onToggleHideSelected={() => {
            void toggleHiddenSelection();
          }}
          hideActionLabel={selectedHiddenOnly ? "Unhide" : "Hide"}
          hideActionDisabled={selectedHiddenOnly ? selectedHiddenIdeaIds.length === 0 : selectedInteractiveIdeas.length === 0}
          onDeleteSelected={deleteSelectedIdeasWithUndo}
        />
      ) : (
        <>
          <ActionButtons
            onAddProject={() => {
              appActions.addIdea(collectionId);
              navigateRoot("IdeaDetail");
            }}
            onAddSubcollection={
              canCreateSubcollection
                ? () => {
                    setSubcollectionDraft("");
                    setSubcollectionModalOpen(true);
                  }
                : undefined
            }
            onQuickRecord={() => {
              appActions.quickRecordIdea(collectionId);
              navigateRoot("Recording");
            }}
            onImportAudio={() => {
              void openImportAudioFlow();
            }}
          />
        </>
      )}

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
