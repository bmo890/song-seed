import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { IdeaListContent } from "../components/IdeaListContent";
import { useCollectionScreen } from "../provider/CollectionScreenProvider";
import type { ClipVersion, SongIdea } from "../../../types";
import type { IdeaListEntry } from "../types";
import { getDateBucket, getDateBucketLabel } from "../../../dateBuckets";
import { getIdeaSortTimestamp } from "../../../ideaSort";
import { getIdeaSizeBytes } from "../../../utils";
import { useStore } from "../../../state/useStore";

export function CollectionListSection() {
  const { screen, inlinePlayer, store } = useCollectionScreen();
  const ideasSortRef = useRef(store.ideasSort);

  useEffect(() => {
    ideasSortRef.current = store.ideasSort;
  }, [store.ideasSort]);

  useEffect(() => {
    if (screen.isFocused) return;
    void inlinePlayer.resetInlinePlayer();
    useStore.getState().cancelListSelection();
  }, [inlinePlayer, screen.isFocused]);

  useEffect(() => {
    if (!screen.focusIdeaId || !screen.focusToken || screen.handledFocusTokenRef.current === screen.focusToken) return;
    if (!screen.ideas.some((idea) => idea.id === screen.focusIdeaId)) {
      screen.handledFocusTokenRef.current = screen.focusToken;
      (screen.navigation as any).setParams({ focusIdeaId: undefined, focusToken: undefined });
      return;
    }

    const targetIndex = screen.listEntries.findIndex(
      (entry) => entry.type === "idea" && entry.idea.id === screen.focusIdeaId
    );

    if (targetIndex === -1) {
      let changed = false;
      if (screen.searchQuery.length > 0) {
        screen.setSearchQuery("");
        changed = true;
      }
      if (screen.selectedProjectStages.length > 0) {
        screen.setSelectedProjectStages([]);
        changed = true;
      }
      if (screen.lyricsFilterMode !== "all") {
        screen.setLyricsFilterMode("all");
        changed = true;
      }
      if (store.ideasFilter !== "all") {
        store.setIdeasFilter("all");
        changed = true;
      }
      if (!changed) {
        screen.handledFocusTokenRef.current = screen.focusToken;
        (screen.navigation as any).setParams({ focusIdeaId: undefined, focusToken: undefined });
      }
      return;
    }

    screen.handledFocusTokenRef.current = screen.focusToken;
    screen.markRecentlyAdded([screen.focusIdeaId]);
    if (screen.focusScrollTimerRef.current) {
      clearTimeout(screen.focusScrollTimerRef.current);
      screen.focusScrollTimerRef.current = null;
    }

    const scrollToFocusedIdea = (attempt: number) => {
      const layout = screen.rowLayoutsRef.current[screen.focusIdeaId!];
      if (layout) {
        screen.listRef.current?.scrollToOffset?.({
          offset: Math.max(0, layout.y - 112),
          animated: attempt > 0,
        });
        return;
      }

      if (attempt === 0) {
        screen.listRef.current?.scrollToIndex?.({
          index: targetIndex,
          animated: false,
          viewPosition: 0.35,
        });
      }

      if (attempt >= 3) return;

      screen.focusScrollTimerRef.current = setTimeout(() => {
        scrollToFocusedIdea(attempt + 1);
      }, 90);
    };

    scrollToFocusedIdea(0);
    (screen.navigation as any).setParams({ focusIdeaId: undefined, focusToken: undefined });
  }, [
    screen,
    store,
  ]);

  useEffect(() => {
    const visibleIds = new Set(screen.listIdeas.map((idea) => idea.id));
    const idsToAnimate = useStore
      .getState()
      .recentlyAddedItemIds.filter(
        (id) => visibleIds.has(id) && !screen.animatingHighlightIdsRef.current.has(id)
      );

    idsToAnimate.forEach((id) => {
      screen.animatingHighlightIdsRef.current.add(id);
      const animatedValue = new Animated.Value(0);
      screen.highlightMapRef.current[id] = animatedValue;

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
        delete screen.highlightMapRef.current[id];
        screen.animatingHighlightIdsRef.current.delete(id);
        useStore.getState().clearRecentlyAdded([id]);
      });
    });
  }, [screen.listIdeas, screen]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const entries = await Promise.all(
        screen.listIdeas.map(async (idea) => {
          const bytes = await getIdeaSizeBytes(idea);
          return [idea.id, bytes] as const;
        })
      );

      if (cancelled) return;

      screen.setIdeaSizeMap((prev) => {
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
  }, [screen.listIdeas, screen]);

  const openIdeaFromList = async (ideaId: string, clip: ClipVersion) => {
    await inlinePlayer.resetInlinePlayer();
    useStore.getState().setPlayerQueue([{ ideaId, clipId: clip.id }], 0);
    screen.navigateRoot("Player");
  };

  const playIdeaFromList = async (ideaId: string, clip: ClipVersion) => {
    await inlinePlayer.toggleInlinePlayback(ideaId, clip);
  };

  const maybeResetInlineForIdeaIds = async (ideaIds: string[]) => {
    const activeIdeaId = inlinePlayer.inlineTarget?.ideaId;
    if (!activeIdeaId || !ideaIds.includes(activeIdeaId)) return;
    await inlinePlayer.resetInlinePlayer();
  };

  const unhideIdeasFromList = (ideaIds: string[]) => {
    if (!screen.collectionId) return;
    const nextIdeaIds = Array.from(new Set(ideaIds));
    if (nextIdeaIds.length === 0) return;
    store.setIdeasHidden(screen.collectionId, nextIdeaIds, false);
  };

  const hideTimelineDay = async (metric: "created" | "updated", dayStartTs: number) => {
    if (!screen.collectionId) return;
    const ideaIdsInDay = screen.listIdeas
      .filter((idea) => getDateBucket(getIdeaSortTimestamp(idea, store.ideasSort)).startTs === dayStartTs)
      .map((idea) => idea.id);
    await maybeResetInlineForIdeaIds(ideaIdsInDay);
    store.setTimelineDaysHidden(screen.collectionId, [{ metric, dayStartTs }], true);
  };

  const unhideTimelineDay = (metric: "created" | "updated", dayStartTs: number) => {
    if (!screen.collectionId) return;
    store.setTimelineDaysHidden(screen.collectionId, [{ metric, dayStartTs }], false);
  };

  const onViewableItemsChanged = ({
    viewableItems,
  }: {
    viewableItems: Array<{ item: IdeaListEntry }>;
  }) => {
    const first = viewableItems?.[0]?.item;
    if (!first) return;
    if (first.type === "hidden-day") {
      screen.setStickyDayLabel(first.dayLabel);
      return;
    }
    const ts = getIdeaSortTimestamp(first.idea, ideasSortRef.current);
    screen.setStickyDayLabel(getDateBucketLabel(ts));
  };

  const onReorderIdeas = (opts: {
    items: SongIdea[];
    from: number;
    to: number;
    sourceId?: string;
    targetId?: string;
    intent: "between";
  }) => {
    if (!screen.collectionId) return;
    useStore.getState().updateIdeas((prev) => {
      const map = new Map(prev.map((idea) => [idea.id, idea]));
      const reorderedIdeas = opts.items.map((idea) => map.get(idea.id)!).filter(Boolean);
      let reorderIndex = 0;
      return prev.map((idea) => {
        if (idea.collectionId !== screen.collectionId) return idea;
        const nextIdea = reorderedIdeas[reorderIndex];
        reorderIndex += 1;
        return nextIdea ?? idea;
      });
    });
  };

  return (
    <IdeaListContent
      listModel={{
        listRef: screen.listRef,
        onScroll: screen.handleListScroll,
        scrollEventThrottle: screen.listScrollThrottle,
        listSelectionMode: screen.listSelectionMode,
        allowReorder: !screen.listSelectionMode && store.ideasFilter === "all" && !screen.searchNeedle,
        listEntries: screen.listEntries,
        listDensity: screen.listDensity,
        showDateDividers: screen.showDateDividers,
        listFooterSpacerHeight: screen.listFooterSpacerHeight,
        searchNeedle: screen.searchNeedle,
        ideasSort: store.ideasSort,
        activeTimelineMetric: screen.activeTimelineMetric,
        activeSortMetric: screen.activeSortMetric,
        hoveredIdeaId: screen.hoverState.hoveredIdeaId,
        dropIntent: screen.hoverState.dropIntent,
        ideaSizeMap: screen.ideaSizeMap,
        lyricsFilterMode: screen.lyricsFilterMode,
        inlinePlayer,
        rowLayoutsRef: screen.rowLayoutsRef,
        highlightMapRef: screen.highlightMapRef,
        viewabilityConfig: screen.viewabilityConfigRef.current,
        searchMetaByIdeaId: screen.searchMetaByIdeaId,
        onViewableItemsChanged,
        playIdeaFromList,
        openIdeaFromList,
        unhideIdeasFromList,
        hideTimelineDay,
        unhideTimelineDay,
        setHoveredIdeaId: screen.hoverState.setHoveredIdeaId,
        onReorderIdeas,
      }}
    />
  );
}
