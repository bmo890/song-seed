import { useTranslation } from "react-i18next";
import { SelectionActionSheet } from "../../../common/SelectionActionSheet";
import type { SelectionAction } from "../../../common/SelectionDock";

type Props = {
  visible: boolean;
  onClose: () => void;
  onExportPdf: () => void;
  onExportText: () => void;
  onCopy?: () => void;
  /** Files this chart into a songbook (the Library's book of finished songs). */
  onAddToSongbook?: () => void;
};

/** A chart's ways out: the shared action sheet (rows on paper), filing it
 *  first, then the exports. Each row keeps its one-line description. */
export function ChordExportSheet({ visible, onClose, onExportPdf, onExportText, onCopy, onAddToSongbook }: Props) {
  const { t } = useTranslation();
  const actions: SelectionAction[] = [
    ...(onAddToSongbook
      ? [{ key: "songbook", label: t("chordEditor.addSongbook"), hint: t("chordEditor.addSongbookDesc"), icon: "book-outline" as const, onPress: onAddToSongbook }]
      : []),
    { key: "pdf", label: "PDF", hint: t("chordEditor.pdfDesc"), icon: "document-outline", onPress: onExportPdf },
    { key: "text", label: t("chordEditor.text"), hint: t("chordEditor.textDesc"), icon: "text-outline", onPress: onExportText },
    ...(onCopy
      ? [{ key: "copy", label: t("chordEditor.copyClipboard"), hint: t("chordEditor.copyClipboardDesc"), icon: "copy-outline" as const, onPress: onCopy }]
      : []),
  ];
  return (
    <SelectionActionSheet visible={visible} title={t("chordEditor.exportTitle")} actions={actions} onClose={onClose} />
  );
}
