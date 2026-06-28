import { useState } from "react";
import { SelectionActionSheet } from "../../common/SelectionActionSheet";
import { SelectionDock, type SelectionAction } from "../../common/SelectionDock";
import type { useChordSheetModel } from "../useChordSheetModel";

/** Screen-level footer for the chart's bar selection — mirrors the clip
 * selection dock. Primary actions inline; copy/cut/paste/split behind "More". */
export function ChartSelectionDock({
  model,
  onLayout,
}: {
  model: ReturnType<typeof useChordSheetModel>;
  onLayout?: (height: number) => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);

  if (!model.barSelection) return null;

  const count = model.selectedBarCount;
  const noun = count === 1 ? "bar" : "bars";

  const dockActions: SelectionAction[] = [
    { key: "add-before", label: "Add before", icon: "arrow-back-outline", onPress: model.addBarBeforeSelection },
    { key: "add-after", label: "Add after", icon: "arrow-forward-outline", onPress: model.addBarAfterSelection },
    { key: "clear", label: "Clear", icon: "backspace-outline", onPress: model.clearSelectedBars },
    { key: "delete", label: "Delete", icon: "trash-outline", tone: "danger", onPress: model.deleteSelectedBars },
    { key: "more", label: "More", icon: "ellipsis-horizontal", onPress: () => setMoreOpen(true) },
  ];

  const sheetActions: SelectionAction[] = [
    { key: "copy", label: `Copy ${noun}`, icon: "copy-outline", onPress: model.copySelectedBars },
    { key: "cut", label: `Cut ${noun}`, icon: "cut-outline", onPress: model.cutSelectedBars },
    ...(model.canPaste
      ? [{ key: "paste", label: "Paste", icon: "clipboard-outline" as const, onPress: model.pasteBars }]
      : []),
    ...(model.canSplitSelection
      ? [
          {
            key: "split",
            label: "Split into separate bars",
            icon: "git-branch-outline" as const,
            onPress: model.splitSelectedBar,
          },
        ]
      : []),
    { key: "deselect", label: "Deselect", icon: "close-outline", onPress: model.clearBarSelection },
  ];

  return (
    <>
      <SelectionDock actions={dockActions} onLayout={onLayout} />
      <SelectionActionSheet
        visible={moreOpen}
        title={`${count} ${noun}`}
        actions={sheetActions}
        onClose={() => setMoreOpen(false)}
      />
    </>
  );
}
