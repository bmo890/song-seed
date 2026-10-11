import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { BottomSheet } from "./BottomSheet";
import { WorkspaceAvatar } from "./WorkspaceAvatar";
import { styles } from "../../styles";
import { colors } from "../../design/tokens";
import { haptic } from "../../design/haptics";
import { UserText } from "../../i18n";
import type { Workspace } from "../../types";

type WorkspacePickSheetProps = {
  visible: boolean;
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  onPick: (workspaceId: string) => void;
  onClose: () => void;
};

/**
 * "Pick from another workspace" — the hub's workspace switcher while a
 * compilation is collecting. The drawer is the normal switcher, but a picker
 * carries no menu (tasks don't), so the identity block opens this instead:
 * the action-sheet recipe with the workspace mark in the lead slot and a
 * check on the one you are in.
 */
export function WorkspacePickSheet({ visible, workspaces, currentWorkspaceId, onPick, onClose }: WorkspacePickSheetProps) {
  const { t } = useTranslation();
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.selectionSheetHeader}>
        <Text style={styles.selectionSheetTitle}>{t("selection.pickFromWorkspace")}</Text>
      </View>
      <View style={styles.selectionSheetActionList}>
        {workspaces.map((workspace) => {
          const current = workspace.id === currentWorkspaceId;
          return (
            <Pressable
              key={workspace.id}
              testID={`workspace-pick-${workspace.id}`}
              style={({ pressed }) => [styles.selectionSheetAction, pressed ? styles.pressDown : null]}
              onPress={() => {
                // haptics vocabulary: `tap` — an acknowledged press.
                haptic.tap();
                onClose();
                if (!current) onPick(workspace.id);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: current }}
              accessibilityLabel={workspace.title}
            >
              <View style={styles.selectionSheetActionLead}>
                <WorkspaceAvatar color={workspace.color} name={workspace.title} size={20} avatarKey={workspace.avatarKey} />
                <UserText value={workspace.title} style={styles.selectionSheetActionText} numberOfLines={1}>
                  {workspace.title}
                </UserText>
              </View>
              {current ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}
