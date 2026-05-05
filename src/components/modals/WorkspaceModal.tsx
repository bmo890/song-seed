import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  initialAvatarKey?: number;
  showArchiveAction?: boolean;
  archiveActionLabel?: string;
  archiveActionDisabled?: boolean;
  showDelete?: boolean;
  deleteLabel?: string;
  onCancel: () => void;
  onSave: (name: string, description: string, color: string, avatarKey: number) => void;
  onArchiveAction?: () => void;
  onDelete?: () => void;
};

export function WorkspaceModal({
  visible,
  title,
  initialName,
  initialDescription,
  initialColor,
  initialAvatarKey,
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
  const [avatarKey, setAvatarKey] = useState(initialAvatarKey ?? Date.now());

  useEffect(() => {
    setName(initialName ?? "");
    setDescription(initialDescription ?? "");
    setColor(initialColor ?? DEFAULT_WORKSPACE_COLOR);
    setAvatarKey(initialAvatarKey ?? Date.now());
  }, [initialName, initialDescription, initialColor, initialAvatarKey, visible]);

  function randomizeAvatar() {
    setAvatarKey(Date.now());
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.title}>{title}</Text>

          {/* Avatar preview + randomize */}
          <View style={modalStyles.avatarPreviewRow}>
            <WorkspaceAvatar color={color} name={name || "?"} size={52} avatarKey={avatarKey} />
            <Pressable
              style={({ pressed }) => [
                modalStyles.refreshBtn,
                pressed ? modalStyles.refreshBtnPressed : null,
              ]}
              onPress={randomizeAvatar}
              hitSlop={8}
            >
              <Ionicons name="refresh-outline" size={18} color="#84736f" />
            </Pressable>
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
                    modalStyles.swatchRing,
                    isSelected
                      ? { borderColor: theme.accent }
                      : { borderColor: "transparent" },
                  ]}
                >
                  <View style={[modalStyles.swatch, { backgroundColor: c }]} />
                </Pressable>
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
                onSave(name.trim(), description.trim(), color, avatarKey);
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 8,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F4F1ED",
    alignItems: "center",
    justifyContent: "center",
  },
  refreshBtnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
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
  swatchRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
});
