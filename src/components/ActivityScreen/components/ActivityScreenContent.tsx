import { ScrollView, Text, View } from "react-native";
import ReAnimated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../../common/ScreenHeader";
import { AppBreadcrumbs } from "../../common/AppBreadcrumbs";
import { styles } from "../styles";
import { ActivityScopeControls } from "../ActivityScopeControls";
import { ActivityHeatmapGrid } from "../ActivityHeatmapGrid";
import { ActivityRangeResults } from "../ActivityRangeResults";
import { useBrowseRootBackHandler } from "../../../hooks/useBrowseRootBackHandler";
import { useActivityScreenModel } from "../hooks/useActivityScreenModel";

export function ActivityScreenContent() {
  useBrowseRootBackHandler();
  const model = useActivityScreenModel();

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title="Activity" leftIcon="hamburger" />

      <ReAnimated.View style={model.headerCollapseAnimStyle}>
        {model.breadcrumbItems.length > 0 ? <AppBreadcrumbs items={model.breadcrumbItems} /> : null}
      </ReAnimated.View>

      <View
        onLayout={(event) => {
          const { y, height } = event.nativeEvent.layout;
          model.setStickyDayTop((prev) => {
            const nextTop = y + height + 2;
            return Math.abs(prev - nextTop) < 1 ? prev : nextTop;
          });
        }}
      >
        <ActivityScopeControls
          collectionScopeActive={!!model.collectionScope}
          workspaces={model.workspaces}
          primaryWorkspaceId={model.primaryWorkspaceId}
          workspaceLastOpenedAt={model.workspaceLastOpenedAt}
          workspaceFilterId={model.workspaceFilterId}
          topLevelCollections={model.topLevelCollections}
          collectionFilterId={model.collectionFilterId}
          metricFilter={model.metricFilter}
          onSelectWorkspace={model.setWorkspaceFilterId}
          onSelectCollection={model.setCollectionFilterId}
          onSelectMetric={model.setMetricFilter}
        />
      </View>

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
          inlinePositionMs={model.inlinePositionMs}
          inlineDurationMs={model.inlineDurationMs}
          onTogglePlayItem={model.onTogglePlayItem}
          onSeekInline={model.onSeekInline}
          onSeekInlineStart={model.onSeekInlineStart}
          onSeekInlineCancel={model.onSeekInlineCancel}
          onOpenItem={model.onOpenItem}
          onViewInCollection={model.onViewInCollection}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
