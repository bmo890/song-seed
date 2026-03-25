import { type ClipCardContextProps } from "../ClipCard";
import { EvolutionList } from "../EvolutionList";
import { TimelineList } from "../TimelineList";
import { useSongScreen } from "../provider/SongScreenProvider";
import { type TimelineClipEntry } from "../../../clipGraph";
import { SongClipListSummary } from "./SongClipListSummary";

type SongClipListContentProps = {
  filteredIdeaClips: TimelineClipEntry["clip"][];
  footerSpacerHeight: number;
  primaryEntry: TimelineClipEntry | null;
  clipCardContext: ClipCardContextProps;
  visibleIdeaCount: number;
  expandedLineageIds: Record<string, boolean>;
  setExpandedLineageIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
};

export function SongClipListContent({
  filteredIdeaClips,
  footerSpacerHeight,
  primaryEntry,
  clipCardContext,
  visibleIdeaCount,
  expandedLineageIds,
  setExpandedLineageIds,
}: SongClipListContentProps) {
  const { screen, parentPicking, actions } = useSongScreen();

  const summaryContent = <SongClipListSummary />;

  if (screen.clipViewMode === "timeline") {
    return (
      <TimelineList
        clips={filteredIdeaClips}
        summaryContent={summaryContent}
        footerSpacerHeight={footerSpacerHeight}
        primaryEntry={primaryEntry}
        clipCardContext={clipCardContext}
        visibleIdeaCount={visibleIdeaCount}
        onIdeasStickyChange={screen.setIsIdeasSticky}
      />
    );
  }

  return (
    <EvolutionList
      clips={filteredIdeaClips}
      expandedLineageIds={expandedLineageIds}
      setExpandedLineageIds={setExpandedLineageIds}
      summaryContent={summaryContent}
      footerSpacerHeight={footerSpacerHeight}
      primaryEntry={primaryEntry}
      clipCardContext={clipCardContext}
      visibleIdeaCount={visibleIdeaCount}
      onIdeasStickyChange={screen.setIsIdeasSticky}
      onViewLineageHistory={actions.openLineageHistory}
    />
  );
}
