import { useCallback, useEffect, useRef } from "react";
import { useAnimatedReaction, runOnJS } from "react-native-reanimated";
import { IdeaListContent } from "../components/IdeaListContent";
import { useCollectionScreen } from "../provider/CollectionScreenProvider";
import type { ClipVersion } from "../../../types";
import type { IdeaListEntry } from "../types";
import type { ReactNode } from "react";
import { getDateBucket, getDateBucketLabel } from "../../../dateBuckets";
import { getIdeaSortTimestamp } from "../../../ideaSort";
import { useStore } from "../../../state/useStore";
import { stickyDayStore } from "../stickyDayStore";

export function CollectionListSection({
  contentPaddingTop,
  topContent,
}: {
  contentPaddingTop: number;
  topContent?: ReactNode;
}) {
  const { screen, inlinePlayer, store } = useCollectionScreen();
  const {
    ideasFilter,
    ideasSort,
    setIdeasFilter,
    setIdeasHidden,
    setTimelineDaysHidden,
  } = store;
  const ideasSortRef = useRef(ideasSort);

  useEffect(() => {
    ideasSortRef.current = ideasSort;
  }, [ideasSort]);

  useEffect(() => {
    if (screen.isFocused) return;
    void inlinePlayer.resetInlinePlayer();
    useStore.getState().cancelListSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen.isFocused]);

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
      if (ideasFilter !== "all") {
        setIdeasFilter("all");
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
    ideasFilter,
    screen.focusIdeaId,
    screen.focusToken,
    screen.focusScrollTimerRef,
    screen.handledFocusTokenRef,
    screen.ideas,
    screen.listEntries,
    screen.listRef,
    screen.lyricsFilterMode,
    screen.markRecentlyAdded,
    screen.navigation,
    screen.rowLayoutsRef,
    screen.searchQuery,
    screen.selectedProjectStages,
    screen.setLyricsFilterMode,
    screen.setSearchQuery,
    screen.setSelectedProjectStages,
    setIdeasFilter,
  ]);

  const openIdeaFromList = async (ideaId: string, clip: ClipVersion) => {
    await inlinePlayer.resetInlinePlayer();
    useStore.getState().setPlayerQueue([{ ideaId, clipId: clip.id }], 0);
    screen.navigateRoot("Player");
  };

  const playIdeaFromList = async (ideaId: string, clip: ClipVersion) => {
    await inlinePlayer.toggleInlinePlayback(ideaId, clip);
  };

  const maybeResetInlineForIdeaIds = async (ideaIds: string[]) => {
    const activeIdeaId = useStore.getState().inlineTarget?.ideaId;
    if (!activeIdeaId || !ideaIds.includes(activeIdeaId)) return;
    await inlinePlayer.resetInlinePlayer();
  };

  const unhideIdeasFromList = (ideaIds: string[]) => {
    if (!screen.collectionId) return;
    const nextIdeaIds = Array.from(new Set(ideaIds));
    if (nextIdeaIds.length === 0) return;
    setIdeasHidden(screen.collectionId, nextIdeaIds, false);
  };

  const hideTimelineDay = async (metric: "created" | "updated", dayStartTs: number) => {
    if (!screen.collectionId) return;
    const ideaIdsInDay = screen.listIdeas
      .filter((idea) => getDateBucket(getIdeaSortTimestamp(idea, ideasSort)).startTs === dayStartTs)
      .map((idea) => idea.id);
    await maybeResetInlineForIdeaIds(ideaIdsInDay);
    setTimelineDaysHidden(screen.collectionId, [{ metric, dayStartTs }], true);
  };

  const unhideTimelineDay = (metric: "created" | "updated", dayStartTs: number) => {
    if (!screen.collectionId) return;
    setTimelineDaysHidden(screen.collectionId, [{ metric, dayStartTs }], false);
  };

  // Tracks the absolute content-y of each FlatList cell (keyed by entry.key).
  // Populated by the CellRendererComponent's onLayout, which fires with the cell's
  // y relative to the FlatList content container — i.e., the true scroll-content offset.
  const itemCellLayoutsRef = useRef<Record<string, number>>({});
  const listEntriesRef = useRef(screen.listEntries);
  useEffect(() => { listEntriesRef.current = screen.listEntries; }, [screen.listEntries]);
  const contentPaddingTopRef = useRef(contentPaddingTop);
  useEffect(() => { contentPaddingTopRef.current = contentPaddingTop; }, [contentPaddingTop]);

  // Called from the Reanimated UI thread via runOnJS to update the sticky day chip.
  // effectiveTop is the content-coordinate of the visible-area boundary:
  //   effectiveTop = contentPaddingTop + max(0, scrollY - collapsibleHeaderHeight)
  // Labels are sourced by finding the last entry whose cell top <= effectiveTop.
  const updateStickyLabel = useCallback((scrollYVal: number, colHVal: number) => {
    const entries = listEntriesRef.current;
    const paddingTop = contentPaddingTopRef.current;
    const effectiveTop = paddingTop + Math.max(0, scrollYVal - colHVal);
    let foundLabel: string | null = null;
    for (const entry of entries) {
      const cellY = itemCellLayoutsRef.current[entry.key];
      if (cellY === undefined) continue;
      if (cellY > effectiveTop) break;
      foundLabel =
        entry.type === "hidden-day"
          ? entry.dayLabel
          : getDateBucketLabel(getIdeaSortTimestamp(entry.idea, ideasSortRef.current));
    }
    if (foundLabel !== null) stickyDayStore.set(foundLabel);
  }, []);

  // Capture the SharedValues as locals so the worklet closure only serializes those
  // (SharedValues are made to be shared). Referencing `screen.*` here would pull the whole
  // `screen` context into the worklet, and Reanimated deep-freezes captured plain objects —
  // freezing screen.rowLayoutsRef.current and crashing later onLayout writes on Hermes
  // ("cannot add a new property"). See CollectionHeaderSection's "Locals only" note.
  const scrollYValue = screen.scrollY;
  const collapsibleHeaderHeight = screen.collapsibleHeaderHeight;
  useAnimatedReaction(
    () => scrollYValue.value,
    (scrollYVal, prev) => {
      if (scrollYVal !== prev) {
        runOnJS(updateStickyLabel)(scrollYVal, collapsibleHeaderHeight.value);
      }
    }
  );

  const onItemCellLayout = useCallback((key: string, y: number) => {
    itemCellLayoutsRef.current[key] = y;
  }, []);

  // No-op — sticky label is now driven by the scroll reaction above.
  const onViewableItemsChanged = useCallback(() => {}, []);

  return (
    <IdeaListContent
      listModel={{
        listRef: screen.listRef,
        collapseScrollY: screen.scrollY,
        contentPaddingTop,
        listEntries: screen.listEntries,
        itemMetaByIdeaId: screen.itemMetaByIdeaId,
        topContent,
        listDensity: screen.listDensity,
        showDateDividers: screen.showDateDividers,
        listFooterSpacerHeight: screen.listFooterSpacerHeight,
        searchNeedle: screen.searchNeedle,
        ideasSort,
        activeTimelineMetric: screen.activeTimelineMetric,
        activeSortMetric: screen.activeSortMetric,
        lyricsFilterMode: screen.lyricsFilterMode,
        inlinePlayer,
        rowLayoutsRef: screen.rowLayoutsRef,
        highlightMapRef: screen.highlightMapRef,
        viewabilityConfig: screen.viewabilityConfigRef.current,
        searchMetaByIdeaId: screen.searchMetaByIdeaId,
        onViewableItemsChanged,
        onItemCellLayout,
        playIdeaFromList,
        openIdeaFromList,
        unhideIdeasFromList,
        hideTimelineDay,
        unhideTimelineDay,
      }}
    />
  );
}
