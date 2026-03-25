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
  onViewLineageHistory?: (lineageRootId: string) => void;
};

function EvolutionMoreRow({
  lineageRootId,
  hiddenCount,
  expanded,
  onToggle,
  onViewHistory,
}: {
  lineageRootId: string;
  hiddenCount: number;
  expanded: boolean;
  onToggle: (lineageRootId: string) => void;
  onViewHistory?: (lineageRootId: string) => void;
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
      {onViewHistory ? (
        <Pressable
          style={({ pressed }) => [
            styles.songDetailEvolutionMoreButtonWrap,
            pressed ? styles.pressDown : null,
          ]}
          onPress={() => onViewHistory(lineageRootId)}
        >
          <View style={styles.songDetailEvolutionMoreButton}>
            <Ionicons name="git-branch-outline" size={12} color="#64748b" style={{ marginRight: 3 }} />
            <Text style={styles.songDetailEvolutionMoreButtonText}>History</Text>
          </View>
        </Pressable>
      ) : null}
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
  onViewLineageHistory,
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
              onViewHistory={onViewLineageHistory}
            />
          );
        }

        return <SongClipCard entry={row.entry} context={clipCardContext} />;
      }}
    />
  );
}
