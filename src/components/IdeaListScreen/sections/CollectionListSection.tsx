import { useCallback, useEffect, useRef } from "react";
import { useAnimatedReaction, useSharedValue, runOnJS } from "react-native-reanimated";
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
    setTimelineDaysHidden,
  } = store;
  const ideasSortRef = useRef(ideasSort);
  // Focus-jump retry bookkeeping: how many effect runs a pending focus token has
  // waited for the model to re-derive the target collection's ideas.
  const focusAttemptsRef = useRef<{ token: number | null; count: number }>({ token: null, count: 0 });

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
      // The idea isn't in the CURRENTLY-derived collection. Right after a contextual
      // jump (queue "go to song") the params can land a beat before the model has
      // re-derived `ideas` for the new collection — consuming the token here killed
      // the jump on large libraries (the recompute takes longer, so the stale first
      // run always won). Leave the token pending; this effect re-runs as `ideas`
      // settles. A bounded attempt count covers the genuinely-missing case.
      const attempts = (focusAttemptsRef.current.token === screen.focusToken
        ? focusAttemptsRef.current.count
        : 0) + 1;
      focusAttemptsRef.current = { token: screen.focusToken, count: attempts };
      if (attempts >= 12) {
        screen.handledFocusTokenRef.current = screen.focusToken;
        (screen.navigation as any).setParams({ focusIdeaId: undefined, focusToken: undefined });
      }
      return;
    }

    const targetIndex = screen.listEntries.findIndex(
      (entry) => entry.type === "idea" && entry.idea.id === screen.focusIdeaId
    );

    if (targetIndex === -1) {
      // In the collection but not in the list: peel back whatever is concealing it —
      // filters, a one-off hide, or a collapsed day — then let the re-run scroll.
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
      if (!changed && screen.collectionId) {
        const focusIdea = screen.ideas.find((idea) => idea.id === screen.focusIdeaId);
        if (focusIdea && screen.hiddenIdeaIdsSet.has(focusIdea.id)) {
          store.setIdeasHidden(screen.collectionId, [focusIdea.id], false);
          changed = true;
        } else if (focusIdea && screen.activeTimelineMetric) {
          const dayTs = getDateBucket(getIdeaSortTimestamp(focusIdea, ideasSort)).startTs;
          if (screen.hiddenDayKeySet.has(`${screen.activeTimelineMetric}:${dayTs}`)) {
            setTimelineDaysHidden(
              screen.collectionId,
              [{ metric: screen.activeTimelineMetric, dayStartTs: dayTs }],
              false
            );
            changed = true;
          }
        }
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
    ideasSort,
    screen.activeTimelineMetric,
    screen.collectionId,
    screen.focusIdeaId,
    screen.focusToken,
    screen.focusScrollTimerRef,
    screen.handledFocusTokenRef,
    screen.hiddenDayKeySet,
    screen.hiddenIdeaIdsSet,
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
    setTimelineDaysHidden,
    store,
  ]);

  // STABLE identities (values read through refs at call time): these flow into every
  // list row, and the rows are memoized — an identity change here re-renders every
  // mounted card on each screen render, which is exactly the per-tap lag this avoids.
  const collectionIdRef = useRef(screen.collectionId);
  collectionIdRef.current = screen.collectionId;
  const listIdeasRef = useRef(screen.listIdeas);
  listIdeasRef.current = screen.listIdeas;

  const openIdeaFromList = useCallback(async (ideaId: string, clip: ClipVersion) => {
    await inlinePlayer.resetInlinePlayer();
    useStore.getState().setPlayerQueueForScreen([{ ideaId, clipId: clip.id }], 0);
  }, [inlinePlayer]);

  const playIdeaFromList = useCallback(async (ideaId: string, clip: ClipVersion) => {
    await inlinePlayer.toggleInlinePlayback(ideaId, clip);
  }, [inlinePlayer]);

  const maybeResetInlineForIdeaIds = useCallback(async (ideaIds: string[]) => {
    const activeIdeaId = useStore.getState().inlineTarget?.ideaId;
    if (!activeIdeaId || !ideaIds.includes(activeIdeaId)) return;
    await inlinePlayer.resetInlinePlayer();
  }, [inlinePlayer]);

  // Expand a collapsed day group back into the list (atomic — the whole day).
  const expandTimelineDay = useCallback((metric: "created" | "updated", dayStartTs: number) => {
    if (!collectionIdRef.current) return;
    setTimelineDaysHidden(collectionIdRef.current, [{ metric, dayStartTs }], false);
  }, [setTimelineDaysHidden]);

  const hideTimelineDay = useCallback(async (metric: "created" | "updated", dayStartTs: number) => {
    if (!collectionIdRef.current) return;
    const ideaIdsInDay = listIdeasRef.current
      .filter((idea) => getDateBucket(getIdeaSortTimestamp(idea, ideasSortRef.current)).startTs === dayStartTs)
      .map((idea) => idea.id);
    await maybeResetInlineForIdeaIds(ideaIdsInDay);
    setTimelineDaysHidden(collectionIdRef.current, [{ metric, dayStartTs }], true);
  }, [maybeResetInlineForIdeaIds, setTimelineDaysHidden]);

  // Tracks the absolute content-y of each FlatList cell (keyed by entry.key).
  // Populated by the CellRendererComponent's onLayout, which fires with the cell's
  // y relative to the FlatList content container — i.e., the true scroll-content offset.
  const itemCellLayoutsRef = useRef<Record<string, number>>({});
  // Entry keys + PRECOMPUTED labels: the sticky-chip resolver runs during scrolling,
  // so it must not re-derive date buckets per entry per call — at 100+ entries that
  // per-frame work made list swipes visibly stutter.
  const stickyEntriesRef = useRef<{ key: string; label: string }[]>([]);
  useEffect(() => {
    stickyEntriesRef.current = screen.listEntries.map((entry) => ({
      key: entry.key,
      label:
        entry.type === "collapsedDay"
          ? entry.label
          : getDateBucketLabel(getIdeaSortTimestamp(entry.idea, ideasSortRef.current)),
    }));
  }, [screen.listEntries, ideasSort]);
  const contentPaddingTopRef = useRef(contentPaddingTop);
  useEffect(() => { contentPaddingTopRef.current = contentPaddingTop; }, [contentPaddingTop]);

  // Called from the Reanimated UI thread via runOnJS to update the sticky day chip.
  // effectiveTop is the content-coordinate of the visible-area boundary:
  //   effectiveTop = contentPaddingTop + max(0, scrollY - collapsibleHeaderHeight)
  // Labels are sourced by finding the last entry whose cell top <= effectiveTop.
  const updateStickyLabel = useCallback((scrollYVal: number, colHVal: number) => {
    const entries = stickyEntriesRef.current;
    const paddingTop = contentPaddingTopRef.current;
    const effectiveTop = paddingTop + Math.max(0, scrollYVal - colHVal);
    let foundLabel: string | null = null;
    for (const entry of entries) {
      const cellY = itemCellLayoutsRef.current[entry.key];
      if (cellY === undefined) continue;
      if (cellY > effectiveTop) break;
      foundLabel = entry.label;
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
  // Dispatch to JS at position granularity, not per frame: a 60Hz runOnJS stream
  // during swipes competed with touch handling on large lists. The chip only needs
  // to know when the top row has moved meaningfully.
  const lastStickyDispatchY = useSharedValue(-10000);
  useAnimatedReaction(
    () => scrollYValue.value,
    (scrollYVal) => {
      if (Math.abs(scrollYVal - lastStickyDispatchY.value) < 16) return;
      lastStickyDispatchY.value = scrollYVal;
      runOnJS(updateStickyLabel)(scrollYVal, collapsibleHeaderHeight.value);
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
        hideTimelineDay,
        expandTimelineDay,
      }}
    />
  );
}
