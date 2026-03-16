import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SurfaceCard } from "../common/SurfaceCard";
import { MiniProgress } from "../MiniProgress";
import { StatusBadge } from "../common/StatusBadge";
import { styles } from "../../styles";
import { ActivityItemResult, formatActivityListDayLabel } from "./helpers";
import { fmtDuration } from "../../utils";
import { getHierarchyIconColor, getHierarchyIconName } from "../../hierarchy";
import { startOfActivityDay } from "../../activity";

type ActivityRangeResultsProps = {
  selectedRangeItemCount: number;
  itemResults: ActivityItemResult[];
  onLayout?: (y: number, height: number) => void;
  onItemLayout: (item: ActivityItemResult, y: number, height: number) => void;
  onDayLayout: (dayLabel: string, y: number, height: number) => void;
  canPlayItem: (item: ActivityItemResult) => boolean;
  isItemPlaying: (item: ActivityItemResult) => boolean;
  getItemDurationMs: (item: ActivityItemResult) => number;
  activeInlineItemId: string | null;
  inlinePositionMs: number;
  inlineDurationMs: number;
  onTogglePlayItem: (item: ActivityItemResult) => void;
  onSeekInline: (ms: number) => void;
  onSeekInlineStart: () => void;
  onSeekInlineCancel: () => void;
  onOpenItem: (item: ActivityItemResult) => void;
  onViewInCollection: (item: ActivityItemResult) => void;
};

function renderItemResults(
  results: ActivityItemResult[],
  onItemLayout: (item: ActivityItemResult, y: number, height: number) => void,
  onDayLayout: (dayLabel: string, y: number, height: number) => void,
  canPlayItem: (item: ActivityItemResult) => boolean,
  isItemPlaying: (item: ActivityItemResult) => boolean,
  getItemDurationMs: (item: ActivityItemResult) => number,
  activeInlineItemId: string | null,
  inlinePositionMs: number,
  inlineDurationMs: number,
  onTogglePlayItem: (item: ActivityItemResult) => void,
  onSeekInline: (ms: number) => void,
  onSeekInlineStart: () => void,
  onSeekInlineCancel: () => void,
  onOpenItem: (item: ActivityItemResult) => void,
  onViewInCollection: (item: ActivityItemResult) => void
) {
  if (results.length === 0) {
    return (
      <SurfaceCard style={styles.activityResultEmptyCard}>
        <Text style={styles.activityResultEmptyTitle}>No matching work in this period</Text>
        <Text style={styles.activityResultEmptyText}>
          Try a different day, week, month, or activity filter.
        </Text>
      </SurfaceCard>
    );
  }

  return (
    <View style={styles.activityResultsList}>
      {results.map((result, index) => {
        const canPlay = canPlayItem(result);
        const isActive = activeInlineItemId === result.ideaId && canPlay;
        const durationMs = getItemDurationMs(result);
        const durationLabel = durationMs > 0 ? fmtDuration(durationMs) : null;
        const previousResult = index > 0 ? results[index - 1] : null;
        const resultDayTs = startOfActivityDay(result.latestAt);
        const previousDayTs = previousResult ? startOfActivityDay(previousResult.latestAt) : null;
        const showDayDivider = previousDayTs !== resultDayTs;

        return (
          <View
            key={`${result.workspaceId}:${result.ideaId}`}
            style={styles.ideasListItemWrap}
            onLayout={(event) => {
              const { y, height } = event.nativeEvent.layout;
              onItemLayout(result, y, height);
            }}
          >
            {showDayDivider ? (
              <View
                style={styles.ideasDayDividerRow}
                onLayout={(event) => {
                  const { y, height } = event.nativeEvent.layout;
                  onDayLayout(formatActivityListDayLabel(result.latestAt), y, height);
                }}
              >
                <View style={styles.ideasDayDividerLine} />
                <Text style={styles.ideasDayDividerText}>
                  {formatActivityListDayLabel(result.latestAt)}
                </Text>
                <View style={styles.ideasDayDividerLine} />
              </View>
            ) : null}

            <View style={styles.activityResultsRowWrap}>
              <SurfaceCard
                style={[styles.activityResultCard, styles.activityResultsCardFill]}
                onPress={() => onOpenItem(result)}
              >
                <View style={styles.activityResultCardRow}>
                  <View style={[styles.activityResultLeadCol, isActive ? styles.activityResultLeadColActive : null]}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.ideasInlinePlayBtn,
                        pressed ? styles.pressDown : null,
                        !canPlay ? styles.activityResultIconBtnDisabled : null,
                      ]}
                      onPress={(event) => {
                        event.stopPropagation();
                        onTogglePlayItem(result);
                      }}
                      disabled={!canPlay}
                    >
                      <Ionicons
                        name={isItemPlaying(result) ? "pause" : "play"}
                        size={15}
                        color={canPlay ? "#111827" : "#9ca3af"}
                      />
                    </Pressable>
                    {!isActive ? (
                      <View style={styles.activityResultLeadDurationSlot}>
                        <Text style={styles.ideasListLeadDurationText}>
                          {durationLabel ?? "--:--"}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.activityResultMain}>
                    <View style={styles.activityResultTop}>
                      <View style={styles.ideasListCardTop}>
                        <View style={styles.ideasListCardTitleRow}>
                          <View style={styles.ideasListTitleIconWrap}>
                            <Ionicons
                              name={getHierarchyIconName(result.ideaKind === "song" ? "song" : "clip")}
                              size={13}
                              color={getHierarchyIconColor(result.ideaKind === "song" ? "song" : "clip")}
                            />
                          </View>
                          <Text style={styles.activityResultTitle} numberOfLines={1}>
                            {result.ideaTitle}
                          </Text>
                        </View>
                        {result.ideaKind === "song" ? (
                          <View style={styles.ideasListCardTrailing}>
                            <StatusBadge status={result.ideaStatus} style={styles.ideasListStatusBadgeText} />
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.activityResultMeta} numberOfLines={1}>
                        {result.activityLabel}
                      </Text>
                    </View>

                    {isActive ? (
                      <MiniProgress
                        currentMs={inlinePositionMs}
                        durationMs={inlineDurationMs || durationMs || 0}
                        showTopDivider
                        extraBottomMargin={2}
                        captureWholeLane
                        onSeek={(ms) => onSeekInline(ms)}
                        onSeekStart={onSeekInlineStart}
                        onSeekCancel={onSeekInlineCancel}
                      />
                    ) : null}

                    <View style={styles.activityResultBottomRow}>
                      <Text style={styles.activityResultContext} numberOfLines={1}>
                        {result.contextLabel}
                      </Text>
                      <View style={styles.activityResultActions}>
                        <Pressable
                          style={({ pressed }) => [styles.activityResultActionBtn, pressed ? styles.pressDown : null]}
                          onPress={(event) => {
                            event.stopPropagation();
                            onViewInCollection(result);
                          }}
                        >
                          <Text style={styles.activityResultActionBtnText}>View in collection</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>
              </SurfaceCard>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function ActivityRangeResults({
  selectedRangeItemCount,
  itemResults,
  onLayout,
  onItemLayout,
  onDayLayout,
  canPlayItem,
  isItemPlaying,
  getItemDurationMs,
  activeInlineItemId,
  inlinePositionMs,
  inlineDurationMs,
  onTogglePlayItem,
  onSeekInline,
  onSeekInlineStart,
  onSeekInlineCancel,
  onOpenItem,
  onViewInCollection,
}: ActivityRangeResultsProps) {
  return (
    <View
      style={styles.activityResultsSection}
      onLayout={(event) => {
        const { y, height } = event.nativeEvent.layout;
        onLayout?.(y, height);
      }}
    >
      <Text style={styles.activityResultsSummaryText}>
        {selectedRangeItemCount} {selectedRangeItemCount === 1 ? "item" : "items"}
      </Text>

      {renderItemResults(
        itemResults,
        onItemLayout,
        onDayLayout,
        canPlayItem,
        isItemPlaying,
        getItemDurationMs,
        activeInlineItemId,
        inlinePositionMs,
        inlineDurationMs,
        onTogglePlayItem,
        onSeekInline,
        onSeekInlineStart,
        onSeekInlineCancel,
        onOpenItem,
        onViewInCollection
      )}
    </View>
  );
}
