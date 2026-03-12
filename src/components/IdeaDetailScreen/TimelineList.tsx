import React, { ReactNode, useEffect, useMemo, useRef } from "react";
import { FlatList, Text, View } from "react-native";
import { styles } from "../../styles";
import { buildTimelineListRows, type TimelineClipEntry, type TimelineListRow } from "../../clipGraph";
import { ClipCard, type ClipCardSharedProps } from "./ClipCard";
import { IdeasHeader } from "./IdeasHeader";
import { PrimaryTakeSection } from "./PrimaryTakeSection";
import { type SongTimelineSortDirection, type SongTimelineSortMetric } from "../../clipGraph";
import { type SongClipTagFilter } from "./songClipControls";

type TimelineListProps = {
  clips: TimelineClipEntry["clip"][];
  summaryContent?: ReactNode;
  footerSpacerHeight: number;
  primaryEntry: TimelineClipEntry | null;
  clipCardProps: ClipCardSharedProps;
  timelineSortMetric: SongTimelineSortMetric;
  timelineSortDirection: SongTimelineSortDirection;
  timelineMainTakesOnly: boolean;
  isEditMode: boolean;
  viewMode: "timeline" | "evolution";
  setViewMode: (mode: "timeline" | "evolution") => void;
  setTimelineSortMetric: (metric: SongTimelineSortMetric) => void;
  setTimelineSortDirection: (direction: SongTimelineSortDirection) => void;
  setTimelineMainTakesOnly: (value: boolean) => void;
  clipTagFilter: SongClipTagFilter;
  setClipTagFilter: (filter: SongClipTagFilter) => void;
  isParentPicking: boolean;
  visibleIdeaCount: number;
  onIdeasStickyChange?: (isSticky: boolean) => void;
};

type TimelineRenderRow =
  | { kind: "summary-section" }
  | { kind: "primary-section" }
  | { kind: "ideas-header" }
  | { kind: "empty" }
  | TimelineListRow;

export function TimelineList({
  clips,
  summaryContent,
  footerSpacerHeight,
  primaryEntry,
  clipCardProps,
  timelineSortMetric,
  timelineSortDirection,
  timelineMainTakesOnly,
  isEditMode,
  viewMode,
  setViewMode,
  setTimelineSortMetric,
  setTimelineSortDirection,
  setTimelineMainTakesOnly,
  clipTagFilter,
  setClipTagFilter,
  isParentPicking,
  visibleIdeaCount,
  onIdeasStickyChange,
}: TimelineListProps) {
  const contentRows = useMemo(
    () =>
      buildTimelineListRows(clips, {
        metric: timelineSortMetric,
        direction: timelineSortDirection,
        mainTakesOnly: timelineMainTakesOnly,
      }),
    [clips, timelineMainTakesOnly, timelineSortDirection, timelineSortMetric]
  );

  const listRows = useMemo<TimelineRenderRow[]>(() => {
    const rows: TimelineRenderRow[] = [];
    if (summaryContent) rows.push({ kind: "summary-section" });
    if (primaryEntry) rows.push({ kind: "primary-section" });
    rows.push({ kind: "ideas-header" });
    if (contentRows.length === 0) {
      rows.push({ kind: "empty" });
      return rows;
    }
    rows.push(...contentRows);
    return rows;
  }, [contentRows, primaryEntry, summaryContent]);

  const stickyIdeasIndex = useMemo(() => {
    let index = 0;
    if (summaryContent) index += 1;
    if (primaryEntry) index += 1;
    return index;
  }, [primaryEntry, summaryContent]);

  const viewableItemsChangedRef = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: TimelineRenderRow | null }> }) => {
      if (!onIdeasStickyChange) return;
      const visibleKinds = new Set(
        viewableItems
          .map((token) => token.item?.kind)
          .filter((kind): kind is TimelineRenderRow["kind"] => !!kind)
      );
      const isSticky =
        visibleKinds.has("ideas-header") &&
        !visibleKinds.has("summary-section") &&
        !visibleKinds.has("primary-section");
      onIdeasStickyChange(isSticky);
    }
  );

  useEffect(() => {
    if (!onIdeasStickyChange) return;
    onIdeasStickyChange(false);
    return () => {
      onIdeasStickyChange(false);
    };
  }, [onIdeasStickyChange]);

  return (
    <FlatList
      data={listRows}
      stickyHeaderIndices={[stickyIdeasIndex]}
      onViewableItemsChanged={viewableItemsChangedRef.current}
      viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
      keyExtractor={(row, index) => {
        if (row.kind === "clip") return `timeline-clip:${row.entry.clip.id}:${index}`;
        if (row.kind === "day-divider") return `day-divider:${row.dayStartTs}`;
        return `${row.kind}-${index}`;
      }}
      style={styles.songDetailClipList}
      contentContainerStyle={styles.songDetailClipListContent}
      ListFooterComponent={<View style={{ height: footerSpacerHeight }} />}
      renderItem={({ item }) => {
        if (item.kind === "summary-section") {
          return summaryContent ? (
            <View style={styles.songDetailClipSummarySection}>{summaryContent}</View>
          ) : null;
        }

        if (item.kind === "primary-section") {
          return <PrimaryTakeSection entry={primaryEntry} clipCardProps={clipCardProps} />;
        }

        if (item.kind === "ideas-header") {
          return (
            <IdeasHeader
              isParentPicking={isParentPicking}
              isEditMode={isEditMode}
              viewMode={viewMode}
              setViewMode={setViewMode}
              timelineSortMetric={timelineSortMetric}
              setTimelineSortMetric={setTimelineSortMetric}
              timelineSortDirection={timelineSortDirection}
              setTimelineSortDirection={setTimelineSortDirection}
              timelineMainTakesOnly={timelineMainTakesOnly}
              setTimelineMainTakesOnly={setTimelineMainTakesOnly}
              clipTagFilter={clipTagFilter}
              setClipTagFilter={setClipTagFilter}
              visibleIdeaCount={visibleIdeaCount}
            />
          );
        }

        if (item.kind === "day-divider") {
          return (
            <View style={styles.songDetailTimelineDividerWrap}>
              <View style={styles.ideasDayDividerRow}>
                <View style={styles.ideasDayDividerLine} />
                <Text style={styles.ideasDayDividerText}>{item.label}</Text>
                <View style={styles.ideasDayDividerLine} />
              </View>
            </View>
          );
        }

        if (item.kind === "empty") {
          return <Text style={styles.emptyText}>{primaryEntry ? "No idea clips yet." : "No clips yet."}</Text>;
        }

        return <ClipCard entry={item.entry} {...clipCardProps} />;
      }}
    />
  );
}
