import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { genIdea } from "../../utils";
import { WorkspaceAvatar } from "../common/WorkspaceAvatar";
import { WarmModal } from "../common/WarmModal";
import { HueSlider } from "../common/HueSlider";
import { hueToAccentHex, hexToHue, DEFAULT_WORKSPACE_COLOR } from "../../domain/workspaceTheme";
import { colors, radii } from "../../design/tokens";

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

function randomHue() {
  return Math.floor(Math.random() * 360);
}

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
  const [hue, setHue] = useState(() =>
    initialColor ? hexToHue(initialColor) : randomHue()
  );
  const [avatarKey, setAvatarKey] = useState(initialAvatarKey ?? Date.now());

  // Sync when modal re-opens with fresh initial values
  const prevVisible = useRef(false);
  useEffect(() => {
    if (visible && !prevVisible.current) {
      setName(initialName ?? "");
      setDescription(initialDescription ?? "");
      setHue(initialColor ? hexToHue(initialColor) : randomHue());
      setAvatarKey(initialAvatarKey ?? Date.now());
    }
    prevVisible.current = visible;
  }, [visible, initialName, initialDescription, initialColor, initialAvatarKey]);

  const accentColor = hueToAccentHex(hue);

  return (
    <WarmModal visible={visible} onRequestClose={onCancel} title={title} scrollable>
      {/* ── Avatar preview ──────────────────────────────────────────────── */}
      <View style={wsStyles.avatarRow}>
        <View style={wsStyles.avatarWrap}>
          <WorkspaceAvatar
            color={accentColor}
            name={name || "?"}
            size={64}
            avatarKey={avatarKey}
          />
          <Pressable
            style={({ pressed }) => [wsStyles.refreshBadge, pressed ? wsStyles.pressed : null]}
            onPress={() => setAvatarKey(Date.now())}
            hitSlop={6}
          >
            <Ionicons name="refresh-outline" size={13} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* ── Hue slider ──────────────────────────────────────────────────── */}
      <HueSlider hue={hue} onChange={setHue} />

      {/* ── Name input ──────────────────────────────────────────────────── */}
      <View style={wsStyles.inputWrap}>
        <TextInput
          testID="workspace-name-input"
          style={wsStyles.input}
          value={name}
          onChangeText={setName}
          placeholder="Workspace name"
          placeholderTextColor="#B8A8A3"
          returnKeyType="next"
        />
        <View style={wsStyles.inputBtns}>
          <Pressable
            style={({ pressed }) => [wsStyles.inputIconBtn, pressed ? wsStyles.pressed : null]}
            onPress={() => setName(genIdea())}
            hitSlop={6}
          >
            <Ionicons name="sparkles" size={14} color="#B8A8A3" />
          </Pressable>
          {name.length > 0 ? (
            <Pressable
              style={({ pressed }) => [wsStyles.inputIconBtn, pressed ? wsStyles.pressed : null]}
              onPress={() => setName("")}
              hitSlop={6}
            >
              <Ionicons name="close" size={14} color="#B8A8A3" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* ── Description input ───────────────────────────────────────────── */}
      <TextInput
        style={[wsStyles.input, wsStyles.descriptionInput]}
        value={description}
        onChangeText={setDescription}
        placeholder="Description (optional)"
        placeholderTextColor="#B8A8A3"
        multiline
        returnKeyType="default"
      />

      {/* ── Archive / Delete actions ─────────────────────────────────────── */}
      {(showArchiveAction && onArchiveAction) || (showDelete && onDelete) ? (
        <View style={wsStyles.dangerRow}>
          {showArchiveAction && onArchiveAction ? (
            <Pressable
              style={({ pressed }) => [
                wsStyles.dangerBtn,
                archiveActionDisabled ? wsStyles.btnDisabled : null,
                pressed && !archiveActionDisabled ? wsStyles.pressed : null,
              ]}
              disabled={archiveActionDisabled}
              onPress={onArchiveAction}
            >
              <Text style={wsStyles.dangerBtnText}>{archiveActionLabel ?? "Archive"}</Text>
            </Pressable>
          ) : null}
          {showDelete && onDelete ? (
            <Pressable
              style={({ pressed }) => [wsStyles.deleteBtn, pressed ? wsStyles.pressed : null]}
              onPress={onDelete}
            >
              <Text style={wsStyles.deleteBtnText}>{deleteLabel ?? "Delete permanently"}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* ── Cancel / Save ───────────────────────────────────────────────── */}
      <View style={wsStyles.btnRow}>
        <Pressable
          style={({ pressed }) => [wsStyles.cancelBtn, pressed ? wsStyles.pressed : null]}
          onPress={onCancel}
        >
          <Text style={wsStyles.cancelBtnText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [wsStyles.saveBtn, pressed ? wsStyles.pressed : null]}
          onPress={() => onSave(name.trim(), description.trim(), accentColor, avatarKey)}
        >
          <Text style={wsStyles.saveBtnText}>Save</Text>
        </Pressable>
      </View>
    </WarmModal>
  );
}

const wsStyles = StyleSheet.create({
  avatarRow: {
    alignItems: "center",
    marginBottom: 4,
  },
  avatarWrap: {
    position: "relative",
  },
  refreshBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1.5,
    borderColor: colors.page,
    alignItems: "center",
    justifyContent: "center",
  },
  inputWrap: {
    position: "relative",
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(215,194,189,0.6)",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingLeft: 14,
    paddingRight: 72,
    paddingVertical: 10,
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 16,
    lineHeight: 22,
    color: "#1C1C19",
  },
  inputBtns: {
    position: "absolute",
    right: 10,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  inputIconBtn: {
    width: 26,
    height: 26,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  descriptionInput: {
    marginTop: 10,
    minHeight: 70,
    textAlignVertical: "top",
    paddingTop: 10,
    paddingRight: 14,
    fontSize: 14,
    lineHeight: 20,
  },
  btnRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(215,194,189,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textSecondary,
  },
  saveBtn: {
    height: 42,
    paddingHorizontal: 20,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 13,
    color: colors.surface,
  },
  dangerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  dangerBtn: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(215,194,189,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  dangerBtnText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12,
    color: colors.textSecondary,
  },
  deleteBtn: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(184,50,50,0.25)",
    backgroundColor: "rgba(184,50,50,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12,
    color: "#a83232",
  },
  btnDisabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
});
