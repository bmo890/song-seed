import { Ionicons } from "@expo/vector-icons";
import { SelectionActionSheet } from "../common/SelectionActionSheet";

export type ClipActionItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
};

type ClipActionsSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  actions: ClipActionItem[];
  onCancel: () => void;
};

/** A take's actions on the version history screen: the shared action sheet
 *  (rows on paper, destruction last), no Cancel row of its own. */
export function ClipActionsSheet({ visible, title, subtitle, actions, onCancel }: ClipActionsSheetProps) {
  return (
    <SelectionActionSheet
      visible={visible}
      title={title}
      subtitle={subtitle}
      actions={actions.map(({ destructive, ...action }) => ({
        ...action,
        tone: destructive ? ("danger" as const) : undefined,
      }))}
      onClose={onCancel}
    />
  );
}
