import { IdeaListFilterSection } from "../components/IdeaListFilterSection";
import { useCollectionScreen } from "../provider/CollectionScreenProvider";

export function CollectionFilterSection() {
  const { screen, store } = useCollectionScreen();

  return (
    <IdeaListFilterSection
      selectedProjectStages={screen.selectedProjectStages}
      lyricsFilterMode={screen.lyricsFilterMode}
      hiddenItemsCount={screen.effectivelyHiddenCount}
      onToggleProjectStage={(stage) => {
        screen.setSelectedProjectStages((prev) =>
          prev.includes(stage) ? prev.filter((item) => item !== stage) : [...prev, stage]
        );
      }}
      onClearProjectStages={() => screen.setSelectedProjectStages([])}
      onLyricsFilterModeChange={screen.setLyricsFilterMode}
      onShowAll={() => {
        if (screen.collectionId) store.showAllHidden(screen.collectionId);
      }}
    />
  );
}
