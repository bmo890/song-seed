import { useState } from "react";
import { View } from "react-native";
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

  const summaryContent = <SongClipListSummary />;

  const expandLineageForClip = (clipId: string) => {
    const rootId = getLineageRootId(filteredIdeaClips, clipId);
    if (rootId) setExpandedLineageIds((prev) => ({ ...prev, [rootId]: true }));
    return rootId;
  };

  // Focus a clip in Evolution view: switch view, open its thread, scroll it into
  // view, and flash-highlight it.
  const focusClipInEvolution = (clipId: string) => {
    screen.setClipViewMode("evolution");
    expandLineageForClip(clipId);
    markRecentlyAdded([clipId]);
    setLocateTarget({ clipId, nonce: Date.now() });
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
        pinned={<SongClipListHeader visibleIdeaCount={visibleIdeaCount} />}
      />
    </View>
  );
}
