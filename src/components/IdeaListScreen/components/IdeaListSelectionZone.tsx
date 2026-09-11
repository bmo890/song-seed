import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActionButtons } from "./ActionButtons";
import { IdeaSelectionBar } from "./IdeaSelectionBar";

type IdeaListSelectionZoneProps = {
  /** While the page is a picker, the footer is the zone's only occupant —
   *  no selection dock, no record FAB. */
  pickerFooter?: ReactNode;
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
  onQuickRecord: () => void;
  onFloatingDockLayout: (height: number) => void;
  onSelectionDockLayout: (height: number) => void;
};

export function IdeaListSelectionZone({
  pickerFooter,
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
  onQuickRecord,
  onFloatingDockLayout,
  onSelectionDockLayout,
}: IdeaListSelectionZoneProps) {
  const { t } = useTranslation();
  if (pickerFooter) return <>{pickerFooter}</>;
  return (
    <>
      {listSelectionMode ? (
        <IdeaSelectionBar
          selectableIdeaIds={selectableIdeaIds}
          disabledIdeaIds={selectedHiddenIdeaIds}
          onPlaySelected={onPlaySelected}
          onAddToQueue={onAddToQueue}
          onToggleHideSelected={onToggleHideSelected}
          hideActionLabel={t(selectedHiddenOnly ? "common.unhide" : "common.hide")}
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
          onQuickRecord={onQuickRecord}
          onDockLayout={onFloatingDockLayout}
        />
      )}
    </>
  );
}
