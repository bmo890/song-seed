import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import ReAnimated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ScreenHeader } from "../common/ScreenHeader";
import { AppBreadcrumbs } from "../common/AppBreadcrumbs";
import { useStore } from "../../state/useStore";
import { useInlinePlayer } from "../../hooks/useInlinePlayer";
import {
  ActivityMetricFilter,
  buildActivityCountsByDay,
  buildActivityHeatmapMatrix,
  buildActivityRangeEntries,
  filterActivityEvents,
  getActivityEventsWithHistory,
  startOfActivityDay,
} from "../../activity";
import { getCollectionAncestors, getCollectionById } from "../../utils";
import { styles } from "../../styles";
import { getCollectionHierarchyLevel } from "../../hierarchy";
import { useScrollCollapseHeader } from "../../hooks/useScrollCollapseHeader";
import { ActivityScopeControls } from "./ActivityScopeControls";
import { ActivityHeatmapGrid } from "./ActivityHeatmapGrid";
import { ActivityRangeResults } from "./ActivityRangeResults";
import {
  buildActivityItemResults,
  formatSelectedRangeLabel,
  getActivityCellBackground,
} from "./helpers";
import { getDateBucketLabel } from "../../dateBuckets";
import { openCollectionFromContext } from "../../navigation";
import { useBrowseRootBackHandler } from "../../hooks/useBrowseRootBackHandler";

export function ActivityScreen() {
  const navigation = useNavigation();
  useBrowseRootBackHandler();
  const rootNavigation = (navigation as any).getParent?.();
  const navigateRoot = (routeName: string, params?: object) =>
    (rootNavigation ?? navigation).navigate(routeName as never, params as never);
  const route = useRoute<any>();
  const routeParams = route.params ?? {};
  const scopedCollectionId = routeParams.collectionId as string | undefined;
  const scopedWorkspaceId = routeParams.workspaceId as string | undefined;

  const workspaces = useStore((state) => state.workspaces);
  const primaryWorkspaceId = useStore((state) => state.primaryWorkspaceId);
  const workspaceLastOpenedAt = useStore((state) => state.workspaceLastOpenedAt);
  const activityEvents = useStore((state) => state.activityEvents);
  const activeWorkspaceId = useStore((state) => state.activeWorkspaceId);
  const setActiveWorkspaceId = useStore((state) => state.setActiveWorkspaceId);
  const setSelectedIdeaId = useStore((state) => state.setSelectedIdeaId);
  const inlinePlayer = useInlinePlayer();
  const {
    handleScroll: handleCollapseScroll,
    animStyle: headerCollapseAnimStyle,
  } = useScrollCollapseHeader();

  const collectionScopeWorkspace = useMemo(() => {
    if (!scopedCollectionId) return null;
    if (scopedWorkspaceId) {
      return workspaces.find((workspace) => workspace.id === scopedWorkspaceId) ?? null;
    }
    return (
      workspaces.find((workspace) =>
        workspace.collections.some((collection) => collection.id === scopedCollectionId)
      ) ?? null
    );
  }, [scopedCollectionId, scopedWorkspaceId, workspaces]);

  const collectionScope = useMemo(() => {
    if (!scopedCollectionId || !collectionScopeWorkspace) return null;
    return getCollectionById(collectionScopeWorkspace, scopedCollectionId);
  }, [collectionScopeWorkspace, scopedCollectionId]);
  const collectionScopeAncestors = useMemo(
    () =>
      collectionScope && collectionScopeWorkspace
        ? getCollectionAncestors(collectionScopeWorkspace, collectionScope.id)
        : [],
    [collectionScope, collectionScopeWorkspace]
  );

  const [workspaceFilterId, setWorkspaceFilterId] = useState<string | null>(
    scopedCollectionId ? collectionScopeWorkspace?.id ?? null : null
  );
  const [collectionFilterId, setCollectionFilterId] = useState<string | null>(null);
  const [metricFilter, setMetricFilter] = useState<ActivityMetricFilter>("both");
  const [stickyDayLabel, setStickyDayLabel] = useState<string | null>(null);
  const [stickyDayTop, setStickyDayTop] = useState(0);
  const [resultsSectionTop, setResultsSectionTop] = useState(0);
  const [activityScrollY, setActivityScrollY] = useState(0);
  const activityRowLayoutsRef = useRef<Record<string, { y: number; height: number; label: string }>>({});
  const activityDayLayoutsRef = useRef<Record<string, { y: number; height: number }>>({});

  const allActivityEvents = useMemo(
    () => getActivityEventsWithHistory(workspaces, activityEvents),
    [activityEvents, workspaces]
  );

  const latestActivityYear = useMemo(() => {
    const latestTs = allActivityEvents[0]?.at ?? Date.now();
    return new Date(latestTs).getFullYear();
  }, [allActivityEvents]);

  const [year, setYear] = useState(latestActivityYear);
  const currentYear = new Date().getFullYear();
  const [rangeStartTs, setRangeStartTs] = useState<number | null>(null);
  const [rangeEndTs, setRangeEndTs] = useState<number | null>(null);

  const effectiveWorkspaceId = scopedCollectionId ? collectionScopeWorkspace?.id ?? null : workspaceFilterId;
  const effectiveCollectionFilterId = scopedCollectionId ?? collectionFilterId;
  const selectedWorkspace = useMemo(
    () =>
      effectiveWorkspaceId
        ? workspaces.find((workspace) => workspace.id === effectiveWorkspaceId) ?? null
        : null,
    [effectiveWorkspaceId, workspaces]
  );
  const topLevelCollections = useMemo(
    () => selectedWorkspace?.collections.filter((collection) => !collection.parentCollectionId) ?? [],
    [selectedWorkspace]
  );

  useEffect(() => {
    setCollectionFilterId(null);
  }, [workspaceFilterId]);

  const filteredEvents = useMemo(
    () =>
      filterActivityEvents(allActivityEvents, workspaces, {
        workspaceId: effectiveWorkspaceId,
        collectionId: effectiveCollectionFilterId,
        metric: metricFilter,
        year,
      }),
    [allActivityEvents, effectiveCollectionFilterId, effectiveWorkspaceId, metricFilter, workspaces, year]
  );

  useEffect(() => {
    const fallbackTs = filteredEvents[0]?.at ?? new Date(year, 0, 1).getTime();
    const fallbackDay = startOfActivityDay(fallbackTs);
    setRangeStartTs(fallbackDay);
    setRangeEndTs(fallbackDay);
  }, [effectiveCollectionFilterId, effectiveWorkspaceId, metricFilter, year, filteredEvents]);

  const countsByDay = useMemo(() => buildActivityCountsByDay(filteredEvents), [filteredEvents]);
  const maxDailyCount = useMemo(
    () => Math.max(0, ...Array.from(countsByDay.values())),
    [countsByDay]
  );
  const { weeks, monthMarkers } = useMemo(() => buildActivityHeatmapMatrix(year), [year]);

  const normalizedRange = useMemo(() => {
    if (rangeStartTs == null) return null;
    const normalizedStart = startOfActivityDay(Math.min(rangeStartTs, rangeEndTs ?? rangeStartTs));
    const normalizedEnd = startOfActivityDay(Math.max(rangeStartTs, rangeEndTs ?? rangeStartTs));
    return {
      startTs: normalizedStart,
      endTs: normalizedEnd,
    };
  }, [rangeEndTs, rangeStartTs]);
  const selectedRangeEntries = useMemo(
    () =>
      normalizedRange == null
        ? []
        : buildActivityRangeEntries(filteredEvents, normalizedRange.startTs, normalizedRange.endTs),
    [filteredEvents, normalizedRange]
  );
  const itemResults = useMemo(
    () => buildActivityItemResults(selectedRangeEntries, workspaces),
    [selectedRangeEntries, workspaces]
  );
  const selectedRangeLabel = useMemo(
    () =>
      normalizedRange == null
        ? null
        : formatSelectedRangeLabel(normalizedRange.startTs, normalizedRange.endTs, metricFilter),
    [metricFilter, normalizedRange]
  );
  const legendSwatches = useMemo(
    () =>
      [0.25, 0.5, 0.75, 1].map((ratio) =>
        getActivityCellBackground(
          Math.max(1, Math.round(maxDailyCount * ratio)),
          Math.max(1, maxDailyCount),
          true
        )
      ),
    [maxDailyCount]
  );

  const scopeLabel = useMemo(() => {
    if (collectionScope && collectionScopeWorkspace) {
      return `${collectionScopeWorkspace.title} / ${collectionScope.title}`;
    }
    if (selectedWorkspace) {
      return `${selectedWorkspace.title} workspace`;
    }
    return "All workspaces";
  }, [collectionScope, collectionScopeWorkspace, selectedWorkspace]);

  useEffect(() => {
    activityRowLayoutsRef.current = {};
    activityDayLayoutsRef.current = {};
    if (itemResults.length === 0) {
      setStickyDayLabel(null);
      return;
    }
    setStickyDayLabel(getDateBucketLabel(itemResults[0]!.latestAt));
  }, [itemResults]);

  function getPlayableClipForItem(item: { workspaceId: string; ideaId: string }) {
    const workspace = workspaces.find((candidate) => candidate.id === item.workspaceId);
    const idea = workspace?.ideas.find((candidate) => candidate.id === item.ideaId);
    if (!idea) return null;

    return idea.kind === "clip"
      ? idea.clips.find((clip) => !!clip.audioUri) ?? null
      : idea.clips.find((clip) => clip.isPrimary && !!clip.audioUri) ??
          idea.clips.find((clip) => !!clip.audioUri) ??
          null;
  }

  function openIdea(ideaId: string, workspaceId: string) {
    if (activeWorkspaceId !== workspaceId) {
      setActiveWorkspaceId(workspaceId);
    }
    setSelectedIdeaId(ideaId);
    navigateRoot("IdeaDetail", { ideaId });
  }

  async function openItem(item: { workspaceId: string; ideaId: string; ideaKind: "song" | "clip" }) {
    if (item.ideaKind === "clip") {
      const clip = getPlayableClipForItem(item);
      if (!clip) {
        Alert.alert("Nothing to open", "This clip does not have playable audio yet.");
        return;
      }
      await inlinePlayer.resetInlinePlayer();
      useStore.getState().setPlayerQueue([{ ideaId: item.ideaId, clipId: clip.id }], 0, true);
      navigateRoot("Player");
      return;
    }

    await inlinePlayer.resetInlinePlayer();
    openIdea(item.ideaId, item.workspaceId);
  }

  function openCollectionFromActivityContext(collectionId: string, focusIdeaId?: string) {
    openCollectionFromContext(navigation, {
      collectionId,
      activityRangeStartTs: normalizedRange?.startTs,
      activityRangeEndTs:
        normalizedRange != null ? normalizedRange.endTs + 24 * 60 * 60 * 1000 - 1 : undefined,
      activityMetricFilter: metricFilter,
      activityLabel: selectedRangeLabel ?? undefined,
      focusIdeaId,
      focusToken: focusIdeaId ? Date.now() : undefined,
      source: "activity",
    });
  }

  async function viewItemInCollection(item: { workspaceId: string; collectionId: string; ideaId: string }) {
    if (activeWorkspaceId !== item.workspaceId) {
      setActiveWorkspaceId(item.workspaceId);
    }
    await inlinePlayer.resetInlinePlayer();
    openCollectionFromActivityContext(item.collectionId, item.ideaId);
  }

  function updateStickyDayLabel(scrollY: number) {
    if (itemResults.length === 0) {
      setStickyDayLabel(null);
      return;
    }

    const threshold = scrollY + 2;
    let nextLabel = getDateBucketLabel(itemResults[0]!.latestAt);
    const seenDayLabels = new Set<string>();

    for (const item of itemResults) {
      const dayLabel = getDateBucketLabel(item.latestAt);
      if (seenDayLabels.has(dayLabel)) continue;
      seenDayLabels.add(dayLabel);
      const layout = activityDayLayoutsRef.current[dayLabel];
      if (!layout) continue;
      if (resultsSectionTop + layout.y <= threshold) {
        nextLabel = dayLabel;
      } else {
        break;
      }
    }

    setStickyDayLabel((prev) => (prev === nextLabel ? prev : nextLabel));
  }

  const firstTimelineDayLabel =
    itemResults.length > 0 ? getDateBucketLabel(itemResults[0]!.latestAt) : null;
  const firstTimelineDayLayout =
    firstTimelineDayLabel != null ? activityDayLayoutsRef.current[firstTimelineDayLabel] : null;
  const showStickyDayChip =
    itemResults.length > 0 &&
    stickyDayLabel != null &&
    firstTimelineDayLayout != null &&
    activityScrollY >= resultsSectionTop + firstTimelineDayLayout.y;

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title="Activity" leftIcon="hamburger" />

      <ReAnimated.View style={headerCollapseAnimStyle}>
        {collectionScope && collectionScopeWorkspace ? (
          <AppBreadcrumbs
            items={[
              {
                key: `workspace-${collectionScopeWorkspace.id}`,
                label: collectionScopeWorkspace.title,
                level: "workspace",
                onPress: () => (navigation as any).navigate("Home", { screen: "Browse" }),
              },
              ...collectionScopeAncestors.map((collection) => ({
                key: collection.id,
                label: collection.title,
                level: getCollectionHierarchyLevel(collection),
                onPress: () => openCollectionFromActivityContext(collection.id),
              })),
              {
                key: collectionScope.id,
                label: collectionScope.title,
                level: getCollectionHierarchyLevel(collectionScope),
                onPress: () => openCollectionFromActivityContext(collectionScope.id),
              },
            ]}
          />
        ) : null}
      </ReAnimated.View>

      <View
        onLayout={(event) => {
          const { y, height } = event.nativeEvent.layout;
          setStickyDayTop((prev) => {
            const nextTop = y + height + 2;
            return Math.abs(prev - nextTop) < 1 ? prev : nextTop;
          });
        }}
      >
        <ActivityScopeControls
          collectionScopeActive={!!collectionScope}
          workspaces={workspaces}
          primaryWorkspaceId={primaryWorkspaceId}
          workspaceLastOpenedAt={workspaceLastOpenedAt}
          workspaceFilterId={workspaceFilterId}
          topLevelCollections={topLevelCollections}
          collectionFilterId={collectionFilterId}
          metricFilter={metricFilter}
          onSelectWorkspace={setWorkspaceFilterId}
          onSelectCollection={setCollectionFilterId}
          onSelectMetric={setMetricFilter}
        />
      </View>

      {showStickyDayChip ? (
        <View style={[styles.ideasStickyDayWrap, { top: stickyDayTop }]} pointerEvents="none">
          <View style={styles.ideasStickyDayChip}>
            <Text style={styles.ideasStickyDayChipText}>{stickyDayLabel}</Text>
          </View>
        </View>
      ) : null}

      <ScrollView
        style={styles.flexFill}
        contentContainerStyle={styles.activityScreenContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => {
          const nextScrollY = event.nativeEvent.contentOffset.y;
          setActivityScrollY(nextScrollY);
          updateStickyDayLabel(nextScrollY);
          handleCollapseScroll(event);
        }}
      >
        <View>
          <ActivityHeatmapGrid
            year={year}
            currentYear={currentYear}
            scopeLabel={scopeLabel}
            selectedRange={normalizedRange}
            selectedRangeLabel={selectedRangeLabel}
            monthMarkers={monthMarkers}
            weeks={weeks}
            countsByDay={countsByDay}
            maxDailyCount={maxDailyCount}
            legendSwatches={legendSwatches}
            onChangeYear={(nextYear) => setYear(Math.min(nextYear, currentYear))}
            onPressMonth={(month) => {
              const monthStart = startOfActivityDay(new Date(year, month, 1).getTime());
              const monthEnd = startOfActivityDay(new Date(year, month + 1, 0).getTime());
              setRangeStartTs(monthStart);
              setRangeEndTs(monthEnd);
            }}
            onPressDay={(dayTs) => {
              const normalizedDay = startOfActivityDay(dayTs);
              if (rangeStartTs == null || rangeEndTs != null) {
                setRangeStartTs(normalizedDay);
                setRangeEndTs(null);
                return;
              }
              setRangeEndTs(normalizedDay);
            }}
          />
        </View>

        <ActivityRangeResults
          selectedRangeItemCount={selectedRangeEntries.length}
          itemResults={itemResults}
          onLayout={(y) => {
            setResultsSectionTop((prev) => (Math.abs(prev - y) < 1 ? prev : y));
          }}
          onItemLayout={(item, y, height) => {
            activityRowLayoutsRef.current[item.ideaId] = {
              y,
              height,
              label: getDateBucketLabel(item.latestAt),
            };
          }}
          onDayLayout={(dayLabel, y, height) => {
            activityDayLayoutsRef.current[dayLabel] = { y, height };
          }}
          canPlayItem={(item) => !!getPlayableClipForItem(item)}
          isItemPlaying={(item) => {
            const clip = getPlayableClipForItem(item);
            const inlineTarget = inlinePlayer.inlineTarget;
            return !!clip && inlineTarget?.ideaId === item.ideaId && inlineTarget.clipId === clip.id && inlinePlayer.isInlinePlaying;
          }}
          getItemDurationMs={(item) => getPlayableClipForItem(item)?.durationMs ?? 0}
          activeInlineItemId={inlinePlayer.inlineTarget?.ideaId ?? null}
          inlinePositionMs={inlinePlayer.inlinePosition}
          inlineDurationMs={inlinePlayer.inlineDuration}
          onTogglePlayItem={(item) => {
            const clip = getPlayableClipForItem(item);
            if (!clip) return;
            void inlinePlayer.toggleInlinePlayback(item.ideaId, clip);
          }}
          onSeekInline={(ms) => {
            void inlinePlayer.endInlineScrub(ms);
          }}
          onSeekInlineStart={() => {
            void inlinePlayer.beginInlineScrub();
          }}
          onSeekInlineCancel={() => {
            void inlinePlayer.cancelInlineScrub();
          }}
          onOpenItem={(item) => {
            void openItem(item);
          }}
          onViewInCollection={(item) => {
            void viewItemInCollection(item);
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
