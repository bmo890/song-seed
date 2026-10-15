import { useTranslation } from "react-i18next";
import { SelectionActionSheet } from "../common/SelectionActionSheet";

type Props = {
  visible: boolean;
  title: string;
  onRename: () => void;
  onCopy: () => void;
  onMove: () => void;
  onDelete: () => void;
  onCancel: () => void;
};

/** A nested collection's long-press menu: the shared action sheet, named by
 *  the collection. Was a centred card of boxed rows. */
export function CollectionActionsModal({ visible, title, onRename, onCopy, onMove, onDelete, onCancel }: Props) {
  const { t } = useTranslation();
  return (
    <SelectionActionSheet
      visible={visible}
      title={title}
      actions={[
        { key: "rename", label: t("modals.rename"), icon: "create-outline", onPress: onRename },
        { key: "copy", label: t("common.copy"), icon: "copy-outline", onPress: onCopy },
        { key: "move", label: t("common.move"), icon: "swap-horizontal-outline", onPress: onMove },
        { key: "delete", label: t("common.delete"), icon: "trash-outline", tone: "danger", onPress: onDelete },
      ]}
      // Each handler closes the menu itself and still needs the collection it
      // names; only a dismissal without a choice forgets it.
      onClose={() => {}}
      onCancel={onCancel}
    />
  );
}
