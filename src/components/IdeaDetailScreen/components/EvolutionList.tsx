import React, { ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { type SharedValue } from "react-native-reanimated";
import { useStore } from "../../../state/useStore";
import { QuickNameModal } from "../../modals/QuickNameModal";
import { styles } from "../styles";
import {
  buildEvolutionListRowsFromLineages,
  type ClipLineage,
  type EvolutionListRow,
  type TimelineClipEntry,
} from "../../../domain/clipGraph";
import { type ClipCardContextProps } from "./ClipCard";
import { type SongTimelineSortDirection, type SongTimelineSortMetric } from "../../../domain/clipGraph";
import { EvolutionThread } from "./EvolutionThread";
import { SongClipCard } from "./SongClipCard";
import { SongClipListShell } from "./SongClipListShell";
import { haptic } from "../../../design/haptics";
import { colors, spacing } from "../../../design/tokens";
import { useTranslation } from "react-i18next";

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
  /** Px from the viewport's top a located row should settle at — the pinned
   *  header's height plus breathing room. Read at scroll time (the pinned
   *  header grows a "Collapse all" row the moment a thread unfolds). */
  getLocateTopInset?: () => number;
};

type EvolutionContentRow = EvolutionListRow;

/** Minimum height of a version row on the stem (see `songDetailStemRow`). */
const STEM_ROW_HEIGHT = 40;


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
  const { t } = useTranslation();
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
          color={colors.textSecondary}
        />
        <Text style={styles.songDetailEvolutionExpandText}>
          {expanded
            ? t("songDetail.hideOlderTakes")
            : t("songDetail.olderTakes", { count: hiddenCount })}
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
  const { t } = useTranslation();
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
        accessibilityHint={t("songDetail.renameGroupHint")}
      >
        <View style={styles.songDetailEvolutionGroupTitleRow}>
          <Ionicons
            name={row.collapsed ? "chevron-forward" : "chevron-down"}
            size={13}
            color={colors.textSecondary}
          />
          <Text style={styles.songDetailEvolutionGroupTitle}>{row.name}</Text>
        </View>
        <View style={styles.songDetailEvolutionGroupMetaRow}>
          <View style={styles.songDetailEvolutionGroupCount}>
            {/* Musical count glyph — git iconography stays out of the studio. */}
            <Ionicons name="musical-notes-outline" size={12} color={colors.textMuted} />
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
  getLocateTopInset,
}: EvolutionListProps) {
  const { t } = useTranslation();
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

  // Where each unfolded older version sits inside its thread (y from the shell's
  // top), reported by the rows themselves as they lay out. A locate request for
  // an older version scrolls to the THREAD's index, offset by this — otherwise
  // a long history leaves the target below the fold.
  const versionRowYRef = useRef<Record<string, number>>({});
  const onVersionRowLayout = useCallback((clipId: string, y: number) => {
    versionRowYRef.current[clipId] = y;
  }, []);
  const getLocateTopInsetRef = useRef(getLocateTopInset);
  getLocateTopInsetRef.current = getLocateTopInset;

  const scrollTarget = useMemo(() => {
    if (!locateTarget) return null;
    const { clipId } = locateTarget;
    const index = contentRows.findIndex(
      (row) =>
        (row.kind === "clip" && row.entry.clip.id === clipId) ||
        (row.kind === "thread" &&
          row.lineage.clipsOldestToNewest.some((clip) => clip.id === clipId))
    );
    if (index < 0) return null;
    const row = contentRows[index];
    const isOlderVersion = row.kind === "thread" && row.lineage.latestClip.id !== clipId;
    return {
      index,
      nonce: locateTarget.nonce,
      getViewOffset: (viewportHeight: number) => {
        const inset = getLocateTopInsetRef.current?.() ?? 0;
        const rowY = isOlderVersion ? versionRowYRef.current[clipId] ?? 0 : 0;
        // Keep the head card in view when the row fits beneath it; only when
        // the history runs past the fold does the row itself take the top.
        const rowFitsUnderHead =
          rowY + STEM_ROW_HEIGHT + spacing.xl <= viewportHeight - inset;
        return rowFitsUnderHead ? inset : inset - rowY;
      },
    };
  }, [locateTarget?.clipId, locateTarget?.nonce, contentRows]);

  return (
    <>
    <SongClipListShell
      contentRows={contentRows}
      summaryContent={summaryContent}
      footerSpacerHeight={footerSpacerHeight}
      primaryEntry={primaryEntry}
      emptyLabel={primaryEntry ? t("songDetail.noIdeaClips") : t("songDetail.noClips")}
      scrollY={scrollY}
      contentPaddingTop={contentPaddingTop}
      contentPaddingHorizontal={contentPaddingHorizontal}
      scrollTarget={scrollTarget}
      contentKeyExtractor={(row, index) => {
        if (row.kind === "clip") return `evolution-clip:${row.entry.clip.id}:${index}`;
        if (row.kind === "thread") return `evolution-thread:${row.lineage.root.id}`;
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

        if (row.kind === "thread") {
          return (
            <EvolutionThread
              lineage={row.lineage}
              expanded={row.expanded}
              onToggleExpanded={(lineageRootId) =>
                setExpandedLineageIds((prev) => ({
                  ...prev,
                  [lineageRootId]: !prev[lineageRootId],
                }))
              }
              context={clipCardContext}
              onVersionRowLayout={onVersionRowLayout}
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
      title={t("songDetail.renameGroup")}
      draftValue={renameDraft}
      placeholderValue={renameTarget?.name}
      onChangeDraft={setRenameDraft}
      onCancel={() => setRenameTarget(null)}
      onSave={() => {
        const next = renameDraft.trim();
        if (renameTarget && next) renameClipGroup(ideaId, renameTarget.groupId, next);
        setRenameTarget(null);
      }}
      helperText={t("songDetail.renameGroupBody")}
      saveLabel={t("chordChart.rename")}
    />
    </>
  );
}
