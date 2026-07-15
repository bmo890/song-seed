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
  onAddToQueue: () => void;
  onToggleHideSelected: () => void;
  onDeleteSelected: () => void;
  onEditSelected: () => void;
  onAddProject: () => void;
  onQuickRecord: () => void;
  onImportAudio: () => void;
  onImportDevSamples?: () => void;
  onImportDevSong?: () => void;
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
  onAddToQueue,
  onToggleHideSelected,
  onDeleteSelected,
  onEditSelected,
  onAddProject,
  onQuickRecord,
  onImportAudio,
  onImportDevSamples,
  onImportDevSong,
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
          onAddToQueue={onAddToQueue}
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
          onImportDevSamples={onImportDevSamples}
          onImportDevSong={onImportDevSong}
          onDockLayout={onFloatingDockLayout}
        />
      )}
    </>
  );
}
