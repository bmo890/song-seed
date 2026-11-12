import { StyleSheet } from "react-native";
import { Press } from "./Press";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSideMenuStore } from "./sideMenuStore";
import { colors } from "../../design/tokens";

/**
 * The side menu's door on PUSHED pages (navigation law, 2026-09-17): places get
 * the menu, tasks don't, pushed places get this second door.
 *
 * The leading slot on a pushed page is the honest back button, and on iOS the
 * edge swipe is back too, so the menu can't live there. Its door sits beside the
 * overflow and is the same menu glyph the top-level pages wear (2026-11-13: it
 * was the workspace's mark, which the founder never read as a button). No words,
 * no colour of its own. Opening is navigation: silent, no haptic.
 */
export function SideMenuButton({ testID = "side-menu-mark" }: { testID?: string }) {
  const { t } = useTranslation();
  const openMenu = useSideMenuStore((s) => s.openMenu);

  return (
    <Press
      haptic="none"
      testID={testID}
      style={buttonStyles.base}
      onPress={openMenu}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t("workspaceBrowse.openMenu")}
    >
      <Ionicons name="menu-outline" size={22} color={colors.textSecondary} />
    </Press>
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
