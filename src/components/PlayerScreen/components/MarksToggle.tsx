import React from "react";
import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { colors } from "../../../design/tokens";
import { playerScreenStyles } from "../styles";

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
      <Pressable
        style={({ pressed }) => [
          playerScreenStyles.readingIconButton,
          pressed ? playerScreenStyles.overflowButtonPressed : null,
        ]}
        onPress={onToggle}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityState={{ checked: true }}
        accessibilityLabel={t("player.hideMarkers")}
      >
        <Ionicons name="eye-outline" size={15} color={colors.textSecondary} />
      </Pressable>
    );
  }
  return (
    <Pressable
      style={({ pressed }) => [
        playerScreenStyles.readingChip,
        playerScreenStyles.readingChipActive,
        pressed ? playerScreenStyles.overflowButtonPressed : null,
      ]}
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
    </Pressable>
  );
}
