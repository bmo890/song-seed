import { MutableRefObject } from "react";
import DraggableFlatList from "react-native-draggable-flatlist";
import { Animated, NativeScrollEvent, NativeSyntheticEvent, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { IdeaSort, InlinePlayer, SongIdea } from "../../types";
import { IdeaListItem } from "./IdeaListItem";
import { IdeaListEntry } from "./types";
import { formatBytes } from "../../utils";
import { getIdeaSortTimestamp, type IdeaSortMetric } from "../../ideaSort";
import { getDateBucket } from "../../dateBuckets";

type IdeaListContentProps = {
  listRef?: MutableRefObject<any>;
  listSelectionMode: boolean;
  allowReorder: boolean;
  listEntries: IdeaListEntry[];
  listDensity: "comfortable" | "compact";
  showDateDividers: boolean;
  listFooterSpacerHeight: number;
  searchNeedle: string;
  ideasSort: IdeaSort;
  activeTimelineMetric: "created" | "updated" | null;
  activeSortMetric: IdeaSortMetric;
  hoveredIdeaId: string | null;
  dropIntent: "between" | "inside";
  ideaSizeMap: Record<string, number>;
  lyricsFilterMode: "all" | "with" | "without";
  inlinePlayer: InlinePlayer;
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
  setHoveredIdeaId: (ideaId: string | null) => void;
  onReorderIdeas: (args: {
    items: SongIdea[];
    from: number;
    to: number;
    sourceId?: string;
    targetId?: string;
    intent: "between";
  }) => void;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle?: number;
};


export function IdeaListContent({
  listRef,
  listSelectionMode,
  allowReorder,
  listEntries,
  listDensity,
  showDateDividers,
  listFooterSpacerHeight,
  searchNeedle,
  ideasSort,
  activeTimelineMetric,
  activeSortMetric,
  hoveredIdeaId,
  dropIntent,
  ideaSizeMap,
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
  setHoveredIdeaId,
  onReorderIdeas,
  onScroll,
  scrollEventThrottle,
}: IdeaListContentProps) {
  return (
    <DraggableFlatList<IdeaListEntry>
      ref={listRef}
      data={listEntries}
      onScroll={onScroll}
      scrollEventThrottle={scrollEventThrottle ?? 0}
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
                  <Ionicons name="eye-outline" size={11} color="#94a3b8" />
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
            {...props}
            item={entry.idea}
            hoveredIdeaId={hoveredIdeaId}
            dropIntent={dropIntent}
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
        if (allowReorder) {
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
  );
}
