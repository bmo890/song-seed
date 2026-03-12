import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ScreenHeader } from "../common/ScreenHeader";
import { AppBreadcrumbs } from "../common/AppBreadcrumbs";
import { useStore } from "../../state/useStore";
import {
  ActivityDayEntry,
  ActivityMetricFilter,
  buildActivityCountsByDay,
  buildActivityDayEntries,
  buildActivityRangeEntries,
  buildActivityHeatmapMatrix,
  filterActivityEvents,
  formatActivityDayLabel,
  getActivityCollectionPath,
  getActivityEventsWithHistory,
  startOfActivityDay,
} from "../../activity";
import { getCollectionAncestors, getCollectionById } from "../../utils";
import { styles } from "../../styles";
import { getCollectionHierarchyLevel } from "../../hierarchy";
import { ActivityScopeControls } from "./ActivityScopeControls";
import { ActivityHeatmapGrid } from "./ActivityHeatmapGrid";
import { ActivityRangeResults } from "./ActivityRangeResults";
import { ActivityDayDetailModal } from "./ActivityDayDetailModal";
import {
  ActivityCollectionGroup,
  ActivityDayWorkspaceGroup,
  ActivityRangeWorkspaceGroup,
  formatMonthRangeLabel,
  formatSelectedRangeLabel,
  getActivityCellBackground,
  getMonthEventCount,
} from "./helpers";

export function ActivityScreen() {
  const navigation = useNavigation();
  const rootNavigation = (navigation as any).getParent?.();
  const navigateRoot = (routeName: string, params?: object) =>
    (rootNavigation ?? navigation).navigate(routeName as never, params as never);
  const route = useRoute<any>();
  const routeParams = route.params ?? {};
  const scopedCollectionId = routeParams.collectionId as string | undefined;
  const scopedWorkspaceId = routeParams.workspaceId as string | undefined;

  const workspaces = useStore((state) => state.workspaces);
  const activityEvents = useStore((state) => state.activityEvents);
  const activeWorkspaceId = useStore((state) => state.activeWorkspaceId);
  const setActiveWorkspaceId = useStore((state) => state.setActiveWorkspaceId);
  const setSelectedIdeaId = useStore((state) => state.setSelectedIdeaId);

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
  const allActivityEvents = useMemo(
    () => getActivityEventsWithHistory(workspaces, activityEvents),
    [activityEvents, workspaces]
  );

  const latestActivityYear = useMemo(() => {
    const latestTs = allActivityEvents[0]?.at ?? Date.now();
    return new Date(latestTs).getFullYear();
  }, [allActivityEvents]);

  const [year, setYear] = useState(latestActivityYear);
  const [selectedDayTs, setSelectedDayTs] = useState<number | null>(null);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(null);
  const [rangeMode, setRangeMode] = useState(false);
  const [rangeStartTs, setRangeStartTs] = useState<number | null>(null);
  const [rangeEndTs, setRangeEndTs] = useState<number | null>(null);

  const effectiveWorkspaceId = scopedCollectionId ? collectionScopeWorkspace?.id ?? null : workspaceFilterId;
  const effectiveCollectionFilterId = scopedCollectionId ?? collectionFilterId;
  const selectedWorkspace = useMemo(
    () => (effectiveWorkspaceId ? workspaces.find((workspace) => workspace.id === effectiveWorkspaceId) ?? null : null),
    [effectiveWorkspaceId, workspaces]
  );
  const topLevelCollections = useMemo(
    () =>
      selectedWorkspace?.collections.filter((collection) => !collection.parentCollectionId) ?? [],
    [selectedWorkspace]
  );

  useEffect(() => {
    setCollectionFilterId(null);
    setSelectedMonthIndex(null);
  }, [workspaceFilterId]);

  useEffect(() => {
    setSelectedMonthIndex(null);
    setRangeStartTs(null);
    setRangeEndTs(null);
  }, [metricFilter, year, effectiveCollectionFilterId]);

  useEffect(() => {
    setSelectedDayTs(null);
    setSelectedMonthIndex(null);
    setRangeStartTs(null);
    setRangeEndTs(null);
  }, [rangeMode]);

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

  const countsByDay = useMemo(() => buildActivityCountsByDay(filteredEvents), [filteredEvents]);
  const maxDailyCount = useMemo(
    () => Math.max(0, ...Array.from(countsByDay.values())),
    [countsByDay]
  );
  const { weeks, monthMarkers } = useMemo(() => buildActivityHeatmapMatrix(year), [year]);
  const selectedDayEntries = useMemo(
    () => (selectedDayTs == null ? [] : buildActivityDayEntries(filteredEvents, selectedDayTs)),
    [filteredEvents, selectedDayTs]
  );
  const normalizedRange = useMemo(() => {
    if (rangeStartTs == null) return null;
    const normalizedStart = startOfActivityDay(rangeStartTs);
    const normalizedEnd = startOfActivityDay(rangeEndTs ?? rangeStartTs);
    return {
      startTs: Math.min(normalizedStart, normalizedEnd),
      endTs: Math.max(normalizedStart, normalizedEnd),
    };
  }, [rangeEndTs, rangeStartTs]);
  const selectedRangeEntries = useMemo(
    () =>
      normalizedRange == null
        ? []
        : buildActivityRangeEntries(filteredEvents, normalizedRange.startTs, normalizedRange.endTs),
    [filteredEvents, normalizedRange]
  );
  const selectedDayWorkspaceGroups = useMemo<ActivityDayWorkspaceGroup[]>(() => {
    if (effectiveWorkspaceId || selectedDayEntries.length === 0) return [];

    const grouped = new Map<
      string,
      { workspaceId: string; workspaceTitle: string; entries: ActivityDayEntry[] }
    >();

    for (const entry of selectedDayEntries) {
      const workspaceTitle =
        workspaces.find((workspace) => workspace.id === entry.workspaceId)?.title ?? "Workspace";
      const existing = grouped.get(entry.workspaceId);
      if (existing) {
        existing.entries.push(entry);
        continue;
      }
      grouped.set(entry.workspaceId, {
        workspaceId: entry.workspaceId,
        workspaceTitle,
        entries: [entry],
      });
    }

    return [...grouped.values()].sort((a, b) =>
      a.workspaceTitle.localeCompare(b.workspaceTitle)
    );
  }, [effectiveWorkspaceId, selectedDayEntries, workspaces]);
  const selectedRangeWorkspaceGroups = useMemo<ActivityRangeWorkspaceGroup[]>(() => {
    if (effectiveWorkspaceId || selectedRangeEntries.length === 0) return [];

    const workspaceMap = new Map<
      string,
      {
        workspaceId: string;
        workspaceTitle: string;
        collections: Array<{
          collectionId: string;
          collectionTitle: string;
          pathLabel: string;
          itemCount: number;
          eventCount: number;
        }>;
      }
    >();

    const collectionMap = new Map<string, { itemCount: number; eventCount: number }>();

    for (const entry of selectedRangeEntries) {
      const collectionKey = `${entry.workspaceId}:${entry.collectionId}`;
      const current = collectionMap.get(collectionKey) ?? { itemCount: 0, eventCount: 0 };
      current.itemCount += 1;
      current.eventCount += entry.createdCount + entry.updatedCount;
      collectionMap.set(collectionKey, current);
    }

    for (const [collectionKey, aggregate] of collectionMap.entries()) {
      const [workspaceId, collectionId] = collectionKey.split(":");
      const workspace = workspaces.find((candidate) => candidate.id === workspaceId);
      if (!workspace) continue;
      const collection = getCollectionById(workspace, collectionId);
      if (!collection) continue;
      const workspaceGroup =
        workspaceMap.get(workspaceId) ??
        {
          workspaceId,
          workspaceTitle: workspace.title,
          collections: [],
        };

      workspaceGroup.collections.push({
        collectionId,
        collectionTitle: collection.title,
        pathLabel: getActivityCollectionPath(workspaces, workspaceId, collectionId),
        itemCount: aggregate.itemCount,
        eventCount: aggregate.eventCount,
      });
      workspaceMap.set(workspaceId, workspaceGroup);
    }

    return [...workspaceMap.values()]
      .map((workspaceGroup) => ({
        ...workspaceGroup,
        collections: workspaceGroup.collections.sort((a, b) => a.collectionTitle.localeCompare(b.collectionTitle)),
      }))
      .sort((a, b) => a.workspaceTitle.localeCompare(b.workspaceTitle));
  }, [effectiveWorkspaceId, selectedRangeEntries, workspaces]);
  const selectedRangeCollectionGroups = useMemo<ActivityCollectionGroup[]>(() => {
    if (!effectiveWorkspaceId || collectionScope || selectedRangeEntries.length === 0) return [];
    const workspace = workspaces.find((candidate) => candidate.id === effectiveWorkspaceId);
    if (!workspace) return [];

    const collectionMap = new Map<
      string,
      { collectionId: string; collectionTitle: string; pathLabel: string; itemCount: number; eventCount: number }
    >();

    for (const entry of selectedRangeEntries) {
      const collection = getCollectionById(workspace, entry.collectionId);
      if (!collection) continue;
      const current = collectionMap.get(entry.collectionId) ?? {
        collectionId: entry.collectionId,
        collectionTitle: collection.title,
        pathLabel: getActivityCollectionPath(workspaces, effectiveWorkspaceId, entry.collectionId),
        itemCount: 0,
        eventCount: 0,
      };
      current.itemCount += 1;
      current.eventCount += entry.createdCount + entry.updatedCount;
      collectionMap.set(entry.collectionId, current);
    }

    return [...collectionMap.values()].sort((a, b) => a.collectionTitle.localeCompare(b.collectionTitle));
  }, [collectionScope, effectiveWorkspaceId, selectedRangeEntries, workspaces]);

  const dayLabel = selectedDayTs == null ? "" : formatActivityDayLabel(selectedDayTs);
  const selectedMonthLabel =
    selectedMonthIndex == null
      ? null
      : new Date(year, selectedMonthIndex, 1).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });
  const selectedMonthEventCount =
    selectedMonthIndex == null ? 0 : getMonthEventCount(filteredEvents, year, selectedMonthIndex);
  const openCollectionRange = (
    workspaceId: string,
    collectionId: string,
    startTs: number,
    endTs: number,
    label: string
  ) => {
    if (activeWorkspaceId !== workspaceId) {
      setActiveWorkspaceId(workspaceId);
    }
    navigateRoot("CollectionDetail", {
      collectionId,
      activityRangeStartTs: startTs,
      activityRangeEndTs: endTs,
      activityMetricFilter: metricFilter,
      activityLabel: label,
    });
  };
  const selectedRangeLabel =
    normalizedRange == null
      ? null
      : formatSelectedRangeLabel(normalizedRange.startTs, normalizedRange.endTs, metricFilter);
  const selectedRangeEventCount = useMemo(
    () =>
      normalizedRange == null
        ? 0
        : filteredEvents.filter(
            (event) =>
              startOfActivityDay(event.at) >= normalizedRange.startTs &&
              startOfActivityDay(event.at) <= normalizedRange.endTs
          ).length,
    [filteredEvents, normalizedRange]
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
  const activityHintText = rangeMode
    ? collectionScope
      ? "Tap a start and end day, or a month label, then show that range in ideas."
      : "Tap a start and end day, or a month label, to group matching work by workspace and collection."
    : collectionScope
      ? "Tap a month label or a day to open that range in ideas."
      : "Tap a day for details. Tap a month label to preview that month.";

  const handleRangeDayPress = (dayTs: number) => {
    const normalizedDay = startOfActivityDay(dayTs);
    setSelectedMonthIndex(null);
    setSelectedDayTs(null);

    if (rangeStartTs == null || (rangeStartTs != null && rangeEndTs != null)) {
      setRangeStartTs(normalizedDay);
      setRangeEndTs(null);
      return;
    }

    setRangeEndTs(normalizedDay);
  };

  const handleMonthPress = (month: number) => {
    if (rangeMode) {
      const monthStart = startOfActivityDay(new Date(year, month, 1).getTime());
      const monthEnd = startOfActivityDay(new Date(year, month + 1, 0).getTime());
      setSelectedDayTs(null);
      setSelectedMonthIndex(null);
      setRangeStartTs(monthStart);
      setRangeEndTs(monthEnd);
      return;
    }

    if (!collectionScope) {
      setSelectedMonthIndex(month);
      return;
    }
    const monthStart = new Date(year, month, 1).getTime();
    const monthEnd = new Date(year, month + 1, 1).getTime() - 1;
    openCollectionRange(
      collectionScopeWorkspace?.id ?? activeWorkspaceId ?? "",
      collectionScope.id,
      monthStart,
      monthEnd,
      formatMonthRangeLabel(year, month, metricFilter)
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader
        title="Activity"
        leftIcon="hamburger"
      />

      {collectionScope && collectionScopeWorkspace ? (
        <AppBreadcrumbs
          items={[
            {
              key: "home",
              label: "Home",
              level: "home",
              iconOnly: true,
              onPress: () => (navigation as any).navigate("Home", { screen: "Workspaces" }),
            },
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
              onPress: () => (navigation as any).navigate("CollectionDetail", { collectionId: collection.id }),
            })),
            {
              key: collectionScope.id,
              label: collectionScope.title,
              level: getCollectionHierarchyLevel(collectionScope),
              onPress: () => (navigation as any).navigate("CollectionDetail", { collectionId: collectionScope.id }),
            },
            {
              key: "activity",
              label: "Activity",
              level: "activity",
              active: true,
            },
          ]}
        />
      ) : (
        <AppBreadcrumbs
          items={[
            { key: "home", label: "Home", level: "home", onPress: () => (navigation as any).navigate("Home", { screen: "Workspaces" }) },
            { key: "activity", label: "Activity", level: "activity", active: true },
          ]}
        />
      )}
      <ActivityScopeControls
        collectionScopeActive={!!collectionScope}
        workspaces={workspaces}
        workspaceFilterId={workspaceFilterId}
        topLevelCollections={topLevelCollections}
        collectionFilterId={collectionFilterId}
        metricFilter={metricFilter}
        rangeMode={rangeMode}
        year={year}
        filteredEventCount={filteredEvents.length}
        legendSwatches={legendSwatches}
        hintText={activityHintText}
        onSelectWorkspace={setWorkspaceFilterId}
        onSelectCollection={setCollectionFilterId}
        onSelectMetric={setMetricFilter}
        onToggleRangeMode={() => setRangeMode((prev) => !prev)}
        onChangeYear={setYear}
      />

      <ScrollView
        style={styles.flexFill}
        contentContainerStyle={styles.activityScreenContent}
        showsVerticalScrollIndicator={false}
      >
        <ActivityHeatmapGrid
          year={year}
          monthMarkers={monthMarkers}
          weeks={weeks}
          countsByDay={countsByDay}
          maxDailyCount={maxDailyCount}
          rangeMode={rangeMode}
          normalizedRange={normalizedRange}
          onPressMonth={handleMonthPress}
          onPressDay={(dayTs) => {
            if (rangeMode) {
              handleRangeDayPress(dayTs);
              return;
            }
            setSelectedDayTs(startOfActivityDay(dayTs));
          }}
        />

        <ActivityRangeResults
          selectedMonthLabel={selectedMonthLabel}
          selectedMonthEventCount={selectedMonthEventCount}
          normalizedRange={normalizedRange}
          selectedRangeLabel={selectedRangeLabel}
          selectedRangeEntryCount={selectedRangeEntries.length}
          selectedRangeEventCount={selectedRangeEventCount}
          collectionScopeActive={!!collectionScope}
          selectedRangeWorkspaceGroups={!effectiveWorkspaceId ? selectedRangeWorkspaceGroups : []}
          selectedRangeCollectionGroups={effectiveWorkspaceId ? selectedRangeCollectionGroups : []}
          onClearRange={() => {
            setRangeStartTs(null);
            setRangeEndTs(null);
          }}
          onOpenScopedRange={() => {
            if (!collectionScope || !normalizedRange || !selectedRangeLabel) return;
            openCollectionRange(
              collectionScopeWorkspace?.id ?? activeWorkspaceId ?? "",
              collectionScope.id,
              normalizedRange.startTs,
              normalizedRange.endTs + 24 * 60 * 60 * 1000 - 1,
              selectedRangeLabel
            );
          }}
          onOpenWorkspaceCollectionRange={(workspaceId, collectionId, label) => {
            if (!normalizedRange) return;
            openCollectionRange(
              workspaceId,
              collectionId,
              normalizedRange.startTs,
              normalizedRange.endTs + 24 * 60 * 60 * 1000 - 1,
              label
            );
          }}
          onOpenCollectionRange={(collectionId, label) => {
            if (!effectiveWorkspaceId || !normalizedRange) return;
            openCollectionRange(
              effectiveWorkspaceId,
              collectionId,
              normalizedRange.startTs,
              normalizedRange.endTs + 24 * 60 * 60 * 1000 - 1,
              label
            );
          }}
        />
      </ScrollView>

      <ActivityDayDetailModal
        visible={!rangeMode && selectedDayTs != null}
        dayLabel={dayLabel}
        selectedDayTs={selectedDayTs}
        metricFilter={metricFilter}
        selectedDayEntries={selectedDayEntries}
        effectiveWorkspaceId={effectiveWorkspaceId}
        selectedDayWorkspaceGroups={selectedDayWorkspaceGroups}
        workspaces={workspaces}
        showScopedIdeasAction={!!collectionScope}
        onClose={() => setSelectedDayTs(null)}
        onOpenIdea={(entry) => {
          setSelectedDayTs(null);
          if (activeWorkspaceId !== entry.workspaceId) {
            setActiveWorkspaceId(entry.workspaceId);
          }
          setSelectedIdeaId(entry.ideaId);
          navigateRoot("IdeaDetail", { ideaId: entry.ideaId });
        }}
        onShowScopedIdeas={(startTs, endTs, label) => {
          if (!collectionScope) return;
          setSelectedDayTs(null);
          openCollectionRange(
            collectionScopeWorkspace?.id ?? activeWorkspaceId ?? "",
            collectionScope.id,
            startTs,
            endTs,
            label
          );
        }}
      />
    </SafeAreaView>
  );
}
