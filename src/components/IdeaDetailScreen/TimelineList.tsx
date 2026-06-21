import React, { ReactNode, useMemo } from "react";
import { Text, View } from "react-native";
import { type SharedValue } from "react-native-reanimated";
import { styles } from "./styles";
import {
  buildTimelineListRowsFromLineages,
  type ClipLineage,
  type TimelineClipEntry,
  type TimelineListRow,
} from "../../clipGraph";
import { type ClipCardContextProps } from "./ClipCard";
import { SongClipCard } from "./components/SongClipCard";
import { SongClipListShell } from "./components/SongClipListShell";
import { useSongScreen } from "./provider/SongScreenProvider";

type TimelineListProps = {
  lineages: ClipLineage[];
  summaryContent?: ReactNode;
  footerSpacerHeight: number;
  primaryEntry: TimelineClipEntry | null;
  clipCardContext: ClipCardContextProps;
  scrollY?: SharedValue<number>;
  contentPaddingTop?: number;
  contentPaddingHorizontal?: number;
};

export function TimelineList({
  lineages,
  summaryContent,
  footerSpacerHeight,
  primaryEntry,
  clipCardContext,
  scrollY,
  contentPaddingTop,
  contentPaddingHorizontal,
}: TimelineListProps) {
  const { screen } = useSongScreen();

  const contentRows = useMemo(
    () =>
      buildTimelineListRowsFromLineages(lineages, {
        metric: screen.timelineSortMetric,
        direction: screen.timelineSortDirection,
        mainTakesOnly: screen.timelineMainTakesOnly,
      }),
    [lineages, screen.timelineMainTakesOnly, screen.timelineSortDirection, screen.timelineSortMetric]
  );

  return (
    <SongClipListShell
      contentRows={contentRows}
      summaryContent={summaryContent}
      footerSpacerHeight={footerSpacerHeight}
      primaryEntry={primaryEntry}
      emptyLabel={primaryEntry ? "No idea clips yet." : "No clips yet."}
      scrollY={scrollY}
      contentPaddingTop={contentPaddingTop}
      contentPaddingHorizontal={contentPaddingHorizontal}
      contentKeyExtractor={(row, index) => {
        if (row.kind === "clip") return `timeline-clip:${row.entry.clip.id}:${index}`;
        return `day-divider:${row.dayStartTs}`;
      }}
      renderContentRow={(row) => {
        if (row.kind === "day-divider") {
          return (
            <View style={styles.songDetailTimelineDividerWrap}>
              <View style={styles.ideasDayDividerRow}>
                <View style={styles.ideasDayDividerLine} />
                <Text style={styles.ideasDayDividerText}>{row.label}</Text>
                <View style={styles.ideasDayDividerLine} />
              </View>
            </View>
          );
        }

        return <SongClipCard entry={row.entry} context={clipCardContext} />;
      }}
    />
  );
}
