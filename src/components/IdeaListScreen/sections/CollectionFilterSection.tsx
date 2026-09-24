import { IdeaListFilterSection } from "../components/IdeaListFilterSection";
import { SelectionTopBar } from "../../common/SelectionTopBar";
import { useCollectionScreen } from "../provider/CollectionScreenProvider";
import { useStore } from "../../../state/useStore";

/** Count · All · Cancel, swapped into the toolbar row where the filter/sort
 *  glyphs sat — the search field beside them stays live, so you can narrow the
 *  list while choosing what to move or copy. Same height, so nothing shifts. */
function CollectionSelectionControls() {
  const { screen } = useCollectionScreen();
  const selectedListIdeaIds = useStore((s) => s.selectedListIdeaIds);
  const selectableListIdeaIds = screen.listEntries
    .filter((e): e is Extract<typeof e, { type: "idea" }> => e.type === "idea")
    .map((e) => e.ideaId);
  const allListSelected =
    selectableListIdeaIds.length > 0 &&
    selectableListIdeaIds.every((id) => selectedListIdeaIds.includes(id));

  return (
    <SelectionTopBar
      inline
      count={selectedListIdeaIds.length}
      allSelected={allListSelected}
      onSelectAll={() => useStore.getState().replaceListSelection(selectableListIdeaIds)}
      onCancel={() => useStore.getState().cancelListSelection()}
    />
  );
}

export function CollectionFilterSection() {

  const { screen, store } = useCollectionScreen();

  return (
    <IdeaListFilterSection
      // A picker keeps the filter/sort glyphs: its count lives on the footer.
      selectionControls={screen.listSelectionMode && !screen.pickerMode ? <CollectionSelectionControls /> : undefined}
      searchQuery={screen.searchQuery}
      onSearchQueryChange={screen.setSearchQuery}
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
      filterSortCloseSignal={screen.filterSortCloseNonce}
      onFilterSortMenuOpen={screen.closeHeaderMenu}
    />
  );
}
