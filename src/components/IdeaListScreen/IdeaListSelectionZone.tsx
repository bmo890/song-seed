import { ActionButtons } from "./ActionButtons";
import { IdeaSelectionBar } from "./IdeaSelectionBar";

type IdeaListSelectionZoneProps = {
  listSelectionMode: boolean;
  selectedHiddenIdeaIds: string[];
  selectedClipIdeasCount: number;
  selectableIdeaIds: string[];
  selectedHiddenOnly: boolean;
  selectedInteractiveIdeasCount: number;
  onCreateProjectFromSelection: () => void;
  onPlaySelected: () => void;
  onToggleHideSelected: () => void;
  onDeleteSelected: () => void;
  onEditSelected: () => void;
  onAddProject: () => void;
  onQuickRecord: () => void;
  onImportAudio: () => void;
  onFloatingDockLayout: (height: number) => void;
  onSelectionDockLayout: (height: number) => void;
};

export function IdeaListSelectionZone({
  listSelectionMode,
  selectedHiddenIdeaIds,
  selectedClipIdeasCount,
  selectableIdeaIds,
  selectedHiddenOnly,
  selectedInteractiveIdeasCount,
  onCreateProjectFromSelection,
  onPlaySelected,
  onToggleHideSelected,
  onDeleteSelected,
  onEditSelected,
  onAddProject,
  onQuickRecord,
  onImportAudio,
  onFloatingDockLayout,
  onSelectionDockLayout,
}: IdeaListSelectionZoneProps) {
  return (
    <>
      {listSelectionMode ? (
        <IdeaSelectionBar
          selectableIdeaIds={selectableIdeaIds}
          disabledIdeaIds={selectedHiddenIdeaIds}
          onPlaySelected={onPlaySelected}
          onToggleHideSelected={onToggleHideSelected}
          hideActionLabel={selectedHiddenOnly ? "Unhide" : "Hide"}
          hideActionDisabled={
            selectedHiddenOnly
              ? selectedHiddenIdeaIds.length === 0
              : selectedInteractiveIdeasCount === 0
          }
          onDeleteSelected={onDeleteSelected}
          onEditSelected={onEditSelected}
          onCreateProjectFromSelection={onCreateProjectFromSelection}
          selectedClipIdeasCount={selectedClipIdeasCount}
          onDockLayout={onSelectionDockLayout}
        />
      ) : (
        <ActionButtons
          onAddProject={onAddProject}
          onQuickRecord={onQuickRecord}
          onImportAudio={onImportAudio}
          onDockLayout={onFloatingDockLayout}
        />
      )}
    </>
  );
}
