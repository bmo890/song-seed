import React, { ReactNode, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./styles";
import { buildEvolutionListRows, type EvolutionListRow, type TimelineClipEntry } from "../../clipGraph";
import { type ClipCardContextProps } from "./ClipCard";
import { type SongTimelineSortDirection, type SongTimelineSortMetric } from "../../clipGraph";
import { type SongClipTagFilter } from "./songClipControls";
import { SongClipCard } from "./components/SongClipCard";
import { SongClipListShell } from "./components/SongClipListShell";

type EvolutionListProps = {
  clips: TimelineClipEntry["clip"][];
  expandedLineageIds: Record<string, boolean>;
  setExpandedLineageIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  summaryContent?: ReactNode;
  footerSpacerHeight: number;
  primaryEntry: TimelineClipEntry | null;
  clipCardContext: ClipCardContextProps;
  visibleIdeaCount: number;
  onIdeasStickyChange?: (isSticky: boolean) => void;
};

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
    <View style={styles.songDetailClipRowWrap}>
      <View style={styles.songDetailEvolutionGuideWrap}>
        {expanded ? (
          <View style={styles.songDetailThreadSpine} />
        ) : (
          <View style={styles.songDetailThreadCurve} />
        )}
      </View>
      <Pressable
        style={({ pressed }) => [styles.songDetailEvolutionExpandRow, pressed ? styles.pressDown : null]}
        onPress={() => onToggle(lineageRootId)}
      >
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={11}
          color="#84736f"
        />
        <Text style={styles.songDetailEvolutionExpandText}>
          {expanded
            ? "Hide older takes"
            : `${hiddenCount} older ${hiddenCount === 1 ? "take" : "takes"}`}
        </Text>
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
  clipCardContext,
  visibleIdeaCount,
  onIdeasStickyChange,
}: EvolutionListProps) {
  const contentRows = useMemo(
    () => buildEvolutionListRows(clips, expandedLineageIds),
    [clips, expandedLineageIds]
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
        if (row.kind === "clip") return `evolution-clip:${row.entry.clip.id}:${index}`;
        return `evolution-more:${row.lineageRootId}`;
      }}
      renderContentRow={(row) => {
        if (row.kind === "more") {
          return (
            <EvolutionMoreRow
              lineageRootId={row.lineageRootId}
              hiddenCount={row.hiddenCount}
              expanded={row.expanded}
              onToggle={(lineageRootId) =>
                setExpandedLineageIds((prev) => ({
                  ...prev,
                  [lineageRootId]: !prev[lineageRootId],
                }))
              }
            />
          );
        }

        return <SongClipCard entry={row.entry} context={clipCardContext} />;
      }}
    />
  );
}
