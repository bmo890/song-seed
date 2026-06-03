import React, { ReactNode, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useStore } from "../../state/useStore";
import { styles } from "./styles";
import { buildEvolutionListRows, type EvolutionListRow, type TimelineClipEntry } from "../../clipGraph";
import { type ClipCardContextProps } from "./ClipCard";
import { type SongTimelineSortDirection, type SongTimelineSortMetric } from "../../clipGraph";
import { SongClipCard } from "./components/SongClipCard";
import { SongClipListShell } from "./components/SongClipListShell";

type EvolutionListProps = {
  clips: TimelineClipEntry["clip"][];
  expandedLineageIds: Record<string, boolean>;
  setExpandedLineageIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  direction: SongTimelineSortDirection;
  summaryContent?: ReactNode;
  footerSpacerHeight: number;
  primaryEntry: TimelineClipEntry | null;
  clipCardContext: ClipCardContextProps;
  visibleIdeaCount: number;
  onIdeasStickyChange?: (isSticky: boolean) => void;
  /** Clip to scroll into view (with a fresh nonce per locate request). */
  locateTarget?: { clipId: string; nonce: number } | null;
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
  const clipSelectionMode = useStore((s) => s.clipSelectionMode);
  return (
    <View style={styles.songDetailClipRowWrap}>
      <View
        style={[
          styles.selectionIndicatorCol,
          clipSelectionMode ? null : styles.selectionIndicatorHidden,
        ]}
      />
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
  direction,
  summaryContent,
  footerSpacerHeight,
  primaryEntry,
  clipCardContext,
  visibleIdeaCount,
  onIdeasStickyChange,
  locateTarget,
}: EvolutionListProps) {
  const contentRows = useMemo(
    () => buildEvolutionListRows(clips, expandedLineageIds, direction),
    [clips, direction, expandedLineageIds]
  );

  const scrollTarget = useMemo(() => {
    if (!locateTarget) return null;
    const index = contentRows.findIndex(
      (row) => row.kind === "clip" && row.entry.clip.id === locateTarget.clipId
    );
    if (index < 0) return null;
    return { index, nonce: locateTarget.nonce };
  }, [locateTarget?.clipId, locateTarget?.nonce, contentRows]);

  return (
    <SongClipListShell
      contentRows={contentRows}
      summaryContent={summaryContent}
      footerSpacerHeight={footerSpacerHeight}
      primaryEntry={primaryEntry}
      visibleIdeaCount={visibleIdeaCount}
      emptyLabel={primaryEntry ? "No idea clips yet." : "No clips yet."}
      onIdeasStickyChange={onIdeasStickyChange}
      scrollTarget={scrollTarget}
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
