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
  onTogglePlayItem: (item: ActivityItemResult) => void;
  onStopPlayItem: () => void;
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
  onTogglePlayItem: (item: ActivityItemResult) => void;
  onStopPlayItem: () => void;
  onSeekInline: (ms: number) => void;
  onSeekInlineStart: () => void;
  onSeekInlineCancel: () => void;
  onOpenItem: (item: ActivityItemResult) => void;
  onViewInCollection: (item: ActivityItemResult) => void;
};

// Results render unvirtualized inside the Activity page's ScrollView. A heavy
// day (e.g. a 100-file import) would mount every card at once and hang the page —
// cap what mounts and say how much more the range holds.
const MAX_RENDERED_RESULTS = 60;

function renderItemResults({
  results,
  onItemLayout,
  onDayLayout,
  canPlayItem,
  isItemPlaying,
  getItemDurationMs,
  activeInlineItemId,
  onTogglePlayItem,
  onStopPlayItem,
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

  const visibleResults = results.slice(0, MAX_RENDERED_RESULTS);
  const truncatedCount = results.length - visibleResults.length;

  return (
    <View style={styles.activityResultsList}>
      {visibleResults.map((result: ActivityItemResult, index: number) => {
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
              onTogglePlayItem,
              onStopPlayItem,
              onSeekInline,
              onSeekInlineStart,
              onSeekInlineCancel,
            }}
            onOpenItem={() => onOpenItem(result)}
            onViewInCollection={() => onViewInCollection(result)}
          />
        );
      })}
      {truncatedCount > 0 ? (
        <Text style={styles.activityResultEmptyText}>
          {truncatedCount} more item{truncatedCount === 1 ? "" : "s"} in this period — narrow the
          range or open the collection to see everything.
        </Text>
      ) : null}
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
  onTogglePlayItem,
  onStopPlayItem,
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
        onTogglePlayItem,
        onStopPlayItem,
        onSeekInline,
        onSeekInlineStart,
        onSeekInlineCancel,
        onOpenItem,
        onViewInCollection
      })}
    </View>
  );
}
