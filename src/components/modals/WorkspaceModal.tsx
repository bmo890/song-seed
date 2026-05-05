import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { styles } from "../../styles";
import { TitleInput } from "../common/TitleInput";
import { WorkspaceAvatar } from "../common/WorkspaceAvatar";
import { WORKSPACE_COLORS, DEFAULT_WORKSPACE_COLOR, getWorkspaceTheme } from "../../workspaceTheme";

type Props = {
  visible: boolean;
  title: string;
  initialName?: string;
  initialDescription?: string;
  initialColor?: string;
  showArchiveAction?: boolean;
  archiveActionLabel?: string;
  archiveActionDisabled?: boolean;
  showDelete?: boolean;
  deleteLabel?: string;
  onCancel: () => void;
  onSave: (name: string, description: string, color: string) => void;
  onArchiveAction?: () => void;
  onDelete?: () => void;
};

export function WorkspaceModal({
  visible,
  title,
  initialName,
  initialDescription,
  initialColor,
  showArchiveAction,
  archiveActionLabel,
  archiveActionDisabled,
  showDelete,
  deleteLabel,
  onCancel,
  onSave,
  onArchiveAction,
  onDelete,
}: Props) {
  const [name, setName] = useState(initialName ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");
  const [color, setColor] = useState(initialColor ?? DEFAULT_WORKSPACE_COLOR);

  useEffect(() => {
    setName(initialName ?? "");
    setDescription(initialDescription ?? "");
    setColor(initialColor ?? DEFAULT_WORKSPACE_COLOR);
  }, [initialName, initialDescription, initialColor, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.title}>{title}</Text>

          {/* Avatar preview */}
          <View style={modalStyles.avatarPreviewRow}>
            <WorkspaceAvatar color={color} name={name || "?"} size={52} />
          </View>

          {/* Color swatch row */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={modalStyles.swatchRow}
            style={modalStyles.swatchScroll}
          >
            {WORKSPACE_COLORS.map((c) => {
              const theme = getWorkspaceTheme(c);
              const isSelected = c === color;
              return (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={[
                    modalStyles.swatch,
                    { backgroundColor: c },
                    isSelected
                      ? { borderWidth: 3, borderColor: theme.accent }
                      : { borderWidth: 3, borderColor: "transparent" },
                  ]}
                />
              );
            })}
          </ScrollView>

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

          {showArchiveAction || (showDelete && onDelete) ? (
            <View style={[styles.rowButtons, { marginTop: 10 }]}>
              {showArchiveAction && onArchiveAction ? (
                <Pressable
                  style={[styles.secondaryBtn, archiveActionDisabled ? styles.btnDisabled : null]}
                  disabled={archiveActionDisabled}
                  onPress={onArchiveAction}
                >
                  <Text style={styles.secondaryBtnText}>{archiveActionLabel ?? "Archive"}</Text>
                </Pressable>
              ) : null}
              {showDelete && onDelete ? (
                <Pressable style={styles.dangerBtn} onPress={onDelete}>
                  <Text style={styles.dangerBtnText}>{deleteLabel ?? "Delete permanently"}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={[styles.rowButtons, { justifyContent: "flex-end", marginTop: 12 }]}>
            <Pressable style={styles.secondaryBtn} onPress={onCancel}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => {
                onSave(name.trim(), description.trim(), color);
              }}
            >
              <Text style={styles.primaryBtnText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  avatarPreviewRow: {
    alignItems: "center",
    paddingVertical: 8,
  },
  swatchScroll: {
    flexGrow: 0,
    marginBottom: 12,
  },
  swatchRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
});
