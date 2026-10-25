import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActionButtons } from "./ActionButtons";
import { IdeaSelectionBar } from "./IdeaSelectionBar";

type IdeaListSelectionZoneProps = {
  /** While the page is a picker, the footer is the zone's only occupant —
   *  no selection dock, no record FAB. */
  pickerFooter?: ReactNode;
  /** The page's workspace — a visited package is never the active one. */
  workspaceId?: string;
  listSelectionMode: boolean;
  selectedHiddenIdeaIds: string[];
  selectedClipIdeasCount: number;
  selectableIdeaIds: string[];
  /** The page's ideas in on-screen order (see IdeaSelectionBar). */
  orderedIdeaIds?: string[];
  selectedHiddenOnly: boolean;
  selectedInteractiveIdeasCount: number;
  onCreateProjectFromSelection: () => void;
  onPlaySelected: () => void;
  onAddToQueue: () => void;
  onToggleHideSelected: () => void;
  onDeleteSelected: () => void;
  onEditSelected: () => void;
  onQuickRecord: () => void;
  /** A received package has no record key — nothing is created inside it. */
  hideRecord?: boolean;
  onFloatingDockLayout: (height: number) => void;
  onSelectionDockLayout: (height: number) => void;
};

export function IdeaListSelectionZone({
  pickerFooter,
  workspaceId,
  listSelectionMode,
  selectedHiddenIdeaIds,
  selectedClipIdeasCount,
  selectableIdeaIds,
  orderedIdeaIds,
  selectedHiddenOnly,
  selectedInteractiveIdeasCount,
  onCreateProjectFromSelection,
  onPlaySelected,
  onAddToQueue,
  onToggleHideSelected,
  onDeleteSelected,
  onEditSelected,
  onQuickRecord,
  hideRecord = false,
  onFloatingDockLayout,
  onSelectionDockLayout,
}: IdeaListSelectionZoneProps) {
  const { t } = useTranslation();
  if (pickerFooter) return <>{pickerFooter}</>;
  return (
    <>
      {listSelectionMode ? (
        <IdeaSelectionBar
          workspaceId={workspaceId}
          selectableIdeaIds={selectableIdeaIds}
          orderedIdeaIds={orderedIdeaIds}
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
      ) : hideRecord ? null : (
        <ActionButtons
          onQuickRecord={onQuickRecord}
          onDockLayout={onFloatingDockLayout}
        />
      )}
    </>
  );
}
