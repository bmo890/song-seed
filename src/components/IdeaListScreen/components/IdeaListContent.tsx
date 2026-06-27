import { MutableRefObject, ReactNode, useCallback, useEffect, useRef } from "react";
import { Animated, FlatList, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ReAnimated, { useAnimatedScrollHandler, type SharedValue } from "react-native-reanimated";
import { styles } from "../../../styles";
import { IdeaSort, InlinePlayerControls } from "../../../types";
import { IdeaListItem } from "./IdeaListItem";
import { CollectionListModel, IdeaListEntry, IdeaListItemMeta } from "../types";
import { getIdeaSortTimestamp, type IdeaSortMetric } from "../../../ideaSort";
import { getDateBucket } from "../../../dateBuckets";

const AnimatedFlatList = ReAnimated.FlatList as unknown as typeof FlatList;

type IdeaListContentProps = {
  listRef?: MutableRefObject<any>;
  listEntries: IdeaListEntry[];
  itemMetaByIdeaId: Map<string, IdeaListItemMeta>;
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
  searchMetaByIdeaId: Map<string, { matches: boolean; title: boolean; notes: boolean; lyrics: boolean }>;
  onViewableItemsChanged: (info: { viewableItems: Array<{ item: IdeaListEntry }> }) => void;
  onItemCellLayout?: (key: string, y: number) => void;
  playIdeaFromList: (ideaId: string, clip: any) => Promise<void> | void;
  openIdeaFromList: (ideaId: string, clip: any) => Promise<void> | void;
  onRestore: (idea: any) => void;
  hideTimelineDay: (metric: "created" | "updated", dayStartTs: number) => Promise<void>;
  /** UI-thread scroll offset mirrored from the list — drives the collapsing header. */
  collapseScrollY?: SharedValue<number>;
  /** Top inset reserving space for the absolute collapsing header overlay. */
  contentPaddingTop?: number;
};


export function IdeaListContent(
  props: IdeaListContentProps | { listModel: CollectionListModel }
) {
  const {
    listRef,
    listEntries,
    itemMetaByIdeaId,
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
    searchMetaByIdeaId,
    onViewableItemsChanged,
    playIdeaFromList,
    openIdeaFromList,
    onRestore,
    hideTimelineDay,
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

  return (
    <AnimatedFlatList<IdeaListEntry>
      ref={listRef}
      data={listEntries}
      keyExtractor={(item) => item.key}
      CellRendererComponent={CellRendererComponent}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      contentContainerStyle={[
        styles.listContent,
        listDensity === "compact" ? styles.listContentCompact : null,
        showDateDividers ? styles.listContentTimeline : null,
        { paddingHorizontal: 14, paddingBottom: 12 },
        contentPaddingTop ? { paddingTop: contentPaddingTop } : null,
      ]}
      ListHeaderComponent={topContent ? <>{topContent}</> : null}
      ListFooterComponent={<View style={{ height: listFooterSpacerHeight }} />}
      ListEmptyComponent={
        listEntries.length === 0 ? (
          <Text style={styles.emptyText}>
            {searchNeedle ? "No matching songs or clips." : "No songs or clips yet. Add your first one."}
          </Text>
        ) : null
      }
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      initialNumToRender={12}
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
      renderItem={(props) => {
        const entry = props.item;

        const searchMeta = searchMetaByIdeaId.get(entry.idea.id) ?? {
          matches: true,
          title: false,
          notes: false,
          lyrics: false,
        };

        return (
          <IdeaListItem
            item={entry.idea}
            itemMeta={itemMetaByIdeaId.get(entry.idea.id)}
            rowLayoutsRef={rowLayoutsRef}
            highlightMapRef={highlightMapRef}
            inlinePlayer={inlinePlayer}
            playIdeaFromList={playIdeaFromList}
            openIdeaFromList={openIdeaFromList}
            onRestore={onRestore}
            onHideDay={
              activeTimelineMetric && showDateDividers && entry.dayDividerLabel
                ? () =>
                    hideTimelineDay(
                      activeTimelineMetric,
                      entry.dayStartTs ?? getDateBucket(getIdeaSortTimestamp(entry.idea, ideasSort)).startTs
                    )
                : undefined
            }
            hidden={entry.hidden}
            dayDividerLabel={entry.dayDividerLabel}
            searchNeedle={searchNeedle}
            notesMatched={!!searchMeta.notes}
            lyricsMatched={!!searchMeta.lyrics}
            listDensity={listDensity}
            showDateDividers={showDateDividers}
            sortMetric={activeSortMetric}
            lyricsFilterMode={lyricsFilterMode}
          />
        );
      }}
    />
  );
}
