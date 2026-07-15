import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../../common/ScreenHeader";
import { styles } from "../styles";
import { ActivityHeatmapGrid } from "../ActivityHeatmapGrid";
import { ActivityRangeResults } from "../ActivityRangeResults";
import { ActivityCustomizeSheet } from "./ActivityCustomizeSheet";
import { useBrowseRootBackHandler } from "../../../hooks/useBrowseRootBackHandler";
import { useActivityScreenModel } from "../hooks/useActivityScreenModel";
import { colors } from "../../../design/tokens";

export function ActivityScreenContent() {
  useBrowseRootBackHandler();
  const model = useActivityScreenModel();
  const [customizeOpen, setCustomizeOpen] = useState(false);

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader
        title="Activity"
        leftIcon="hamburger"
        rightElement={
          model.isCollectionScoped ? undefined : (
            <Pressable
              style={({ pressed }) => [styles.customizeBtn, pressed ? styles.pressDown : null]}
              onPress={() => setCustomizeOpen(true)}
              hitSlop={6}
              accessibilityLabel="Customize Activity"
            >
              <Ionicons name="options-outline" size={18} color={colors.textSecondary} />
            </Pressable>
          )
        }
      />

      <View
        onLayout={(event) => {
          const { y, height } = event.nativeEvent.layout;
          model.setStickyDayTop((prev) => {
            const nextTop = y + height + 2;
            return Math.abs(prev - nextTop) < 1 ? prev : nextTop;
          });
        }}
      />

      {model.showStickyDayChip ? (
        <View style={[styles.ideasStickyDayWrap, { top: model.stickyDayTop }]} pointerEvents="none">
          <View style={styles.ideasStickyDayChip}>
            <Text style={styles.ideasStickyDayChipText}>{model.stickyDayLabel}</Text>
          </View>
        </View>
      ) : null}

      <ScrollView
        style={styles.flexFill}
        contentContainerStyle={styles.activityScreenContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={model.onHeaderScroll}
      >
        <Text style={styles.intro}>
          A year of your creative activity at a glance. Tap any day to see what you made.
        </Text>

        <View>
          <ActivityHeatmapGrid
            year={model.year}
            currentYear={model.currentYear}
            scopeLabel={model.scopeLabel}
            selectedRange={model.normalizedRange}
            selectedRangeLabel={model.selectedRangeLabel}
            monthMarkers={model.monthMarkers}
            weeks={model.weeks}
            countsByDay={model.countsByDay}
            maxDailyCount={model.maxDailyCount}
            legendSwatches={model.legendSwatches}
            onChangeYear={model.onChangeYear}
            onJumpToToday={model.onJumpToToday}
            onPressMonth={model.onPressMonth}
            onPressDay={model.onPressDay}
          />
        </View>

        <ActivityRangeResults
          selectedRangeItemCount={model.selectedRangeEntries.length}
          itemResults={model.itemResults}
          onLayout={model.onResultsLayout}
          onItemLayout={model.onItemLayout}
          onDayLayout={model.onDayLayout}
          canPlayItem={model.canPlayItem}
          isItemPlaying={model.isItemPlaying}
          getItemDurationMs={model.getItemDurationMs}
          activeInlineItemId={model.activeInlineItemId}
          onTogglePlayItem={model.onTogglePlayItem}
          onStopPlayItem={model.onStopPlayItem}
          onSeekInline={model.onSeekInline}
          onSeekInlineStart={model.onSeekInlineStart}
          onSeekInlineCancel={model.onSeekInlineCancel}
          onOpenItem={model.onOpenItem}
          onViewInCollection={model.onViewInCollection}
        />
      </ScrollView>

      <ActivityCustomizeSheet
        visible={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        groups={model.workspaceFilterGroups}
        expandedWorkspaceId={model.expandedWorkspaceId}
        setExpandedWorkspaceId={model.setExpandedWorkspaceId}
        setWorkspaceIncluded={model.setWorkspaceIncluded}
        setCollectionIncluded={model.setCollectionIncluded}
        hasSourceOverrides={model.hasSourceOverrides}
        resetSourceFilters={model.resetSourceFilters}
      />
    </SafeAreaView>
  );
}
