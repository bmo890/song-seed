import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IdeaListContent } from "../components/IdeaListContent";
import { useCollectionScreen } from "../provider/CollectionScreenProvider";
import type { ClipVersion } from "../../../types";
import type { IdeaListEntry } from "../types";
import type { ReactNode } from "react";
import { getDateBucket } from "../../../domain/dateBuckets";
import { getIdeaSortTimestamp } from "../../../domain/ideaSort";
import { useStore } from "../../../state/useStore";
import { stickyDayStore } from "../stickyDayStore";
import { createListGeometry } from "../listGeometry";
import { StyleSheet } from "react-native";
import { styles } from "../../../styles";

/** Room left above a card scrolled into view: the sticky day chip and a breath. */
const FOCUS_SCROLL_INSET = 112;

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

  // Exact row geometry for getItemLayout: rows report their measured heights,
  // the list re-lays its spacers when a measurement changes what follows it.
  const [geometry] = useState(() => createListGeometry());

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
      (entry) => entry.type === "idea" && entry.ideaId === screen.focusIdeaId
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
    if (screen.focusScrollTimerRef.current) {
      clearTimeout(screen.focusScrollTimerRef.current);
      screen.focusScrollTimerRef.current = null;
    }

    // Where the card sits in the LIST: its row's offset from the list geometry
    // (the same numbers getItemLayout hands the list), plus where the card sits
    // inside its row (a day divider can sit above it). The per-row onLayout y
    // alone is local to the row — scrolling to it went back to the top, and the
    // highlight played off screen (queue go-to, 2026-10-05).
    const focusIdeaId = screen.focusIdeaId!;
    const offsetOfFocus = () => {
      const index = screen.listEntries.findIndex((entry) => entry.type === "idea" && entry.ideaId === focusIdeaId);
      if (index < 0) return null;
      const inRow = screen.rowLayoutsRef.current[focusIdeaId]?.y ?? 0;
      return Math.max(0, geometry.offsetOf(index) + inRow - FOCUS_SCROLL_INSET);
    };
    const scrollToFocusedIdea = (attempt: number) => {
      const offset = offsetOfFocus();
      if (offset == null) return;
      screen.listRef.current?.scrollToOffset?.({ offset, animated: false });
      // Rows near the target measure themselves once mounted, which can move
      // it from the estimate; one settle pass lands it exactly.
      if (attempt >= 2) {
        // Flash only once the card has landed in view: the flash lasts about a
        // second, and starting it with the jump spent most of it off screen.
        screen.markRecentlyAdded([focusIdeaId]);
        return;
      }
      screen.focusScrollTimerRef.current = setTimeout(() => scrollToFocusedIdea(attempt + 1), 120);
    };

    scrollToFocusedIdea(0);
    (screen.navigation as any).setParams({ focusIdeaId: undefined, focusToken: undefined });
  }, [
    ideasFilter,
    ideasSort,
    screen.activeTimelineMetric,
    screen.collectionId,
    geometry,
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
    // The preview's state (and its lock-screen slot) clears synchronously; only the
    // native pause is not awaited — the card tap used to wait on it before the
    // player could even begin to open.
    await inlinePlayer.resetInlinePlayer({ awaitPause: false });
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

  // The floating day chip and the scrubber readout follow the first row that is
  // mostly on screen, reported by the list's viewability callback (RN's own cell
  // metrics). Labels are precomputed per entry so the callback does no date work:
  // the day label under date sorts, the first letter under title sorts, nothing
  // under length/progress sorts (the chip reads the day label regardless).
  const entryLabelsRef = useRef<Map<string, { label: string; scrub: string | null }>>(new Map());
  const scrubLabelsRef = useRef<(string | null)[]>([]);
  useEffect(() => {
    const metric = screen.activeSortMetric;
    const titleById = new Map<string, string>();
    if (metric === "title") {
      for (const idea of screen.ideas) titleById.set(idea.id, idea.title);
    }
    const next = new Map<string, { label: string; scrub: string | null }>();
    for (const entry of screen.listEntries) {
      const label = entry.type === "collapsedDay" ? entry.label : entry.dayLabel;
      let scrub: string | null = null;
      if (screen.showDateDividers) scrub = label;
      else if (metric === "title" && entry.type === "idea") {
        const first = (titleById.get(entry.ideaId) ?? "").trim().slice(0, 1);
        scrub = first ? first.toLocaleUpperCase() : null;
      }
      next.set(entry.key, { label, scrub });
    }
    entryLabelsRef.current = next;
    scrubLabelsRef.current = screen.listEntries.map((entry) => next.get(entry.key)?.scrub ?? null);
    screen.scrubRowLabels.value = scrubLabelsRef.current;
  }, [screen.listEntries, screen.ideas, screen.activeSortMetric, screen.showDateDividers, ideasSort, screen.scrubRowLabels]);

  const onFirstViewableEntry = useCallback((entry: IdeaListEntry | null) => {
    const labels = entry ? entryLabelsRef.current.get(entry.key) : undefined;
    if (labels) stickyDayStore.set(labels.label);
    stickyDayStore.setScrubLabel(labels?.scrub ?? null);
  }, []);

  // (Row geometry is declared at the top: the focus effect reads it.)
  const [layoutVersion, setLayoutVersion] = useState(0);
  const listGap = useMemo(
    () =>
      (StyleSheet.flatten([styles.listContent, screen.listDensity === "compact" ? styles.listContentCompact : null]) as { gap?: number })
        .gap ?? 0,
    [screen.listDensity]
  );
  const headerLengthRef = useRef(0);
  // Derived in render, never from an effect: the list reads getItemLayout in
  // the same render that hands it these entries.
  geometry.configure({
    entries: screen.listEntries,
    density: screen.listDensity,
    paddingTop: contentPaddingTop,
    headerLength: headerLengthRef.current,
    gap: listGap,
  });
  const getItemLayout = useCallback(
    (_data: ArrayLike<IdeaListEntry> | null | undefined, index: number) => geometry.getItemLayout(index),
    [geometry]
  );
  // The scrubber reads row tops on the UI thread; republish when anything moved.
  const scrubRowOffsets = screen.scrubRowOffsets;
  useEffect(() => {
    scrubRowOffsets.value = geometry.offsets().slice();
  }, [geometry, layoutVersion, screen.listEntries, contentPaddingTop, screen.listDensity, scrubRowOffsets]);
  const onRowHeight = useCallback(
    (entryKey: string, kind: string, height: number) => {
      if (geometry.report(entryKey, kind, height)) setLayoutVersion((v) => v + 1);
    },
    [geometry]
  );
  const onHeaderLength = useCallback(
    (length: number) => {
      headerLengthRef.current = Math.round(length);
      if (geometry.setHeaderLength(length)) setLayoutVersion((v) => v + 1);
    },
    [geometry]
  );

  // One model object per real change. A fresh literal here handed the FlatList new
  // props on every provider render — a full list pass (~90 ms at 325 ideas) for a
  // library write that changed nothing on screen (2026-09-24).
  const listModel = useMemo(
    () => ({
      listRef: screen.listRef,
      contentHeightValue: screen.listContentHeight,
      viewportHeightValue: screen.listViewportHeight,
      collapseScrollY: screen.scrollY,
      contentPaddingTop,
      listEntries: screen.listEntries,
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
      onFirstViewableEntry,
      getItemLayout,
      onRowHeight,
      onHeaderLength,
      layoutVersion,
      playIdeaFromList,
      openIdeaFromList,
      hideTimelineDay,
      expandTimelineDay,
    }),
    [
      screen.listRef,
      screen.listContentHeight,
      screen.listViewportHeight,
      screen.scrollY,
      contentPaddingTop,
      screen.listEntries,
      topContent,
      screen.listDensity,
      screen.showDateDividers,
      screen.listFooterSpacerHeight,
      screen.searchNeedle,
      ideasSort,
      screen.activeTimelineMetric,
      screen.activeSortMetric,
      screen.lyricsFilterMode,
      inlinePlayer,
      screen.rowLayoutsRef,
      screen.highlightMapRef,
      onFirstViewableEntry,
      getItemLayout,
      onRowHeight,
      onHeaderLength,
      layoutVersion,
      playIdeaFromList,
      openIdeaFromList,
      hideTimelineDay,
      expandTimelineDay,
    ]
  );

  return <IdeaListContent listModel={listModel} />;
}
