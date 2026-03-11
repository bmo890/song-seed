import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
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
import { getCollectionHierarchyLevel, getHierarchyIconColor, getHierarchyIconName } from "../../hierarchy";

const CELL_SIZE = 14;
const CELL_GAP = 4;
const CELL_STRIDE = CELL_SIZE + CELL_GAP;

function getActivityCellBackground(count: number, maxCount: number, inYear: boolean) {
  if (!inYear) return "#edf2f7";
  if (count <= 0) return "#ffffff";
  if (maxCount <= 1) return "#93c5fd";

  const ratio = count / maxCount;
  if (ratio >= 0.8) return "#1e3a8a";
  if (ratio >= 0.55) return "#2563eb";
  if (ratio >= 0.3) return "#60a5fa";
  return "#93c5fd";
}

function formatEntryMetrics(entry: ActivityDayEntry) {
  const parts: string[] = [];
  if (entry.createdCount > 0) {
    parts.push(`${entry.createdCount} created`);
  }
  if (entry.updatedCount > 0) {
    parts.push(`${entry.updatedCount} updated`);
  }
  return parts.join(" • ");
}

function formatMonthRangeLabel(year: number, month: number, metric: ActivityMetricFilter) {
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  if (metric === "both") return monthLabel;
  return `${monthLabel} • ${metric === "created" ? "Created" : "Updated"}`;
}

function formatDayRangeLabel(ts: number, metric: ActivityMetricFilter) {
  const label = formatActivityDayLabel(ts);
  if (metric === "both") return label;
  return `${label} • ${metric === "created" ? "Created" : "Updated"}`;
}

function formatActivityDateLabel(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatSelectedRangeLabel(startTs: number, endTs: number, metric: ActivityMetricFilter) {
  const startLabel = formatActivityDateLabel(startTs);
  const endLabel = formatActivityDateLabel(endTs);
  const base = startTs === endTs ? startLabel : `${startLabel} – ${endLabel}`;
  if (metric === "both") return base;
  return `${base} • ${metric === "created" ? "Created" : "Updated"}`;
}

function getMonthEventCount(events: ReturnType<typeof filterActivityEvents>, year: number, month: number) {
  const start = new Date(year, month, 1).getTime();
  const end = new Date(year, month + 1, 1).getTime();
  return events.filter((event) => event.at >= start && event.at < end).length;
}

export function ActivityScreen() {
  const navigation = useNavigation();
  const rootNavigation = (navigation as any).getParent?.();
  const navigateRoot = (routeName: string, params?: object) =>
    (rootNavigation ?? navigation).navigate(routeName as never, params as never);
  const route = useRoute<any>();
  const routeParams = route.params ?? {};
  const scopedCollectionId = routeParams.collectionId as string | undefined;
  const scopedWorkspaceId = routeParams.workspaceId as string | undefined;
  const isDrawerActivity = route.name === "ActivityHome";

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
  const selectedDayWorkspaceGroups = useMemo(() => {
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
  const selectedRangeWorkspaceGroups = useMemo(() => {
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
  const selectedRangeCollectionGroups = useMemo(() => {
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

      {!collectionScope ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activityChipScroll}
            style={styles.activityChipRow}
          >
            <Pressable
              style={({ pressed }) => [
                styles.activityFilterChip,
                workspaceFilterId == null ? styles.activityFilterChipActive : null,
                pressed ? styles.pressDown : null,
              ]}
              onPress={() => setWorkspaceFilterId(null)}
            >
              <Text
                style={[
                  styles.activityFilterChipText,
                  workspaceFilterId == null ? styles.activityFilterChipTextActive : null,
                ]}
              >
                All workspaces
              </Text>
            </Pressable>
            {workspaces.map((workspace) => (
              <Pressable
                key={workspace.id}
                style={({ pressed }) => [
                  styles.activityFilterChip,
                  workspaceFilterId === workspace.id ? styles.activityFilterChipActive : null,
                  pressed ? styles.pressDown : null,
                ]}
                onPress={() => setWorkspaceFilterId(workspace.id)}
              >
                <Text
                  style={[
                    styles.activityFilterChipText,
                    workspaceFilterId === workspace.id ? styles.activityFilterChipTextActive : null,
                  ]}
                >
                  {workspace.title}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {workspaceFilterId && topLevelCollections.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.activityChipScroll}
              style={styles.activityChipRow}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.activityFilterChip,
                  collectionFilterId == null ? styles.activityFilterChipActive : null,
                  pressed ? styles.pressDown : null,
                ]}
                onPress={() => setCollectionFilterId(null)}
              >
                <Text
                  style={[
                    styles.activityFilterChipText,
                    collectionFilterId == null ? styles.activityFilterChipTextActive : null,
                  ]}
                >
                  All collections
                </Text>
              </Pressable>
              {topLevelCollections.map((collection) => (
                <Pressable
                  key={collection.id}
                  style={({ pressed }) => [
                    styles.activityFilterChip,
                    collectionFilterId === collection.id ? styles.activityFilterChipActive : null,
                    pressed ? styles.pressDown : null,
                  ]}
                  onPress={() => setCollectionFilterId(collection.id)}
                >
                  <Text
                    style={[
                      styles.activityFilterChipText,
                      collectionFilterId === collection.id ? styles.activityFilterChipTextActive : null,
                    ]}
                  >
                    {collection.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </>
      ) : null}

      <View style={styles.activityControlsRow}>
        <View style={styles.activitySegmentWrap}>
          {(["created", "updated", "both"] as const).map((metric) => (
            <Pressable
              key={metric}
              style={({ pressed }) => [
                styles.activitySegmentBtn,
                metricFilter === metric ? styles.activitySegmentBtnActive : null,
                pressed ? styles.pressDown : null,
              ]}
              onPress={() => setMetricFilter(metric)}
            >
              <Text
                style={[
                  styles.activitySegmentText,
                  metricFilter === metric ? styles.activitySegmentTextActive : null,
                ]}
              >
                {metric === "both" ? "Both" : metric === "created" ? "Created" : "Updated"}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={({ pressed }) => [
              styles.activitySegmentBtn,
              rangeMode ? styles.activitySegmentBtnActive : null,
              pressed ? styles.pressDown : null,
            ]}
            onPress={() => setRangeMode((prev) => !prev)}
          >
            <Text
              style={[
                styles.activitySegmentText,
                rangeMode ? styles.activitySegmentTextActive : null,
              ]}
            >
              Range
            </Text>
          </Pressable>
        </View>

        <View style={styles.activityYearControls}>
          <Pressable
            style={({ pressed }) => [styles.activityYearBtn, pressed ? styles.pressDown : null]}
            onPress={() => setYear((prev) => prev - 1)}
          >
            <Ionicons name="chevron-back" size={14} color="#334155" />
          </Pressable>
          <Text style={styles.activityYearText}>{year}</Text>
          <Pressable
            style={({ pressed }) => [styles.activityYearBtn, pressed ? styles.pressDown : null]}
            onPress={() => setYear((prev) => prev + 1)}
          >
            <Ionicons name="chevron-forward" size={14} color="#334155" />
          </Pressable>
        </View>
      </View>

      <View style={styles.activitySummaryRow}>
        <Text style={styles.activitySummaryText}>
          {filteredEvents.length} {filteredEvents.length === 1 ? "event" : "events"} in {year}
        </Text>
        <View style={styles.activityLegendRow}>
          <Text style={styles.activityLegendLabel}>Less</Text>
          {[0.25, 0.5, 0.75, 1].map((ratio, index) => (
            <View
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              style={[
                styles.activityLegendSwatch,
                { backgroundColor: getActivityCellBackground(Math.max(1, Math.round(maxDailyCount * ratio)), Math.max(1, maxDailyCount), true) },
              ]}
            />
          ))}
          <Text style={styles.activityLegendLabel}>More</Text>
        </View>
      </View>

      <Text style={styles.activityHintText}>
        {rangeMode
          ? collectionScope
            ? "Tap a start and end day, or a month label, then show that range in ideas."
            : "Tap a start and end day, or a month label, to group matching work by workspace and collection."
          : collectionScope
            ? "Tap a month label or a day to open that range in ideas."
            : "Tap a day for details. Tap a month label to preview that month."}
      </Text>

      <ScrollView
        style={styles.flexFill}
        contentContainerStyle={styles.activityScreenContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.activityCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.activityHeatmapContent}>
              <View style={styles.activityMonthRow}>
                {monthMarkers.map((marker) => (
                  <Pressable
                    key={`${marker.month}-${marker.weekIndex}`}
                    style={({ pressed }) => [
                      styles.activityMonthPressable,
                      { marginLeft: marker.weekIndex === 0 ? 0 : marker.weekIndex * CELL_STRIDE - 24 },
                      pressed ? styles.pressDown : null,
                    ]}
                    onPress={() => {
                      handleMonthPress(marker.month);
                    }}
                  >
                    <Text style={styles.activityMonthLabel}>{marker.label}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.activityGridRow}>
                <View style={styles.activityWeekdayLabels}>
                  {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
                    <Text key={`${label}-${index}`} style={styles.activityWeekdayLabel}>
                      {label}
                    </Text>
                  ))}
                </View>

                <View style={styles.activityWeeksWrap}>
                  {weeks.map((week, weekIndex) => (
                    <View key={`${year}-week-${weekIndex}`} style={styles.activityWeekColumn}>
                      {week.map((dayTs) => {
                        const inYear = new Date(dayTs).getFullYear() === year;
                        const count = countsByDay.get(startOfActivityDay(dayTs)) ?? 0;
                        const backgroundColor = getActivityCellBackground(count, maxDailyCount, inYear);
                        return (
                          <Pressable
                            key={dayTs}
                            style={({ pressed }) => [
                              styles.activityDayCell,
                              { backgroundColor, width: CELL_SIZE, height: CELL_SIZE },
                              normalizedRange &&
                              startOfActivityDay(dayTs) >= normalizedRange.startTs &&
                              startOfActivityDay(dayTs) <= normalizedRange.endTs
                                ? styles.activityDayCellRangeSelected
                                : null,
                              pressed && inYear ? styles.activityDayCellPressed : null,
                            ]}
                            onPress={() => {
                              if (!inYear) return;
                              if (rangeMode) {
                                handleRangeDayPress(dayTs);
                                return;
                              }
                              setSelectedDayTs(startOfActivityDay(dayTs));
                            }}
                          />
                        );
                      })}
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </ScrollView>
        </View>

        {selectedMonthLabel ? (
          <View style={styles.activityMonthSummaryCard}>
            <View style={styles.activityMonthSummaryCopy}>
              <Ionicons name="calendar-outline" size={15} color="#475569" />
              <Text style={styles.activityMonthSummaryTitle}>{selectedMonthLabel}</Text>
            </View>
            <Text style={styles.activityMonthSummaryMeta}>
              {selectedMonthEventCount} {selectedMonthEventCount === 1 ? "event" : "events"}
            </Text>
          </View>
        ) : null}

        {normalizedRange && selectedRangeLabel ? (
          <View style={styles.activityRangeSummaryCard}>
            <View style={styles.activityRangeSummaryHeader}>
              <View style={styles.activityRangeSummaryCopy}>
                <Ionicons name="calendar-outline" size={15} color="#475569" />
                <Text style={styles.activityRangeSummaryTitle}>{selectedRangeLabel}</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.activityRangeSummaryClear, pressed ? styles.pressDown : null]}
                onPress={() => {
                  setRangeStartTs(null);
                  setRangeEndTs(null);
                }}
              >
                <Ionicons name="close" size={14} color="#64748b" />
              </Pressable>
            </View>
            <Text style={styles.activityRangeSummaryMeta}>
              {selectedRangeEntries.length} {selectedRangeEntries.length === 1 ? "item" : "items"} •{" "}
              {filteredEvents.filter(
                (event) =>
                  startOfActivityDay(event.at) >= normalizedRange.startTs &&
                  startOfActivityDay(event.at) <= normalizedRange.endTs
              ).length}{" "}
              events
            </Text>

            {collectionScope ? (
              <View style={styles.activityRangeScopedActions}>
                <Pressable
                  style={({ pressed }) => [styles.ideasHeaderSelectBtn, styles.activityDayOpenBtn, pressed ? styles.pressDown : null]}
                  onPress={() =>
                    openCollectionRange(
                      collectionScopeWorkspace?.id ?? activeWorkspaceId ?? "",
                      collectionScope.id,
                      normalizedRange.startTs,
                      normalizedRange.endTs + 24 * 60 * 60 * 1000 - 1,
                      selectedRangeLabel
                    )
                  }
                >
                  <Text style={styles.ideasHeaderSelectBtnText}>Show in ideas</Text>
                </Pressable>
              </View>
            ) : !effectiveWorkspaceId ? (
              <View style={styles.activityRangeWorkspaceGroupList}>
                {selectedRangeWorkspaceGroups.map((workspaceGroup) => (
                  <View key={workspaceGroup.workspaceId} style={styles.activityDayWorkspaceGroup}>
                    <Text style={styles.activityDayWorkspaceTitle}>{workspaceGroup.workspaceTitle}</Text>
                    <View style={styles.activityRangeCollectionList}>
                      {workspaceGroup.collections.map((collectionGroup) => (
                        <View key={`${workspaceGroup.workspaceId}:${collectionGroup.collectionId}`} style={styles.activityRangeCollectionCard}>
                          <View style={styles.activityRangeCollectionCopy}>
                            <Text style={styles.activityRangeCollectionTitle}>{collectionGroup.collectionTitle}</Text>
                            <Text style={styles.activityRangeCollectionMeta} numberOfLines={2}>
                              {collectionGroup.pathLabel}
                            </Text>
                          </View>
                          <View style={styles.activityRangeCollectionActions}>
                            <Text style={styles.activityRangeCollectionCount}>
                              {collectionGroup.itemCount} {collectionGroup.itemCount === 1 ? "item" : "items"}
                            </Text>
                            <Pressable
                              style={({ pressed }) => [styles.activityRangeOpenBtn, pressed ? styles.pressDown : null]}
                              onPress={() =>
                                openCollectionRange(
                                  workspaceGroup.workspaceId,
                                  collectionGroup.collectionId,
                                  normalizedRange.startTs,
                                  normalizedRange.endTs + 24 * 60 * 60 * 1000 - 1,
                                  selectedRangeLabel
                                )
                              }
                            >
                              <Text style={styles.activityRangeOpenBtnText}>Open ideas</Text>
                            </Pressable>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.activityRangeCollectionList}>
                {selectedRangeCollectionGroups.map((collectionGroup) => (
                  <View key={collectionGroup.collectionId} style={styles.activityRangeCollectionCard}>
                    <View style={styles.activityRangeCollectionCopy}>
                      <Text style={styles.activityRangeCollectionTitle}>{collectionGroup.collectionTitle}</Text>
                      <Text style={styles.activityRangeCollectionMeta} numberOfLines={2}>
                        {collectionGroup.pathLabel}
                      </Text>
                    </View>
                    <View style={styles.activityRangeCollectionActions}>
                      <Text style={styles.activityRangeCollectionCount}>
                        {collectionGroup.itemCount} {collectionGroup.itemCount === 1 ? "item" : "items"}
                      </Text>
                      <Pressable
                        style={({ pressed }) => [styles.activityRangeOpenBtn, pressed ? styles.pressDown : null]}
                        onPress={() =>
                          openCollectionRange(
                            effectiveWorkspaceId,
                            collectionGroup.collectionId,
                            normalizedRange.startTs,
                            normalizedRange.endTs + 24 * 60 * 60 * 1000 - 1,
                            selectedRangeLabel
                          )
                        }
                      >
                        <Text style={styles.activityRangeOpenBtnText}>Open ideas</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={!rangeMode && selectedDayTs != null} transparent animationType="fade" onRequestClose={() => setSelectedDayTs(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedDayTs(null)}>
          <Pressable style={[styles.modalCard, styles.activityDayModalCard]} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>{dayLabel}</Text>
            <Text style={styles.subtitle}>
              {selectedDayEntries.length} {selectedDayEntries.length === 1 ? "item" : "items"}
            </Text>

            <ScrollView style={styles.activityDayEntryScroll} showsVerticalScrollIndicator={false}>
              {!effectiveWorkspaceId ? (
                <View style={styles.activityDayWorkspaceGroupList}>
                  {selectedDayWorkspaceGroups.map((group) => (
                    <View key={group.workspaceId} style={styles.activityDayWorkspaceGroup}>
                      <Text style={styles.activityDayWorkspaceTitle}>{group.workspaceTitle}</Text>
                      <View style={styles.activityDayEntryList}>
                        {group.entries.map((entry) => (
                          <Pressable
                            key={`${entry.workspaceId}:${entry.ideaId}`}
                            style={({ pressed }) => [styles.activityDayEntryCard, pressed ? styles.pressDown : null]}
                            onPress={() => {
                              setSelectedDayTs(null);
                              if (activeWorkspaceId !== entry.workspaceId) {
                                setActiveWorkspaceId(entry.workspaceId);
                              }
                              setSelectedIdeaId(entry.ideaId);
                              navigateRoot("IdeaDetail", { ideaId: entry.ideaId });
                            }}
                          >
                            <View style={styles.activityDayEntryTop}>
                              <View style={styles.activityDayEntryTitleWrap}>
                                <Ionicons
                                  name={getHierarchyIconName(entry.ideaKind === "song" ? "song" : "clip")}
                                  size={15}
                                  color={getHierarchyIconColor(entry.ideaKind === "song" ? "song" : "clip")}
                                />
                                <Text style={styles.activityDayEntryTitle} numberOfLines={2}>
                                  {entry.ideaTitle}
                                </Text>
                              </View>
                              <Text style={styles.activityDayEntryMetric}>{formatEntryMetrics(entry)}</Text>
                            </View>
                            <Text style={styles.activityDayEntryMeta} numberOfLines={2}>
                              {getActivityCollectionPath(workspaces, entry.workspaceId, entry.collectionId)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.activityDayEntryList}>
                  {selectedDayEntries.map((entry) => (
                    <Pressable
                      key={`${entry.workspaceId}:${entry.ideaId}`}
                      style={({ pressed }) => [styles.activityDayEntryCard, pressed ? styles.pressDown : null]}
                      onPress={() => {
                        setSelectedDayTs(null);
                        if (activeWorkspaceId !== entry.workspaceId) {
                          setActiveWorkspaceId(entry.workspaceId);
                        }
                        setSelectedIdeaId(entry.ideaId);
                        navigateRoot("IdeaDetail", { ideaId: entry.ideaId });
                      }}
                    >
                      <View style={styles.activityDayEntryTop}>
                        <View style={styles.activityDayEntryTitleWrap}>
                          <Ionicons
                            name={getHierarchyIconName(entry.ideaKind === "song" ? "song" : "clip")}
                            size={15}
                            color={getHierarchyIconColor(entry.ideaKind === "song" ? "song" : "clip")}
                          />
                          <Text style={styles.activityDayEntryTitle} numberOfLines={2}>
                            {entry.ideaTitle}
                          </Text>
                        </View>
                        <Text style={styles.activityDayEntryMetric}>{formatEntryMetrics(entry)}</Text>
                      </View>
                      <Text style={styles.activityDayEntryMeta} numberOfLines={2}>
                        {getActivityCollectionPath(workspaces, entry.workspaceId, entry.collectionId)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </ScrollView>

            <View style={styles.activityDayModalActions}>
              {collectionScope && selectedDayTs != null ? (
                <Pressable
                  style={({ pressed }) => [styles.ideasHeaderSelectBtn, styles.activityDayOpenBtn, pressed ? styles.pressDown : null]}
                  onPress={() => {
                    const dayStart = startOfActivityDay(selectedDayTs);
                    const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
                    setSelectedDayTs(null);
                    openCollectionRange(
                      collectionScopeWorkspace?.id ?? activeWorkspaceId ?? "",
                      collectionScope.id,
                      dayStart,
                      dayEnd,
                      formatDayRangeLabel(dayStart, metricFilter)
                    );
                  }}
                >
                  <Text style={styles.ideasHeaderSelectBtnText}>Show in ideas</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, styles.activityDayCloseBtn, pressed ? styles.pressDown : null]}
                onPress={() => setSelectedDayTs(null)}
              >
                <Text style={styles.primaryBtnText}>Close</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
