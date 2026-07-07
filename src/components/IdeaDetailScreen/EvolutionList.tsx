import React, { ReactNode, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { type SharedValue } from "react-native-reanimated";
import { useStore } from "../../state/useStore";
import { QuickNameModal } from "../modals/QuickNameModal";
import { styles } from "./styles";
import {
  buildEvolutionListRowsFromLineages,
  type ClipLineage,
  type EvolutionListRow,
  type TimelineClipEntry,
} from "../../clipGraph";
import { type ClipCardContextProps } from "./ClipCard";
import { type SongTimelineSortDirection, type SongTimelineSortMetric } from "../../clipGraph";
import { SongClipCard } from "./components/SongClipCard";
import { SongClipListShell } from "./components/SongClipListShell";
import { haptic } from "../../design/haptics";

type EvolutionListProps = {
  lineages: ClipLineage[];
  expandedLineageIds: Record<string, boolean>;
  setExpandedLineageIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  direction: SongTimelineSortDirection;
  summaryContent?: ReactNode;
  footerSpacerHeight: number;
  primaryEntry: TimelineClipEntry | null;
  clipCardContext: ClipCardContextProps;
  scrollY?: SharedValue<number>;
  contentPaddingTop?: number;
  contentPaddingHorizontal?: number;
  /** Clip to scroll into view (with a fresh nonce per locate request). */
  locateTarget?: { clipId: string; nonce: number } | null;
};

type EvolutionContentRow = EvolutionListRow;


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
          // Override height so the L's horizontal stroke lines up with the text.
          // Row is ~18px; top:-5 + height:16 = bottom at 11px = text centre.
          <View style={[styles.songDetailThreadCurve, { height: 16 }]} />
        )}
      </View>
      <Pressable
        style={({ pressed }) => [styles.songDetailEvolutionExpandRow, pressed ? styles.pressDown : null]}
        onPress={() => {
          haptic.light();
          onToggle(lineageRootId);
        }}
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
  onRename,
}: {
  row: Extract<EvolutionListRow, { kind: "group" }>;
  onRename: (groupId: string, name: string) => void;
}) {
  const ideaId = useStore((s) => s.selectedIdeaId);
  const setClipGroupCollapsed = useStore((s) => s.setClipGroupCollapsed);

  return (
    <View style={styles.songDetailEvolutionGroupRow}>
      <Pressable
        style={({ pressed }) => [
          styles.songDetailEvolutionGroupContent,
          pressed ? styles.pressDown : null,
        ]}
        onPress={() => {
          if (!ideaId) return;
          setClipGroupCollapsed(ideaId, row.groupId, !row.collapsed);
        }}
        onLongPress={() => onRename(row.groupId, row.name)}
        delayLongPress={300}
        accessibilityRole="button"
        accessibilityHint="Long press to rename this group"
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
        </View>
      </Pressable>
    </View>
  );
}

export function EvolutionList({
  lineages,
  expandedLineageIds,
  setExpandedLineageIds,
  direction,
  summaryContent,
  footerSpacerHeight,
  primaryEntry,
  clipCardContext,
  scrollY,
  contentPaddingTop,
  contentPaddingHorizontal,
  locateTarget,
}: EvolutionListProps) {
  const ideaId = clipCardContext.mode.idea.id;
  const renameClipGroup = useStore((s) => s.renameClipGroup);
  const [renameTarget, setRenameTarget] = useState<{ groupId: string; name: string } | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const groups = clipCardContext.mode.idea.clipGroups ?? [];
  const groupAssignments = clipCardContext.mode.idea.clipGroupAssignments ?? {};
  // "Collapse all" is lifted out of the FlatList into the sticky pinned overlay
  // so it stays visible when the header is collapsed — not rendered here.
  const contentRows = useMemo<EvolutionContentRow[]>(() =>
    buildEvolutionListRowsFromLineages(
      lineages,
      expandedLineageIds,
      direction,
      groups,
      groupAssignments
    ),
    [lineages, direction, expandedLineageIds, groupAssignments, groups]
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
    <>
    <SongClipListShell
      contentRows={contentRows}
      summaryContent={summaryContent}
      footerSpacerHeight={footerSpacerHeight}
      primaryEntry={primaryEntry}
      emptyLabel={primaryEntry ? "No idea clips yet." : "No clips yet."}
      scrollY={scrollY}
      contentPaddingTop={contentPaddingTop}
      contentPaddingHorizontal={contentPaddingHorizontal}
      scrollTarget={scrollTarget}
      contentKeyExtractor={(row, index) => {
        if (row.kind === "clip") return `evolution-clip:${row.entry.clip.id}:${index}`;
        if (row.kind === "group") return `evolution-group:${row.groupId}`;
        return `evolution-more:${row.lineageRootId}`;
      }}
      renderContentRow={(row) => {
        if (row.kind === "group") {
          return (
            <EvolutionGroupHeaderRow
              row={row}
              onRename={(groupId, name) => {
                setRenameTarget({ groupId, name });
                setRenameDraft(name);
              }}
            />
          );
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
    <QuickNameModal
      visible={!!renameTarget}
      title="Rename group"
      draftValue={renameDraft}
      placeholderValue={renameTarget?.name}
      onChangeDraft={setRenameDraft}
      onCancel={() => setRenameTarget(null)}
      onSave={() => {
        const next = renameDraft.trim();
        if (renameTarget && next) renameClipGroup(ideaId, renameTarget.groupId, next);
        setRenameTarget(null);
      }}
      helperText="Give this lineage group a clearer name."
      saveLabel="Rename"
    />
    </>
  );
}
