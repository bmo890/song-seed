import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SurfaceCard } from "../../common/SurfaceCard";
import { MiniProgress } from "../../MiniProgress";
import { StatusBadge } from "../../common/StatusBadge";
import { styles } from "../styles";
import type { ActivityItemResult } from "../helpers";
import { fmtDuration } from "../../../utils";
import { getHierarchyIconColor, getHierarchyIconName } from "../../../hierarchy";
import { getDateBucket } from "../../../dateBuckets";

type ActivityResultCardProps = {
  result: ActivityItemResult;
  previousResult: ActivityItemResult | null;
  onItemLayout: (y: number, height: number) => void;
  onDayLayout: (dayLabel: string, y: number, height: number) => void;
  playback: {
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
  };
  onOpenItem: () => void;
  onViewInCollection: () => void;
};

export function ActivityResultCard({
  result,
  previousResult,
  onItemLayout,
  onDayLayout,
  playback,
  onOpenItem,
  onViewInCollection,
}: ActivityResultCardProps) {
  const canPlay = playback.canPlayItem(result);
  const isActive = playback.activeInlineItemId === result.ideaId && canPlay;
  const durationMs = playback.getItemDurationMs(result);
  const durationLabel = durationMs > 0 ? fmtDuration(durationMs) : null;
  const resultBucket = getDateBucket(result.latestAt);
  const previousBucket = previousResult ? getDateBucket(previousResult.latestAt) : null;
  const showDayDivider = previousBucket?.key !== resultBucket.key;
  const activityIconName =
    result.activityLabel === "Updated" ? "sparkles-outline" : "add-circle-outline";

  return (
    <View
      style={styles.ideasListItemWrap}
      onLayout={(event) => {
        const { y, height } = event.nativeEvent.layout;
        onItemLayout(y, height);
      }}
    >
      {showDayDivider ? (
        <View
          style={styles.ideasDayDividerRow}
          onLayout={(event) => {
            const { y, height } = event.nativeEvent.layout;
            onDayLayout(resultBucket.label, y, height);
          }}
        >
          <View style={styles.ideasDayDividerLine} />
          <Text style={styles.ideasDayDividerText}>{resultBucket.label}</Text>
          <View style={styles.ideasDayDividerLine} />
        </View>
      ) : null}

      <View style={styles.activityResultsRowWrap}>
        <SurfaceCard
          style={[styles.activityResultCard, styles.activityResultsCardFill]}
          onPress={onOpenItem}
        >
          <View style={styles.activityResultCardRow}>
            <View
              style={[
                styles.activityResultLeadCol,
                isActive ? styles.activityResultLeadColActive : null,
              ]}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.ideasInlinePlayBtn,
                  pressed ? styles.pressDown : null,
                  !canPlay ? styles.activityResultIconBtnDisabled : null,
                ]}
                onPress={(event) => {
                  event.stopPropagation();
                  playback.onTogglePlayItem(result);
                }}
                disabled={!canPlay}
              >
                <Ionicons
                  name={playback.isItemPlaying(result) ? "pause" : "play"}
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
                        name={getHierarchyIconName(
                          result.ideaKind === "song" ? "song" : "clip"
                        )}
                        size={13}
                        color={getHierarchyIconColor(
                          result.ideaKind === "song" ? "song" : "clip"
                        )}
                      />
                    </View>
                    <Text style={styles.activityResultTitle} numberOfLines={1}>
                      {result.ideaTitle}
                    </Text>
                  </View>
                  {result.ideaKind === "song" ? (
                    <View style={styles.ideasListCardTrailing}>
                      <StatusBadge
                        status={result.ideaStatus}
                        style={styles.ideasListStatusBadgeText}
                      />
                    </View>
                  ) : null}
                </View>
                <View style={styles.activityResultMetaRow}>
                  <Ionicons
                    name={activityIconName}
                    size={12}
                    color="#64748b"
                  />
                  <Text style={styles.activityResultMeta} numberOfLines={1}>
                    {result.activityLabel}
                  </Text>
                </View>
              </View>

              {isActive ? (
                <MiniProgress
                  currentMs={playback.inlinePositionMs}
                  durationMs={playback.inlineDurationMs || durationMs || 0}
                  showTopDivider
                  extraBottomMargin={2}
                  captureWholeLane
                  onSeek={playback.onSeekInline}
                  onSeekStart={playback.onSeekInlineStart}
                  onSeekCancel={playback.onSeekInlineCancel}
                />
              ) : null}

              <View style={styles.activityResultBottomRow}>
                <Text style={styles.activityResultContext} numberOfLines={1}>
                  {result.contextLabel}
                </Text>
                <View style={styles.activityResultActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.activityResultActionBtn,
                      pressed ? styles.pressDown : null,
                    ]}
                    onPress={(event) => {
                      event.stopPropagation();
                      onViewInCollection();
                    }}
                  >
                    <Text style={styles.activityResultActionBtnText}>
                      View in collection
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </SurfaceCard>
      </View>
    </View>
  );
}
