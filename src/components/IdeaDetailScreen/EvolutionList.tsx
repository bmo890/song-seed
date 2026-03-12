import React, { ReactNode, useEffect, useMemo, useRef } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { styles } from "../../styles";
import { buildEvolutionListRows, type EvolutionListRow, type TimelineClipEntry } from "../../clipGraph";
import { ClipCard, type ClipCardSharedProps } from "./ClipCard";
import { IdeasHeader } from "./IdeasHeader";
import { PrimaryTakeSection } from "./PrimaryTakeSection";
import { type SongTimelineSortDirection, type SongTimelineSortMetric } from "../../clipGraph";
import { type SongClipTagFilter } from "./songClipControls";

type EvolutionListProps = {
  clips: TimelineClipEntry["clip"][];
  expandedLineageIds: Record<string, boolean>;
  setExpandedLineageIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  summaryContent?: ReactNode;
  footerSpacerHeight: number;
  primaryEntry: TimelineClipEntry | null;
  clipCardProps: ClipCardSharedProps;
  isEditMode: boolean;
  viewMode: "timeline" | "evolution";
  setViewMode: (mode: "timeline" | "evolution") => void;
  timelineSortMetric: SongTimelineSortMetric;
  setTimelineSortMetric: (metric: SongTimelineSortMetric) => void;
  timelineSortDirection: SongTimelineSortDirection;
  setTimelineSortDirection: (direction: SongTimelineSortDirection) => void;
  timelineMainTakesOnly: boolean;
  setTimelineMainTakesOnly: (value: boolean) => void;
  clipTagFilter: SongClipTagFilter;
  setClipTagFilter: (filter: SongClipTagFilter) => void;
  isParentPicking: boolean;
  visibleIdeaCount: number;
  onIdeasStickyChange?: (isSticky: boolean) => void;
};

type EvolutionRenderRow =
  | { kind: "summary-section" }
  | { kind: "primary-section" }
  | { kind: "ideas-header" }
  | { kind: "empty" }
  | EvolutionListRow;

function EvolutionMoreRow({
  lineageRootId,
  hiddenCount,
  expanded,
  onToggle,
}: {
  lineageRootId: string;
  hiddenCount: number;
  expanded: boolean;
  onToggle: (lineageRootId: string) => void;
}) {
  return (
    <View style={styles.threadRowWrap}>
      <View style={styles.selectionIndicatorCol} />
      <View style={styles.songDetailEvolutionMoreGuide}>
        <View style={styles.songDetailEvolutionMoreStem} />
        <View style={styles.songDetailEvolutionElbow}>
          <View style={styles.songDetailEvolutionDot} />
        </View>
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.songDetailEvolutionMoreButtonWrap,
          pressed ? styles.pressDown : null,
        ]}
        onPress={() => onToggle(lineageRootId)}
      >
        <View style={styles.songDetailEvolutionMoreButton}>
          <Text style={styles.songDetailEvolutionMoreButtonText}>
            {expanded ? "Hide middle takes" : `${hiddenCount} more`}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

export function EvolutionList({
  clips,
  expandedLineageIds,
  setExpandedLineageIds,
  summaryContent,
  footerSpacerHeight,
  primaryEntry,
  clipCardProps,
  isEditMode,
  viewMode,
  setViewMode,
  timelineSortMetric,
  setTimelineSortMetric,
  timelineSortDirection,
  setTimelineSortDirection,
  timelineMainTakesOnly,
  setTimelineMainTakesOnly,
  clipTagFilter,
  setClipTagFilter,
  isParentPicking,
  visibleIdeaCount,
  onIdeasStickyChange,
}: EvolutionListProps) {
  const contentRows = useMemo(
    () => buildEvolutionListRows(clips, expandedLineageIds),
    [clips, expandedLineageIds]
  );

  const listRows = useMemo<EvolutionRenderRow[]>(() => {
    const rows: EvolutionRenderRow[] = [];
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
    ({ viewableItems }: { viewableItems: Array<{ item: EvolutionRenderRow | null }> }) => {
      if (!onIdeasStickyChange) return;
      const visibleKinds = new Set(
        viewableItems
          .map((token) => token.item?.kind)
          .filter((kind): kind is EvolutionRenderRow["kind"] => !!kind)
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
        if (row.kind === "clip") return `evolution-clip:${row.entry.clip.id}:${index}`;
        if (row.kind === "more") return `evolution-more:${row.lineageRootId}`;
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

        if (item.kind === "empty") {
          return <Text style={styles.emptyText}>{primaryEntry ? "No idea clips yet." : "No clips yet."}</Text>;
        }

        if (item.kind === "more") {
          return (
            <EvolutionMoreRow
              lineageRootId={item.lineageRootId}
              hiddenCount={item.hiddenCount}
              expanded={item.expanded}
              onToggle={(lineageRootId) =>
                setExpandedLineageIds((prev) => ({
                  ...prev,
                  [lineageRootId]: !prev[lineageRootId],
                }))
              }
            />
          );
        }

        return <ClipCard entry={item.entry} {...clipCardProps} />;
      }}
    />
  );
}
