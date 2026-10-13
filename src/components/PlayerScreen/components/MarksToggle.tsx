import React from "react";
import { Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { colors } from "../../../design/tokens";
import { playerScreenStyles } from "../styles";
import { Press } from "../../common/Press";

type MarksToggleProps = {
  visible: boolean;
  onToggle: () => void;
};

/**
 * Show / hide the reel's marks (sections and pins). Visible is the resting
 * state and stays a bare eye. Hidden is the state a player can forget they
 * chose — "where did my sections go?" — so it wears the active chip with the
 * crossed eye AND the words, the same chip Loop uses when it is on. The
 * toggle is a statement of the current state, not of what a tap will do.
 */
export function MarksToggle({ visible, onToggle }: MarksToggleProps) {
  const { t } = useTranslation();
  if (visible) {
    return (
      <Press
        // Haptics (Press): `light` — a small state flip, the marks show or hide.
        haptic="light"
        style={playerScreenStyles.readingIconButton}
        onPress={onToggle}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityState={{ checked: true }}
        accessibilityLabel={t("player.hideMarkers")}
      >
        <Ionicons name="eye-outline" size={15} color={colors.textSecondary} />
      </Press>
    );
  }
  return (
    <Press
      haptic="light"
      style={[playerScreenStyles.readingChip, playerScreenStyles.readingChipActive]}
      onPress={onToggle}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ checked: false }}
      accessibilityLabel={t("player.showMarkers")}
    >
      <Ionicons name="eye-off-outline" size={14} color={colors.primaryDeep} />
      <Text style={[playerScreenStyles.readingChipText, playerScreenStyles.readingChipTextActive]}>
        {t("player.marksHidden")}
      </Text>
    </Press>
  );
}
