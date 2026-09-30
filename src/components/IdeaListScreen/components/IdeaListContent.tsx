import { MutableRefObject, ReactNode, memo, useCallback, useEffect, useMemo, useRef } from "react";
import { beginUiActivity, endUiActivity } from "../../../services/interactionGate";
import { Animated, FlatList, Pressable, Text, View, type ViewToken } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ReAnimated, { useAnimatedScrollHandler, type SharedValue } from "react-native-reanimated";
import { styles } from "../../../styles";
import { IdeaSort, InlinePlayerControls } from "../../../types";
import { IdeaListItem, CollapsedDayRow } from "./IdeaListItem";
import { CollectionListModel, IdeaListEntry } from "../types";
import { getIdeaSortTimestamp, type IdeaSortMetric } from "../../../domain/ideaSort";
import { getDateBucket } from "../../../domain/dateBuckets";
import { EmptyState } from "../../common/EmptyState";
import { useTranslation } from "react-i18next";

const onListActivityBegin = () => beginUiActivity("list-scroll");
const onListActivityEnd = () => endUiActivity("list-scroll");

const AnimatedFlatList = ReAnimated.FlatList as unknown as typeof FlatList;

// The floating day chip and the scrubber's readout follow the first row that is
// at least half on screen. A module constant: FlatList throws if this changes.
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 50, waitForInteraction: false } as const;

type IdeaListContentProps = {
  listRef?: MutableRefObject<any>;
  listEntries: IdeaListEntry[];
  topContent?: ReactNode;
  listDensity: "comfortable" | "compact";
  showDateDividers: boolean;
  listFooterSpacerHeight: number;
  searchNeedle: string;
  ideasSort: IdeaSort;
  activeTimelineMetric: "created" | "updated" | null;
  activeSortMetric: IdeaSortMetric;
  lyricsFilterMode: "all" | "with" | "without";
  inlinePlayer: InlinePlayerControls;
  rowLayoutsRef: MutableRefObject<Record<string, { y: number; height: number }>>;
  highlightMapRef: MutableRefObject<Record<string, Animated.Value>>;
  /** The first mostly-visible row changed (drives the day chip and the scrubber readout). */
  onFirstViewableEntry?: (entry: IdeaListEntry | null) => void;
  /** Exact row geometry (listGeometry): the list is full-length from the first frame. */
  getItemLayout?: (data: ArrayLike<IdeaListEntry> | null | undefined, index: number) => { length: number; offset: number; index: number };
  onRowHeight?: (entryKey: string, kind: string, height: number) => void;
  onHeaderLength?: (length: number) => void;
  /** Bumps when measured geometry changes, so the list re-lays its spacers. */
  layoutVersion?: number;
  playIdeaFromList: (ideaId: string, clip: any) => Promise<void> | void;
  openIdeaFromList: (ideaId: string, clip: any) => Promise<void> | void;
  hideTimelineDay: (metric: "created" | "updated", dayStartTs: number) => Promise<void>;
  expandTimelineDay: (metric: "created" | "updated", dayStartTs: number) => void;
  /** UI-thread scroll offset mirrored from the list — drives the collapsing header. */
  collapseScrollY?: SharedValue<number>;
  /** Top inset reserving space for the absolute collapsing header overlay. */
  contentPaddingTop?: number;
  /** Content and viewport heights, written from the list for the scrubber's track. */
  contentHeightValue?: SharedValue<number>;
  viewportHeightValue?: SharedValue<number>;
};


function IdeaListContentInner(
  props: IdeaListContentProps | { listModel: CollectionListModel }
) {
  const { t } = useTranslation();
  const {
    listRef,
    listEntries,
    topContent,
    listDensity,
    showDateDividers,
    listFooterSpacerHeight,
    searchNeedle,
    ideasSort,
    activeTimelineMetric,
    activeSortMetric,
    lyricsFilterMode,
    inlinePlayer,
    rowLayoutsRef,
    highlightMapRef,
    playIdeaFromList,
    openIdeaFromList,
    hideTimelineDay,
    expandTimelineDay,
    collapseScrollY,
    contentPaddingTop,
    onFirstViewableEntry,
    getItemLayout,
    onRowHeight,
    onHeaderLength,
    layoutVersion,
    contentHeightValue,
    viewportHeightValue,
  } = "listModel" in props ? props.listModel : props;
  const onListLayout = useCallback(
    (event: { nativeEvent: { layout: { height: number } } }) => {
      if (viewportHeightValue) viewportHeightValue.value = event.nativeEvent.layout.height;
    },
    [viewportHeightValue]
  );
  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      if (contentHeightValue) contentHeightValue.value = height;
    },
    [contentHeightValue]
  );
  const scrollRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Viewability is the one place RN reports which rows are on screen with its own
  // cell metrics. (A custom CellRendererComponent does not work here: Reanimated's
  // FlatList replaces it with its own, so a per-cell onLayout never fires.)
  const onFirstViewableEntryRef = useRef(onFirstViewableEntry);
  useEffect(() => { onFirstViewableEntryRef.current = onFirstViewableEntry; }, [onFirstViewableEntry]);
  const onViewableItemsChanged = useCallback((info: { viewableItems: ViewToken<IdeaListEntry>[] }) => {
    onFirstViewableEntryRef.current?.(info.viewableItems[0]?.item ?? null);
  }, []);
  useEffect(() => {
    return () => {
      if (scrollRetryTimerRef.current) {
        clearTimeout(scrollRetryTimerRef.current);
        scrollRetryTimerRef.current = null;
      }
    };
  }, []);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      if (collapseScrollY) {
        collapseScrollY.value = event.contentOffset.y;
      }
    },
  });

  const contentContainerStyle = useMemo(
    () => [
      styles.listContent,
      listDensity === "compact" ? styles.listContentCompact : null,
      showDateDividers ? styles.listContentTimeline : null,
      { paddingHorizontal: 14, paddingBottom: 12 },
      contentPaddingTop ? { paddingTop: contentPaddingTop } : null,
    ],
    [listDensity, showDateDividers, contentPaddingTop]
  );
  const listFooter = useMemo(() => <View style={{ height: listFooterSpacerHeight }} />, [listFooterSpacerHeight]);
  // The header cell's height feeds the geometry (it is a cell even when empty).
  const onHeaderLengthRef = useRef(onHeaderLength);
  useEffect(() => { onHeaderLengthRef.current = onHeaderLength; }, [onHeaderLength]);
  const listHeader = useMemo(
    () =>
      topContent ? (
        <View onLayout={(event) => onHeaderLengthRef.current?.(event.nativeEvent.layout.height)}>{topContent}</View>
      ) : null,
    [topContent]
  );
  // Stable per set of inputs, so a re-render for an unrelated reason does not make
  // VirtualizedList re-invoke it for every mounted cell.
  const renderItem = useCallback(
    (props: { item: IdeaListEntry }) => {
        const entry = props.item;

        if (entry.type === "collapsedDay") {
          return (
            <CollapsedDayRow
              entryKey={entry.key}
              onRowHeight={onRowHeight}
              label={entry.label}
              count={entry.count}
              compact={listDensity === "compact"}
              onExpand={
                activeTimelineMetric
                  ? () => expandTimelineDay(activeTimelineMetric, entry.dayStartTs)
                  : undefined
              }
            />
          );
        }

        return (
          <IdeaListItem
            ideaId={entry.ideaId}
            rowLayoutsRef={rowLayoutsRef}
            highlightMapRef={highlightMapRef}
            inlinePlayer={inlinePlayer}
            playIdeaFromList={playIdeaFromList}
            openIdeaFromList={openIdeaFromList}
            // Stable fn + primitives (the row builds its own closure) so React.memo
            // holds — an inline arrow here re-rendered every mounted row per render.
            hideTimelineDay={hideTimelineDay}
            activeTimelineMetric={activeTimelineMetric}
            dayStartTs={entry.dayStartTs ?? null}
            dayDividerLabel={entry.dayDividerLabel}
            searchNeedle={searchNeedle}
            listDensity={listDensity}
            showDateDividers={showDateDividers}
            sortMetric={activeSortMetric}
            lyricsFilterMode={lyricsFilterMode}
            onRowHeight={onRowHeight}
          />
        );
    },
    [
      onRowHeight,
      listDensity,
      activeTimelineMetric,
      expandTimelineDay,
      rowLayoutsRef,
      highlightMapRef,
      inlinePlayer,
      playIdeaFromList,
      openIdeaFromList,
      hideTimelineDay,
      searchNeedle,
      showDateDividers,
      activeSortMetric,
      lyricsFilterMode,
    ]
  );

  return (
    <AnimatedFlatList<IdeaListEntry>
      ref={listRef}
      data={listEntries}
      onLayout={onListLayout}
      onContentSizeChange={onContentSizeChange}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      extraData={layoutVersion}
      viewabilityConfig={VIEWABILITY_CONFIG}
      onViewableItemsChanged={onViewableItemsChanged}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      // The idle gate (persist, manifest, hydration flushes) waits for these.
      onScrollBeginDrag={onListActivityBegin}
      onScrollEndDrag={onListActivityEnd}
      onMomentumScrollBegin={onListActivityBegin}
      onMomentumScrollEnd={onListActivityEnd}
      contentContainerStyle={contentContainerStyle}
      ListHeaderComponent={listHeader}
      ListFooterComponent={listFooter}
      ListEmptyComponent={
        listEntries.length === 0 ? (
          searchNeedle ? (
            <EmptyState
              icon="search-outline"
              title={t("collection.noMatches")}
              body={t("collection.noMatchesBody")}
              compact
            />
          ) : (
            <EmptyState
              icon="mic-outline"
              title={t("collection.empty")}
              body={t("collection.emptyBody")}
            />
          )
        ) : null
      }
      // First frame: one screen of cards. Twelve full cards (waveform, meta,
      // badges) before the collection could appear was most of its mount cost on a
      // large library; the rest fill in on the following frames.
      initialNumToRender={6}
      maxToRenderPerBatch={10}
      windowSize={7}
      onScrollToIndexFailed={(info) => {
        if (scrollRetryTimerRef.current) {
          clearTimeout(scrollRetryTimerRef.current);
        }
        listRef?.current?.scrollToOffset?.({
          offset: Math.max(0, info.averageItemLength * info.index),
          animated: true,
        });
        scrollRetryTimerRef.current = setTimeout(() => {
          listRef?.current?.scrollToIndex?.({
            index: info.index,
            animated: true,
            viewPosition: 0.35,
          });
          scrollRetryTimerRef.current = null;
        }, 120);
      }}
      removeClippedSubviews
      renderItem={renderItem}
    />
  );
}


/** Memoized: with a memoized model it re-renders only when something it shows changed. */
export const IdeaListContent = memo(IdeaListContentInner);

const keyExtractor = (item: IdeaListEntry) => item.key;
