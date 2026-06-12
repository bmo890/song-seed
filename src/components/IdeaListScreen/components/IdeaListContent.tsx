import { MutableRefObject, ReactNode } from "react";
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
  playIdeaFromList: (ideaId: string, clip: any) => Promise<void> | void;
  openIdeaFromList: (ideaId: string, clip: any) => Promise<void> | void;
  unhideIdeasFromList: (ideaIds: string[]) => void;
  hideTimelineDay: (metric: "created" | "updated", dayStartTs: number) => Promise<void>;
  unhideTimelineDay: (metric: "created" | "updated", dayStartTs: number) => void;
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
    unhideIdeasFromList,
    hideTimelineDay,
    unhideTimelineDay,
    collapseScrollY,
    contentPaddingTop,
  } = "listModel" in props ? props.listModel : props;

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
        listRef?.current?.scrollToOffset?.({
          offset: Math.max(0, info.averageItemLength * info.index),
          animated: true,
        });
        setTimeout(() => {
          listRef?.current?.scrollToIndex?.({
            index: info.index,
            animated: true,
            viewPosition: 0.35,
          });
        }, 120);
      }}
      removeClippedSubviews
      renderItem={(props) => {
        const entry = props.item;

        if (entry.type === "hidden-day") {
          return (
            <View style={styles.ideasListItemWrap}>
              <View style={styles.ideasDayDividerRow}>
                <View style={styles.ideasDayDividerLineDashed} />
                <Text style={styles.ideasDayDividerTextHidden}>{entry.dayDividerLabel}</Text>
                <Pressable
                  style={({ pressed }) => [styles.ideasHiddenUnhideInlineBtn, pressed ? styles.pressDown : null]}
                  onPress={() => unhideTimelineDay(entry.metric, entry.dayStartTs)}
                >
                  <Ionicons name="eye-outline" size={11} color="#84736f" />
                  <Text style={styles.ideasHiddenUnhideInlineBtnText}>
                    {`unhide ${entry.hiddenCount}`}
                  </Text>
                </Pressable>
                <View style={styles.ideasDayDividerLineDashed} />
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
            item={entry.idea}
            itemMeta={itemMetaByIdeaId.get(entry.idea.id)}
            rowLayoutsRef={rowLayoutsRef}
            highlightMapRef={highlightMapRef}
            inlinePlayer={inlinePlayer}
            playIdeaFromList={playIdeaFromList}
            openIdeaFromList={openIdeaFromList}
            onUnhide={(idea) => unhideIdeasFromList([idea.id])}
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
            sortMetric={activeSortMetric}
            lyricsFilterMode={lyricsFilterMode}
          />
        );
      }}
    />
  );
}
