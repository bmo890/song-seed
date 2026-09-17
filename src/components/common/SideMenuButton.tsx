import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useStore } from "../../state/useStore";
import { useShallow } from "zustand/react/shallow";
import { WorkspaceAvatar } from "./WorkspaceAvatar";
import { useSideMenuStore } from "./sideMenuStore";
import { styles } from "../../styles";
import { colors } from "../../design/tokens";

/**
 * The side menu's door on PUSHED pages (navigation law, 2026-09-17): places get
 * the menu, tasks don't, pushed places get this quiet second door.
 *
 * The leading slot on a pushed page is the honest back button, so the menu
 * can't live there. Its door is the workspace's own mark — the same one that
 * heads the side menu and the collection nav row — sitting beside the overflow.
 * No words, no colour of its own. Opening is navigation: silent, no haptic.
 */
export function SideMenuButton({ testID = "side-menu-mark" }: { testID?: string }) {
  const { t } = useTranslation();
  const openMenu = useSideMenuStore((s) => s.openMenu);
  const workspace = useStore(
    useShallow((s) => {
      const ws = s.workspaces.find((candidate) => candidate.id === s.activeWorkspaceId);
      return ws ? { title: ws.title, color: ws.color, avatarKey: ws.avatarKey } : null;
    })
  );

  return (
    <Pressable
      testID={testID}
      style={({ pressed }) => [buttonStyles.base, pressed ? styles.pressDown : null]}
      onPress={openMenu}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t("workspaceBrowse.openMenu")}
    >
      {workspace ? (
        <WorkspaceAvatar color={workspace.color} name={workspace.title} size={20} avatarKey={workspace.avatarKey} />
      ) : (
        <Ionicons name="menu-outline" size={20} color={colors.textSecondary} />
      )}
    </Pressable>
  );
}

const buttonStyles = StyleSheet.create({
  base: {
    width: 28,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});
