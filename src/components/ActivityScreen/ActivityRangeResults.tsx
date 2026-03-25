import { Text, View } from "react-native";
import { SurfaceCard } from "../common/SurfaceCard";
import { styles } from "../../styles";
import { ActivityItemResult } from "./helpers";
import { ActivityResultCard } from "./components/ActivityResultCard";

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

type ActivityResultsListProps = {
  results: ActivityItemResult[];
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

function renderItemResults({
  results,
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
}: ActivityResultsListProps) {
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
      {results.map((result: ActivityItemResult, index: number) => {
        const previousResult = index > 0 ? results[index - 1] : null;

        return (
          <ActivityResultCard
            key={`${result.workspaceId}:${result.ideaId}`}
            result={result}
            previousResult={previousResult}
            onItemLayout={(y, height) => onItemLayout(result, y, height)}
            onDayLayout={onDayLayout}
            playback={{
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
            }}
            onOpenItem={() => onOpenItem(result)}
            onViewInCollection={() => onViewInCollection(result)}
          />
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

      {renderItemResults({
        results: itemResults,
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
      })}
    </View>
  );
}
