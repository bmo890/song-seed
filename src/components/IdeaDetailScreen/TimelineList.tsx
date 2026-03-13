import React, { ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, Text, View } from "react-native";
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

  const flatListRef = useRef<FlatList<TimelineListRow>>(null);
  const isStickyRef = useRef(false);
  const scrollYRef = useRef(0);
  const summaryHeightRef = useRef(0);
  const primaryHeightRef = useRef(0);
  const isSnappingRef = useRef(false);

  const getSnapY = useCallback(
    () => summaryHeightRef.current + primaryHeightRef.current,
    []
  );

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      scrollYRef.current = y;
      if (!onIdeasStickyChange) return;
      if (!isStickyRef.current && y > 40) {
        isStickyRef.current = true;
        onIdeasStickyChange(true);
      } else if (isStickyRef.current && y < 0) {
        // iOS overscroll past top → expand immediately
        isStickyRef.current = false;
        isSnappingRef.current = false;
        onIdeasStickyChange(false);
      }
    },
    [onIdeasStickyChange]
  );

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      scrollYRef.current = y;
      const snapY = getSnapY();
      // If momentum carried past the ideas-header snap point, bounce back to it
      if (isStickyRef.current && snapY > 0 && y < snapY - 4) {
        isSnappingRef.current = true;
        flatListRef.current?.scrollToOffset({ offset: snapY, animated: true });
      } else {
        isSnappingRef.current = false;
      }
    },
    [getSnapY]
  );

  const handleScrollBeginDrag = useCallback(() => {
    // If a programmatic snap is still in flight, cancel the expand — user hasn't done the second swipe yet
    if (isSnappingRef.current) {
      isSnappingRef.current = false;
      return;
    }
    // New gesture from at/above the snap point → expand header
    const snapY = getSnapY();
    const threshold = snapY > 0 ? snapY + 6 : 1;
    if (onIdeasStickyChange && isStickyRef.current && scrollYRef.current <= threshold) {
      isStickyRef.current = false;
      onIdeasStickyChange(false);
    }
  }, [onIdeasStickyChange, getSnapY]);

  useEffect(() => {
    if (!onIdeasStickyChange) return;
    isStickyRef.current = false;
    scrollYRef.current = 0;
    onIdeasStickyChange(false);
    return () => {
      isStickyRef.current = false;
      scrollYRef.current = 0;
      onIdeasStickyChange(false);
    };
  }, [onIdeasStickyChange]);

  return (
    <FlatList
      data={listRows}
      stickyHeaderIndices={[stickyIdeasIndex]}
      ref={flatListRef}
      onScroll={handleScroll}
      onScrollBeginDrag={handleScrollBeginDrag}
      onMomentumScrollEnd={handleMomentumScrollEnd}
      scrollEventThrottle={16}
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
            <View
              style={styles.songDetailClipSummarySection}
              onLayout={(e) => { summaryHeightRef.current = e.nativeEvent.layout.height; }}
            >
              {summaryContent}
            </View>
          ) : null;
        }

        if (item.kind === "primary-section") {
          return (
            <View onLayout={(e) => { primaryHeightRef.current = e.nativeEvent.layout.height; }}>
              <PrimaryTakeSection entry={primaryEntry} clipCardProps={clipCardProps} />
            </View>
          );
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
