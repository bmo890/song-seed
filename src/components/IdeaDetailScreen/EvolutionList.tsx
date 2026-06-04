import React, { ReactNode, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { type SharedValue } from "react-native-reanimated";
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
  scrollY?: SharedValue<number>;
  contentPaddingTop?: number;
  /** Clip to scroll into view (with a fresh nonce per locate request). */
  locateTarget?: { clipId: string; nonce: number } | null;
};

type EvolutionContentRow =
  | { kind: "collapse-all" }
  | EvolutionListRow;

const DAY_MS = 24 * 60 * 60 * 1000;

function formatGroupFreshness(timestamp: number | null) {
  if (timestamp == null) return "No clips yet";
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const target = new Date(timestamp);
  const targetStart = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const days = Math.max(0, Math.floor((todayStart - targetStart) / DAY_MS));

  if (days === 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  if (days < 7) return `Updated ${days} days ago`;
  if (days < 14) return "Updated last week";
  if (days < 31) {
    const weeks = Math.max(2, Math.floor(days / 7));
    return `Updated ${weeks} weeks ago`;
  }
  if (days < 62) return "Updated last month";
  const months = Math.max(2, Math.floor(days / 30));
  return `Updated ${months} months ago`;
}

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
          // Override height so the L's horizontal stroke lines up with the text.
          // Row is ~18px; top:-5 + height:16 = bottom at 11px = text centre.
          <View style={[styles.songDetailThreadCurve, { height: 16 }]} />
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

function EvolutionGroupHeaderRow({
  row,
}: {
  row: Extract<EvolutionListRow, { kind: "group" }>;
}) {
  const clipSelectionMode = useStore((s) => s.clipSelectionMode);
  const ideaId = useStore((s) => s.selectedIdeaId);
  const setClipGroupCollapsed = useStore((s) => s.setClipGroupCollapsed);

  return (
    <View style={styles.songDetailEvolutionGroupRow}>
      <View
        style={[
          styles.selectionIndicatorCol,
          clipSelectionMode ? null : styles.selectionIndicatorHidden,
        ]}
      />
      <Pressable
        style={({ pressed }) => [
          styles.songDetailEvolutionGroupContent,
          pressed ? styles.pressDown : null,
        ]}
        onPress={() => {
          if (!ideaId) return;
          setClipGroupCollapsed(ideaId, row.groupId, !row.collapsed);
        }}
      >
        <View style={styles.songDetailEvolutionGroupTitleRow}>
          <Ionicons
            name={row.collapsed ? "chevron-forward" : "chevron-down"}
            size={13}
            color="#84736f"
          />
          <Text style={styles.songDetailEvolutionGroupTitle}>{row.name}</Text>
        </View>
        <View style={styles.songDetailEvolutionGroupMetaRow}>
          <View style={styles.songDetailEvolutionGroupCount}>
            <Ionicons name="git-branch-outline" size={12} color="#a89994" />
            <Text style={styles.songDetailEvolutionGroupMeta}>{row.lineageCount}</Text>
          </View>
          <Text style={styles.songDetailEvolutionGroupMeta}>
            · {formatGroupFreshness(row.lastUpdatedAt)}
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
  direction,
  summaryContent,
  footerSpacerHeight,
  primaryEntry,
  clipCardContext,
  scrollY,
  contentPaddingTop,
  locateTarget,
}: EvolutionListProps) {
  const groups = clipCardContext.mode.idea.clipGroups ?? [];
  const groupAssignments = clipCardContext.mode.idea.clipGroupAssignments ?? {};
  const hasExpandedLineages = Object.values(expandedLineageIds).some(Boolean);
  const contentRows = useMemo<EvolutionContentRow[]>(() => {
    const rows = buildEvolutionListRows(
      clips,
      expandedLineageIds,
      direction,
      groups,
      groupAssignments
    );
    return hasExpandedLineages ? [{ kind: "collapse-all" }, ...rows] : rows;
  }, [clips, direction, expandedLineageIds, groupAssignments, groups, hasExpandedLineages]);

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
      emptyLabel={primaryEntry ? "No idea clips yet." : "No clips yet."}
      scrollY={scrollY}
      contentPaddingTop={contentPaddingTop}
      scrollTarget={scrollTarget}
      contentKeyExtractor={(row, index) => {
        if (row.kind === "collapse-all") return "evolution-collapse-all";
        if (row.kind === "clip") return `evolution-clip:${row.entry.clip.id}:${index}`;
        if (row.kind === "group") return `evolution-group:${row.groupId}`;
        return `evolution-more:${row.lineageRootId}`;
      }}
      renderContentRow={(row) => {
        if (row.kind === "collapse-all") {
          return (
            <View style={styles.songDetailEvolutionCollapseAllRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.songDetailEvolutionCollapseAllButton,
                  pressed ? styles.pressDown : null,
                ]}
                onPress={() => setExpandedLineageIds({})}
              >
                <Ionicons name="chevron-collapse-outline" size={13} color="#84736f" />
                <Text style={styles.songDetailEvolutionCollapseAllText}>Collapse all</Text>
              </Pressable>
            </View>
          );
        }

        if (row.kind === "group") {
          return <EvolutionGroupHeaderRow row={row} />;
        }

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
