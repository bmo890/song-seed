import { IdeaListFilterSection } from "../components/IdeaListFilterSection";
import { useCollectionScreen } from "../provider/CollectionScreenProvider";

export function CollectionFilterSection() {
  const { screen } = useCollectionScreen();

  return (
    <IdeaListFilterSection
      selectedProjectStages={screen.selectedProjectStages}
      lyricsFilterMode={screen.lyricsFilterMode}
      hiddenItemsCount={screen.effectivelyHiddenCount}
      showHidden={screen.showHidden}
      onToggleProjectStage={(stage) => {
        screen.setSelectedProjectStages((prev) =>
          prev.includes(stage) ? prev.filter((item) => item !== stage) : [...prev, stage]
        );
      }}
      onClearProjectStages={() => screen.setSelectedProjectStages([])}
      onLyricsFilterModeChange={screen.setLyricsFilterMode}
      onToggleShowHidden={() => screen.setShowHidden((prev) => !prev)}
    />
  );
}
