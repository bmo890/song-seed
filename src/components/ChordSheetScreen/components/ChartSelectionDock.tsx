import { useState } from "react";
import { SelectionActionSheet } from "../../common/SelectionActionSheet";
import { SelectionDock, type SelectionAction } from "../../common/SelectionDock";
import type { useChordSheetModel } from "../useChordSheetModel";
import { useTranslation } from "react-i18next";

/** Screen-level footer for the chart's bar selection — mirrors the clip
 * selection dock. Primary actions inline; copy/cut/paste/split behind "More". */
export function ChartSelectionDock({
  model,
  onLayout,
}: {
  model: ReturnType<typeof useChordSheetModel>;
  onLayout?: (height: number) => void;
}) {
  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);

  if (!model.barSelection) return null;

  const count = model.selectedBarCount;
  const dockActions: SelectionAction[] = [
    { key: "add-before", label: t("chordChart.before"), icon: "arrow-back-outline", onPress: model.addBarBeforeSelection },
    { key: "add-after", label: t("chordChart.after"), icon: "arrow-forward-outline", onPress: model.addBarAfterSelection },
    { key: "clear", label: t("chordChart.clear"), icon: "backspace-outline", onPress: model.clearSelectedBars },
    { key: "delete", label: t("chordChart.delete"), icon: "trash-outline", tone: "danger", onPress: model.deleteSelectedBars },
    { key: "more", label: t("chordChart.more"), icon: "ellipsis-horizontal", onPress: () => setMoreOpen(true) },
  ];

  const sheetActions: SelectionAction[] = [
    { key: "copy", label: t("chordChart.copyBars", { count }), icon: "copy-outline", onPress: model.copySelectedBars },
    { key: "cut", label: t("chordChart.cutBars", { count }), icon: "cut-outline", onPress: model.cutSelectedBars },
    ...(model.canPaste
      ? [{ key: "paste", label: t("chordChart.paste"), icon: "clipboard-outline" as const, onPress: model.pasteBars }]
      : []),
    ...(model.canSplitSelection
      ? [
          {
            key: "split",
            label: t("chordChart.splitBars"),
            icon: "git-branch-outline" as const,
            onPress: model.splitSelectedBar,
          },
        ]
      : []),
    { key: "deselect", label: t("chordChart.deselect"), icon: "close-outline", onPress: model.clearBarSelection },
  ];

  return (
    <>
      <SelectionDock actions={dockActions} onLayout={onLayout} />
      <SelectionActionSheet
        visible={moreOpen}
        title={t("chordChart.selectedBars", { count })}
        actions={sheetActions}
        onClose={() => setMoreOpen(false)}
      />
    </>
  );
}
