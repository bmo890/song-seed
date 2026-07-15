import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../styles";
import { useStore } from "../../../state/useStore";
import { type ClipCardContextProps } from "../ClipCard";
import { EvolutionList } from "../EvolutionList";
import { TimelineList } from "../TimelineList";
import { PrimaryTakeStrip } from "../PrimaryTakeStrip";
import { useSongScreen } from "../provider/SongScreenProvider";
import { type ClipLineage, type TimelineClipEntry } from "../../../domain/clipGraph";
import { SongClipListSummary } from "./SongClipListSummary";
import { SongClipListHeader } from "./songClipToolbar/SongClipListHeader";
import { CollapsingHeaderOverlay } from "../../common/CollapsingHeaderOverlay";
import { SongCollapsibleHeader } from "./SongCollapsibleHeader";
import { SelectionTopBar } from "../../common/SelectionTopBar";
import { colors } from "../../../design/tokens";

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
  const latestRef = useRef({ focusClipInEvolution, openLineageHistory: actions.openLineageHistory });
  latestRef.current = { focusClipInEvolution, openLineageHistory: actions.openLineageHistory };

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

  const evolutionClipCardContext = useMemo<ClipCardContextProps>(
    () => ({
      ...clipCardContext,
      actions: {
        ...clipCardContext.actions,
        onViewLineageHistory: (rootClipId: string) =>
          latestRef.current.openLineageHistory(rootClipId),
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
        clipCardContext={evolutionClipCardContext}
        scrollY={screen.scrollY}
        contentPaddingTop={headerHeight}
        contentPaddingHorizontal={16}
        locateTarget={locateTarget}
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
              extra={
                primaryEntry ? (
                  <PrimaryTakeStrip entry={primaryEntry} onLocate={onLocatePrimary} />
                ) : null
              }
            />
          </View>
        }
        pinned={
          <View style={{ backgroundColor: colors.page }} pointerEvents="box-none">
            <SongClipListHeader visibleIdeaCount={visibleIdeaCount} />
            <SongClipSelectionTopBar />
            {screen.clipViewMode === "evolution" &&
            Object.values(expandedLineageIds).some(Boolean) ? (
              <CollapseAllPill onPress={() => setExpandedLineageIds({})} />
            ) : null}
          </View>
        }
      />
    </View>
  );
}

/**
 * Selection bar pinned under the toolbar (top of the timeline) while clips are
 * being multi-selected. Isolated so selection-state changes re-render only this
 * bar, and so the "Collapse all" pill below it shifts down naturally in flow.
 */
function SongClipSelectionTopBar() {
  const { screen } = useSongScreen();
  const clipSelectionMode = useStore((s) => s.clipSelectionMode);
  const selectedClipIds = useStore((s) => s.selectedClipIds);
  if (!clipSelectionMode) return null;

  const selectableClipIds = (screen.selectedIdea?.clips ?? []).map((c) => c.id);
  const allSelected =
    selectableClipIds.length > 0 &&
    selectableClipIds.every((id) => selectedClipIds.includes(id));

  return (
    <SelectionTopBar
      count={selectedClipIds.length}
      allSelected={allSelected}
      onSelectAll={() => useStore.getState().replaceClipSelection(selectableClipIds)}
      onCancel={() => useStore.getState().cancelClipSelection()}
    />
  );
}

/**
 * "Collapse all" pill in the pinned toolbar. It keeps one fixed chip shape so
 * the measured pinned header height does not change while scrolling.
 */
function CollapseAllPill({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.songDetailEvolutionCollapseAllRow}>
      <Pressable
        style={({ pressed }) => [
          styles.songDetailCollapseAllChip,
          pressed ? styles.pressDown : null,
        ]}
        onPress={onPress}
      >
        <Ionicons name="chevron-collapse-outline" size={13} color={colors.textSecondary} />
        <Text style={styles.songDetailEvolutionCollapseAllText}>Collapse all</Text>
      </Pressable>
    </View>
  );
}
