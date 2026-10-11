import { IdeaListFilterSection } from "../components/IdeaListFilterSection";
import { SelectionTopBar } from "../../common/SelectionTopBar";
import { useCollectionScreen } from "../provider/CollectionScreenProvider";
import { useStore } from "../../../state/useStore";
import { buildDefaultSongbookItemsForIdea } from "../../../domain/songbookGrouping";

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

/** The picker's own count · All · Clear, in the same slot — the basket is the
 *  count, All picks every eligible card on this page, Clear un-picks them.
 *  The footer's ✕ ends the session; this only edits the page's picks. */
function CollectionPickerControls() {
  const { screen } = useCollectionScreen();
  const collectorKind = useStore((s) => s.libraryCollector?.kind ?? null);
  const picks = useStore((s) => s.libraryCollector?.picks ?? EMPTY_PICKS);
  const ideaById = new Map(screen.listIdeas.map((idea) => [idea.id, idea]));
  const eligibleIds = screen.listEntries
    .filter((e): e is Extract<typeof e, { type: "idea" }> => e.type === "idea")
    .map((e) => e.ideaId)
    .filter((id) => {
      const idea = ideaById.get(id);
      if (!idea) return false;
      return collectorKind === "songbook" ? buildDefaultSongbookItemsForIdea(idea).length > 0 : true;
    });
  const pickedIds = new Set(picks.map((pick) => pick.ideaId));
  const allPicked = eligibleIds.length > 0 && eligibleIds.every((id) => pickedIds.has(id));
  return (
    <SelectionTopBar
      inline
      count={picks.length}
      allSelected={allPicked}
      onSelectAll={() => useStore.getState().setLibraryCollectorPicks(eligibleIds, !allPicked)}
      onCancel={() => useStore.getState().setLibraryCollectorPicks(eligibleIds, false)}
    />
  );
}
const EMPTY_PICKS: never[] = [];

export function CollectionFilterSection() {

  const { screen, store } = useCollectionScreen();
  const collecting = useStore((s) => s.libraryCollector != null);

  return (
    <IdeaListFilterSection
      selectionControls={
        screen.listSelectionMode && !screen.pickerMode ? (
          <CollectionSelectionControls />
        ) : collecting ? (
          <CollectionPickerControls />
        ) : undefined
      }
      searchQuery={screen.searchQuery}
      onSearchQueryChange={screen.setSearchQuery}
      selectedProjectStages={screen.selectedProjectStages}
      lyricsFilterMode={screen.lyricsFilterMode}
      tagsInUse={screen.tagsInUse}
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
