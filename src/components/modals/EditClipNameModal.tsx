import { useEffect, useState } from "react";
import { QuickNameModal } from "./QuickNameModal";

type EditClipNameModalProps = {
  visible: boolean;
  initialName: string;
  onClose: () => void;
  onSave: (newName: string) => void;
};

export function EditClipNameModal({
  visible,
  initialName,
  onClose,
  onSave,
}: EditClipNameModalProps) {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (visible) {
      setName(initialName);
    }
  }, [visible, initialName]);

  return (
    <QuickNameModal
      visible={visible}
      title="Rename clip"
      draftValue={name}
      placeholderValue="Clip name"
      onChangeDraft={setName}
      onCancel={onClose}
      onSave={() => {
        const nextTitle = name.trim();
        if (!nextTitle) return;
        onSave(nextTitle);
        onClose();
      }}
      helperText="Leave empty to keep the current clip name."
      disableSaveWhenEmpty
    />
  );
}
