import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { InlineIdeaCard } from "../../common/InlineIdeaCard";
import { styles } from "../styles";
import type { ActivityItemResult } from "../helpers";
import { getDateBucket } from "../../../dateBuckets";
import { colors } from "../../../design/tokens";

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
    onTogglePlayItem: (item: ActivityItemResult) => void;
    onStopPlayItem: () => void;
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
  const isSong = result.ideaKind === "song";
  const canPlay = playback.canPlayItem(result);
  const isActive = playback.activeInlineItemId === result.ideaId && canPlay;
  const durationMs = playback.getItemDurationMs(result);
  const resultBucket = getDateBucket(result.latestAt);
  const previousBucket = previousResult ? getDateBucket(previousResult.latestAt) : null;
  const showDayDivider = previousBucket?.key !== resultBucket.key;
  const activityIcon =
    result.activityLabel === "Updated" ? "pencil-outline" : "bulb-outline";

  const footerContent = (
    <View style={cardStyles.footer}>
      {result.activityLabel ? (
        <View style={cardStyles.action}>
          <Ionicons name={activityIcon} size={12} color={colors.textSecondary} />
          <Text style={cardStyles.actionLabel}>{result.activityLabel}</Text>
        </View>
      ) : (
        <View />
      )}
      <Pressable
        style={({ pressed }) => [cardStyles.viewBtn, pressed ? styles.pressDown : null]}
        onPress={(event) => {
          event.stopPropagation();
          onViewInCollection();
        }}
        hitSlop={6}
      >
        <Ionicons name="folder-outline" size={12} color={colors.primaryDeep} />
        <Text style={cardStyles.viewBtnText}>View in collection</Text>
      </Pressable>
    </View>
  );

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

      <InlineIdeaCard
        title={result.ideaTitle}
        isProject={isSong}
        status={isSong ? result.ideaStatus : null}
        completionPct={result.completionPct}
        durationMs={durationMs}
        canPlay={canPlay}
        isActive={isActive}
        isPlaying={playback.isItemPlaying(result)}
        footerContent={footerContent}
        onOpen={onOpenItem}
        onTogglePlay={() => playback.onTogglePlayItem(result)}
        onStopPlay={playback.onStopPlayItem}
        onSeekStart={playback.onSeekInlineStart}
        onSeek={playback.onSeekInline}
        onSeekCancel={playback.onSeekInlineCancel}
      />
    </View>
  );
}

const cardStyles = StyleSheet.create({
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 16,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 1,
  },
  actionLabel: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textSecondary,
  },
  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewBtnText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.primaryDeep,
  },
});
