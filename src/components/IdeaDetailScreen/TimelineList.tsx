import React, { ReactNode, useMemo } from "react";
import { Text, View } from "react-native";
import { styles } from "./styles";
import { buildTimelineListRows, type TimelineClipEntry, type TimelineListRow } from "../../clipGraph";
import { type ClipCardContextProps } from "./ClipCard";
import { SongClipCard } from "./components/SongClipCard";
import { SongClipListShell } from "./components/SongClipListShell";
import { useSongScreen } from "./provider/SongScreenProvider";

type TimelineListProps = {
  clips: TimelineClipEntry["clip"][];
  summaryContent?: ReactNode;
  footerSpacerHeight: number;
  primaryEntry: TimelineClipEntry | null;
  clipCardContext: ClipCardContextProps;
  visibleIdeaCount: number;
  onIdeasStickyChange?: (isSticky: boolean) => void;
};

export function TimelineList({
  clips,
  summaryContent,
  footerSpacerHeight,
  primaryEntry,
  clipCardContext,
  visibleIdeaCount,
  onIdeasStickyChange,
}: TimelineListProps) {
  const { screen } = useSongScreen();

  const contentRows = useMemo(
    () =>
      buildTimelineListRows(clips, {
        metric: screen.timelineSortMetric,
        direction: screen.timelineSortDirection,
        mainTakesOnly: screen.timelineMainTakesOnly,
      }),
    [clips, screen.timelineMainTakesOnly, screen.timelineSortDirection, screen.timelineSortMetric]
  );

  return (
    <SongClipListShell
      contentRows={contentRows}
      summaryContent={summaryContent}
      footerSpacerHeight={footerSpacerHeight}
      primaryEntry={primaryEntry}
      clipCardContext={clipCardContext}
      visibleIdeaCount={visibleIdeaCount}
      emptyLabel={primaryEntry ? "No idea clips yet." : "No clips yet."}
      onIdeasStickyChange={onIdeasStickyChange}
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
