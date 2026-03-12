import React from "react";
import { Text, View } from "react-native";
import { styles } from "../../styles";
import { ActionButtons } from "./ActionButtons";
import { type SongTimelineSortDirection, type SongTimelineSortMetric } from "../../clipGraph";
import { type SongClipTagFilter } from "./songClipControls";

type IdeasHeaderProps = {
  isParentPicking: boolean;
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
  visibleIdeaCount: number;
};

export function IdeasHeader({
  isParentPicking,
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
  visibleIdeaCount,
}: IdeasHeaderProps) {
  return (
    <View style={styles.songDetailStickyIdeasHeader}>
      {isParentPicking ? (
        <View style={styles.songDetailParentPickInlineHint}>
          <Text style={styles.songDetailParentPickInlineTitle}>Choose parent clip</Text>
          <Text style={styles.songDetailParentPickInlineText}>
            Tap any available clip below.
          </Text>
        </View>
      ) : (
        <ActionButtons
          isEditMode={isEditMode}
          clipViewMode={viewMode}
          setClipViewMode={setViewMode}
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
      )}
    </View>
  );
}
