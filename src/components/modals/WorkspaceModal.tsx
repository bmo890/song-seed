import { useEffect, useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { styles } from "../../styles";
import { TitleInput } from "../common/TitleInput";

type Props = {
  visible: boolean;
  title: string;
  initialName?: string;
  initialDescription?: string;
  showDelete?: boolean;
  deleteLabel?: string;
  onCancel: () => void;
  onSave: (name: string, description: string) => void;
  onDelete?: () => void;
};

export function WorkspaceModal({
  visible,
  title,
  initialName,
  initialDescription,
  showDelete,
  deleteLabel,
  onCancel,
  onSave,
  onDelete,
}: Props) {
  const [name, setName] = useState(initialName ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");

  useEffect(() => {
    setName(initialName ?? "");
    setDescription(initialDescription ?? "");
  }, [initialName, initialDescription, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
        <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.title}>{title}</Text>
          <TitleInput
            value={name}
            onChangeText={setName}
            placeholder="Workspace name"
          />
          <TextInput
            style={styles.notesInput}
            multiline
            placeholder="Description (optional)"
            value={description}
            onChangeText={setDescription}
          />

          <View style={[styles.rowButtons, { justifyContent: "space-between", marginTop: 8 }]}>
            {showDelete && onDelete ? (
              <Pressable style={styles.dangerBtn} onPress={onDelete}>
                <Text style={styles.dangerBtnText}>{deleteLabel ?? "Delete"}</Text>
              </Pressable>
            ) : (
              <View />
            )}
            <View style={styles.rowButtons}>
              <Pressable style={styles.secondaryBtn} onPress={onCancel}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.primaryBtn}
                onPress={() => {
                  onSave(name.trim(), description.trim());
                }}
              >
                <Text style={styles.primaryBtnText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
