import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAnimatedReaction, runOnJS } from "react-native-reanimated";
import { styles } from "../styles";
import { useStore } from "../../../state/useStore";
import { type ClipCardContextProps } from "../ClipCard";
import { EvolutionList } from "../EvolutionList";
import { TimelineList } from "../TimelineList";
import { PrimaryTakeStrip } from "../PrimaryTakeStrip";
import { useSongScreen } from "../provider/SongScreenProvider";
import { getLineageRootId, type TimelineClipEntry } from "../../../clipGraph";
import { SongClipListSummary } from "./SongClipListSummary";
import { SongClipListHeader } from "./songClipToolbar/SongClipListHeader";
import { CollapsingHeaderOverlay } from "./CollapsingHeaderOverlay";
import { SongCollapsibleHeader } from "./SongCollapsibleHeader";

type SongClipListContentProps = {
  filteredIdeaClips: TimelineClipEntry["clip"][];
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
  filteredIdeaClips,
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

  // Derived collapse state — drives the collapse-all button style.
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  useAnimatedReaction(
    () => {
      const h = screen.collapsibleHeaderHeight.value;
      return h > 0 && screen.scrollY.value >= h - 2;
    },
    (collapsed, prev) => {
      if (collapsed !== prev) runOnJS(setIsHeaderCollapsed)(collapsed);
    }
  );

  const summaryContent = <SongClipListSummary />;

  const expandLineageForClip = (clipId: string) => {
    const rootId = getLineageRootId(filteredIdeaClips, clipId);
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
    setTimeout(() => markRecentlyAdded([clipId]), 120);
  };

  const onLocatePrimary = () => {
    if (!primaryEntry) return;
    focusClipInEvolution(primaryEntry.clip.id);
  };

  // Timeline → Evolution jump.
  const onLocateClip = (clipId: string) => {
    focusClipInEvolution(clipId);
  };

  const timelineClipCardContext: ClipCardContextProps = {
    ...clipCardContext,
    actions: {
      ...clipCardContext.actions,
      onLocateClip,
    },
  };

  const body =
    screen.clipViewMode === "timeline" ? (
      <TimelineList
        clips={filteredIdeaClips}
        summaryContent={summaryContent}
        footerSpacerHeight={footerSpacerHeight}
        primaryEntry={primaryEntry}
        clipCardContext={timelineClipCardContext}
        scrollY={screen.scrollY}
        contentPaddingTop={headerHeight}
      />
    ) : (
      <EvolutionList
        clips={filteredIdeaClips}
        expandedLineageIds={expandedLineageIds}
        setExpandedLineageIds={setExpandedLineageIds}
        direction={screen.timelineSortDirection}
        summaryContent={summaryContent}
        footerSpacerHeight={footerSpacerHeight}
        primaryEntry={primaryEntry}
        clipCardContext={{
          ...clipCardContext,
          actions: {
            ...clipCardContext.actions,
            onViewLineageHistory: actions.openLineageHistory,
          },
        }}
        scrollY={screen.scrollY}
        contentPaddingTop={headerHeight}
        locateTarget={locateTarget}
      />
    );

  return (
    <View style={{ flex: 1, overflow: "hidden" }}>
      {body}
      <CollapsingHeaderOverlay
        scrollY={screen.scrollY}
        collapsibleHeight={screen.collapsibleHeaderHeight}
        onHeaderHeight={setHeaderHeight}
        collapsible={
          <SongCollapsibleHeader
            extra={
              primaryEntry ? (
                <PrimaryTakeStrip entry={primaryEntry} onLocate={onLocatePrimary} />
              ) : null
            }
          />
        }
        pinned={
          <>
            <SongClipListHeader visibleIdeaCount={visibleIdeaCount} />
            {screen.clipViewMode === "evolution" &&
            Object.values(expandedLineageIds).some(Boolean) ? (
              <View style={styles.songDetailEvolutionCollapseAllRow}>
                <Pressable
                  style={({ pressed }) => [
                    isHeaderCollapsed
                      ? styles.songDetailCollapseAllChip
                      : styles.songDetailEvolutionCollapseAllButton,
                    pressed ? styles.pressDown : null,
                  ]}
                  onPress={() => setExpandedLineageIds({})}
                >
                  <Ionicons name="chevron-collapse-outline" size={13} color="#84736f" />
                  <Text style={styles.songDetailEvolutionCollapseAllText}>Collapse all</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        }
      />
    </View>
  );
}
