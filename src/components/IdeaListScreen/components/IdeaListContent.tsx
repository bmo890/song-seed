import { MutableRefObject, ReactNode, memo, useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, FlatList, Pressable, Text, View } from "react-native";
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

const AnimatedFlatList = ReAnimated.FlatList as unknown as typeof FlatList;

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
  viewabilityConfig: { itemVisiblePercentThreshold: number };
  onViewableItemsChanged: (info: { viewableItems: Array<{ item: IdeaListEntry }> }) => void;
  onItemCellLayout?: (key: string, y: number) => void;
  playIdeaFromList: (ideaId: string, clip: any) => Promise<void> | void;
  openIdeaFromList: (ideaId: string, clip: any) => Promise<void> | void;
  hideTimelineDay: (metric: "created" | "updated", dayStartTs: number) => Promise<void>;
  expandTimelineDay: (metric: "created" | "updated", dayStartTs: number) => void;
  /** UI-thread scroll offset mirrored from the list — drives the collapsing header. */
  collapseScrollY?: SharedValue<number>;
  /** Top inset reserving space for the absolute collapsing header overlay. */
  contentPaddingTop?: number;
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
    viewabilityConfig,
    onViewableItemsChanged,
    playIdeaFromList,
    openIdeaFromList,
    hideTimelineDay,
    expandTimelineDay,
    collapseScrollY,
    contentPaddingTop,
    onItemCellLayout,
  } = "listModel" in props ? props.listModel : props;
  const scrollRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable CellRendererComponent so FlatList doesn't remount all cells on re-render.
  // Reads the latest onItemCellLayout via a ref to avoid stale closures.
  const onItemCellLayoutRef = useRef(onItemCellLayout);
  useEffect(() => { onItemCellLayoutRef.current = onItemCellLayout; }, [onItemCellLayout]);
  const CellRendererComponent = useCallback(
    ({ cellKey, children, onLayout: origOnLayout, ...rest }: any) => (
      <View
        {...rest}
        onLayout={(e: any) => {
          onItemCellLayoutRef.current?.(cellKey, e.nativeEvent.layout.y);
          origOnLayout?.(e);
        }}
      >
        {children}
      </View>
    ),
    []
  );

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
  // Stable per set of inputs, so a re-render for an unrelated reason does not make
  // VirtualizedList re-invoke it for every mounted cell.
  const renderItem = useCallback(
    (props: { item: IdeaListEntry }) => {
        const entry = props.item;

        if (entry.type === "collapsedDay") {
          return (
            <CollapsedDayRow
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
          />
        );
    },
    [
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
      keyExtractor={keyExtractor}
      CellRendererComponent={CellRendererComponent}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      contentContainerStyle={contentContainerStyle}
      ListHeaderComponent={topContent ? <>{topContent}</> : null}
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
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
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
