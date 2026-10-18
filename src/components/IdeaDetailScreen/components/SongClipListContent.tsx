import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Press } from "../../common/Press";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../styles";
import { useStore } from "../../../state/useStore";
import { type ClipCardContextProps } from "./ClipCard";
import { EvolutionList } from "./EvolutionList";
import { TimelineList } from "./TimelineList";
import { useSongScreen } from "../provider/SongScreenProvider";
import { type ClipLineage, type TimelineClipEntry } from "../../../domain/clipGraph";
import { SongClipListSummary } from "./SongClipListSummary";
import { SongClipListHeader } from "./songClipToolbar/SongClipListHeader";
import { CollapsingHeaderOverlay } from "../../common/CollapsingHeaderOverlay";
import { SongCollapsibleHeader } from "./SongCollapsibleHeader";
import { colors, spacing } from "../../../design/tokens";
import { useTranslation } from "react-i18next";

type SongClipListContentProps = {
  filteredLineages: ClipLineage[];
  rootIdByClipId: Map<string, string>;
  footerSpacerHeight: number;
  primaryEntry: TimelineClipEntry | null;
  clipCardContext: ClipCardContextProps;
  visibleIdeaCount: number;
  expandedLineageIds: Record<string, boolean>;
  setExpandedLineageIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
};

// Reasonable first-paint estimate for the header height; corrected on measure.
const DEFAULT_HEADER_HEIGHT = 220;

export function SongClipListContent({
  filteredLineages,
  rootIdByClipId,
  footerSpacerHeight,
  primaryEntry,
  clipCardContext,
  visibleIdeaCount,
  expandedLineageIds,
  setExpandedLineageIds,
}: SongClipListContentProps) {
  const { screen, actions } = useSongScreen();
  const markRecentlyAdded = useStore((s) => s.markRecentlyAdded);
  const [locateTarget, setLocateTarget] = useState<{ clipId: string; nonce: number } | null>(null);
  const [headerHeight, setHeaderHeight] = useState(DEFAULT_HEADER_HEIGHT);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const summaryContent = <SongClipListSummary />;
  // "Collapse all" only when a thread with history is open: finding a lone
  // take marks its lineage expanded too, and that has nothing to fold.
  const anyThreadOpen = useMemo(
    () =>
      filteredLineages.some(
        (lineage) =>
          expandedLineageIds[lineage.root.id] && lineage.clipsOldestToNewest.length > 1
      ),
    [filteredLineages, expandedLineageIds]
  );

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
    };
  }, []);

  const expandLineageForClip = (clipId: string) => {
    const rootId = rootIdByClipId.get(clipId) ?? null;
    if (!rootId) return rootId;

    // Expand the version thread.
    setExpandedLineageIds((prev) => ({ ...prev, [rootId]: true }));

    // If the lineage root is inside a collapsed group, un-collapse that group
    // first so the FlatList can actually scroll to the clip.
    const idea = screen.selectedIdea;
    if (idea) {
      const groupId = idea.clipGroupAssignments?.[rootId];
      if (groupId) {
        const group = idea.clipGroups?.find((g) => g.id === groupId);
        if (group?.collapsed) {
          useStore.getState().setClipGroupCollapsed(idea.id, groupId, false);
        }
      }
    }

    return rootId;
  };

  // Focus a clip in Evolution view: switch view, open its thread, scroll it into
  // view, and flash-highlight it.
  const focusClipInEvolution = (clipId: string) => {
    screen.setClipViewMode("evolution");
    expandLineageForClip(clipId);
    setLocateTarget({ clipId, nonce: Date.now() });
    // Defer the highlight until after the expansion + view switch have committed.
    // If called synchronously, the clip's Animated.Value may not exist yet (it's
    // inside a collapsed lineage that only becomes visible after expansion renders),
    // causing the hook to bail silently. 120ms matches the FlatList scroll delay
    // and gives React a full render cycle to allocate the value first.
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = setTimeout(() => {
      markRecentlyAdded([clipId]);
      highlightTimerRef.current = null;
    }, 120);
  };

  const onLocatePrimary = () => {
    if (!primaryEntry) return;
    focusClipInEvolution(primaryEntry.clip.id);
  };

  // The derived per-view contexts must keep referential stability (ClipCard is memo'd
  // on them), so the added callbacks are stable wrappers over a latest-impl ref.
  const latestRef = useRef({
    focusClipInEvolution,
    headerHeight,
  });
  latestRef.current = {
    focusClipInEvolution,
    headerHeight,
  };

  // A located row settles just under the pinned part of the header (total
  // minus the collapsible group), with a breathing line of space.
  const collapsibleHeaderHeight = screen.collapsibleHeaderHeight;
  const getLocateTopInset = useCallback(
    () =>
      latestRef.current.headerHeight - Math.round(collapsibleHeaderHeight.value) + spacing.md,
    [collapsibleHeaderHeight]
  );

  const timelineClipCardContext = useMemo<ClipCardContextProps>(
    () => ({
      ...clipCardContext,
      actions: {
        ...clipCardContext.actions,
        // Timeline → Evolution jump.
        onLocateClip: (clipId: string) => latestRef.current.focusClipInEvolution(clipId),
      },
    }),
    [clipCardContext]
  );


  const body =
    screen.clipViewMode === "timeline" ? (
      <TimelineList
        lineages={filteredLineages}
        summaryContent={summaryContent}
        footerSpacerHeight={footerSpacerHeight}
        primaryEntry={primaryEntry}
        clipCardContext={timelineClipCardContext}
        scrollY={screen.scrollY}
        contentPaddingTop={headerHeight}
        contentPaddingHorizontal={16}
      />
    ) : (
      <EvolutionList
        lineages={filteredLineages}
        expandedLineageIds={expandedLineageIds}
        setExpandedLineageIds={setExpandedLineageIds}
        direction={screen.timelineSortDirection}
        summaryContent={summaryContent}
        footerSpacerHeight={footerSpacerHeight}
        primaryEntry={primaryEntry}
        clipCardContext={clipCardContext}
        scrollY={screen.scrollY}
        contentPaddingTop={headerHeight}
        contentPaddingHorizontal={16}
        locateTarget={locateTarget}
        getLocateTopInset={getLocateTopInset}
      />
    );

  return (
    <View style={{ flex: 1, overflow: "hidden", marginHorizontal: -16 }}>
      {body}
      <CollapsingHeaderOverlay
        scrollY={screen.scrollY}
        collapsibleHeight={screen.collapsibleHeaderHeight}
        onHeaderHeight={setHeaderHeight}
        collapsible={
          <View style={{ paddingHorizontal: 16 }}>
            <SongCollapsibleHeader
              primaryClip={primaryEntry?.clip ?? null}
              onLocatePrimary={onLocatePrimary}
            />
          </View>
        }
        pinned={
          <View style={{ backgroundColor: colors.page }} pointerEvents="box-none">
            {/* Selection mode swaps the toolbar's controls row in place (see
                SongClipListToolbar) — no extra bar, no layout shift. */}
            <SongClipListHeader visibleIdeaCount={visibleIdeaCount} />
            {screen.clipViewMode === "evolution" && anyThreadOpen ? (
              <CollapseAllPill onPress={() => setExpandedLineageIds({})} />
            ) : null}
          </View>
        }
      />
    </View>
  );
}

/**
 * "Collapse all" in the pinned toolbar: quiet ink, glyph + words, so it stays
 * in reach while the header is docked. A fixed height keeps the measured
 * pinned header steady while scrolling.
 */
function CollapseAllPill({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.songDetailEvolutionCollapseAllRow}>
      <Press
        feel="glyph"
        // haptics.ts: light → small state flips (fold/unfold).
        haptic="light"
        style={styles.songDetailEvolutionCollapseAllButton}
        onPress={onPress}
      >
        <Ionicons name="chevron-collapse-outline" size={14} color={colors.textSecondary} />
        <Text style={styles.songDetailEvolutionCollapseAllText}>{t("songDetail.collapseAll")}</Text>
      </Press>
    </View>
  );
}
